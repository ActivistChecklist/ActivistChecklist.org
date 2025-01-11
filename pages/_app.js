import "../styles/globals.css";
import { storyblokInit, apiPlugin } from "@storyblok/react";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import ErrorBoundary from '../components/development/ErrorBoundary';
import { useEffect } from "react";
import Head from 'next/head';

import Page from "../components/pages/Page";
import ChecklistItem from "../components/guides/ChecklistItem";
import Guide, { SectionHeader } from "../components/guides/Guide";
import ChecklistItemReference from "../components/guides/ChecklistItemReference";

const components = {
  page: Page,
  guide: Guide,
  "checklist-item": ChecklistItem,
  "checklist-item-reference": ChecklistItemReference,
  "section-header": SectionHeader,
};

storyblokInit({
  accessToken: process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN,
  use: [apiPlugin],
  components,
  apiOptions: {
    region: "us",
    version: process.env.NODE_ENV === 'development' ? 'draft' : 'published'
  },
  bridge: true // Enable the Storyblok Bridge for visual editing
  // richText: {},
  // enableFallbackComponent: false,
  // customFallbackComponent: FallbackComponent,
});

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    // Re-initialize bridge on client side for preview mode
    if (process.env.NODE_ENV === 'development') {
      const { StoryblokBridge } = window
      if (typeof StoryblokBridge !== 'undefined') {
        const storyblokInstance = new StoryblokBridge()
        storyblokInstance.on(['input', 'published', 'change'], () => {
          // Reload page on content changes
          location.reload()
        })
      }
    }
  }, [])

  const { key, ...props } = pageProps;
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <Head>
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta charSet="utf-8" />
        <meta name="description" content="Plain language steps for digital security, because protecting yourself helps keep your whole community safer. Built by activists, for activists with field-tested, community-verified guides." />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Digital Security Checklists for Activists" />
        <meta property="og:description" content="Plain language steps for digital security, because protecting yourself helps keep your whole community safer. Built by activists, for activists with field-tested, community-verified guides." />
        <meta property="og:image" content="/og-image.jpg" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Digital Security Checklists for Activists" />
        <meta name="twitter:description" content="Plain language steps for digital security, because protecting yourself helps keep your whole community safer. Built by activists, for activists with field-tested, community-verified guides." />
        <meta name="twitter:image" content="/og-image.jpg" />
      </Head>
      <ErrorBoundary>
        <Component key={key} {...props} />
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default MyApp;

