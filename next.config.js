const path = require('path');

const DEFAULT_LOCALE = 'en';
const KNOWN_LOCALES = ['en', 'es'];

function getActiveLocales() {
  const fromEnv = process.env.ENABLED_LOCALES;
  if (fromEnv) {
    const parsed = fromEnv
      .split(',')
      .map((locale) => locale.trim())
      .filter(Boolean)
      .filter((locale) => KNOWN_LOCALES.includes(locale));
    if (parsed.length > 0) return parsed;
  }

  // Default workflow: all locales in dev, only English in preview/production.
  return process.env.NODE_ENV === 'development' ? KNOWN_LOCALES : [DEFAULT_LOCALE];
}

const activeLocales = getActiveLocales();

const baseConfig = {
  trailingSlash: true,
  env: {
    NEXT_PUBLIC_ACTIVE_LOCALES: activeLocales.join(','),
  },
  images: {
    unoptimized: true,
    domains: ['a.storyblok.com'],
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname),
    };
    
    // Exclude fs from client-side bundles
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    
    return config;
  },
};

// All of these only apply for static builds
if (process.env.BUILD_MODE === 'static') {
  baseConfig.output = 'export';
  baseConfig.distDir = 'out';
  delete baseConfig.images.domains;
  baseConfig.images.loader = 'custom';
  baseConfig.images.loaderFile = './utils/imageLoader.js';
}

// i18n is incompatible with static export — only enable for SSR builds
if (process.env.BUILD_MODE !== 'static') {
  baseConfig.i18n = {
    locales: activeLocales,
    defaultLocale: DEFAULT_LOCALE,
  };
}

const nextConfig = process.env.NODE_ENV === 'development'
  ? {
    ...baseConfig,
    rewrites: async () => ([
      {
        source: '/api-server/:path*',
        destination: 'http://localhost:4321/api-server/:path*'
      }
    ])
  }
  : baseConfig;

module.exports = nextConfig