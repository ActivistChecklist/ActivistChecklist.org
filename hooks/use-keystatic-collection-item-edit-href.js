'use client';

import { useEffect, useState } from 'react';
import { getKeystaticCollectionItemEditHref } from '@/lib/keystatic-admin-urls';

/**
 * Hydration-safe href for “open this entry in Keystatic” links inside the admin.
 * First render is `'#'`; after mount the real path is set from `window.location.pathname`.
 *
 * @param {string} collectionKey — e.g. `KEYSTATIC_COLLECTION_CHECKLIST_ITEMS`
 * @param {string | null | undefined} itemSlug
 */
export function useKeystaticCollectionItemEditHref(collectionKey, itemSlug) {
  const [href, setHref] = useState('#');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setHref(getKeystaticCollectionItemEditHref(collectionKey, itemSlug, window.location.pathname));
  }, [collectionKey, itemSlug]);

  return href;
}
