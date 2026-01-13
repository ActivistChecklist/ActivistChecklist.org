#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const { createWriteStream } = require('fs');
const ogs = require('open-graph-scraper');

// Try to load sharp, but handle gracefully if it fails
let sharp;
try {
  sharp = require('sharp');
} catch (error) {
  const isVercel = process.env.VERCEL === '1';
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (isVercel) {
    console.warn('⚠️ Sharp not available on Vercel, image processing will be skipped:', error.message);
  } else if (isDevelopment) {
    console.error('❌ Sharp is required for development but not available:', error.message);
    console.error('💡 Run: yarn add sharp');
    throw new Error('Sharp is required for development');
  } else {
    console.warn('⚠️ Sharp not available, image processing will be skipped:', error.message);
  }
  sharp = null;
}

// Load environment variables
require('dotenv').config();

// Configuration
const NEWS_IMAGES_DIR = path.join(__dirname, '..', 'public', 'files', 'news');
const MANUAL_IMAGES_DIR = path.join(NEWS_IMAGES_DIR, 'manual');
const STORYBLOK_TOKEN = process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN;


if (!STORYBLOK_TOKEN) {
  console.error('❌ Missing required environment variable: NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN');
  process.exit(1);
}

// Ensure news images directory exists
if (!fs.existsSync(NEWS_IMAGES_DIR)) {
  fs.mkdirSync(NEWS_IMAGES_DIR, { recursive: true });
}

// Ensure manual images directory exists
if (!fs.existsSync(MANUAL_IMAGES_DIR)) {
  fs.mkdirSync(MANUAL_IMAGES_DIR, { recursive: true });
}

// Fetch all news stories from Storyblok
async function fetchNewsStories(quietMode = false) {
  // Use filter_query to get only news-item content type with proper nested parameter format
  const filterQuery = 'filter_query[component][in]=news-item';
  
  const url = `https://api-us.storyblok.com/v2/cdn/stories?token=${STORYBLOK_TOKEN}&${filterQuery}&per_page=100`;
  
  log(`🔗 Fetching from: ${url.replace(STORYBLOK_TOKEN, '[TOKEN]')}`, quietMode);
  
  return new Promise((resolve, reject) => {
    let currentRequest = null;
    
    const makeRequest = (requestUrl) => {
      currentRequest = https.get(requestUrl, {
        timeout: 30000, // 30 second timeout
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Connection': 'close'
        }
      }, (res) => {
        let data = '';
        
        log(`📡 Response status: ${res.statusCode}`, quietMode);
        
        // Handle redirects
        if (res.statusCode >= 300 && res.statusCode < 400) {
          const location = res.headers.location;
          log(`🔄 Following redirect to: ${location}`, quietMode);
          currentRequest.destroy();
          makeRequest(location);
          return;
        }
        
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          log(`📦 Response length: ${data.length} bytes`, quietMode);
          
          if (!data.trim()) {
            reject(new Error('❌ Empty response from Storyblok API'));
            return;
          }
          
          try {
            const response = JSON.parse(data);
            
            // Check for unauthorized error
            if (response.error === 'Unauthorized') {
              reject(new Error('❌ Unauthorized: Check your NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN'));
              return;
            }
            
            if (response.error) {
              reject(new Error(`❌ Storyblok API Error: ${response.error}`));
              return;
            }
            
            resolve(response.stories || []);
          } catch (error) {
            console.error('❌ JSON Parse Error. Raw response:');
            console.error(data.substring(0, 500) + (data.length > 500 ? '...' : ''));
            reject(new Error(`❌ Failed to parse JSON response: ${error.message}`));
          }
        });
      }).on('error', (error) => {
        reject(new Error(`❌ Network error: ${error.message}`));
      }).on('timeout', () => {
        if (currentRequest) {
          currentRequest.destroy();
        }
        reject(new Error('❌ Request timeout'));
      });
    };
    
    makeRequest(url);
  });
}

// Get social graph image URL for a given URL
async function getSocialGraphImage(url, quietMode = false) {
  if (!url) return null;
  
  try {
    const options = { 
      url: url,
      timeout: 10000, // 10 second timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    };
    
    const { error, result } = await ogs(options);
    
    if (error) {
      if (!quietMode) {
        console.warn(`⚠️ Failed to get social graph image for ${url}:`, error);
      }
      return null;
    }
    
    // Try different image sources in order of preference
    if (result.ogImage && result.ogImage.length > 0) {
      return result.ogImage[0].url;
    }
    
    if (result.twitterImage && result.twitterImage.length > 0) {
      return result.twitterImage[0].url;
    }
    
    if (result.ogImageSecureUrl) {
      return result.ogImageSecureUrl;
    }
    
    if (result.ogImageUrl) {
      return result.ogImageUrl;
    }
    
    return null;
    
  } catch (error) {
    if (!quietMode) {
      console.warn(`⚠️ Failed to get social graph image for ${url}:`, error.message);
    }
    return null;
  }
}

// Download and process image from URL with security measures
async function downloadImage(imageUrl, resizedFilePath, quietMode = false) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalSize = 0;
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB limit
    const MAX_DIMENSION = 20000; // 20000px max dimension
    
    // Validate URL scheme
    try {
      const urlObj = new URL(imageUrl);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        reject(new Error('Invalid URL protocol'));
        return;
      }
    } catch (error) {
      reject(new Error('Invalid URL format'));
      return;
    }
    
    const request = https.get(imageUrl, {
      timeout: 30000, // 30 second timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'image/*',
        'Connection': 'close'
      }
    }, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      
      // Check content type
      const contentType = response.headers['content-type'];
      if (!contentType || !contentType.startsWith('image/')) {
        reject(new Error('Invalid content type'));
        return;
      }
      
      // Check content length
      const contentLength = response.headers['content-length'];
      if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE) {
        reject(new Error('File too large'));
        return;
      }
      
      response.on('data', (chunk) => {
        totalSize += chunk.length;
        
        // Check size limit during download
        if (totalSize > MAX_FILE_SIZE) {
          request.destroy();
          reject(new Error('File too large'));
          return;
        }
        
        chunks.push(chunk);
      });
      
      response.on('end', async () => {
        try {
          const imageBuffer = Buffer.concat(chunks);
          
          // Check if sharp is available for processing
          if (!sharp) {
            if (!quietMode) {
              console.warn('⚠️ Sharp not available, saving original image without processing');
            }
            fs.writeFileSync(resizedFilePath, imageBuffer);
            resolve();
            return;
          }
          
          // Validate image with sharp before processing
          const metadata = await sharp(imageBuffer).metadata();
          
          // Check image dimensions
          if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
            reject(new Error('Image dimensions too large'));
            return;
          }
          
          // Process image with sharp: resize to max 720px width, convert to JPG, strip metadata
          const processedBuffer = await sharp(imageBuffer)
            .resize(720, null, {
              withoutEnlargement: true,
              fit: 'inside'
            })
            .withMetadata(false) // Strip all metadata including EXIF
            .jpeg({
              quality: 85,
              progressive: true,
              mozjpeg: true // Use mozjpeg encoder for better security
            })
            .toBuffer();
          
          // Write only the processed image to file
          fs.writeFileSync(resizedFilePath, processedBuffer);
          resolve();
        } catch (error) {
          reject(new Error(`Image processing failed: ${error.message}`));
        }
      });
      
      response.on('error', (error) => {
        reject(error);
      });
    });
    
    request.on('error', (error) => {
      reject(error);
    });
    
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}


// Generate resized filename
function getResizedFileName(storySlug) {
  return `${storySlug}-resized.jpg`;
}

// Check for manually added images with various naming patterns
function findManuallyAddedImage(storySlug, quietMode = false) {
  // First check if already processed image exists in main directory
  const exactMatch = getResizedFileName(storySlug);
  const processedPath = path.join(NEWS_IMAGES_DIR, exactMatch);
  if (fs.existsSync(processedPath)) {
    return processedPath;
  }
  
  // Then check manual directory for source images
  if (!fs.existsSync(MANUAL_IMAGES_DIR)) {
    return null;
  }
  
  const files = fs.readdirSync(MANUAL_IMAGES_DIR);
  
  // Try variations: slug.jpg, slug.jpeg, slug.png, slug.webp
  const extensions = ['jpg', 'jpeg', 'png', 'webp'];
  for (const ext of extensions) {
    const filename = `${storySlug}.${ext}`;
    if (files.includes(filename)) {
      return path.join(MANUAL_IMAGES_DIR, filename);
    }
  }
  
  // Try with different separators or slight variations
  // e.g., slug-image.jpg, slug_image.jpg
  const variations = [
    `${storySlug}-image.jpg`,
    `${storySlug}_image.jpg`,
    `${storySlug}-image.jpeg`,
    `${storySlug}_image.jpeg`,
    `${storySlug}-image.png`,
    `${storySlug}_image.png`,
  ];
  
  for (const filename of variations) {
    if (files.includes(filename)) {
      return path.join(MANUAL_IMAGES_DIR, filename);
    }
  }
  
  return null;
}

// Process a manually added image (resize, convert to JPG, strip metadata)
async function processManuallyAddedImage(sourcePath, targetPath, quietMode = false) {
  try {
    if (!fs.existsSync(sourcePath)) {
      throw new Error('Source image does not exist');
    }
    
    // If source and target are the same, we still need to process it
    const imageBuffer = fs.readFileSync(sourcePath);
    
    // Check if sharp is available
    if (!sharp) {
      if (!quietMode) {
        console.warn('⚠️ Sharp not available, copying image without processing');
      }
      // If target is different from source, copy it
      if (sourcePath !== targetPath) {
        fs.copyFileSync(sourcePath, targetPath);
      }
      return;
    }
    
    // Validate image with sharp
    const metadata = await sharp(imageBuffer).metadata();
    
    // Check image dimensions
    const MAX_DIMENSION = 20000;
    if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
      throw new Error('Image dimensions too large');
    }
    
    // Process image: resize to max 720px width, convert to JPG, strip metadata
    const processedBuffer = await sharp(imageBuffer)
      .resize(720, null, {
        withoutEnlargement: true,
        fit: 'inside'
      })
      .withMetadata(false) // Strip all metadata including EXIF
      .jpeg({
        quality: 85,
        progressive: true,
        mozjpeg: true
      })
      .toBuffer();
    
    // Write processed image
    fs.writeFileSync(targetPath, processedBuffer);
    
    // If source and target are different, optionally remove source
    // (We'll keep it for now in case user wants to keep original)
    
  } catch (error) {
    throw new Error(`Failed to process manually added image: ${error.message}`);
  }
}

// Generate image manifest based on existing files
function generateImageManifest(quietMode = false) {
  const MANIFEST_PATH = path.join(NEWS_IMAGES_DIR, 'image-manifest.json');
  
  log('📋 Generating image manifest...', quietMode);
  
  if (!fs.existsSync(NEWS_IMAGES_DIR)) {
    log('❌ News images directory does not exist', quietMode);
    return {};
  }
  
  const manifest = {};
  const files = fs.readdirSync(NEWS_IMAGES_DIR);
  
  // Look for resized images (pattern: slug-resized.jpg)
  const resizedImages = files.filter(file => file.endsWith('-resized.jpg'));
  
  resizedImages.forEach(file => {
    const slug = file.replace('-resized.jpg', '');
    manifest[slug] = `/files/news/${file}`;
  });
  
  log(`✅ Found ${Object.keys(manifest).length} images in manifest`, quietMode);
  
  // Write manifest to file
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  log(`📄 Manifest written to: ${MANIFEST_PATH}`, quietMode);
  
  return manifest;
}


// Quiet mode logging helper
function log(message, quietMode = false) {
  if (!quietMode) {
    console.log(message);
  }
}


// Main function
async function main() {
  const args = process.argv.slice(2);
  const testMode = args.includes('--test') || args.includes('-t');
  const forceMode = args.includes('--force') || args.includes('-f');
  const quietMode = args.includes('--quiet') || args.includes('-q');
  
  // Set up graceful shutdown
  const cleanup = () => {
    log('🛑 Cleaning up and exiting...', quietMode);
    process.exit(0);
  };
  
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error);
    process.exit(1);
  });
  
  log('🔍 Fetching news stories...', quietMode);
  
  if (forceMode) {
    log('🔄 Force mode enabled - will re-download all images', quietMode);
  }
  
  try {
    const stories = await fetchNewsStories(quietMode);
    log(`📰 Found ${stories.length} news stories`, quietMode);
    
    let processed = 0;
    let skipped = 0;
    let errors = 0;
    let currentIndex = 0;
    const missingImages = []; // Track stories with missing images
    
    for (const story of stories) {
      currentIndex++;
      const storyId = story.id;
      const storySlug = story.slug;
      const url = story.content?.url?.url;
      
      if (!url) {
        log(`⏭️ Skipping story ${storyId} (${storySlug}): No URL`, quietMode);
        skipped++;
        continue;
      }
      
      // Check if resized image already exists (unless force mode)
      const resizedImagePath = path.join(NEWS_IMAGES_DIR, getResizedFileName(storySlug));
      
      if (!forceMode && fs.existsSync(resizedImagePath)) {
        log(`✅ Resized image already exists for story ${storyId} (${storySlug})`, quietMode);
        skipped++;
        continue;
      }
      
      log(`🖼️  Processing story ${storyId} (${storySlug}): ${url}`, quietMode);
      
      // In test mode, only process the first missing image
      if (testMode) {
        log('🧪 Test mode: Processing only this story', quietMode);
      }
      
      try {
        // Generate image path
        const resizedImagePath = path.join(NEWS_IMAGES_DIR, getResizedFileName(storySlug));
        
        // Get social graph image
        const imageUrl = await getSocialGraphImage(url, quietMode);
        
        if (imageUrl) {
          // Download and process image from Open Graph
          await downloadImage(imageUrl, resizedImagePath, quietMode);
          log(`✅ Downloaded and processed image for story ${storyId} (${storySlug})`, quietMode);
          log(`   📁 Resized: ${resizedImagePath}`, quietMode);
          processed++;
        } else {
          // Fallback: Check for manually added image
          const manuallyAddedImage = findManuallyAddedImage(storySlug, quietMode);
          
          if (manuallyAddedImage) {
            log(`📎 Found manually added image for story ${storyId} (${storySlug}): ${path.basename(manuallyAddedImage)}`, quietMode);
            
            // Process the manually added image (resize, convert to JPG if needed)
            await processManuallyAddedImage(manuallyAddedImage, resizedImagePath, quietMode);
            log(`✅ Processed manually added image for story ${storyId} (${storySlug})`, quietMode);
            log(`   📁 Resized: ${resizedImagePath}`, quietMode);
            processed++;
          } else {
            log(`❌ No image found (Open Graph or manual) for story ${storyId} (${storySlug})`, quietMode);
            errors++;
            missingImages.push({ slug: storySlug, url: url });
          }
        }
        
        // Small delay to be respectful to the API
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // In test mode, exit after processing one story
        if (testMode) {
          log('🧪 Test mode: Exiting after processing one story', quietMode);
          break;
        }
        
      } catch (error) {
        console.error(`❌ Error processing story ${storyId} (${storySlug}):`, error.message);
        errors++;
        
        // In test mode, exit even on error
        if (testMode) {
          log('🧪 Test mode: Exiting after error', quietMode);
          break;
        }
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`✅ Processed: ${processed}`);
    console.log(`⏭️ Skipped: ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    
    // Generate image manifest after processing all images
    generateImageManifest(quietMode);
    
    // Show instructions for manually adding missing images
    if (missingImages.length > 0) {
      console.log('\n📝 Manual Image Instructions:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Some articles are missing images. To add them manually:');
      console.log('');
      console.log('1. Place image files in: public/files/news/manual/');
      console.log('2. Name them using one of these patterns:');
      console.log('   - SLUG.jpg (or .jpeg, .png, .webp)');
      console.log('   - SLUG-image.jpg');
      console.log('');
      console.log('3. The script will automatically find, process, and save them to public/files/news/');
      console.log('   (processed images will be saved as SLUG-resized.jpg)');
      console.log('');
      console.log('Missing images for these articles:');
      missingImages.forEach(({ slug, url }) => {
        console.log(`   📄 ${slug}`);
        console.log(`      🔗 ${url}`);
        console.log(`      → Place image at: public/files/news/manual/${slug}.jpg`);
      });
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
    
    console.log('🎉 Script completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    if (error.message.includes('Unauthorized')) {
      console.error('💡 Make sure your NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN is correct and has proper permissions.');
    }
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main };
