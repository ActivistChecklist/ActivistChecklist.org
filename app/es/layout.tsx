import { NextIntlClientProvider } from 'next-intl';
import { ThemeProvider } from '@/components/layout/ThemeProvider';
import '@/styles/globals.css';

function handleIntlError(error) {
  if (process.env.NODE_ENV === 'development') {
    console.warn('[i18n]', error.message);
  }
}

export default async function SpanishLayout({ children }) {
  const messages = (await import('@/messages/es.json')).default;

  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-body antialiased">
        <NextIntlClientProvider locale="es" messages={messages} onError={handleIntlError}>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
