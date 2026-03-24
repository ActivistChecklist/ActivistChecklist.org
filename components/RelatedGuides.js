import React from 'react';
import GuideCard from '@/components/GuideCard';
import { NAV_ITEMS } from '@/config/navigation';
import { cn } from '@/lib/utils';

const ALL_GUIDE_ITEMS = Object.values(NAV_ITEMS).filter(item => item.icon && item.href);

function findGuideBySlug(slug) {
  const normalized = slug.replace(/^\/+|\/+$/g, '');
  return ALL_GUIDE_ITEMS.find(item =>
    item.href.replace(/^\/+|\/+$/g, '') === normalized
  );
}

/**
 * RelatedGuides — <RelatedGuides><RelatedGuide slug="essentials" />...</RelatedGuides>
 */
const RelatedGuides = ({ children, isBlock = false }) => {

  const guideItems = React.Children.toArray(children)
    .filter(child => child?.props?.slug)
    .map(child => findGuideBySlug(child.props.slug))
    .filter(Boolean);

  if (guideItems.length === 0) {
    return null;
  }

  const getGridClass = () => {
    if (guideItems.length === 1) return "grid grid-cols-1 max-w-md mx-auto";
    return "grid grid-cols-1 lg:grid-cols-2 gap-8";
  };

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
      <div className="mb-6">
        <h3 className={cn(titleClass)} id="related">
          {defaultTitle}
        </h3>
      </div>

      <div className={getGridClass()}>
        {guideItems.map((guideItem, index) => (
          <GuideCard key={index} guideItem={guideItem} size="medium" />
        ))}
      </div>
    </div>
  );
};

export default RelatedGuides;
