import 'dotenv/config'
import path from 'path'
import { Command } from 'commander'
import { logger } from './utils.js'
import SbExport from './export-library.js'

// CLI setup
const program = new Command()

program
  .name('storyblok-export')
  .description('Export content and assets from Storyblok')
  .option('-m, --mode <mode>', 'Export mode: content, images, or all', 'all')
  .option('-v, --verbose', 'Show detailed progress', false)
  .option('-c, --content <dir>', 'Content output directory', './content')
  .option('-i, --images <dir>', 'Images output directory', './public/images')
  .option('-d, --draft', 'Export draft versions instead of published', false)
  .option('-y, --yaml', 'Also export content as YAML', false)
  .parse(process.argv)

const options = program.opts()

// Run the export
const run = async () => {
  logger.header('🚀 Starting Storyblok export')
  logger.detail(`Mode: ${options.mode}`)
  logger.detail(`Version: ${options.draft ? 'draft' : 'published'}`)
  if (options.yaml) logger.detail('YAML export enabled')
  if (options.verbose) logger.detail('Verbose mode enabled')
  logger.detail(`Content directory: ${options.content}`)
  if (options.mode === 'all' || options.mode === 'images') {
    logger.detail(`Images directory: ${options.images}`)
  }

  const exporter = new SbExport({
    token: process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN,
    contentDir: options.content,
    imagesDir: options.images,
    verbose: options.verbose,
    draft: options.draft,
    yaml: options.yaml
  })

  try {
    let stories = []
    let storiesCount = 0
    let imageStats = { downloaded: 0, skipped: 0, errors: 0 }

    // Export content if needed
    if (options.mode === 'all' || options.mode === 'content') {
      const result = await exporter.exportStories(true)
      stories = result.stories
      storiesCount = result.count
    }

    // Export images if needed
    if (options.mode === 'all' || options.mode === 'images') {
      // If we haven't fetched stories yet, do it now
      if (stories.length === 0 && options.mode === 'images') {
        const result = await exporter.exportStories(false) // Don't write files in images-only mode
        stories = result.stories
      }
      imageStats = await exporter.exportImages(stories)
    }

    // Final summary
    logger.success('\n✨ Export complete')
    if (options.mode === 'all' || options.mode === 'content') {
      logger.detail(`  Stories exported: ${storiesCount} (${options.draft ? 'draft' : 'published'})`)
      logger.detail(`  Content location: ${path.resolve(options.content)}`)
    }
    if (options.mode === 'all' || options.mode === 'images') {
      logger.detail(`  Images processed: ${imageStats.downloaded + imageStats.skipped}`)
      logger.detail(`    Downloaded: ${imageStats.downloaded}`)
      logger.detail(`    Skipped: ${imageStats.skipped}`)
      logger.detail(`    Errors: ${imageStats.errors}`)
      logger.detail(`  Images location: ${path.resolve(options.images)}`)
    }
  } catch (error) {
    logger.error('\n💥 Export failed')
    if (options.verbose) {
      logger.error(error)
    }
    process.exit(1)
  }
}

run().catch(console.error)

