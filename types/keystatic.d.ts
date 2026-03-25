declare module '@keystatic/next/route-handler' {
  import { NextRequest, NextResponse } from 'next/server';
  export function makeRouteHandler(opts: { config: unknown }): {
    GET: (req: NextRequest) => Promise<NextResponse>;
    POST: (req: NextRequest) => Promise<NextResponse>;
  };
}

declare module '@keystatic/next/ui/app' {
  export function makePage(config: unknown): () => JSX.Element;
}
