import { describe, it, expect } from 'vitest';
import { getNewsItem, getAllNewsItems } from '../lib/content.js';

describe('news content (flat content/en/news/*.mdx)', () => {
  it('getNewsItem loads a known article by slug', () => {
    const item = getNewsItem('dc-police-surveillance', 'en');
    expect(item).not.toBeNull();
    expect(item.frontmatter.title).toBeTruthy();
    expect(item.slug).toBe('dc-police-surveillance');
  });

  it('getAllNewsItems returns many items sorted newest-first', () => {
    const items = getAllNewsItems('en');
    expect(items.length).toBeGreaterThan(100);
    const dates = items.map((i) => new Date(i.frontmatter.date || '1970-01-01').getTime());
    const sorted = [...dates].sort((a, b) => b - a);
    expect(dates).toEqual(sorted);
  });
});
