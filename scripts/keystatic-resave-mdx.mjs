import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { load, dump } from 'js-yaml';

const FRONTMATTER_RE = /^---(?:\r?\n([^]*?))?\r?\n---\r?\n?/;
const FRONTMATTER_BOUNDARY = '---\n';

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
    targetPath: null,
    recursive: false,
    check: false,
    write: false,
    extensions: ['.mdx'],
  };

  for (const raw of argv) {
    if (raw === '--recursive' || raw === '-r') args.recursive = true;
    else if (raw === '--check') args.check = true;
    else if (raw === '--write') args.write = true;
    else if (raw.startsWith('--ext=')) args.extensions = raw.slice('--ext='.length).split(',').map(s => s.trim()).filter(Boolean).map(x => x.startsWith('.') ? x : `.${x}`);
    else if (!raw.startsWith('-') && args.targetPath === null) args.targetPath = raw;
  }

  if (!args.targetPath) {
    throw new Error('Usage: node scripts/keystatic-resave-mdx.mjs <dir-or-file> [--check|--write] [--recursive] [--ext=mdx]');
  }
  if (args.check === args.write) {
    throw new Error('Pick exactly one of --check or --write');
  }
  return args;
}

function normalizeDates(value) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (Array.isArray(value)) {
    return value.map(normalizeDates);
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = normalizeDates(v);
    }
    return out;
  }
  return value;
}

function quoteDateOnlyScalars(yaml) {
  // Ensure YYYY-MM-DD scalars are quoted so js-yaml won't reparse them as timestamps.
  const lines = yaml.split('\n');
  const out = lines.map((line) => {
    // key: 2026-01-28
    let m = line.match(/^(\s*[\w-]+:\s*)(\d{4}-\d{2}-\d{2})\s*$/);
    if (m) return `${m[1]}"${m[2]}"`;

    // - 2026-01-28
    m = line.match(/^(\s*-\s*)(\d{4}-\d{2}-\d{2})\s*$/);
    if (m) return `${m[1]}"${m[2]}"`;

    return line;
  });
  return out.join('\n');
}

function postProcessJsxWrapperBlocks(mdx) {
  // Prettier intentionally preserves some whitespace inside MDX JSX blocks because
  // it can be semantically meaningful. Keystatic's saved MDX tends to:
  // - remove blank lines right after opening / before closing tags
  // - indent markdown content inside JSX wrapper blocks by 2 spaces
  //
  // We apply this conservatively only to "wrapper" tags that occupy a full line:
  // <Tag ...>
  // ...
  // </Tag>
  //
  // (Not self-closing, not inline tags)
  const lines = mdx.split('\n');
  const out = [];

  for (let i = 0; i < lines.length; i += 1) {
    const open = lines[i].match(/^<([A-Z][\w]*)\b[^>]*>\s*$/);
    const isSelfClosing = /\/>\s*$/.test(lines[i]);
    if (!open || isSelfClosing) {
      out.push(lines[i]);
      continue;
    }

    const tag = open[1];
    const closeRe = new RegExp(`^</${tag}>\\s*$`);

    // Find the matching close tag (no nesting support; good enough for your content)
    let j = i + 1;
    for (; j < lines.length; j += 1) {
      if (closeRe.test(lines[j])) break;
    }
    if (j >= lines.length) {
      // no close tag found, bail
      out.push(lines[i]);
      continue;
    }

    const inner = lines.slice(i + 1, j);

    // Trim leading/trailing blank lines
    let start = 0;
    while (start < inner.length && inner[start].trim() === '') start += 1;
    let end = inner.length - 1;
    while (end >= start && inner[end].trim() === '') end -= 1;
    const trimmed = inner.slice(start, end + 1);

    const indented = trimmed.map((l) => {
      if (l.trim() === '') return '';
      return l.startsWith('  ') ? l : `  ${l}`;
    });

    out.push(lines[i]);
    out.push(...indented);
    out.push(lines[j]);
    i = j;
  }

  return out.join('\n');
}

function convertDashBulletsToAsterisk(mdx) {
  // Convert unordered list markers from "-" to "*" in markdown.
  // We do this with a simple state machine so we don't touch:
  // - frontmatter (handled separately)
  // - fenced code blocks
  // - thematic breaks like "---"
  //
  // We intentionally only convert list markers with up to 3 leading spaces
  // to avoid touching indented code blocks.
  const lines = mdx.split('\n');
  let inFence = false;
  let fenceMarker = null; // "```" or "~~~"

  const out = lines.map((line) => {
    const fenceStart = line.match(/^(\s*)(```|~~~)/);
    if (fenceStart) {
      const marker = fenceStart[2];
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
      } else if (marker === fenceMarker) {
        inFence = false;
        fenceMarker = null;
      }
      return line;
    }
    if (inFence) return line;

    if (/^\s*-{3,}\s*$/.test(line)) return line;

    const m = line.match(/^(\s{0,3})-\s+(.*)$/);
    if (!m) return line;
    return `${m[1]}* ${m[2]}`;
  });

  return out.join('\n');
}

async function formatMdxWithPrettier(text, filepath) {
  // Use Prettier for the MDX body formatting Keystatic tends to produce
  // (lists, blank lines, JSX indentation, escapes, etc).
  // We run it via npx so the repo doesn't need prettier installed as a dependency.
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['-y', 'prettier', '--stdin-filepath', filepath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const stdoutChunks = [];
    const stderrChunks = [];

    child.stdout.on('data', (chunk) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk) => stderrChunks.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      const stdout = Buffer.concat(stdoutChunks).toString('utf8');
      const stderr = Buffer.concat(stderrChunks).toString('utf8');
      if (code === 0) return resolve(stdout);
      reject(new Error(stderr || `Prettier exited with code ${code}`));
    });

    child.stdin.write(text);
    child.stdin.end();
  });
}

async function resaveMdxBytes(fileBytes, filepath) {
  const text = new TextDecoder().decode(fileBytes);
  const match = text.match(FRONTMATTER_RE);
  if (!match) {
    return { changed: false, outputBytes: fileBytes, reason: 'no-frontmatter' };
  }

  const frontmatterRaw = match[1] ?? '';
  const body = text.slice(match[0].length);

  let data;
  try {
    data = frontmatterRaw.trim() ? load(frontmatterRaw) : {};
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { changed: false, outputBytes: fileBytes, reason: `yaml-parse-failed: ${message}` };
  }

  // Keystatic uses js-yaml dump() with default options.
  // Ensure we always dump an object-like structure for frontmatter.
  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    // Preserve odd cases by wrapping into an object.
    data = { value: data };
  }

  data = normalizeDates(data);
  const dumpedRaw = dump(data);
  const dumped = quoteDateOnlyScalars(dumpedRaw);
  let outputText = `${FRONTMATTER_BOUNDARY}${dumped}${FRONTMATTER_BOUNDARY}${body}`;

  try {
    outputText = await formatMdxWithPrettier(outputText, filepath);
    outputText = postProcessJsxWrapperBlocks(outputText);
    outputText = convertDashBulletsToAsterisk(outputText);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { changed: false, outputBytes: fileBytes, reason: `prettier-failed: ${message}` };
  }

  const outputBytes = new TextEncoder().encode(outputText);
  const changed = outputText !== text;
  return { changed, outputBytes, reason: changed ? 'reserialized' : 'unchanged' };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const targetPath = path.resolve(process.cwd(), args.targetPath);
  const stat = await fs.stat(targetPath);

  let scanned = 0;
  let changed = 0;
  let skipped = 0;
  const changedFiles = [];
  const skippedFiles = [];

  const iterPaths = stat.isFile()
    ? (async function* () { yield targetPath; })()
    : walk(targetPath, { recursive: args.recursive });

  for await (const filePath of iterPaths) {
    if (!args.extensions.some(ext => filePath.endsWith(ext))) continue;
    scanned += 1;

    const inputBytes = await fs.readFile(filePath);
    const res = await resaveMdxBytes(inputBytes, filePath);

    if (res.reason !== 'reserialized' && res.reason !== 'unchanged') {
      skipped += 1;
      skippedFiles.push({ file: filePath, reason: res.reason });
      continue;
    }

    if (res.changed) {
      changed += 1;
      changedFiles.push(filePath);
      if (args.write) {
        await fs.writeFile(filePath, res.outputBytes);
      }
    }
  }

  if (args.check) {
    if (changedFiles.length) {
      console.error(`Keystatic reserialize would change ${changedFiles.length}/${scanned} file(s):`);
      for (const f of changedFiles) console.error(`- ${path.relative(process.cwd(), f)}`);
      process.exitCode = 1;
    } else {
      console.log(`Keystatic reserialize: no changes needed (${scanned} file(s) scanned).`);
    }
  } else {
    console.log(`Keystatic reserialize wrote ${changed}/${scanned} file(s).`);
  }

  if (skippedFiles.length) {
    console.log(`Skipped ${skipped}/${scanned} file(s):`);
    for (const s of skippedFiles) {
      console.log(`- ${path.relative(process.cwd(), s.file)} (${s.reason})`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

