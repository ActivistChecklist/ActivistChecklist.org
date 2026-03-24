const path = require('path');

const baseConfig = {
  trailingSlash: true,
  images: {
    unoptimized: true,
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
    locales: ['en', 'es'],
    defaultLocale: 'en',
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