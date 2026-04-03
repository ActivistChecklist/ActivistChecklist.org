/**
 * Keystatic's `state=close` OAuth callback returns HTML that only runs
 * `localStorage` + `window.close()` — looks blank in a full tab. Swap in a
 * minimal success page for manual visits, preserving Set-Cookie and Keystatic's
 * side effects.
 *
 * @param {import('next/server').NextRequest} request
 * @param {Response} response
 * @returns {Promise<Response>}
 */
export async function beautifyGithubOauthCallbackCloseIfNeeded(request, response) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (path !== '/api/keystatic/github/oauth/callback') {
    return response;
  }
  if (url.searchParams.get('state') !== 'close' || !response.ok) {
    return response;
  }

  const ct = response.headers.get('content-type') || '';
  if (!ct.includes('text/html')) {
    return response;
  }

  const text = await response.text();
  if (!text.includes('ks-refetch-installations') || !text.includes('window.close')) {
    return new Response(text, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GitHub connected</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 28rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; color: #1a1a1a; }
  a { color: #0969da; }
  h1 { font-size: 1.25rem; font-weight: 600; }
</style>
</head>
<body>
  <h1>GitHub connected</h1>
  <p>If this window opened from Keystatic, it may close on its own. If you opened this link directly or the tab stays open, use the link below.</p>
  <p><a href="/keystatic/">Open Keystatic admin</a></p>
  <script>
(function () {
  try { localStorage.setItem('ks-refetch-installations', 'true'); } catch (e) {}
  try { window.close(); } catch (e) {}
})();
  </script>
</body>
</html>`;

  const headers = new Headers();
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'content-length') return;
    headers.append(key, value);
  });
  headers.set('Content-Type', 'text/html; charset=utf-8');

  return new Response(html, { status: response.status, headers });
}
