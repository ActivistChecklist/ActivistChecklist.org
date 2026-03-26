#!/usr/bin/env node
/**
 * yarn snapshot [commit-ish]
 * Clean working tree required. Optionally checks out commit-ish, runs buildstatic,
 * renames the newest buildbackups/out-* folder to snapshot-DATETIME-SHORTHASH,
 * then restores the previous HEAD/branch.
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

function assertCleanGit() {
  const status = execSync('git status --porcelain', {
    encoding: 'utf8',
    cwd: ROOT
  }).trim();
  if (status) {
    console.error(
      '❌ Working tree is dirty. Commit, stash, or discard changes before running yarn snapshot.'
    );
    process.exit(1);
  }
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

assertCleanGit();

const headSha = git('rev-parse HEAD');
let symbolicRef = null;
try {
  symbolicRef = git('symbolic-ref -q HEAD');
} catch {
  symbolicRef = null;
}

let checkedOut = false;
let buildOk = false;
let builtShort = '';

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
  process.exit(1);
}

const newest = listOutBackups()[0];
if (!newest) {
  console.error('❌ No buildbackups/out-* backup found after build.');
  process.exit(1);
}

const snapshotName = `snapshot-${getTimestamp()}-${builtShort}`;
const dest = path.join(BACKUP_DIR, snapshotName);
if (fs.existsSync(dest)) {
  console.error(`❌ Target already exists: ${snapshotName}`);
  process.exit(1);
}

fs.renameSync(newest.path, dest);
console.log(`📸 Snapshot: ${snapshotName}`);
