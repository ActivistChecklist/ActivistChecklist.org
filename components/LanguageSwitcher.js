// Language Switcher Component - Following UX best practices
import { Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/useLanguage';

export function LanguageSwitcher() {
  const { currentLanguage, currentLangInfo, switchLanguage, supportedLanguages } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2 text-sm"
          aria-label="Select language"
        >
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">{currentLangInfo.nativeName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {supportedLanguages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => switchLanguage(language.code)}
            className={`py-2 ${currentLanguage === language.code ? 'bg-accent' : ''}`}
          >
            <span className="font-medium">{language.nativeName}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default LanguageSwitcher;