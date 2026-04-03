import { makeRouteHandler } from '@keystatic/next/route-handler';
import type { NextRequest } from 'next/server';
import keystaticConfig from '../../../../keystatic.config';
import { rewriteRequestUrlForPublicOrigin } from '@/lib/keystatic-public-request-url';

const { GET: keystaticGET, POST: keystaticPOST } = makeRouteHandler({
  config: keystaticConfig,
});

export async function GET(request: NextRequest) {
  return keystaticGET(rewriteRequestUrlForPublicOrigin(request));
}

export async function POST(request: NextRequest) {
  return keystaticPOST(rewriteRequestUrlForPublicOrigin(request));
}
