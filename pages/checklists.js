import { getStoryblokApi, storyblokEditable } from "@storyblok/react";
import Head from 'next/head';
import Layout from '@/components/layout/Layout';
import { getStoryblokVersion, fetchAllStories } from "@/utils/core";
import { SECURITY_CHECKLISTS, NAV_ITEMS } from '../config/navigation';
import GuideCard from '@/components/GuideCard';

// Build a map from slug to nav item for easy lookup
const buildSlugToNavItem = () => {
  const map = {};
  Object.values(NAV_ITEMS).forEach(item => {
    if (item.href && item.icon) {
      // Extract slug from href (e.g., "/security-essentials" -> "security-essentials")
      const slug = item.href.replace(/^\//, '');
      map[slug] = item;
    }
  });
  return map;
};

const SLUG_TO_NAV_ITEM = buildSlugToNavItem();

// Get the top 8 slugs for categorization
const TOP_8_SLUGS = SECURITY_CHECKLISTS.items.map(item => item.href.replace(/^\//, ''));

const GuideList = ({ guides }) => {
  // Separate guides into top 8 and others
  const otherGuides = guides.filter(guide => !TOP_8_SLUGS.includes(guide.slug));
  
  // Convert other guides to GuideCard format using nav item data
  const otherGuideItems = otherGuides
    .map(guide => {
      const navItem = SLUG_TO_NAV_ITEM[guide.slug];
      if (navItem) {
        return {
          href: navItem.href,
          icon: navItem.icon,
          title: navItem.title,
          description: navItem.description
        };
      }
      return null;
    })
    .filter(Boolean)
    // Sort alphabetically by title
    .sort((a, b) => a.title.localeCompare(b.title));

  return (
    <div> 
      <Head>
        <title>Checklists</title>
      </Head>
      <Layout searchable={false} sidebarType={null} fullWidthMain={true}>
        <div className="">
          <h1 className="page-title">
            Checklists
          </h1>
          
          {/* Top 8 Checklists */}
          <section className="mb-12">
            <h2 className="text-xl font-semibold mb-4 text-muted-foreground">Featured Checklists</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {SECURITY_CHECKLISTS.items.map((guideItem, index) => (
                <GuideCard key={index} guideItem={guideItem} size="large" />
              ))}
            </div>
          </section>
          
          {/* Other Checklists */}
          {otherGuideItems.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-4 text-muted-foreground">More Checklists</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {otherGuideItems.map((guideItem, index) => (
                  <GuideCard key={index} guideItem={guideItem} size="large" />
                ))}
              </div>
            </section>
          )}
        </div>
      </Layout>
    </div>
  );
};

export async function getStaticProps() {
  const storyblokApi = getStoryblokApi();
  
  // Fetch all guides with pagination support
  const allStories = await fetchAllStories(storyblokApi, {
    version: getStoryblokVersion(),
    filter_query: {
      component: {
        in: "guide"
      }
    },
    excluding_fields: 'body,blocks',
    resolve_links: 'url'
  });

  const guides = allStories.map((guide) => {
    guide.content.slug = guide.slug;
    return guide;
  });

  return {
    props: {
      guides
    },
    // revalidate: 3600 // Revalidate every hour
  };
}

export default GuideList;
