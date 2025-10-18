#!/usr/bin/env node

const { Command } = require('commander')
const path = require('path')
const fs = require('fs/promises')
const readline = require('readline')
const MetadataStripper = require('../lib/metadata-library.cjs').MetadataStripper

const program = new Command()

program
  .name('strip-metadata')
  .description('Strip metadata from images, PDFs, and videos')
  .version('1.0.0')

// Strip command
const stripCommand = program
  .command('strip')
  .description('Strip metadata from files')
  .argument('<input>', 'File or directory to process')
  .option('-v, --verbose', 'Verbose output')
  .option('-b, --backup', 'Create backup files before processing')
  .option('--dry-run', 'Show what would be processed without making changes')
  .option('--images <types>', 'Comma-separated list of image file extensions', 'jpg,jpeg,png,gif,webp,tiff,bmp')
  .option('--pdfs <types>', 'Comma-separated list of PDF file extensions', 'pdf')
  .option('--videos <types>', 'Comma-separated list of video file extensions', 'mp4,avi,mov,wmv,flv,webm,mkv')
  .action(async (input, options) => {
    try {
      // Validate input path
      const inputPath = path.resolve(input)

      try {
        await fs.access(inputPath)
      } catch (error) {
        console.error(`❌ Error: Cannot access ${inputPath}`)
        console.error(`   ${error.message}`)
        process.exit(1)
      }

      // Parse file type options
      const imageTypes = options.images.split(',').map(ext => ext.trim().toLowerCase())
      const pdfTypes = options.pdfs.split(',').map(ext => ext.trim().toLowerCase())
      const videoTypes = options.videos.split(',').map(ext => ext.trim().toLowerCase())

      // Create metadata stripper instance
      const stripper = new MetadataStripper({
        verbose: options.verbose,
        backup: options.backup,
        imageTypes,
        pdfTypes,
        videoTypes
      })

      console.log('🔍 Metadata Stripper')
      console.log(`📁 Input: ${inputPath}`)
      console.log(`📸 Images: ${imageTypes.join(', ')}`)
      console.log(`📄 PDFs: ${pdfTypes.join(', ')}`)
      console.log(`🎬 Videos: ${videoTypes.join(', ')}`)

      if (options.backup) {
        console.log('💾 Backup: Enabled')
      }

      if (options.dryRun) {
        console.log('🧪 Dry run: Enabled (no changes will be made)')
      }

      console.log('')

      if (options.dryRun) {
        // Dry run - just show what would be processed
        await performDryRun(inputPath, stripper)
      } else {
        // First scan to get concerns before stripping
        console.log('🔍 Scanning files for metadata concerns...')
        const scanStartTime = Date.now()
        const scanResults = await stripper.scan(inputPath)
        const scanEndTime = Date.now()

        if (scanResults.filesWithMetadata.length === 0) {
          console.log('🎉 No metadata concerns found. Files are already clean!')
          return
        }

        console.log(`📊 Found ${scanResults.filesWithMetadata.length} files with metadata concerns`)
        console.log(`⏱️ Scan completed in: ${((scanEndTime - scanStartTime) / 1000).toFixed(2)}s`)
        console.log('')

        // Now perform the actual stripping
        console.log('🔄 Stripping metadata from files...')
        const startTime = Date.now()
        const results = await stripper.stripMetadata(inputPath)
        const endTime = Date.now()

        // Display detailed results using existing functions
        console.log('')
        console.log('📊 Stripping Results:')
        console.log('═'.repeat(60))
        console.log(`✅ Processed: ${results.processed}`)
        console.log(`⏭️ Skipped: ${results.skipped}`)
        console.log(`❌ Errors: ${results.errors}`)
        console.log(`⏱️ Time: ${((endTime - startTime) / 1000).toFixed(2)}s`)
        console.log('')

        // Generate report from scan results and display with success indicators
        const report = stripper.generateReport(scanResults)
        displayStrippingResults(report, results)

        if (options.backup && results.processed > 0) {
          console.log('💾 Backup files created with .backup extension')
        }
      }

    } catch (error) {
      console.error(`❌ Fatal error: ${error.message}`)
      process.exit(1)
    }
  })

// Scan command
const scanCommand = program
  .command('scan')
  .description('Scan files for metadata concerns and optionally strip them')
  .argument('<input>', 'File or directory to scan')
  .option('-v, --verbose', 'Verbose output')
  .option('-b, --backup', 'Create backup files before processing')
  .option('--interactive', 'Interactive mode to select files for stripping')
  .option('--images <types>', 'Comma-separated list of image file extensions', 'jpg,jpeg,png,gif,webp,tiff,bmp')
  .option('--pdfs <types>', 'Comma-separated list of PDF file extensions', 'pdf')
  .option('--videos <types>', 'Comma-separated list of video file extensions', 'mp4,avi,mov,wmv,flv,webm,mkv')
  .action(async (input, options) => {
    try {
      // Validate input path
      const inputPath = path.resolve(input)

      try {
        await fs.access(inputPath)
      } catch (error) {
        console.error(`❌ Error: Cannot access ${inputPath}`)
        console.error(`   ${error.message}`)
        process.exit(1)
      }

      // Parse file type options
      const imageTypes = options.images.split(',').map(ext => ext.trim().toLowerCase())
      const pdfTypes = options.pdfs.split(',').map(ext => ext.trim().toLowerCase())
      const videoTypes = options.videos.split(',').map(ext => ext.trim().toLowerCase())

      // Create metadata stripper instance
      const stripper = new MetadataStripper({
        verbose: options.verbose,
        backup: options.backup,
        imageTypes,
        pdfTypes,
        videoTypes
      })

      console.log('🔍 Metadata Scanner')
      console.log(`📁 Input: ${inputPath}`)
      console.log(`📸 Images: ${imageTypes.join(', ')}`)
      console.log(`📄 PDFs: ${pdfTypes.join(', ')}`)
      console.log(`🎬 Videos: ${videoTypes.join(', ')}`)
      console.log('')

      // Perform scan
      const startTime = Date.now()
      const scanResults = await stripper.scan(inputPath)
      const endTime = Date.now()

      // Generate report
      const report = stripper.generateReport(scanResults)

      // Display scan results
      console.log('📊 Scan Results:')
      console.log('')

      // Overall status with clear indicators
      if (report.summary.filesWithMetadata === 0) {
        console.log('✅ CLEAN - No metadata concerns found!')
      } else if (report.summary.highConcerns > 0) {
        console.log('🔴 ATTENTION NEEDED - High-priority concerns found!')
      } else if (report.summary.mediumConcerns > 0) {
        console.log('🟡 REVIEW RECOMMENDED - Medium-priority concerns found')
      } else {
        console.log('🟢 LOW PRIORITY - Only minor concerns found')
      }
      console.log('')

      // Summary with meaningful indicators
      console.log('📋 Summary:')
      console.log(`   📁 Total files scanned: ${report.summary.totalFiles}`)
      console.log(`   🔍 Successfully scanned: ${report.summary.scannedFiles}`)

      if (report.summary.filesWithMetadata > 0) {
        console.log(`   ⚠️  Files with metadata: ${report.summary.filesWithMetadata}`)

        if (report.summary.highConcerns > 0) {
          console.log(`   🔴 High-priority concerns: ${report.summary.highConcerns} (immediate action needed)`)
        }
        if (report.summary.mediumConcerns > 0) {
          console.log(`   🟡 Medium-priority concerns: ${report.summary.mediumConcerns} (review recommended)`)
        }
        if (report.summary.lowConcerns > 0) {
          console.log(`   🟢 Low-priority concerns: ${report.summary.lowConcerns} (optional review)`)
        }
      } else {
        console.log(`   ✅ Files with metadata: 0 (all clean!)`)
      }

      if (report.summary.errors > 0) {
        console.log(`   ❌ Scan errors: ${report.summary.errors}`)
      }

      console.log(`   ⏱️  Scan completed in: ${((endTime - startTime) / 1000).toFixed(2)}s`)
      console.log('')

      // Display detailed concerns in a clean format
      if (report.highConcerns.length > 0) {
        console.log('🔴 HIGH CONCERNS (Immediate Action Recommended)')
        console.log('═'.repeat(60))
        report.highConcerns.forEach((concern) => {
          const fileName = path.basename(concern.filePath)
          const dirPath = path.dirname(path.relative(process.cwd(), concern.filePath))
          console.log(`🔴 \x1b[1m${concern.value}\x1b[0m - ${concern.field} - ${fileName} (${dirPath})`)
        })
        console.log('')
      }

      if (report.mediumConcerns.length > 0) {
        console.log('🟡 MEDIUM CONCERNS (Review Recommended)')
        console.log('═'.repeat(60))
        report.mediumConcerns.forEach((concern) => {
          const fileName = path.basename(concern.filePath)
          const dirPath = path.dirname(path.relative(process.cwd(), concern.filePath))
          console.log(`🟡 \x1b[1m${concern.value}\x1b[0m - ${concern.field} - ${fileName} (${dirPath})`)
        })
        console.log('')
      }

      if (report.lowConcerns.length > 0) {
        console.log('🟢 LOW CONCERNS (Optional Review)')
        console.log('═'.repeat(60))
        report.lowConcerns.forEach((concern) => {
          const fileName = path.basename(concern.filePath)
          const dirPath = path.dirname(path.relative(process.cwd(), concern.filePath))
          console.log(`🟢 \x1b[1m${concern.value}\x1b[0m - ${concern.field} - ${fileName} (${dirPath})`)
        })
        console.log('')
      }


      // Show recommendation
      if (report.summary.filesWithMetadata === 0) {
        console.log('🎉 Great! Your files are already clean.')
      } else {
        console.log('💡 Next Steps:')
        console.log('─'.repeat(60))

        if (report.summary.highConcerns > 0) {
          console.log(`🔴 URGENT: ${report.summary.highConcerns} high-priority concerns need immediate attention`)
          console.log('   These contain author info, GPS data, or other identifying metadata')
        }
        if (report.summary.mediumConcerns > 0) {
          console.log(`🟡 REVIEW: ${report.summary.mediumConcerns} medium-priority concerns should be reviewed`)
          console.log('   These contain device info, timestamps, or other potentially identifying data')
        }
        if (report.summary.lowConcerns > 0) {
          console.log(`🟢 OPTIONAL: ${report.summary.lowConcerns} low-priority concerns can be reviewed if desired`)
          console.log('   These contain minor metadata like creation dates')
        }
        console.log('')
        console.log('🛠️  To fix these issues:')
        console.log('   • Run with --interactive flag to selectively strip metadata')
        console.log('   • Add --backup flag to create backups before processing')
        console.log('   • Example: yarn scan-metadata . --interactive --backup')
      }

      // Interactive mode
      if (options.interactive && report.filesWithMetadata.length > 0) {
        await interactiveStrip(stripper, report)
      } else if (report.filesWithMetadata.length > 0) {
        console.log('💡 Use --interactive flag to selectively strip metadata from files with concerns')
      }

    } catch (error) {
      console.error(`❌ Fatal error: ${error.message}`)
      process.exit(1)
    }
  })

// Interactive stripping function
async function interactiveStrip(stripper, report) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve))

  console.log('')
  console.log('🎯 Interactive Metadata Stripping')
  console.log('═'.repeat(60))
  console.log('Select files to strip metadata from:')
  console.log('')

  const selectedFiles = []
  const filesWithMetadata = report.filesWithMetadata

  for (let i = 0; i < filesWithMetadata.length; i++) {
    const file = filesWithMetadata[i]
    const fileName = path.basename(file.filePath)
    const relativePath = path.relative(process.cwd(), file.filePath)
    const concernCount = file.concerns.length
    const highConcerns = file.concerns.filter(c => c.level === 'high').length
    const mediumConcerns = file.concerns.filter(c => c.level === 'medium').length
    const lowConcerns = file.concerns.filter(c => c.level === 'low').length

    console.log(`\n${i + 1}. 📄 ${fileName}`)
    console.log(`   📍 ${relativePath}`)
    console.log(`   ⚠️  Concerns: ${concernCount} total (${highConcerns} high, ${mediumConcerns} medium, ${lowConcerns} low)`)

    // Show first few concerns with better formatting
    file.concerns.slice(0, 2).forEach(concern => {
      const levelIcon = concern.level === 'high' ? '🔴' : concern.level === 'medium' ? '🟡' : '🟢'
      console.log(`   ${levelIcon} ${concern.field}: ${concern.value}`)
    })
    if (file.concerns.length > 2) {
      console.log(`   ... and ${file.concerns.length - 2} more concerns`)
    }
    console.log('')

    const answer = await question(`Strip metadata from ${fileName}? (y/n/a for all/q to quit): `)

    if (answer.toLowerCase() === 'q') {
      break
    } else if (answer.toLowerCase() === 'a') {
      // Add all remaining files
      for (let j = i; j < filesWithMetadata.length; j++) {
        selectedFiles.push(filesWithMetadata[j].filePath)
      }
      break
    } else if (answer.toLowerCase() === 'y') {
      selectedFiles.push(file.filePath)
    }
  }

  rl.close()

  if (selectedFiles.length > 0) {
    console.log('')
    console.log('🔄 Stripping metadata from selected files...')
    console.log('─'.repeat(60))

    const stripResults = await stripper.stripSelectedFiles({ files: [] }, selectedFiles)

    console.log('')
    console.log('📊 Stripping Results:')
    console.log('┌─────────────────────────────────────────────────────────┐')
    console.log('│                    RESULTS                               │')
    console.log('├─────────────────────────────────────────────────────────┤')
    console.log(`│ ✅ Processed:        ${stripResults.processed.toString().padStart(8)} │`)
    console.log(`│ ❌ Errors:          ${stripResults.errors.toString().padStart(8)} │`)
    console.log('└─────────────────────────────────────────────────────────┘')

    if (stripResults.errors > 0) {
      console.log('')
      console.log('❌ ERRORS:')
      console.log('─'.repeat(60))
      stripResults.files
        .filter(file => !file.success)
        .forEach(file => {
          console.log(`   📄 ${path.basename(file.filePath)}`)
          console.log(`   ❌ ${file.error}`)
          console.log('')
        })
    } else {
      console.log('')
      console.log('✅ All selected files processed successfully!')
    }
  } else {
    console.log('')
    console.log('ℹ️  No files selected for metadata stripping.')
  }
}

/**
 * Perform a dry run to show what would be processed
 */
async function performDryRun(inputPath, stripper) {
  const stats = await fs.stat(inputPath)

  if (stats.isFile()) {
    if (stripper.isSupported(inputPath)) {
      const fileType = stripper.getFileType(inputPath)
      console.log(`✅ Would process: ${path.basename(inputPath)} (${fileType})`)
    } else {
      console.log(`⏭️ Would skip: ${path.basename(inputPath)} (unsupported type)`)
    }
  } else if (stats.isDirectory()) {
    await performDryRunDirectory(inputPath, stripper)
  }
}

/**
 * Perform dry run on directory
 */
async function performDryRunDirectory(dirPath, stripper) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)

    if (entry.isDirectory()) {
      console.log(`📁 Directory: ${entry.name}/`)
      await performDryRunDirectory(fullPath, stripper)
    } else if (entry.isFile()) {
      if (stripper.isSupported(fullPath)) {
        const fileType = stripper.getFileType(fullPath)
        console.log(`✅ Would process: ${entry.name} (${fileType})`)
      } else {
        console.log(`⏭️ Would skip: ${entry.name} (unsupported type)`)
      }
    }
  }
}

/**
 * Display stripping results by reusing the existing concern display logic
 */
function displayStrippingResults(report, stripResults) {
  if (stripResults.files.length === 0) return

  console.log('📋 Detailed Results:')
  console.log('═'.repeat(60))

  // Create a map of file results for quick lookup
  const fileResultsMap = new Map()
  stripResults.files.forEach(file => {
    fileResultsMap.set(file.filePath, file)
  })

  // Display high concerns with success indicators
  if (report.highConcerns.length > 0) {
    console.log('🔴 HIGH CONCERNS (Stripped)')
    console.log('─'.repeat(40))
    report.highConcerns.forEach((concern) => {
      const fileResult = fileResultsMap.get(concern.filePath)
      const statusIcon = fileResult?.success ? '✅' : '❌'
      const fileName = path.basename(concern.filePath)
      const dirPath = path.dirname(path.relative(process.cwd(), concern.filePath))
      console.log(`${statusIcon}🔴 \x1b[1m${concern.value}\x1b[0m - ${concern.field} - ${fileName} (${dirPath})`)
    })
    console.log('')
  }

  // Display medium concerns with success indicators
  if (report.mediumConcerns.length > 0) {
    console.log('🟡 MEDIUM CONCERNS (Stripped)')
    console.log('─'.repeat(40))
    report.mediumConcerns.forEach((concern) => {
      const fileResult = fileResultsMap.get(concern.filePath)
      const statusIcon = fileResult?.success ? '✅' : '❌'
      const fileName = path.basename(concern.filePath)
      const dirPath = path.dirname(path.relative(process.cwd(), concern.filePath))
      console.log(`${statusIcon}🟡 \x1b[1m${concern.value}\x1b[0m - ${concern.field} - ${fileName} (${dirPath})`)
    })
    console.log('')
  }

  // Display low concerns with success indicators
  if (report.lowConcerns.length > 0) {
    console.log('🟢 LOW CONCERNS (Stripped)')
    console.log('─'.repeat(40))
    report.lowConcerns.forEach((concern) => {
      const fileResult = fileResultsMap.get(concern.filePath)
      const statusIcon = fileResult?.success ? '✅' : '❌'
      const fileName = path.basename(concern.filePath)
      const dirPath = path.dirname(path.relative(process.cwd(), concern.filePath))
      console.log(`${statusIcon}🟢 \x1b[1m${concern.value}\x1b[0m - ${concern.field} - ${fileName} (${dirPath})`)
    })
    console.log('')
  }

  // Display errors
  const errors = stripResults.files.filter(file => !file.success)
  if (errors.length > 0) {
    console.log('❌ ERRORS')
    console.log('─'.repeat(40))
    errors.forEach(file => {
      const fileName = path.basename(file.filePath)
      const dirPath = path.dirname(path.relative(process.cwd(), file.filePath))
      console.log(`❌❌ Error processing ${fileName} (${dirPath}): ${file.error}`)
    })
    console.log('')
  }
}

program.parse()
