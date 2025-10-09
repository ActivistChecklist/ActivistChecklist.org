import React from 'react';
import GuideCardBlock from '@/components/GuideCardBlock';
import { RichText } from '@/components/RichText';
import { cn } from '@/lib/utils';

const RelatedGuides = ({ blok }) => {

  // Extract guide URLs from blok (using cached_url for Storyblok multilink fields)
  const guides = [
    blok?.guide1?.cached_url,
    blok?.guide2?.cached_url,
    blok?.guide3?.cached_url,
    blok?.guide4?.cached_url
  ].filter(Boolean); // Remove empty/undefined entries

  console.log('RelatedGuides: guides', guides);

  if (guides.length === 0) {
    return null;
  }

  // Determine grid layout based on number of guides
  const getGridClass = () => {
    switch (guides.length) {
      case 1:
        return "grid grid-cols-1 max-w-md mx-auto";
      case 2:
        return "grid grid-cols-1 md:grid-cols-2 gap-8";
      case 3:
        return "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8";
      case 4:
        return "grid grid-cols-1 md:grid-cols-2 gap-8";
      default:
        return "grid grid-cols-1 md:grid-cols-2 gap-8";
    }
  };

  return (
    <div className="mt-12 pt-8 border-t border-border/50">
      {/* Title section */}
      <div className="mb-6">
        <h2 className={cn(
          // "text-2xl font-bold text-foreground",
          // "!border-b-0 !pb-0"
        )}
          id="related"
        >
          {blok?.title ? (
            <RichText document={blok.title} />
          ) : (
            "Related Checklists"
          )}
        </h2>
        {blok?.description && (
          <div className="mt-2 text-muted-foreground">
            <RichText document={blok.description} />
          </div>
        )}
      </div>

      {/* Guides grid */}
      <div className={getGridClass()}>
        {guides.map((guideUrl, index) => {
          // Create a fake blok object for GuideCardBlock
          const fakeBlok = {
            url: { url: guideUrl },
          };

          return (
            <GuideCardBlock 
              key={index} 
              blok={fakeBlok} 
            />
          );
        })}
      </div>
    </div>
  );
};

export default RelatedGuides;
