#!/usr/bin/env node

/**
 * Compare two rendered-page snapshots with a colored git-style diff.
 * Shows character-level highlighting (like GitHub) on modified lines.
 *
 * Usage:
 *   node scripts/compare-snapshots.mjs snapshots/before.json snapshots/after.json
 *   node scripts/compare-snapshots.mjs snapshots/before.json snapshots/after.json --route=/protest
 *   node scripts/compare-snapshots.mjs snapshots/before.json snapshots/after.json --context=5
 */

import fs from 'fs';

const TERM_WIDTH = process.stdout.columns || 120;

// Strip ANSI escape codes to measure visible length
const ANSI_RE = /\x1b\[[0-9;]*m/g;
function visibleLen(s) { return s.replace(ANSI_RE, '').length; }

// Wrap a pre-colored line to terminal width, preserving the prefix (e.g. '- ', '+ ', '  ')
// and re-applying the line's base color on each continuation line.
function wrapLine(line, prefix = '  ', baseColor = s => s) {
  const maxWidth = TERM_WIDTH - 2;
  const visible = line.replace(ANSI_RE, '');
  if (visible.length <= maxWidth) return line;

  // Split on word boundaries and re-wrap, carrying ANSI state is complex,
  // so we work on the raw colored string and split it by visible char count.
  // Simple approach: strip colors, wrap text, re-apply prefix color.
  const words = visible.slice(prefix.length).split(' ');
  const result = [];
  let cur = prefix;
  for (const word of words) {
    const candidate = cur === prefix ? cur + word : cur + ' ' + word;
    if (candidate.length > maxWidth && cur !== prefix) {
      result.push(cur);
      cur = prefix + '  ' + word; // indent continuation
    } else {
      cur = candidate;
    }
  }
  if (cur !== prefix) result.push(cur);
  return result.map(r => baseColor(r)).join('\n');
}

const [,, beforeFile, afterFile] = process.argv;
const ROUTE_FILTER = process.argv.find(a => a.startsWith('--route='))?.split('=')[1];
const CONTEXT = parseInt(process.argv.find(a => a.startsWith('--context='))?.split('=')[1] ?? '3', 10);

if (!beforeFile || !afterFile) {
  console.error('Usage: node scripts/compare-snapshots.mjs <before.json> <after.json>');
  process.exit(1);
}

const before = JSON.parse(fs.readFileSync(beforeFile, 'utf-8'));
const after  = JSON.parse(fs.readFileSync(afterFile,  'utf-8'));

// ─── ANSI colors ──────────────────────────────────────────────
const c = {
  red:       s => `\x1b[31m${s}\x1b[0m`,
  green:     s => `\x1b[32m${s}\x1b[0m`,
  cyan:      s => `\x1b[36m${s}\x1b[0m`,
  bold:      s => `\x1b[1m${s}\x1b[0m`,
  dim:       s => `\x1b[2m${s}\x1b[0m`,
  // Inline highlight: bright bg for the changed portion within a line
  redBg:     s => `\x1b[41m\x1b[97m${s}\x1b[0m\x1b[31m`,
  greenBg:   s => `\x1b[42m\x1b[97m${s}\x1b[0m\x1b[32m`,
};

// ─── Text → lines ─────────────────────────────────────────────
// Break the flat text blob into short, diffable lines by splitting on
// sentence endings AND phrase boundaries (comma/semicolon/colon).
function toLines(text) {
  text = text.replace(/[ \t]+/g, ' ').trim();

  // First split on blank lines and explicit newlines
  const paragraphs = text.split(/\n+/);
  const lines = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    // Split on sentence-ending punctuation followed by a capital letter
    const sentences = trimmed.split(/(?<=[.!?])\s+(?=[A-Z"'\u2018\u201C\d])/);

    for (const sentence of sentences) {
      const s = sentence.trim();
      if (!s) continue;

      if (s.length <= 120) {
        lines.push(s);
      } else {
        // Long sentence: split further at comma/semicolon/colon
        const parts = s.split(/(?<=[,;:])\s+/);
        let buf = '';
        for (const part of parts) {
          const candidate = buf ? buf + ', ' + part : part;
          if (buf && candidate.length > 120) {
            lines.push(buf.trim());
            buf = part;
          } else {
            buf = candidate;
          }
        }
        if (buf.trim()) lines.push(buf.trim());
      }
    }
  }

  return lines;
}

// ─── LCS diff on arrays ───────────────────────────────────────
function lcs(a, b) {
  const m = a.length, n = b.length;
  if (m * n > 400_000) return null; // too large, skip LCS
  const dp = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i+1][j+1] + 1 : Math.max(dp[i+1][j], dp[i][j+1]);
  return dp;
}

function lineDiff(aLines, bLines) {
  const dp = lcs(aLines, bLines);
  if (!dp) {
    // Fallback: mark everything as del then ins
    return [...aLines.map(l => ({ type: 'del', line: l })),
            ...bLines.map(l => ({ type: 'ins', line: l }))];
  }
  const result = [];
  let i = 0, j = 0;
  while (i < aLines.length || j < bLines.length) {
    if (i < aLines.length && j < bLines.length && aLines[i] === bLines[j]) {
      result.push({ type: 'eq',  line: aLines[i] }); i++; j++;
    } else if (j < bLines.length && (i >= aLines.length || dp[i][j+1] >= dp[i+1][j])) {
      result.push({ type: 'ins', line: bLines[j] }); j++;
    } else {
      result.push({ type: 'del', line: aLines[i] }); i++;
    }
  }
  return result;
}

// ─── Word/char-level diff for inline highlighting ─────────────
// Splits on word boundaries, computes LCS, wraps changed tokens
// in a bright background color so the exact change is obvious.
function inlineDiff(delLine, insLine) {
  // Tokenize into words + whitespace tokens (keep separators so we can rejoin)
  const tokenize = s => s.split(/(\s+)/);
  const dToks = tokenize(delLine);
  const iToks = tokenize(insLine);

  const dp = lcs(dToks, iToks);
  if (!dp) {
    return {
      del: c.red(`- ${delLine}`),
      ins: c.green(`+ ${insLine}`),
    };
  }

  let di = 0, ii = 0;
  let delOut = c.red('- ');
  let insOut = c.green('+ ');

  while (di < dToks.length || ii < iToks.length) {
    const eq = di < dToks.length && ii < iToks.length && dToks[di] === iToks[ii];
    if (eq) {
      delOut += dToks[di];
      insOut += iToks[ii];
      di++; ii++;
    } else if (ii < iToks.length && (di >= dToks.length || dp[di][ii+1] >= dp[di+1][ii])) {
      insOut += c.greenBg(iToks[ii]);
      ii++;
    } else {
      delOut += c.redBg(dToks[di]);
      di++;
    }
  }

  return { del: delOut, ins: insOut };
}

// ─── Render diff with context ─────────────────────────────────
function renderDiff(hunks) {
  const changed = hunks.reduce((a, h, i) => { if (h.type !== 'eq') a.push(i); return a; }, []);
  if (changed.length === 0) return null;

  const shown = new Set();
  for (const ci of changed)
    for (let k = Math.max(0, ci - CONTEXT); k <= Math.min(hunks.length - 1, ci + CONTEXT); k++)
      shown.add(k);

  const lines = [];
  let prevIdx = -1;

  // Pre-process: pair consecutive del+ins as "modified" lines for inline diff
  const pairMap = new Map(); // del index → ins index
  for (let k = 0; k < hunks.length - 1; k++) {
    if (hunks[k].type === 'del' && hunks[k+1].type === 'ins') {
      pairMap.set(k, k + 1);
    }
  }

  const skipped = new Set();

  for (const idx of [...shown].sort((a, b) => a - b)) {
    if (skipped.has(idx)) continue;
    if (prevIdx >= 0 && idx > prevIdx + 1) lines.push(c.cyan('  ···'));

    const h = hunks[idx];
    const text = h.line.length > 200 ? h.line.slice(0, 200) + '…' : h.line;

    if (h.type === 'del' && pairMap.has(idx) && shown.has(pairMap.get(idx))) {
      // Modified line: show inline diff
      const insIdx = pairMap.get(idx);
      const { del, ins } = inlineDiff(h.line, hunks[insIdx].line);
      lines.push(wrapLine(del, '- ', s => c.red(s)));
      lines.push(wrapLine(ins, '+ ', s => c.green(s)));
      skipped.add(insIdx);
    } else if (h.type === 'del') {
      lines.push(wrapLine(c.red(`- ${text}`), '- ', s => c.red(s)));
    } else if (h.type === 'ins') {
      lines.push(wrapLine(c.green(`+ ${text}`), '+ ', s => c.green(s)));
    } else {
      lines.push(wrapLine(c.dim(`  ${text}`), '  ', s => c.dim(s)));
    }

    prevIdx = idx;
  }

  return lines.join('\n');
}

// ─── Compare ──────────────────────────────────────────────────
const allRoutes = [...new Set([...Object.keys(before.routes), ...Object.keys(after.routes)])].sort();
const results = { match: 0, changed: 0, onlyBefore: 0, onlyAfter: 0, skipped: 0 };
const output = [];

for (const route of allRoutes) {
  if (ROUTE_FILTER && route !== ROUTE_FILTER) continue;

  const b = before.routes[route];
  const a = after.routes[route];

  if (!a) { results.onlyBefore++; output.push({ route, type: 'ONLY_BEFORE' }); continue; }
  if (!b) { results.onlyAfter++;  output.push({ route, type: 'ONLY_AFTER'  }); continue; }
  if (b.status === 404 && a.status === 404) { results.skipped++; continue; }
  if (b.status !== a.status) {
    results.changed++;
    output.push({ route, type: 'STATUS', detail: `${b.status} → ${a.status}` });
    continue;
  }
  if (!b.text || !a.text) { results.skipped++; continue; }
  if (b.text === a.text)  { results.match++; continue; }

  const hunks    = lineDiff(toLines(b.text), toLines(a.text));
  const rendered = renderDiff(hunks);

  if (!rendered) { results.match++; continue; }

  results.changed++;
  output.push({ route, label: b.label || a.label || '', type: 'CONTENT', rendered });
}

// ─── Report ───────────────────────────────────────────────────
console.log(`\n${c.bold('Before:')} ${beforeFile} (${before.createdAt})`);
console.log(`${c.bold('After:')}  ${afterFile} (${after.createdAt})\n`);

const summary = [
  c.green(`${results.match} match`),
  results.changed ? c.red(`${results.changed} changed`) : '0 changed',
  `${results.skipped} skipped`,
  results.onlyBefore ? c.red(`${results.onlyBefore} only-before`) : null,
  results.onlyAfter  ? c.green(`${results.onlyAfter} only-after`)  : null,
].filter(Boolean).join('  ');
console.log(`${c.bold('Summary:')} ${summary}\n`);

for (const item of output) {
  if (item.type === 'ONLY_BEFORE') {
    console.log(c.red(`✗ MISSING IN AFTER  ${item.route}`));
  } else if (item.type === 'ONLY_AFTER') {
    console.log(c.green(`+ NEW IN AFTER  ${item.route}`));
  } else if (item.type === 'STATUS') {
    console.log(c.red(`✗ STATUS  ${item.route}  (${item.detail})`));
  } else {
    console.log(c.bold(c.cyan(`\n@@ ${item.route}${item.label ? '  ' + item.label : ''} @@`)));
    console.log(item.rendered);
  }
}

console.log();
if (results.changed > 0) process.exit(1);
