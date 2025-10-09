#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BACKUP_DIR = 'buildbackups';
const MAX_BACKUPS = 50;

function getGitHash() {
  try {
    const hash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    return hash;
  } catch (error) {
    console.warn('Warning: Could not get git hash, proceeding without it');
    return '';
  }
}

function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function createBackupName() {
  const timestamp = getTimestamp();
  const gitHash = getGitHash();
  const hashSuffix = gitHash ? `-${gitHash}` : '';
  return `out-${timestamp}${hashSuffix}`;
}

function rotateBackups() {
  if (!fs.existsSync(BACKUP_DIR)) {
    return;
  }

  const backups = fs.readdirSync(BACKUP_DIR)
    .filter(item => item.startsWith('out-'))
    .map(item => ({
      name: item,
      path: path.join(BACKUP_DIR, item),
      stats: fs.statSync(path.join(BACKUP_DIR, item))
    }))
    .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());

  if (backups.length > MAX_BACKUPS) {
    const toDelete = backups.slice(MAX_BACKUPS);
    
    toDelete.forEach(backup => {
      try {
        fs.rmSync(backup.path, { recursive: true, force: true });
      } catch (error) {
        console.error(`❌ Error deleting backup ${backup.name}:`, error.message);
      }
    });
  }
}

function createBackup() {
  const backupName = createBackupName();
  const backupPath = path.join(BACKUP_DIR, backupName);
  const sourcePath = 'out';

  // Create backup directory if it doesn't exist
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // Check if source exists
  if (!fs.existsSync(sourcePath)) {
    console.error(`❌ Source directory '${sourcePath}' does not exist`);
    process.exit(1);
  }

  try {
    // Copy the out directory
    execSync(`cp -r "${sourcePath}" "${backupPath}"`, { stdio: 'pipe' });
    console.log(`💾 Backup: ${backupName}`);
    
    // Rotate old backups
    rotateBackups();
  } catch (error) {
    console.error('❌ Backup failed:', error.message);
    process.exit(1);
  }
}

// Run the backup
createBackup();
