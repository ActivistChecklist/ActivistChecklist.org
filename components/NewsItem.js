import React from 'react';
import { storyblokEditable } from '@storyblok/react';
import { RichText } from '@/components/RichText';
import { cn, formatRelativeDate } from '@/lib/utils';
import Link from '@/components/Link';
import Image from 'next/image';
import { IoNewspaperOutline } from 'react-icons/io5';
import { useIsMobile } from '@/hooks/use-mobile';

const NewsItem = ({ blok, story, imageManifest = {} }) => {
  const isMobile = useIsMobile();
  
  if (!blok) {
    return null;
  }

  const { date, source, url, paywall_mode = 'inactive', comment } = blok;
  
  // Check if image exists using build-time manifest
  const getImageInfo = () => {
    if (!story?.slug) {
      return { exists: false, src: null };
    }
    
    // Check if the story slug exists in the image manifest
    const imagePath = imageManifest[story.slug];
    
    if (imagePath) {
      return { exists: true, src: imagePath };
    } else {
      return { exists: false, src: null };
    }
  };
  
  const imageInfo = getImageInfo();
  
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

  const mainUrl = paywall_mode !== 'inactive' ? archiveUrl : url?.url;
  const hasUrl = !!mainUrl;

  // Meta row component
  const MetaRow = () => (
    <div className="text-sm text-gray-600 mb-2">
      <div className="flex flex-wrap items-center gap-1">
        <span>{formatRelativeDate(dateString)}</span>
        {story?.tag_list && story.tag_list.length > 0 && (
          <>
            <span>•</span>
            {story.tag_list.map((tag, index) => (
              <span key={index} className="bg-gray-200 text-gray-600 px-2 py-1 rounded text-xs whitespace-nowrap">
                {tag}
              </span>
            ))}
          </>
        )}
      </div>
    </div>
  );

  const NewsItemContent = () => (
    <>
      {isMobile ? (
        // Mobile layout: stacked vertically
        <div className="space-y-3">
          {/* Title and Image in a row */}
          <div className="flex gap-3">
            <div className="flex-1 min-w-0">
              <h3 className={cn(
                "text-lg font-semibold mb-2 line-clamp-3 transition-all duration-100",
                hasUrl ? "text-black" : "text-gray-900"
              )}>
                {hasUrl ? (
                  <a 
                    href={mainUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline hover:decoration-primary"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {story?.name || 'News Item'}
                  </a>
                ) : (
                  <span>{story?.name || 'News Item'}</span>
                )}
                {source && (
                  <span className="text-lg font-normal text-gray-400 group-hover:text-gray-600 ml-1">
                    • {source.name || source}
                  </span>
                )}
              </h3>
            </div>
            
            {/* Image */}
            <div className="flex-shrink-0">
              {hasUrl ? (
                <a 
                  href={mainUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="w-32 h-20 bg-gray-200 rounded-lg overflow-hidden flex items-center justify-center relative">
                    {imageInfo.exists ? (
                      <Image
                        src={imageInfo.src}
                        alt={story?.name || 'News item'}
                        width={128}
                        height={80}
                        className="w-full h-full object-cover group-hover:scale-110 transition-all duration-200"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <IoNewspaperOutline className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                </a>
              ) : (
                <div className="w-32 h-20 bg-gray-200 rounded-lg overflow-hidden flex items-center justify-center relative">
                  {imageInfo.exists ? (
                    <Image
                      src={imageInfo.src}
                      alt={story?.name || 'News item'}
                      width={128}
                      height={80}
                      className="w-full h-full object-cover group-hover:scale-110 transition-all duration-200"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      <IoNewspaperOutline className="w-8 h-8" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Meta row below title and image */}
          <MetaRow />
          
          {/* Comment */}
          {comment && (
            <div className="prose prose-slate max-w-none text-sm">
              <RichText document={comment} noWrapper={true} />
            </div>
          )}
          
          {/* Paywall Notice */}
          {paywall_mode !== 'inactive' && url?.url && (
            <div className="text-xs text-gray-500 italic">
              This link bypasses the paywall.{' '}
              <Link 
                href={url.url} 
                className="underline hover:no-underline hover:text-primary transition-colors duration-200"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                See original
              </Link>.
            </div>
          )}
        </div>
      ) : (
        // Desktop layout: side by side
        <div className="flex gap-4">
          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Title */}
            <h3 className={cn(
              "text-lg font-semibold mb-2 line-clamp-3 transition-all duration-100",
              hasUrl ? "text-black" : "text-gray-900"
            )}>
              {hasUrl ? (
                <a 
                  href={mainUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline hover:decoration-primary"
                  onClick={(e) => e.stopPropagation()}
                >
                  {story?.name || 'News Item'}
                </a>
              ) : (
                <span>{story?.name || 'News Item'}</span>
              )}
              {source && (
                <span className="text-lg font-normal text-gray-400 group-hover:text-gray-600 ml-1">
                  • {source.name || source}
                </span>
              )}
            </h3>
            
            {/* Comment */}
            {comment && (
              <div className="prose prose-slate max-w-none text-sm mb-2">
                <RichText document={comment} noWrapper={true} />
              </div>
            )}
            
            {/* Meta row: Date • Source • Tags */}
            <MetaRow />
            
            {/* Paywall Notice */}
            {paywall_mode !== 'inactive' && url?.url && (
              <div className="text-xs text-gray-500 italic">
                This link bypasses the paywall.{' '}
                <Link 
                  href={url.url} 
                  className="underline hover:no-underline hover:text-primary transition-colors duration-200"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  See original
                </Link>.
              </div>
            )}
          </div>
          
          {/* Image */}
          <div className="flex-shrink-0">
            {hasUrl ? (
              <a 
                href={mainUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="w-48 h-28 bg-gray-200 rounded-lg overflow-hidden flex items-center justify-center relative">
                  {imageInfo.exists ? (
                    <Image
                      src={imageInfo.src}
                      alt={story?.name || 'News item'}
                      width={192}
                      height={112}
                      className="w-full h-full object-cover group-hover:scale-110 transition-all duration-200"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      <IoNewspaperOutline className="w-10 h-10" />
                    </div>
                  )}
                </div>
              </a>
            ) : (
              <div className="w-48 h-28 bg-gray-200 rounded-lg overflow-hidden flex items-center justify-center relative">
                {imageInfo.exists ? (
                  <Image
                    src={imageInfo.src}
                    alt={story?.name || 'News item'}
                    width={192}
                    height={112}
                    className="w-full h-full object-cover group-hover:scale-110 transition-all duration-200"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-gray-400">
                    <IoNewspaperOutline className="w-10 h-10" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );

  // Return the content in a div container
  return (
    <div 
      {...storyblokEditable(blok)}
      className="news-item mb-4 bg-gray-50 border border-gray-300 rounded-lg p-4 hover:shadow-sm hover:bg-gray-100 transition-all duration-200 group"
    >
      <NewsItemContent />
    </div>
  );
};

export default NewsItem;
