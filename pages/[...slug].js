import Head from "next/head";
import Layout from "../components/layout/Layout";
import { getStoryblokVersion, getRevalidate } from "../utils/core";
import {
  useStoryblokState,
  getStoryblokApi,
  StoryblokComponent,
} from "@storyblok/react";
import { cn } from "@/lib/utils";

export default function Page({ story, preview }) {
  story = useStoryblokState(story);
  
  return (
    <div>
      <Head>
        <title>{story ? story.name : "My Site"}</title>
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
    version: getStoryblokVersion(preview)
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
  let { data } = await storyblokApi.get("cdn/links/", {
    version: getStoryblokVersion()
  });

  let paths = [];
  Object.keys(data.links).forEach((linkKey) => {
    if (data.links[linkKey].is_folder || data.links[linkKey].slug === "home") {
      return;
    }

    const slug = data.links[linkKey].slug;
    let splittedSlug = slug.split("/");

    paths.push({ params: { slug: splittedSlug } });
  });

  return {
    paths: paths,
    fallback: false,
  };
}
