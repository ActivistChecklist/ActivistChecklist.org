import Head from "next/head";
import Layout from "../components/layout/Layout";
import { getStoryblokVersion, getRevalidate, fetchAllStories, fetchAllChangelogEntries, fetchNewsData, renderRichTextTreeAsPlainText } from "../utils/core";
import {
  useStoryblokState,
  getStoryblokApi,
  StoryblokComponent,
} from "@storyblok/react";
import { cn, getBaseUrl } from "@/lib/utils";
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from "@/lib/i18n";
import TranslationFallbackBanner from "@/components/TranslationFallbackBanner";
import HomePage from "./index";

// Relations that need to be resolved - must match getStaticProps AND bridge
const RESOLVE_RELATIONS = ['checklist-item-ref.reference_item', 'news-item.source'];

export default function Page({ story, preview, language, ogImagePath, isFallbackContent, isHomePage, homePageProps }) {
  // For language-prefixed home routes (e.g. /es/), render the same HomePage component
  if (isHomePage) {
    return (
      <>
        <TranslationFallbackBanner />
        <HomePage {...homePageProps} />
      </>
    );
  }
  story = useStoryblokState(story, {
    resolveRelations: RESOLVE_RELATIONS
  });
  
  // Get the first image from the story content if available, fallback to default

  // Get the OG image: prefer generated image, then Storyblok image, then default
  const getOgImage = () => {
    if (ogImagePath) {
      return `${baseUrl}${ogImagePath}`;
    }
    if (story?.content?.image) {
      // Handle Storyblok image object or string
      const imageUrl = typeof story.content.image === 'string' 
        ? story.content.image 
        : story.content.image.cached_url || story.content.image.filename || story.content.image.url;

      if (!imageUrl) {
        return `${baseUrl}/images/og-image.png`;
      }

      // If it's already an absolute URL, return as is
      if (imageUrl.startsWith('http')) {
        return imageUrl;
      }
      // Otherwise, make it absolute
      return `${baseUrl}${imageUrl}`;
    }
    return `${baseUrl}/images/og-image.png`; // Default OG image
  };

  // Get a description from the story content if available, fallback to default
  const getDescription = () => {
    // Check for explicit description field
    if (story?.content?.description) {
      // Handle rich text or string
      if (typeof story.content.description === 'string') {
        return story.content.description;
      }
      const plainText = renderRichTextTreeAsPlainText(story.content.description);
      if (plainText) return plainText;
    }
    // Check for summary field
    if (story?.content?.summary) {
      // Handle rich text or string
      if (typeof story.content.summary === 'string') {
        return story.content.summary;
      }
      const plainText = renderRichTextTreeAsPlainText(story.content.summary);
      if (plainText) return plainText;
    }
    // If there's rich text content, try to get the first paragraph
    if (story?.content?.body) {
      const firstParagraph = story.content.body.content?.[0]?.content?.[0]?.text;
      if (firstParagraph) {
        return firstParagraph.substring(0, 160) + "...";
      }
    }
    return "Plain language steps for digital security, because protecting yourself helps keep your whole community safer. Built by activists, for activists with field-tested, community-verified guides.";
  };

  const baseUrl = getBaseUrl();
  const currentPath = story?.full_slug || '';
  // Include language prefix in canonical URL if it's not the default language
  const languagePrefix = language && language !== DEFAULT_LANGUAGE ? `${language}/` : '';
  const canonicalUrl = `${baseUrl}/${languagePrefix}${currentPath}`;
  
  // Shared metadata values
  const pageTitle = story 
    ? `${story.content.title || story.name} | Digital Security Checklists for Activists` 
    : "Digital Security Checklists for Activists";
  const pageDescription = getDescription();
  const pageImage = getOgImage();
  
  return (
    <div>
      <Head>
        <title key="title">{pageTitle}</title>
        <meta name="description" content={pageDescription} key="description" />
        <link rel="canonical" href={canonicalUrl} key="canonical" />
        
        {/* OpenGraph metadata */}
        <meta property="og:url" content={canonicalUrl} key="og:url" />
        <meta property="og:title" content={pageTitle} key="og:title" />
        <meta property="og:description" content={pageDescription} key="og:description" />
        <meta property="og:image" content={pageImage} key="og:image" />
        <meta property="og:type" content="article" key="og:type" />
        <meta property="og:site_name" content="Activist Checklist" key="og:site_name" />
        
        {/* Twitter metadata */}
        <meta name="twitter:card" content="summary_large_image" key="twitter:card" />
        <meta name="twitter:title" content={pageTitle} key="twitter:title" />
        <meta name="twitter:description" content={pageDescription} key="twitter:description" />
        <meta name="twitter:image" content={pageImage} key="twitter:image" />
      </Head>
      <Layout sidebarType={story.content.component === 'guide' ? 'toc' : 'navigation'}>
          {isFallbackContent && <TranslationFallbackBanner />}
          <StoryblokComponent blok={story.content} story={story} />
      </Layout>
    </div>
  );
}

export async function getStaticProps({ params, preview = false }) {
  let slug = params?.slug ? params.slug.join("/") : "home";
  const storyblokApi = getStoryblokApi();

  // Check if this is a language-specific request
  const pathSegments = params?.slug || [];
  const availableLanguageCodes = SUPPORTED_LANGUAGES
    .filter(lang => lang.code !== DEFAULT_LANGUAGE)
    .map(lang => lang.code);
  const language = availableLanguageCodes.includes(pathSegments[0]) 
    ? pathSegments.shift() 
    : undefined;
  const actualSlug = pathSegments.join('/') || 'home';

  // For language-prefixed home routes (e.g. /es/), fetch the same data as index.js
  if (actualSlug === 'home' && language) {
    try {
      const [allEntries, { newsItems, imageManifest }] = await Promise.all([
        fetchAllChangelogEntries(storyblokApi, { version: getStoryblokVersion() }),
        fetchNewsData(storyblokApi, { version: getStoryblokVersion() })
      ]);

      const sortedEntries = (allEntries || []).sort((a, b) => {
        const dateA = new Date(a.first_published_at || a.created_at);
        const dateB = new Date(b.first_published_at || b.created_at);
        return dateB - dateA;
      });

      const latestMajorUpdate = sortedEntries.find(entry => entry.content?.type === 'major');

      return {
        props: {
          isHomePage: true,
          isFallbackContent: true,
          language,
          homePageProps: {
            changelogEntries: sortedEntries.slice(0, 5),
            newsItems,
            imageManifest,
            latestMajorUpdate: latestMajorUpdate ? { body: latestMajorUpdate.content.body } : null,
          },
        },
      };
    } catch (error) {
      console.error('Error fetching homepage data for language route:', error);
      return {
        props: {
          isHomePage: true,
          isFallbackContent: true,
          language,
          homePageProps: {
            changelogEntries: [],
            newsItems: [],
            imageManifest: {},
            latestMajorUpdate: null,
          },
        },
      };
    }
  }

  // First try to get the story in the requested language
  let { data } = await storyblokApi.get(`cdn/stories/${actualSlug}`, {
    version: getStoryblokVersion(preview),
    language: language || DEFAULT_LANGUAGE,
    resolve_relations: RESOLVE_RELATIONS.join(',')
  });

  // If no story found in requested language and it's not the default language, try default language
  let isFallbackContent = false;
  if (!data?.story && language && language !== DEFAULT_LANGUAGE) {
    const fallbackData = await storyblokApi.get(`cdn/stories/${actualSlug}`, {
      version: getStoryblokVersion(preview),
      language: DEFAULT_LANGUAGE,
      resolve_relations: RESOLVE_RELATIONS.join(',')
    });

    if (fallbackData?.story) {
      data = fallbackData;
      isFallbackContent = true;
    }
  }

  // For Storyblok field-level translation: if language was requested but content
  // is identical to the default language, it wasn't actually translated
  if (data?.story && language && language !== DEFAULT_LANGUAGE && !isFallbackContent) {
    const { data: defaultData } = await storyblokApi.get(`cdn/stories/${actualSlug}`, {
      version: getStoryblokVersion(preview),
      language: DEFAULT_LANGUAGE,
    });
    if (defaultData?.story) {
      const requestedTitle = data.story.content?.title || data.story.name;
      const defaultTitle = defaultData.story.content?.title || defaultData.story.name;
      if (requestedTitle === defaultTitle) {
        isFallbackContent = true;
      }
    }
  }

  if (!data?.story) {
    return { notFound: true };
  }

  // Function to get all checklist items from a guide
  const getGuideChecklistItems = (blocks = []) => {
    const items = [];
    let currentSection = null;

    blocks.forEach((block) => {
      if (block.component === 'section-header') {
        if (currentSection) {
          items.push(currentSection);
        }
        currentSection = {
          component: 'section-header',
          _uid: block._uid,
          title: block.title,
          description: block.description,
          blocks: []
        };
      } else if (block.component === 'checklist-item') {
        if (currentSection) {
          currentSection.blocks.push(block);
        } else {
          items.push(block);
        }
      }
    });

    // Add the last section if it exists
    if (currentSection) {
      items.push(currentSection);
    }

    return items;
  };

  // Function to expand references in the content
  const expandReferences = async (content) => {
    const traverse = async (obj) => {
      if (!obj) return obj;
      
      // If this is a checklist-item-reference with items_ref, expand it
      if (obj.component === 'checklist-item-reference' && obj.items_ref?.items) {
        const expandedItems = await Promise.all(
          obj.items_ref.items.map(async (item) => {
            const { guideId, itemId } = item;
            
            try {
              // Get the guide content
              const { data: guideData } = await storyblokApi.get(`cdn/stories/${guideId}`, {
                version: getStoryblokVersion()
              });

              if (!guideData?.story?.content) {
                return { error: `Guide ${guideId} not found` };
              }

              // If itemId is specified, find that specific item
              if (itemId) {
                const blocks = guideData.story.content.blocks || [];
                const targetItem = blocks.find(block => block._uid === itemId);
                if (!targetItem) {
                  return { error: `Item ${itemId} not found in guide ${guideId}` };
                }
                return targetItem;
              }

              // If no itemId, get all checklist items from the guide with their sections
              const blocks = guideData.story.content.blocks || [];
              const items = getGuideChecklistItems(blocks);
              
              // If we got items, return them as a flat array
              if (items.length > 0) {
                return items;
              }

              return { error: `No checklist items found in guide ${guideId}` };
            } catch (error) {
              return { error: `Failed to fetch guide ${guideId}: ${error.message}` };
            }
          })
        );

        // Flatten the array since a guide reference might return multiple items
        const flattened = expandedItems.flat();
        
        // Add the expanded items to the object
        obj.expanded_items = flattened;
      }

      // Recursively traverse all object properties
      if (typeof obj === 'object') {
        for (const key of Object.keys(obj)) {
          if (Array.isArray(obj[key])) {
            obj[key] = await Promise.all(obj[key].map(traverse));
          } else if (typeof obj[key] === 'object') {
            obj[key] = await traverse(obj[key]);
          }
        }
      }

      return obj;
    };

    return traverse(content);
  };

  // Expand all references in the content
  data.story.content = await expandReferences(data.story.content);

  // Generate OG share image at build time
  let ogImagePath = null;
  try {
    const { generateOgImageForStory } = require('@/lib/og-image');
    ogImagePath = await generateOgImageForStory(data.story);
  } catch (error) {
    console.warn(`OG image generation skipped for ${slug}:`, error.message);
  }

  return {
    props: {
      story: data.story,
      key: data.story.id,
      preview: preview || false,
      language: language || DEFAULT_LANGUAGE,
      revalidate: 0,
      ogImagePath,
      isFallbackContent,
      // ...getRevalidate(),
    },
  };
}

export async function getStaticPaths() {
  const storyblokApi = getStoryblokApi();
  
  // Fetch all stories with pagination support
  const allStories = await fetchAllStories(storyblokApi, {
    version: getStoryblokVersion(),
    excluding_fields: 'body,blocks,content'
  });

  // Define specific slugs to exclude
  const excludedSlugs = [
    'home'
  ];

  // Define content types that should be included in static builds
  const isStaticBuild = process.env.BUILD_MODE === 'static';
  const includedTypes = isStaticBuild ? ['page', 'guide'] : null;

  let paths = [];
  
  allStories.forEach((story) => {
    // Skip folders
    if (story.is_folder) {
      return;
    }

    // For static builds, only include specific content types
    if (isStaticBuild && includedTypes) {
      if (!includedTypes.includes(story.content.component)) {
        return;
      }
    }

    const slug = story.full_slug;
    let splittedSlug = slug.split("/");
    const isExcluded = excludedSlugs.includes(story.slug);

    // Add default language path (skip excluded slugs like 'home' which is handled by index.js)
    if (!isExcluded) {
      paths.push({ params: { slug: splittedSlug } });
    }

    // Add paths for all supported languages so untranslated pages
    // show English content with a fallback banner instead of 404.
    SUPPORTED_LANGUAGES
      .filter(lang => lang.code !== DEFAULT_LANGUAGE)
      .forEach(lang => {
        // For 'home', generate /es (slug ['es']) since the Link component
        // turns '/' into '/es/', not '/es/home'
        if (isExcluded) {
          paths.push({ params: { slug: [lang.code] } });
        } else {
          paths.push({ params: { slug: [lang.code, ...splittedSlug] } });
        }
      });
  });

  return {
    paths: paths,
    fallback: false,
  };
}
