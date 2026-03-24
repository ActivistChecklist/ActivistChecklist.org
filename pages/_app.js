import "../styles/globals.css";
import { NextIntlClientProvider, IntlErrorCode } from 'next-intl';
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import ErrorBoundary from '../components/development/ErrorBoundary';
import { useRouter } from 'next/router';
import Head from 'next/head';

import { getBaseUrl } from "@/lib/utils";

function MyApp({ Component, pageProps }) {
  const router = useRouter();

  const { key, ...props } = pageProps;
  
  const baseUrl = getBaseUrl();
  const defaultOgImage = `${baseUrl}/images/og-image.png`;

  const intlLocale = router.locale || 'en';

  const handleIntlError = (error) => {
    if (error.code === IntlErrorCode.ENVIRONMENT_FALLBACK) return;
    if (error.code === IntlErrorCode.MISSING_MESSAGE) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[i18n] Missing translation: ${error.message}`);
      }
      return;
    }
    console.error(error);
  };

  return (
    <NextIntlClientProvider locale={intlLocale} messages={pageProps.messages || {}} onError={handleIntlError}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <Head>
            {/* Favicons and basic meta tags */}
            <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
            <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
            <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
            <link rel="icon" type="image/x-icon" href="/favicon.ico" />
            <link rel="manifest" href="/site.webmanifest" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <meta charSet="utf-8" />

            {/* Default meta tags - these will be overridden by page-specific ones */}
            <meta name="description" content="Plain language steps for digital security, because protecting yourself helps keep your whole community safer. Built by activists, for activists with field-tested, community-verified guides." key="description" />
            <meta property="og:type" content="website" key="og:type" />
            <meta property="og:title" content="Digital Security Checklists for Activists" key="og:title" />
            <meta property="og:description" content="Plain language steps for digital security, because protecting yourself helps keep your whole community safer. Built by activists, for activists with field-tested, community-verified guides." key="og:description" />
            <meta property="og:image" content={defaultOgImage} key="og:image" />
            <meta name="twitter:card" content="summary_large_image" key="twitter:card" />
            <meta name="twitter:title" content="Digital Security Checklists for Activists" key="twitter:title" />
            <meta name="twitter:description" content="Plain language steps for digital security, because protecting yourself helps keep your whole community safer. Built by activists, for activists with field-tested, community-verified guides." key="twitter:description" />
            <meta name="twitter:image" content={defaultOgImage} key="twitter:image" />
            <meta name="fediverse:creator" content="@activistchecklist@kolektiva.social" />
          </Head>
          <ErrorBoundary>
            <Component key={key} {...props} />
          </ErrorBoundary>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}

export default MyApp;

