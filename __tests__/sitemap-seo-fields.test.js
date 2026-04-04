import { createRequire } from 'module';
import { afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const {
  normalizeToEnCanonicalPath,
  buildHreflangAlternateRefs,
  seoPriorityAndChangefreq,
} = require('../scripts/sitemap-seo-fields.cjs');

describe('normalizeToEnCanonicalPath', () => {
  it('normalizes Spanish paths to English canonical', () => {
    expect(normalizeToEnCanonicalPath('/es/signal/')).toBe('/signal/');
    expect(normalizeToEnCanonicalPath('/es/')).toBe('/');
  });

  it('leaves English paths unchanged', () => {
    expect(normalizeToEnCanonicalPath('/signal/')).toBe('/signal/');
    expect(normalizeToEnCanonicalPath('/')).toBe('/');
  });
});

describe('buildHreflangAlternateRefs', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('emits en, es, and x-default when translation UI would show (non-production or env set)', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const refs = buildHreflangAlternateRefs('/signal/');
    expect(refs).toHaveLength(3);
    expect(refs.find((r) => r.hreflang === 'en').href).toBe(
      'https://activistchecklist.org/signal/',
    );
    expect(refs.find((r) => r.hreflang === 'es').href).toBe(
      'https://activistchecklist.org/es/signal/',
    );
    expect(refs.find((r) => r.hreflang === 'x-default').href).toBe(
      'https://activistchecklist.org/signal/',
    );
  });

  it('omits es hreflang when production and NEXT_PUBLIC_SHOW_TRANSLATION_UI is not true', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SHOW_TRANSLATION_UI', '');
    const refs = buildHreflangAlternateRefs('/signal/');
    expect(refs).toHaveLength(2);
    expect(refs.some((r) => r.hreflang === 'es')).toBe(false);
    expect(refs.map((r) => r.hreflang).sort()).toEqual(['en', 'x-default']);
  });

  it('includes es in production when NEXT_PUBLIC_SHOW_TRANSLATION_UI=true', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SHOW_TRANSLATION_UI', 'true');
    const refs = buildHreflangAlternateRefs('/signal/');
    expect(refs.some((r) => r.hreflang === 'es')).toBe(true);
  });
});

describe('seoPriorityAndChangefreq', () => {
  it('gives higher priority to home', () => {
    expect(seoPriorityAndChangefreq('/')).toEqual({ priority: 1, changefreq: 'weekly' });
  });

  it('uses hub settings for listing pages', () => {
    expect(seoPriorityAndChangefreq('/news/')).toEqual({
      priority: 0.85,
      changefreq: 'weekly',
    });
  });
});
