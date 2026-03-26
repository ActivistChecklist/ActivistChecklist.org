const path = require('path');
const webpack = require('webpack');
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

    // Static export cannot run Keystatic API routes; swap in 404 stubs at build time.
    if (process.env.BUILD_MODE === 'static') {
      const stubDir = path.join(__dirname, 'lib', 'stubs');
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /[\\/]app[\\/]api[\\/]keystatic[\\/]\[\.\.\.params\][\\/]route\.ts$/,
          path.join(stubDir, 'keystatic-api-catchall.ts')
        ),
        new webpack.NormalModuleReplacementPlugin(
          /[\\/]app[\\/]api[\\/]keystatic[\\/]checklist-item-preview[\\/]route\.ts$/,
          path.join(stubDir, 'keystatic-checklist-preview.ts')
        )
      );
    }

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

// i18n is handled by App Router [locale] dynamic segment + next-intl.
// Static export generates /en/ and /es/ directories; .htaccess rewrites bare URLs to /en/.

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