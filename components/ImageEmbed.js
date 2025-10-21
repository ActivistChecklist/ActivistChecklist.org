import React from 'react';
import Image from 'next/image';
import { cn } from "@/lib/utils";
import { RichText } from "@/components/RichText";
import { useIsMobile } from "@/hooks/use-mobile";
import Link from "@/components/Link";

/**
 * ImageEmbed component for embedding images in rich text content
 */
export const ImageEmbed = ({ 
  image, 
  alt,
  caption, 
  size = 'medium', 
  alignment = 'center',
  link,
  className, 
  ...props 
}) => {
  const isMobile = useIsMobile();
  
  // Extract the image URL from Storyblok image structure
  const imageUrl = image?.filename || image?.cached_url || image;
  
  if (!imageUrl) {
    console.warn('ImageEmbed: No image URL provided');
    return null;
  }

  // Handle size classes with mobile responsiveness
  const getSizeClass = () => {
    switch (size) {
      case 'xs':
        return 'max-w-[12rem] sm:max-w-[16rem]';
      case 'small':
        return 'max-w-xs sm:max-w-sm';
      case 'medium':
        return 'max-w-sm sm:max-w-md';
      case 'large':
        return 'max-w-md sm:max-w-2xl';
      case 'full':
        return 'max-w-full';
      default:
        return 'max-w-sm sm:max-w-md';
    }
  };

  // Handle alignment classes with mobile responsiveness
  const getAlignmentClass = () => {
    // On mobile, always use block layout for better readability
    if (isMobile) {
      switch (alignment) {
        case 'left':
        case 'right':
        case 'center':
        case 'full':
        default:
          return 'mx-auto block';
      }
    }
    
    // Desktop alignment
    switch (alignment) {
      case 'left':
        return 'float-left mr-6 mb-4 mt-2';
      case 'right':
        return 'float-right ml-6 mb-4 mt-2';
      case 'center':
        return 'mx-auto block';
      case 'full':
        return 'w-full block';
      default:
        return 'mx-auto block';
    }
  };

  // Generate alt text
  const altText = alt || 'Embedded image';

  // Create the image element
  const imageElement = (
    <Image
      src={imageUrl}
      alt={altText}
      width={800}
      height={600}
      className={cn(
        "rounded-lg shadow-sm w-full h-auto",
        getSizeClass(),
        getAlignmentClass()
      )}
      loading="lazy"
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      {...props}
    />
  );

  // Wrap with link if provided
  const linkUrl = link?.url || link?.cached_url || (typeof link === 'string' ? link : null);
  const wrappedImage = linkUrl ? (
    <Link 
      href={linkUrl}
      className="block"
    >
      {imageElement}
    </Link>
  ) : imageElement;

  // For floated images (left/right), don't wrap in a div to allow text wrapping
  if (alignment === 'left' || alignment === 'right') {
    return (
      <>
        {wrappedImage}
        {caption && (
          <div className="mt-2 text-center max-w-full muted-links px-2 sm:px-0">
            <div className="text-sm text-muted-foreground prose-sm max-w-none">
              <RichText 
                document={caption} 
                className="text-sm text-muted-foreground prose-sm max-w-none" 
                noWrapper={true}
              />
            </div>
          </div>
        )}
      </>
    );
  }

  // For center/full alignments, wrap in a div for proper spacing
  return (
    <div className={cn("my-4", className)}>
      {wrappedImage}
      {caption && (
        <div className="mt-2 text-center max-w-full muted-links px-2 sm:px-0">
          <div className="text-sm text-muted-foreground prose-sm max-w-none">
            <RichText 
              document={caption} 
              className="text-sm text-muted-foreground prose-sm max-w-none" 
              noWrapper={true}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageEmbed;
