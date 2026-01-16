// Browser Language Detection Banner - Following UX best practices
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/useLanguage';

export function LanguageDetectionBanner() {
  const { t } = useTranslation();
  const { currentLanguage, switchLanguage, supportedLanguages, defaultLanguage } = useLanguage();
  const [showBanner, setShowBanner] = useState(false);
  const [hasShownBanner, setHasShownBanner] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Ensure this only runs on client side to prevent hydration issues
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    // Only run on client side
    if (!isClient) return;

    // Check if user has already dismissed the banner
    const dismissed = localStorage.getItem('language-banner-dismissed');
    if (dismissed) return;

    // Check if user is on default language but browser prefers a different supported language
    const browserLang = navigator.language.split('-')[0];
    const preferredLang = supportedLanguages.find(lang => 
      lang.code === browserLang && lang.code !== defaultLanguage
    );
    
    // Show banner if:
    // 1. Browser language is supported and not default
    // 2. Current site language is default (URL doesn't have language prefix)
    // 3. Banner hasn't been shown yet
    if (preferredLang && currentLanguage === defaultLanguage && !hasShownBanner) {
      setShowBanner(true);
      setHasShownBanner(true);
    }
  }, [currentLanguage, hasShownBanner, isClient, supportedLanguages, defaultLanguage]);

  const switchToPreferredLanguage = () => {
    // Find the preferred language from browser
    const browserLang = navigator.language.split('-')[0];
    const preferredLang = supportedLanguages.find(lang => 
      lang.code === browserLang && lang.code !== defaultLanguage
    );
    
    if (!preferredLang) return;
    
    // Switch to preferred language using unified hook
    switchLanguage(preferredLang.code);
    
    // Hide banner
    setShowBanner(false);
  };

  const dismissBanner = () => {
    setShowBanner(false);
    // Remember that user dismissed the banner
    localStorage.setItem('language-banner-dismissed', 'true');
  };

  // Don't render anything until client-side hydration is complete
  if (!isClient || !showBanner) return null;

  // Get the preferred language for display
  const browserLang = navigator.language.split('-')[0];
  const preferredLang = supportedLanguages.find(lang => 
    lang.code === browserLang && lang.code !== defaultLanguage
  );

  if (!preferredLang) return null;

  // Get banner text using translation files
  const bannerText = {
    message: t('languageDetection.message', { language: preferredLang.nativeName }),
    question: t('languageDetection.question', { language: preferredLang.nativeName }),
    button: t('languageDetection.switchButton', { language: preferredLang.nativeName })
  };

  return (
    <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Globe className="h-5 w-5 text-blue-600" />
          <div className="text-sm text-blue-800">
            <span className="font-medium">{bannerText.message}</span>
            <span className="ml-1">{bannerText.question}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={switchToPreferredLanguage}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {bannerText.button}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={dismissBanner}
            className="text-blue-600 hover:text-blue-700 hover:bg-blue-100"
            aria-label="Dismiss language suggestion"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default LanguageDetectionBanner;