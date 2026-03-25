import { getAllChangelogEntries, getAllNewsItems, toChangelogListEntry, toNewsListItem } from '@/lib/content';
import { NEWS_BLOCK_DEFAULT_LIMIT } from '@/components/NewsBlock';
import HomePageContent from '@/components/pages/HomePageContent';

export default async function SpanishHomePage() {
  const changelogEntries = getAllChangelogEntries('es').map(toChangelogListEntry);
  const latestMajor = changelogEntries.find((e) => e.type === 'major');
  const newsItems = getAllNewsItems('es').map(toNewsListItem);

  return (
    <HomePageContent
      changelogEntries={changelogEntries.slice(0, 5)}
      newsItems={newsItems.slice(0, NEWS_BLOCK_DEFAULT_LIMIT)}
      latestMajorBodyText={latestMajor?.bodyText ?? null}
      locale="es"
    />
  );
}
