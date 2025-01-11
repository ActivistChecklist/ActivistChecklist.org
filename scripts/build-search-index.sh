#!/bin/bash

# Set NODE_ENV to development if not set
: "${NODE_ENV:=development}"
export NODE_ENV

echo "Building search index..."
echo "BUILD_MODE: $BUILD_MODE"
echo "NODE_ENV: $NODE_ENV"

if [ "$BUILD_MODE" = "static" ]; then
  rm -rf out/pagefind
  rm -rf public/pagefind
  pagefind --site out --output-path out/pagefind && \
  cp -r out/pagefind public/
elif [ "$NODE_ENV" = "development" ]; then
  # This kind of hacky because we aren't using the latest data, but we'll have to make do
  if [ ! -d "out" ]; then
    echo "Site has not been exported. Running yarn buildstatic..."
    yarn buildstatic
  fi
  rm -rf public/pagefind
  pagefind --site out --output-path public/pagefind
else
  # Assume production, or at least use whatever .next currently has (it exists in development too)
  rm -rf public/pagefind
  pagefind --site .next/server/pages --output-path public/pagefind
fi