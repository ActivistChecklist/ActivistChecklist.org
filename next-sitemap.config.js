/** @type {import('next-sitemap').IConfig} */
/**
 * Static export writes locale-prefixed folders under `out/` (`/en/`, `/es/`). Public URLs use
 * next-intl `localePrefix: 'as-needed'`: English has no `/en/` prefix; Spanish stays `/es/...`.
 * postbuild mirrors `out/en/*` to the site root after sitemap generation; the sitemap should
 * list canonical public URLs, not internal `/en/` paths.
 */

/** Dedupe after canonicalization (e.g. if both `/en/foo/` and `/foo/` ever appeared). */
const canonicalLocEmitted = new Set();

module.exports = {
  siteUrl: 'https://activistchecklist.org',
  generateRobotsTxt: false,
  outDir: 'out',
  generateIndexSitemap: false,
  output: 'export',
  trailingSlash: true,
  exclude: [
    '/api/*',
    '/keystatic*',
    '/_next/*',
    '/404*',
  ],
  transform: async (config, path) => {
    /** @type {string} */
    let loc = path.startsWith('/') ? path : `/${path}`;

    // Canonical English URLs (strip static-export `/en/` prefix only).
    if (loc === '/en' || loc === '/en/') {
      loc = '/';
    } else if (loc.startsWith('/en/')) {
      const rest = loc.slice(4);
      loc = rest ? `/${rest}` : '/';
    }

    const dedupeKey = loc.endsWith('/') || loc === '/' ? loc : `${loc}/`;
    if (canonicalLocEmitted.has(dedupeKey)) {
      return null;
    }
    canonicalLocEmitted.add(dedupeKey);

    return {
      loc,
      lastmod: config.autoLastmod ? new Date().toISOString() : undefined,
      changefreq: config.changefreq,
      priority: config.priority,
      alternateRefs: config.alternateRefs ?? [],
      trailingSlash: config.trailingSlash,
    };
  },
};
