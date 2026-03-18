import { useRouter } from 'next/router';
import { useTranslations } from 'next-intl';
import { Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { LANGUAGE_NAMES } from '@/lib/i18n-config';

export default function LanguageSwitcher() {
  const router = useRouter();
  const { locale, locales, asPath } = router;
  const t = useTranslations();

  const switchLocale = (newLocale) => {
    router.push(asPath, asPath, { locale: newLocale });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('languageSwitcher.ariaLabel')}>
          <Globe className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((l) => (
          <DropdownMenuItem
            key={l}
            onClick={() => switchLocale(l)}
            className={l === locale ? 'font-bold' : ''}
          >
            {LANGUAGE_NAMES[l] || l}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
