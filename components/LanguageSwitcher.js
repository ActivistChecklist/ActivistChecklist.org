'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { LOCALES, DEFAULT_LOCALE } from '@/lib/i18n-config';
import { isTranslationUiVisible } from '@/utils/core';

/**
 * Build the URL for switching to a different locale.
 * English (default) = no prefix. Other locales = /locale/... prefix.
 */
function getLocaleUrl(pathname, newLocale) {
  const currentIsDefault = !pathname.startsWith('/es');

  if (newLocale === DEFAULT_LOCALE) {
    return pathname.replace(/^\/[a-z]{2}(\/|$)/, (_, slash) => slash || '/') || '/';
  }
  if (currentIsDefault) {
    return `/${newLocale}${pathname}`;
  }
  return pathname.replace(/^\/[a-z]{2}(\/|$)/, `/${newLocale}$1`);
}

export default function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations();

  const availableLocales = Object.keys(LOCALES);
  if (!isTranslationUiVisible || availableLocales.length <= 1) return null;

  const switchLocale = (newLocale) => {
    router.push(getLocaleUrl(pathname, newLocale));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('languageSwitcher.ariaLabel')}>
          <Globe className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {availableLocales.map((l) => (
          <DropdownMenuItem
            key={l}
            onClick={() => switchLocale(l)}
            className={l === locale ? 'font-bold' : ''}
          >
            {LOCALES[l]?.name || l}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
