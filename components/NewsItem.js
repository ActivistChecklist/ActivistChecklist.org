import React, { useState, useRef, useEffect } from 'react';
import { storyblokEditable } from '@storyblok/react';
import { RichText } from '@/components/RichText';
import { cn, formatRelativeDate } from '@/lib/utils';
import Link from '@/components/Link';
import Image from 'next/image';
import { IoNewspaperOutline } from 'react-icons/io5';
import { useIsMobile } from '@/hooks/use-mobile';

const NewsItem = ({ blok, story, imageManifest = {} }) => {
  const isMobile = useIsMobile();
  const [shouldLoadImage, setShouldLoadImage] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageRef = useRef(null);
  
  if (!blok) {
    console.log('⚠️ NewsItem: blok is undefined. Skipping');
    return null;
  }

  // Intersection Observer for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            console.log('Image intersecting, setting shouldLoadImage to true');
            setShouldLoadImage(true);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        // Start loading when image is 200px away from viewport
        rootMargin: '800px',
        threshold: 0.1
      }
    );

    if (imageRef.current) {
      console.log('Observing imageRef:', imageRef.current);
      observer.observe(imageRef.current);
    } else {
      console.log('imageRef.current is null');
    }

    return () => {
      if (imageRef.current) {
        observer.unobserve(imageRef.current);
      }
    };
  }, []);

  const { date, source, url, paywall_mode = 'inactive', comment } = blok;
  
  // Check if image exists using build-time manifest
  const getImageInfo = () => {
    if (!story?.slug) {
      console.log('No story slug found');
      return { exists: false, src: null };
    }
    
    // Check if the story slug exists in the image manifest
    const imagePath = imageManifest[story.slug];
    console.log('Checking image for slug:', story.slug, 'found:', imagePath);
    
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
                hasUrl ? "text-black group-hover:underline group-hover:decoration-primary" : "text-gray-900"
              )}>
                <span className={hasUrl ? "group-hover:underline group-hover:decoration-primary" : ""}>
                  {story?.name || 'News Item'}
                </span>
                {source && (
                  <span className="text-lg font-normal text-gray-400 group-hover:text-gray-600 ml-1">
                    • {source.name || source}
                  </span>
                )}
              </h3>
            </div>
            
            {/* Image */}
            <div className="flex-shrink-0">
              <div 
                ref={imageRef}
                className="w-32 h-20 bg-gray-200 rounded-lg overflow-hidden flex items-center justify-center relative"
              >
                {imageInfo.exists && shouldLoadImage ? (
                  console.log('Rendering mobile image:', imageInfo.src, 'shouldLoadImage:', shouldLoadImage) ||
                  <Image
                    src={imageInfo.src}
                    alt={story?.name || 'News item'}
                    width={128}
                    height={80}
                    className={cn(
                      "w-full h-full object-cover group-hover:scale-110 transition-all duration-200",
                      imageLoaded ? "opacity-100" : "opacity-0"
                    )}
                    onLoad={() => setImageLoaded(true)}
                    priority={false}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-gray-400">
                    <IoNewspaperOutline className="w-8 h-8" />
                  </div>
                )}
                {imageInfo.exists && shouldLoadImage && !imageLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                    <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
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
              <span className={hasUrl ? "group-hover:underline group-hover:decoration-primary" : ""}>
                {story?.name || 'News Item'}
              </span>
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
            <div 
              ref={imageRef}
              className="w-48 h-28 bg-gray-200 rounded-lg overflow-hidden flex items-center justify-center relative"
            >
              {imageInfo.exists && shouldLoadImage ? (
                console.log('Rendering desktop image:', imageInfo.src, 'shouldLoadImage:', shouldLoadImage) ||
                <Image
                  src={imageInfo.src}
                  alt={story?.name || 'News item'}
                  width={192}
                  height={112}
                  className={cn(
                    "w-full h-full object-cover group-hover:scale-110 transition-all duration-200",
                    imageLoaded ? "opacity-100" : "opacity-0"
                  )}
                  onLoad={() => setImageLoaded(true)}
                  priority={false}
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-gray-400">
                  <IoNewspaperOutline className="w-10 h-10" />
                </div>
              )}
              {imageInfo.exists && shouldLoadImage && !imageLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                  <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );

  // If there's a URL, wrap the content in a proper <a> tag for URL preview
  if (hasUrl) {
    return (
      <a 
        href={mainUrl}
        target="_blank"
        rel="noopener noreferrer"
        {...storyblokEditable(blok)}
        className={cn(
          "news-item mb-4 bg-gray-50 border border-gray-300 rounded-lg p-4 hover:shadow-sm hover:bg-gray-100 transition-all duration-200 group cursor-pointer block"
        )}
        onClick={(e) => {
          // Don't navigate if clicking on a nested link
          if (e.target.closest('a:not([href="' + mainUrl + '"])')) {
            e.preventDefault();
          }
        }}
      >
        <NewsItemContent />
      </a>
    );
  }

  // If no URL, return the content directly
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
