/**
 * Extra sitemap fields for SEO: hreflang alternates (matches app alternate metadata)
 * and coarse priority / changefreq hints.
 *
 * Spanish URLs / `hreflang="es"` are omitted when translation UI is hidden — same rule as
 * `isTranslationUiVisible` in utils/core.js (`NEXT_PUBLIC_SHOW_TRANSLATION_UI`).
 */

const SITE_URL = 'https://activistchecklist.org'.replace(/\/$/, '');

/**
 * Mirrors utils/core.js — language switcher is off in production unless env is set.
 * @returns {boolean}
 */
function isTranslationUiVisible() {
  return (
    process.env.NODE_ENV !== 'production' ||
    process.env.NEXT_PUBLIC_SHOW_TRANSLATION_UI === 'true'
  );
}

/**
 * @param {string} dedupeKey — trailing-slash path, may be `/es/...` or English canonical
 * @returns {string} English canonical path with slashes, e.g. `/signal/` or `/`
 */
function normalizeToEnCanonicalPath(dedupeKey) {
  let p = dedupeKey.startsWith('/') ? dedupeKey : `/${dedupeKey}`;
  if (!p.endsWith('/')) p = `${p}/`;
  if (p === '/en/' || p === '/en') return '/';
  if (p.startsWith('/en/')) {
    const rest = p.slice(4);
    return rest ? `/${rest.replace(/\/$/, '')}/` : '/';
  }
  if (p.startsWith('/es/')) {
    const rest = p.slice(4);
    return rest ? `/${rest.replace(/\/$/, '')}/` : '/';
  }
  return p;
}

/**
 * Google-supported hreflang cluster for default-locale + Spanish routes.
 * @param {string} dedupeKey
 * @returns {Array<{ href: string, hreflang: string, hrefIsAbsolute: boolean }>}
 */
function buildHreflangAlternateRefs(dedupeKey) {
  const enPath = normalizeToEnCanonicalPath(dedupeKey);
  const enUrl =
    enPath === '/'
      ? `${SITE_URL}/`
      : `${SITE_URL}${enPath.endsWith('/') ? enPath : `${enPath}/`}`;

  const base = [
    { href: enUrl, hreflang: 'en', hrefIsAbsolute: true },
    { href: enUrl, hreflang: 'x-default', hrefIsAbsolute: true },
  ];

  if (!isTranslationUiVisible()) {
    return base;
  }

  const esUrl =
    enPath === '/'
      ? `${SITE_URL}/es/`
      : `${SITE_URL}/es${enPath.replace(/\/$/, '')}/`;

  return [
    { href: enUrl, hreflang: 'en', hrefIsAbsolute: true },
    { href: esUrl, hreflang: 'es', hrefIsAbsolute: true },
    { href: enUrl, hreflang: 'x-default', hrefIsAbsolute: true },
  ];
}

/**
 * @param {string} dedupeKey
 * @returns {{ priority: number, changefreq: import('next-sitemap').IConfig['changefreq'] }}
 */
function seoPriorityAndChangefreq(dedupeKey) {
  const enPath = normalizeToEnCanonicalPath(dedupeKey);

  if (enPath === '/') {
    return { priority: 1, changefreq: 'weekly' };
  }

  const hubPaths = ['/checklists/', '/news/', '/changelog/', '/contact/'];
  if (hubPaths.includes(enPath)) {
    return { priority: 0.85, changefreq: 'weekly' };
  }

  return { priority: 0.8, changefreq: 'monthly' };
}

module.exports = {
  SITE_URL,
  normalizeToEnCanonicalPath,
  isTranslationUiVisible,
  buildHreflangAlternateRefs,
  seoPriorityAndChangefreq,
};
