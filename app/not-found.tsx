// @ts-nocheck
import NotFoundContent from '@/components/pages/NotFoundContent';

export default async function NotFound() {
  const messages = (await import('@/messages/en.json')).default;

  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-body antialiased">
        <NotFoundContent messages={messages} />
      </body>
    </html>
  );
}
