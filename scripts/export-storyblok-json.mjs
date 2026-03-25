#!/usr/bin/env node

/**
 * Dump Storyblok Content Delivery API (CDN) responses to JSON files — no transforms.
 * Reuses the same fetch + pagination pattern as scripts/migrate-from-storyblok.mjs.
 *
 * Usage:
 *   node scripts/export-storyblok-json.mjs
 *   node scripts/export-storyblok-json.mjs --out ./storyblok-api-export
 *   node scripts/export-storyblok-json.mjs --draft
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(ROOT, '.env') });

const TOKEN =
  process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN ||
  process.env.NEXT_PUBLIC_STORYBLOK_PUBLIC_TOKEN;

if (!TOKEN) {
  console.error(
    'Missing token. Set NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN or NEXT_PUBLIC_STORYBLOK_PUBLIC_TOKEN in .env'
  );
  process.exit(1);
}

const API_BASE = 'https://api-us.storyblok.com/v2';

const args = process.argv.slice(2);
const DRAFT = args.includes('--draft');
const outIdx = args.indexOf('--out');
const OUT_DIR =
  outIdx !== -1 && args[outIdx + 1]
    ? path.resolve(ROOT, args[outIdx + 1])
    : path.join(ROOT, 'storyblok-api-export');

const VERSION = DRAFT ? 'draft' : 'published';
const _cv = String(Math.floor(Date.now() / 1000));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function apiFetch(endpoint, params = {}) {
  const url = new URL(`${API_BASE}${endpoint}`);
  url.searchParams.set('token', TOKEN);
  url.searchParams.set('version', VERSION);
  url.searchParams.set('cv', _cv);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) {
      url.searchParams.set(k, String(v));
    }
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
      const body = await res.text();
      throw new Error(
        `Storyblok API error: ${res.status} ${res.statusText} for ${endpoint}\n${body.slice(0, 500)}`
      );
    }
    return res.json();
  }
  throw new Error(`Storyblok API: too many retries for ${endpoint}`);
}

/** Paginate /cdn/stories; invoke onPage for each raw API page (same shape as migrate-from-storyblok). */
async function forEachStoriesPage(onPage) {
  const stories = [];
  let page = 1;
  while (true) {
    const data = await apiFetch('/cdn/stories', {
      per_page: '100',
      page: String(page),
    });
    await onPage(page, data);
    if (!data.stories?.length) break;
    stories.push(...data.stories);
    if (data.stories.length < 100) break;
    page++;
  }
  return stories;
}

/**
 * Some CDN list endpoints return { items, per_page, page, total } or similar.
 * Save merged payload when we can detect pagination.
 */
async function fetchCdnDump(endpoint, fileLabel) {
  try {
    const first = await apiFetch(endpoint, { per_page: '100', page: '1' });
    const merged = { ...first };

    const total = first.total;
    const perPage = first.per_page || 100;
    const key = ['tags', 'links', 'datasources', 'stories'].find((k) => first[k] !== undefined);

    if (total != null && key && Array.isArray(first[key])) {
      const all = [...first[key]];
      let page = 2;
      while (all.length < total) {
        const next = await apiFetch(endpoint, {
          per_page: String(perPage),
          page: String(page),
        });
        if (!next[key]?.length) break;
        all.push(...next[key]);
        if (next[key].length < perPage) break;
        page++;
      }
      merged[key] = all;
    }

    return merged;
  } catch (e) {
    console.warn(`  (skip ${fileLabel}: ${e.message})`);
    return null;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

async function main() {
  console.log(`Exporting Storyblok CDN JSON → ${OUT_DIR}`);
  console.log(`  version: ${VERSION}`);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const storiesDir = path.join(OUT_DIR, 'stories');
  const rawPagesDir = path.join(OUT_DIR, 'cdn-stories-pages');
  fs.mkdirSync(storiesDir, { recursive: true });
  fs.mkdirSync(rawPagesDir, { recursive: true });

  let pageCount = 0;
  const stories = await forEachStoriesPage((page, data) => {
    pageCount++;
    writeJson(path.join(rawPagesDir, `page-${page}.json`), data);
  });
  console.log(`  stories: ${stories.length}`);
  console.log(`  raw paged /cdn/stories: ${pageCount} file(s) in cdn-stories-pages/`);

  for (const story of stories) {
    const slug = story.full_slug || `id-${story.id}`;
    const jsonPath = path.join(storiesDir, `${slug}.json`);
    writeJson(jsonPath, story);
  }

  const manifest = {
    exportedAt: new Date().toISOString(),
    apiBase: API_BASE,
    version: VERSION,
    storyCount: stories.length,
    stories: stories.map((s) => ({
      id: s.id,
      uuid: s.uuid,
      full_slug: s.full_slug,
      name: s.name,
    })),
  };
  writeJson(path.join(OUT_DIR, 'manifest.json'), manifest);

  const tags = await fetchCdnDump('/cdn/tags', 'tags');
  if (tags) writeJson(path.join(OUT_DIR, 'cdn-tags.json'), tags);

  const links = await fetchCdnDump('/cdn/links', 'links');
  if (links) writeJson(path.join(OUT_DIR, 'cdn-links.json'), links);

  const datasources = await fetchCdnDump('/cdn/datasources', 'datasources');
  if (datasources) writeJson(path.join(OUT_DIR, 'cdn-datasources.json'), datasources);

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
