import 'server-only';

import { cookies, draftMode } from 'next/headers';
import { cache } from 'react';

/**
 * When Next.js draft mode is on and Keystatic set the `ks-branch` cookie (see /preview/start),
 * returns that branch ref for GitHub-backed content reads. Otherwise null.
 * Deduplicated per request (React cache).
 */
export const getPreviewBranch = cache(async function getPreviewBranch() {
  try {
    const dm = await draftMode();
    if (!dm.isEnabled) {
      return null;
    }
  } catch {
    return null;
  }

  const store = await cookies();
  const branch = store.get('ks-branch')?.value ?? null;

  if (!branch) {
    return null;
  }
  return branch;
});
