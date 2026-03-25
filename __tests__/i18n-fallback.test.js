import { describe, it, expect } from 'vitest';
import { isShowingTranslationFallback } from '../lib/i18n-fallback';

describe('isShowingTranslationFallback', () => {
  it('does not show fallback for English locale', () => {
    expect(isShowingTranslationFallback('en', 'default')).toBe(false);
    expect(isShowingTranslationFallback('en', 'es')).toBe(false);
    expect(isShowingTranslationFallback('en', undefined)).toBe(false);
  });

  it('does not show fallback when localized content exists', () => {
    expect(isShowingTranslationFallback('es', 'es')).toBe(false);
  });

  it('shows fallback when Spanish route uses default or English content', () => {
    expect(isShowingTranslationFallback('es', 'default')).toBe(true);
    expect(isShowingTranslationFallback('es', undefined)).toBe(true);
  });

  it('shows fallback when Spanish route explicitly loads English content', () => {
    expect(isShowingTranslationFallback('es', 'en')).toBe(true);
  });
});
