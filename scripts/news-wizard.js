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
const path = require('path');
const readline = require('readline');
const { execFileSync } = require('child_process');
const matter = require('gray-matter');
const ogs = require('open-graph-scraper');

const CONTENT_NEWS = path.join(__dirname, '..', 'content', 'en', 'news');
const NEWS_IMAGES_DIR = path.join(__dirname, '..', 'public', 'images', 'news');
const FETCH_SCRIPT = path.join(__dirname, 'fetch-news-images.js');
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
  return tags;
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
    const outPath = path.join(CONTENT_NEWS, `${slug}.mdx`);

    if (fs.existsSync(outPath)) {
      throw new Error(`Refusing to overwrite existing file: ${outPath}`);
    }

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

    const tags = tagsLine
      ? tagsLine
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

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

    if (!fs.existsSync(CONTENT_NEWS)) {
      fs.mkdirSync(CONTENT_NEWS, { recursive: true });
    }
    fs.writeFileSync(outPath, mdxBody, 'utf8');
    console.log(`Wrote ${outPath}\n`);

    console.log('Running fetch-news for this slug…');
    execFileSync(process.execPath, [FETCH_SCRIPT, `--slug=${slug}`, '--quiet'], {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
    });

    const imagePath = path.join(NEWS_IMAGES_DIR, `${slug}.jpg`);
    if (!fs.existsSync(imagePath)) {
      console.warn(
        '\n⚠️  WARNING: No image was saved. Add imageOverride in frontmatter or place an image at:\n' +
          `   public/images/news/${slug}.jpg\n` +
          '   Then run: yarn fetch-news\n'
      );
    } else {
      console.log(`Image OK: public/images/news/${slug}.jpg\n`);
    }

    console.log('Done. Commit the MDX file and image when ready.');
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
