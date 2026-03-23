import { describe, it, expect } from 'vitest';
import { isFallbackStoryContent } from '../lib/i18n-fallback';

describe('isFallbackStoryContent', () => {
  it('does not show fallback for default English locale', () => {
    expect(isFallbackStoryContent('en', 'default')).toBe(false);
    expect(isFallbackStoryContent('en', 'es')).toBe(false);
    expect(isFallbackStoryContent('en', undefined)).toBe(false);
  });

  it('does not show fallback when localized story exists', () => {
    expect(isFallbackStoryContent('es', 'es')).toBe(false);
  });

  it('shows fallback when Storyblok returns default language content', () => {
    expect(isFallbackStoryContent('es', 'default')).toBe(true);
    expect(isFallbackStoryContent('es', undefined)).toBe(true);
  });

  it('shows fallback when Storyblok returns a different non-requested locale', () => {
    expect(isFallbackStoryContent('es', 'en')).toBe(true);
  });
});
