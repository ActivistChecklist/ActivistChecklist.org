#!/usr/bin/env node
/**
 * yarn snapshot [commit-ish]
 * If the working tree is dirty, changes are stashed (including untracked) before the
 * build and restored with git stash pop at the end.
 * Optionally checks out commit-ish, runs buildstatic, renames the newest
 * buildbackups/out-* folder to snapshot-DATETIME-SHORTHASH, then restores the previous HEAD/branch.
 */

import fs from 'fs';
import path from 'path';
import { execFileSync, execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BACKUP_DIR = path.join(ROOT, 'buildbackups');

function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function isDirtyGit() {
  return !!execSync('git status --porcelain', {
    encoding: 'utf8',
    cwd: ROOT
  }).trim();
}

function git(args, opts = {}) {
  return execSync(`git ${args}`, {
    encoding: 'utf8',
    cwd: ROOT,
    ...opts
  }).trim();
}

function listOutBackups() {
  if (!fs.existsSync(BACKUP_DIR)) {
    return [];
  }
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((name) => name.startsWith('out-'))
    .map((name) => {
      const full = path.join(BACKUP_DIR, name);
      return { name, path: full, mtime: fs.statSync(full).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

const targetCommit = process.argv[2] || null;

let stashed = false;
if (isDirtyGit()) {
  console.log('📦 Stashing local changes (tracked + untracked, not ignored)…');
  execFileSync(
    'git',
    ['stash', 'push', '-m', 'yarn snapshot (auto-stash)', '-u'],
    { cwd: ROOT, stdio: 'inherit' }
  );
  stashed = true;
}

const headSha = git('rev-parse HEAD');
let symbolicRef = null;
try {
  symbolicRef = git('symbolic-ref -q HEAD');
} catch {
  symbolicRef = null;
}

let exitCode = 0;
let checkedOut = false;
let buildOk = false;
let builtShort = '';

try {
  try {
    if (targetCommit) {
      console.log(`📌 Checking out ${targetCommit}…`);
      execFileSync('git', ['checkout', targetCommit], { cwd: ROOT, stdio: 'inherit' });
      checkedOut = true;
    }

    execSync('yarn buildstatic', { cwd: ROOT, stdio: 'inherit' });
    builtShort = git('rev-parse --short HEAD');
    buildOk = true;
  } finally {
    if (checkedOut) {
      if (symbolicRef) {
        console.log(`📌 Restoring ${symbolicRef}…`);
        execFileSync('git', ['checkout', symbolicRef], { cwd: ROOT, stdio: 'inherit' });
      } else {
        console.log(`📌 Restoring detached HEAD ${headSha}…`);
        execFileSync('git', ['checkout', headSha], { cwd: ROOT, stdio: 'inherit' });
      }
    }
  }

  if (!buildOk) {
    exitCode = 1;
  } else {
    const newest = listOutBackups()[0];
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
        fs.renameSync(newest.path, dest);
        console.log(`📸 Snapshot: ${snapshotName}`);
      }
    }
  }
} finally {
  if (stashed) {
    console.log('📦 Restoring stashed changes (git stash pop)…');
    try {
      execFileSync('git', ['stash', 'pop'], { cwd: ROOT, stdio: 'inherit' });
    } catch {
      exitCode = exitCode || 1;
      console.error('❌ git stash pop failed (resolve conflicts if any).');
    }
  }
}

process.exit(exitCode);
