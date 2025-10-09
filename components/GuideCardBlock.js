import React from 'react';
import GuideCard from '@/components/GuideCard';
import { SECURITY_CHECKLISTS } from '@/config/navigation';

const GuideCardBlock = ({ blok }) => {
  // Normalize URL by removing leading and trailing slashes
  const normalizeUrl = (url) => {
    if (!url) return null;
    return url.replace(/^\/+|\/+$/g, '');
  };

  // Find the guide item by href lookup
  const findGuideByUrl = (url) => {
    const normalizedUrl = normalizeUrl(url);
    return SECURITY_CHECKLISTS.items.find(item => 
      normalizeUrl(item.href) === normalizedUrl
    );
  };

  // Extract URL from blok object
  const guideUrl = blok?.url?.url || blok?.url;
  
  if (!guideUrl) {
    console.warn('GuideCardBlock: No URL provided in block object');
    return null;
  }

  // Find the guide item
  const guideItem = findGuideByUrl(guideUrl);
  
  if (!guideItem) {
    console.warn(`GuideCardBlock: No guide found for URL: ${guideUrl}`);
    return null;
  }

  // Extract size from blok or default to medium
  const size = blok?.size || 'medium';

  return (
    <GuideCard
      guideItem={guideItem}
      size={size}
    />
  );
};

export default GuideCardBlock;
