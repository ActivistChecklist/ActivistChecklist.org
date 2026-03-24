import React from 'react';
import GuideCardBlock from '@/components/GuideCardBlock';
import { cn } from '@/lib/utils';

/**
 * RelatedGuides — <RelatedGuides><RelatedGuide slug="essentials" />...</RelatedGuides>
 */
const RelatedGuides = ({ children, isBlock = false }) => {

  const guides = React.Children.toArray(children)
    .filter(child => child?.props?.slug)
    .map(child => {
      const slug = child.props.slug;
      return slug.startsWith('/') ? slug : `/${slug}`;
    });

  if (guides.length === 0) {
    return null;
  }

  // Determine grid layout based on number of guides
  const getGridClass = () => {
    switch (guides.length) {
      case 1:
        return "grid grid-cols-1 max-w-md mx-auto";
      case 2:
        // 2 and 4 should behave the same way
      case 4:
        // 2x2 grid - break to single column sooner (use lg instead of md)
        return "grid grid-cols-1 lg:grid-cols-2 gap-8";
      case 3:
        // Max 2 columns — third card wraps to its own row (never 3 across)
        return "grid grid-cols-1 lg:grid-cols-2 gap-8";
      default:
        return "grid grid-cols-1 lg:grid-cols-2 gap-8";
    }
  };

  // Different styling based on context
  const containerClass = isBlock
    ? "not-prose bg-muted/50 border border-border/50 rounded-lg p-6 my-8"
    : "not-prose mt-12 pt-8 border-t border-border/50";

  const titleClass = isBlock 
    ? "text-xl font-semibold text-foreground mb-4" 
    : "";

  const defaultTitle = isBlock 
    ? "Keep learning with these related guides"
    : "If you found this helpful, also check out these guides";

  return (
    <div className={containerClass}>
      {/* Title section */}
      <div className="mb-6">
        <h3 className={cn(titleClass)} id="related">
          {defaultTitle}
        </h3>
      </div>

      {/* Guides grid */}
      <div className={getGridClass()}>
        {guides.map((guideUrl, index) => {
          // Create a fake block object for GuideCardBlock
          const fakeBlok = {
            url: { url: guideUrl },
          };

          return (
            <GuideCardBlock 
              key={index} 
              block={fakeBlok} 
            />
          );
        })}
      </div>
    </div>
  );
};

export default RelatedGuides;
