import React, { useEffect } from 'react';
import { MDXRemote } from 'next-mdx-remote';
import { Clock, Calendar } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { mdxComponents } from '@/lib/mdx-components';
import { ChecklistItemsContext } from '@/contexts/ChecklistItemsContext';
import { FeedbackCTA } from '@/components/guides/FeedbackCTA';
import { useLayout } from '@/contexts/LayoutContext';
import { getGuideIcon } from '@/config/icons';

/**
 * Renders a guide page sourced from MDX files.
 *
 * Mirrors the layout of Guide.js (Storyblok mode) but sources content from:
 *   - frontmatter: title, lastUpdated, estimatedTime
 *   - serializedBody: next-mdx-remote compiled MDX (contains <Section> + <ChecklistItem> tags)
 *   - checklistItems: { [slug]: { frontmatter, serializedBody } } map for ChecklistItemsContext
 */
export default function GuideMdx({ frontmatter, serializedBody, checklistItems = {}, slug }) {
  const t = useTranslations();
  const router = useRouter();
  const dateLocale = router.locale === 'es' ? 'es-MX' : 'en-US';
  const { setSidebarType } = useLayout();

  useEffect(() => {
    setSidebarType('toc');
  }, []);

  const GuideIcon = getGuideIcon(slug);

  const metaBarItems = [];

  if (frontmatter.lastUpdated) {
    metaBarItems.push({
      icon: <Calendar className="h-4 w-4 mr-1" />,
      label: t('meta.lastReviewedOn'),
      value: new Date(frontmatter.lastUpdated).toLocaleDateString(dateLocale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    });
  }

  if (frontmatter.estimatedTime) {
    metaBarItems.push({
      icon: <Clock className="h-4 w-4 mr-0.5" />,
      label: t('meta.takesAbout'),
      value: frontmatter.estimatedTime,
    });
  }

  return (
    <ChecklistItemsContext.Provider value={checklistItems}>
      {/* Header — matches Guide.js styling */}
      <div className="relative bg-gradient-to-r from-primary/15 via-primary/10 to-transparent rounded-lg px-6 py-6 mb-6 overflow-hidden print:bg-transparent print:p-0 print:mb-2">
        <div className="absolute top-1.5 bottom-1.5 right-3 aspect-square flex items-center justify-center pointer-events-none print:hidden">
          <GuideIcon className="h-5/6 w-5/6 text-primary/[0.15]" />
        </div>
        <h1 className="relative mb-3 print:mb-0">
          {frontmatter.title}
        </h1>
        {metaBarItems.length > 0 && (
          <div className="relative flex flex-wrap items-center gap-y-2 gap-x-6 text-sm text-muted-foreground print:mb-0">
            {metaBarItems.map((item, index) => (
              <div key={index} className="flex items-center whitespace-nowrap">
                {item.icon}&nbsp;
                <span>
                  {item.label}&nbsp;
                  <span className="text-foreground font-semibold">{item.value}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="mx-auto prose prose-slate max-w-none">
        <div className="relative">
          <MDXRemote {...serializedBody} components={mdxComponents} />
          <FeedbackCTA />
        </div>
      </div>
    </ChecklistItemsContext.Provider>
  );
}
