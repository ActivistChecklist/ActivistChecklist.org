#!/usr/bin/env node

/**
 * Compare two rendered-page snapshots (before vs after) produced by
 * snapshot-rendered-pages.mjs.
 *
 * Usage:
 *   node scripts/compare-snapshots.mjs snapshots/before.json snapshots/after.json
 *   node scripts/compare-snapshots.mjs snapshots/before.json snapshots/after.json --verbose
 *   node scripts/compare-snapshots.mjs snapshots/before.json snapshots/after.json --route=/protest
 */

import fs from 'fs';

const [,, beforeFile, afterFile] = process.argv;
const VERBOSE = process.argv.includes('--verbose');
const ROUTE_FILTER = process.argv.find(a => a.startsWith('--route='))?.split('=')[1];

if (!beforeFile || !afterFile) {
  console.error('Usage: node scripts/compare-snapshots.mjs <before.json> <after.json>');
  process.exit(1);
}

if (!fs.existsSync(beforeFile)) {
  console.error(`Before snapshot not found: ${beforeFile}`);
  process.exit(1);
}
if (!fs.existsSync(afterFile)) {
  console.error(`After snapshot not found: ${afterFile}`);
  process.exit(1);
}

const before = JSON.parse(fs.readFileSync(beforeFile, 'utf-8'));
const after = JSON.parse(fs.readFileSync(afterFile, 'utf-8'));

console.log(`Before: ${beforeFile} (${before.createdAt})`);
console.log(`After:  ${afterFile} (${after.createdAt})`);
console.log();

// ─── Find contiguous missing chunks ──────────────────────────

/**
 * Find sentences/phrases from `source` that are absent in `target`.
 * Splits on sentence boundaries and checks each chunk.
 */
function findMissingChunks(source, target, minLength = 25) {
  // Split on common sentence/phrase boundaries
  const chunks = source
    .split(/[.!?\n]/)
    .map(s => s.trim())
    .filter(s => s.length >= minLength);

  return chunks.filter(chunk => !target.includes(chunk));
}

/**
 * Find phrases in `after` that weren't in `before` (new/extra content).
 */
function findExtraChunks(before, after, minLength = 25) {
  return findMissingChunks(after, before, minLength);
}

// ─── Compare ─────────────────────────────────────────────────

const allRoutes = new Set([
  ...Object.keys(before.routes),
  ...Object.keys(after.routes),
]);

const results = { match: 0, changed: 0, onlyBefore: 0, onlyAfter: 0, skipped: 0 };
const issues = [];

for (const route of [...allRoutes].sort()) {
  if (ROUTE_FILTER && route !== ROUTE_FILTER) continue;

  const b = before.routes[route];
  const a = after.routes[route];

  // Route only in before snapshot
  if (!a) {
    results.onlyBefore++;
    issues.push({ route, type: 'ONLY_BEFORE', detail: 'Route exists in before but not after snapshot' });
    continue;
  }

  // Route only in after snapshot
  if (!b) {
    results.onlyAfter++;
    issues.push({ route, type: 'ONLY_AFTER', detail: 'Route exists in after but not before snapshot' });
    continue;
  }

  // Both 404 — consistent
  if (b.status === 404 && a.status === 404) {
    results.skipped++;
    continue;
  }

  // 404 status changed
  if (b.status === 404 || a.status === 404) {
    results.changed++;
    issues.push({
      route,
      type: 'STATUS_CHANGED',
      detail: `Status: ${b.status} → ${a.status}`,
    });
    continue;
  }

  // Error in either
  if (!b.text || !a.text) {
    results.skipped++;
    continue;
  }

  // Identical
  if (b.text === a.text) {
    results.match++;
    continue;
  }

  // Find what changed
  const missingFromAfter = findMissingChunks(b.text, a.text);
  const addedInAfter = findExtraChunks(b.text, a.text);

  if (missingFromAfter.length === 0 && addedInAfter.length === 0) {
    // Tiny whitespace-only difference
    results.match++;
    continue;
  }

  results.changed++;
  issues.push({
    route,
    label: b.label || a.label,
    type: 'CONTENT_CHANGED',
    beforeLen: b.text.length,
    afterLen: a.text.length,
    missingFromAfter: missingFromAfter.slice(0, 8),
    addedInAfter: addedInAfter.slice(0, 8),
  });
}

// ─── Report ───────────────────────────────────────────────────

console.log('═══════════════════════════════════════════');
console.log('  Rendered Page Comparison Report');
console.log('═══════════════════════════════════════════');
console.log(`  Matching:    ${results.match}`);
console.log(`  Changed:     ${results.changed}`);
console.log(`  Only before: ${results.onlyBefore}`);
console.log(`  Only after:  ${results.onlyAfter}`);
console.log(`  Skipped:     ${results.skipped}`);
console.log();

if (issues.length === 0) {
  console.log('  ✓ All rendered pages match!\n');
  process.exit(0);
}

// Group by type
const statusChanges = issues.filter(i => i.type === 'STATUS_CHANGED' || i.type === 'ONLY_BEFORE' || i.type === 'ONLY_AFTER');
const contentChanges = issues.filter(i => i.type === 'CONTENT_CHANGED');

if (statusChanges.length > 0) {
  console.log(`── Route / Status Issues (${statusChanges.length}) ──`);
  for (const issue of statusChanges) {
    console.log(`  ${issue.type.padEnd(14)}  ${issue.route}`);
    if (issue.detail) console.log(`                   ${issue.detail}`);
  }
  console.log();
}

if (contentChanges.length > 0) {
  console.log(`── Content Changes (${contentChanges.length}) ──`);
  for (const issue of contentChanges) {
    const label = issue.label ? ` (${issue.label})` : '';
    const lenDiff = issue.afterLen - issue.beforeLen;
    const lenStr = lenDiff === 0 ? '' : ` [${lenDiff > 0 ? '+' : ''}${lenDiff} chars]`;
    console.log(`\n  ${issue.route}${label}${lenStr}`);

    if (issue.missingFromAfter.length > 0) {
      console.log(`    ✗ Missing from after (${issue.missingFromAfter.length} chunks):`);
      const limit = VERBOSE ? issue.missingFromAfter.length : Math.min(3, issue.missingFromAfter.length);
      for (const chunk of issue.missingFromAfter.slice(0, limit)) {
        const preview = chunk.length > 120 ? chunk.slice(0, 120) + '...' : chunk;
        console.log(`        "${preview}"`);
      }
      if (!VERBOSE && issue.missingFromAfter.length > 3) {
        console.log(`        ... and ${issue.missingFromAfter.length - 3} more (use --verbose)`);
      }
    }

    if (VERBOSE && issue.addedInAfter.length > 0) {
      console.log(`    + Added in after (${issue.addedInAfter.length} chunks):`);
      for (const chunk of issue.addedInAfter.slice(0, 5)) {
        const preview = chunk.length > 120 ? chunk.slice(0, 120) + '...' : chunk;
        console.log(`        "${preview}"`);
      }
    }
  }
}

console.log();

// Exit with error code if content changed
if (results.changed > 0) {
  process.exit(1);
}
