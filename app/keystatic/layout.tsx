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

// Don't pre-render keystatic routes in the static export
export async function generateStaticParams() {
  return [];
}
