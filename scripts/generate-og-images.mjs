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
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const shouldClean = process.argv.includes('--clean');

async function main() {
  const outputDir = path.join(ROOT, 'public', 'images', 'og');

  if (shouldClean && fs.existsSync(outputDir)) {
    console.log('Cleaning existing OG images...');
    fs.rmSync(outputDir, { recursive: true });
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const { generateOgImageForStory } = await import('../lib/og-image.js');
  const { getAllGuides, getAllPages } = await import('../lib/content.js');

  const allContent = [
    ...getAllGuides('en').map((g) => ({ type: 'guide', item: g })),
    ...getAllPages('en').map((p) => ({ type: 'page', item: p })),
  ];

  console.log(`Generating OG images for ${allContent.length} pages...`);

  let generated = 0;
  let skipped = 0;
  let errors = 0;

  for (const { type, item } of allContent) {
    const slug = item.frontmatter.slug || item.slug;
    const title = item.frontmatter.title;

    try {
      const result = await generateOgImageForStory({
        content: { title, component: type },
        full_slug: slug,
        name: title,
      });

      if (result && result !== '/images/og-image.png') {
        generated++;
        console.log(`  ✓ ${slug}`);
      } else {
        skipped++;
      }
    } catch (err) {
      errors++;
      console.warn(`  ✗ ${slug}: ${err.message}`);
    }
  }

  console.log(`\nDone. Generated: ${generated}, Skipped: ${skipped}, Errors: ${errors}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
