#!/usr/bin/env node
/**
 * yarn snapshot-normalize <static-dir-1> <static-dir-2>
 * Serves each dir with http-server, fetches URLs from sitemap.xml, writes visible text
 * (dates stripped, extra blank lines collapsed) under
 * buildbackups/snapshot-compare-DATETIME/<slug>/
 */

import crypto from 'crypto';
import fs from 'fs';
import net from 'net';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const MONTH_RE =
  '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s*\\d{4})?';

const DATE_RES = [
  /\b\d{4}-\d{2}-\d{2}\b/g,
  /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
  new RegExp(`\\b${MONTH_RE}\\b`, 'gi')
];

const ASSET_EXT = /\.(png|jpe?g|gif|webp|svg|ico|css|js|mjs|map|woff2?|ttf|eot|pdf|xml|txt|json|webmanifest)$/i;

function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function dirSlug(absPath) {
  return crypto.createHash('sha256').update(path.resolve(absPath)).digest('hex').slice(0, 7);
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

function decodeBasicEntities(text) {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function htmlToVisibleText(html) {
  let s = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  s = s.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  s = s.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/(p|div|h[1-6]|li|tr|table|section|article|header|footer|nav)\s*>/gi, '\n');
  s = s.replace(/<[^>]+>/g, '');
  s = decodeBasicEntities(s);
  s = s.replace(/[ \t]+\n/g, '\n');
  s = s.replace(/\n[ \t]+/g, '\n');
  for (const re of DATE_RES) {
    s = s.replace(re, '');
  }
  s = s.replace(/\n{3,}/g, '\n\n');
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

function parseSitemapLocs(xml) {
  const locs = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    locs.push(m[1].trim());
  }
  return locs;
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

async function normalizeOneStaticDir(staticRoot, outSubdir) {
  const absRoot = path.resolve(ROOT, staticRoot);
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

    const seen = new Set();
    for (const loc of locs) {
      let pathname;
      try {
        const u = new URL(loc);
        pathname = u.pathname || '/';
      } catch {
        continue;
      }
      if (ASSET_EXT.test(pathname.split('/').pop() || '')) {
        continue;
      }
      const key = pathname;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      const rel = pathToSafeRel(pathname);
      if (!rel) {
        continue;
      }

      const pageUrl = `http://127.0.0.1:${port}${pathname}`;
      const pageRes = await fetch(pageUrl);
      if (!pageRes.ok) {
        console.warn(`⚠️  Skip ${pathname} (${pageRes.status})`);
        continue;
      }
      const html = await pageRes.text();
      if (!/<\s*html|<!DOCTYPE/i.test(html.slice(0, 800))) {
        continue;
      }
      const text = htmlToVisibleText(html);
      const dest = path.join(outSubdir, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, text, 'utf8');
    }
  } finally {
    child.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 300));
    if (!child.killed) {
      child.kill('SIGKILL');
    }
  }
}

const d1 = process.argv[2];
const d2 = process.argv[3];
if (!d1 || !d2) {
  console.error('Usage: yarn snapshot-normalize <static-dir-1> <static-dir-2>');
  process.exit(1);
}

const stamp = getTimestamp();
const base = path.join(ROOT, 'buildbackups', `snapshot-compare-${stamp}`);
const slug1 = dirSlug(path.resolve(ROOT, d1));
const slug2 = dirSlug(path.resolve(ROOT, d2));

(async () => {
  try {
    console.log(`📂 Output base: buildbackups/snapshot-compare-${stamp}`);
    await normalizeOneStaticDir(d1, path.join(base, slug1));
    console.log(`✅ Normalized ${d1} → ${slug1}`);
    await normalizeOneStaticDir(d2, path.join(base, slug2));
    console.log(`✅ Normalized ${d2} → ${slug2}`);
  } catch (e) {
    console.error('❌', e.message || e);
    process.exit(1);
  }
})();
