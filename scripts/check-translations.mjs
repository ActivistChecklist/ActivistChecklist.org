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
import { DEFAULT_LOCALE } from '../lib/i18n-config.mjs';

const MESSAGES_DIR = new URL('../messages', import.meta.url).pathname;
const strict = process.argv.includes('--strict');

function flattenKeys(obj, prefix = '') {
  return Object.entries(obj).reduce((keys, [key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return [...keys, ...flattenKeys(value, fullKey)];
    }
    return [...keys, fullKey];
  }, []);
}

const files = readdirSync(MESSAGES_DIR).filter(f => f.endsWith('.json'));
const defaultFile = `${DEFAULT_LOCALE}.json`;

if (!files.includes(defaultFile)) {
  console.error(`Default locale file ${defaultFile} not found in ${MESSAGES_DIR}`);
  process.exit(1);
}

const defaultKeys = new Set(
  flattenKeys(JSON.parse(readFileSync(join(MESSAGES_DIR, defaultFile), 'utf-8')))
);

let hasErrors = false;

for (const file of files) {
  if (file === defaultFile) continue;
  const locale = basename(file, '.json');
  const localeKeys = new Set(
    flattenKeys(JSON.parse(readFileSync(join(MESSAGES_DIR, file), 'utf-8')))
  );

  const missing = [...defaultKeys].filter(k => !localeKeys.has(k));
  const extra = [...localeKeys].filter(k => !defaultKeys.has(k));

  if (missing.length > 0) {
    hasErrors = true;
    console.warn(`\n⚠ ${locale}: ${missing.length} missing key(s) (present in ${DEFAULT_LOCALE} but not ${locale}):`);
    missing.forEach(k => console.warn(`  - ${k}`));
  }

  if (extra.length > 0) {
    hasErrors = true;
    console.warn(`\n⚠ ${locale}: ${extra.length} extra key(s) (present in ${locale} but not ${DEFAULT_LOCALE}):`);
    extra.forEach(k => console.warn(`  - ${k}`));
  }

  if (missing.length === 0 && extra.length === 0) {
    console.log(`✓ ${locale}: all keys match ${DEFAULT_LOCALE}`);
  }
}

if (hasErrors && strict) {
  console.error('\nTranslation key mismatch detected (--strict mode). Exiting with error.');
  process.exit(1);
}

if (!hasErrors) {
  console.log('\nAll translation files have matching keys.');
}
