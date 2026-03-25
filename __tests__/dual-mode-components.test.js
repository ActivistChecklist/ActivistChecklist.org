/**
 * Tests for MDX content embed helpers (e.g. button URL as string).
 */
import { describe, it, expect } from 'vitest';

function getButtonHref(url) {
  return (typeof url === 'string' ? url : null) || '#';
}

describe('ButtonEmbed href (string URLs only)', () => {
  it('returns plain string URL as-is', () => {
    expect(getButtonHref('https://example.com')).toBe('https://example.com');
  });

  it('returns internal path as-is', () => {
    expect(getButtonHref('/guides/protest')).toBe('/guides/protest');
  });

  it('returns # for empty string', () => {
    expect(getButtonHref('')).toBe('#');
  });

  it('returns # when url is not a string', () => {
    expect(getButtonHref(undefined)).toBe('#');
    expect(getButtonHref({ url: 'https://x.com' })).toBe('#');
  });
});
