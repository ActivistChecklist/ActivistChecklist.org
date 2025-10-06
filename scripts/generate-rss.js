const { Feed } = require('feed');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function generateRSSFeed() {
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
    
    // Fetch all changelog entries with pagination support
    const { fetchAllChangelogEntries } = await import('../utils/core.js');
    const allEntries = await fetchAllChangelogEntries(storyblokApi, {
      version: getStoryblokVersion()
    });

    // Sort by first_published_at or created_at as fallback, newest first
    const sortedEntries = (allEntries || []).sort((a, b) => {
      const dateA = new Date(a.first_published_at || a.created_at);
      const dateB = new Date(b.first_published_at || b.created_at);
      return dateB - dateA; // Newest first
    });

    // Create feed
    const feed = new Feed({
      title: "Activist Checklist - Recent Updates",
      description: "Recent updates and improvements to Activist Checklist digital security guides",
      id: "https://activistchecklist.org/",
      link: "https://activistchecklist.org/",
      language: "en",
      image: "https://activistchecklist.org/images/logo-bg-white.png",
      favicon: "https://activistchecklist.org/favicon.ico",
      copyright: "All rights reserved, Activist Checklist",
      updated: sortedEntries.length > 0 ? new Date(sortedEntries[0].first_published_at || sortedEntries[0].created_at) : new Date(),
      generator: "Activist Checklist RSS Generator",
      feedLinks: {
        rss2: "https://activistchecklist.org/rss.xml",
      },
      author: {
        name: "Activist Checklist",
        email: "contact@activistchecklist.org",
        link: "https://activistchecklist.org/"
      }
    });

    // Add entries to feed
    sortedEntries.forEach(story => {
      const entryDate = new Date(story.first_published_at || story.created_at);
      
      // Convert rich text to plain text for description
      let description = '';
      if (story.content && story.content.body) {
        // Simple extraction of text from rich text structure
        description = extractTextFromRichText(story.content.body);
      }
      
      feed.addItem({
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
      });
    });

    // Write RSS file to out directory (final static export destination)
    const outDir = path.join(process.cwd(), 'out');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    
    const rssPath = path.join(outDir, 'rss.xml');
    fs.writeFileSync(rssPath, feed.rss2());
    
    console.log(`✅ RSS feed generated with ${sortedEntries.length} entries: ${rssPath}`);
    
  } catch (error) {
    console.error('❌ Error generating RSS feed:', error);
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

// Run if called directly
if (require.main === module) {
  generateRSSFeed();
}

module.exports = { generateRSSFeed };
