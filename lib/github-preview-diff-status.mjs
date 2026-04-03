import 'server-only';

import { DEFAULT_LOCALE } from './i18n-config.mjs';

function getRepo() {
  const owner = process.env.KEYSTATIC_GITHUB_REPO_OWNER || 'ActivistChecklist';
  const name = process.env.KEYSTATIC_GITHUB_REPO_NAME || 'ActivistChecklist';
  return { owner, name };
}

function authHeaders() {
  const token =
    process.env.KEYSTATIC_GITHUB_TOKEN || process.env.GITHUB_TOKEN || '';
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

let cachedDefaultBranch;

/**
 * @returns {Promise<string>}
 */
async function getDefaultBranchName() {
  if (cachedDefaultBranch) return cachedDefaultBranch;
  const { owner, name } = getRepo();
  const res = await fetch(`https://api.github.com/repos/${owner}/${name}`, {
    headers: authHeaders(),
    next: { revalidate: 300 }
  });
  if (!res.ok) {
    throw new Error(`GitHub repo ${res.status}`);
  }
  const data = await res.json();
  cachedDefaultBranch = data.default_branch || 'main';
  return cachedDefaultBranch;
}

/**
 * Blob SHA for a file at ref, or null if missing / not a file.
 * @param {string} ref
 * @param {string} repoPath — e.g. content/en/guides/foo.mdx
 * @returns {Promise<string|null>}
 */
async function fetchFileSha(ref, repoPath) {
  const { owner, name } = getRepo();
  const encoded = repoPath
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  const url = `https://api.github.com/repos/${owner}/${name}/contents/${encoded}?ref=${encodeURIComponent(ref)}`;
  const res = await fetch(url, {
    headers: authHeaders(),
    next: { revalidate: 0 }
  });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    return null;
  }
  const data = await res.json();
  if (!data || data.type !== 'file' || typeof data.sha !== 'string') {
    return null;
  }
  return data.sha;
}

/**
 * SHA for this MDX on ref, with same locale fallback as preview (primary locale, then en).
 * @param {string} ref
 * @param {string} locale
 * @param {string} relativePath — guides/foo.mdx
 * @returns {Promise<{ sha: string | null, resolvedPath: string }>}
 */
async function fetchFileShaWithLocaleFallback(ref, locale, relativePath) {
  const primary = `content/${locale}/${relativePath}`;
  let sha = await fetchFileSha(ref, primary);
  let resolvedPath = primary;
  if (!sha && locale !== DEFAULT_LOCALE) {
    const fallback = `content/${DEFAULT_LOCALE}/${relativePath}`;
    sha = await fetchFileSha(ref, fallback);
    resolvedPath = fallback;
  }
  return { sha, resolvedPath };
}

/**
 * Whether the file you’re previewing differs from the same path on the repo default branch.
 *
 * @returns {Promise<'changed' | 'unchanged' | 'new' | 'unknown'>}
 */
export async function getPreviewVsDefaultFileStatus(previewRef, locale, relativePath) {
  if (!previewRef || !relativePath) return 'unknown';

  let defaultBranch;
  try {
    defaultBranch = await getDefaultBranchName();
  } catch {
    return 'unknown';
  }

  let preview;
  let base;
  try {
    [preview, base] = await Promise.all([
      fetchFileShaWithLocaleFallback(previewRef, locale, relativePath),
      fetchFileShaWithLocaleFallback(defaultBranch, locale, relativePath)
    ]);
  } catch {
    return 'unknown';
  }

  if (!preview.sha) {
    return 'unknown';
  }

  if (!base.sha) {
    return 'new';
  }

  if (preview.sha === base.sha) {
    return 'unchanged';
  }

  return 'changed';
}
