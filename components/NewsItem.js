import React from 'react';
import { storyblokEditable } from '@storyblok/react';
import { RichText } from '@/components/RichText';
import { cn, formatRelativeDate } from '@/lib/utils';
import Link from '@/components/Link';
import Image from 'next/image';
import { IoNewspaperOutline } from 'react-icons/io5';

const NewsItem = ({ blok, story, imageManifest = {} }) => {
  if (!blok) {
    console.log('⚠️ NewsItem: blok is undefined. Skipping');
    return null;
  }

  const { date, source, url, paywall_mode = 'inactive', comment } = blok;
  
  // Check if image exists using build-time manifest
  const getImageInfo = () => {
    if (!story?.slug) return { exists: false, src: null };
    
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

  return (
    <div 
      {...storyblokEditable(blok)}
      className={cn(
        "news-item mb-4 bg-gray-50 border border-gray-300 rounded-lg p-4 hover:shadow-sm hover:bg-gray-100 transition-all duration-200 group",
        hasUrl && "cursor-pointer"
      )}
      onClick={hasUrl ? (e) => {
        // Don't navigate if clicking on a nested link
        if (e.target.closest('a')) return;
        window.open(mainUrl, '_blank', 'noopener,noreferrer');
      } : undefined}
    >
      <div className="flex gap-4">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className={cn(
            "text-lg font-semibold mb-2 line-clamp-2 transition-all duration-100",
            hasUrl ? "text-black group-hover:underline group-hover:decoration-primary" : "text-gray-900"
          )}>
            {story?.name || 'News Item'}
          </h3>
          
          {/* Comment */}
          {comment && (
            <div className="prose prose-slate max-w-none text-sm mb-2">
              <RichText document={comment} noWrapper={true} />
            </div>
          )}
          
          {/* Meta row: Date • Source • Tags */}
          <div className="text-sm text-gray-600 mb-2">
            <div className="flex flex-wrap items-center gap-1">
              <span>{formatRelativeDate(dateString)}</span>
              {source && (
                <>
                  <span>•</span>
                  <span>{source.name || source}</span>
                </>
              )}
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
          
          {/* Paywall Notice */}
          {paywall_mode !== 'inactive' && url?.url && (
            <div className="text-xs text-gray-500 italic">
              This link bypasses the paywall.{' '}
              <Link 
                href={url.url} 
                className="underline hover:no-underline hover:text-primary transition-colors duration-200"
                target="_blank"
                rel="noopener noreferrer"
              >
                See original
              </Link>.
            </div>
          )}
        </div>
        
        {/* Image */}
        <div className="flex-shrink-0">
          <div className={cn(
            "w-32 h-20 md:w-40 md:h-24 bg-gray-200 rounded-lg overflow-hidden flex items-center justify-center",
            hasUrl && "hover:scale-105 transition-transform duration-200"
          )}>
            {imageInfo.exists ? (
              <Image
                src={imageInfo.src}
                alt={story?.name || 'News item'}
                width={128}
                height={128}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-gray-400">
                <IoNewspaperOutline className="w-8 h-8 md:w-10 md:h-10" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewsItem;
