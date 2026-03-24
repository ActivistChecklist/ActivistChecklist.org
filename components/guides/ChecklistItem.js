import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check, Link2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { RichText } from '@/components/RichText';
import { MDXRemote } from 'next-mdx-remote';
import Markdown from '../Markdown';
import { Recommendations } from '@/components/guides/Recommendations'
import { IoInformationCircleOutline } from "react-icons/io5";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAnalytics } from '@/hooks/use-analytics';
import { randomUUID } from 'crypto';
// Dictionary mapping title badge types to Badge components
const TITLE_BADGE_TYPES = {
  important: {
    label: "Important",
    variant: "destructive"
  }
};

const InfoItemIcon = () => {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2">
            <IoInformationCircleOutline 
              className={cn(
                "h-[1.7rem] w-[1.7rem]",
                "text-primary",
                "transition-colors duration-300"
              )}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent 
          side="top"
          sideOffset={5}
          className="z-[100]"
        >
          Informational item
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const CopyLinkButton = ({ slug, onCopy }) => {
  const [linkCopied, setLinkCopied] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
    const url = `${window.location.origin}${window.location.pathname}#${slug}`;
    
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTooltipOpen(true);
      
      // Call the parent's copy handler if provided
      if (onCopy) {
        onCopy(url);
      }
      
      // Reset after 2 seconds
      setTimeout(() => {
        setLinkCopied(false);
        setTooltipOpen(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip delayDuration={0} open={tooltipOpen} onOpenChange={setTooltipOpen}>
        <TooltipTrigger asChild>
          <button
            onClick={handleCopy}
            className={cn(
              "relative inline-block p-1.5 rounded-md transition-all duration-200 ml-2 align-middle",
              "hover:bg-neutral-200/60",
              "text-neutral-500 hover:text-neutral-700",
              "print:hidden",
              linkCopied && "text-green-600"
            )}
            aria-label="Copy link to this item"
          >
            <Link2 className={cn(
              "h-4 w-4 transition-all",
              linkCopied && "opacity-0 scale-0"
            )} />
            <Check className={cn(
              "h-4 w-4 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-all text-green-600",
              linkCopied ? "opacity-100 scale-100" : "opacity-0 scale-0"
            )} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={5}>
          {linkCopied ? "Link copied!" : "Copy link to this item"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * ChecklistItem — accepts either a `block` prop (legacy) or direct props from MDX context.
 *   Direct props: slug title type why tools stop titleBadges serializedBody bodyComponents
 *   localStorage keys are slug-based so they survive content remigration.
 */
const ChecklistItem = ({
  block,
  // MDX mode: direct props (normalized from frontmatter)
  slug: slugProp,
  title: titleProp,
  type: typeProp,
  why: whyProp,
  tools: toolsProp,
  stop: stopProp,
  titleBadges: titleBadgesProp,
  serializedBody,
  bodyComponents,
  // Shared
  expandTrigger,
  index,
  editable = true,
}) => {
  // Normalize props from either source
  const itemSlug = block?.slug ?? slugProp;
  const itemTitle = block?.title ?? titleProp;
  const itemType = block?.type ?? typeProp;
  const itemWhy = block?.why ?? whyProp;
  const itemTools = block?.tools ?? toolsProp;
  const itemStop = block?.stop ?? stopProp;
  const itemTitleBadges = block?.title_badges ?? titleBadgesProp ?? [];

  if (!itemSlug && !block) {
    console.log('⚠️⚠️⚠️⚠️ ChecklistItem: no slug or block provided. Skipping');
    return null;
  }

  const [isExpanded, setIsExpanded] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [enableTransitions, setEnableTransitions] = useState(false);
  const { trackEvent } = useAnalytics();
  const hasTrackedExpansion = useRef(false);
  const cardRef = useRef(null);
  // Use slug-based keys so progress persists across remigrations (not _uid)
  const storageKey = `checklist-checked-${itemSlug}`;
  const expandedStorageKey = `checklist-expanded-${itemSlug}`;
  const checkedOpacity = 60;

  const setExpandedWithStorage = (expanded) => {
    setIsExpanded(expanded);
    localStorage.setItem(expandedStorageKey, expanded);
  };

  const setCheckedWithStorage = (checked) => {
    setIsChecked(checked);
    localStorage.setItem(storageKey, checked);
  };

  // Track when component has mounted (client-side only)
  // This prevents the browser from scrolling to the hash on initial page load
  // because the id attribute won't be rendered until after mount
  useEffect(() => {
    setHasMounted(true);
    // Enable transitions after a brief delay to allow initial state restoration
    // to happen without animation
    const timer = setTimeout(() => {
      setEnableTransitions(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);
  
  useEffect(() => {
    // Load checked state
    const stored = localStorage.getItem(storageKey);
    if (stored !== null) {
      setCheckedWithStorage(stored === 'true');
    }

    // Load expanded state
    const storedExpanded = localStorage.getItem(expandedStorageKey);
    if (storedExpanded !== null) {
      setExpandedWithStorage(storedExpanded === 'true');
    }

    // Auto expand items if they've been linked to directly with an anchor in the URL
    // and scroll to them AFTER all items have restored their expanded states
    const checkUrlHash = (shouldScroll = false) => {
      const hash = window.location.hash.slice(1); // Remove the # symbol
      if (hash === itemSlug && !isChecked) {
        setExpandedWithStorage(true);
        
        // Scroll to this item after a delay to allow all other items to restore their states
        // This fixes the issue where other items expanding pushes the target down
        if (shouldScroll && cardRef.current) {
          // Use requestAnimationFrame + setTimeout to ensure DOM has updated
          requestAnimationFrame(() => {
            setTimeout(() => {
              if (cardRef.current) {
                const headerHeight = 80; // Approximate header/nav height buffer
                const cardTop = cardRef.current.getBoundingClientRect().top + window.scrollY;
                const targetScrollPosition = cardTop - headerHeight;
                
                window.scrollTo({
                  top: Math.max(0, targetScrollPosition),
                  behavior: 'smooth'
                });
              }
            }, 100); // Small delay to let layout stabilize (transitions are disabled on initial load)
          });
        }
      }
    };

    // Initial check - with scroll since this is page load
    checkUrlHash(true);

    // Add hash change listener - also scroll on hash change
    const handleHashChange = () => checkUrlHash(true);
    window.addEventListener('hashchange', handleHashChange);

    // Cleanup listener
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [storageKey, expandedStorageKey, itemSlug, isChecked]);

  // Handle expand/collapse trigger
  useEffect(() => {
    if (expandTrigger?.timestamp && !isChecked) {
      setExpandedWithStorage(expandTrigger.shouldExpand);
    }
  }, [expandTrigger, isChecked, expandedStorageKey]);
  
  const toggleExpanded = () => {
    const newExpandedState = !isExpanded;
    setExpandedWithStorage(newExpandedState);
    
    if (newExpandedState && !hasTrackedExpansion.current) {
      trackEvent({
        name: 'checklist_item_expanded',
        data: {
          item_id: itemSlug,
        }
      });
      hasTrackedExpansion.current = true;
    }
  };

  const handleCheckboxChange = async (checked, shouldCollapseAfterDelay = false) => {
    setCheckedWithStorage(checked);

    if (checked) {
      // Track the checkbox being checked
      await trackEvent({
        name: 'checklist_item_checked',
        data: {
          item_id: itemSlug,
        }
      });

      // If requested, collapse after a delay to show completion state briefly
      if (shouldCollapseAfterDelay && isExpanded) {

        // Scroll to keep the collapsed item visible at the top with buffer
        if (cardRef.current) {
          const headerHeight = 80; // Approximate header/nav height buffer
          const cardTop = cardRef.current.getBoundingClientRect().top + window.scrollY;
          const targetScrollPosition = cardTop - headerHeight;
          
          window.scrollTo({
            top: Math.max(0, targetScrollPosition),
            behavior: 'smooth'
          });
        }

        setExpandedWithStorage(false);
      }
    }
  };

  // Add this function to handle link clicks
  const handleLinkClick = (e) => {
    if (e.target.tagName.toLowerCase() === 'a') {
      e.stopPropagation();
    }
  };

  const handleLinkCopy = (url) => {
    // Track the copy event
    trackEvent({
      name: 'checklist_item_link_copied',
      data: {
        item_id: itemSlug,
      }
    });
  };

  return (
    <Card
      ref={cardRef}
      className={cn(
        "checklist-item group/checklist-item",
        "transform mb-0 shadow-none bg-none rounded-none border-muted border-b-0 border-r-0 border-l-0 border-t-1",
        "hover:z-20 relative",
        !isExpanded && !isChecked && "hover:bg-muted/40",
        isExpanded && "mb-4 rounded-lg border-transparent",
        isExpanded && "bg-muted",
        "[transition:margin_300ms,border-radius_300ms,border_300ms,box-shadow_300ms]"
      )}
    >
      <CardHeader 
        className={cn(
          "p-3 pl-3 md:pl-5 cursor-pointer group",
          isExpanded && "rounded-t-lg"
        )}
        onClick={toggleExpanded}
        onClickCapture={handleLinkClick}
      >
        <div className={cn(
          "grid grid-cols-[auto_1fr_auto] gap-3",
          itemWhy ? "items-start" : "items-center"
        )}>
          <div className={cn(
            "w-5 h-5 relative",
            itemWhy ? "mt-1" : "mt-0"
          )}>
            {itemType === 'info' ? (
              <InfoItemIcon />
            ) : (
              <div onClick={(e) => e.stopPropagation()}>
                <Checkbox 
                  checked={isChecked}
                  onCheckedChange={handleCheckboxChange}
                  className={cn(
                    "h-5 w-5 cursor-pointer rounded-sm transition-colors duration-300 border-2",
                  )}
                />
              </div>
            )}
          </div>
          
          <div>
            <CardTitle 
              className={cn(
                isChecked && "text-muted-foreground",
                isChecked && `opacity-${checkedOpacity}`,
              )}
            >
              <h3 className="inline mt-0 text-lg"
                id={hasMounted ? itemSlug : undefined}
                data-slug={itemSlug}
              >
                {/* Render title badges inline at the beginning */}
                {itemTitleBadges && itemTitleBadges.length > 0 && (
                  <>
                    {itemTitleBadges.map((badgeType, index) => {
                      const badgeConfig = TITLE_BADGE_TYPES[badgeType];
                      if (!badgeConfig) return null;
                      
                      return (
                        <Badge 
                          key={index}
                          variant={badgeConfig.variant}
                          className={cn(
                            "text-xs inline mr-2 align-middle",
                            isChecked && "opacity-50"
                          )}
                        >
                          {badgeConfig.label}
                        </Badge>
                      );
                    })}
                  </>
                )}
                {/* Had to remove markdown because our search indexer doesn't know the names of subitems unless the header text is an immediate child (and markdown wraps it in other elements like a div and span) */}
                {/* <Markdown inlineOnly={true} content={block.title} /> */}
                {itemTitle}

                {/* Copy link button - inline, only visible when expanded */}
                {isExpanded && (
                  <span className="inline-block ml-2">
                    <CopyLinkButton slug={itemSlug} onCopy={handleLinkCopy} />
                  </span>
                )}
              </h3>
            </CardTitle>
            <CardDescription 
              className={cn(
                isChecked && "text-muted-foreground",
                isChecked && `opacity-${checkedOpacity}`,
              )}
            >
              <Markdown content={itemWhy} isProse={false} />
            </CardDescription>
          </div>

          <ChevronDown 
            className={cn(
              "h-8 w-8 mt-1 text-neutral-500",
              enableTransitions ? "transition-transform duration-300" : "transition-none",
              "p-1 rounded-full group-hover:bg-neutral-200/60",
              "print:hidden",
              isExpanded && "rotate-180",
              isExpanded && "group-hover:bg-neutral-300/50",
              isChecked && "text-muted-foreground",
              isChecked && `opacity-${checkedOpacity}`,
            )}
          />
        </div>
      </CardHeader>
      
      <div
        className={cn(
          "grid mt-2",
          enableTransitions ? "transition-all duration-300" : "transition-none",
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          isChecked && `opacity-${checkedOpacity}`,
        )}
      >
      <div className="overflow-hidden">
        <div className="ml-4 md:ml-12 pl-0 mb-6">
          <CardContent className={cn(
            "py-0 pt-0 pl-0 md:pl-4 pr-4 md:pr-6",
            "prose prose-slate max-w-none",
            isChecked && "text-muted-foreground"
          )}>
            <Recommendations items={[
              {
                type: "do",
                content: itemTools
              },
              {
                type: "dont",
                content: itemStop
              }
            ]} />
            {serializedBody
              ? <MDXRemote {...serializedBody} components={bodyComponents} />
              : <RichText document={block?.body} />}

            {/* Mark as done button row */}
            {itemType !== 'info' && (
              <div className={cn(
                "pt-4 border-muted-foreground/20",
                "flex flex-col sm:flex-row items-start sm:items-center gap-3",
                "w-full"
              )}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCheckboxChange(!isChecked, !isChecked); // Collapse after delay only when marking as done
                  }}
                  className={cn(
                    "flex items-center justify-center sm:justify-start gap-3 transition-all duration-300",
                    "w-full sm:w-auto sm:min-w-[140px] py-3 sm:py-2",
                    // Primary outline styling for unchecked state
                    !isChecked && "border-primary text-primary hover:bg-primary/10 hover:text-primary hover:border-primary",
                    // Primary filled styling for checked state
                    isChecked && "bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:border-primary hover:text-primary-foreground"
                  )}
                >
                  <Check className={cn(
                    "h-4 w-4 transition-all duration-300 font-bold stroke-[3]",
                    // Unchecked state - primary checkmark
                    !isChecked && "text-primary",
                    // Checked state - primary-foreground checkmark
                    isChecked && "text-primary-foreground"
                  )} />
                  {isChecked ? "Completed" : "Mark as done"}
                </Button>
              </div>
            )}
          </CardContent>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ChecklistItem;