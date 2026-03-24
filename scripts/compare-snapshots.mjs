#!/usr/bin/env node

/**
 * Compare two rendered-page snapshots with a colored git-style diff.
 *
 * Usage:
 *   node scripts/compare-snapshots.mjs snapshots/before.json snapshots/after.json
 *   node scripts/compare-snapshots.mjs snapshots/before.json snapshots/after.json --route=/protest
 *   node scripts/compare-snapshots.mjs snapshots/before.json snapshots/after.json --context=5
 */

import fs from 'fs';

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
const RED    = s => `\x1b[31m${s}\x1b[0m`;
const GREEN  = s => `\x1b[32m${s}\x1b[0m`;
const CYAN   = s => `\x1b[36m${s}\x1b[0m`;
const BOLD   = s => `\x1b[1m${s}\x1b[0m`;
const DIM    = s => `\x1b[2m${s}\x1b[0m`;

// ─── Text → lines ─────────────────────────────────────────────
// Break the flat text blob into meaningful lines so the diff is readable.
// Splits on sentence-ending punctuation AND newlines, keeping context.
function toLines(text) {
  // Normalize whitespace, then split on sentence boundaries
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z"'])|(?<=\n)/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

// ─── Myers diff ───────────────────────────────────────────────
// Returns array of { type: 'eq'|'del'|'ins', line } objects.
function diff(aLines, bLines) {
  const m = aLines.length;
  const n = bLines.length;

  // For very long sequences, fall back to a simpler chunk-based diff
  // to avoid O(m*n) memory blowup.
  if (m * n > 500_000) return simpleDiff(aLines, bLines);

  // LCS table (0-indexed)
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = aLines[i] === bLines[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const result = [];
  let i = 0, j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && aLines[i] === bLines[j]) {
      result.push({ type: 'eq', line: aLines[i] });
      i++; j++;
    } else if (j < n && (i >= m || dp[i][j + 1] >= dp[i + 1][j])) {
      result.push({ type: 'ins', line: bLines[j] });
      j++;
    } else {
      result.push({ type: 'del', line: aLines[i] });
      i++;
    }
  }
  return result;
}

// Simple O(n) fallback: find changed sentences without LCS
function simpleDiff(aLines, bLines) {
  const bSet = new Set(bLines);
  const aSet = new Set(aLines);
  const result = [];
  for (const l of aLines) result.push({ type: bSet.has(l) ? 'eq' : 'del', line: l });
  for (const l of bLines) if (!aSet.has(l)) result.push({ type: 'ins', line: l });
  return result;
}

// ─── Render diff with context ─────────────────────────────────
function renderDiff(hunks) {
  const lines = [];
  const changed = hunks.map((h, i) => h.type !== 'eq' ? i : -1).filter(i => i >= 0);
  if (changed.length === 0) return null;

  // Build ranges of context + changed lines to show
  const shown = new Set();
  for (const ci of changed) {
    for (let k = Math.max(0, ci - CONTEXT); k <= Math.min(hunks.length - 1, ci + CONTEXT); k++) {
      shown.add(k);
    }
  }

  let prevIdx = -1;
  for (const idx of [...shown].sort((a, b) => a - b)) {
    if (prevIdx >= 0 && idx > prevIdx + 1) {
      lines.push(CYAN('  ···'));
    }
    const h = hunks[idx];
    const text = h.line.length > 160 ? h.line.slice(0, 160) + '…' : h.line;
    if (h.type === 'del') lines.push(RED(`- ${text}`));
    else if (h.type === 'ins') lines.push(GREEN(`+ ${text}`));
    else lines.push(DIM(`  ${text}`));
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
  if (b.text === a.text)  { results.match++;   continue; }

  const aLines = toLines(b.text);
  const bLines = toLines(a.text);
  const hunks  = diff(aLines, bLines);
  const rendered = renderDiff(hunks);

  if (!rendered) { results.match++; continue; }

  results.changed++;
  const label = b.label || a.label || '';
  output.push({ route, label, type: 'CONTENT', rendered });
}

// ─── Report ───────────────────────────────────────────────────
console.log(`\n${BOLD('Before:')} ${beforeFile} (${before.createdAt})`);
console.log(`${BOLD('After:')}  ${afterFile} (${after.createdAt})\n`);
console.log(`${BOLD('Summary:')} ${GREEN(results.match + ' match')}  ${results.changed ? RED(results.changed + ' changed') : '0 changed'}  ${results.skipped} skipped  ${results.onlyBefore} only-before  ${results.onlyAfter} only-after\n`);

for (const item of output) {
  if (item.type === 'ONLY_BEFORE') {
    console.log(RED(`✗ MISSING IN AFTER  ${item.route}`));
  } else if (item.type === 'ONLY_AFTER') {
    console.log(GREEN(`+ NEW IN AFTER  ${item.route}`));
  } else if (item.type === 'STATUS') {
    console.log(RED(`✗ STATUS CHANGED  ${item.route}  (${item.detail})`));
  } else {
    const header = BOLD(CYAN(`\n@@ ${item.route}${item.label ? '  ' + item.label : ''} @@`));
    console.log(header);
    console.log(item.rendered);
  }
}

console.log();
if (results.changed > 0) process.exit(1);
