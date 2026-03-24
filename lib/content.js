import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { DEFAULT_LOCALE } from './i18n-config.js';

const CONTENT_DIR = path.join(process.cwd(), 'content');

/**
 * Get the content directory for a given locale, with English fallback.
 */
function getLocalePath(locale = DEFAULT_LOCALE) {
  return path.join(CONTENT_DIR, locale);
}

/**
 * Read and parse an MDX file. Returns { frontmatter, content, slug } or null.
 */
function readMdxFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  const slug = path.basename(filePath, '.mdx');
  return { frontmatter: data, content, slug };
}

/**
 * Read an MDX file with locale fallback to English.
 */
function readMdxFileWithFallback(relativePath, locale = DEFAULT_LOCALE) {
  const localePath = path.join(getLocalePath(locale), relativePath);
  const result = readMdxFile(localePath);
  if (result) return { ...result, isFallback: false };

  if (locale !== DEFAULT_LOCALE) {
    const fallbackPath = path.join(getLocalePath(DEFAULT_LOCALE), relativePath);
    const fallbackResult = readMdxFile(fallbackPath);
    if (fallbackResult) return { ...fallbackResult, isFallback: true };
  }

  return null;
}

/**
 * List all MDX files in a directory (non-recursive).
 */
function listMdxFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath)
    .filter(f => f.endsWith('.mdx'))
    .map(f => path.join(dirPath, f));
}

/**
 * List all MDX files in a directory recursively (for news with year subdirs).
 */
function listMdxFilesRecursive(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const results = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...listMdxFilesRecursive(fullPath));
    } else if (entry.name.endsWith('.mdx')) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Read all items from a content collection directory.
 * Returns array of { frontmatter, content, slug, isFallback }.
 */
function readCollection(collectionPath, locale = DEFAULT_LOCALE, { recursive = false } = {}) {
  const localeDir = path.join(getLocalePath(locale), collectionPath);
  const fallbackDir = path.join(getLocalePath(DEFAULT_LOCALE), collectionPath);

  const listFn = recursive ? listMdxFilesRecursive : listMdxFiles;

  // Get all files from the default locale as the base set
  const defaultFiles = listFn(fallbackDir);
  const defaultSlugs = new Map(
    defaultFiles.map(f => {
      const rel = path.relative(fallbackDir, f);
      return [rel, f];
    })
  );

  // If requesting a non-default locale, overlay translated files
  if (locale !== DEFAULT_LOCALE) {
    const localeFiles = listFn(localeDir);
    const localeSlugs = new Map(
      localeFiles.map(f => {
        const rel = path.relative(localeDir, f);
        return [rel, f];
      })
    );

    return Array.from(defaultSlugs.keys()).map(rel => {
      if (localeSlugs.has(rel)) {
        const parsed = readMdxFile(localeSlugs.get(rel));
        return parsed ? { ...parsed, isFallback: false } : null;
      }
      const parsed = readMdxFile(defaultSlugs.get(rel));
      return parsed ? { ...parsed, isFallback: true } : null;
    }).filter(Boolean);
  }

  return defaultFiles.map(f => {
    const parsed = readMdxFile(f);
    return parsed ? { ...parsed, isFallback: false } : null;
  }).filter(Boolean);
}

// ─── Serialization helpers ───────────────────────────────────

/**
 * Recursively convert Date objects to ISO strings so frontmatter is
 * JSON-serializable for Next.js getStaticProps.
 */
export function serializeFrontmatter(obj) {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj.toISOString().split('T')[0]; // YYYY-MM-DD
  if (Array.isArray(obj)) return obj.map(serializeFrontmatter);
  if (typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = serializeFrontmatter(v);
    }
    return out;
  }
  return obj;
}

// ─── Public API ──────────────────────────────────────────────

export function getChecklistItem(slug, locale = DEFAULT_LOCALE) {
  return readMdxFileWithFallback(`checklist-items/${slug}.mdx`, locale);
}

export function getAllChecklistItems(locale = DEFAULT_LOCALE) {
  return readCollection('checklist-items', locale);
}

export function getGuide(slug, locale = DEFAULT_LOCALE) {
  return readMdxFileWithFallback(`guides/${slug}.mdx`, locale);
}

export function getAllGuides(locale = DEFAULT_LOCALE) {
  return readCollection('guides', locale);
}

export function getPage(slug, locale = DEFAULT_LOCALE) {
  return readMdxFileWithFallback(`pages/${slug}.mdx`, locale);
}

export function getAllPages(locale = DEFAULT_LOCALE) {
  return readCollection('pages', locale);
}

export function getNewsItem(slug, locale = DEFAULT_LOCALE) {
  // News items are in year subdirectories, so we need to search
  const newsDir = path.join(getLocalePath(locale), 'news');
  const fallbackDir = path.join(getLocalePath(DEFAULT_LOCALE), 'news');

  for (const dir of [newsDir, fallbackDir]) {
    if (!fs.existsSync(dir)) continue;
    const files = listMdxFilesRecursive(dir);
    const match = files.find(f => path.basename(f, '.mdx') === slug);
    if (match) {
      const parsed = readMdxFile(match);
      if (parsed) return { ...parsed, isFallback: dir === fallbackDir && locale !== DEFAULT_LOCALE };
    }
  }
  return null;
}

export function getAllNewsItems(locale = DEFAULT_LOCALE) {
  const items = readCollection('news', locale, { recursive: true });
  // Sort by date, newest first
  return items.sort((a, b) => {
    const dateA = new Date(a.frontmatter.date || '1970-01-01');
    const dateB = new Date(b.frontmatter.date || '1970-01-01');
    return dateB - dateA;
  });
}

export function getNewsSource(slug, locale = DEFAULT_LOCALE) {
  return readMdxFileWithFallback(`news-sources/${slug}.mdx`, locale);
}

export function getAllNewsSources(locale = DEFAULT_LOCALE) {
  return readCollection('news-sources', locale);
}

export function getAllChangelogEntries(locale = DEFAULT_LOCALE) {
  const items = readCollection('changelog', locale);
  // Sort by date, newest first
  return items.sort((a, b) => {
    const dateA = new Date(a.frontmatter.date || '1970-01-01');
    const dateB = new Date(b.frontmatter.date || '1970-01-01');
    return dateB - dateA;
  });
}

/**
 * Get all slugs for getStaticPaths. Returns array of { slug, type } where type
 * is the content type (guide, page, checklist-item, news-item, etc.).
 */
export function getAllSlugs(locale = DEFAULT_LOCALE) {
  const slugs = [];

  for (const item of getAllGuides(locale)) {
    slugs.push({ slug: item.frontmatter.slug || item.slug, type: 'guide' });
  }
  for (const item of getAllPages(locale)) {
    slugs.push({ slug: item.frontmatter.slug || item.slug, type: 'page' });
  }
  for (const item of getAllChecklistItems(locale)) {
    slugs.push({ slug: item.frontmatter.slug || item.slug, type: 'checklist-item' });
  }
  for (const item of getAllNewsItems(locale)) {
    slugs.push({ slug: item.frontmatter.slug || item.slug, type: 'news-item' });
  }
  for (const item of getAllChangelogEntries(locale)) {
    slugs.push({ slug: item.frontmatter.slug || item.slug, type: 'changelog-entry' });
  }

  return slugs;
}

/**
 * Resolve an array of ChecklistItem slugs to their full content.
 * Used by guides to load referenced checklist items.
 */
export function resolveChecklistItems(refs, locale = DEFAULT_LOCALE) {
  const resolved = {};
  for (const ref of refs) {
    const item = getChecklistItem(ref, locale);
    if (item) {
      resolved[ref] = item;
    }
  }
  return resolved;
}

/**
 * Extract ChecklistItem slugs from MDX content string.
 */
export function extractChecklistItems(mdxContent) {
  const refs = [];
  const regex = /<ChecklistItem\s+slug=["']([^"']+)["']\s*\/?>/g;
  let match;
  while ((match = regex.exec(mdxContent)) !== null) {
    refs.push(match[1]);
  }
  return [...new Set(refs)];
}

/**
 * Load image manifest for news items.
 */
export function getImageManifest() {
  const manifestPath = path.join(process.cwd(), 'public', 'files', 'news', 'image-manifest.json');
  if (!fs.existsSync(manifestPath)) return {};
  return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
}

// ─── Wire-format helpers for getStaticProps ──────────────────
//
// These reshape MDX content into the data shapes that existing display
// components (ChangeLogEntry, NewsItem, etc.) expect, and ensure all
// Date objects are serialized to strings for Next.js props.

/**
 * Reshape a raw changelog MDX entry into the wire format expected by
 * ChangeLogEntry / ChangeLogRecentEntries.
 */
export function toChangelogWireEntry(entry) {
  const fm = serializeFrontmatter(entry.frontmatter);
  return {
    uuid: entry.slug,
    first_published_at: fm.firstPublished || fm.date,
    created_at: fm.date,
    content: {
      type: fm.type || 'minor',
      bodyText: entry.content.trim() || null,
      body: null,
    },
  };
}

/**
 * Reshape a raw news MDX item into the wire format expected by NewsItem /
 * NewsBlock.
 */
function isSlugFormat(str) {
  return typeof str === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(str);
}

export function getAllNewsSourcesMap(locale = DEFAULT_LOCALE) {
  const sources = getAllNewsSources(locale);
  return Object.fromEntries(
    sources.map(s => [
      s.frontmatter.slug || s.slug,
      (s.frontmatter.name || '').trim() || s.slug,
    ])
  );
}

export function toNewsWireItem(item, sourcesMap = {}) {
  const fm = serializeFrontmatter(item.frontmatter);
  const rawSource = fm.source || null;
  // If source looks like a slug (lowercase with hyphens), resolve to display name.
  // Otherwise treat as a direct display override.
  let resolvedSource = rawSource;
  if (rawSource && isSlugFormat(rawSource)) {
    resolvedSource = sourcesMap[rawSource] ?? rawSource;
  }
  return {
    uuid: item.slug,
    slug: item.slug,
    name: fm.title,
    tag_list: fm.tags
      ? String(fm.tags).split(',').map((t) => t.trim()).filter(Boolean)
      : [],
    content: {
      date: fm.date,
      source: resolvedSource,
      url: fm.url || null,
      paywall_mode: fm.paywall_mode || fm.paywallMode || 'inactive',
      comment: null,
      commentText: item.content.trim() || null,
    },
  };
}
