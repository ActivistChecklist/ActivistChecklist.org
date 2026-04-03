/**
 * Replaces app/keystatic/[[...params]]/page.tsx when BUILD_MODE=static.
 * Avoids bundling @keystatic/next/ui and the full keystatic admin (PageClient).
 */
import { notFound } from 'next/navigation';

export const metadata = {
  title: 'Keystatic | Activist Checklist',
};

export function generateStaticParams() {
  return [{ params: undefined }];
}

export default function Page() {
  notFound();
}
