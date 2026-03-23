#!/usr/bin/env node

/**
 * Migration script: Storyblok → file-based MDX content
 *
 * Fetches all stories from the Storyblok API and converts them to MDX files
 * in content/en/. This is a one-time migration script.
 *
 * Usage:
 *   node scripts/migrate-from-storyblok.mjs
 *   node scripts/migrate-from-storyblok.mjs --dry-run     # show what would be created
 *   node scripts/migrate-from-storyblok.mjs --type=guide  # migrate only guides
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(ROOT, '.env') });

const TOKEN = process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN
  || process.env.NEXT_PUBLIC_STORYBLOK_PUBLIC_TOKEN;

if (!TOKEN) {
  console.error('Missing Storyblok access token. Set NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN in .env');
  process.exit(1);
}

const API_BASE = 'https://api-us.storyblok.com/v2';
const CONTENT_DIR = path.join(ROOT, 'content', 'en');
const ASSET_DIR = path.join(ROOT, 'public', 'images', 'content');

const DRY_RUN = process.argv.includes('--dry-run');
const TYPE_FILTER = process.argv.find(a => a.startsWith('--type='))?.split('=')[1];

// ─── Storyblok API ───────────────────────────────────────────────

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function apiFetch(endpoint, params = {}) {
  const url = new URL(`${API_BASE}${endpoint}`);
  url.searchParams.set('token', TOKEN);
  url.searchParams.set('version', 'published');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url.toString());
    if (res.status === 429) {
      const delay = 300 * Math.pow(2, attempt) + Math.random() * 200;
      console.warn(`  Rate limited, retrying in ${Math.round(delay)}ms...`);
      await sleep(delay);
      continue;
    }
    if (!res.ok) {
      throw new Error(`Storyblok API error: ${res.status} ${res.statusText} for ${endpoint}`);
    }
    return res.json();
  }
  throw new Error(`Storyblok API: too many retries for ${endpoint}`);
}

async function fetchAllStories(params = {}) {
  const stories = [];
  let page = 1;
  while (true) {
    const data = await apiFetch('/cdn/stories', { per_page: '100', page: String(page), ...params });
    if (!data.stories?.length) break;
    stories.push(...data.stories);
    if (data.stories.length < 100) break;
    page++;
  }
  return stories;
}

// ─── Rich Text → Markdown conversion ─────────────────────────────

function resolveStoryblokLink(linkObj) {
  if (!linkObj) return '';
  // If it's already a plain string URL
  if (typeof linkObj === 'string') return linkObj;
  // Storyblok multilink object
  if (linkObj.fieldtype === 'multilink' || linkObj.linktype) {
    if (linkObj.linktype === 'url') {
      return linkObj.url || linkObj.cached_url || '';
    }
    // Story link
    const p = linkObj.cached_url || linkObj.url || '';
    if (p && !p.startsWith('/') && !p.startsWith('http')) {
      return `/${p}`;
    }
    return p;
  }
  return '';
}

function resolveStoryblokImage(imageObj) {
  if (!imageObj) return null;
  if (typeof imageObj === 'string') return imageObj || null;
  // Storyblok asset object
  const filename = imageObj.filename || imageObj.cached_url || '';
  return filename || null;
}

/**
 * Convert Storyblok rich text marks to markdown.
 */
function applyMarks(text, marks) {
  if (!marks || marks.length === 0) return text;
  let result = text;
  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':
        result = `**${result}**`;
        break;
      case 'italic':
        result = `*${result}*`;
        break;
      case 'strike':
        result = `~~${result}~~`;
        break;
      case 'code':
        result = `\`${result}\``;
        break;
      case 'underline':
        result = `<u>${result}</u>`;
        break;
      case 'link': {
        const href = mark.attrs?.href || resolveStoryblokLink(mark.attrs);
        const target = mark.attrs?.target;
        if (target === '_blank') {
          result = `[${result}](${href})`;
        } else {
          result = `[${result}](${href})`;
        }
        break;
      }
      case 'superscript':
        result = `<sup>${result}</sup>`;
        break;
      case 'subscript':
        result = `<sub>${result}</sub>`;
        break;
    }
  }
  return result;
}

/**
 * Convert {className}text{/} syntax to <span className="...">text</span>
 */
function convertClassSyntax(text) {
  return text.replace(/\{([^}]+)\}(.*?)\{\/\}/g, (match, className, content) => {
    return `<span className="${className}">${content}</span>`;
  });
}

/**
 * Convert inline component tags like <Badge>, <ProtectionBadge>, <CopyButton>
 * These are custom text patterns in Storyblok text nodes.
 */
function convertInlineComponents(text) {
  // These are text-level components used in Storyblok text resolver
  // They'll remain as JSX in the MDX output
  return text;
}

/**
 * Convert a Storyblok rich text node tree to markdown string.
 */
function richTextToMdx(node, indent = '') {
  if (!node) return '';

  // Handle array of nodes
  if (Array.isArray(node)) {
    return node.map(n => richTextToMdx(n, indent)).join('');
  }

  // Document root
  if (node.type === 'doc') {
    return (node.content || []).map(n => richTextToMdx(n, indent)).join('\n');
  }

  // Text node
  if (node.type === 'text') {
    let text = node.text || '';
    text = convertClassSyntax(text);
    text = convertInlineComponents(text);
    return applyMarks(text, node.marks);
  }

  // Paragraph
  if (node.type === 'paragraph') {
    const inner = (node.content || []).map(n => richTextToMdx(n, indent)).join('');
    return inner + '\n';
  }

  // Headings
  if (node.type === 'heading') {
    const level = node.attrs?.level || 2;
    const prefix = '#'.repeat(level);
    const inner = (node.content || []).map(n => richTextToMdx(n, indent)).join('');
    return `${prefix} ${inner}\n`;
  }

  // Bullet list
  if (node.type === 'bullet_list') {
    return (node.content || []).map(n => richTextToMdx(n, indent)).join('') + '\n';
  }

  // Ordered list
  if (node.type === 'ordered_list') {
    let counter = node.attrs?.start || 1;
    return (node.content || []).map(n => {
      const result = richTextToMdx(n, indent, counter);
      counter++;
      return result;
    }).join('') + '\n';
  }

  // List item
  if (node.type === 'list_item') {
    const inner = (node.content || []).map(n => richTextToMdx(n, indent)).join('').trim();
    // Check if parent was ordered list (third arg is counter)
    if (typeof arguments[2] === 'number') {
      return `${indent}${arguments[2]}. ${inner}\n`;
    }
    return `${indent}- ${inner}\n`;
  }

  // Blockquote
  if (node.type === 'blockquote') {
    const inner = (node.content || []).map(n => richTextToMdx(n, indent)).join('');
    return inner.split('\n').filter(l => l).map(l => `> ${l}`).join('\n') + '\n';
  }

  // Code block
  if (node.type === 'code_block') {
    const lang = node.attrs?.class?.replace('language-', '') || '';
    const inner = (node.content || []).map(n => n.text || '').join('');
    return `\`\`\`${lang}\n${inner}\n\`\`\`\n`;
  }

  // Horizontal rule
  if (node.type === 'horizontal_rule') {
    return '---\n';
  }

  // Hard break
  if (node.type === 'hard_break') {
    return '  \n';
  }

  // Image
  if (node.type === 'image') {
    const src = node.attrs?.src || '';
    const alt = node.attrs?.alt || '';
    const title = node.attrs?.title;
    if (title) {
      return `![${alt}](${src} "${title}")\n`;
    }
    return `![${alt}](${src})\n`;
  }

  // Embedded blok (component)
  if (node.type === 'blok') {
    const bloks = node.attrs?.body || [];
    return bloks.map(b => convertBlokToMdx(b)).join('\n');
  }

  // Fallback: process children
  if (node.content) {
    return (node.content || []).map(n => richTextToMdx(n, indent)).join('');
  }

  return '';
}

// ─── Blok → MDX component conversion ─────────────────────────────

function convertBlokToMdx(blok) {
  if (!blok || !blok.component) return '';

  switch (blok.component) {
    case 'alert':
      return convertAlert(blok);
    case 'how_to':
      return convertHowTo(blok);
    case 'button':
      return convertButton(blok);
    case 'image_embed':
      return convertImageEmbed(blok);
    case 'video_embed':
      return convertVideoEmbed(blok);
    case 'risk_level':
      return convertRiskLevel(blok);
    case 'table':
      return convertTable(blok);
    case 'related_guides':
    case 'related-guides':
      return convertRelatedGuides(blok);
    case 'section-header':
      return convertSectionHeader(blok);
    case 'checklist-item':
      // Inline checklist items in guides are handled separately
      return '';
    case 'checklist-item-ref':
      return convertChecklistItemRef(blok);
    case 'checklist-item-reference':
      return convertChecklistItemReference(blok);
    default:
      console.warn(`  Unknown blok component: ${blok.component}`);
      return `{/* Unknown component: ${blok.component} */}`;
  }
}

function convertAlert(blok) {
  const type = blok.type || 'default';
  const title = blok.title || '';
  const body = richTextToMdx(blok.body).trim();

  const attrs = [`type="${type}"`];
  if (title) attrs.push(`title="${escapeAttr(title)}"`);

  if (!body) {
    return `<Alert ${attrs.join(' ')} />\n`;
  }
  return `<Alert ${attrs.join(' ')}>\n\n${body}\n\n</Alert>\n`;
}

function convertHowTo(blok) {
  const title = blok.title || '';
  const body = richTextToMdx(blok.body).trim();

  return `<HowTo title="${escapeAttr(title)}">\n\n${body}\n\n</HowTo>\n`;
}

function convertButton(blok) {
  const attrs = [];
  if (blok.title) attrs.push(`title="${escapeAttr(blok.title)}"`);

  // Resolve URL
  const href = resolveStoryblokLink(blok.url);
  if (href && href !== '#') attrs.push(`url="${escapeAttr(href)}"`);

  if (blok.variant && blok.variant !== 'default') attrs.push(`variant="${blok.variant}"`);
  if (blok.download) attrs.push('download');
  if (blok.icon) attrs.push(`icon="${blok.icon}"`);
  if (blok.iconPosition && blok.iconPosition !== 'left') attrs.push(`iconPosition="${blok.iconPosition}"`);
  if (blok.alignment && blok.alignment !== 'left') attrs.push(`alignment="${blok.alignment}"`);

  return `<Button ${attrs.join(' ')} />\n`;
}

function convertImageEmbed(blok) {
  const src = resolveStoryblokImage(blok.image) || '';
  const alt = blok.alt || blok.image?.alt || '';
  const attrs = [`src="${escapeAttr(src)}"`, `alt="${escapeAttr(alt)}"`];

  if (blok.size && blok.size !== 'medium') attrs.push(`size="${blok.size}"`);
  if (blok.alignment) attrs.push(`alignment="${blok.alignment}"`);
  if (blok.className) attrs.push(`className="${blok.className}"`);

  const caption = blok.caption ? richTextToMdx(blok.caption).trim() : '';

  // Handle link
  if (blok.link) {
    const linkHref = resolveStoryblokLink(blok.link);
    if (linkHref && linkHref !== '#') attrs.push(`link="${escapeAttr(linkHref)}"`);
  }

  if (!caption) {
    return `<ImageEmbed ${attrs.join(' ')} />\n`;
  }
  return `<ImageEmbed ${attrs.join(' ')}>\n\n${caption}\n\n</ImageEmbed>\n`;
}

function convertVideoEmbed(blok) {
  const src = resolveStoryblokImage(blok.video_file || blok.video) || '';
  const attrs = [`src="${escapeAttr(src)}"`];

  if (blok.className) attrs.push(`className="${blok.className}"`);
  if (blok.controls === false) attrs.push('controls={false}');
  if (blok.autoplay) attrs.push('autoplay');
  if (blok.loop) attrs.push('loop');
  if (blok.muted) attrs.push('muted');

  const caption = blok.caption ? richTextToMdx(blok.caption).trim() : '';

  if (!caption) {
    return `<VideoEmbed ${attrs.join(' ')} />\n`;
  }
  return `<VideoEmbed ${attrs.join(' ')}>\n\n${caption}\n\n</VideoEmbed>\n`;
}

function convertRiskLevel(blok) {
  const level = blok.level || 'everyone';
  const body = blok.body ? richTextToMdx(blok.body).trim() : '';

  if (!body) {
    return `<RiskLevel level="${level}" />\n`;
  }
  return `<RiskLevel level="${level}">\n\n${body}\n\n</RiskLevel>\n`;
}

function convertTable(blok) {
  const table = blok.table;
  if (!table) return '';

  const headers = (table.thead || []).map(h => h.value || '');
  const rows = (table.tbody || []).map(row =>
    (row.body || []).map(cell => cell.value || '')
  );

  if (headers.length === 0 && rows.length === 0) return '';

  let md = '';
  if (headers.length > 0) {
    md += '| ' + headers.join(' | ') + ' |\n';
    md += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
  }
  for (const row of rows) {
    md += '| ' + row.join(' | ') + ' |\n';
  }
  return md + '\n';
}

function convertRelatedGuides(blok) {
  const guides = [];
  for (let i = 1; i <= 4; i++) {
    const guide = blok[`guide${i}`];
    if (guide) {
      const url = resolveStoryblokLink(guide);
      // Extract slug from URL (e.g., "/essentials" → "essentials")
      const slug = url.replace(/^\//, '').split('/').pop();
      // Filter out empty, '#', and invalid slugs
      if (slug && slug !== '#' && slug !== '') guides.push(slug);
    }
  }

  if (guides.length === 0) return '';
  return `<RelatedGuides guides={${JSON.stringify(guides)}} />\n`;
}

function convertSectionHeader(blok) {
  // Section headers in guides become <Section> components
  // The description richtext may contain embedded bloks (risk_level, alert)
  const title = blok.title || '';
  const slug = blok.slug || '';
  const attrs = [];
  if (title) {
    // Title might be richtext or plain string
    const titleText = typeof title === 'string' ? title : richTextToPlainText(title);
    attrs.push(`title="${escapeAttr(titleText)}"`);
  }
  if (slug) attrs.push(`slug="${slug}"`);

  // Description becomes the section body
  const description = blok.description ? richTextToMdx(blok.description).trim() : '';

  // Section is opened here but closed after all its child blocks are added
  // We return just the opening tag + description; the caller handles children
  return `<Section ${attrs.join(' ')}>\n\n${description}\n`;
}

function convertChecklistItemRef(blok) {
  // checklist-item-ref has a reference_item field that's resolved by the API
  // The resolved item has a slug we can use
  const ref = blok.reference_item;
  if (!ref) {
    console.warn('  ChecklistItemRef with no reference_item');
    return '';
  }

  // If resolved, ref is the full story object
  const slug = typeof ref === 'string' ? ref : (ref.slug || ref.full_slug || '');
  return `<ChecklistItemRef ref="${slug}" />\n`;
}

function convertChecklistItemReference(blok) {
  // checklist-item-reference has expanded_items array
  // In the new format, each item becomes a ChecklistItemRef
  const items = blok.expanded_items || [];
  return items.map(item => {
    const slug = typeof item === 'string' ? item : (item.slug || '');
    return `<ChecklistItemRef ref="${slug}" />\n`;
  }).join('');
}

// ─── Utility functions ───────────────────────────────────────────

function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;').replace(/\\/g, '\\\\');
}

function richTextToPlainText(richTextObj) {
  if (!richTextObj) return '';
  if (typeof richTextObj === 'string') return richTextObj;
  if (richTextObj.type === 'text') return richTextObj.text || '';
  if (richTextObj.content) {
    return richTextObj.content.map(n => richTextToPlainText(n)).join('').trim();
  }
  return '';
}

function yamlString(val) {
  if (val === null || val === undefined) return '""';
  const s = String(val);
  // Quote if contains special chars
  if (s.includes(':') || s.includes('#') || s.includes('"') || s.includes("'")
    || s.includes('\n') || s.startsWith(' ') || s.endsWith(' ')
    || s === 'true' || s === 'false' || s === 'null' || s === '') {
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return s;
}

// ─── Story → MDX file conversion ─────────────────────────────────

function convertChecklistItemStory(story) {
  const c = story.content;
  const frontmatter = {};

  frontmatter.title = c.title || story.name;
  frontmatter.slug = story.slug;
  frontmatter.type = c.type || 'checkbox';
  if (c.why) frontmatter.why = c.why;
  if (c.tools) frontmatter.tools = c.tools;
  if (c.stop) frontmatter.stop = c.stop;
  if (c.title_badges?.length) frontmatter.titleBadges = c.title_badges;

  const body = c.body ? richTextToMdx(c.body).trim() : '';

  return { frontmatter, body, slug: story.slug };
}

function convertGuideStory(story) {
  const c = story.content;
  const frontmatter = {};

  frontmatter.title = c.title || story.name;
  frontmatter.slug = story.slug;
  const guideImage = resolveStoryblokImage(c.image);
  if (guideImage) frontmatter.image = guideImage;
  if (c.last_updated) frontmatter.lastUpdated = c.last_updated;
  if (c.estimated_time) frontmatter.estimatedTime = c.estimated_time;
  if (c.summary) {
    frontmatter.summary = typeof c.summary === 'string'
      ? c.summary
      : richTextToPlainText(c.summary);
  }

  // Body is the intro text before sections
  let body = c.body ? richTextToMdx(c.body).trim() : '';

  // Convert blocks into sections with children
  const blocks = c.blocks || [];
  let sectionMdx = '';
  let inSection = false;

  for (const block of blocks) {
    if (block.component === 'section-header') {
      // Close previous section if open
      if (inSection) {
        sectionMdx += '\n</Section>\n\n';
      }
      sectionMdx += convertSectionHeader(block);
      inSection = true;
    } else if (block.component === 'checklist-item-ref') {
      sectionMdx += convertChecklistItemRef(block);
    } else if (block.component === 'checklist-item-reference') {
      sectionMdx += convertChecklistItemReference(block);
    } else if (block.component === 'related-guides' || block.component === 'related_guides') {
      // Close section if open before related guides
      if (inSection) {
        sectionMdx += '\n</Section>\n\n';
        inSection = false;
      }
      sectionMdx += convertRelatedGuides(block);
    } else {
      sectionMdx += convertBlokToMdx(block);
    }
  }

  // Close final section
  if (inSection) {
    sectionMdx += '\n</Section>\n';
  }

  if (sectionMdx) {
    body = body ? body + '\n\n' + sectionMdx.trim() : sectionMdx.trim();
  }

  return { frontmatter, body, slug: story.slug };
}

function convertPageStory(story) {
  const c = story.content;
  const frontmatter = {};

  frontmatter.title = c.title || story.name;
  frontmatter.slug = story.slug;
  const pageImage = resolveStoryblokImage(c.image);
  if (pageImage) frontmatter.image = pageImage;

  let body = c.body ? richTextToMdx(c.body).trim() : '';

  // Handle page blocks (like related-guides)
  const blocks = c.blocks || [];
  const blocksMdx = blocks.map(b => convertBlokToMdx(b)).filter(Boolean).join('\n');
  if (blocksMdx) {
    body = body ? body + '\n\n' + blocksMdx.trim() : blocksMdx.trim();
  }

  return { frontmatter, body, slug: story.slug };
}

function convertNewsItemStory(story, sourceMap) {
  const c = story.content;
  const frontmatter = {};

  frontmatter.title = c.title || story.name;
  frontmatter.date = c.date || story.first_published_at?.split('T')[0] || '';

  // URL is a Storyblok multilink object
  if (c.url) {
    const resolvedUrl = resolveStoryblokLink(c.url);
    if (resolvedUrl) frontmatter.url = resolvedUrl;
  }

  // archive_url may also be a multilink object
  if (c.archive_url) {
    const resolvedArchive = resolveStoryblokLink(c.archive_url);
    if (resolvedArchive) frontmatter.archiveUrl = resolvedArchive;
  }

  // Source can be a resolved story object or a UUID string
  if (c.source) {
    if (typeof c.source === 'object' && c.source.slug) {
      frontmatter.source = c.source.slug;
    } else if (typeof c.source === 'string') {
      // It's a UUID — look it up in the source map
      const resolvedSource = sourceMap?.get(c.source);
      if (resolvedSource) {
        frontmatter.source = resolvedSource;
      } else {
        frontmatter.source = c.source;
        console.warn(`  Unresolved source UUID: ${c.source} for "${story.slug}"`);
      }
    }
  }

  if (c.has_paywall) frontmatter.hasPaywall = true;
  if (c.image_override) {
    const imgUrl = resolveStoryblokImage(c.image_override);
    if (imgUrl) frontmatter.imageOverride = imgUrl;
  }

  const body = c.comment ? richTextToMdx(c.comment).trim() : '';

  return { frontmatter, body, slug: story.slug };
}

function convertNewsSourceStory(story) {
  const c = story.content;
  const frontmatter = {};

  frontmatter.name = c.name || story.name;
  frontmatter.slug = story.slug;
  if (c.url) {
    const resolvedUrl = resolveStoryblokLink(c.url);
    if (resolvedUrl) frontmatter.url = resolvedUrl;
  }

  return { frontmatter, body: '', slug: story.slug };
}

function convertChangelogEntryStory(story) {
  const c = story.content;
  const frontmatter = {};

  frontmatter.type = c.type || 'minor';
  frontmatter.date = c.date || story.first_published_at?.split('T')[0] || '';
  frontmatter.slug = story.slug;

  const body = c.body ? richTextToMdx(c.body).trim() : '';

  return { frontmatter, body, slug: story.slug };
}

// ─── Frontmatter serialization ───────────────────────────────────

function serializeFrontmatter(fm) {
  const lines = ['---'];
  for (const [key, value] of Object.entries(fm)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else {
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - ${yamlString(item)}`);
        }
      }
    } else if (typeof value === 'boolean') {
      lines.push(`${key}: ${value}`);
    } else {
      lines.push(`${key}: ${yamlString(value)}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

// ─── File writing ────────────────────────────────────────────────

function writeMdxFile(dir, filename, frontmatter, body) {
  const filePath = path.join(dir, filename);
  const fm = serializeFrontmatter(frontmatter);
  const content = body ? `${fm}\n\n${body}\n` : `${fm}\n`;

  if (DRY_RUN) {
    console.log(`  [dry-run] Would write: ${path.relative(ROOT, filePath)}`);
    return;
  }

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

// ─── Asset collection ────────────────────────────────────────────

const collectedAssets = new Set();

function collectStoryblokUrls(obj) {
  if (!obj) return;
  if (typeof obj === 'string') {
    if (obj.includes('a-us.storyblok.com') || obj.includes('a.storyblok.com')) {
      collectedAssets.add(obj);
    }
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach(item => collectStoryblokUrls(item));
    return;
  }
  if (typeof obj === 'object') {
    Object.values(obj).forEach(v => collectStoryblokUrls(v));
  }
}

// ─── Main migration ─────────────────────────────────────────────

async function main() {
  console.log('Fetching all stories from Storyblok...\n');

  const allStories = await fetchAllStories({
    resolve_relations: 'checklist-item-ref.reference_item,news-item.source',
  });

  console.log(`Fetched ${allStories.length} stories.\n`);

  // Collect all Storyblok CDN URLs for asset report
  allStories.forEach(s => collectStoryblokUrls(s.content));

  // Group by component type
  const grouped = {};
  for (const story of allStories) {
    const type = story.content?.component;
    if (!type) continue;
    if (story.is_folder) continue;
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(story);
  }

  console.log('Content types found:');
  for (const [type, stories] of Object.entries(grouped)) {
    console.log(`  ${type}: ${stories.length}`);
  }
  console.log();

  const stats = { written: 0, skipped: 0, errors: 0 };

  // ─── Checklist Items ───
  if (!TYPE_FILTER || TYPE_FILTER === 'checklist-item') {
    console.log('Converting checklist items...');
    for (const story of (grouped['checklist-item'] || [])) {
      try {
        const { frontmatter, body, slug } = convertChecklistItemStory(story);
        writeMdxFile(
          path.join(CONTENT_DIR, 'checklist-items'),
          `${slug}.mdx`,
          frontmatter,
          body
        );
        stats.written++;
      } catch (e) {
        console.error(`  Error converting checklist item "${story.slug}": ${e.message}`);
        stats.errors++;
      }
    }
  }

  // ─── Guides ───
  if (!TYPE_FILTER || TYPE_FILTER === 'guide') {
    console.log('Converting guides...');
    for (const story of (grouped['guide'] || [])) {
      try {
        const { frontmatter, body, slug } = convertGuideStory(story);
        writeMdxFile(
          path.join(CONTENT_DIR, 'guides'),
          `${slug}.mdx`,
          frontmatter,
          body
        );
        stats.written++;
      } catch (e) {
        console.error(`  Error converting guide "${story.slug}": ${e.message}`);
        stats.errors++;
      }
    }
  }

  // ─── Pages ───
  if (!TYPE_FILTER || TYPE_FILTER === 'page') {
    console.log('Converting pages...');
    for (const story of (grouped['page'] || [])) {
      try {
        // Skip 'home' — it's a custom Next.js page
        if (story.slug === 'home') {
          stats.skipped++;
          continue;
        }
        const { frontmatter, body, slug } = convertPageStory(story);
        writeMdxFile(
          path.join(CONTENT_DIR, 'pages'),
          `${slug}.mdx`,
          frontmatter,
          body
        );
        stats.written++;
      } catch (e) {
        console.error(`  Error converting page "${story.slug}": ${e.message}`);
        stats.errors++;
      }
    }
  }

  // ─── News Items ───
  if (!TYPE_FILTER || TYPE_FILTER === 'news-item') {
    console.log('Converting news items...');

    // Build UUID→slug map from news sources for resolving source references
    const sourceMap = new Map();
    for (const story of (grouped['news-source'] || [])) {
      sourceMap.set(story.uuid, story.slug);
    }

    for (const story of (grouped['news-item'] || [])) {
      try {
        const { frontmatter, body, slug } = convertNewsItemStory(story, sourceMap);
        // Group by year from date
        const year = frontmatter.date ? frontmatter.date.split('-')[0] : 'undated';
        writeMdxFile(
          path.join(CONTENT_DIR, 'news', year),
          `${slug}.mdx`,
          frontmatter,
          body
        );
        stats.written++;
      } catch (e) {
        console.error(`  Error converting news item "${story.slug}": ${e.message}`);
        stats.errors++;
      }
    }
  }

  // ─── News Sources ───
  if (!TYPE_FILTER || TYPE_FILTER === 'news-source') {
    console.log('Converting news sources...');
    for (const story of (grouped['news-source'] || [])) {
      try {
        const { frontmatter, body, slug } = convertNewsSourceStory(story);
        writeMdxFile(
          path.join(CONTENT_DIR, 'news-sources'),
          `${slug}.mdx`,
          frontmatter,
          body
        );
        stats.written++;
      } catch (e) {
        console.error(`  Error converting news source "${story.slug}": ${e.message}`);
        stats.errors++;
      }
    }
  }

  // ─── Changelog Entries ───
  if (!TYPE_FILTER || TYPE_FILTER === 'changelog-entry') {
    console.log('Converting changelog entries...');
    for (const story of (grouped['changelog-entry'] || [])) {
      try {
        const { frontmatter, body, slug } = convertChangelogEntryStory(story);
        const date = frontmatter.date || '';
        const filename = date ? `${date}-${slug}.mdx` : `${slug}.mdx`;
        writeMdxFile(
          path.join(CONTENT_DIR, 'changelog'),
          filename,
          frontmatter,
          body
        );
        stats.written++;
      } catch (e) {
        console.error(`  Error converting changelog entry "${story.slug}": ${e.message}`);
        stats.errors++;
      }
    }
  }

  // ─── Report ───
  console.log('\n─── Migration Report ───');
  console.log(`  Written:  ${stats.written}`);
  console.log(`  Skipped:  ${stats.skipped}`);
  console.log(`  Errors:   ${stats.errors}`);

  if (collectedAssets.size > 0) {
    console.log(`\n  Storyblok CDN URLs found (${collectedAssets.size}):`);
    for (const url of collectedAssets) {
      console.log(`    ${url}`);
    }
    console.log('\n  These URLs need to be downloaded and paths updated in the MDX files.');
  }

  if (stats.errors > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(2);
});
