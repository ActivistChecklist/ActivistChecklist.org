import { getRequestConfig } from 'next-intl/server';

// Determine locale from the request URL since we use route groups
// (English at /, Spanish at /es/) instead of [locale] segments
export default getRequestConfig(async ({ requestLocale }) => {
  // requestLocale is set by Next.js when using next-intl middleware/plugin
  // Fall back to parsing the URL if not available
  const locale = (await requestLocale) || 'en';
  const resolvedLocale = ['en', 'es'].includes(locale) ? locale : 'en';

  return {
    locale: resolvedLocale,
    messages: (await import(`@/messages/${resolvedLocale}.json`)).default,
  };
});
