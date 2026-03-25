import { NextRequest, NextResponse } from 'next/server';

// Both exports needed for output: 'export' compatibility:
// - force-static satisfies isStaticGenEnabled check in app-route module
// - generateStaticParams returning [] satisfies build/index.js static export check
export const dynamic = 'force-static';
export function generateStaticParams() {
  return [{ params: ['_placeholder'] }];
}

let handlers: { GET: (req: NextRequest) => Promise<NextResponse>; POST: (req: NextRequest) => Promise<NextResponse> } | null = null;

async function getHandlers() {
  if (!handlers) {
    const { makeRouteHandler } = await import('@keystatic/next/route-handler');
    const { default: keystaticConfig } = await import('../../../../keystatic.config');
    handlers = makeRouteHandler({ config: keystaticConfig });
  }
  return handlers;
}

export async function GET(request: NextRequest) {
  const h = await getHandlers();
  return h.GET(request);
}

export async function POST(request: NextRequest) {
  const h = await getHandlers();
  return h.POST(request);
}
