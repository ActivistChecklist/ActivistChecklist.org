#!/usr/bin/env node

/**
 * Interactive wizard (with optional CLI args) to add a news MDX item and fetch its image.
 *
 * Usage:
 *   yarn news
 *   yarn news "https://example.com/article"
 *   yarn news "https://..." --source="The Intercept"   # optional; otherwise inferred from page metadata
 *   yarn news "https://..." --tags="ice, surveillance"
 *
 * First positional argument is the article URL (no flag). Other options use --key=value.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { execFileSync } = require('child_process');
const matter = require('gray-matter');
const ogs = require('open-graph-scraper');

const { loadNewsItems } = require('./fetch-news-images.js');

function parseArgv(argv) {
  const positional = [];
  const flags = {};
  for (const a of argv) {
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > 0) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        flags[a.slice(2)] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

function promptLine(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer));
  });
}

function normalizeHost(hostname) {
  return String(hostname || '')
    .replace(/^www\./i, '')
    .toLowerCase();
}

function slugify(text) {
  const s = String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
  return (s || 'news-item').slice(0, 120);
}

function uniqueSlug(base) {
  const existing = new Set(loadNewsItems().map((i) => i.slug));
  let s = base;
  let n = 2;
  while (existing.has(s)) {
    s = `${base}-${n}`;
    n++;
  }
  return s;
}

/**
 * Publication label stored verbatim in news MDX frontmatter (`source:`).
 */
function pickSourceDisplayName(articleUrl, siteNameHint, explicit) {
  if (explicit) {
    return String(explicit).trim();
  }

  let articleHost;
  try {
    articleHost = normalizeHost(new URL(articleUrl).hostname);
  } catch {
    throw new Error('Invalid article URL.');
  }

  return (siteNameHint && siteNameHint.trim()) || articleHost;
}

function parsePublishedDate(result) {
  const raw =
    result.articlePublishedTime ||
    result.ogArticlePublishedTime ||
    result.articlePublishedDate ||
    result.publishedTime ||
    result.ogDate ||
    null;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

function todayIsoLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function pickTitle(result) {
  return (
    (result.ogTitle && String(result.ogTitle).trim()) ||
    (result.twitterTitle && String(result.twitterTitle).trim()) ||
    null
  );
}

async function fetchOg(url) {
  const { error, result } = await ogs({
    url,
    timeout: 15000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      DNT: '1',
    },
  });
  if (error) {
    throw new Error(`Open Graph fetch failed: ${error}`);
  }
  return result;
}

function formatTagsForFrontmatter(tags) {
  if (!tags.length) return null;
  return tags.join(', ');
}

/** Map lowercase tag -> preferred spelling as it first appears in existing news MDX. */
function collectKnownTagCanonical() {
  const canonical = new Map();
  for (const { frontmatter } of loadNewsItems()) {
    const raw = frontmatter.tags;
    if (!raw || typeof raw !== 'string') continue;
    for (const part of raw.split(',')) {
      const t = part.trim();
      if (!t) continue;
      const lc = t.toLowerCase();
      if (!canonical.has(lc)) canonical.set(lc, t);
    }
  }
  return canonical;
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const row = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return row[n];
}

function maxTypoDistanceForLength(len) {
  if (len <= 4) return 1;
  if (len <= 10) return 2;
  return 2;
}

/**
 * If `lc` is not known, return a single best existing tag spelling that looks like a typo, else null.
 */
function findTypoSuggestion(lc, canonical) {
  if (lc.length <= 2) return null;
  const maxD = maxTypoDistanceForLength(lc.length);
  const scored = [];
  for (const [knownLc, display] of canonical) {
    if (knownLc === lc) continue;
    const d = levenshtein(lc, knownLc);
    if (d <= maxD) scored.push({ d, display, knownLc });
  }
  if (scored.length === 0) return null;
  scored.sort((a, b) => a.d - b.d || a.knownLc.localeCompare(b.knownLc));
  const best = scored[0];
  if (scored.length > 1 && scored[1].d === best.d) return null;
  return best.display;
}

/** Dedupe tags case-insensitively, preserve first occurrence order. */
function dedupeTagsCaseInsensitive(tags) {
  const seen = new Set();
  const out = [];
  for (const t of tags) {
    const lc = t.toLowerCase();
    if (seen.has(lc)) continue;
    seen.add(lc);
    out.push(t);
  }
  return out;
}

async function resolveTagsWithTypoHints(rawTags, getRl) {
  const canonical = collectKnownTagCanonical();
  const resolved = [];

  for (const raw of rawTags) {
    const tag = raw.trim();
    if (!tag) continue;
    const lc = tag.toLowerCase();

    if (canonical.has(lc)) {
      resolved.push(canonical.get(lc));
      continue;
    }

    const suggestion = findTypoSuggestion(lc, canonical);
    if (suggestion) {
      const line = await promptLine(
        getRl(),
        `Did you mean "${suggestion}" instead of "${tag}"? [Y/n]: `
      );
      const a = String(line || '')
        .trim()
        .toLowerCase();
      if (a === '' || a === 'y' || a === 'yes') {
        resolved.push(suggestion);
      } else {
        resolved.push(tag);
      }
    } else {
      resolved.push(tag);
    }
  }

  return dedupeTagsCaseInsensitive(resolved);
}

function git(args, options = {}) {
  const output = execFileSync('git', args, {
    encoding: 'utf8',
    cwd: path.join(__dirname, '..'),
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
  if (typeof output === 'string') return output.trim();
  return '';
}

function tryGit(args, options = {}) {
  try {
    return { ok: true, value: git(args, options) };
  } catch (error) {
    return { ok: false, error };
  }
}

function buildContentBranchName(slug) {
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  const base = `content/${date}-news-${slug}`.slice(0, 120);
  let candidate = base;
  let n = 2;
  while (tryGit(['ls-remote', '--exit-code', '--heads', 'origin', `refs/heads/${candidate}`]).ok) {
    candidate = `${base}-${n}`.slice(0, 120);
    n += 1;
  }
  return candidate;
}

function transactionalCommitToContentBranch({ slug, mdxBody }) {
  const repoRoot = path.join(__dirname, '..');
  const worktreeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'news-wizard-main-'));
  const branchName = buildContentBranchName(slug);
  let worktreeAdded = false;

  try {
    // Build commit in isolated worktree rooted at latest origin/main.
    git(['fetch', 'origin', 'main'], { stdio: 'inherit' });
    git(['worktree', 'add', '--detach', worktreeDir, 'origin/main'], { stdio: 'inherit' });
    worktreeAdded = true;

    // Ensure commit hooks run with the same dependencies as the main repo.
    // Many hooks run "yarn test" and expect local node_modules to exist.
    const repoNodeModules = path.join(repoRoot, 'node_modules');
    const wtNodeModules = path.join(worktreeDir, 'node_modules');
    if (fs.existsSync(repoNodeModules) && !fs.existsSync(wtNodeModules)) {
      fs.symlinkSync(repoNodeModules, wtNodeModules, 'junction');
    }

    // Generate content directly inside isolated worktree.
    const mdxRel = path.join('content', 'en', 'news', `${slug}.mdx`);
    const imageRel = path.join('public', 'images', 'news', `${slug}.jpg`);
    const mdxAbs = path.join(worktreeDir, mdxRel);
    fs.mkdirSync(path.dirname(mdxAbs), { recursive: true });
    fs.writeFileSync(mdxAbs, mdxBody, 'utf8');
    console.log(`Created in worktree: ${mdxRel}`);

    console.log('Running fetch-news for this slug in worktree…');
    execFileSync(process.execPath, [path.join(worktreeDir, 'scripts', 'fetch-news-images.js'), `--slug=${slug}`, '--quiet'], {
      stdio: 'inherit',
      cwd: worktreeDir,
    });

    const imageExists = fs.existsSync(path.join(worktreeDir, imageRel));
    if (!imageExists) {
      console.warn(
        '\n⚠️  WARNING: No image was saved in worktree. Commit will include MDX only.\n' +
          `   Expected: ${imageRel}\n`
      );
    } else {
      console.log(`Image OK in worktree: ${imageRel}\n`);
    }

    const filesToCommit = imageExists ? [mdxRel, imageRel] : [mdxRel];

    git(['-C', worktreeDir, 'add', ...filesToCommit], { stdio: 'inherit' });
    const repoBin = path.join(repoNodeModules, '.bin');
    const commitEnv = {
      ...process.env,
      NODE_PATH: process.env.NODE_PATH
        ? `${repoNodeModules}${path.delimiter}${process.env.NODE_PATH}`
        : repoNodeModules,
      PATH: process.env.PATH
        ? `${repoBin}${path.delimiter}${process.env.PATH}`
        : repoBin,
    };
    git(['-C', worktreeDir, 'commit', '-m', `content: add news item "${slug}"`], {
      stdio: 'inherit',
      env: commitEnv,
    });
    console.log(`Pushing branch: ${branchName}`);
    git(['-C', worktreeDir, 'push', '-u', 'origin', `HEAD:refs/heads/${branchName}`], { stdio: 'inherit' });
    return branchName;
  } catch (error) {
    throw error;
  } finally {
    if (worktreeAdded) {
      tryGit(['worktree', 'remove', '--force', worktreeDir], { stdio: 'inherit' });
    } else {
      try {
        if (fs.existsSync(worktreeDir)) fs.rmdirSync(worktreeDir);
      } catch {
        // ignore
      }
    }
  }
}

/**
 * gray-matter uses js-yaml, which quotes `YYYY-MM-DD` *strings* so they stay
 * strings. Elsewhere in this repo we use unquoted YAML date scalars
 * (`date: 2025-12-22`). Both parse the same; unquoted matches existing files.
 */
function normalizeWizardYamlDates(yamlDocument) {
  return yamlDocument.replace(
    /^(\s*(?:date|firstPublished|lastUpdated):\s*)'(\d{4}-\d{2}-\d{2})'$/gm,
    '$1$2'
  );
}

async function main() {
  const { positional, flags } = parseArgv(process.argv.slice(2));

  let articleUrl = positional[0] || flags.url;
  const explicitSource = flags.source || null;
  const flagTitle = flags.title ? String(flags.title) : null;
  const flagDate = flags.date ? String(flags.date) : null;
  const tagsFromCli = flags.tags !== undefined;
  const flagTags = tagsFromCli ? String(flags.tags) : null;

  let rl;
  function getRl() {
    if (!rl) {
      rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    }
    return rl;
  }

  try {
    if (!articleUrl) {
      articleUrl = (await promptLine(getRl(), 'Article URL: ')).trim();
    }
    if (!articleUrl) {
      throw new Error('URL is required.');
    }
    let parsedUrl;
    try {
      parsedUrl = new URL(articleUrl);
    } catch {
      throw new Error('Invalid URL.');
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('URL must be http or https.');
    }

    console.log('\nFetching page metadata…');
    const og = await fetchOg(articleUrl);

    const title = flagTitle || pickTitle(og);
    if (!title) {
      throw new Error('Could not determine title (no og:title). Pass --title="…" to set it manually.');
    }

    const published = flagDate || parsePublishedDate(og);
    if (!published) {
      throw new Error(
        'Could not determine published date from metadata. Pass --date=YYYY-MM-DD to set it manually.'
      );
    }

    const ogSiteName = og.ogSiteName ? String(og.ogSiteName).trim() : '';
    const publisherHint = [
      ogSiteName,
      og.ogArticlePublisher && String(og.ogArticlePublisher).trim(),
      og.articlePublisher && String(og.articlePublisher).trim(),
    ].find(Boolean) || '';
    const sourceField = pickSourceDisplayName(articleUrl, publisherHint, explicitSource);

    const baseSlug = slugify(title);
    const slug = uniqueSlug(baseSlug);
    const today = todayIsoLocal();

    console.log('\n--- Review (edit the MDX file afterward if anything looks wrong) ---');
    console.log(`URL:              ${articleUrl}`);
    console.log(`Title:            ${title}`);
    console.log(`Slug:             ${slug}`);
    console.log(`Source:           ${JSON.stringify(sourceField)}`);
    if (publisherHint) {
      console.log(`Site / publisher: ${publisherHint}`);
    }
    console.log(`Date published:   ${published}`);
    console.log(`Site add dates:   firstPublished / lastUpdated → ${today}`);
    console.log(`File:             content/en/news/${slug}.mdx`);
    console.log(`Image (planned):  public/images/news/${slug}.jpg`);
    console.log('------------------------------------------------------------------\n');

    let tagsLine = flagTags;
    if (tagsLine === null) {
      tagsLine = await promptLine(getRl(), 'Tags (comma-separated, Enter for none): ');
    }

    const rawTags = tagsLine
      ? tagsLine
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const tags = await resolveTagsWithTypoHints(rawTags, getRl);

    const frontmatter = {
      title,
      date: published,
      url: articleUrl,
      source: sourceField,
      firstPublished: today,
      lastUpdated: today,
    };
    const tagArr = formatTagsForFrontmatter(tags);
    if (tagArr) {
      frontmatter.tags = tagArr;
    }

    const mdxBody = normalizeWizardYamlDates(matter.stringify('\n', frontmatter));

    console.log('\nRunning git automation (transactional push to content branch)…');
    const pushedBranch = transactionalCommitToContentBranch({
      slug,
      mdxBody,
    });

    console.log(`✅ Done. Committed and pushed to ${pushedBranch}.`);
  } finally {
    if (rl) rl.close();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`\n❌ ${err.message || err}`);
    process.exit(1);
  });
}
