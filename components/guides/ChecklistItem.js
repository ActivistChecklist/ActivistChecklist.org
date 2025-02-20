import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { storyblokEditable } from '@storyblok/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { RichText } from '@/components/RichText';
import Markdown from '../Markdown';
import { Recommendations } from '@/components/guides/Recommendations'
import { IoInformationCircleOutline } from "react-icons/io5";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { useAnalytics } from '@/hooks/use-analytics';

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

const ChecklistItem = ({ blok, expandTrigger, index, editable = true }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const { trackEvent } = useAnalytics();
  const hasTrackedExpansion = useRef(false);
  const storageKey = `checklist-checked-${blok._uid}`;
  const expandedStorageKey = `checklist-expanded-${blok._uid}`;
  const checkedOpacity = 75;
  
  const setExpandedWithStorage = (expanded) => {
    setIsExpanded(expanded);
    localStorage.setItem(expandedStorageKey, expanded);
  };

  const setCheckedWithStorage = (checked) => {
    setIsChecked(checked);
    localStorage.setItem(storageKey, checked);
  };
  
  useEffect(() => {
    // Auto expand items if they've been linked to directly with an anchor $ in the URL
    const checkUrlHash = () => {
      const hash = window.location.hash.slice(1); // Remove the # symbol
      if (hash === blok.slug && !isChecked) {
        setExpandedWithStorage(true);
      }
    };

    // Initial check
    checkUrlHash();

    // Add hash change listener
    window.addEventListener('hashchange', checkUrlHash);
    
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

    // Cleanup listener
    return () => window.removeEventListener('hashchange', checkUrlHash);
  }, [storageKey, expandedStorageKey, blok.slug, isChecked]);

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
          item_id: window.location.pathname + "#" + blok.slug,
        }
      });
      hasTrackedExpansion.current = true;
    }
  };

  const handleCheckboxChange = async (checked) => {
    setCheckedWithStorage(checked);

    if (checked) {
      // Track the checkbox being checked
      await trackEvent({
        name: 'checklist_item_checked',
        data: {
          item_id: window.location.pathname + "#" + blok.slug,
        }
      });
    }
  };

  // Add this function to handle link clicks
  const handleLinkClick = (e) => {
    if (e.target.tagName.toLowerCase() === 'a') {
      e.stopPropagation();
    }
  };

  return (
    <Card
      {...(editable ? storyblokEditable(blok) : {})}
      className={cn(
        "checklist-item group/checklist-item",
        "transform mb-0 shadow-none bg-none rounded-none border-muted border-b-0 border-r-0 border-l-0 border-t-1",
        "hover:z-20 relative",
        !isExpanded && "hover:bg-muted/40",
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
          blok.why ? "items-start" : "items-center"
        )}>
          <div className={cn(
            "w-5 h-5 relative",
            blok.why ? "mt-1" : "mt-0"
          )}>
            {blok.type === 'info' ? (
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
                "flex items-start",
                isChecked && "text-muted-foreground",
                isChecked && `opacity-${checkedOpacity}`,
              )}
            >
              <h3 className={cn(
                  "flex-grow mt-0 text-lg",
                  isChecked && "line-through decoration-1"
                )}
                id={blok.slug}
                data-slug={blok.slug} 
              >
                {/* Had to remove markdown because our search indexer doesn't know the names of subitems unless the header text is an immediate child (and markdown wraps it in other elements like a div and span) */}
                {/* <Markdown inlineOnly={true} content={blok.title} /> */}
                {blok.title}
              </h3>
            </CardTitle>
            <CardDescription 
              className={cn(
                isChecked && "text-muted-foreground",
                isChecked && `opacity-${checkedOpacity}`,
              )}
            >
              <Markdown content={blok.why} isProse={false} />
            </CardDescription>
          </div>

          <ChevronDown 
            className={cn(
              "h-8 w-8 transition-transform duration-300 mt-1 text-neutral-500",
              "p-1 rounded-full group-hover:bg-neutral-200/60",
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
          "grid transition-all duration-300",
          "mt-2",
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
                content: blok.tools
              },
              {
                type: "dont",
                content: blok.stop
              }
            ]} />
            <RichText document={blok.body} />
          </CardContent>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ChecklistItem;