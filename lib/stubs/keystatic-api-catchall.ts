/** Replaces Keystatic route handler when BUILD_MODE=static (static HTML export has no API). */

export const dynamic = 'force-static';

export function generateStaticParams() {
  return [{ params: ['_'] }];
}

export function GET() {
  return new Response('Not found', { status: 404 });
}

export function POST() {
  return new Response('Not found', { status: 404 });
}
