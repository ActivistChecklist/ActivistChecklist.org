#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const { createWriteStream } = require('fs');
const ogs = require('open-graph-scraper');

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
async function fetchNewsStories() {
  const url = `https://api-us.storyblok.com/v2/cdn/stories?token=${STORYBLOK_TOKEN}&starts_with=news/&per_page=100`;
  
  console.log(`🔗 Fetching from: ${url.replace(STORYBLOK_TOKEN, '[TOKEN]')}`);
  
  return new Promise((resolve, reject) => {
    const makeRequest = (requestUrl) => {
      https.get(requestUrl, (res) => {
        let data = '';
        
        console.log(`📡 Response status: ${res.statusCode}`);
        
        // Handle redirects
        if (res.statusCode >= 300 && res.statusCode < 400) {
          const location = res.headers.location;
          console.log(`🔄 Following redirect to: ${location}`);
          makeRequest(location);
          return;
        }
        
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          console.log(`📦 Response length: ${data.length} bytes`);
          
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
      });
    };
    
    makeRequest(url);
  });
}

// Get social graph image URL for a given URL
async function getSocialGraphImage(url) {
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
      console.warn(`⚠️ Failed to get social graph image for ${url}:`, error);
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
    console.warn(`⚠️ Failed to get social graph image for ${url}:`, error.message);
    return null;
  }
}

// Download image from URL
async function downloadImage(imageUrl, filePath) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(filePath);
    
    https.get(imageUrl, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
      
      file.on('error', (error) => {
        fs.unlink(filePath, () => {}); // Delete the file on error
        reject(error);
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

// Get file extension from URL
function getFileExtension(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const ext = path.extname(pathname).toLowerCase();
    
    // Default to jpg if no extension found
    return ext || '.jpg';
  } catch {
    return '.jpg';
  }
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const testMode = args.includes('--test') || args.includes('-t');
  
  console.log('🔍 Fetching news stories...');
  
  try {
    const stories = await fetchNewsStories();
    console.log(`📰 Found ${stories.length} news stories`);
    
    let processed = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const story of stories) {
      const storyId = story.id;
      const storySlug = story.slug;
      const url = story.content?.url?.url;
      
      if (!url) {
        console.log(`⏭️ Skipping story ${storyId} (${storySlug}): No URL`);
        skipped++;
        continue;
      }
      
      // Check if image already exists
      const possibleExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
      let existingImage = null;
      
      for (const ext of possibleExtensions) {
        const imagePath = path.join(NEWS_IMAGES_DIR, `${storySlug}${ext}`);
        if (fs.existsSync(imagePath)) {
          existingImage = imagePath;
          break;
        }
      }
      
      if (existingImage) {
        console.log(`✅ Image already exists for story ${storyId} (${storySlug})`);
        skipped++;
        continue;
      }
      
      console.log(`🖼️ Processing story ${storyId} (${storySlug}): ${url}`);
      
      // In test mode, only process the first missing image
      if (testMode) {
        console.log('🧪 Test mode: Processing only this story');
      }
      
      try {
        // Get social graph image
        const imageUrl = await getSocialGraphImage(url);
        
        if (!imageUrl) {
          console.log(`❌ No social graph image found for story ${storyId} (${storySlug})`);
          errors++;
          continue;
        }
        
        // Determine file extension
        const ext = getFileExtension(imageUrl);
        const imagePath = path.join(NEWS_IMAGES_DIR, `${storySlug}${ext}`);
        
        // Download image
        await downloadImage(imageUrl, imagePath);
        console.log(`✅ Downloaded image for story ${storyId} (${storySlug}): ${imagePath}`);
        processed++;
        
        // Small delay to be respectful to the API
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // In test mode, exit after processing one story
        if (testMode) {
          console.log('🧪 Test mode: Exiting after processing one story');
          break;
        }
        
      } catch (error) {
        console.error(`❌ Error processing story ${storyId} (${storySlug}):`, error.message);
        errors++;
        
        // In test mode, exit even on error
        if (testMode) {
          console.log('🧪 Test mode: Exiting after error');
          break;
        }
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`✅ Processed: ${processed}`);
    console.log(`⏭️ Skipped: ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    
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
