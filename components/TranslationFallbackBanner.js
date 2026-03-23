import { useTranslations } from 'next-intl';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function TranslationFallbackBanner() {
  const t = useTranslations('translationFallback');

  return (
    <Alert variant="warning" className="mb-6">
      <AlertDescription>
        <p>{t('message')}</p>
        <p className="mt-1">{t('suggest')}</p>
      </AlertDescription>
    </Alert>
  );
}
