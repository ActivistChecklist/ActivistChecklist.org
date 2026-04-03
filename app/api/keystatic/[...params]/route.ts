import { makeRouteHandler } from '@keystatic/next/route-handler';
import type { NextRequest } from 'next/server';
import keystaticConfig, { showKeystaticUI } from '../../../../keystatic.config';
import { rewriteRequestUrlForPublicOrigin } from '@/lib/keystatic-public-request-url';

/** Server deployments (OAuth, GitHub API). Static export swaps this file for `lib/stubs/keystatic-api-catchall.ts`. */
export const dynamic = 'force-dynamic';

/** When admin is off, never call `makeRouteHandler` (matches Keystatic docs; avoids init when disabled). */
function notFoundRouteHandler() {
  return new Response(null, { status: 404 });
}

export const { GET, POST } = (() => {
  if (!showKeystaticUI) {
    return { GET: notFoundRouteHandler, POST: notFoundRouteHandler };
  }
  const { GET: keystaticGET, POST: keystaticPOST } = makeRouteHandler({
    config: keystaticConfig,
  });
  return {
    GET: (request: NextRequest) => keystaticGET(rewriteRequestUrlForPublicOrigin(request)),
    POST: (request: NextRequest) => keystaticPOST(rewriteRequestUrlForPublicOrigin(request)),
  };
})();
