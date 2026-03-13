import { storyblokEditable, StoryblokComponent } from "@storyblok/react";
import { useMemo, useState, useEffect } from 'react';
import Image from 'next/image';
import { RichText } from "../RichText";
import { Button } from "@/components/ui/button";
import { Clock, Calendar, Expand as ExpandIcon, Collapse as CollapseIcon } from 'lucide-react';
import { FeedbackCTA } from "@/components/guides/FeedbackCTA";
import { useLayout } from "@/contexts/LayoutContext";
import { MetaBar, getDateMetaItem } from "@/components/ui/meta-bar";
import { getGuideIcon } from "@/config/icons";

export const SectionHeader = ({ blok, checklistItemCount, isExpanded, onToggleExpand }) => {
  return (
    <div className="mb-4 prose prose-slate max-w-none" {...storyblokEditable(blok)}>
      <div className="relative flex flex-col sm:block">
        <h2
          id={blok.slug}
          className={checklistItemCount > 1 ? 'sm:pr-32' : ''}
        >
          <RichText document={blok.title} />
        </h2>
        {checklistItemCount > 1 && (
          <Button
            variant="defaultOutline"
            size="sm"
            className="gap-2 start print:hidden w-full sm:w-auto sm:absolute sm:bottom-0 sm:right-0 mt-2 sm:mt-0"
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

const Guide = ({ blok, story }) => {
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

  const guideSlug = story?.slug || '';
  const GuideIcon = getGuideIcon(guideSlug);

  const metaBarItems = [];
  
  if (blok.last_updated) {
    metaBarItems.push({
      icon: <Calendar className="h-4 w-4 mr-1" />,
      label: "Last reviewed on",
      value: new Date(blok.last_updated).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    });
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
      <div className="relative bg-gradient-to-r from-primary/15 via-primary/10 to-transparent rounded-lg px-6 py-6 mb-6 overflow-hidden print:bg-transparent print:p-0 print:mb-2">
        <div className="absolute top-1.5 bottom-1.5 right-3 aspect-square flex items-center justify-center pointer-events-none print:hidden">
          <GuideIcon className="h-5/6 w-5/6 text-primary/[0.15]" />
        </div>
        <h1 className="relative mb-3 print:mb-0" {...storyblokEditable(blok)}>
          {blok.title}
        </h1>
        {metaBarItems.length > 0 && (
          <div className="relative flex flex-wrap items-center gap-y-2 gap-x-6 text-sm text-muted-foreground print:mb-0">
            {metaBarItems.map((item, index) => (
              <div key={index} className="flex items-center whitespace-nowrap">
                {item.icon}&nbsp;
                <span>
                  {item.label}&nbsp;
                  <span className="text-foreground font-semibold">{item.value}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="mx-auto">
        <div className="relative">

          <div {...storyblokEditable(blok)} className="mb-0">
            <RichText document={blok.body} />
          </div>

          <div className="clear-both"></div>

          {sections.map((section, sectionIndex) => {
            const checklistItemCount = section.blocks.filter(block => block.component === 'checklist-item' || block.component === 'checklist-item-ref').length;
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
                {section.blocks.map((nestedBlok) => {
                  // Pass isBlock prop for related-guides components
                  const props = nestedBlok.component === 'related-guides' 
                    ? { isBlock: true } 
                    : {};
                  
                  return (
                    <StoryblokComponent 
                      blok={nestedBlok} 
                      key={nestedBlok._uid}
                      index={nestedBlok.component === 'checklist-item' ? currentIndex++ : undefined}
                      expandTrigger={expandTriggers[sectionIndex]}
                      {...props}
                    />
                  );
                })}
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

