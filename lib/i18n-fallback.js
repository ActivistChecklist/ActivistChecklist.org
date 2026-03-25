/**
 * True when the UI locale expects localized content but the document is not
 * in that locale (e.g. Spanish route showing English MDX).
 */
export function isShowingTranslationFallback(locale, contentLocale) {
  const normalized = contentLocale || 'default';
  return locale !== 'en' && normalized !== locale;
}
