import React from 'react';
import Head from 'next/head';
import Layout from '@/components/layout/Layout';
import NewsItem from '@/components/NewsItem';
import RSSButton from '@/components/ui/RSSButton';
import Link from '@/components/Link';
import { cn } from "@/lib/utils";

const NewsPage = ({ newsItems = [], imageManifest = {} }) => {
  // Group news items by year
  const groupNewsByYear = (items) => {
    const groups = {};

    items.forEach(item => {
      const itemDate = new Date(item.content.date || item.first_published_at || item.created_at);
      const year = itemDate.getFullYear();
      
      if (!groups[year]) {
        groups[year] = [];
      }
      groups[year].push(item);
    });

    return groups;
  };

  const groupedNews = groupNewsByYear(newsItems);
  
  // Get sorted years (newest first)
  const sortedYears = Object.keys(groupedNews)
    .map(year => parseInt(year))
    .sort((a, b) => b - a);

  const YearSection = ({ year, items }) => {
    if (!items.length) return null;

    return (
      <section className={cn("pb-12")}>
        <h2 className="text-2xl font-bold pb-4 text-foreground">{year}</h2>
        <div className="space-y-4">
          {items.map((story) => (
            <NewsItem 
              key={story.uuid} 
              blok={story.content}
              story={story}
              imageManifest={imageManifest}
            />
          ))}
        </div>
      </section>
    );
  };

  return (
    <div>
      <Head>
        <title>Surveillance News - Activist Checklist</title>
        <meta name="description" content="Latest news about state surveillance and threats facing social movements." />
      </Head>
      <Layout>
        <div className="max-w-4xl mx-auto">
          <header className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-4xl font-bold mb-4">Surveillance News</h1>
                <p className="text-lg text-muted-foreground">
                  Latest news about state surveillance and threats facing social movements.
                </p>
              </div>
              <RSSButton 
                href="/rss/news.xml" 
                variant="outline"
                size="sm"
              />
            </div>
          </header>

          {/* News Submission Invitation */}
          <div className="mb-8 p-4 bg-muted rounded-lg border border-primary/40">
            <p className="text-sm text-muted-foreground">
              Have news you think should be included?{' '}
              <Link 
                href="/contact" 
                className="link text-sm"
              >
                Send us a tip
              </Link>
              {' '}and help keep our community informed.
            </p>
          </div>

          {newsItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No news items found.</p>
            </div>
          ) : (
            <div className="space-y-0">
              {sortedYears.map(year => (
                <YearSection 
                  key={year}
                  year={year}
                  items={groupedNews[year]}
                />
              ))}
            </div>
          )}
        </div>
      </Layout>
    </div>
  );
};

export async function getStaticProps() {
  try {
    const { getStoryblokApi } = await import('@storyblok/react');
    const { getStoryblokVersion, fetchNewsData } = await import('../utils/core');
    
    const storyblokApi = getStoryblokApi();
    
    // Fetch news data using shared utility
    const { newsItems, imageManifest } = await fetchNewsData(storyblokApi, {
      version: getStoryblokVersion()
    });

    return {
      props: {
        newsItems,
        imageManifest
      }
    };
  } catch (error) {
    console.error('Error fetching news items:', error);
    return {
      props: {
        newsItems: [],
        imageManifest: {}
      }
    };
  }
}

export default NewsPage;
