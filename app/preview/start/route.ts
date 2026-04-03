import { cookies, draftMode } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';

/**
 * `new URL(req.url)` requires an absolute URL; in some runtimes `req.url` is path-only.
 */
function parseRequestUrl(req: Request): URL {
  const raw = req.url;
  try {
    if (/^https?:\/\//i.test(raw)) {
      return new URL(raw);
    }
  } catch {
    // fall through
  }
  const host = req.headers.get('host') || 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  return new URL(raw, `${proto}://${host}`);
}

/**
 * Keystatic substitutes `{branch}` raw (e.g. `content/edits`). Unencoded `/` in query values
 * can break clients; rebuilding `search` with URLSearchParams encodes as `%2F`. One redirect
 * fixes Admin-generated links; second request compares equal and continues.
 */
function canonicalPreviewSearch(origin: string, branch: string, to: string): string {
  const u = new URL('/preview/start', origin);
  u.searchParams.set('branch', branch);
  u.searchParams.set('to', to);
  return u.search;
}

/**
 * Only allow same-origin relative paths (blocks open redirects via `to`).
 */
function safeSameOriginRedirectTarget(to: string, origin: string): string | null {
  const raw = to.trim();
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) {
    return null;
  }
  let target: URL;
  try {
    target = new URL(raw, origin);
  } catch {
    return null;
  }
  const base = new URL(origin);
  if (target.origin !== base.origin) {
    return null;
  }
  if (target.pathname.includes('..')) {
    return null;
  }
  return target.pathname + target.search + target.hash;
}

/**
 * Enables draft mode + ks-branch cookie, then redirects to `to` (site path).
 * Used by Keystatic Admin preview links (see previewUrl on collections).
 */
export async function GET(req: Request) {
  const url = parseRequestUrl(req);
  const branch = url.searchParams.get('branch');
  const to = url.searchParams.get('to');

  if (!branch || !to) {
    return new Response('Missing branch or to params', { status: 400 });
  }

  const canonSearch = canonicalPreviewSearch(url.origin, branch, to);
  if (url.search !== canonSearch) {
    const fix = new URL(url.href);
    fix.search = canonSearch;
    return NextResponse.redirect(fix);
  }

  const safePath = safeSameOriginRedirectTarget(to, url.origin);
  if (!safePath) {
    return new Response('Invalid to param (must be a same-origin path)', { status: 400 });
  }

  (await draftMode()).enable();
  (await cookies()).set('ks-branch', branch, {
    path: '/',
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  });

  // `redirect()` from next/navigation is the correct approach in Next.js 15: Next.js catches the
  // thrown NEXT_REDIRECT and applies all next/headers cookie mutations (draftMode + ks-branch)
  // onto the outgoing redirect response. Returning a manually-constructed NextResponse.redirect()
  // does NOT reliably merge those mutations in Next.js 15.
  redirect(safePath);
}
