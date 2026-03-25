// @ts-nocheck
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { serialize } from 'next-mdx-remote/serialize';
import Layout from '@/components/layout/Layout';
import Guide from '@/components/guides/Guide';
import ContentPage from '@/components/pages/Page';
import TranslationFallbackBanner from '@/components/TranslationFallbackBanner';
import { mdxOptions } from '@/lib/mdx-options';
import {
  getGuide,
  getPage,
  getAllGuides,
  getAllPages,
  getChecklistItem,
  extractChecklistItems,
  serializeFrontmatter,
} from '@/lib/content';
import { getBaseUrl } from '@/lib/utils';
import { LOCALES, DEFAULT_LOCALE } from '@/lib/i18n-config';

const DEFAULT_DESCRIPTION =
  'Plain language steps for digital security, because protecting yourself helps keep your whole community safer. Built by activists, for activists with field-tested, community-verified guides.';

export async function generateStaticParams() {
  // Return slugs for all locales — the parent [locale] layout handles the locale segment
  const allParams = [];
  for (const loc of Object.keys(LOCALES)) {
    const guides = getAllGuides(loc);
    const pages = getAllPages(loc);
    allParams.push(
      ...guides.map((g) => ({ slug: [g.frontmatter.slug || g.slug] })),
      ...pages.map((p) => ({ slug: [p.frontmatter.slug || p.slug] })),
    );
  }
  // Deduplicate by slug
  const seen = new Set();
  return allParams.filter((p) => {
    const key = p.slug.join('/');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function generateMetadata({ params }) {
  const { locale, slug: slugParts } = await params;
  const slug = slugParts?.join('/') || '';
  const baseUrl = getBaseUrl();

  const guide = getGuide(slug, locale);
  const content = guide || getPage(slug, locale);
  if (!content) return {};

  const { frontmatter } = content;
  const pageTitle = frontmatter?.title
    ? `${frontmatter.title} | Digital Security Checklists for Activists`
    : 'Digital Security Checklists for Activists';
  const pageDescription = frontmatter?.summary || frontmatter?.description || DEFAULT_DESCRIPTION;

  const hrefLangLocales = Object.keys(LOCALES);
  const alternates = {};
  hrefLangLocales.forEach((loc) => {
    alternates[loc] = loc === DEFAULT_LOCALE ? `${baseUrl}/${slug}/` : `${baseUrl}/${loc}/${slug}/`;
  });

  const canonical = locale === DEFAULT_LOCALE ? `${baseUrl}/${slug}/` : `${baseUrl}/${locale}/${slug}/`;

  return {
    title: pageTitle,
    description: pageDescription,
    alternates: {
      canonical,
      languages: alternates,
    },
    openGraph: {
      title: pageTitle,
      description: pageDescription,
      url: canonical,
      type: 'article',
      siteName: 'Activist Checklist',
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description: pageDescription,
    },
  };
}

export default async function SlugPage({ params }) {
  const { locale, slug: slugParts } = await params;
  setRequestLocale(locale);
  const slug = slugParts?.join('/') || '';

  // ── Try guide ──────────────────────────────────────────────
  const guide = getGuide(slug, locale);
  if (guide) {
    const { frontmatter, content, isFallback } = guide;
    const firstSectionIndex = content.indexOf('<Section');
    const introContent =
      firstSectionIndex === -1 ? content : content.slice(0, firstSectionIndex).trim();
    const sectionContent =
      firstSectionIndex === -1 ? '' : content.slice(firstSectionIndex).trim();

    const serializedIntro = introContent ? await serialize(introContent, mdxOptions) : null;
    const serializedBody = sectionContent ? await serialize(sectionContent, mdxOptions) : null;

    // Resolve all referenced checklist items
    const itemSlugs = extractChecklistItems(content);
    const checklistItems = {};
    await Promise.all(
      itemSlugs.map(async (itemSlug) => {
        const item = getChecklistItem(itemSlug, locale);
        if (item) {
          try {
            const serializedItemBody = await serialize(item.content, mdxOptions);
            checklistItems[itemSlug] = {
              frontmatter: serializeFrontmatter(item.frontmatter),
              serializedBody: serializedItemBody,
            };
          } catch (err) {
            console.warn(`Failed to serialize checklist item "${itemSlug}":`, err.message);
          }
        } else {
          console.warn(`Checklist item not found: "${itemSlug}" (referenced in guide "${slug}")`);
        }
      })
    );

    // Generate OG image at build time
    let ogImagePath = null;
    try {
      const { generateOgImageForRoute } = await import('@/lib/og-image');
      ogImagePath = await generateOgImageForRoute({ title: frontmatter.title, pageType: 'guide', slug });
    } catch (err) {
      console.warn(`OG image skipped for guide "${slug}":`, err.message);
    }

    return (
      <Layout sidebarType="toc">
        {isFallback && <TranslationFallbackBanner />}
        <Guide
          frontmatter={serializeFrontmatter(frontmatter)}
          serializedIntro={serializedIntro}
          serializedBody={serializedBody}
          checklistItems={checklistItems}
          slug={slug}
          locale={locale}
        />
      </Layout>
    );
  }

  // ── Try page ───────────────────────────────────────────────
  const page = getPage(slug, locale);
  if (page) {
    const { frontmatter, content, isFallback } = page;

    const serializedBody = await serialize(content, mdxOptions);

    // Generate OG image at build time
    try {
      const { generateOgImageForRoute } = await import('@/lib/og-image');
      await generateOgImageForRoute({ title: frontmatter.title, pageType: 'page', slug });
    } catch (err) {
      console.warn(`OG image skipped for page "${slug}":`, err.message);
    }

    return (
      <Layout sidebarType="navigation">
        {isFallback && <TranslationFallbackBanner />}
        <ContentPage
          frontmatter={serializeFrontmatter(frontmatter)}
          serializedBody={serializedBody}
          locale={locale}
        />
      </Layout>
    );
  }

  notFound();
}
