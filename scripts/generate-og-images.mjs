/**
 * Standalone OG image generator.
 *
 * OG images are generated during `next build` via getStaticProps, so this
 * script is primarily for manual regeneration or debugging.
 *
 * Usage:
 *   node scripts/generate-og-images.mjs           # Generate all (skips cached)
 *   node scripts/generate-og-images.mjs --clean    # Clear cache and regenerate
 */
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const shouldClean = process.argv.includes('--clean');

async function main() {
  const outputDir = path.join(process.cwd(), 'public', 'images', 'og');

  if (shouldClean && fs.existsSync(outputDir)) {
    console.log('Cleaning existing OG images...');
    fs.rmSync(outputDir, { recursive: true });
  }

  fs.mkdirSync(outputDir, { recursive: true });

  // Import the shared generator
  const { generateOgImageForStory } = await import('../lib/og-image.js');

  // Initialize Storyblok
  const { storyblokInit, apiPlugin, getStoryblokApi } = await import('@storyblok/react');
  const { getStoryblokVersion, fetchAllStories } = await import('../utils/core.js');

  storyblokInit({
    accessToken: process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN,
    use: [apiPlugin],
    apiOptions: {
      region: "us",
      version: process.env.NODE_ENV === 'development' ? 'draft' : 'published'
    }
  });

  const storyblokApi = getStoryblokApi();

  console.log('Fetching stories from Storyblok...');
  const allStories = await fetchAllStories(storyblokApi, {
    version: getStoryblokVersion(),
  });

  const eligibleStories = allStories.filter(story => {
    if (story.is_folder) return false;
    const component = story.content?.component;
    return component === 'page' || component === 'guide';
  });

  console.log(`Found ${eligibleStories.length} pages/guides`);

  let generated = 0;
  let skipped = 0;
  let errors = 0;

  for (const story of eligibleStories) {
    try {
      const result = await generateOgImageForStory(story);
      if (result) {
        // Check if file was already cached (generateOgImageForStory skips existing)
        generated++;
        console.log(`  ${result}: ${story.content?.title || story.name}`);
      } else {
        skipped++;
      }
    } catch (error) {
      console.error(`  Error: ${story.full_slug}: ${error.message}`);
      errors++;
    }
  }

  // Copy to out/ if static build
  if (process.env.BUILD_MODE === 'static') {
    const outDir = path.join(process.cwd(), 'out', 'images', 'og');
    if (fs.existsSync(outputDir)) {
      fs.mkdirSync(outDir, { recursive: true });
      const files = fs.readdirSync(outputDir);
      for (const file of files) {
        fs.copyFileSync(path.join(outputDir, file), path.join(outDir, file));
      }
      console.log(`Copied ${files.length} images to out/images/og/`);
    }
  }

  console.log(`Done: ${generated} generated, ${skipped} skipped, ${errors} errors`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
