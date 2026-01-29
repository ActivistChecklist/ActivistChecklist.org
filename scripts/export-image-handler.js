import fs from 'fs/promises'
import path from 'path'
import fetch from 'node-fetch'
import { createHash, logger } from './utils.js'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { MetadataStripper } = require('../lib/metadata-library.cjs')

export class MediaHandler {
  constructor(mediaDir, verbose = false) {
    this.mediaDir = mediaDir
    this.verbose = verbose
    this.mediaCache = new Map()
    this.urlMappings = new Map() // Maps original URLs to local paths
    this.metadataStripper = new MetadataStripper({ verbose })
  }

  /**
   * Check if a URL is a Storyblok asset with supported file extension
   */
  isStoryblokAsset(url) {
    // Checks for a.storyblok.com or a-us.storyblok.com
    return typeof url === 'string' && 
           url.match(/a(-us)?\.storyblok\.com/) && 
           url.match(/\.(jpg|jpeg|png|gif|webp|svg|pdf|mp4)(\?|$)/i)
  }

  findMedia(obj, media = new Set()) {
    if (!obj) return media

    // Handle string values - check if it's a Storyblok asset URL
    if (typeof obj === 'string') {
      if (this.isStoryblokAsset(obj)) {
        media.add(obj)
      }
      return media
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      obj.forEach(item => this.findMedia(item, media))
      return media
    }

    // Handle objects - check specific patterns then recurse
    if (typeof obj === 'object') {
      // Check for URLs in common Storyblok patterns
      const urlsToCheck = [
        obj.image?.filename,           // Standard image objects
        obj.image?.cached_url,         // Page-level image field (cached)
        obj.image?.url,                // Page-level image field (direct)
        obj.video?.cached_url,         // Video embed components (cached)
        obj.video?.url,                // Video embed components (direct)
        obj.video_file?.filename,      // Video file components (filename)
        obj.video_file?.cached_url,    // Video file components (cached)
        obj.attrs?.src,                // Rich text image nodes
        obj.url?.cached_url,           // Button components (cached)
        obj.url?.url,                  // Button components (direct)
        obj.attrs?.href                // Link attributes
      ].filter(Boolean)

      urlsToCheck.forEach(url => {
        if (this.isStoryblokAsset(url)) {
          media.add(url)
        }
      })

      // Handle rich text link marks
      if (obj.type === 'text' && obj.marks) {
        obj.marks.forEach(mark => {
          if (mark.type === 'link' && this.isStoryblokAsset(mark.attrs?.href)) {
            media.add(mark.attrs.href)
          }
        })
      }

      // Handle special array properties that need recursive processing
      const arrayProps = ['content', 'body', 'blocks']
      arrayProps.forEach(prop => {
        if (obj[prop] && Array.isArray(obj[prop])) {
          obj[prop].forEach(item => this.findMedia(item, media))
        }
      })

      // Handle blok nodes with body in attrs
      if (obj.type === 'blok' && obj.attrs?.body && Array.isArray(obj.attrs.body)) {
        obj.attrs.body.forEach(item => this.findMedia(item, media))
      }

      // Recursively process all other object values
      Object.values(obj).forEach(value => {
        if (typeof value === 'string') {
          // Check if string values are storyblok asset URLs (e.g., image fields stored as strings)
          if (this.isStoryblokAsset(value)) {
            media.add(value)
          }
        } else if (typeof value === 'object' && value !== null) {
          this.findMedia(value, media)
        }
      })
    }

    return media
  }

  async downloadMedia(url) {
    const filename = url.split('/').pop()
    const filepath = path.join(this.mediaDir, filename)

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to download ${url}: ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // Check if file type is supported for metadata stripping
    const fileType = this.metadataStripper.getFileType(filename)
    
    let processedBuffer = buffer
    let metadataStripped = false
    
    if (fileType !== 'unsupported') {
      try {
        if (fileType === 'image') {
          processedBuffer = await this.metadataStripper.stripImageMetadata(buffer)
          metadataStripped = true
        } else if (fileType === 'pdf') {
          processedBuffer = await this.metadataStripper.stripPdfMetadata(buffer)
          metadataStripped = true
        } else if (fileType === 'video') {
          await this.metadataStripper.stripVideoMetadata(buffer, filepath)
          metadataStripped = true
          
          // For videos, we don't need to write the buffer since ffmpeg handles it
          // Store the URL mapping for replacement
          const relativePath = path.relative(process.cwd(), filepath)
          const urlPath = relativePath.startsWith('out/') 
            ? relativePath.replace('out/', '/')
            : `/${relativePath}`
          this.urlMappings.set(url, urlPath)

          return {
            filename,
            filepath,
            size: buffer.length, // Original size for reference
            hash: createHash(buffer),
            downloadedAt: new Date().toISOString(),
            localPath: relativePath,
            metadataStripped: true
          }
        }
        
        if (this.verbose && metadataStripped) {
          logger.detail(`    Downloaded and stripped ${fileType} metadata: ${filename} (${Math.round(processedBuffer.length / 1024)}KB)`)
        }
      } catch (error) {
        // If metadata stripping fails, fall back to original file
        logger.warn(`    Failed to strip metadata from ${filename}, saving original: ${error.message}`)
        processedBuffer = buffer
      }
    }
    
    // Write the processed buffer (for images and PDFs)
    if (fileType !== 'video') {
      await fs.writeFile(filepath, processedBuffer)
    }

    // Store the URL mapping for replacement
    const relativePath = path.relative(process.cwd(), filepath)
    const urlPath = relativePath.startsWith('out/') 
      ? relativePath.replace('out/', '/')
      : `/${relativePath}`
    this.urlMappings.set(url, urlPath)

    if (this.verbose) {
      logger.detail(`    Downloaded: ${filename} (${Math.round(processedBuffer.length / 1024)}KB)`)
    }

    return {
      filename,
      filepath,
      size: processedBuffer.length,
      hash: createHash(processedBuffer),
      downloadedAt: new Date().toISOString(),
      localPath: relativePath,
      metadataStripped: metadataStripped
    }
  }

  async processMedia(stories) {
    await fs.mkdir(this.mediaDir, { recursive: true })
    
    const mediaUrls = new Set()
    stories.forEach(story => {
      this.findMedia(story.content, mediaUrls)
      if (this.verbose) {
        const storyMedia = this.findMedia(story.content, new Set())
        if (storyMedia.size > 0) {
          logger.detail(`  Found ${storyMedia.size} files in ${story.full_slug}`)
        }
      }
    })

    if (mediaUrls.size === 0) {
      return { downloaded: 0, skipped: 0, errors: 0 }
    }

    logger.info('\n🖼  Processing images, PDFs, and videos...')
    logger.detail(`  Found ${mediaUrls.size} unique files`)
    
    let downloaded = 0
    let skipped = 0
    let errors = 0

    for (const url of mediaUrls) {
      try {
        const urlHash = createHash(url)
        if (this.mediaCache.has(urlHash)) {
          skipped++
          if (this.verbose) {
            logger.detail(`    Skipped: ${url.split('/').pop()} (cached)`)
          }
          continue
        }

        await this.downloadMedia(url)
        this.mediaCache.set(urlHash, true)
        downloaded++

        // Log progress every 10 files if not in verbose mode
        if (!this.verbose && downloaded % 10 === 0) {
          logger.detail(`  Progress: ${downloaded}/${mediaUrls.size} files`)
        }
      } catch (error) {
        logger.warn(`  Failed to download ${url}: ${error.message}`)
        errors++
      }
    }

    return { downloaded, skipped, errors }
  }
} 