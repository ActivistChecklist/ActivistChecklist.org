import '@/styles/globals.css';
import { ThemeProvider } from '@/components/layout/ThemeProvider';
import { notFound } from 'next/navigation';
import { showKeystaticUI } from '../../keystatic.config';

export default function KeystaticLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!showKeystaticUI) {
    notFound();
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-body antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
