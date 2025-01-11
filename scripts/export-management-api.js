import 'dotenv/config'
import StoryblokClient from 'storyblok-js-client'
import fs from 'fs'
import path from 'path'

export default class SbExport {
  /**
   * Create a new instance of the SbExport tool
   * @param {string} param0.token The oauth token of the user
   * @param {string} param0.basePath The local path for saving JSON files
   */
  constructor({ token, basePath }) {
    console.log(`Initializing SbExport with base path: ${basePath}`)
    this.basePath = basePath
    this.sbClient = new StoryblokClient({
      oauthToken: token
    }, 'https://api-us.storyblok.com/v1/')
  }

  /**
   * Export all stories from all spaces
   */
  async exportAllSpaces() {
    try {
      console.log('Fetching all available spaces...')
      const spaces = await this.sbClient.get('spaces')
      
      if (spaces.data?.spaces.length) {
        console.log(`Found ${spaces.data.spaces.length} spaces to export`)
        
        for (let index = 0; index < spaces.data.spaces.length; index++) {
          const space = spaces.data.spaces[index]
          console.log(`\nProcessing space ${index + 1}/${spaces.data.spaces.length}:`)
          console.log(`Space ID: ${space.id}, Name: ${space.name}`)
          await this.exportSpace(space.id)
        }
      } else {
        console.log('No spaces found to export.')
      }
    } catch (err) {
      console.error(`✖ An error occurred while fetching the spaces:`)
      console.error(`  Error message: ${err.message}`)
      console.error(`  Stack trace: ${err.stack}`)
    }
  }

  /**
   * Export stories from a single space
   * @param {number} spaceId The id of the space
   */
  async exportSpace(spaceId) {
    try {
      console.log(`\nStarting export for space ${spaceId}...`)
      
      // Create space directory if it doesn't exist
      const spacePath = path.join(this.basePath, spaceId.toString())
      if (!fs.existsSync(spacePath)) {
        console.log(`Creating directory: ${spacePath}`)
        fs.mkdirSync(spacePath, { recursive: true })
      }

      // First get all stories to get their IDs
      console.log('Fetching stories list...')
      const storiesList = await this.sbClient.get(`spaces/${spaceId}/stories`)
      
      if (storiesList.data?.stories) {
        const storyCount = storiesList.data.stories.length
        console.log(`Found ${storyCount} stories to export`)
        
        // Export each story using the export endpoint
        for (let index = 0; index < storiesList.data.stories.length; index++) {
          const story = storiesList.data.stories[index]
          console.log(`  [${index + 1}/${storyCount}] Exporting: ${story.slug} (ID: ${story.id})`)
          
          try {
            // Use the export endpoint for each story
            const exportedStory = await this.sbClient.get(
              `spaces/${spaceId}/stories/${story.id}/export.json`,
              {
                export_lang: true // Include all languages
              }
            )
            
            if (exportedStory.data) {
              const storyPath = path.join(spacePath, `${story.slug}.json`)
              fs.writeFileSync(storyPath, JSON.stringify(exportedStory.data, null, 2))
              console.log(`    ✓ Exported successfully`)
            } else {
              console.error(`    ✖ No data received for story ${story.slug}`)
            }
          } catch (exportErr) {
            console.error(`    ✖ Failed to export story ${story.slug}: ${exportErr.message}`)
          }
          
          // Add a small delay between requests to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        
        console.log(`\n✓ Successfully exported ${storyCount} stories from space ${spaceId}`)
      } else {
        console.log(`✓ No stories found in space ${spaceId}`)
      }
    } catch (err) {
      console.error(`\n✖ Error exporting space ${spaceId}:`)
      console.error(`  Error message: ${err.message}`)
      console.error(`  Stack trace: ${err.stack}`)
    }
  }
}

// Run the export
const run = async () => {
  console.log('\n=== Storyblok Export Tool ===\n')
  
  if (!process.env.STORYBLOK_OAUTH_TOKEN) {
    console.error('✖ STORYBLOK_OAUTH_TOKEN environment variable is not set')
    process.exit(1)
  }

  const exporter = new SbExport({
    token: process.env.STORYBLOK_OAUTH_TOKEN,
    basePath: './content'
  })

  console.log('Starting export process...\n')
  await exporter.exportAllSpaces()
  console.log('\n✓ Export process completed!')
}

run().catch(err => {
  console.error('\n✖ Fatal error occurred:')
  console.error(err)
  process.exit(1)
})

