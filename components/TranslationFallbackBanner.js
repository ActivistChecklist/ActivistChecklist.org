import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';

export default function TranslationFallbackBanner() {
  const t = useTranslations('translationFallback');

  return (
    <div className="bg-yellow-50 dark:bg-yellow-950 border-l-4 border-yellow-400 p-4 mb-6" role="alert">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-yellow-800 dark:text-yellow-200">{t('message')}</p>
          <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">{t('suggest')}</p>
        </div>
      </div>
    </div>
  );
}
