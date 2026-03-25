import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match all pathnames except internal Next.js paths, static files, and API routes
  matcher: ['/((?!api|_next|_vercel|keystatic|.*\\..*).*)'],
};
