/** Replaces Keystatic route handler when BUILD_MODE=static (`output: 'export'` requires literal `force-static`). */

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
