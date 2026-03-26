#!/usr/bin/env node
/**
 * yarn snapshot-compare <dir-1> <dir-2>
 * Writes unified diff to buildbackups/snapshot-compare-DATETIME/comparison-H1-H2.diff
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function dirSlug(absPath) {
  return crypto.createHash('sha256').update(path.resolve(absPath)).digest('hex').slice(0, 7);
}

const d1 = process.argv[2];
const d2 = process.argv[3];
if (!d1 || !d2) {
  console.error('Usage: yarn snapshot-compare <dir-1> <dir-2>');
  process.exit(1);
}

const abs1 = path.resolve(ROOT, d1);
const abs2 = path.resolve(ROOT, d2);
for (const p of [abs1, abs2]) {
  if (!fs.existsSync(p) || !fs.statSync(p).isDirectory()) {
    console.error(`❌ Not a directory: ${p}`);
    process.exit(1);
  }
}

const h1 = dirSlug(abs1);
const h2 = dirSlug(abs2);
const stamp = getTimestamp();
const outDir = path.join(ROOT, 'buildbackups', `snapshot-compare-${stamp}`);
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `comparison-${h1}-${h2}.diff`);

let diffText = '';
try {
  diffText = execSync(`diff -ruN -x '.DS_Store' "${abs1}" "${abs2}"`, {
    encoding: 'utf8',
    cwd: ROOT,
    maxBuffer: 64 * 1024 * 1024
  });
} catch (e) {
  if (e.status === 1) {
    diffText = e.stdout ? String(e.stdout) : '';
  } else {
    console.error('❌ diff failed:', e.message);
    process.exit(1);
  }
}

fs.writeFileSync(outFile, diffText || '', 'utf8');
console.log(`📝 Wrote ${path.relative(ROOT, outFile)}`);
