// i18next configuration for ActivistChecklist.org
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Supported languages configuration
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  // Add more languages here as needed
  // { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  // { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
];

export const DEFAULT_LANGUAGE = 'en';

// Load translation files dynamically
const loadTranslations = () => {
  const resources = {};
  
  SUPPORTED_LANGUAGES.forEach(lang => {
    try {
      // Import translation files statically
      const translations = require(`../public/locales/${lang.code}/common.json`);
      resources[lang.code] = {
        translation: translations
      };
    } catch (error) {
      console.warn(`Failed to load translations for ${lang.code}:`, error);
      // Fallback to empty object
      resources[lang.code] = {
        translation: {}
      };
    }
  });
  
  return resources;
};

// Translation resources
const resources = loadTranslations();

// Custom language detector that checks URL path first
const customLanguageDetector = {
  name: 'urlPathDetector',
  lookup() {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      console.log('URL Path Detector - checking path:', path);
      // Check for any supported language prefix
      for (const lang of SUPPORTED_LANGUAGES) {
        if (lang.code !== DEFAULT_LANGUAGE && path.startsWith(`/${lang.code}/`)) {
          console.log('URL Path Detector - found language:', lang.code);
          return lang.code;
        }
      }
      console.log('URL Path Detector - using default language:', DEFAULT_LANGUAGE);
    }
    return DEFAULT_LANGUAGE; // Return default instead of undefined
  }
};

// URL is the single source of truth for language - no browser detection

// Create detector instance and register custom detector before init
const languageDetector = new LanguageDetector();
languageDetector.addDetector(customLanguageDetector);

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: DEFAULT_LANGUAGE,
    debug: process.env.NODE_ENV === 'development',

    detection: {
      order: ['urlPathDetector'],
      caches: ['localStorage'],
    },

    interpolation: {
      escapeValue: false, // React already escapes values
    },
  });

export default i18n;