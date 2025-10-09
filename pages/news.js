import React from 'react';
import Head from 'next/head';
import Layout from '@/components/layout/Layout';
import NewsItem from '@/components/NewsItem';
import RSSButton from '@/components/ui/RSSButton';
import { cn } from "@/lib/utils";

const NewsPage = ({ newsItems = [] }) => {
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
      <section className={cn("mb-12")}>
        <h2 className="text-2xl font-bold mb-6 text-foreground border-b pb-2">{year}</h2>
        <div className="space-y-0">
          {items.map((story) => (
            <NewsItem 
              key={story.uuid} 
              blok={story.content}
              story={story}
            />
          ))}
        </div>
      </section>
    );
  };

  return (
    <div>
      <Head>
        <title>News - Activist Checklist</title>
        <meta name="description" content="Latest news abour digital security, surveillance, and activism." />
      </Head>
      <Layout>
        <div className="max-w-4xl mx-auto">
          <header className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-4xl font-bold mb-4">News</h1>
                <p className="text-lg text-muted-foreground">
                  Latest news about digital security, surveillance, and activism.
                </p>
              </div>
              <RSSButton 
                href="/rss/news.xml" 
                variant="outline"
                size="sm"
              />
            </div>
          </header>

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
    const { getStoryblokVersion, fetchAllNewsItems } = await import('../utils/core');
    
    const storyblokApi = getStoryblokApi();
    
    // Fetch all news items with pagination support
    const allItems = await fetchAllNewsItems(storyblokApi, {
      version: getStoryblokVersion()
    });

    // Sort by content.date or first_published_at as fallback, newest first
    const sortedItems = (allItems || []).sort((a, b) => {
      const dateA = new Date(a.content.date || a.first_published_at || a.created_at);
      const dateB = new Date(b.content.date || b.first_published_at || b.created_at);
      return dateB - dateA; // Newest first
    });

    return {
      props: {
        newsItems: sortedItems
      }
    };
  } catch (error) {
    console.error('Error fetching news items:', error);
    return {
      props: {
        newsItems: []
      }
    };
  }
}

export default NewsPage;
