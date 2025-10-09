import React from 'react';
import { storyblokEditable } from '@storyblok/react';
import { RichText } from '@/components/RichText';
import { cn, formatRelativeDate } from '@/lib/utils';
import Link from '@/components/Link';

const NewsItem = ({ blok, story }) => {
  if (!blok) {
    console.log('⚠️ NewsItem: blok is undefined. Skipping');
    return null;
  }

  const { date, source, url, url_bypass_paywall, comment } = blok;
  
  // Get publication date from story metadata
  const dateString = date || new Date().toISOString();
  const hoverDate = new Date(dateString).toISOString().split('T')[0];

  return (
    <div 
      {...storyblokEditable(blok)}
      className={cn(
        "news-item mb-4"
      )}
    >
      <div className="flex flex-col md:flex-row md:gap-4">
        {/* Date container */}
        <div className="md:w-20 md:shrink-0 mb-1 md:mb-0">
          <time 
            className="text-sm text-muted-foreground"
            dateTime={dateString}
            title={hoverDate}
          >
            {formatRelativeDate(dateString)}
          </time>
        </div>
        
        {/* Content container */}
        <div className="flex-1 min-w-0">
          {/* Source and Title */}
          <div className="mb-2">
            {source && (
              <span className="text-base text-muted-foreground">
                {source}:{' '}
              </span>
            )}
            {url.url ? (
              <Link 
                href={url.url} 
                className="text-base text-primary hover:text-primary/80 transition-colors underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {story?.name || 'News Item'}
              </Link>
            ) : (
              <span className="text-sm">
                {story?.name || 'News Item'}
              </span>
            )}
            {url_bypass_paywall.url && (
              <>
                {' '}
                <Link 
                  href={url_bypass_paywall.url} 
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  (bypass paywall)
                </Link>
              </>
            )}
          </div>
          
          {/* Tags */}
          {story?.tag_list && story.tag_list.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {story.tag_list.map((tag, index) => (
                <span 
                  key={index}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          
          {/* Comment */}
          {comment && (
            <div className="prose prose-slate max-w-none text-sm">
              <RichText document={comment} noWrapper={true} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewsItem;
