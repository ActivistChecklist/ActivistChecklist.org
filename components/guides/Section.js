import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { SectionContext } from '@/contexts/SectionContext';

/**
 * Section — MDX-mode guide section with expand/collapse-all support.
 *
 * Usage in MDX:
 *   <Section slug="digital-security" title="Digital Security" description="...">
 *     <ChecklistItem slug="signal" />
 *     <ChecklistItem slug="browser" />
 *   </Section>
 *
 * Counts direct ChecklistItem children to decide whether to show
 * the Expand/Collapse all button (only shown when count > 1).
 */
const Section = ({ slug, title, description, children }) => {
  const [expandTrigger, setExpandTrigger] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const triggerExpand = (shouldExpand) => {
    setIsExpanded(shouldExpand);
    setExpandTrigger({ timestamp: Date.now(), shouldExpand });
  };

  // Count ChecklistItem children to decide whether to show the toggle button
  const checklistItemCount = useMemo(() => {
    let count = 0;
    React.Children.forEach(children, (child) => {
      if (child?.props?.slug !== undefined || child?.type?.name === 'ChecklistItemMdx') {
        count++;
      }
    });
    return count;
  }, [children]);

  return (
    <SectionContext.Provider value={{ expandTrigger, triggerExpand }}>
      <div className="mb-4 prose prose-slate max-w-none">
        <div className="relative flex flex-col sm:block">
          <h2 id={slug} className={checklistItemCount > 1 ? 'sm:pr-32' : ''}>
            {title}
          </h2>
          {checklistItemCount > 1 && (
            <Button
              variant="defaultOutline"
              size="sm"
              className="gap-2 start print:hidden w-full sm:w-auto sm:absolute sm:bottom-0 sm:right-0 mt-2 sm:mt-0"
              onClick={() => triggerExpand(!isExpanded)}
            >
              {isExpanded ? 'Collapse all' : 'Expand all'}
            </Button>
          )}
        </div>
        {description && (
          <div className="mt-2">
            <p>{description}</p>
          </div>
        )}
      </div>
      {children}
    </SectionContext.Provider>
  );
};

export default Section;
