/** Replaces checklist preview API when BUILD_MODE=static (static HTML export has no API). */

export const dynamic = 'force-static';

export function GET() {
  return new Response('Not found', { status: 404 });
}
