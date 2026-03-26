/**
 * Build deep links into the Keystatic admin UI (same-origin as the app).
 *
 * URL shape (from Keystatic’s router):
 *   `/keystatic/collection/{collectionKey}/item/{slug}`
 * or with GitHub / branch:
 *   `/keystatic/branch/{branchName}/collection/{collectionKey}/item/{slug}`
 */

/** Must match `collections.checklistItems` in `keystatic.config.tsx`. */
export const KEYSTATIC_COLLECTION_CHECKLIST_ITEMS = 'checklistItems';

/**
 * @param {string} pathname — e.g. `window.location.pathname` while on `/keystatic/...`
 * @returns {string} `/keystatic` or `/keystatic/branch/{name}`
 */
export function getKeystaticAdminBasePath(pathname) {
  if (!pathname || typeof pathname !== 'string') {
    return '/keystatic';
  }
  const m = pathname.match(/^\/keystatic(\/branch\/[^/]+)?/);
  return m ? m[0] : '/keystatic';
}

/**
 * Path (no origin) to the editor for one collection entry.
 *
 * @param {string} collectionKey — config `collections` key, e.g. `KEYSTATIC_COLLECTION_CHECKLIST_ITEMS`
 * @param {string} itemSlug — entry slug / filename stem
 * @param {string} [pathname] — pass `window.location.pathname` in the browser; omit or empty for `'#'` (SSR / first paint)
 * @returns {string} path starting with `/keystatic`, or `'#'` when inputs are missing
 */
export function getKeystaticCollectionItemEditHref(collectionKey, itemSlug, pathname) {
  if (!collectionKey || !itemSlug) return '#';
  if (!pathname) return '#';
  const base = getKeystaticAdminBasePath(pathname);
  return `${base}/collection/${encodeURIComponent(collectionKey)}/item/${encodeURIComponent(itemSlug)}`;
}
