// @ts-nocheck
import { setRequestLocale } from 'next-intl/server';
import { getAllChangelogEntries, getAllNewsItems, toChangelogListEntry, toNewsListItem } from '@/lib/content';
import { NEWS_BLOCK_DEFAULT_LIMIT } from '@/components/NewsBlock';
import HomePageContent from '@/components/pages/HomePageContent';
import { DEFAULT_LOCALE } from '@/lib/i18n-config';

function getMessageValue(messages, keyPath) {
  return keyPath.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), messages);
}

export async function generateMetadata({ params }) {
  const { locale } = await params;
  let messages;

  try {
    messages = (await import(`@/messages/${locale}.json`)).default;
  } catch {
    messages = (await import(`@/messages/${DEFAULT_LOCALE}.json`)).default;
  }

  const title = getMessageValue(messages, 'site.title') || 'Activist Checklist';
  const description =
    getMessageValue(messages, 'site.description') ||
    'Plain language steps for digital security, because protecting yourself helps keep your whole community safer.';

  return {
    title,
    description,
  };
}

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
