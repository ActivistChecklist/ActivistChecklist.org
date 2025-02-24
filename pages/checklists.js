import { getStoryblokApi, storyblokEditable } from "@storyblok/react";
import Head from 'next/head';
import Layout from '@/components/layout/Layout';
import Link from '@/components/Link';
import { ArrowRight } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card"
import { getStoryblokVersion } from "@/utils/core";
import { RichText } from '@/components/RichText';
import { ROUTES } from '../config/routes'


const GuideList = ({ blok, guides }) => {
  return (
    <div> 
      <Head>
        <title>Checklists</title>
      </Head>
      <Layout searchable={false} sidebarType={null}>
        <div {...storyblokEditable(blok)} className="">
          <h1 className="page-title">
            Checklists
          </h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {guides.map((guide) => (
              <Link href={`/${guide.slug}`} key={guide.uuid} className="block hover:no-underline group">
                <Card className="h-full transition-all duration-200 group-hover:shadow-lg group-hover:scale-[1.02] group-hover:border-primary/50">
                  <CardHeader>
                    <CardTitle className="text-xl group-hover:text-primary">
                      {guide.content.title}
                    </CardTitle>
                    <CardDescription>
                      {guide.content.summary && (
                        <RichText document={guide.content.summary} className="text-sm text-muted-foreground border-t pt-2" />
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardFooter>
                    <span className="text-primary font-medium inline-flex items-center">
                      Read Guide <ArrowRight className="ml-2 transition-transform duration-300 ease-out group-hover:translate-x-1" />
                    </span>
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </Layout>
    </div>
  );
};

export async function getStaticProps() {
  const storyblokApi = getStoryblokApi();
  const { data } = await storyblokApi.get(`cdn/stories`, {
    version: getStoryblokVersion(),
    filter_query: {
      component: {
        in: "guide"
      }
    },
    excluding_fields: 'body,blocks',
    resolve_links: 'url'
  });

  const guides = data.stories.map((guide) => {
    guide.content.slug = guide.slug;
    return guide;
  });

  return {
    props: {
      guides
    },
    // revalidate: 3600 // Revalidate every hour
  };
}

export default GuideList;
