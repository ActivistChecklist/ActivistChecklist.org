import { cookies, draftMode } from 'next/headers';

export async function POST(req: Request) {
  const url = new URL(req.url);
  const origin = req.headers.get('origin');
  if (origin && origin !== url.origin) {
    return new Response('Invalid origin', { status: 400 });
  }
  const referrer = req.headers.get('Referer');
  if (!referrer) {
    return new Response('Missing Referer', { status: 400 });
  }

  (await draftMode()).disable();
  (await cookies()).delete('ks-branch');

  return Response.redirect(referrer, 303);
}
