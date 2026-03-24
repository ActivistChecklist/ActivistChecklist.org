import React, { useEffect } from 'react';
import { MDXRemote } from 'next-mdx-remote';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { mdxComponents } from '@/lib/mdx-components';
import { useLayout } from '@/contexts/LayoutContext';
import { MetaBar, getDateMetaItem } from '@/components/ui/meta-bar';

/**
 * Renders a generic page sourced from MDX files.
 *
 * Sources content from:
 *   - frontmatter: title, lastUpdated (date)
 *   - serializedBody: next-mdx-remote compiled MDX
 */
export default function PageMdx({ frontmatter, serializedBody }) {
  const t = useTranslations();
  const router = useRouter();
  const dateLocale = router.locale === 'es' ? 'es-MX' : 'en-US';
  const { setSidebarType } = useLayout();

  useEffect(() => {
    setSidebarType('navigation');
  }, []);

  const metaBarItems = [
    getDateMetaItem(frontmatter.lastUpdated, t('meta.lastUpdatedOn'), dateLocale),
  ].filter(Boolean);

  return (
    <>
      <h1 className="mb-6">{frontmatter.title}</h1>
      {metaBarItems.length > 0 && <MetaBar items={metaBarItems} />}
      <div className="prose prose-slate max-w-none">
        <MDXRemote {...serializedBody} components={mdxComponents} />
      </div>
    </>
  );
}
