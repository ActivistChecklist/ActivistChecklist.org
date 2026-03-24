#!/usr/bin/env node

/**
 * Compare Storyblok source content against migrated MDX files.
 *
 * Extracts normalized plain text from both sources and diffs them
 * to find missing, extra, or changed content.
 *
 * Usage:
 *   node scripts/compare-content.mjs                  # compare all
 *   node scripts/compare-content.mjs --type=guide     # compare only guides
 *   node scripts/compare-content.mjs --slug=federal   # compare one story
 *   node scripts/compare-content.mjs --verbose        # show full diffs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(ROOT, '.env') });

const TOKEN = process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN
  || process.env.NEXT_PUBLIC_STORYBLOK_PUBLIC_TOKEN;

if (!TOKEN) {
  console.error('Missing Storyblok access token.');
  process.exit(1);
}

const CONTENT_DIR = path.join(ROOT, 'content', 'en');
const VERBOSE = process.argv.includes('--verbose');
const TYPE_FILTER = process.argv.find(a => a.startsWith('--type='))?.split('=')[1];
const SLUG_FILTER = process.argv.find(a => a.startsWith('--slug='))?.split('=')[1];

// ─── Storyblok API ───

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const _cv = String(Math.floor(Date.now() / 1000));

async function apiFetch(endpoint, params = {}) {
  const cv = _cv;
  const url = new URL(`https://api-us.storyblok.com/v2${endpoint}`);
  url.searchParams.set('token', TOKEN);
  url.searchParams.set('version', 'published');
  url.searchParams.set('cv', cv);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url.toString(), { redirect: 'follow' });
    if (res.status === 429) {
      await sleep(300 * Math.pow(2, attempt) + Math.random() * 200);
      continue;
    }
    if (!res.ok) throw new Error(`API error: ${res.status} for ${endpoint}`);
    return res.json();
  }
  throw new Error(`Too many retries for ${endpoint}`);
}

async function fetchAllStories() {
  const stories = [];
  let page = 1;
  while (true) {
    const data = await apiFetch('/cdn/stories', { per_page: '100', page: String(page) });
    if (!data.stories?.length) break;
    stories.push(...data.stories);
    if (data.stories.length < 100) break;
    page++;
  }
  return stories;
}

// ─── Storyblok rich text → plain text ───

function storyblokToPlainText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(storyblokToPlainText).join('');

  if (node.type === 'text') return node.text || '';
  if (node.type === 'emoji') return node.attrs?.emoji || '';
  if (node.type === 'hard_break') return '\n';
  if (node.type === 'horizontal_rule') return '\n---\n';

  // Headings: add newlines
  if (node.type === 'heading') {
    const inner = (node.content || []).map(storyblokToPlainText).join('');
    return `\n${inner}\n`;
  }

  // Paragraphs
  if (node.type === 'paragraph') {
    const inner = (node.content || []).map(storyblokToPlainText).join('');
    return inner + '\n';
  }

  // Lists
  if (node.type === 'bullet_list' || node.type === 'ordered_list') {
    return (node.content || []).map(storyblokToPlainText).join('');
  }
  if (node.type === 'list_item') {
    const inner = (node.content || []).map(storyblokToPlainText).join('').trim();
    return inner + '\n';
  }

  // Blockquote
  if (node.type === 'blockquote') {
    return (node.content || []).map(storyblokToPlainText).join('');
  }

  // Code block
  if (node.type === 'code_block') {
    return (node.content || []).map(n => n.text || '').join('') + '\n';
  }

  // Blok (embedded component)
  if (node.type === 'blok') {
    const bloks = node.attrs?.body || [];
    return bloks.map(blokToPlainText).join('');
  }

  // Document
  if (node.type === 'doc') {
    return (node.content || []).map(storyblokToPlainText).join('');
  }

  // Image
  if (node.type === 'image') return '';

  // Fallback: recurse into content
  if (node.content) {
    return (node.content || []).map(storyblokToPlainText).join('');
  }

  return '';
}

function blokToPlainText(blok) {
  if (!blok) return '';

  let text = '';

  // Extract text from common rich text fields
  for (const field of ['body', 'description', 'caption', 'comment']) {
    if (blok[field] && typeof blok[field] === 'object' && blok[field].type) {
      text += storyblokToPlainText(blok[field]);
    }
  }

  // Extract text from string fields
  if (blok.title) text = blok.title + '\n' + text;

  return text;
}

// ─── Extract all text from a Storyblok story ───

function extractStoryText(story) {
  const c = story.content;
  const comp = c.component;
  let parts = [];

  // Title: checklist-item/guide/page have a custom content.title field.
  // news-item/changelog-entry/news-source have no separate title field in MDX.
  // Only include title for types that write it to frontmatter.
  const titleTypes = ['checklist-item', 'guide', 'page', 'news-item'];
  if (titleTypes.includes(comp)) {
    parts.push(c.title || story.name);
  }

  // Checklist item frontmatter fields come before body (to match MDX frontmatter order)
  if (comp === 'checklist-item') {
    if (c.why) parts.push(c.why);
    if (c.tools) parts.push(c.tools);
    if (c.stop) parts.push(c.stop);
  }

  // Common rich text body
  if (c.body && typeof c.body === 'object' && c.body.type) {
    parts.push(storyblokToPlainText(c.body));
  }

  // Guide/page blocks
  if (c.blocks) {
    for (const block of c.blocks) {
      // Skip inline checklist items — they are compared as standalone files
      if (block.component === 'checklist-item') continue;
      // Skip checklist-item-ref — these are just reference tags
      if (block.component === 'checklist-item-ref') continue;
      parts.push(blokToPlainText(block));
    }
  }

  // News item
  if (comp === 'news-item') {
    if (c.comment && typeof c.comment === 'object') {
      parts.push(storyblokToPlainText(c.comment));
    }
  }

  // Changelog
  if (comp === 'changelog-entry') {
    if (c.body && typeof c.body === 'object') {
      parts.push(storyblokToPlainText(c.body));
    }
  }

  return parts.join('\n');
}

// ─── MDX → plain text ───

function mdxToPlainText(mdxContent) {
  // Extract frontmatter fields that contain content
  let frontmatterText = '';
  const fmMatch = mdxContent.match(/^---\n([\s\S]*?)\n---\n/);
  if (fmMatch) {
    const fmBlock = fmMatch[1];
    for (const line of fmBlock.split('\n')) {
      const m = line.match(/^(title|preview|do|dont):\s*(.+)/);
      if (m) {
        let val = m[2].trim();
        // Remove YAML quotes and unescape internal escaped quotes
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
        }
        frontmatterText += val + '\n';
      }
    }
  }

  // Strip frontmatter from body
  let text = frontmatterText + mdxContent.replace(/^---\n[\s\S]*?\n---\n/, '');

  // Extract title attributes from JSX tags before stripping
  text = text.replace(/<[A-Z][A-Za-z]+[^>]*\btitle="([^"]*)"[^>]*\/?>/g, (match, title) => {
    // Decode HTML entities in title attribute values
    const decoded = title.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    return decoded + '\n';
  });

  // Strip remaining JSX self-closing tags: <Component ... />
  text = text.replace(/<[A-Z][A-Za-z]+ [^>]*\/>/g, '');
  text = text.replace(/<[A-Z][A-Za-z]+ \/>/g, '');

  // Strip JSX opening/closing tags but keep content between them
  text = text.replace(/<\/?[A-Z][A-Za-z]*[^>]*>/g, '');

  // Strip HTML tags but keep content
  text = text.replace(/<\/?[a-z][a-z0-9]*[^>]*>/g, '');

  // Strip markdown formatting
  text = text.replace(/\*\*\*(.*?)\*\*\*/g, '$1');  // bold+italic
  text = text.replace(/\*\*(.*?)\*\*/g, '$1');       // bold
  text = text.replace(/\*(.*?)\*/g, '$1');            // italic
  text = text.replace(/~~(.*?)~~/g, '$1');            // strikethrough
  text = text.replace(/`([^`]+)`/g, '$1');            // inline code

  // Strip markdown links, keep text — handle nested parens in URLs like (film)
  text = text.replace(/\[([^\]]*)\]\((?:[^)(]|\([^)]*\))*\)/g, '$1');

  // Strip markdown images
  text = text.replace(/!\[[^\]]*\]\((?:[^)(]|\([^)]*\))*\)/g, '');

  // Strip heading markers
  text = text.replace(/^#{1,6}\s+/gm, '');

  // Strip list markers
  text = text.replace(/^[\s]*[-*+]\s+/gm, '');
  text = text.replace(/^[\s]*\d+\.\s+/gm, '');

  // Strip blockquote markers
  text = text.replace(/^>\s?/gm, '');

  // Strip horizontal rules
  text = text.replace(/^---$/gm, '');

  return text;
}

// ─── Normalize text for comparison ───

function normalize(text) {
  return text
    .replace(/\u00a0/g, ' ')          // non-breaking spaces
    .replace(/[""]/g, '"')            // smart quotes
    .replace(/['']/g, "'")            // smart apostrophes
    .replace(/[–—]/g, '-')            // dashes
    .replace(/…/g, '...')             // ellipsis
    .replace(/›/g, '>')              // angle quotes
    .replace(/https?:\/\/[^\s)>\]]+/g, '') // strip URLs
    .replace(/\?[a-zA-Z0-9_=&%+.-]+/g, '') // strip query strings (leftover URL params)
    .replace(/\[([^\]]*)\]\((?:[^)(]|\([^)]*\))*\)/g, '$1') // strip markdown links [text](url) → text
    .replace(/\[([^\]]*)\]\(\)/g, '$1')   // strip empty-URL markdown links [text]() → text
    .replace(/\s+/g, ' ')            // collapse whitespace
    .replace(/<CopyButton\s*\/?>/g, '') // remove CopyButton refs
    .replace(/\{[^}]*\}/g, '')        // remove {class} syntax
    .replace(/[a-z][-a-z]+(?: [-a-z]+)*\}/g, '') // strip CSS class fragments ending in } (no opening {)
    .trim()
    .toLowerCase();
}

// ─── Find MDX file for a story ───

function findMdxFile(story) {
  const c = story.content;
  const comp = c.component;
  const slug = c.slug || story.slug;

  let filePath;
  switch (comp) {
    case 'guide':
      filePath = path.join(CONTENT_DIR, 'guides', `${slug}.mdx`);
      break;
    case 'checklist-item':
      filePath = path.join(CONTENT_DIR, 'checklist-items', `${slug}.mdx`);
      break;
    case 'page':
      filePath = path.join(CONTENT_DIR, 'pages', `${slug}.mdx`);
      break;
    case 'news-item': {
      // Search in year subdirs
      const years = ['2025', '2026', '2027'];
      for (const year of years) {
        const p = path.join(CONTENT_DIR, 'news', year, `${story.slug}.mdx`);
        if (fs.existsSync(p)) { filePath = p; break; }
      }
      break;
    }
    case 'news-source':
      filePath = path.join(CONTENT_DIR, 'news-sources', `${story.slug}.mdx`);
      break;
    case 'changelog-entry': {
      // Has date prefix
      const dir = path.join(CONTENT_DIR, 'changelog');
      if (fs.existsSync(dir)) {
        const match = fs.readdirSync(dir).find(f => f.endsWith(`${story.slug}.mdx`));
        if (match) filePath = path.join(dir, match);
      }
      break;
    }
  }

  return filePath && fs.existsSync(filePath) ? filePath : null;
}

// ─── Word-level diff ───

function wordDiff(a, b) {
  const wordsA = a.split(/\s+/).filter(Boolean);
  const wordsB = b.split(/\s+/).filter(Boolean);

  // Find words in A not in B (missing from MDX)
  // Find words in B not in A (extra in MDX)
  // Use a simple sliding window approach for context

  const setA = new Set(wordsA);
  const setB = new Set(wordsB);

  const missingWords = wordsA.filter(w => !setB.has(w));
  const extraWords = wordsB.filter(w => !setA.has(w));

  return { missingWords, extraWords };
}

// Find contiguous chunks of text in source that are missing from target
function findMissingChunks(sourceText, targetText, minLength = 30) {
  const targetNorm = normalize(targetText);

  // Split source on newlines FIRST (before normalize collapses them),
  // then split each line on period+space. This prevents titles/field values
  // from being merged with subsequent body text.
  const rawLines = sourceText.split('\n').flatMap(line => {
    return line.split(/\.\s+/).map(s => s.trim()).filter(Boolean);
  });

  const missing = [];
  for (const raw of rawLines) {
    const norm = normalize(raw);
    if (norm.length < minLength) continue;
    if (!targetNorm.includes(norm)) {
      missing.push(norm);
    }
  }

  return missing;
}

// ─── Main ───

async function main() {
  console.log('Fetching stories from Storyblok...\n');
  const allStories = await fetchAllStories();
  console.log(`Fetched ${allStories.length} stories.\n`);

  const results = { matches: 0, mismatches: 0, missing: 0, skipped: 0 };
  const issues = [];
  // Track checklist items that exist as standalone Storyblok stories.
  // Inline copies in guides are skipped since the standalone version is authoritative.
  const standaloneChecklistSlugs = new Set(
    allStories
      .filter(s => s.content?.component === 'checklist-item')
      .map(s => s.content?.slug || s.slug)
  );
  // Track slugs already compared (standalone or inline) to avoid double-counting
  // when the same resolved slug appears in multiple guides.
  const alreadyComparedSlugs = new Set();

  for (const story of allStories) {
    const comp = story.content?.component;
    if (!comp || story.is_folder) continue;

    // Apply filters
    if (TYPE_FILTER && comp !== TYPE_FILTER) continue;
    if (SLUG_FILTER && story.slug !== SLUG_FILTER) continue;

    // Skip news sources (just metadata, no real body text)
    if (comp === 'news-source') {
      results.skipped++;
      continue;
    }

    // For guides, we compare the guide body + section descriptions,
    // but NOT the inline checklist items (those are separate files now)
    const slug = story.content.slug || story.slug;

    // Find MDX file
    let mdxPath;
    if (comp === 'guide') {
      mdxPath = path.join(CONTENT_DIR, 'guides', `${story.slug}.mdx`);
    } else {
      mdxPath = findMdxFile(story);
    }

    if (!mdxPath || !fs.existsSync(mdxPath)) {
      // For inline checklist items in guides, check if they exist as standalone files
      if (comp === 'checklist-item') {
        // These are standalone stories — they should have files
        results.missing++;
        issues.push({
          slug,
          component: comp,
          issue: 'FILE_MISSING',
          detail: `No MDX file found for checklist item "${slug}"`,
        });
      }
      continue;
    }

    // Extract and normalize text
    const sourceText = extractStoryText(story);
    const mdxContent = fs.readFileSync(mdxPath, 'utf-8');
    const mdxText = mdxToPlainText(mdxContent);

    const sourceNorm = normalize(sourceText);
    const mdxNorm = normalize(mdxText);

    if (sourceNorm === mdxNorm) {
      results.matches++;
      continue;
    }

    // Find what's missing
    const missingChunks = findMissingChunks(sourceText, mdxText, 20);

    if (missingChunks.length === 0) {
      // Text differs but no significant chunks are missing — likely formatting only
      results.matches++;
      continue;
    }

    results.mismatches++;
    const issue = {
      slug: story.slug,
      component: comp,
      issue: 'CONTENT_DIFF',
      missingChunks: missingChunks.slice(0, 5), // limit output
      sourceLen: sourceNorm.length,
      mdxLen: mdxNorm.length,
    };
    issues.push(issue);

    if (VERBOSE) {
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`${comp}/${story.slug} — ${missingChunks.length} missing chunks`);
      for (const chunk of missingChunks.slice(0, 10)) {
        console.log(`  MISSING: "${chunk.substring(0, 120)}${chunk.length > 120 ? '...' : ''}"`);
      }
    }
  }

  // After processing all standalone checklist items, record their slugs as already compared.
  // This prevents duplicate inline comparisons for the same slug across multiple guides.
  for (const story of allStories) {
    if (story.content?.component === 'checklist-item') {
      alreadyComparedSlugs.add(story.content?.slug || story.slug);
    }
  }

  // ─── Also check inline checklist items from guides ───
  // These were extracted as standalone files — verify they exist
  for (const story of allStories) {
    if (story.content?.component !== 'guide') continue;
    if (TYPE_FILTER && TYPE_FILTER !== 'guide' && TYPE_FILTER !== 'checklist-item') continue;

    // Track per-guide slug counts for positional duplicate detection
    const guideSlugCounts = {};

    for (const block of (story.content.blocks || [])) {
      if (block.component !== 'checklist-item') continue;
      const itemSlug = block.slug || '';
      if (!itemSlug) continue;
      if (SLUG_FILTER && itemSlug !== SLUG_FILTER) continue;

      // Track slug count within this guide (for duplicate slug detection)
      guideSlugCounts[itemSlug] = (guideSlugCounts[itemSlug] || 0) + 1;

      // If this slug has a standalone Storyblok story, skip it here —
      // the standalone version is authoritative and already compared above.
      if (standaloneChecklistSlugs.has(itemSlug)) continue;

      // Apply slug remapping (same as migration script)
      let resolvedSlug = itemSlug;
      const remaps = {
        'travel': { 'phone-off': 'phone-off-travel', 'signal': 'signal-travel', 'secondary': 'secondary-travel' },
        'ice': { 'secondary': 'secondary-ice' },
        'doxxing': { 'essentials': 'essentials-doxxing' },
        'spyware': { 'essentials': 'essentials-doxxing' },
        'federal': { 'essentials': 'essentials-federal' },
      };
      if (remaps[story.slug]?.[itemSlug]) {
        resolvedSlug = remaps[story.slug][itemSlug];
      }

      // Handle secondary guide's duplicate "sim" — second occurrence is "sim-data-only"
      if (story.slug === 'secondary' && itemSlug === 'sim' && guideSlugCounts[itemSlug] === 2) {
        resolvedSlug = 'sim-data-only';
      }

      // For slugs with a designated priority guide, only compare that guide's version.
      // (Mirrors INLINE_PRIORITY in migrate-from-storyblok.mjs)
      const inlinePriority = { 'biometrics-disable': 'protest', 'personal-secure': 'federal' };
      if (inlinePriority[resolvedSlug] && story.slug !== inlinePriority[resolvedSlug]) {
        results.skipped++;
        continue;
      }

      // Skip if this resolved slug was already compared (standalone or a prior guide's inline version).
      // Only the first guide to define an inline item should be compared.
      if (alreadyComparedSlugs.has(resolvedSlug)) {
        results.skipped++;
        continue;
      }
      alreadyComparedSlugs.add(resolvedSlug);

      const itemPath = path.join(CONTENT_DIR, 'checklist-items', `${resolvedSlug}.mdx`);
      if (!fs.existsSync(itemPath)) {
        results.missing++;
        issues.push({
          slug: resolvedSlug,
          component: 'inline-checklist-item',
          issue: 'FILE_MISSING',
          detail: `Inline item "${resolvedSlug}" from guide "${story.slug}" has no MDX file`,
        });
        continue;
      }

      // Compare text content
      const sourceText = [
        block.title || '',
        block.why || '',
        block.tools || '',
        block.stop || '',
        block.body ? storyblokToPlainText(block.body) : '',
      ].join('\n');

      const mdxContent = fs.readFileSync(itemPath, 'utf-8');
      const mdxText = mdxToPlainText(mdxContent);

      const missingChunks = findMissingChunks(sourceText, mdxText, 20);

      if (missingChunks.length > 0) {
        results.mismatches++;
        issues.push({
          slug: resolvedSlug,
          component: 'inline-checklist-item',
          issue: 'CONTENT_DIFF',
          guideSlug: story.slug,
          missingChunks: missingChunks.slice(0, 5),
        });
      } else {
        results.matches++;
      }
    }
  }

  // ─── Report ───
  console.log('\n═══════════════════════════════════════');
  console.log('  Content Comparison Report');
  console.log('═══════════════════════════════════════');
  console.log(`  Matches:    ${results.matches}`);
  console.log(`  Mismatches: ${results.mismatches}`);
  console.log(`  Missing:    ${results.missing}`);
  console.log(`  Skipped:    ${results.skipped}`);
  console.log();

  if (issues.length === 0) {
    console.log('  ✓ All content matches!\n');
    return;
  }

  // Group issues by type
  const fileMissing = issues.filter(i => i.issue === 'FILE_MISSING');
  const contentDiff = issues.filter(i => i.issue === 'CONTENT_DIFF');

  if (fileMissing.length > 0) {
    console.log(`\n── Missing Files (${fileMissing.length}) ──`);
    for (const issue of fileMissing) {
      console.log(`  ✗ ${issue.detail || issue.slug}`);
    }
  }

  if (contentDiff.length > 0) {
    console.log(`\n── Content Differences (${contentDiff.length}) ──`);
    for (const issue of contentDiff) {
      const prefix = issue.guideSlug ? `${issue.guideSlug}/${issue.slug}` : issue.slug;
      console.log(`\n  ${issue.component}/${prefix}:`);
      for (const chunk of issue.missingChunks) {
        const truncated = chunk.length > 100 ? chunk.substring(0, 100) + '...' : chunk;
        console.log(`    MISSING: "${truncated}"`);
      }
    }
  }

  console.log();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
