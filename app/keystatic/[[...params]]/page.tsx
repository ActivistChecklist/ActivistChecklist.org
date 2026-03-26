import PageClient from './PageClient';

export const metadata = {
  title: 'Keystatic | Activist Checklist',
};

/**
 * Optional catch-all requires at least one entry for static export; `params: undefined` is the
 * /keystatic root. Default dynamicParams=true still allows deeper /keystatic/* in dev.
 * Layout calls notFound when Keystatic is disabled (static export / production).
 */
export function generateStaticParams() {
  return [{ params: undefined }];
}

export default function Page() {
  return <PageClient />;
}
