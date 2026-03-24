import React from 'react';
import NewsItem from '@/components/NewsItem';
import Link from '@/components/Link';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

export const NEWS_BLOCK_DEFAULT_LIMIT = 3;

const NewsBlock = ({ newsItems = [], limit = NEWS_BLOCK_DEFAULT_LIMIT }) => {
  const t = useTranslations();
  // Take only the first N items (already sorted by date in getStaticProps)
  const recentNews = newsItems.slice(0, limit);

  if (recentNews.length === 0) {
    return null;
  }

  return (
    <section className="mb-16">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">{t('homepage.latestNewsHeading')}</h2>
        <Button asChild variant="outline" size="sm">
          <Link href="/news" className="group">
            {t('homepage.viewAllNews')} <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 ease-out group-hover:translate-x-1" />
          </Link>
        </Button>
      </div>
      
      <div className="space-y-4">
        {recentNews.map((item) => (
          <NewsItem
            key={item.slug}
            entry={item}
          />
        ))}
      </div>
    </section>
  );
};

export default NewsBlock;
