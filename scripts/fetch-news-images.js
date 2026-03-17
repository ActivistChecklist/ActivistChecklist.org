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

// Try to load MetadataStripper for thorough metadata removal
let MetadataStripper;
try {
  MetadataStripper = require('../lib/metadata-library.cjs').MetadataStripper;
} catch (error) {
  // MetadataStripper not available, will use basic Sharp metadata stripping
  MetadataStripper = null;
}

// Load environment variables
require('dotenv').config();

// Configuration
const NEWS_IMAGES_DIR = path.join(__dirname, '..', 'public', 'files', 'news');
const STORYBLOK_TOKEN = process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN;


if (!STORYBLOK_TOKEN) {
  console.error('❌ Missing required environment variable: NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN');
  process.exit(1);
}

// Ensure news images directory exists
if (!fs.existsSync(NEWS_IMAGES_DIR)) {
  fs.mkdirSync(NEWS_IMAGES_DIR, { recursive: true });
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
          
          // Strip metadata thoroughly (same as other images)
          let strippedBuffer = imageBuffer;
          if (MetadataStripper) {
            try {
              const stripper = new MetadataStripper({ verbose: false });
              strippedBuffer = await stripper.stripImageMetadata(imageBuffer);
            } catch (metadataError) {
              // If metadata stripping fails, fall back to basic Sharp stripping
              if (!quietMode) {
                console.warn(`⚠️ Advanced metadata stripping failed, using basic method: ${metadataError.message}`);
              }
              // Continue with basic stripping below
            }
          }
          
          // Process image with sharp: resize to max 720px width, convert to JPG, ensure no metadata
          const processedBuffer = await sharp(strippedBuffer)
            .resize(720, null, {
              withoutEnlargement: true,
              fit: 'inside'
            })
            .withMetadata(false) // Ensure no metadata (redundant but safe)
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

// Get image override URL from story content
function getImageOverrideUrl(story) {
  const imageOverride = story.content?.image_override;
  if (!imageOverride) {
    return null;
  }
  
  // Handle string directly
  if (typeof imageOverride === 'string' && imageOverride.trim()) {
    return imageOverride.trim();
  }
  
  // Handle Storyblok image object - check cached_url, filename, url (in that order)
  // First try direct properties
  const directUrl = imageOverride.cached_url || imageOverride.filename || imageOverride.url;
  if (directUrl && typeof directUrl === 'string' && directUrl.trim()) {
    return directUrl.trim();
  }
  
  // Then try nested image object (image_override.image.*)
  if (imageOverride.image) {
    const nestedUrl = imageOverride.image.cached_url || imageOverride.image.filename || imageOverride.image.url;
    if (nestedUrl && typeof nestedUrl === 'string' && nestedUrl.trim()) {
      return nestedUrl.trim();
    }
  }
  
  return null;
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
        
        // Check for image override first
        const overrideUrl = getImageOverrideUrl(story);
        let imageUrl = null;
        let imageSource = null;
        
        if (overrideUrl) {
          imageUrl = overrideUrl;
          imageSource = 'override';
          log(`📎 Using image override for story ${storyId} (${storySlug})`, quietMode);
        } else {
          // Fallback to Open Graph image
          imageUrl = await getSocialGraphImage(url, quietMode);
          imageSource = 'opengraph';
        }
        
        if (imageUrl) {
          // Download and process image
          await downloadImage(imageUrl, resizedImagePath, quietMode);
          log(`✅ Downloaded and processed image for story ${storyId} (${storySlug}) from ${imageSource}`, quietMode);
          log(`   📁 Resized: ${resizedImagePath}`, quietMode);
          processed++;
        } else {
          // Only report error if no override is set
          if (!overrideUrl) {
            log(`❌ No image found (Open Graph) for story ${storyId} (${storySlug})`, quietMode);
            errors++;
            missingImages.push({ slug: storySlug, url: url });
          } else {
            // Override was set but URL was invalid/empty - this shouldn't happen but handle gracefully
            log(`⚠️ Image override set but URL is invalid for story ${storyId} (${storySlug})`, quietMode);
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
        
        // Check if image_override is set - if not, add to missing images list
        const overrideUrl = getImageOverrideUrl(story);
        if (!overrideUrl) {
          missingImages.push({ slug: storySlug, url: url });
        }
        
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
    
    // Show failures (only for items without image_override set)
    if (missingImages.length > 0) {
      console.log('\n❌ Articles missing images (no image_override set):');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      console.log('To fix these missing images:');
      console.log('');
      console.log('1. Open Storyblok and navigate to each news item listed below');
      console.log('2. Find the "image_override" field in the content');
      console.log('3. Upload an image or paste an image URL');
      console.log('4. Save and publish the story');
      console.log('5. Run this script again to process the override images');
      console.log('');
      console.log('Missing images for these articles:');
      missingImages.forEach(({ slug, url }) => {
        console.log(`   📄 ${slug}`);
        console.log(`      🔗 ${url}`);
        console.log(`      → Add image_override in Storyblok for this news item`);
      });
      console.log('');
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
