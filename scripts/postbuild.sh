#!/bin/bash
# Post-build tasks for ActivistChecklist.org
# Runs automatically after `next build` via the postbuild npm hook

set -e

# Export Storyblok images (skip on Vercel)
if [ "$VERCEL" != "1" ]; then
  yarn storyblockexportimages
fi

# Generate sitemap, RSS feed, and search index
next-sitemap
yarn rss
yarn index

# Static build tasks
if [ "$BUILD_MODE" = "static" ]; then
  cp public/.htaccess out/.htaccess
fi

# Fetch news images (skip on Vercel)
if [ "$VERCEL" != "1" ]; then
  yarn fetch-news -q

  if [ "$BUILD_MODE" = "static" ]; then
    mkdir -p out/files
    cp -r public/files/news out/files/ 2>/dev/null || true
  fi
fi

# Clean up .DS_Store files from output
find out -name '.DS_Store' -delete 2>/dev/null || true

# Check SSL certificate expiry (at most once per week)
yarn ssl-check

# Create build backup
yarn buildbackup
