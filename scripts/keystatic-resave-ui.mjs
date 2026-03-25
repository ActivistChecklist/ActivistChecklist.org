import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

async function* walk(dir, { recursive }) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (recursive) yield* walk(fullPath, { recursive });
      continue;
    }
    if (entry.isFile()) yield fullPath;
  }
}

function parseArgs(argv) {
  const args = {
    baseUrl: 'http://localhost:3000',
    collection: null,
    collectionLabel: null,
    dir: null,
    slug: null,
    recursive: false,
    headful: false,
    limit: null,
    pauseEach: false,
  };

  for (const raw of argv) {
    if (raw.startsWith('--baseUrl=')) args.baseUrl = raw.slice('--baseUrl='.length);
    else if (raw.startsWith('--collection=')) args.collection = raw.slice('--collection='.length);
    else if (raw.startsWith('--collectionLabel=')) args.collectionLabel = raw.slice('--collectionLabel='.length);
    else if (raw.startsWith('--dir=')) args.dir = raw.slice('--dir='.length);
    else if (raw.startsWith('--slug=')) args.slug = raw.slice('--slug='.length);
    else if (raw === '--recursive' || raw === '-r') args.recursive = true;
    else if (raw === '--headful') args.headful = true;
    else if (raw.startsWith('--limit=')) args.limit = Number(raw.slice('--limit='.length));
    else if (raw === '--pauseEach') args.pauseEach = true;
  }

  if (!args.collection) {
    throw new Error('Usage: node scripts/keystatic-resave-ui.mjs --collection=<key> (--dir=<folder> | --slug=<slug>) [--collectionLabel=\"Checklist Items\"] [--baseUrl=http://localhost:3000] [--recursive] [--headful] [--limit=10] [--pauseEach]');
  }
  if (!args.dir && !args.slug) {
    throw new Error('Provide either --dir or --slug');
  }
  return args;
}

function slugFromFilepath(filePath) {
  const base = path.basename(filePath);
  return base.replace(/\.(md|mdx|mdoc)$/, '');
}

async function waitForKeystatic(page) {
  // Wait for Keystatic app shell to mount.
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);
}

async function openEntry(page, { baseUrl, collection, slug }) {
  // Try direct route first (as provided by user).
  const directUrl = `${baseUrl}/keystatic/collection/${encodeURIComponent(collection)}/item/${encodeURIComponent(slug)}`;
  await page.goto(directUrl, { waitUntil: 'domcontentloaded' });
  await waitForKeystatic(page);

  const save = page.getByRole('button', { name: /save/i });
  try {
    await save.waitFor({ state: 'visible', timeout: 15000 });
    return;
  } catch {
    // fall through to UI navigation
  }

  // Fallback: navigate to Keystatic home and then retry direct URL.
  await page.goto(`${baseUrl}/keystatic`, { waitUntil: 'domcontentloaded' });
  await waitForKeystatic(page);
  await page.goto(directUrl, { waitUntil: 'domcontentloaded' });
  await waitForKeystatic(page);
  await save.waitFor({ state: 'visible', timeout: 20000 });
}

async function clickSave(page) {
  const save = page.getByRole('button', { name: /save/i });
  await save.click();
  // Wait for save to settle (Keystatic often shows "Saving…" or disables button).
  await page.waitForTimeout(800);
}

async function togglePreviewFieldTwice(page) {
  // Our checklist items schema has markdoc.inline fields for preview/do/dont which
  // are good candidates for a reversible insignificant change.
  // We'll try to focus the "Preview text" control and append/remove a single space.
  const previewLabel = page.getByText('Preview text', { exact: false });
  await previewLabel.waitFor({ state: 'visible', timeout: 5000 });

  // The editable for markdoc inline is contenteditable; easiest is to click near it
  // and type. We choose the first contenteditable after the label.
  const editor = page.locator('[contenteditable="true"]').first();
  await editor.click();

  // Add a space, save, then undo (Backspace), save again.
  await page.keyboard.type(' ');
  await clickSave(page);
  await page.keyboard.press('Backspace');
  await clickSave(page);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const targets = [];
  if (args.slug) {
    targets.push({ slug: args.slug, rel: `(slug=${args.slug})` });
  } else {
    const dir = path.resolve(process.cwd(), args.dir);
    for await (const fp of walk(dir, { recursive: args.recursive })) {
      if (!/\.(md|mdx|mdoc)$/.test(fp)) continue;
      targets.push({ slug: slugFromFilepath(fp), rel: path.relative(process.cwd(), fp) });
      if (args.limit && targets.length >= args.limit) break;
    }
    if (!targets.length) {
      console.log('No files found.');
      return;
    }
  }

  const browser = await chromium.launch({ headless: !args.headful });
  const context = await browser.newContext();
  const page = await context.newPage();

  let ok = 0;
  let failed = 0;

  for (const t of targets) {
    const slug = t.slug;
    const rel = t.rel;
    try {
      console.log(`Resaving ${args.collection}/${slug} (${rel})`);
      await openEntry(page, { baseUrl: args.baseUrl, collection: args.collection, slug });
      await togglePreviewFieldTwice(page);
      ok += 1;
      if (args.pauseEach) {
        console.log('Paused. Press Enter to continue...');
        await new Promise((resolve) => process.stdin.once('data', resolve));
      }
    } catch (err) {
      failed += 1;
      console.error(`Failed ${args.collection}/${slug}:`, err?.message || err);
    }
  }

  await browser.close();
  console.log(`Done. ok=${ok} failed=${failed}`);
  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

