import React from 'react';
import Head from 'next/head';
import Link from '@/components/Link';
import { Shield, Users, ArrowRight, Sparkles } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ROUTES } from '../config/routes'
import { SECURITY_CHECKLISTS } from '../config/navigation';
import ChangeLogRecentEntries from '@/components/ChangeLogRecentEntries';
import GuideCard from '@/components/GuideCard';
import NewsBlock from '@/components/NewsBlock';

const HERO_CONTENT = {
  title: "Digital Security Checklists for Activists",
  description: "Plain language steps for digital security. Because protecting yourself helps keep your whole community safer.",
  primaryCta: {
    text: "Digital Security Essentials",
    href: ROUTES.CHECKLISTS.ESSENTIALS
  },
  secondaryCta: {
    text: "See all checklists",
    href: ROUTES.CHECKLISTS.LIST
  }
};

const ACTION_GUIDES = SECURITY_CHECKLISTS.items.slice(0, 6);

const TRUST_POINTS = [
  {
    icon: Users,
    title: "Built from experience",
    description: "Our guides draw from real organizing work and direct feedback from activists. While every situation is unique, we aim to share practical insights that can help inform your decisions."
  },
  // {
  //   icon: ClipboardCheck,
  //   title: "Field-Tested",
  //   description: "These aren't theoretical guides - they're based on what actually works in the field and feedback from folks like you"
  // },
  {
    icon: Shield,
    title: "Regularly updated",
    description: "Our content is regularly reviewed by organizers who understand security concerns. We work to keep information current as risks and technologies evolve."
  },
];

const COMMON_MISCONCEPTIONS = [
  {
    title: '"I have nothing to hide"',
    description: "The more engaged you are in any social movement work, the more your data can be used to map networks of activists. The best time to start protecting yourself is <b>before</b> you're as deeply involved."
  },
  {
    title: '"They already know everything"',
    description: "While data collection is widespread, you can significantly reduce your digital footprint and protect future activities."
  },
  {
    title: '"They don\'t care about what I\'m doing"',
    description: "Mass surveillance affects everyone. Your data can be used to profile communities, predict protests, or target those you care about. Protecting your communications helps protect all of us."
  },
];



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
      <p className="text-base text-muted-foreground" dangerouslySetInnerHTML={{ __html: description }} />
    </CardHeader>
  </Card>
);

const HomePage = ({ changelogEntries = [], newsItems = [], imageManifest = {} }) => {
  return (
    <div>
      <Head>
        <title>Activist Checklist - Digital Security for Activists</title>
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
                  {HERO_CONTENT.title}
                </h1>
                <p className="text-xl md:text-2xl mb-10 text-muted-foreground max-w-2xl mx-auto">
                  {HERO_CONTENT.description}
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button 
                    asChild 
                    variant="default" 
                    size="xl" 
                    className="group bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary transition-all"
                  >
                    <Link href={HERO_CONTENT.primaryCta.href} className="block group">
                      {HERO_CONTENT.primaryCta.text}
                      <ArrowRight className="ml-2 transition-transform duration-300 ease-out group-hover:translate-x-1" />
                    </Link>
                  </Button>
                  <Button asChild variant="muted" size="xl">
                    <Link href={HERO_CONTENT.secondaryCta.href}>
                      {HERO_CONTENT.secondaryCta.text}
                    </Link>
                  </Button>
                </div>
                <div className="mt-8 text-muted-foreground">
                  <span className="inline-flex items-baseline gap-1">
                    <Sparkles className="h-4 w-4 translate-y-[0.1em]" />
                    New in October 2025:
                  </span>{' '}
                  A{' '}
                  <Link href={ROUTES.NEWS} className="link">
                    News
                  </Link> aggregation page with articles about surveillance •{' '}
                  <Link href={ROUTES.CHECKLISTS.SPYWARE} className="link">
                    Protecting Against Spyware
                  </Link>{' '}checklist •{' '}
                  <Link href={ROUTES.MOVIES} className="link">
                    Movies and books about surveillance
                  </Link>
                  {' '}• And a {' '}
                  <Link href={ROUTES.POLICE_DOOR_POSTER} className="link">
                    "Police at the Door" printable poster
                  </Link>
                </div> 
              </div>
            </header>
          </div>

          {/* Quick Action Guides */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold mb-6">Digital Security Checklists</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {ACTION_GUIDES.map((guide, index) => (
                <GuideCard key={index} guideItem={guide} size="large" />
              ))}
            </div>
            <div className="mt-8 text-center">
              <Button asChild variant="outline" size="lg">
                <Link href={ROUTES.CHECKLISTS.LIST} className="group">
                  See all checklists <ArrowRight className="ml-2 transition-transform duration-300 ease-out group-hover:translate-x-1" />
                </Link>
              </Button>
            </div>
          </section>

          {/* Why Trust Us Section */}
          <section className="mb-16 bg-gradient-to-br from-muted via-muted to-accent/5 p-8 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-6">
                <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-br from-primary to-primary/70 bg-clip-text text-transparent">Simple guides<br />to keep us more safe</h2>
                <p className="text-xl text-muted-foreground">We built this because digital security shouldn't be overwhelming. We take a harm reduction approach: start where you are and do what you can.</p>
                {/* <div className="h-48 w-48 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 backdrop-blur-xl"></div> */}
              </div>
              <div className="space-y-0">
                {TRUST_POINTS.map((point, index) => (
                  <TrustPoint key={index} {...point} />
                ))}
              </div>
            </div>
          </section>

          {/* Common Misconceptions */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold mb-6">Common Misconceptions</h2>
            <p className="text-lg text-muted-foreground mb-8">When we start talking about digital security, we often hear these concerns. We think there's more to the story.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {COMMON_MISCONCEPTIONS.map((concern, index) => (
                <ConcernCard key={index} {...concern} />
              ))}
            </div>
          </section>

          {/* Latest News */}
          <NewsBlock newsItems={newsItems} imageManifest={imageManifest} />

          {/* Recent Updates */}
          <section className="mb-16">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Recent Site Updates</h2>
              <Button asChild variant="outline" size="sm">
                <Link href={ROUTES.CHANGELOG} className="group">
                  View all updates <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 ease-out group-hover:translate-x-1" />
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

export async function getStaticProps() {
  try {
    const { getStoryblokApi } = await import('@storyblok/react');
    const { getStoryblokVersion, fetchAllChangelogEntries, fetchNewsData } = await import('../utils/core');
    
    const storyblokApi = getStoryblokApi();
    
    // Fetch changelog entries and news data in parallel
    const [allEntries, { newsItems, imageManifest }] = await Promise.all([
      fetchAllChangelogEntries(storyblokApi, {
        version: getStoryblokVersion()
      }),
      fetchNewsData(storyblokApi, {
        version: getStoryblokVersion()
      })
    ]);

    // Sort changelog entries by first_published_at or created_at as fallback, newest first
    const sortedEntries = (allEntries || []).sort((a, b) => {
      const dateA = new Date(a.first_published_at || a.created_at);
      const dateB = new Date(b.first_published_at || b.created_at);
      return dateB - dateA; // Newest first
    });

    return {
      props: {
        changelogEntries: sortedEntries.slice(0, 5), // Limit to 5 for homepage
        newsItems,
        imageManifest
      }
    };
  } catch (error) {
    console.error('Error fetching homepage data:', error);
    return {
      props: {
        changelogEntries: [],
        newsItems: [],
        imageManifest: {}
      }
    };
  }
}

export default HomePage;