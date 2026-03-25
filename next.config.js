const path = require('path');
const createNextIntlPlugin = require('next-intl/plugin');

const baseConfig = {
  transpilePackages: ['next-mdx-remote'],
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

// i18n is handled by App Router route structure ((en)/ and es/ route groups),
// not by next.config.js i18n block (which is Pages Router only).

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

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');
module.exports = withNextIntl(nextConfig);