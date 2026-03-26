/**
 * Shared snapshot text normalization (used by snapshot-normalize CLI and snapshot-compare).
 * Renders each page in headless Chromium (Playwright) so client-side / hydrated DOM is captured,
 * then normalizes visible text (dates stripped; per-line trim; blank lines collapsed).
 *
 * URLs come **only** from sitemap.xml. Skips /api/*, skips non-English locales (/es/, etc.),
 * strips /en from paths for fetch + output naming so snapshots stay comparable.
 * Visible text is taken from `#main-content` (see components/layout/Layout.js), not header/footer.
 * Collapsed guide checklist bodies (components/guides/ChecklistItem.js) are expanded before capture.
 *
 * Env (optional): SNAPSHOT_PAGE_CONCURRENCY (default 3, set 1 for sequential),
 * SNAPSHOT_EXPAND_SETTLE_MS (default 80 ms after expand; was 600 ms every page).
 */

import crypto from 'crypto';
import fs from 'fs';
import net from 'net';
import path from 'path';
import { spawn } from 'child_process';
import { chromium } from 'playwright';
import { REPO_ROOT } from './snapshot-resolve-dir.mjs';

export const ROOT = REPO_ROOT;

const MONTH_RE =
  '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s*\\d{4})?';

const DATE_RES = [
  /\b\d{4}-\d{2}-\d{2}\b/g,
  /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
  new RegExp(`\\b${MONTH_RE}\\b`, 'gi')
];

const ASSET_EXT = /\.(png|jpe?g|gif|webp|svg|ico|css|js|mjs|map|woff2?|ttf|eot|pdf|xml|txt|json|webmanifest)$/i;

/** Max time for navigation + network to settle (static sites are usually fast). */
const GOTO_TIMEOUT_MS = 90_000;

/**
 * After expanding checklists: double rAF + short timeout (was 600ms/page — too slow × N pages).
 * Tune with SNAPSHOT_EXPAND_SETTLE_MS if needed.
 */
const SNAPSHOT_EXPAND_SETTLE_MS = (() => {
  const v = process.env.SNAPSHOT_EXPAND_SETTLE_MS;
  if (v === undefined || v === '') {
    return 80;
  }
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 80;
})();

/** Parallel Playwright pages (same static server). Set to 1 to go sequential. */
function getSnapshotPageConcurrency() {
  const raw = process.env.SNAPSHOT_PAGE_CONCURRENCY;
  const n =
    raw === undefined || raw === '' ? 3 : parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n < 1) {
    return 1;
  }
  return Math.min(8, Math.floor(n));
}

export function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

export function dirSlug(absPath) {
  return crypto.createHash('sha256').update(path.resolve(absPath)).digest('hex').slice(0, 7);
}

/**
 * Subfolders under snapshot-compare-DATETIME/: arg1 → 1-before-*, arg2 → 2-after-*.
 */
export function compareNormalizedDirNames(absPath1, absPath2) {
  const h1 = dirSlug(absPath1);
  const h2 = dirSlug(absPath2);
  return {
    dir1: `1-before-${h1}`,
    dir2: `2-after-${h2}`,
    hash1: h1,
    hash2: h2
  };
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const addr = s.address();
      const port = typeof addr === 'object' && addr ? addr.port : null;
      s.close((err) => (err ? reject(err) : resolve(port)));
    });
    s.on('error', reject);
  });
}

/**
 * Post-process visible text from a rendered page (no HTML parsing — use after innerText).
 * innerText often inserts extra blank lines between block/list nodes; flatten those so
 * compares aren't mostly "- empty line" noise.
 */
function normalizePlainSnapshotText(text) {
  let s = (text || '').replace(/\r\n/g, '\n');
  s = s
    .split('\n')
    .map((line) => line.trim())
    .join('\n');
  for (const re of DATE_RES) {
    s = s.replace(re, '');
  }
  // Any run of blank lines becomes a single newline (no empty lines in output).
  s = s.replace(/\n{2,}/g, '\n');
  return s.trim() + '\n';
}

function pathToSafeRel(urlPath) {
  let p = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath;
  if (!p || p === '') {
    p = 'index';
  }
  p = p.replace(/\/$/, '') || 'index';
  if (ASSET_EXT.test(p)) {
    return null;
  }
  const safe = p.replace(/\//g, '__') + '.txt';
  return safe;
}

/**
 * Stable key so /en/foo/ and /foo/ (both in sitemap) only render once.
 */
function dedupeKeyForFetchPath(fetchPath) {
  if (fetchPath === '/' || fetchPath === '') {
    return '/';
  }
  const trimmed = fetchPath.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

/**
 * Sitemap pathname → English-only fetch path. Skips API + non-en locales.
 * @returns {{ skip: true, reason?: string } | { skip: false, fetchPath: string, dedupeKey: string }}
 */
function englishOnlyFetchFromPathname(pathname) {
  let path = pathname || '/';
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }

  if (path === '/api' || path.startsWith('/api/')) {
    return { skip: true, reason: 'api' };
  }

  const loc = path.match(/^\/([a-z]{2})(\/|$)/);
  if (loc) {
    const code = loc[1];
    if (code !== 'en') {
      return { skip: true, reason: 'non-en' };
    }
    if (path === '/en' || path === '/en/') {
      return { skip: false, fetchPath: '/', dedupeKey: '/' };
    }
    const fetchPath = path.startsWith('/en/') ? `/${path.slice(4)}` : '/';
    return { skip: false, fetchPath, dedupeKey: dedupeKeyForFetchPath(fetchPath) };
  }

  return {
    skip: false,
    fetchPath: path,
    dedupeKey: dedupeKeyForFetchPath(path)
  };
}

function parseSitemapLocs(xml) {
  const locs = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    locs.push(m[1].trim());
  }
  return locs;
}

/**
 * Guide ChecklistItem bodies use grid-rows-[0fr] + overflow hidden when collapsed; innerText
 * omits that content. Click "Expand all" / each card header, then force-open via CSS fallback.
 */
async function expandChecklistContentForSnapshot(page) {
  try {
    const expandAll = page
      .locator('#main-content')
      .getByRole('button', { name: /^\s*expand all\s*$/i });
    const n = await expandAll.count();
    for (let i = 0; i < n; i++) {
      await expandAll.nth(i).click({ timeout: 8000 }).catch(() => {});
    }
  } catch {
    // no sections with expand-all
  }

  await page.evaluate(() => {
    document.querySelectorAll('#main-content .checklist-item').forEach((card) => {
      if (!card.querySelector('svg.rotate-180')) {
        const header = card.children[0];
        if (header) {
          header.dispatchEvent(
            new MouseEvent('click', { bubbles: true, cancelable: true })
          );
        }
      }
    });
  });

  await page.addStyleTag({
    content:
      '#main-content .checklist-item > div.grid{grid-template-rows:1fr!important}' +
      '#main-content .checklist-item > div.grid > .overflow-hidden{overflow:visible!important}'
  });

  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      })
  );
  await new Promise((r) => setTimeout(r, SNAPSHOT_EXPAND_SETTLE_MS));
}

async function waitForServer(port, maxMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`);
      if (res.ok || res.status === 404) {
        return;
      }
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`http-server did not respond on port ${port}`);
}

function formatEta(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return '…';
  }
  const s = Math.round(ms / 1000);
  if (s < 60) {
    return `${s}s`;
  }
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return rs ? `${m}m ${rs}s` : `${m}m`;
}

/** Single-line progress (\r + ANSI EL). Use progressWarn() so warnings don't garble the line. */
function writeSnapshotProgress(done, total, pathLabel, startedAt) {
  const pct = total ? Math.min(100, Math.floor((100 * done) / total)) : 100;
  const barW = 22;
  const filled = total ? Math.round((barW * done) / total) : barW;
  const eq = Math.max(0, Math.min(barW - 1, filled));
  const sp = Math.max(0, barW - 1 - eq);
  const bar = `[${'='.repeat(eq)}>${' '.repeat(sp)}]`;
  let eta = '…';
  if (done > 0 && done < total) {
    const elapsed = Date.now() - startedAt;
    eta = formatEta((elapsed / done) * (total - done));
  } else if (done >= total && total > 0) {
    eta = 'done';
  }
  const label =
    pathLabel.length > 40 ? `…${pathLabel.slice(-38)}` : pathLabel || '—';
  const numW = String(total).length;
  const line = `${bar} ${String(done).padStart(numW)}/${total} ${pct}%  ETA ${eta}  ${label}`;
  process.stdout.write(`\r\x1b[K${line}`);
}

function progressWarn(...args) {
  process.stdout.write('\n');
  console.warn(...args);
}

/** Sitemap URLs → list of pages to render (same filters as the main loop). */
function collectSnapshotWorkItems(locs) {
  const seen = new Set();
  const items = [];
  for (const loc of locs) {
    let pathname;
    try {
      const u = new URL(loc);
      pathname = u.pathname || '/';
    } catch {
      continue;
    }
    const en = englishOnlyFetchFromPathname(pathname);
    if (en.skip) {
      continue;
    }
    const { fetchPath, dedupeKey } = en;
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    if (ASSET_EXT.test(fetchPath.split('/').pop() || '')) {
      continue;
    }
    const rel = pathToSafeRel(fetchPath);
    if (!rel) {
      continue;
    }
    items.push({ fetchPath, pathname, rel });
  }
  return items;
}

async function snapshotRenderOnePage(page, port, item, outSubdir) {
  const { fetchPath, pathname, rel } = item;
  const pageUrl = `http://127.0.0.1:${port}${fetchPath}`;
  const response = await page.goto(pageUrl, {
    waitUntil: 'networkidle',
    timeout: GOTO_TIMEOUT_MS
  });
  if (!response) {
    progressWarn(`⚠️  No response ${fetchPath} (from ${pathname})`);
    return;
  }
  const status = response.status();
  if (status < 200 || status >= 400) {
    progressWarn(`⚠️  Skip ${fetchPath} (${status})`);
    return;
  }
  const ct = (response.headers()['content-type'] || '').toLowerCase();
  if (ct && !ct.includes('text/html')) {
    return;
  }

  const nCheck = await page.locator('#main-content .checklist-item').count();
  if (nCheck > 0) {
    await expandChecklistContentForSnapshot(page);
  }

  const rawText = await page.evaluate(() => {
    const main =
      document.querySelector('#main-content') ||
      document.querySelector('main[role="main"]') ||
      document.querySelector('main');
    const el = main || document.body;
    return el ? el.innerText : '';
  });
  const text = normalizePlainSnapshotText(rawText);
  const dest = path.join(outSubdir, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, text, 'utf8');
}

export async function normalizeOneStaticDir(absRoot, outSubdir) {
  if (!fs.existsSync(absRoot) || !fs.statSync(absRoot).isDirectory()) {
    throw new Error(`Not a directory: ${absRoot}`);
  }

  const port = await getFreePort();
  const bin = path.join(ROOT, 'node_modules', '.bin', 'http-server');
  if (!fs.existsSync(bin)) {
    throw new Error('http-server not found. Run yarn install.');
  }

  const child = spawn(bin, [absRoot, '-p', String(port), '-s', '-a', '127.0.0.1'], {
    stdio: 'ignore',
    cwd: ROOT
  });

  let browser;
  try {
    await waitForServer(port);
    const smRes = await fetch(`http://127.0.0.1:${port}/sitemap.xml`);
    if (!smRes.ok) {
      throw new Error(`sitemap.xml missing or not OK (${smRes.status}) for ${absRoot}`);
    }
    const xml = await smRes.text();
    const locs = parseSitemapLocs(xml);
    if (!locs.length) {
      throw new Error(`No <loc> entries in sitemap for ${absRoot}`);
    }

    fs.mkdirSync(outSubdir, { recursive: true });

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });

    const items = collectSnapshotWorkItems(locs);
    const total = items.length;
    const startedAt = Date.now();
    const concurrency = getSnapshotPageConcurrency();

    if (total === 0) {
      writeSnapshotProgress(0, 0, '—', startedAt);
      process.stdout.write('\n');
    } else if (concurrency <= 1) {
      const page = await context.newPage();
      try {
        for (let i = 0; i < items.length; i++) {
          const { fetchPath } = items[i];
          writeSnapshotProgress(i, total, fetchPath, startedAt);
          try {
            await snapshotRenderOnePage(page, port, items[i], outSubdir);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            progressWarn(`⚠️  ${fetchPath}: ${msg}`);
          }
          writeSnapshotProgress(i + 1, total, fetchPath, startedAt);
        }
      } finally {
        await page.close();
      }
    } else {
      writeSnapshotProgress(0, total, `${concurrency}× parallel`, startedAt);
      let completed = 0;
      const lock = { next: 0 };
      const label = `${concurrency}× parallel`;

      async function worker() {
        const page = await context.newPage();
        try {
          for (;;) {
            const idx = lock.next++;
            if (idx >= items.length) {
              break;
            }
            const item = items[idx];
            const { fetchPath } = item;
            try {
              await snapshotRenderOnePage(page, port, item, outSubdir);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              progressWarn(`⚠️  ${fetchPath}: ${msg}`);
            }
            completed++;
            writeSnapshotProgress(completed, total, label, startedAt);
          }
        } finally {
          await page.close();
        }
      }

      await Promise.all(
        Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
      );
    }

    writeSnapshotProgress(total, total, '', startedAt);
    process.stdout.write('\n');

  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    child.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 300));
    if (!child.killed) {
      child.kill('SIGKILL');
    }
  }
}
