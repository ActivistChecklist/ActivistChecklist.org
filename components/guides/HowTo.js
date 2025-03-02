import React from 'react';
import { storyblokEditable } from '@storyblok/react';
import { cn } from "@/lib/utils";
import { RichText } from '@/components/RichText';
import { Settings } from "lucide-react";


export const HowTo = ({ blok }) => {

  return (
    <div className={cn(
      "how-to-container",
      "print:border print:border-border print:rounded-md",
      "mt-4 first:mt-0",
    )}>
      <div
        {...storyblokEditable(blok)}
        className={cn(
          "how-to mb-2 px-4 pb-4 md:px-6 relative",
          // "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-violet-600",
          "bg-background",
          "first:mt-0 last:mb-0",
          "rounded-md",
        )}
      >
        <div className="py-3 relative">
          {blok.title && (
            <>
              <Settings className={cn(
                "rounded-full absolute top-0",
                "text-muted-foreground",
                "md:bg-background md:-left-12 md:w-12 md:h-12 md:p-3 md:my-0", // Desktop
                "right-0 bg-transparent px-0 my-3 w-6 h-6", //. Mobile
              )}
              />
              {/* <div className="flex items-start"> */}
                {/* <Settings className="h-4 w-4 mr-2 mt-0.5" /> */}
                <h4 className="!text-sm !font-semibold !mb-4 uppercase tracking-tight text-muted-foreground">
                  {blok.title}
                </h4>
              {/* </div> */}
            </>
          )}
          <div className={cn(
            "prose prose-slate max-w-none"
          )}>
            <RichText document={blok.body} />
          </div>
        </div>
      </div>
    </div>
  );
};
