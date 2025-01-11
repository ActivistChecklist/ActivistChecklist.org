import { storyblokEditable, StoryblokComponent } from "@storyblok/react";
import { useMemo, useState, useEffect } from 'react';
import Image from 'next/image';
import { RichText } from "../RichText";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Clock, Expand as ExpandIcon, Collapse as CollapseIcon } from 'lucide-react';
import { FeedbackCTA } from "@/components/guides/FeedbackCTA";
import { useLayout } from "@/contexts/LayoutContext";
import { MetaBar, getDateMetaItem } from "@/components/ui/meta-bar";

export const SectionHeader = ({ blok, checklistItemCount, isExpanded, onToggleExpand }) => {
  return (
    <div className="mb-4 prose prose-slate max-w-none" {...storyblokEditable(blok)}>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 sm:gap-0">
        <h2 className={cn(
            "!border-b-0 !pb-0"
          )}
          id={blok.slug}
        >
          <RichText document={blok.title} />
        </h2>
        {checklistItemCount > 1 && (
          <Button
            variant="defaultOutline"
            size="sm"
            className="gap-2 start"
            onClick={onToggleExpand}
          >
            {isExpanded ? (
              <>
                {/* <CollapseIcon className="h-4 w-4" /> */}
                Collapse all
              </>
            ) : (
              <>
                {/* <ExpandIcon className="h-4 w-4" /> */}
                Expand all
              </>
            )}
          </Button>
        )}
      </div>
      {blok.description && (
        <div className="mt-2">
          <RichText document={blok.description} />
        </div>
      )}
    </div>
  );
};

const Guide = ({ blok }) => {
  const { setSidebarType } = useLayout();
  const [sectionExpandStates, setSectionExpandStates] = useState({});
  const [expandTriggers, setExpandTriggers] = useState({});

  // Set sidebar type immediately
  useEffect(() => {
    setSidebarType('toc');
  }, []); // Empty dependency array means this runs once on mount

  const sections = useMemo(() => {
    const result = [];
    let currentSection = null;

    blok.blocks?.forEach((block) => {
      if (block.component === 'section-header') {
        if (currentSection) {
          result.push(currentSection);
        }
        currentSection = {
          header: block,
          blocks: []
        };
      } else if (currentSection) {
        currentSection.blocks.push(block);
      } else {
        currentSection = {
          blocks: [block]
        };
      }
    });

    if (currentSection) {
      result.push(currentSection);
    }

    return result;
  }, [blok.blocks]);

  const handleSectionExpandToggle = (sectionIndex, section) => {
    const newState = !sectionExpandStates[sectionIndex];
    setSectionExpandStates(prev => ({
      ...prev,
      [sectionIndex]: newState
    }));

    // Update trigger timestamp for this section
    setExpandTriggers(prev => ({
      ...prev,
      [sectionIndex]: {
        timestamp: Date.now(),
        shouldExpand: newState
      }
    }));
  };

  const disableImage = true;

  const metaBarItems = [];
  
  if (blok.last_updated) {
    metaBarItems.push(
      getDateMetaItem(blok.last_updated, "Last reviewed on")
    );
  }

  if (blok.estimated_time) {
    metaBarItems.push({
      icon: <Clock className="h-4 w-4 mr-0.5" />,
      label: "Takes about",
      value: blok.estimated_time
    });
  }

  return (
    <>
      {disableImage ? (
        <h1 className="mb-6" {...storyblokEditable(blok)}>
          {blok.title}
        </h1>
      ) : (
        <div className="relative w-[calc(100%+4rem)] h-[200px] mb-6 -mx-8">
          {blok.image?.filename ? (
            <Image
              src={blok.image.filename}
              alt=""
              fill
              className="object-cover rounded-t-xl"
              priority
            />
          ) : (
            <div className="absolute inset-0 bg-muted rounded-t-xl" />
          )}
          <div className={cn(
            "absolute inset-0 bg-gradient-to-bl from-transparent via-background/80 to-background",
          )} />
          <div className="absolute bottom-6 left-8 right-8">
            <h1 className="text-shadow-white" {...storyblokEditable(blok)}>
              {blok.title}
            </h1>
          </div>
        </div>
      )}
      
      <div className="mx-auto">
        <div className="relative">
          <MetaBar items={metaBarItems} {...storyblokEditable(blok)} />

          <div {...storyblokEditable(blok)} className="mb-0">
            <RichText document={blok.body} />
          </div>

          <div className="clear-both"></div>

          {sections.map((section, sectionIndex) => {
            const checklistItemCount = section.blocks.filter(block => block.component === 'checklist-item').length;
            let currentIndex = 0;
            
            return (
              <section 
                key={section.header?._uid || `section-${sectionIndex}`} 
                className="mb-0"
                aria-labelledby={section.header ? `section-heading-${sectionIndex}` : undefined}
              >
                {section.header && (
                  <SectionHeader
                    blok={section.header}
                    checklistItemCount={checklistItemCount}
                    isExpanded={!!sectionExpandStates[sectionIndex]}
                    onToggleExpand={() => handleSectionExpandToggle(sectionIndex, section)}
                  />
                )}
                {section.blocks.map((nestedBlok) => (
                  <StoryblokComponent 
                    blok={nestedBlok} 
                    key={nestedBlok._uid}
                    index={nestedBlok.component === 'checklist-item' ? currentIndex++ : undefined}
                    expandTrigger={expandTriggers[sectionIndex]}
                  />
                ))}
              </section>
            );
          })}
          <FeedbackCTA />
        </div>
      </div>
    </>
  );
}

export default Guide;

