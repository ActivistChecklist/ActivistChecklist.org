import fs from 'fs/promises'
import path from 'path'
import fetch from 'node-fetch'
import { createHash, logger } from './utils.js'

export class ImageHandler {
  constructor(imagesDir, verbose = false) {
    this.imagesDir = imagesDir
    this.verbose = verbose
    this.imageCache = new Map()
  }

  findImages(obj, images = new Set()) {
    if (!obj) return images

    if (typeof obj === 'object') {
      // Handle image objects specifically
      if (obj.image?.filename) {
        images.add(obj.image.filename)
      }
      // Handle direct image URLs in any string field
      else if (typeof obj === 'string' && obj.includes('a.storyblok.com')) {
        images.add(obj)
      }
      // Recursively process nested objects and arrays
      Object.values(obj).forEach(value => {
        if (typeof value === 'object' && value !== null) {
          this.findImages(value, images)
        }
      })
    }

    return images
  }

  async downloadImage(url) {
    const filename = url.split('/').pop()
    const filepath = path.join(this.imagesDir, filename)

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to download ${url}: ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    await fs.writeFile(filepath, buffer)

    if (this.verbose) {
      logger.detail(`    Downloaded: ${filename} (${Math.round(buffer.length / 1024)}KB)`)
    }

    return {
      filename,
      filepath,
      size: buffer.length,
      hash: createHash(buffer),
      downloadedAt: new Date().toISOString()
    }
  }

  async processImages(stories) {
    await fs.mkdir(this.imagesDir, { recursive: true })
    
    const imageUrls = new Set()
    stories.forEach(story => {
      this.findImages(story.content, imageUrls)
      if (this.verbose) {
        const storyImages = this.findImages(story.content, new Set())
        if (storyImages.size > 0) {
          logger.detail(`  Found ${storyImages.size} images in ${story.full_slug}`)
        }
      }
    })

    if (imageUrls.size === 0) {
      return { downloaded: 0, skipped: 0, errors: 0 }
    }

    logger.info('\n🖼  Processing images...')
    logger.detail(`  Found ${imageUrls.size} unique images`)
    
    let downloaded = 0
    let skipped = 0
    let errors = 0

    for (const url of imageUrls) {
      try {
        const urlHash = createHash(url)
        if (this.imageCache.has(urlHash)) {
          skipped++
          if (this.verbose) {
            logger.detail(`    Skipped: ${url.split('/').pop()} (cached)`)
          }
          continue
        }

        await this.downloadImage(url)
        this.imageCache.set(urlHash, true)
        downloaded++

        // Log progress every 10 images if not in verbose mode
        if (!this.verbose && downloaded % 10 === 0) {
          logger.detail(`  Progress: ${downloaded}/${imageUrls.size} images`)
        }
      } catch (error) {
        logger.warn(`  Failed to download ${url}: ${error.message}`)
        errors++
      }
    }

    return { downloaded, skipped, errors }
  }
} 