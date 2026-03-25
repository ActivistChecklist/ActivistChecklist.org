import { NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { ThemeProvider } from '@/components/layout/ThemeProvider';
import '@/styles/globals.css';

export default async function SpanishLayout({ children }) {
  setRequestLocale('es');
  const messages = (await import('@/messages/es.json')).default;

  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-body antialiased">
        <NextIntlClientProvider locale="es" messages={messages}>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
