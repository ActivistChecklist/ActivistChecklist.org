import Head from "next/head";
import { useRouter } from 'next/router';
import Layout from "../components/layout/Layout";
import { cn, getBaseUrl } from "@/lib/utils";
import TranslationFallbackBanner from '@/components/TranslationFallbackBanner';
import GuideMdx from '@/components/guides/GuideMdx';
import PageMdx from '@/components/pages/PageMdx';
import { serialize } from 'next-mdx-remote/serialize';
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

const DEFAULT_DESCRIPTION = "Plain language steps for digital security, because protecting yourself helps keep your whole community safer. Built by activists, for activists with field-tested, community-verified guides.";

export default function Page({
  type,
  slug,
  frontmatter,
  serializedBody,
  serializedRelatedGuides = null,
  checklistItems,
  ogImagePath,
  isFallbackContent,
}) {
  const baseUrl = getBaseUrl();
  const router = useRouter();
  const locale = router.locale;
  const defaultLocale = router.defaultLocale;
  const localePrefix = locale !== defaultLocale ? `${locale}/` : '';
  const canonicalUrl = `${baseUrl}/${localePrefix}${slug}`;

  const pageTitle = frontmatter?.title
    ? `${frontmatter.title} | Digital Security Checklists for Activists`
    : 'Digital Security Checklists for Activists';
  const pageDescription = frontmatter?.summary || frontmatter?.description || DEFAULT_DESCRIPTION;
  const pageImage = ogImagePath ? `${baseUrl}${ogImagePath}` : `${baseUrl}/images/og-image.png`;

  return (
    <div>
      <Head>
        <title key="title">{pageTitle}</title>
        <meta name="description" content={pageDescription} key="description" />
        <link rel="canonical" href={canonicalUrl} key="canonical" />

        <meta property="og:url" content={canonicalUrl} key="og:url" />
        <meta property="og:title" content={pageTitle} key="og:title" />
        <meta property="og:description" content={pageDescription} key="og:description" />
        <meta property="og:image" content={pageImage} key="og:image" />
        <meta property="og:type" content="article" key="og:type" />
        <meta property="og:site_name" content="Activist Checklist" key="og:site_name" />

        <meta name="twitter:card" content="summary_large_image" key="twitter:card" />
        <meta name="twitter:title" content={pageTitle} key="twitter:title" />
        <meta name="twitter:description" content={pageDescription} key="twitter:description" />
        <meta name="twitter:image" content={pageImage} key="twitter:image" />

        <link rel="alternate" hreflang="en" href={`${baseUrl}/${slug}`} key="hreflang-en" />
        <link rel="alternate" hreflang="es" href={`${baseUrl}/es/${slug}`} key="hreflang-es" />
        <link rel="alternate" hreflang="x-default" href={`${baseUrl}/${slug}`} key="hreflang-default" />
      </Head>

      <Layout sidebarType={type === 'guide' ? 'toc' : 'navigation'}>
        {isFallbackContent && <TranslationFallbackBanner />}
        {type === 'guide' && (
          <GuideMdx
            frontmatter={frontmatter}
            serializedBody={serializedBody}
            checklistItems={checklistItems}
            slug={slug}
          />
        )}
        {type === 'page' && (
          <PageMdx
            frontmatter={frontmatter}
            serializedBody={serializedBody}
            serializedRelatedGuides={serializedRelatedGuides}
          />
        )}
      </Layout>
    </div>
  );
}

export async function getStaticProps({ params, locale = 'en' }) {
  const slug = params?.slug ? params.slug.join('/') : 'home';
  const messages = (await import(`../messages/${locale}.json`)).default;

  // Try guide
  const guide = getGuide(slug, locale);
  if (guide) {
    const { frontmatter, content, isFallback } = guide;

    // Serialize guide MDX body
    const serializedBody = await serialize(content, mdxOptions);

    // Extract and serialize all checklist item bodies
    const itemSlugs = extractChecklistItems(content);
    const checklistItems = {};
    await Promise.all(
      itemSlugs.map(async (itemSlug) => {
        const item = getChecklistItem(itemSlug, locale);
        if (item) {
          try {
            const serializedItemBody = await serialize(item.content, mdxOptions);
            checklistItems[itemSlug] = {
              frontmatter: item.frontmatter,
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

    // OG image
    let ogImagePath = null;
    try {
      const { generateOgImageForStory } = require('@/lib/og-image');
      ogImagePath = await generateOgImageForStory({
        content: { title: frontmatter.title, component: 'guide' },
        full_slug: slug,
        name: frontmatter.title,
      });
    } catch (err) {
      console.warn(`OG image skipped for guide "${slug}":`, err.message);
    }

    // Serialize checklist item frontmatters too
    for (const itemSlug of Object.keys(checklistItems)) {
      checklistItems[itemSlug].frontmatter = serializeFrontmatter(checklistItems[itemSlug].frontmatter);
    }

    return {
      props: {
        type: 'guide',
        slug,
        frontmatter: serializeFrontmatter(frontmatter),
        serializedBody,
        checklistItems,
        ogImagePath,
        isFallbackContent: isFallback,
        messages,
      },
    };
  }

  // Try page
  const page = getPage(slug, locale);
  if (page) {
    const { frontmatter, content, isFallback } = page;

    // Render trailing RelatedGuides outside of prose wrapper in PageMdx.
    // This keeps card layouts from inheriting prose typography styles.
    const relatedGuidesMatch = content.match(/<RelatedGuides[\s\S]*?<\/RelatedGuides>\s*$/);
    const relatedGuidesMdx = relatedGuidesMatch ? relatedGuidesMatch[0] : null;
    const mainContent = relatedGuidesMatch
      ? content.slice(0, relatedGuidesMatch.index).trimEnd()
      : content;

    const serializedBody = await serialize(mainContent, mdxOptions);
    const serializedRelatedGuides = relatedGuidesMdx
      ? await serialize(relatedGuidesMdx, mdxOptions)
      : null;

    let ogImagePath = null;
    try {
      const { generateOgImageForStory } = require('@/lib/og-image');
      ogImagePath = await generateOgImageForStory({
        content: { title: frontmatter.title, component: 'page' },
        full_slug: slug,
        name: frontmatter.title,
      });
    } catch (err) {
      console.warn(`OG image skipped for page "${slug}":`, err.message);
    }

    return {
      props: {
        type: 'page',
        slug,
        frontmatter: serializeFrontmatter(frontmatter),
        serializedBody,
        serializedRelatedGuides,
        checklistItems: {},
        ogImagePath,
        isFallbackContent: isFallback,
        messages,
      },
    };
  }

  return { notFound: true };
}

export async function getStaticPaths({ locales }) {
  const hasI18n = Array.isArray(locales) && locales.length > 0;
  const activeLocales = hasI18n ? locales : ['en'];

  const paths = [];

  for (const locale of activeLocales) {
    for (const guide of getAllGuides(locale)) {
      const slug = guide.frontmatter.slug || guide.slug;
      paths.push({
        params: { slug: [slug] },
        ...(hasI18n && { locale }),
      });
    }
    for (const page of getAllPages(locale)) {
      const slug = page.frontmatter.slug || page.slug;
      paths.push({
        params: { slug: [slug] },
        ...(hasI18n && { locale }),
      });
    }
  }

  return { paths, fallback: false };
}
