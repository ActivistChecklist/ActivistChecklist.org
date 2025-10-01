import 'dotenv/config'
import StoryblokClient from 'storyblok-js-client'
import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import { logger, formatProgress } from './utils.js'
import { ImageHandler } from './export-image-handler.js'
import { storyToYaml } from './export-yaml.js'

export default class SbExport {
  constructor({ token, contentDir, imagesDir, verbose = false, draft = false, yaml = false }) {
    this.contentDir = contentDir
    this.verbose = verbose
    this.version = draft ? 'draft' : 'published'
    this.yaml = yaml
    this.sbClient = new StoryblokClient({
      accessToken: token,
      region: 'us'
    })
    this.imageHandler = new ImageHandler(imagesDir, verbose)

    // Define how different components should be handled
    this.componentTypes = {
      yamlNested: new Set(['guide', 'page', 'section-header', 'checklist-item', 'changelog-entry']),
      markdown: new Set(['rich-text', 'markdown']),
      jsx: new Set(['Alert', 'Badge'])
    }
  }

  /**
   * Convert rich text to markdown
   */
  richTextToMarkdown(richTextField) {
    if (!richTextField || !richTextField.content) return ''

    const processNode = (node, level = 0, parentType = null) => {
      if (!node) return ''

      // Handle components first
      if (node.component) {
        const attrs = Object.entries(node)
          .filter(([key]) => key !== 'component' && key !== 'body')
          .map(([key, value]) => value ? ` ${key}="${value}"` : '')
          .join('')
        
        const body = node.body?.type === 'doc' 
          ? this.richTextToMarkdown(node.body)
          : processNode(node.body, level, parentType)

        return `<${node.component}${attrs}>\n${body}\n</${node.component}>`
      }

      // Handle text nodes
      if (node.type === 'text') {
        let text = node.text
        // Apply marks (bold, italic, etc.)
        if (node.marks) {
          node.marks.forEach(mark => {
            switch (mark.type) {
              case 'bold':
                text = `**${text}**`
                break
              case 'italic':
                text = `*${text}*`
                break
              case 'strike':
                text = `~~${text}~~`
                break
              case 'underline':
                text = `__${text}__`
                break
              case 'code':
                text = `\`${text}\``
                break
              case 'link':
                text = `[${text}](${mark.attrs.href})`
                break
            }
          })
        }
        return text
      }

      // Process child nodes
      const children = node.content
        ? node.content.map(child => {
            // Check if child is a component
            if (child.component) {
              return processNode(child, level, parentType)
            }
            // Handle normal markdown nodes
            return processNode(child, 
              (node.type === 'list_item' && 
               (child.type === 'bullet_list' || child.type === 'ordered_list'))
                ? level + 1 
                : level,
              node.type
            )
          }).join('')
        : ''

      // Handle block-level elements
      switch (node.type) {
        case 'paragraph':
          return `${children}\n\n`
        case 'heading':
          return `${'#'.repeat(node.attrs.level)} ${children}\n\n`
        case 'bullet_list':
        case 'ordered_list':
          return children
        case 'list_item': {
          const indent = '  '.repeat(level)
          return `${indent}- ${children.trim()}\n`
        }
        case 'blockquote':
          return children.split('\n')
            .map(line => `> ${line}`)
            .join('\n') + '\n\n'
        case 'code_block':
          return `\`\`\`\n${children}\n\`\`\`\n\n`
        case 'horizontal_rule':
          return '---\n\n'
        case 'hard_break':
          return '\n'
        case 'image':
          return `![${node.attrs.alt || ''}](${node.attrs.src})\n\n`
        default:
          return children
      }
    }

    try {
      return processNode(richTextField)
        .replace(/\n\n+/g, '\n\n') // Remove extra line breaks
        .trim()
    } catch (error) {
      if (this.verbose) {
        logger.warn(`Failed to render rich text: ${error.message}`)
      }
      return JSON.stringify(richTextField)
    }
  }

  /**
   * Export all stories
   */
  async exportStories(writeFiles = true) {
    try {
      // Fetch phase
      logger.info('\n📡 Fetching content...')
      const allStories = await this.sbClient.getAll('cdn/stories', {
        version: this.version
      })
      
      // Filter out stories in the checklist-items folder
      const stories = allStories.filter(story => !story.full_slug.startsWith('checklist-items/'))
      logger.success(`Found ${stories.length} stories (${this.version} version)`)

      // Only write files if writeFiles is true
      if (writeFiles) {
        // Setup phase
        if (!fs.existsSync(this.contentDir)) {
          fs.mkdirSync(this.contentDir, { recursive: true })
        }

        // Export phase
        logger.info('\n💾 Exporting stories...')
        stories.forEach((story, index) => {
          const baseSlug = story.full_slug
          const jsonPath = path.join(this.contentDir, `${baseSlug}.json`)
          const dirPath = path.dirname(jsonPath)
          
          if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true })
          }

          // Export as JSON
          fs.writeFileSync(jsonPath, JSON.stringify(story, null, 2))
          
          // Export as YAML if enabled
          if (this.yaml) {
            const yamlPath = path.join(this.contentDir, `${baseSlug}.yaml`)
            fs.writeFileSync(yamlPath, storyToYaml(story, this.richTextToMarkdown.bind(this)))
          }
          
          if (this.verbose) {
            logger.detail(`  /${baseSlug}.json`)
            if (this.yaml) {
              logger.detail(`  /${baseSlug}.yaml`)
            }
          } else {
            // Log progress at 25%, 50%, 75%, and 100%
            const progress = Math.floor((index + 1) / stories.length * 100)
            if (progress % 25 === 0 || index === stories.length - 1) {
              logger.detail(`  ${formatProgress(index + 1, stories.length)}`)
            }
          }
        })

        // Summary
        if (!this.verbose) {
          logger.info('\n Content summary:')
          // Group by component type
          const componentCounts = stories.reduce((acc, story) => {
            const component = story.content?.component || 'unknown'
            acc[component] = (acc[component] || 0) + 1
            return acc
          }, {})
          
          Object.entries(componentCounts)
            .sort(([, a], [, b]) => b - a)
            .forEach(([component, count]) => {
              logger.detail(`  ${component}: ${count} ${count === 1 ? 'story' : 'stories'}`)
            })
        }
      }

      return { stories, count: stories.length }
    } catch (err) {
      logger.error('\n❌ Export failed:', err.message)
      throw err
    }
  }

  /**
   * Export images from stories
   */
  async exportImages(stories) {
    return this.imageHandler.processImages(stories)
  }
}
