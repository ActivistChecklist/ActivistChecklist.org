import fs from 'fs/promises'
import path from 'path'
import fetch from 'node-fetch'
import { createHash, logger } from './utils.js'

export class ImageHandler {
  constructor(imagesDir, verbose = false) {
    this.imagesDir = imagesDir
    this.verbose = verbose
    this.imageCache = new Map()
    this.urlMappings = new Map() // Maps original URLs to local paths
  }

  /**
   * Check if a URL is a Storyblok asset with supported file extension
   */
  isStoryblokAsset(url) {
    // Checks for a.storyblok.com or a-us.storyblok.com
    return typeof url === 'string' && 
           url.match(/a(-us)?\.storyblok\.com/) && 
           url.match(/\.(jpg|jpeg|png|gif|webp|svg|pdf)(\?|$)/i)
  }

  findImages(obj, images = new Set()) {
    if (!obj) return images

    // Handle string values - check if it's a Storyblok asset URL
    if (typeof obj === 'string') {
      if (this.isStoryblokAsset(obj)) {
        images.add(obj)
      }
      return images
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      obj.forEach(item => this.findImages(item, images))
      return images
    }

    // Handle objects - check specific patterns then recurse
    if (typeof obj === 'object') {
      // Check for URLs in common Storyblok patterns
      const urlsToCheck = [
        obj.image?.filename,           // Standard image objects
        obj.attrs?.src,               // Rich text image nodes
        obj.url?.cached_url,          // Button components (cached)
        obj.url?.url,                 // Button components (direct)
        obj.attrs?.href               // Link attributes
      ].filter(Boolean)

      urlsToCheck.forEach(url => {
        if (this.isStoryblokAsset(url)) {
          images.add(url)
        }
      })

      // Handle rich text link marks
      if (obj.type === 'text' && obj.marks) {
        obj.marks.forEach(mark => {
          if (mark.type === 'link' && this.isStoryblokAsset(mark.attrs?.href)) {
            images.add(mark.attrs.href)
          }
        })
      }

      // Handle special array properties that need recursive processing
      const arrayProps = ['content', 'body']
      arrayProps.forEach(prop => {
        if (obj[prop] && Array.isArray(obj[prop])) {
          obj[prop].forEach(item => this.findImages(item, images))
        }
      })

      // Handle blok nodes with body in attrs
      if (obj.type === 'blok' && obj.attrs?.body && Array.isArray(obj.attrs.body)) {
        obj.attrs.body.forEach(item => this.findImages(item, images))
      }

      // Recursively process all other object values
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

    // Store the URL mapping for replacement
    const relativePath = path.relative(process.cwd(), filepath)
    // For /out/images, we want the URL to be /images/filename
    const urlPath = relativePath.startsWith('out/') 
      ? relativePath.replace('out/', '/')
      : `/${relativePath}`
    this.urlMappings.set(url, urlPath)

    if (this.verbose) {
      logger.detail(`    Downloaded: ${filename} (${Math.round(buffer.length / 1024)}KB)`)
    }

    return {
      filename,
      filepath,
      size: buffer.length,
      hash: createHash(buffer),
      downloadedAt: new Date().toISOString(),
      localPath: relativePath
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
          logger.detail(`  Found ${storyImages.size} files in ${story.full_slug}`)
        }
      }
    })

    if (imageUrls.size === 0) {
      return { downloaded: 0, skipped: 0, errors: 0 }
    }

    logger.info('\n🖼  Processing images and PDFs...')
    logger.detail(`  Found ${imageUrls.size} unique files`)
    
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

        // Log progress every 10 files if not in verbose mode
        if (!this.verbose && downloaded % 10 === 0) {
          logger.detail(`  Progress: ${downloaded}/${imageUrls.size} files`)
        }
      } catch (error) {
        logger.warn(`  Failed to download ${url}: ${error.message}`)
        errors++
      }
    }

    return { downloaded, skipped, errors }
  }
} 