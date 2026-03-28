#!/usr/bin/env node
/**
 * Validates that all translation JSON files have matching keys.
 * Compares each non-default locale against the default (en) locale
 * and reports missing or extra keys.
 *
 * Usage:
 *   node scripts/check-translations.mjs          # warns on mismatches
 *   node scripts/check-translations.mjs --strict  # exits with code 1 on mismatches
 */

import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import chalk from 'chalk';
import { DEFAULT_LOCALE } from '../lib/i18n-config.mjs';
import { sectionStart, sectionEnd, detail, subsection } from './lib/build-cli.mjs';

const MESSAGES_DIR = new URL('../messages', import.meta.url).pathname;
const strict = process.argv.includes('--strict');
const KEY_LIST_LIMIT = 40;

function flattenKeys(obj, prefix = '') {
  return Object.entries(obj).reduce((keys, [key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return [...keys, ...flattenKeys(value, fullKey)];
    }
    return [...keys, fullKey];
  }, []);
}

const files = readdirSync(MESSAGES_DIR).filter((f) => f.endsWith('.json'));
const defaultFile = `${DEFAULT_LOCALE}.json`;

if (!files.includes(defaultFile)) {
  console.error(chalk.red(`Default locale file ${defaultFile} not found in ${MESSAGES_DIR}`));
  process.exit(1);
}

sectionStart('🌐', 'Check translations — message key parity');
detail(`Messages: ${MESSAGES_DIR}`);
detail(`Baseline: ${defaultFile}`);

const defaultKeys = new Set(
  flattenKeys(JSON.parse(readFileSync(join(MESSAGES_DIR, defaultFile), 'utf-8')))
);

let hasErrors = false;
let localesOk = 0;
const nonDefaultFiles = files.filter((f) => f !== defaultFile);

for (const file of files) {
  if (file === defaultFile) continue;
  const locale = basename(file, '.json');
  const localeKeys = new Set(
    flattenKeys(JSON.parse(readFileSync(join(MESSAGES_DIR, file), 'utf-8')))
  );

  const missing = [...defaultKeys].filter((k) => !localeKeys.has(k));
  const extra = [...localeKeys].filter((k) => !defaultKeys.has(k));

  if (missing.length > 0) {
    hasErrors = true;
    subsection('⚠️', `${locale}: ${missing.length} missing key(s) vs ${DEFAULT_LOCALE}`);
    missing.slice(0, KEY_LIST_LIMIT).forEach((k) => detail(k));
    if (missing.length > KEY_LIST_LIMIT) {
      detail(`… and ${missing.length - KEY_LIST_LIMIT} more`);
    }
  }

  if (extra.length > 0) {
    hasErrors = true;
    subsection('⚠️', `${locale}: ${extra.length} extra key(s) vs ${DEFAULT_LOCALE}`);
    extra.slice(0, KEY_LIST_LIMIT).forEach((k) => detail(k));
    if (extra.length > KEY_LIST_LIMIT) {
      detail(`… and ${extra.length - KEY_LIST_LIMIT} more`);
    }
  }

  if (missing.length === 0 && extra.length === 0) {
    detail(`${locale}: keys match ${DEFAULT_LOCALE}`);
    localesOk += 1;
  }
}

if (hasErrors && strict) {
  sectionEnd(false, [
    'Translation keys out of sync',
    'Strict prebuild: update messages/*.json',
  ]);
  process.exit(1);
}

if (hasErrors) {
  sectionEnd(true, [
    'Some locales drift from default keys',
    'Fix messages/*.json or this will fail with --strict (prebuild)',
  ]);
  process.exit(0);
}

sectionEnd(true, [
  nonDefaultFiles.length === 0
    ? `Only ${defaultFile} present (no extra locales)`
    : `${localesOk}/${nonDefaultFiles.length} locale file(s) match ${DEFAULT_LOCALE}`,
  'All translation keys aligned',
]);
process.exit(0);
