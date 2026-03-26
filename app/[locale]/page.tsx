// @ts-nocheck
import { setRequestLocale } from 'next-intl/server';
import { getAllChangelogEntries, getAllNewsItems, toChangelogListEntry, toNewsListItem } from '@/lib/content';
import { NEWS_BLOCK_DEFAULT_LIMIT } from '@/components/NewsBlock';
import HomePageContent from '@/components/pages/HomePageContent';

export default async function HomePage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const changelogEntries = getAllChangelogEntries(locale).map(toChangelogListEntry);
  const latestMajor = changelogEntries.find((e) => e.type === 'major');
  const newsItems = getAllNewsItems(locale).map(toNewsListItem);

  return (
    <HomePageContent
      changelogEntries={changelogEntries.slice(0, 5)}
      newsItems={newsItems.slice(0, NEWS_BLOCK_DEFAULT_LIMIT)}
      latestMajorBodyText={latestMajor?.bodyText ?? null}
      locale={locale}
    />
  );
}
