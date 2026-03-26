#!/usr/bin/env node
/**
 * yarn snapshot-compare <dir-1> <dir-2>
 * 1) Normalizes both static trees (same as snapshot-normalize).
 * 2) Diffs the normalized text outputs.
 * Everything goes under one folder: buildbackups/snapshot-compare-DATETIME/
 *   1-before-HASH/  2-after-HASH/  comparison-HASH1-HASH2.diff
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import {
  resolveSnapshotDirs,
  REPO_ROOT,
  usageSnapshotTwoDirs
} from './snapshot-resolve-dir.mjs';
import {
  getTimestamp,
  compareNormalizedDirNames,
  normalizeOneStaticDir
} from './snapshot-normalize-lib.mjs';

const ROOT = REPO_ROOT;

const raw1 = process.argv[2];
const raw2 = process.argv[3];
if (!raw1 || !raw2) {
  console.error(usageSnapshotTwoDirs('snapshot-compare'));
  process.exit(1);
}

let abs1;
let abs2;
try {
  [abs1, abs2] = resolveSnapshotDirs(raw1, raw2);
} catch (e) {
  console.error('❌', e.message || e);
  process.exit(1);
}

const { dir1, dir2, hash1, hash2 } = compareNormalizedDirNames(abs1, abs2);
const stamp = getTimestamp();
const outDir = path.join(ROOT, 'buildbackups', `snapshot-compare-${stamp}`);
const norm1 = path.join(outDir, dir1);
const norm2 = path.join(outDir, dir2);
const outFile = path.join(outDir, `comparison-${hash1}-${hash2}.diff`);

(async () => {
  try {
    fs.mkdirSync(outDir, { recursive: true });

    console.log(
      `📎 ${path.relative(ROOT, abs1)}\n   ↔ ${path.relative(ROOT, abs2)}`
    );
    console.log(`📂 Output base: ${path.relative(ROOT, outDir)}`);

    console.log('📄 Normalizing (1/2)…');
    await normalizeOneStaticDir(abs1, norm1);
    console.log(`✅ Normalized → ${dir1}/`);

    console.log('📄 Normalizing (2/2)…');
    await normalizeOneStaticDir(abs2, norm2);
    console.log(`✅ Normalized → ${dir2}/`);

    let diffText = '';
    try {
      diffText = execSync(`diff -ruN -x '.DS_Store' "${norm1}" "${norm2}"`, {
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
  } catch (e) {
    console.error('❌', e.message || e);
    process.exit(1);
  }
})();
