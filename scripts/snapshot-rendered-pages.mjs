#!/usr/bin/env node

/**
 * Snapshot the rendered text of every guide/page route from a running
 * Next.js dev or preview server. Saves normalized text per route to a
 * JSON snapshot file for before/after comparison.
 *
 * Usage:
 *   # Start the dev server first: yarn dev
 *   node scripts/snapshot-rendered-pages.mjs --out snapshots/before.json
 *   node scripts/snapshot-rendered-pages.mjs --out snapshots/after.json
 *
 *   # Then compare:
 *   node scripts/compare-snapshots.mjs snapshots/before.json snapshots/after.json
 *
 * Options:
 *   --out FILE       Output snapshot path (required)
 *   --base URL       Base URL of running server (default: http://localhost:3000)
 *   --slug SLUG      Only snapshot one route (e.g. --slug=protest)
 *   --verbose        Log each route as it's fetched
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content', 'en');

function getArg(name) {
  const args = process.argv;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === `--${name}` && args[i + 1] && !args[i + 1].startsWith('--')) return args[i + 1];
    if (args[i].startsWith(`--${name}=`)) return args[i].split('=').slice(1).join('=');
  }
  return undefined;
}

const BASE_URL = getArg('base') ?? 'http://localhost:3000';
const OUT_FILE = getArg('out');
const SLUG_FILTER = getArg('slug');
const VERBOSE = process.argv.includes('--verbose');

if (!OUT_FILE) {
  console.error('Usage: node scripts/snapshot-rendered-pages.mjs --out snapshots/before.json');
  process.exit(1);
}

// ─── Route discovery ─────────────────────────────────────────

function getSlugsFromDir(subdir) {
  const dir = path.join(CONTENT_DIR, subdir);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.mdx'))
    .map(f => f.replace(/\.mdx$/, ''));
}

function buildRoutes() {
  const routes = [];

  // Static top-level routes
  routes.push({ route: '/', label: 'home' });
  routes.push({ route: '/checklists', label: 'checklists' });
  routes.push({ route: '/news', label: 'news' });
  routes.push({ route: '/changelog', label: 'changelog' });

  // Guide routes
  for (const slug of getSlugsFromDir('guides')) {
    routes.push({ route: `/${slug}`, label: `guide/${slug}` });
  }

  // Page routes (about, contribute, etc.)
  for (const slug of getSlugsFromDir('pages')) {
    routes.push({ route: `/${slug}`, label: `page/${slug}` });
  }

  return routes;
}

// ─── HTML → text extraction ───────────────────────────────────

/**
 * Extract the text content of id="main-content" from raw HTML.
 * Falls back to <main> if id not found.
 */
function extractMainContent(html) {
  // Try to find id="main-content" block
  // Use a simple approach: find the opening tag, then grab everything until
  // the closing </main> (tracking nesting depth)
  const startMatch = html.match(/(<main\b[^>]*id="main-content"[^>]*>|<[^>]+id="main-content"[^>]*>)/i);
  if (!startMatch) {
    // Fall back to first <main>
    const mainMatch = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
    return mainMatch ? mainMatch[1] : html;
  }

  const startIdx = startMatch.index + startMatch[0].length;

  // Walk forward tracking <main nesting depth to find the matching </main>
  let depth = 1;
  let i = startIdx;
  while (i < html.length && depth > 0) {
    const openIdx = html.indexOf('<main', i);
    const closeIdx = html.indexOf('</main', i);

    if (closeIdx === -1) break; // malformed

    if (openIdx !== -1 && openIdx < closeIdx) {
      depth++;
      i = openIdx + 5;
    } else {
      depth--;
      if (depth === 0) {
        return html.slice(startIdx, closeIdx);
      }
      i = closeIdx + 7;
    }
  }

  return html.slice(startIdx);
}

/**
 * Strip HTML tags and decode common entities.
 */
function stripHtml(html) {
  return html
    // Remove <script> blocks entirely (with content)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    // Remove <style> blocks entirely
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    // Remove HTML comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // Decode Next.js __NEXT_DATA__ or similar JSON blobs
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    // Strip all remaining tags
    .replace(/<[^>]+>/g, ' ')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#\d+;/g, ' ');
}

/**
 * Normalize extracted text for comparison — same logic as compare-content.mjs.
 */
function normalize(text) {
  return text
    .replace(/\u00a0/g, ' ')          // non-breaking spaces
    .replace(/[""]/g, '"')            // smart quotes
    .replace(/['']/g, "'")            // smart apostrophes
    .replace(/[–—]/g, '-')            // dashes
    .replace(/…/g, '...')             // ellipsis
    .replace(/›/g, '>')               // angle quotes
    .replace(/https?:\/\/[^\s)>\]"]+/g, '') // strip URLs
    .replace(/\s+/g, ' ')             // collapse whitespace
    .trim()
    .toLowerCase();
}

// ─── Fetch a single route ─────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchRoute(route, retries = 3) {
  const url = `${BASE_URL}${route}`;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'text/html', 'User-Agent': 'snapshot-script/1.0' },
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 404) return { status: 404, text: null };
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const main = extractMainContent(html);
      const text = normalize(stripHtml(main));
      return { status: res.status, text };
    } catch (err) {
      if (attempt < retries - 1) {
        await sleep(500 * (attempt + 1));
        continue;
      }
      return { status: 0, error: err.message, text: null };
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────

async function main() {
  // Verify server is reachable
  console.log(`Checking server at ${BASE_URL}...`);
  try {
    const res = await fetch(BASE_URL, { signal: AbortSignal.timeout(5000) });
    if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
    console.log(`Server is up (${res.status}).\n`);
  } catch (err) {
    console.error(`Cannot reach server at ${BASE_URL}: ${err.message}`);
    console.error('Start the dev server first: yarn dev');
    process.exit(1);
  }

  const allRoutes = buildRoutes();
  const routes = SLUG_FILTER
    ? allRoutes.filter(r => r.label.includes(SLUG_FILTER) || r.route === `/${SLUG_FILTER}`)
    : allRoutes;

  console.log(`Snapshotting ${routes.length} routes from ${BASE_URL}...\n`);

  const snapshot = {
    createdAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    routes: {},
  };

  let ok = 0, notFound = 0, errors = 0;

  for (const { route, label } of routes) {
    const result = await fetchRoute(route);

    if (result.status === 404) {
      if (VERBOSE) console.log(`  404  ${route}`);
      notFound++;
      snapshot.routes[route] = { label, status: 404, text: null };
    } else if (result.error || result.text === null) {
      console.warn(`  ERR  ${route}: ${result.error}`);
      errors++;
      snapshot.routes[route] = { label, status: result.status, error: result.error, text: null };
    } else {
      if (VERBOSE) console.log(`  OK   ${route} (${result.text.length} chars)`);
      ok++;
      snapshot.routes[route] = { label, status: result.status, text: result.text };
    }

    // Small delay to avoid hammering the dev server
    await sleep(80);
  }

  // Write snapshot
  const outDir = path.dirname(OUT_FILE);
  if (outDir && outDir !== '.') fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(snapshot, null, 2));

  console.log(`\nDone.`);
  console.log(`  OK:       ${ok}`);
  console.log(`  Not found: ${notFound}`);
  console.log(`  Errors:   ${errors}`);
  console.log(`\nSnapshot saved → ${OUT_FILE}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
