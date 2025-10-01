import React, { useState, useEffect } from 'react';
import { getStoryblokApi } from '@storyblok/react';
import { getStoryblokVersion } from '@/utils/core';
import ChangeLogEntry from './ChangeLogEntry';
import { cn } from "@/lib/utils";

const ChangeLogRecentEntries = ({ blok }) => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRecentEntries = async () => {
      try {
        setLoading(true);
        const storyblokApi = getStoryblokApi();
        
        const { data } = await storyblokApi.get('cdn/stories', {
          version: getStoryblokVersion(),
          filter_query: {
            component: {
              in: "changelog-entry"
            }
          },
          sort_by: 'first_published_at:desc',
          per_page: 5,
          excluding_fields: 'blocks'
        });

        // Sort by first_published_at or created_at as fallback, newest first
        const sortedEntries = (data.stories || []).sort((a, b) => {
          const dateA = new Date(a.first_published_at || a.created_at);
          const dateB = new Date(b.first_published_at || b.created_at);
          return dateB - dateA; // Newest first
        });

        setEntries(sortedEntries);
      } catch (err) {
        console.error('Error fetching changelog entries:', err);
        setError('Failed to load recent changes');
      } finally {
        setLoading(false);
      }
    };

    fetchRecentEntries();
  }, []);

  if (loading) {
    return (
      <div className="changelog-recent-entries">
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="flex items-baseline gap-2">
                <div className="h-4 bg-muted rounded w-20 shrink-0"></div>
                <div className="h-4 bg-muted rounded flex-1"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="changelog-recent-entries">
        <div className="text-sm text-muted-foreground italic">
          {error}
        </div>
      </div>
    );
  }

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
