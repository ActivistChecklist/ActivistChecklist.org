// Unified language management hook
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '@/lib/i18n';

export function useLanguage() {
  const router = useRouter();
  const { i18n } = useTranslation();

  // Get current language from URL (single source of truth)
  const getCurrentLanguage = () => {
    const path = router.asPath;
    for (const lang of SUPPORTED_LANGUAGES) {
      if (lang.code !== DEFAULT_LANGUAGE && path.startsWith(`/${lang.code}/`)) {
        return lang.code;
      }
    }
    return DEFAULT_LANGUAGE;
  };

  // Switch language by updating URL
  const switchLanguage = (newLanguage) => {
    const currentPath = router.asPath;
    const currentLang = getCurrentLanguage();
    
    let newPath;
    
    if (newLanguage === DEFAULT_LANGUAGE) {
      // Switch to default language - remove language prefix
      if (currentLang !== DEFAULT_LANGUAGE) {
        newPath = currentPath.replace(`/${currentLang}`, '');
      } else {
        newPath = currentPath;
      }
    } else {
      // Switch to non-default language - add/replace language prefix
      if (currentLang !== DEFAULT_LANGUAGE) {
        // Replace existing language prefix
        newPath = currentPath.replace(`/${currentLang}`, `/${newLanguage}`);
      } else {
        // Add new language prefix
        newPath = `/${newLanguage}${currentPath}`;
      }
    }
    
    // Navigate to new path - this will trigger i18next to detect language from URL
    router.push(newPath);
  };

  // Get language info
  const currentLanguage = getCurrentLanguage();
  const currentLangInfo = SUPPORTED_LANGUAGES.find(lang => lang.code === currentLanguage) || SUPPORTED_LANGUAGES[0];

  // Sync i18next with URL language changes - run immediately on mount
  useEffect(() => {
    if (i18n.language !== currentLanguage) {
      i18n.changeLanguage(currentLanguage);
    }
  }, [currentLanguage, i18n]);

  // Also sync immediately on mount (not just on changes)
  useEffect(() => {
    if (i18n.language !== currentLanguage) {
      i18n.changeLanguage(currentLanguage);
    }
  }, []); // Empty dependency array = run once on mount

  return {
    currentLanguage,
    currentLangInfo,
    switchLanguage,
    supportedLanguages: SUPPORTED_LANGUAGES,
    defaultLanguage: DEFAULT_LANGUAGE
  };
}
