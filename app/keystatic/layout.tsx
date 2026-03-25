import { notFound } from 'next/navigation';
import KeystaticApp from './keystatic-app';

// Show admin UI in development, or when GitHub credentials are configured
// (i.e. the editing deployment). Never in static export.
const showAdminUI =
  process.env.NODE_ENV === 'development' ||
  Boolean(process.env.KEYSTATIC_GITHUB_CLIENT_ID);

export default function KeystaticLayout() {
  if (!showAdminUI) {
    notFound();
  }
  return <KeystaticApp />;
}

// Required for output: 'export' — return [] to exclude all Keystatic paths from static build
export function generateStaticParams() {
  return [];
}

