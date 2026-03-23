export function isFallbackStoryContent(locale, storyLang) {
  const normalizedStoryLang = storyLang || 'default';
  return locale !== 'en' && normalizedStoryLang !== locale;
}
