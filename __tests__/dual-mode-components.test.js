/**
 * Tests for dual-mode component prop handling introduced in Phase 2.
 *
 * These tests cover the pure JS logic for resolving props in both
 * Storyblok mode (blok objects) and MDX mode (plain props/strings).
 * Full React rendering tests require jsdom setup (deferred).
 */
import { describe, it, expect } from 'vitest';

// ─── ButtonEmbed URL resolution logic ────────────────────────
// Mirrors getRawHref() in components/ButtonEmbed.js

function getRawHref(url) {
  if (typeof url === 'string') return url || '#';
  if (url?.linktype === 'url') {
    return url?.url || url?.cached_url || '#';
  }
  const path = url?.cached_url || url?.url || '#';
  if (path !== '#' && !path.startsWith('/') && !path.startsWith('http')) {
    return `/${path}`;
  }
  return path;
}

describe('ButtonEmbed URL resolution (dual-mode)', () => {
  it('MDX mode: returns plain string URL as-is', () => {
    expect(getRawHref('https://example.com')).toBe('https://example.com');
  });

  it('MDX mode: returns internal path as-is', () => {
    expect(getRawHref('/guides/protest')).toBe('/guides/protest');
  });

  it('MDX mode: returns # for empty string', () => {
    expect(getRawHref('')).toBe('#');
  });

  it('Storyblok URL link: uses url field', () => {
    expect(getRawHref({ linktype: 'url', url: 'https://signal.org', cached_url: '' }))
      .toBe('https://signal.org');
  });

  it('Storyblok URL link: falls back to cached_url if url is empty', () => {
    expect(getRawHref({ linktype: 'url', url: '', cached_url: 'https://fallback.org' }))
      .toBe('https://fallback.org');
  });

  it('Storyblok story link: adds leading slash if missing', () => {
    expect(getRawHref({ cached_url: 'guides/protest' })).toBe('/guides/protest');
  });

  it('Storyblok story link: keeps leading slash if already present', () => {
    expect(getRawHref({ cached_url: '/guides/protest' })).toBe('/guides/protest');
  });

  it('Storyblok story link: does not add slash to http URLs', () => {
    expect(getRawHref({ cached_url: 'https://example.com' })).toBe('https://example.com');
  });

  it('returns # when url is undefined', () => {
    expect(getRawHref(undefined)).toBe('#');
  });
});

// ─── RelatedGuides slug normalization ────────────────────────
// Mirrors the guides mapping in components/RelatedGuides.js

function normalizeGuides(guidesProp) {
  return guidesProp.map(slug => slug.startsWith('/') ? slug : `/${slug}`);
}

describe('RelatedGuides slug normalization (MDX mode)', () => {
  it('adds leading slash to bare slugs', () => {
    expect(normalizeGuides(['essentials', 'protest'])).toEqual(['/essentials', '/protest']);
  });

  it('preserves slugs that already have a leading slash', () => {
    expect(normalizeGuides(['/essentials', '/protest'])).toEqual(['/essentials', '/protest']);
  });

  it('handles a mix of prefixed and bare slugs', () => {
    expect(normalizeGuides(['/essentials', 'protest'])).toEqual(['/essentials', '/protest']);
  });

  it('returns an empty array for an empty input', () => {
    expect(normalizeGuides([])).toEqual([]);
  });
});

// ─── ChecklistItem prop normalization ────────────────────────
// Mirrors the item* normalization at the top of ChecklistItem.js

function normalizeChecklistItemProps(blok, directProps) {
  const {
    slug: slugProp, title: titleProp, type: typeProp,
    why: whyProp, tools: toolsProp, stop: stopProp,
    titleBadges: titleBadgesProp,
  } = directProps ?? {};

  return {
    itemSlug: blok?.slug ?? slugProp,
    itemTitle: blok?.title ?? titleProp,
    itemType: blok?.type ?? typeProp,
    itemWhy: blok?.why ?? whyProp,
    itemTools: blok?.tools ?? toolsProp,
    itemStop: blok?.stop ?? stopProp,
    itemTitleBadges: blok?.title_badges ?? titleBadgesProp ?? [],
  };
}

describe('ChecklistItem prop normalization (dual-mode)', () => {
  it('Storyblok mode: reads all values from blok', () => {
    const blok = {
      slug: 'use-signal',
      title: 'Use Signal',
      type: 'action',
      why: 'Encrypted messaging',
      tools: 'Signal app',
      stop: 'SMS',
      title_badges: ['important'],
    };
    const result = normalizeChecklistItemProps(blok, {});
    expect(result.itemSlug).toBe('use-signal');
    expect(result.itemTitle).toBe('Use Signal');
    expect(result.itemType).toBe('action');
    expect(result.itemWhy).toBe('Encrypted messaging');
    expect(result.itemTools).toBe('Signal app');
    expect(result.itemStop).toBe('SMS');
    expect(result.itemTitleBadges).toEqual(['important']);
  });

  it('MDX mode: reads all values from direct props', () => {
    const result = normalizeChecklistItemProps(undefined, {
      slug: 'use-signal',
      title: 'Use Signal',
      type: 'action',
      why: 'Encrypted messaging',
      tools: 'Signal app',
      stop: 'SMS',
      titleBadges: ['important'],
    });
    expect(result.itemSlug).toBe('use-signal');
    expect(result.itemTitle).toBe('Use Signal');
    expect(result.itemTitleBadges).toEqual(['important']);
  });

  it('MDX mode: titleBadges defaults to [] when not provided', () => {
    const result = normalizeChecklistItemProps(undefined, { slug: 'test' });
    expect(result.itemTitleBadges).toEqual([]);
  });

  it('blok values take precedence over direct props when both provided', () => {
    const blok = { slug: 'from-blok', title: 'Blok Title' };
    const result = normalizeChecklistItemProps(blok, { slug: 'from-props', title: 'Props Title' });
    expect(result.itemSlug).toBe('from-blok');
    expect(result.itemTitle).toBe('Blok Title');
  });

  it('info type is correctly resolved', () => {
    const result = normalizeChecklistItemProps(undefined, { slug: 'test', type: 'info' });
    expect(result.itemType).toBe('info');
  });
});
