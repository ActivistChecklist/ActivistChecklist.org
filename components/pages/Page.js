import React, { useEffect } from 'react';
import { MDXRemote } from 'next-mdx-remote';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { mdxComponents } from '@/lib/mdx-components';
import { useLayout } from '@/contexts/LayoutContext';
import { MetaBar, getDateMetaItem } from '@/components/ui/meta-bar';
import RelatedGuides from '@/components/RelatedGuides';
import { LOCALES } from "@/lib/i18n-config";

function parseRelatedGuides(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((slug) => slug.trim())
    .filter(Boolean);
}

/**
 * Renders a generic page sourced from MDX files.
 *
 * Sources content from:
 *   - frontmatter: title, lastUpdated (date)
 *   - serializedBody: next-mdx-remote compiled MDX
 */
export default function Page({ frontmatter, serializedBody }) {
  const t = useTranslations();
  const router = useRouter();
  const dateLocale = LOCALES[router.locale]?.intlLocale || 'en-US';
  const { setSidebarType } = useLayout();

  useEffect(() => {
    setSidebarType('navigation');
  }, []);

  const metaBarItems = [
    getDateMetaItem(frontmatter.lastUpdated, t('meta.lastUpdatedOn'), dateLocale),
  ].filter(Boolean);
  const relatedGuideSlugs = parseRelatedGuides(frontmatter.relatedGuides);

  return (
    <>
      <h1 className="mb-6">{frontmatter.title}</h1>
      {metaBarItems.length > 0 && <MetaBar items={metaBarItems} />}
      <div className="prose prose-slate max-w-none">
        <MDXRemote {...serializedBody} components={mdxComponents} />
      </div>
      {relatedGuideSlugs.length > 0 && (
        <RelatedGuides isBlock guideSlugs={relatedGuideSlugs} />
      )}
    </>
  );
}
