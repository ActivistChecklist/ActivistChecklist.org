const fs = require('fs/promises')
const fsSync = require('fs')
const path = require('path')
const sharp = require('sharp')
const { PDFDocument } = require('pdf-lib')
const ffmpeg = require('fluent-ffmpeg')
const { promisify } = require('util')
const { createReadStream } = require('fs')
const { pipeline } = require('stream/promises')

/**
 * Metadata Stripper Library
 * Provides functionality to strip metadata from images, PDFs, and videos
 */
class MetadataStripper {
  constructor(options = {}) {
    this.verbose = options.verbose || false
    this.backup = options.backup || false
    this.supportedImageTypes = options.imageTypes || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'tiff', 'bmp']
    this.supportedPdfTypes = options.pdfTypes || ['pdf']
    this.supportedVideoTypes = options.videoTypes || ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv']
  }

  /**
   * Check if a file type is supported for metadata stripping
   */
  isSupported(filePath) {
    const ext = path.extname(filePath).toLowerCase().slice(1)
    return this.supportedImageTypes.includes(ext) || 
           this.supportedPdfTypes.includes(ext) || 
           this.supportedVideoTypes.includes(ext)
  }

  /**
   * Get the file type category
   */
  getFileType(filePath) {
    const ext = path.extname(filePath).toLowerCase().slice(1)
    if (this.supportedImageTypes.includes(ext)) return 'image'
    if (this.supportedPdfTypes.includes(ext)) return 'pdf'
    if (this.supportedVideoTypes.includes(ext)) return 'video'
    return 'unsupported'
  }

  /**
   * Strip metadata from an image file
   */
  async stripImageMetadata(inputBuffer) {
    try {
      const strippedBuffer = await sharp(inputBuffer)
        .withMetadata(false) // Remove all metadata including EXIF
        .toBuffer()
      
      if (this.verbose) {
        console.log(`    ✓ Stripped image metadata (${Math.round(strippedBuffer.length / 1024)}KB)`)
      }
      
      return strippedBuffer
    } catch (error) {
      throw new Error(`Failed to strip image metadata: ${error.message}`)
    }
  }

  /**
   * Strip metadata from a PDF file
   */
  async stripPdfMetadata(inputBuffer) {
    try {
      const pdfDoc = await PDFDocument.load(inputBuffer)
      
      // Remove all metadata
      pdfDoc.setTitle('')
      pdfDoc.setAuthor('')
      pdfDoc.setSubject('')
      pdfDoc.setKeywords([])
      pdfDoc.setProducer('')
      pdfDoc.setCreator('')
      pdfDoc.setCreationDate(new Date())
      pdfDoc.setModificationDate(new Date())
      
      const strippedBuffer = await pdfDoc.save()
      
      if (this.verbose) {
        console.log(`    ✓ Stripped PDF metadata (${Math.round(strippedBuffer.length / 1024)}KB)`)
      }
      
      return strippedBuffer
    } catch (error) {
      throw new Error(`Failed to strip PDF metadata: ${error.message}`)
    }
  }

  /**
   * Strip metadata from a video file
   */
  async stripVideoMetadata(inputBuffer, outputPath) {
    return new Promise((resolve, reject) => {
      // Write input buffer to temporary file
      const tempInputPath = outputPath + '.temp'
      fsSync.writeFileSync(tempInputPath, inputBuffer)
      
      ffmpeg(tempInputPath)
        .outputOptions([
          '-map_metadata', '-1',  // Remove all metadata
          '-map', '0',            // Copy all streams
          '-c', 'copy'            // Copy without re-encoding
        ])
        .output(outputPath)
        .on('end', () => {
          // Clean up temp file
          fsSync.unlinkSync(tempInputPath)
          if (this.verbose) {
            console.log(`    ✓ Stripped video metadata`)
          }
          resolve()
        })
        .on('error', (error) => {
          // Clean up temp file
          if (fsSync.existsSync(tempInputPath)) {
            fsSync.unlinkSync(tempInputPath)
          }
          reject(new Error(`Failed to strip video metadata: ${error.message}`))
        })
        .run()
    })
  }

  /**
   * Strip metadata from a single file
   */
  async stripFileMetadata(filePath) {
    const fileType = this.getFileType(filePath)
    
    if (fileType === 'unsupported') {
      throw new Error(`Unsupported file type: ${path.extname(filePath)}`)
    }

    // Create backup if requested
    if (this.backup) {
      const backupPath = filePath + '.backup'
      await fs.copyFile(filePath, backupPath)
      if (this.verbose) {
        console.log(`    📁 Created backup: ${path.basename(backupPath)}`)
      }
    }

    const inputBuffer = await fs.readFile(filePath)
    
    if (fileType === 'image') {
      const strippedBuffer = await this.stripImageMetadata(inputBuffer)
      await fs.writeFile(filePath, strippedBuffer)
    } else if (fileType === 'pdf') {
      const strippedBuffer = await this.stripPdfMetadata(inputBuffer)
      await fs.writeFile(filePath, strippedBuffer)
    } else if (fileType === 'video') {
      await this.stripVideoMetadata(inputBuffer, filePath)
    }

    return {
      filePath,
      fileType,
      originalSize: inputBuffer.length,
      success: true
    }
  }

  /**
   * Strip metadata from all supported files in a directory
   */
  async stripDirectoryMetadata(dirPath) {
    const results = {
      processed: 0,
      skipped: 0,
      errors: 0,
      files: []
    }

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        
        if (entry.isDirectory()) {
          // Recursively process subdirectories
          const subResults = await this.stripDirectoryMetadata(fullPath)
          results.processed += subResults.processed
          results.skipped += subResults.skipped
          results.errors += subResults.errors
          results.files.push(...subResults.files)
        } else if (entry.isFile() && this.isSupported(fullPath)) {
          try {
            if (this.verbose) {
              console.log(`🔄 Processing: ${entry.name}`)
            }
            
            const result = await this.stripFileMetadata(fullPath)
            results.files.push(result)
            results.processed++
            
            if (this.verbose) {
              console.log(`✅ Success: ${entry.name}`)
            }
          } catch (error) {
            results.errors++
            results.files.push({
              filePath: fullPath,
              fileType: this.getFileType(fullPath),
              success: false,
              error: error.message
            })
            
            if (this.verbose) {
              console.log(`❌ Error: ${entry.name} - ${error.message}`)
            }
          }
        } else {
          results.skipped++
          if (this.verbose) {
            console.log(`⏭️ Skipped: ${entry.name} (unsupported type)`)
          }
        }
      }
    } catch (error) {
      throw new Error(`Failed to process directory: ${error.message}`)
    }

    return results
  }

  /**
   * Analyze metadata from an image file
   */
  async analyzeImageMetadata(filePath) {
    try {
      const metadata = await sharp(filePath).metadata()
      const concerns = []
      
      // Check for high concern items
      if (metadata.exif) {
        const exif = metadata.exif
        
        // Check for author/creator information
        if (exif.Artist || exif.Copyright || exif.Software) {
          concerns.push({
            level: 'high',
            type: 'author_info',
            field: 'EXIF Artist/Copyright/Software',
            value: exif.Artist || exif.Copyright || exif.Software,
            description: 'Contains author, copyright, or software information'
          })
        }
        
        // Check for GPS location data
        if (exif.GPSLatitude || exif.GPSLongitude) {
          concerns.push({
            level: 'high',
            type: 'location',
            field: 'GPS Coordinates',
            value: `${exif.GPSLatitude}, ${exif.GPSLongitude}`,
            description: 'Contains GPS location data'
          })
        }
        
        // Check for camera/device information
        if (exif.Make || exif.Model || exif.SerialNumber) {
          concerns.push({
            level: 'medium',
            type: 'device_info',
            field: 'Camera/Device Info',
            value: `${exif.Make || ''} ${exif.Model || ''} ${exif.SerialNumber || ''}`.trim(),
            description: 'Contains camera or device identification'
          })
        }
        
      }
      
      // Check for IPTC metadata
      if (metadata.iptc) {
        const iptc = metadata.iptc
        
        if (iptc['2#080'] || iptc['2#090'] || iptc['2#120']) { // Author, Editor, Caption
          concerns.push({
            level: 'high',
            type: 'author_info',
            field: 'IPTC Author/Editor',
            value: iptc['2#080'] || iptc['2#090'] || iptc['2#120'],
            description: 'Contains IPTC author or editor information'
          })
        }
        
        if (iptc['2#025']) { // Keywords
          concerns.push({
            level: 'medium',
            type: 'keywords',
            field: 'IPTC Keywords',
            value: iptc['2#025'],
            description: 'Contains IPTC keywords that might be identifying'
          })
        }
      }
      
      return {
        filePath,
        fileType: 'image',
        hasMetadata: concerns.length > 0,
        concerns,
        metadata: {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
          hasExif: !!metadata.exif,
          hasIptc: !!metadata.iptc
        }
      }
    } catch (error) {
      return {
        filePath,
        fileType: 'image',
        hasMetadata: false,
        concerns: [],
        error: error.message
      }
    }
  }

  /**
   * Analyze metadata from a PDF file
   */
  async analyzePdfMetadata(filePath) {
    try {
      const buffer = await fs.readFile(filePath)
      const pdfDoc = await PDFDocument.load(buffer)
      const concerns = []
      
      // Check PDF metadata
      const title = pdfDoc.getTitle()
      const author = pdfDoc.getAuthor()
      const subject = pdfDoc.getSubject()
      const keywords = pdfDoc.getKeywords()
      const producer = pdfDoc.getProducer()
      const creator = pdfDoc.getCreator()
      const creationDate = pdfDoc.getCreationDate()
      const modificationDate = pdfDoc.getModificationDate()
      
      // High concern items
      if (author && author.trim()) {
        concerns.push({
          level: 'high',
          type: 'author_info',
          field: 'Author',
          value: author,
          description: 'Contains author information'
        })
      }
      
      if (creator && creator.trim()) {
        concerns.push({
          level: 'medium',
          type: 'software_info',
          field: 'Creator',
          value: creator,
          description: 'Contains software creator information'
        })
      }
      
      if (producer && producer.trim() && !producer.toLowerCase().includes('pdf-lib')) {
        concerns.push({
          level: 'medium',
          type: 'software_info',
          field: 'Producer',
          value: producer,
          description: 'Contains software producer information'
        })
      }
      
      // Medium concern items
      if (title && title.trim()) {
        concerns.push({
          level: 'medium',
          type: 'title',
          field: 'Title',
          value: title,
          description: 'Contains document title'
        })
      }
      
      if (subject && subject.trim()) {
        concerns.push({
          level: 'medium',
          type: 'subject',
          field: 'Subject',
          value: subject,
          description: 'Contains document subject'
        })
      }
      
      if (keywords && Array.isArray(keywords) && keywords.length > 0) {
        concerns.push({
          level: 'medium',
          type: 'keywords',
          field: 'Keywords',
          value: keywords.join(', '),
          description: 'Contains keywords that might be identifying'
        })
      }
      
      return {
        filePath,
        fileType: 'pdf',
        hasMetadata: concerns.length > 0,
        concerns,
        metadata: {
          pageCount: pdfDoc.getPageCount(),
          hasTitle: !!title,
          hasAuthor: !!author,
          hasSubject: !!subject,
          hasKeywords: keywords && Array.isArray(keywords) && keywords.length > 0,
          hasProducer: !!producer,
          hasCreator: !!creator
        }
      }
    } catch (error) {
      return {
        filePath,
        fileType: 'pdf',
        hasMetadata: false,
        concerns: [],
        error: error.message
      }
    }
  }

  /**
   * Analyze metadata from a video file using ffprobe
   */
  async analyzeVideoMetadata(filePath) {
    return new Promise((resolve) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          resolve({
            filePath,
            fileType: 'video',
            hasMetadata: false,
            concerns: [],
            error: err.message
          })
          return
        }
        
        const concerns = []
        
        // Check metadata tags
        if (metadata.format && metadata.format.tags) {
          const tags = metadata.format.tags
          
          // High concern items
          if (tags.artist || tags.author || tags.comment) {
            concerns.push({
              level: 'high',
              type: 'author_info',
              field: 'Artist/Author/Comment',
              value: tags.artist || tags.author || tags.comment,
              description: 'Contains author or comment information'
            })
          }
          
          if (tags.title) {
            concerns.push({
              level: 'medium',
              type: 'title',
              field: 'Title',
              value: tags.title,
              description: 'Contains video title'
            })
          }
          
          if (tags.album) {
            concerns.push({
              level: 'medium',
              type: 'album',
              field: 'Album',
              value: tags.album,
              description: 'Contains album information'
            })
          }
          
          if (tags.genre) {
            concerns.push({
              level: 'low',
              type: 'genre',
              field: 'Genre',
              value: tags.genre,
              description: 'Contains genre information'
            })
          }
          
        }
        
        resolve({
          filePath,
          fileType: 'video',
          hasMetadata: concerns.length > 0,
          concerns,
          metadata: {
            duration: metadata.format.duration,
            size: metadata.format.size,
            bitRate: metadata.format.bit_rate,
            hasTags: !!(metadata.format && metadata.format.tags)
          }
        })
      })
    })
  }

  /**
   * Scan a single file for metadata concerns
   */
  async scanFile(filePath) {
    const fileType = this.getFileType(filePath)
    
    if (fileType === 'unsupported') {
      return {
        filePath,
        fileType: 'unsupported',
        hasMetadata: false,
        concerns: [],
        error: 'Unsupported file type'
      }
    }
    
    if (fileType === 'image') {
      return await this.analyzeImageMetadata(filePath)
    } else if (fileType === 'pdf') {
      return await this.analyzePdfMetadata(filePath)
    } else if (fileType === 'video') {
      return await this.analyzeVideoMetadata(filePath)
    }
  }

  /**
   * Scan all supported files in a directory for metadata concerns
   */
  async scanDirectory(dirPath) {
    const results = {
      totalFiles: 0,
      scannedFiles: 0,
      filesWithMetadata: 0,
      highConcerns: 0,
      mediumConcerns: 0,
      lowConcerns: 0,
      errors: 0,
      files: []
    }

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        
        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          const subResults = await this.scanDirectory(fullPath)
          results.totalFiles += subResults.totalFiles
          results.scannedFiles += subResults.scannedFiles
          results.filesWithMetadata += subResults.filesWithMetadata
          results.highConcerns += subResults.highConcerns
          results.mediumConcerns += subResults.mediumConcerns
          results.lowConcerns += subResults.lowConcerns
          results.errors += subResults.errors
          results.files.push(...subResults.files)
        } else if (entry.isFile() && this.isSupported(fullPath)) {
          results.totalFiles++
          
          try {
            const scanResult = await this.scanFile(fullPath)
            results.files.push(scanResult)
            results.scannedFiles++
            
            if (scanResult.hasMetadata) {
              results.filesWithMetadata++
              
              // Count concerns by level
              scanResult.concerns.forEach(concern => {
                if (concern.level === 'high') results.highConcerns++
                else if (concern.level === 'medium') results.mediumConcerns++
                else if (concern.level === 'low') results.lowConcerns++
              })
            }
            
            if (this.verbose) {
              if (scanResult.hasMetadata) {
                console.log(`⚠️  Found ${scanResult.concerns.length} metadata concerns: ${entry.name}`)
              } else {
                console.log(`✅ clean: ${entry.name}`)
              }
            }
          } catch (error) {
            results.errors++
            results.files.push({
              filePath: fullPath,
              fileType: this.getFileType(fullPath),
              hasMetadata: false,
              concerns: [],
              error: error.message
            })
            
            if (this.verbose) {
              console.log(`❌ Error: ${entry.name} - ${error.message}`)
            }
          }
        } else {
          results.totalFiles++
        }
      }
    } catch (error) {
      throw new Error(`Failed to scan directory: ${error.message}`)
    }

    return results
  }

  /**
   * Scan files or directories for metadata concerns
   */
  async scan(inputPath) {
    const stats = await fs.stat(inputPath)
    
    if (stats.isFile()) {
      if (!this.isSupported(inputPath)) {
        throw new Error(`Unsupported file type: ${path.extname(inputPath)}`)
      }
      
      const scanResult = await this.scanFile(inputPath)
      return {
        totalFiles: 1,
        scannedFiles: 1,
        filesWithMetadata: scanResult.hasMetadata ? 1 : 0,
        highConcerns: scanResult.concerns.filter(c => c.level === 'high').length,
        mediumConcerns: scanResult.concerns.filter(c => c.level === 'medium').length,
        lowConcerns: scanResult.concerns.filter(c => c.level === 'low').length,
        errors: scanResult.error ? 1 : 0,
        files: [scanResult]
      }
    } else if (stats.isDirectory()) {
      return await this.scanDirectory(inputPath)
    } else {
      throw new Error(`Invalid input: ${inputPath} is neither a file nor a directory`)
    }
  }

  /**
   * Generate a detailed report from scan results
   */
  generateReport(scanResults) {
    const report = {
      summary: {
        totalFiles: scanResults.totalFiles,
        scannedFiles: scanResults.scannedFiles,
        filesWithMetadata: scanResults.filesWithMetadata,
        highConcerns: scanResults.highConcerns,
        mediumConcerns: scanResults.mediumConcerns,
        lowConcerns: scanResults.lowConcerns,
        errors: scanResults.errors
      },
      highConcerns: [],
      mediumConcerns: [],
      lowConcerns: [],
      filesWithMetadata: []
    }
    
    // Categorize files by concern level
    scanResults.files.forEach(file => {
      if (file.hasMetadata) {
        report.filesWithMetadata.push(file)
        
        file.concerns.forEach(concern => {
          if (concern.level === 'high') {
            report.highConcerns.push({ ...concern, filePath: file.filePath })
          } else if (concern.level === 'medium') {
            report.mediumConcerns.push({ ...concern, filePath: file.filePath })
          } else if (concern.level === 'low') {
            report.lowConcerns.push({ ...concern, filePath: file.filePath })
          }
        })
      }
    })
    
    return report
  }

  /**
   * Strip metadata from files or directories
   */
  async stripMetadata(inputPath) {
    const stats = await fs.stat(inputPath)
    
    if (stats.isFile()) {
      if (!this.isSupported(inputPath)) {
        throw new Error(`Unsupported file type: ${path.extname(inputPath)}`)
      }
      
      const result = await this.stripFileMetadata(inputPath)
      return {
        processed: 1,
        skipped: 0,
        errors: 0,
        files: [result]
      }
    } else if (stats.isDirectory()) {
      return await this.stripDirectoryMetadata(inputPath)
    } else {
      throw new Error(`Invalid input: ${inputPath} is neither a file nor a directory`)
    }
  }

  /**
   * Strip metadata from selected files based on scan results
   */
  async stripSelectedFiles(scanResults, selectedFilePaths) {
    const results = {
      processed: 0,
      skipped: 0,
      errors: 0,
      files: []
    }

    for (const filePath of selectedFilePaths) {
      try {
        const result = await this.stripFileMetadata(filePath)
        results.files.push(result)
        results.processed++
        
        if (this.verbose) {
          console.log(`✅ Stripped metadata from: ${path.basename(filePath)}`)
        }
      } catch (error) {
        results.errors++
        results.files.push({
          filePath,
          fileType: this.getFileType(filePath),
          success: false,
          error: error.message
        })
        
        if (this.verbose) {
          console.log(`❌ Error stripping ${path.basename(filePath)}: ${error.message}`)
        }
      }
    }

    return results
  }
}

module.exports = { MetadataStripper }
