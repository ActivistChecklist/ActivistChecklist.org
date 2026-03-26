import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'es'],
  defaultLocale: 'en',
  // English has no URL prefix: / → /en internally
  // Spanish keeps /es/ prefix
  localePrefix: 'as-needed',
});
