/**
 * Keystatic Admin path for editing a collection entry on a branch.
 * Example: /keystatic/branch/content%2Fedits/collection/guides/item/doxxing/
 *
 * @param {string} branch — e.g. content/edits
 * @param {string} collectionKey — keystatic.config collection key (guides, pages, checklistItems, …)
 * @param {string} itemSlug — entry slug (may contain slashes for nested filenames)
 */
export function keystaticItemEditPath(branch, collectionKey, itemSlug) {
  const b = encodeURIComponent(branch);
  const slug = encodeURIComponent(itemSlug);
  return `/keystatic/branch/${b}/collection/${collectionKey}/item/${slug}/`;
}
