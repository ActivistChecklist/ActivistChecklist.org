const { Feed } = require('feed');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * Extensible RSS generator that can handle different content types
 * @param {Object} config - Configuration object
 * @param {string} config.feedType - Type of feed ('changelog' or 'news')
 * @param {string} config.title - Feed title
 * @param {string} config.description - Feed description
 * @param {string} config.filename - Output filename (e.g., 'rss.xml', 'news-rss.xml')
 * @param {Function} config.fetchItems - Function to fetch items
 * @param {Function} config.transformItem - Function to transform item for RSS
 * @param {Object} config.feedOptions - Additional feed options
 */
async function generateRSSFeed(config) {
  try {
    // Import Storyblok utilities
    const { storyblokInit, apiPlugin, getStoryblokApi } = await import('@storyblok/react');
    const { getStoryblokVersion } = await import('../utils/core.js');
    
    // Initialize Storyblok (same config as _app.js)
    storyblokInit({
      accessToken: process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN,
      use: [apiPlugin],
      apiOptions: {
        region: "us",
        version: process.env.NODE_ENV === 'development' ? 'draft' : 'published'
      }
    });
    
    const storyblokApi = getStoryblokApi();
    
    // Fetch items using the provided function
    const allItems = await config.fetchItems(storyblokApi, {
      version: getStoryblokVersion()
    });

    // Sort by date, newest first
    const sortedItems = (allItems || []).sort((a, b) => {
      const dateA = new Date(a.content?.date || a.first_published_at || a.created_at);
      const dateB = new Date(b.content?.date || b.first_published_at || b.created_at);
      return dateB - dateA; // Newest first
    });

    // Default feed options
    const defaultFeedOptions = {
      title: config.title,
      description: config.description,
      id: "https://activistchecklist.org/",
      link: "https://activistchecklist.org/",
      language: "en",
      image: "https://activistchecklist.org/images/logo-bg-white.png",
      favicon: "https://activistchecklist.org/favicon.ico",
      copyright: "All rights reserved, Activist Checklist",
      updated: sortedItems.length > 0 ? new Date(sortedItems[0].content?.date || sortedItems[0].first_published_at || sortedItems[0].created_at) : new Date(),
      generator: "Activist Checklist RSS Generator",
      feedLinks: {
        rss2: `https://activistchecklist.org/rss/${config.filename}`,
      },
      author: {
        name: "Activist Checklist",
        email: "contact@activistchecklist.org",
        link: "https://activistchecklist.org/"
      }
    };

    // Merge with custom feed options
    const feedOptions = { ...defaultFeedOptions, ...config.feedOptions };

    // Create feed
    const feed = new Feed(feedOptions);

    // Add entries to feed using the transform function
    sortedItems.forEach(item => {
      const rssItem = config.transformItem(item);
      feed.addItem(rssItem);
    });

    // Write RSS file to out/rss directory (final static export destination)
    const outDir = path.join(process.cwd(), 'out');
    const rssDir = path.join(outDir, 'rss');
    
    if (!fs.existsSync(rssDir)) {
      fs.mkdirSync(rssDir, { recursive: true });
    }
    
    const rssPath = path.join(rssDir, config.filename);
    fs.writeFileSync(rssPath, feed.rss2());
    
    console.log(`✅ ${config.feedType} RSS feed generated with ${sortedItems.length} entries: ${rssPath}`);
    
  } catch (error) {
    console.error(`❌ Error generating ${config.feedType} RSS feed:`, error);
    process.exit(1);
  }
}

// Helper function to extract text from Storyblok rich text
function extractTextFromRichText(richTextDoc) {
  if (!richTextDoc || !richTextDoc.content) return '';
  
  let text = '';
  
  function extractFromNode(node) {
    if (node.type === 'text') {
      text += node.text || '';
    } else if (node.content && Array.isArray(node.content)) {
      node.content.forEach(extractFromNode);
    }
    
    // Add space after paragraphs and other block elements
    if (node.type === 'paragraph' || node.type === 'heading') {
      text += ' ';
    }
  }
  
  richTextDoc.content.forEach(extractFromNode);
  
  // Clean up extra whitespace
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Generate changelog RSS feed
 */
async function generateChangelogRSS() {
  const { fetchAllChangelogEntries } = await import('../utils/core.js');
  
  return generateRSSFeed({
    feedType: 'changelog',
    title: "Activist Checklist - Recent Updates",
    description: "Recent updates and improvements to Activist Checklist digital security guides",
    filename: 'changelog.xml',
    fetchItems: fetchAllChangelogEntries,
    transformItem: (story) => {
      const entryDate = new Date(story.first_published_at || story.created_at);
      
      // Convert rich text to plain text for description
      let description = '';
      if (story.content && story.content.body) {
        description = extractTextFromRichText(story.content.body);
      }
      
      return {
        title: story.name || `Update from ${entryDate.toLocaleDateString()}`,
        id: `https://activistchecklist.org/changelog#${story.uuid}`,
        link: `https://activistchecklist.org/changelog#${story.uuid}`,
        description: description || 'Site update',
        content: description || 'Site update',
        author: [{
          name: "Activist Checklist",
          email: "contact@activistchecklist.org",
          link: "https://activistchecklist.org/"
        }],
        date: entryDate,
      };
    }
  });
}

/**
 * Generate news RSS feed
 */
async function generateNewsRSS() {
  const { fetchAllNewsItems } = await import('../utils/core.js');
  
  return generateRSSFeed({
    feedType: 'news',
    title: "Activist Checklist - News",
    description: "Latest news about digital security, surveillance, and activism",
    filename: 'news.xml',
    fetchItems: fetchAllNewsItems,
    transformItem: (story) => {
      const entryDate = new Date(story.content?.date || story.first_published_at || story.created_at);
      const { source, url, comment } = story.content || {};
      
      // Extract description from comment or use source
      let description = '';
      if (comment) {
        description = extractTextFromRichText(comment);
      } else if (source) {
        description = `News from ${source.name || source}`;
      }
      
      // Use direct article URL if available, otherwise fallback to site link
      const articleUrl = url?.url || `https://activistchecklist.org/news#${story.uuid}`;
      
      return {
        title: story.name || 'News Item',
        id: articleUrl,
        link: articleUrl,
        description: description || 'News item',
        content: description || 'News item',
        author: [{
          name: source?.name || "Activist Checklist",
          email: "contact@activistchecklist.org",
          link: "https://activistchecklist.org/"
        }],
        date: entryDate,
      };
    }
  });
}

// Run if called directly
if (require.main === module) {
  const feedType = process.argv[2];
  
  if (feedType === 'news') {
    generateNewsRSS();
  } else if (feedType === 'changelog') {
    generateChangelogRSS();
  } else {
    // Generate both by default
    Promise.all([
      generateChangelogRSS(),
      generateNewsRSS()
    ]).then(() => {
      console.log('✅ All RSS feeds generated successfully');
    }).catch(error => {
      console.error('❌ Error generating RSS feeds:', error);
      process.exit(1);
    });
  }
}

module.exports = { 
  generateRSSFeed, 
  generateChangelogRSS, 
  generateNewsRSS 
};
