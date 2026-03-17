import { useState, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function TranslationFallbackBanner() {
  const { t } = useTranslation();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 print:hidden">
      <div className="max-w-5xl mx-auto flex items-center gap-3">
        <Globe className="h-5 w-5 text-amber-600 flex-shrink-0" />
        <div className="text-sm text-amber-800">
          <span className="font-medium">{t('translationFallback.message')}</span>
          <span className="ml-1">{t('translationFallback.tip')}</span>
        </div>
      </div>
    </div>
  );
}
