export const SUPPORTED_LOCALES = ['en', 'es'];
export const DEFAULT_LOCALE = 'en';
export const LANGUAGE_NAMES = {
  en: 'English',
  es: 'Español',
};

export const ACTIVE_LOCALES = (() => {
  const fromEnv = process.env.NEXT_PUBLIC_ACTIVE_LOCALES;
  if (fromEnv) {
    const parsed = fromEnv
      .split(',')
      .map((locale) => locale.trim())
      .filter(Boolean)
      .filter((locale) => SUPPORTED_LOCALES.includes(locale));
    if (parsed.length > 0) return parsed;
  }

  return process.env.NODE_ENV === 'development' ? SUPPORTED_LOCALES : [DEFAULT_LOCALE];
})();
