import Head from "next/head";
import Layout from "../components/layout/Layout";
import { getStoryblokVersion, getRevalidate, fetchAllStories } from "../utils/core";
import {
  useStoryblokState,
  getStoryblokApi,
  StoryblokComponent,
} from "@storyblok/react";
import { cn } from "@/lib/utils";

export default function Page({ story, preview }) {
  story = useStoryblokState(story);
  
  // Get the first image from the story content if available, fallback to default
  const getOgImage = () => {
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
    if (story?.content?.description) {
      return story.content.description;
    } else if (story?.content?.body) {
      // If there's rich text content, try to get the first paragraph
      const firstParagraph = story.content.body.content?.[0]?.content?.[0]?.text;
      if (firstParagraph) {
        return firstParagraph.substring(0, 160) + "...";
      }
    }
    return "Plain language steps for digital security, because protecting yourself helps keep your whole community safer. Built by activists, for activists with field-tested, community-verified guides.";
  };

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://activistchecklist.org';
  const currentPath = story?.full_slug || '';
  const canonicalUrl = `${baseUrl}/${currentPath}`;
  
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
          <StoryblokComponent blok={story.content} story={story} />
      </Layout>
    </div>
  );
}

export async function getStaticProps({ params, preview = false }) {
  let slug = params?.slug ? params.slug.join("/") : "home";
  const storyblokApi = getStoryblokApi();

  // First get the main story
  let { data } = await storyblokApi.get(`cdn/stories/${slug}`, {
    version: getStoryblokVersion(preview),
    resolve_relations: 'checklist-item-ref.reference_item,news-item.source'
  });

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

  return {
    props: {
      story: data.story,
      key: data.story.id,
      preview: preview || false,
      revalidate: 0,
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

  // Define folders that should be excluded from static path generation
  // Only exclude these folders in static builds, allow them in development/Vercel
  const isStaticBuild = process.env.BUILD_MODE === 'static';
  const excludedFolders = isStaticBuild ? [
    'checklist-items/',
    'changelog/',
    'news/',
  ] : [];

  // Define specific slugs to exclude
  const excludedSlugs = [
    'home'
  ];

  let paths = [];
  
  allStories.forEach((story) => {
    // Skip folders
    if (story.is_folder) {
      return;
    }

    // Skip excluded slugs
    if (excludedSlugs.includes(story.slug)) {
      return;
    }

    // Skip stories in excluded folders
    if (excludedFolders.some(folder => story.full_slug.startsWith(folder))) {
      return;
    }

    const slug = story.full_slug;
    let splittedSlug = slug.split("/");

    paths.push({ params: { slug: splittedSlug } });
  });

  return {
    paths: paths,
    fallback: false,
  };
}
