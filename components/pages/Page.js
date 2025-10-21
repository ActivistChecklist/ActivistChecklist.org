import React from "react";
import { storyblokEditable, StoryblokComponent } from "@storyblok/react";
import { RichText } from "../RichText";
import { useDebug } from '../../contexts/DebugContext'
import { useLayout } from "@/contexts/LayoutContext";
import { useEffect } from "react";
import { MetaBar, getDateMetaItem } from "@/components/ui/meta-bar";

function Page({ blok, story }) {
  const { setDebugData } = useDebug() || {}
  const { setSidebarType } = useLayout();

  useEffect(() => {
    setSidebarType('navigation');
  }, []);

  if (setDebugData) {
    setDebugData(blok)
  }

  const metaBarItems = [
    getDateMetaItem(story.updated_at)
  ];

  return (
    <>  
      <h1 className="mb-6">
        {story.name}
      </h1>
      <MetaBar items={metaBarItems} />
      <div className="prose prose-slate max-w-none" {...storyblokEditable(blok)}>
        <RichText document={blok.body} />
      </div>
      
      {/* Render blocks if they exist */}
      {blok.blocks && blok.blocks.length > 0 && (
        <div className="mt-8">
          {blok.blocks.map((nestedBlok) => {
            // Pass isBlock prop for related-guides components
            const props = nestedBlok.component === 'related-guides' 
              ? { isBlock: true } 
              : {};
            
            return (
              <StoryblokComponent 
                blok={nestedBlok} 
                key={nestedBlok._uid}
                {...props}
              />
            );
          })}
        </div>
      )}
    </>
  );
}

export default Page;
