import React from 'react';
import ChangeLogEntry from './ChangeLogEntry';
import { cn } from "@/lib/utils";

const ChangeLogRecentEntries = ({ entries = [] }) => {
  if (!entries.length) {
    return (
      <div className="changelog-recent-entries">
        <div className="text-sm text-muted-foreground italic">
          No recent changes available
        </div>
      </div>
    );
  }

  return (
    <div className="changelog-recent-entries">
      <div className="relative">
        {entries.map((story, index) => (
          <div key={story.uuid} className="relative">
            <div className="py-3 pl-12 text-sm text-muted-foreground relative">
              {/* Timeline dot */}
              <div className="absolute left-5 top-[18px] w-2 h-2 bg-primary rounded-full"></div>
              {/* Timeline line */}
              {index < entries.length - 1 && (
                <div className="absolute left-[23px] top-[26px] w-px bg-border h-full"></div>
              )}
              <ChangeLogEntry 
                blok={story.content}
                story={story}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChangeLogRecentEntries;
