import React, { useState, useEffect } from 'react';
import { storyblokEditable } from '@storyblok/react';
import { RichText } from '@/components/RichText';
import { cn, formatRelativeDate } from '@/lib/utils';
import Link from '@/components/Link';
import Image from 'next/image';

const NewsItem = ({ blok, story }) => {
  if (!blok) {
    console.log('⚠️ NewsItem: blok is undefined. Skipping');
    return null;
  }

  const { date, source, url, paywall_mode = 'inactive', comment } = blok;
  const [imageExists, setImageExists] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  
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

  // Check if image exists for this story
  useEffect(() => {
    if (!story?.slug) return;
    
    const checkImageExists = async () => {
      const possibleExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
      
      for (const ext of possibleExtensions) {
        const imagePath = `/files/news/${story.slug}${ext}`;
        
        try {
          // Try to fetch the image to see if it exists
          const response = await fetch(imagePath, { method: 'HEAD' });
          if (response.ok) {
            setImageSrc(imagePath);
            setImageExists(true);
            return;
          }
        } catch (error) {
          // Image doesn't exist, continue to next extension
        }
      }
      
      setImageExists(false);
    };
    
    checkImageExists();
  }, [story?.slug]);

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
        <div className="flex-1 min-w-0 flex flex-col md:flex-row md:gap-4">
          {/* News Image - Mobile */}
          {imageExists && (
            <div className="flex-shrink-0 mb-2 md:hidden">
              <div className="w-full h-24 bg-muted rounded-md overflow-hidden">
                <Image
                  src={imageSrc}
                  alt={story?.name || 'News item'}
                  width={400}
                  height={96}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}
          
          {/* Main content */}
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
          
          {/* Source and Tags */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-sm text-muted-foreground md:hidden">
              {formatRelativeDate(dateString)}{source && ' • '}
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
            {/* Paywall Notice */}
            {paywall_mode !== 'inactive' && url?.url && (
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
            )}
          </div>
          
          {/* Comment */}
          {comment && (
            <div className="prose prose-slate max-w-none text-sm">
              <RichText document={comment} noWrapper={true} />
            </div>
          )}
          </div>
          
          {/* News Image - Desktop */}
          {imageExists && (
            <div className="hidden md:block flex-shrink-0">
              <div className="w-32 h-20 bg-muted rounded-md overflow-hidden">
                <Image
                  src={imageSrc}
                  alt={story?.name || 'News item'}
                  width={128}
                  height={80}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewsItem;
