import { NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { ThemeProvider } from '@/components/layout/ThemeProvider';
import '@/styles/globals.css';

export default async function EnglishLayout({ children }) {
  setRequestLocale('en');
  const messages = (await import('@/messages/en.json')).default;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-body antialiased">
        <NextIntlClientProvider locale="en" messages={messages}>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
