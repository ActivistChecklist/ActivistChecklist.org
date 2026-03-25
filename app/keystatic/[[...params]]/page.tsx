import { notFound } from 'next/navigation';

// Provide a placeholder path so Next.js static export is satisfied.
// The layout's notFound() call ensures this route returns 404 in static builds.
export function generateStaticParams() {
  return [{ params: ['_placeholder'] }];
}

// Page component: the layout handles rendering (or notFound in static builds).
export default function KeystaticPage() {
  // In static export mode, the layout calls notFound() before reaching here.
  // In dev/editing mode, KeystaticApp in the layout renders the UI.
  notFound();
}
