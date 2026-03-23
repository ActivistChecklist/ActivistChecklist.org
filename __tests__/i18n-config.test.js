import { describe, it, expect } from 'vitest';
import { SUPPORTED_LOCALES, LANGUAGE_NAMES } from '../lib/i18n-config';

describe('i18n locale metadata', () => {
  it('has language name metadata for each supported locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(LANGUAGE_NAMES[locale], `Missing language name for ${locale}`).toBeDefined();
    }
  });

  it('uses expected locale display values', () => {
    expect(LANGUAGE_NAMES.en).toBe('English');
    expect(LANGUAGE_NAMES.es).toBe('Español');
  });
});
