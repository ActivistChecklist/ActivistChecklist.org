import { describe, it, expect } from 'vitest';
import { SUPPORTED_LOCALES, ACTIVE_LOCALES, DEFAULT_LOCALE, LANGUAGE_NAMES } from '../lib/i18n-config';

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

  it('active locales are a non-empty subset including default locale', () => {
    expect(ACTIVE_LOCALES.length).toBeGreaterThan(0);
    expect(ACTIVE_LOCALES).toContain(DEFAULT_LOCALE);
    for (const locale of ACTIVE_LOCALES) {
      expect(SUPPORTED_LOCALES).toContain(locale);
    }
  });
});
