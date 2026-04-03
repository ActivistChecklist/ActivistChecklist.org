#!/usr/bin/env node
/**
 * yarn snapshot [commit-ish]
 *
 * Builds in a detached git worktree under buildbackups/.worktrees/ (never checks out
 * another ref in your main clone — no stash, no branch switching).
 *
 * Default commit-ish is HEAD. Symlinks the main clone’s node_modules into the worktree,
 * runs yarn buildstatic, then moves the newest buildbackups/out-* into
 * buildbackups/snapshot-DATETIME-SHORTHASH.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

import {
  addDetachedWorktree,
  linkNodeModulesFromMain,
  listOutBackups,
  moveDirPreferRename,
  removeWorktree,
  snapshotBuildEnv
} from './snapshot-worktree.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BACKUP_DIR = path.join(ROOT, 'buildbackups');

function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

const targetCommit = process.argv[2] || 'HEAD';
const ref = targetCommit;

const env = snapshotBuildEnv();

let exitCode = 0;
let wtPath = null;

try {
  console.log(`🌿 Worktree for ${ref} (detached, main clone unchanged)…`);
  const wt = addDetachedWorktree(ROOT, ref, 'snapshot');
  wtPath = wt.path;
  const builtShort = wt.short;

  console.log('📎 Symlink node_modules ← main clone (skip yarn install)…');
  linkNodeModulesFromMain(ROOT, wtPath);

  console.log('🔨 yarn buildstatic…');
  execSync('yarn buildstatic', { cwd: wtPath, stdio: 'inherit', env });

  const wtBackups = path.join(wtPath, 'buildbackups');
  const newest = listOutBackups(wtBackups)[0];
  if (!newest) {
    console.error('❌ No buildbackups/out-* backup found after build.');
    exitCode = 1;
  } else {
    const snapshotName = `snapshot-${getTimestamp()}-${builtShort}`;
    const dest = path.join(BACKUP_DIR, snapshotName);
    if (fs.existsSync(dest)) {
      console.error(`❌ Target already exists: ${snapshotName}`);
      exitCode = 1;
    } else {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      moveDirPreferRename(newest.path, dest);
      console.log(`📸 Snapshot: ${snapshotName}`);
    }
  }
} catch (e) {
  console.error('❌', e.message || e);
  exitCode = 1;
} finally {
  if (wtPath) {
    console.log('🧹 Removing build worktree…');
    removeWorktree(ROOT, wtPath);
  }
}

process.exit(exitCode);
