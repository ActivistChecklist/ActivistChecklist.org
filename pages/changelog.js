import React from 'react';
import Head from 'next/head';
import Layout from '@/components/layout/Layout';
import ChangeLogEntry from '@/components/ChangeLogEntry';
import RSSButton from '@/components/ui/RSSButton';
import { cn } from "@/lib/utils";

const ChangelogPage = ({ changelogEntries = [] }) => {
  // Group entries by time periods
  const groupEntriesByTime = (entries) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    
    const groups = {
      last30Days: [],
      thisYear: [],
      previousYears: {}
    };

    entries.forEach(entry => {
      const entryDate = new Date(entry.first_published_at || entry.created_at);
      const entryYear = entryDate.getFullYear();
      
      if (entryDate >= thirtyDaysAgo) {
        groups.last30Days.push(entry);
      } else if (entryYear === currentYear) {
        groups.thisYear.push(entry);
      } else {
        if (!groups.previousYears[entryYear]) {
          groups.previousYears[entryYear] = [];
        }
        groups.previousYears[entryYear].push(entry);
      }
    });

    return groups;
  };

  const groupedEntries = groupEntriesByTime(changelogEntries);
  
  // Get sorted years for previous years (newest first)
  const sortedYears = Object.keys(groupedEntries.previousYears)
    .map(year => parseInt(year))
    .sort((a, b) => b - a);

  const TimelineSection = ({ title, entries, isFirst = false }) => {
    if (!entries.length) return null;

    return (
      <section className={cn("mb-12", !isFirst && "border-t pt-8")}>
        <h2 className="text-2xl font-bold mb-6 text-foreground">{title}</h2>
        <div className="relative">
          {entries.map((story, index) => (
            <div key={story.uuid} id={story.uuid} className="relative">
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
      </section>
    );
  };

  return (
    <div>
      <Head>
        <title>Recent Site Updates - Activist Checklist</title>
        <meta name="description" content="Complete changelog of updates and improvements to Activist Checklist digital security guides." />
        <link 
          rel="alternate" 
          type="application/rss+xml" 
          title="Activist Checklist - Recent Updates" 
          href="/rss/changelog.xml" 
        />
      </Head>
      <Layout>
        <div className="max-w-4xl mx-auto">
          <header className="mb-8">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="page-title">Recent site updates</h1>
                <p className="text-lg text-muted-foreground">
                  A history of changes to checklists, pages, and resources on the site.
                </p>
              </div>
              <RSSButton 
                href="/rss/changelog.xml" 
                variant="outline"
                size="sm"
              />
            </div>
          </header>

          {changelogEntries.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No changelog entries found.</p>
            </div>
          ) : (
            <div className="space-y-0">
              <TimelineSection 
                title="Last 30 days" 
                entries={groupedEntries.last30Days}
                isFirst={true}
              />
              
              <TimelineSection 
                title="Previous changes" 
                entries={groupedEntries.thisYear}
              />
              
              {sortedYears.map(year => (
                <TimelineSection 
                  key={year}
                  title={year.toString()} 
                  entries={groupedEntries.previousYears[year]}
                />
              ))}
            </div>
          )}
        </div>
      </Layout>
    </div>
  );
};

export async function getStaticProps({ locale = 'en' }) {
  const { getAllChangelogEntries, toChangelogWireEntry } = await import('@/lib/content');
  const messages = (await import(`../messages/${locale}.json`)).default;

  const changelogEntries = getAllChangelogEntries(locale).map(toChangelogWireEntry);

  return {
    props: { changelogEntries, messages },
  };
}

export default ChangelogPage;
