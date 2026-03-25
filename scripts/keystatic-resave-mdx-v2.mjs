// Resave MDX files using the same pipeline as Keystatic.
//
// Body:  fromMarkdown → toMarkdown  (same extensions/options as Keystatic's ui.tsx)
// YAML:  load → dump               (same as Keystatic's updating.tsx)
// Dates: patched toISOString        (same as Keystatic's date field serialize)
//
// Usage:
//   node scripts/keystatic-resave-mdx-v2.mjs <dir-or-file> [--check|--write] [-r]

import fs from 'node:fs/promises';
import path from 'node:path';
import { load, dump } from 'js-yaml';

import { fromMarkdown } from 'mdast-util-from-markdown';
import { toMarkdown } from 'mdast-util-to-markdown';
import { mdxFromMarkdown, mdxToMarkdown } from 'mdast-util-mdx';
import { mdxjs } from 'micromark-extension-mdxjs';
import { gfmAutolinkLiteral } from 'micromark-extension-gfm-autolink-literal';
import {
  gfmAutolinkLiteralFromMarkdown,
  gfmAutolinkLiteralToMarkdown,
} from 'mdast-util-gfm-autolink-literal';
import { gfmStrikethrough } from 'micromark-extension-gfm-strikethrough';
import {
  gfmStrikethroughFromMarkdown,
  gfmStrikethroughToMarkdown,
} from 'mdast-util-gfm-strikethrough';
import { gfmTable } from 'micromark-extension-gfm-table';
import {
  gfmTableFromMarkdown,
  gfmTableToMarkdown,
} from 'mdast-util-gfm-table';

// ── MDAST config — identical to Keystatic's ui.tsx ───────────────────────────

const parseOptions = {
  extensions: [mdxjs(), gfmAutolinkLiteral(), gfmStrikethrough(), gfmTable()],
  mdastExtensions: [
    mdxFromMarkdown(),
    gfmAutolinkLiteralFromMarkdown(),
    gfmStrikethroughFromMarkdown(),
    gfmTableFromMarkdown(),
  ],
};

const serializeOptions = {
  extensions: [
    gfmAutolinkLiteralToMarkdown(),
    gfmStrikethroughToMarkdown(),
    gfmTableToMarkdown(),
    mdxToMarkdown(),
  ],
  rule: '-',
};

// ── Frontmatter ──────────────────────────────────────────────────────────────
// Keystatic uses js-yaml load/dump with zero options.
// Its date field serializer overrides toISOString on Date objects so that
// dump() outputs bare YYYY-MM-DD instead of full ISO timestamps.
// See: packages/keystatic/src/form/fields/date/index.tsx
//      packages/keystatic/src/app/updating.tsx

const FRONTMATTER_RE = /^---(?:\r?\n([^]*?))?\r?\n---\r?\n?/;

function patchDates(value) {
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    const str = `${y}-${m}-${d}`;
    value.toISOString = () => str;
    return value;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = patchDates(value[i]);
    return value;
  }
  if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) value[k] = patchDates(value[k]);
    return value;
  }
  return value;
}

function reserializeFrontmatter(raw) {
  let data = raw.trim() ? load(raw) : {};
  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    data = {};
  }
  patchDates(data);
  return dump(data);
}

// ── MDX body ─────────────────────────────────────────────────────────────────

function reserializeBody(body) {
  const ast = fromMarkdown(body, parseOptions);
  return toMarkdown(ast, serializeOptions);
}

// ── Per-file ─────────────────────────────────────────────────────────────────

function reserializeFile(text) {
  const match = text.match(FRONTMATTER_RE);
  if (!match) return { changed: false, output: text, reason: 'no frontmatter' };

  const fmRaw = match[1] ?? '';
  const body = text.slice(match[0].length);

  let fmYaml, newBody;
  try {
    fmYaml = reserializeFrontmatter(fmRaw);
  } catch (err) {
    return { changed: false, output: text, reason: `yaml error: ${err.message}` };
  }
  try {
    newBody = reserializeBody(body);
  } catch (err) {
    return { changed: false, output: text, reason: `mdx error: ${err.message}` };
  }

  const output = `---\n${fmYaml}---\n${newBody}`;
  return { changed: output !== text, output, reason: output !== text ? 'changed' : 'ok' };
}

// ── File walking ─────────────────────────────────────────────────────────────

async function* walk(dir, recursive) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && recursive) yield* walk(full, recursive);
    else if (entry.isFile()) yield full;
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { target: null, recursive: false, check: false, write: false };
  for (const a of argv) {
    if (a === '-r' || a === '--recursive') args.recursive = true;
    else if (a === '--check') args.check = true;
    else if (a === '--write') args.write = true;
    else if (!a.startsWith('-') && !args.target) args.target = a;
  }
  if (!args.target) die('Usage: node keystatic-resave-mdx-v2.mjs <path> --check|--write [-r]');
  if (args.check === args.write) die('Pick exactly one of --check or --write');
  return args;
}

function die(msg) { console.error(msg); process.exit(1); }

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = path.resolve(args.target);
  const stat = await fs.stat(target);

  const files = [];
  if (stat.isFile()) {
    files.push(target);
  } else {
    for await (const f of walk(target, args.recursive)) {
      if (f.endsWith('.mdx')) files.push(f);
    }
  }

  let scanned = 0, changed = 0, skipped = 0;
  const changedList = [], skippedList = [];

  for (const filePath of files) {
    scanned++;
    const text = await fs.readFile(filePath, 'utf8');
    const res = reserializeFile(text);

    if (res.reason !== 'changed' && res.reason !== 'ok') {
      skipped++;
      skippedList.push({ file: filePath, reason: res.reason });
      continue;
    }
    if (res.changed) {
      changed++;
      changedList.push(filePath);
      if (args.write) await fs.writeFile(filePath, res.output, 'utf8');
    }
  }

  const rel = f => path.relative(process.cwd(), f);
  if (args.check) {
    if (changed) {
      console.error(`Would change ${changed}/${scanned} file(s):`);
      changedList.forEach(f => console.error(`  ${rel(f)}`));
      process.exitCode = 1;
    } else {
      console.log(`No changes needed (${scanned} file(s) scanned).`);
    }
  } else {
    console.log(`Wrote ${changed}/${scanned} file(s).`);
  }
  if (skipped) {
    console.log(`Skipped ${skipped}:`);
    skippedList.forEach(s => console.log(`  ${rel(s.file)} — ${s.reason}`));
  }
}

main().catch(err => { console.error(err); process.exitCode = 1; });
