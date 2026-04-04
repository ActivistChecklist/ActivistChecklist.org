'use client';
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { SectionContext } from '@/contexts/SectionContext';
import { cn } from '@/lib/utils';

/** Sticky offset below viewport top — matches `h-14` top nav */
const NAV_TOP_PX = 56;
/**
 * While the big title row’s bottom edge moves from (nav + this) down to `nav`, the hero fades out.
 * No compact bar yet — avoids overlapping the two headers.
 */
const HERO_EXIT_PX = 56;
/**
 * After the title row has fully cleared above the nav line, compact opacity 0→1
 * over this many pixels of additional scroll.
 */
const COMPACT_ENTER_PX = 40;

/**
 * Section — MDX-mode guide section with expand/collapse-all support.
 *
 * Usage in MDX:
 *   <Section slug="digital-security" title="Digital Security" description="...">
 *     <ChecklistItem slug="signal" />
 *     <ChecklistItem slug="browser" />
 *     <!-- or Keystatic repeating group: -->
 *     <ChecklistItemGroup>
 *       <ChecklistItem slug="signal" />
 *       <ChecklistItem slug="browser" />
 *     </ChecklistItemGroup>
 *   </Section>
 *
 * Counts ChecklistItem children (direct or inside ChecklistItemGroup) for Expand/Collapse all.
 */
const Section = ({ slug, title, description, children }) => {
  const [expandTrigger, setExpandTrigger] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [heroOpacity, setHeroOpacity] = useState(1);
  const [compactOpacity, setCompactOpacity] = useState(0);
  const [dock, setDock] = useState({ left: 0, width: 0 });
  const [desktopMd, setDesktopMd] = useState(false);

  const sectionRef = useRef(null);
  /** Title row only — drives crossfade and scroll math (not description / intro). */
  const titleRowRef = useRef(null);

  const childrenArray = React.Children.toArray(children);

  const isChecklistItemChild = (child) =>
    child?.props?.slug !== undefined || child?.type?.name === 'ChecklistItemMdx';

  const isChecklistItemGroup = (child) => child?.type?.isChecklistItemGroup === true;

  /** Flatten direct ChecklistItems plus items inside `<ChecklistItemGroup>`. */
  const collectChecklistItemElements = (arr) => {
    const out = [];
    arr.forEach((child) => {
      if (isChecklistItemChild(child)) {
        out.push(child);
      } else if (isChecklistItemGroup(child)) {
        React.Children.forEach(child.props.children, (c) => {
          if (isChecklistItemChild(c)) out.push(c);
        });
      }
    });
    return out;
  };

  const triggerExpand = (shouldExpand) => {
    setIsExpanded(shouldExpand);
    setExpandTrigger({ timestamp: Date.now(), shouldExpand });
  };

  const checklistChildren = useMemo(
    () => collectChecklistItemElements(childrenArray),
    [childrenArray]
  );

  const checklistItemCount = checklistChildren.length;

  const sectionIntroChildren = useMemo(
    () =>
      childrenArray.filter((child) => !isChecklistItemChild(child) && !isChecklistItemGroup(child)),
    [childrenArray]
  );

  const hasChecklist = checklistItemCount >= 1;
  const showExpandAll = checklistItemCount > 1;

  const updateDock = useCallback(() => {
    const main = sectionRef.current?.closest('main');
    if (!main) return;
    const r = main.getBoundingClientRect();
    setDock({ left: r.left, width: r.width });
  }, []);

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    const onMq = () => setDesktopMd(mql.matches);
    onMq();
    mql.addEventListener('change', onMq);
    return () => mql.removeEventListener('change', onMq);
  }, []);

  const onScrollOrResize = useCallback(() => {
    if (!desktopMd || !hasChecklist) {
      setHeroOpacity(1);
      setCompactOpacity(0);
      return;
    }
    const sectionEl = sectionRef.current;
    const titleEl = titleRowRef.current;
    if (!sectionEl || !titleEl) return;

    updateDock();

    const sectionRect = sectionEl.getBoundingClientRect();
    const headerRect = titleEl.getBoundingClientRect();

    const pastSection = sectionRect.bottom <= NAV_TOP_PX + 2;
    if (pastSection) {
      setHeroOpacity(1);
      setCompactOpacity(0);
      return;
    }

    const nav = NAV_TOP_PX;
    const bottom = headerRect.bottom;

    // Hero: fades as the title row exits the viewport band below the nav (bottom edge sweeping up).
    let hero = 1;
    if (bottom <= nav) {
      hero = 0;
    } else if (bottom < nav + HERO_EXIT_PX) {
      hero = (bottom - nav) / HERO_EXIT_PX;
    }

    // Compact: only after the title row has cleared above the nav line (no collision with big header).
    let compact = 0;
    if (bottom < nav) {
      const overflow = nav - bottom;
      compact = Math.min(1, overflow / COMPACT_ENTER_PX);
    }

    setHeroOpacity(hero);
    setCompactOpacity(compact);
  }, [desktopMd, hasChecklist, updateDock]);

  useEffect(() => {
    if (!desktopMd || !hasChecklist) {
      setHeroOpacity(1);
      setCompactOpacity(0);
      return;
    }
    updateDock();
    onScrollOrResize();
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [desktopMd, hasChecklist, onScrollOrResize, updateDock]);

  const useFloating = desktopMd && hasChecklist;

  return (
    <SectionContext.Provider value={{ expandTrigger, triggerExpand }}>
      <section ref={sectionRef} className="relative">
        {useFloating && (
          <div
            className={cn(
              'print:hidden fixed z-40',
              'border-b bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/90',
              'transition-[opacity,transform] duration-200 ease-out',
            )}
            style={{
              top: NAV_TOP_PX,
              left: dock.left,
              width: dock.width,
              opacity: compactOpacity,
              transform: compactOpacity > 0.04 ? 'translateY(0)' : 'translateY(-8px)',
              pointerEvents: compactOpacity > 0.08 ? 'auto' : 'none',
            }}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-3.5">
              <p className="text-base font-semibold tracking-tight text-foreground truncate m-0" aria-hidden="true">
                {title}
              </p>
              {showExpandAll && (
                <Button
                  variant="defaultOutline"
                  size="sm"
                  className="gap-2 shrink-0"
                  onClick={() => triggerExpand(!isExpanded)}
                >
                  {isExpanded ? 'Collapse all' : 'Expand all'}
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="mb-4 prose prose-slate max-w-none">
          <div
            ref={titleRowRef}
            className={cn(
              'transition-opacity duration-200 ease-out',
              useFloating && 'md:transition-opacity',
            )}
            style={useFloating ? { opacity: heroOpacity } : undefined}
          >
            <div className="relative flex flex-col sm:block">
              <h2 id={slug} className={showExpandAll ? 'sm:pr-32' : ''}>
                {title}
              </h2>
              {showExpandAll && (
                <Button
                  variant="defaultOutline"
                  size="sm"
                  className="gap-2 print:hidden max-sm:w-full sm:w-fit sm:shrink-0 sm:absolute sm:bottom-0 sm:right-0 mt-2 sm:mt-0"
                  onClick={() => triggerExpand(!isExpanded)}
                >
                  {isExpanded ? 'Collapse all' : 'Expand all'}
                </Button>
              )}
            </div>
          </div>
          {description && (
            <div className="mt-2">
              <p>{description}</p>
            </div>
          )}
          {sectionIntroChildren.length > 0 && (
            <div className={description ? 'mt-2' : ''}>
              {sectionIntroChildren}
            </div>
          )}
        </div>
        {checklistChildren}
      </section>
    </SectionContext.Provider>
  );
};

export default Section;
