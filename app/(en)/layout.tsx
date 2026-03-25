import { NextIntlClientProvider } from 'next-intl';
import { ThemeProvider } from '@/components/layout/ThemeProvider';
import '@/styles/globals.css';

function handleIntlError(error) {
  if (process.env.NODE_ENV === 'development') {
    console.warn('[i18n]', error.message);
  }
}

export default async function EnglishLayout({ children }) {
  const messages = (await import('@/messages/en.json')).default;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-body antialiased">
        <NextIntlClientProvider locale="en" messages={messages} onError={handleIntlError}>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
