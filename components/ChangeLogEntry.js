import React, { useState, useEffect } from 'react';
import { storyblokEditable } from '@storyblok/react';
import { RichText } from '@/components/RichText';
import Markdown from '@/components/Markdown';
import { cn, formatRelativeDate } from "@/lib/utils";
import { IoStar } from 'react-icons/io5';

const ChangeLogEntry = ({ blok, story }) => {
  const [entryDate, setEntryDate] = useState('');
  const [isClient, setIsClient] = useState(false);

  if (!blok) {
    console.log('⚠️ ChangeLogEntry: blok is undefined. Skipping');
    return null;
  }

  const dateString = story?.first_published_at || story?.created_at || story?.published_at || new Date().toISOString();
  
  // Format date for hover tooltip (YYYY-MM-DD)
  const hoverDate = new Date(dateString).toISOString().split('T')[0];

  useEffect(() => {
    // Mark as client-side and format date
    setIsClient(true);
    setEntryDate(formatRelativeDate(dateString));
  }, [dateString]);

  // Show fallback date format during SSR/hydration
  const displayDate = isClient ? entryDate : hoverDate;

  return (
    <div 
      {...storyblokEditable(blok)}
      className={cn(
        "changelog-entry"
      )}
    >
      <div className="flex flex-col sm:flex-row sm:gap-2">
        <time 
          className="text-sm text-muted-foreground italic sm:w-20 sm:shrink-0 mb-1 sm:mb-0"
          dateTime={dateString}
          title={hoverDate}
        >
          {displayDate}
        </time>
        {(blok.body || blok.bodyText) && (
          <div className="flex items-start gap-1 flex-1">
            {blok.type === 'major' && (
              <IoStar className="text-yellow-500 shrink-0 mt-[2px]" size={16} />
            )}
            <div className="prose prose-slate max-w-none text-sm flex-1">
              {blok.body
                ? <RichText document={blok.body} noWrapper={true} {...storyblokEditable(blok)} />
                : <Markdown content={blok.bodyText} isProse={false} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChangeLogEntry;
