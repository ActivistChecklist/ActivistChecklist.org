import React from 'react';
import Head from 'next/head';
import Link from '@/components/Link';
import { useRouter } from 'next/router';
import { Shield, Users, ArrowRight, Sparkles } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn, getBaseUrl } from '@/lib/utils';
import { ROUTES } from '../config/routes'
import { SECURITY_CHECKLISTS } from '../config/navigation';
import ChangeLogRecentEntries from '@/components/ChangeLogRecentEntries';
import GuideCard from '@/components/GuideCard';
import NewsBlock from '@/components/NewsBlock';
import { RichText } from '@/components/RichText';
import Markdown from '@/components/Markdown';
import { useTranslations } from 'next-intl';

const ACTION_GUIDES = SECURITY_CHECKLISTS.items.slice(0, 8);

const TrustPoint = ({ icon: Icon, title, description }) => (
  <Card className="bg-transparent border-0 shadow-none transition-all duration-300">
  <CardHeader className="flex flex-row items-start gap-6 space-y-0">
    <div className="p-2 rounded-lg bg-primary/10">
      <Icon className="h-6 w-6 text-primary flex-shrink-0" />
    </div>
    <div>
      <CardTitle className="text-lg">{title}</CardTitle>
      <CardDescription className="text-base">{description}</CardDescription>
    </div>
  </CardHeader>
</Card>
);

const ConcernCard = ({ title, description }) => (
  <Card className="bg-muted border-0">
    <CardHeader>
      <CardTitle className="text-lg font-semibold text-foreground">{title}</CardTitle>
      <p className="text-base text-muted-foreground">{description}</p>
    </CardHeader>
  </Card>
);

const HomePage = ({ changelogEntries = [], newsItems = [], latestMajorUpdate = null }) => {
  const t = useTranslations();
  const router = useRouter();
  const baseUrl = getBaseUrl();
  const locale = router.locale;
  const defaultLocale = router.defaultLocale;

  return (
    <div>
      <Head>
        <title>{t('site.title')}</title>
        <link rel="canonical" href={locale === defaultLocale ? `${baseUrl}/` : `${baseUrl}/${locale}/`} key="canonical" />
        <link rel="alternate" hreflang="en" href={`${baseUrl}/`} key="hreflang-en" />
        <link rel="alternate" hreflang="es" href={`${baseUrl}/es/`} key="hreflang-es" />
        <link rel="alternate" hreflang="x-default" href={`${baseUrl}/`} key="hreflang-default" />
      </Head>
      <Layout sidebarType={null} searchable={false} fullWidthMain={true}>
        <div className="max-w-6xl mx-auto px-4 py-8 -my-6 container">
          {/* Hero Section */}
          <div className="">
            <header className={cn(
              "not-prose relative left-1/2 w-dvw max-w-none -translate-x-1/2",
              "relative mb-16 -mt-8 py-16 px-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background overflow-hidden",
              "before:content-[''] before:fixed before:inset-0 before:bg-[linear-gradient(to_right,var(--tw-gradient-stops))] before:from-primary/10 before:via-accent/5 before:to-primary/10 before:opacity-70 before:pointer-events-none"
            )}>
              <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--tw-gradient-stops))] from-primary/10 via-accent/5 to-primary/10 opacity-70"></div>
              <div className="relative max-w-4xl mx-auto text-center">
                <h1 className="text-5xl md:text-6xl font-heavy mb-6 bg-gradient-to-br from-primary via-primary to-primary/70 bg-clip-text text-transparent text-balance">
                  {t('hero.title')}
                </h1>
                <p className="text-xl md:text-2xl mb-10 text-muted-foreground max-w-2xl mx-auto">
                  {t('hero.description')}
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    asChild
                    variant="default"
                    size="xl"
                    className="group bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary transition-all"
                  >
                    <Link href={ROUTES.CHECKLISTS.ESSENTIALS} className="block group">
                      {t('hero.primaryCta')}
                      <ArrowRight className="ml-2 transition-transform duration-300 ease-out group-hover:translate-x-1" />
                    </Link>
                  </Button>
                  <Button asChild variant="muted" size="xl">
                    <Link href={ROUTES.CHECKLISTS.LIST}>
                      {t('hero.secondaryCta')}
                    </Link>
                  </Button>
                </div>
                {latestMajorUpdate && (
                  <div className="mt-8 text-muted-foreground">
                    <Sparkles className="h-4 w-4 inline mr-1" />
                    {latestMajorUpdate.body
                      ? <RichText document={latestMajorUpdate.body} noWrapper={true} />
                      : <Markdown content={latestMajorUpdate.bodyText} isProse={false} inlineOnly={true} />}
                  </div>
                )}
              </div>
            </header>
          </div>

          {/* Quick Action Guides */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold mb-6">{t('homepage.checklistsHeading')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {ACTION_GUIDES.map((guide, index) => (
                <GuideCard key={index} guideItem={guide} size="large" />
              ))}
            </div>
            <div className="mt-8 text-center">
              <Button asChild variant="outline" size="lg">
                <Link href={ROUTES.CHECKLISTS.LIST} className="group">
                  {t('homepage.browseAll')} <ArrowRight className="ml-2 transition-transform duration-300 ease-out group-hover:translate-x-1" />
                </Link>
              </Button>
            </div>
          </section>

          {/* Why Trust Us Section */}
          <section className="mb-16 bg-gradient-to-br from-muted via-muted to-accent/5 p-8 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-6">
                <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-br from-primary to-primary/70 bg-clip-text text-transparent">{t('homepage.trustHeading')}</h2>
                <p className="text-xl text-muted-foreground">{t('homepage.trustDescription')}</p>
                {/* <div className="h-48 w-48 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 backdrop-blur-xl"></div> */}
              </div>
              <div className="space-y-0">
                <TrustPoint icon={Users} title={t('trustPoints.experienceTitle')} description={t('trustPoints.experienceDescription')} />
                <TrustPoint icon={Shield} title={t('trustPoints.updatedTitle')} description={t('trustPoints.updatedDescription')} />
              </div>
            </div>
          </section>

          {/* Common Misconceptions */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold mb-6">{t('misconceptions.sectionTitle')}</h2>
            <p className="text-lg text-muted-foreground mb-8">{t('misconceptions.sectionDescription')}</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <ConcernCard
                title={t('misconceptions.nothingToHideTitle')}
                description={t.rich('misconceptions.nothingToHideDescription', {
                  b: (chunks) => <b>{chunks}</b>
                })}
              />
              <ConcernCard
                title={t('misconceptions.alreadyKnowTitle')}
                description={t.rich('misconceptions.alreadyKnowDescription', {
                  b: (chunks) => <b>{chunks}</b>
                })}
              />
              <ConcernCard
                title={t('misconceptions.dontCareTitle')}
                description={t.rich('misconceptions.dontCareDescription', {
                  b: (chunks) => <b>{chunks}</b>
                })}
              />
            </div>
          </section>

          {/* Latest News */}
          <NewsBlock newsItems={newsItems} />

          {/* Recent Updates */}
          <section className="mb-16">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">{t('homepage.recentUpdatesHeading')}</h2>
              <Button asChild variant="outline" size="sm">
                <Link href={ROUTES.CHANGELOG} className="group">
                  {t('homepage.viewAllUpdates')} <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 ease-out group-hover:translate-x-1" />
                </Link>
              </Button>
            </div>
            <ChangeLogRecentEntries entries={changelogEntries} />
          </section>


        </div>
      </Layout>
    </div>
  );
};

export async function getStaticProps({ locale = 'en' }) {
  const { getAllChangelogEntries, getAllNewsItems, toChangelogWireEntry, toNewsWireItem, getAllNewsSourcesMap } = await import('@/lib/content');
  const messages = (await import(`../messages/${locale}.json`)).default;

  const changelogEntries = getAllChangelogEntries(locale).map(toChangelogWireEntry);

  // Latest major update for hero section
  const latestMajor = changelogEntries.find((e) => e.content.type === 'major');
  const latestMajorUpdate = latestMajor
    ? { body: null, bodyText: latestMajor.content.bodyText }
    : null;

  const sourcesMap = getAllNewsSourcesMap(locale);
  const newsItems = getAllNewsItems(locale).map(item => toNewsWireItem(item, sourcesMap));

  return {
    props: {
      changelogEntries: changelogEntries.slice(0, 5),
      newsItems,
      latestMajorUpdate,
      messages,
    },
  };
}

export default HomePage;
