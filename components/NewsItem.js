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

  const { date, source, url, paywall_mode = 'inactive', comment } = blok;
  
  // Get publication date from story metadata
  const dateString = date || new Date().toISOString();
  const hoverDate = new Date(dateString).toISOString().split('T')[0];
  
  // Generate archive URL based on paywall_mode
  const getArchiveUrl = (mode, originalUrl) => {
    if (!originalUrl || !mode || mode === 'inactive') return null;
    
    if (mode === 'wayback') {
      return `https://web.archive.org/web/${originalUrl}`;
    }
    
    // archive.is modes
    const baseUrl = 'https://archive.is';
    const modePath = mode === 'oldest' ? 'oldest' : 'newest';
    return `${baseUrl}/${modePath}/${originalUrl}`;
  };
  
  const archiveUrl = getArchiveUrl(paywall_mode, url?.url);

  return (
    <div 
      {...storyblokEditable(blok)}
      className={cn(
        "news-item mb-0 border-b border-muted pb-4"
      )}
    >
      <div className="flex flex-col md:flex-row md:gap-4">
        {/* Date container */}
        <div className="hidden md:block md:w-20 md:shrink-0 mb-1 md:mb-0">
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
          {/* Title */}
          <div className="mb-2">
            {(paywall_mode !== 'inactive' ? archiveUrl : url?.url) && (
              <Link 
                href={paywall_mode !== 'inactive' ? archiveUrl : url.url} 
                className="link text-base"
                target="_blank"
                rel="noopener noreferrer"
              >
                {story?.name || 'News Item'}
              </Link>
            )}
          </div>
          
          {/* Paywall Notice */}
          {paywall_mode !== 'inactive' && url?.url && (
            <div className="mb-2">
              <span className="text-xs text-muted-foreground italic">
                This link bypasses the paywall.{' '}
                <Link 
                  href={url.url} 
                  className={cn("link no-underline font-light hover:underline")}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  See original
                </Link>.
              </span>
            </div>
          )}
          
          {/* Source and Tags */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-sm text-muted-foreground md:hidden">
              {formatRelativeDate(dateString)} •{' '}
            </span>
            {source && (
              <span className="text-sm text-muted-foreground">
                {source.name || source}
              </span>
            )}
            {story?.tag_list && story.tag_list.length > 0 && (
              <>
                {story.tag_list.map((tag, index) => (
                  <span 
                    key={index}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </>
            )}
          </div>
          
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
