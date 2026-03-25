#!/bin/bash
# Post-build tasks for ActivistChecklist.org
# Runs automatically after `next build` via the postbuild npm hook

set -e

# Generate sitemap, RSS feed, and search index
next-sitemap
yarn rss
yarn index

# Static build tasks
if [ "$BUILD_MODE" = "static" ]; then
  cp public/.htaccess out/.htaccess

  # Copy English content to root so bare URLs (e.g. /about/) work on any static server.
  # Spanish stays at /es/. The .htaccess rewrite is a fallback for Apache.
  cp -a out/en/* out/
fi

# Clean up .DS_Store files from output
find out -name '.DS_Store' -delete 2>/dev/null || true

# Check SSL certificate expiry (at most once per week)
yarn ssl-check

# Create build backup
yarn buildbackup
