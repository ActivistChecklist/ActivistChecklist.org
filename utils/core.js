export const isProd = process.env.NODE_ENV === 'production';
export const isDev = process.env.NODE_ENV === 'development';
export const isStaticBuild = process.env.BUILD_MODE === 'static';
export const isVercel = process.env.VERCEL === 'true';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Wrap a Storyblok API call with retry logic for rate limits (429) and transient errors.
 * Uses exponential backoff with jitter. Retries up to `maxRetries` times.
 */
export async function storyblokFetch(apiCall, { maxRetries = 4, baseDelay = 300 } = {}) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      const status = error?.status || error?.response?.status;
      const isRetryable = status === 429 || (status >= 500 && status < 600);

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 200;
      console.warn(
        `Storyblok API ${status} on attempt ${attempt + 1}/${maxRetries + 1}, ` +
        `retrying in ${Math.round(delay)}ms...`
      );
      await sleep(delay);
    }
  }
}

export const getStoryblokVersion = (isPreviewMode = false) => {
  return isDev || isPreviewMode ? "draft" : "published";
};

export const getRevalidate = () => {
  // 0 will revalidate on every request
  return !isStaticBuild ? { revalidate: 0 } : {};
};

export const truncateText = (text, maxLength = 150) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
};

export function renderRichTextTreeAsPlainText(richTextObj) {
  if (!richTextObj) return '';
  
  // If it's a text node, return its text content
  if (richTextObj.type === 'text') {
    return richTextObj.text;
  }
  
  // If it has content, recursively process each content item
  if (richTextObj.content) {
    return richTextObj.content
      .map(item => renderRichTextTreeAsPlainText(item))
      .filter(text => text) // Remove empty strings
      .join(' ');
  }
  
  // If it's a description object from Storyblok
  if (richTextObj.type === 'doc') {
    return renderRichTextTreeAsPlainText({ content: richTextObj.content });
  }
  
  return '';
}

export const slugify = (text, config = {}) => {
  const { maxLength, maxWords } = config;
  let slug = text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text

  if (maxLength && slug.length > maxLength) {
    slug = slug.slice(0, maxLength);
  }

  if (maxWords) {
    slug = slug.split('-').slice(0, maxWords).join('-');
  }

  return slug;
};

/**
 * Fetch all stories from Storyblok with pagination support
 * @param {Object} storyblokApi - The Storyblok API instance
 * @param {Object} options - Query options (version, excluding_fields, etc.)
 * @returns {Promise<Array>} Array of all stories
 */
export const fetchAllStories = async (storyblokApi, options = {}) => {
  let allStories = [];
  let page = 1;
  let hasMore = true;
  
  const baseOptions = {
    per_page: 100,
    ...options
  };
  
  while (hasMore) {
    const { data } = await storyblokFetch(() =>
      storyblokApi.get("cdn/stories", { ...baseOptions, page })
    );
    
    if (data?.stories?.length > 0) {
      allStories = allStories.concat(data.stories);
      hasMore = data.stories.length === 100;
      page++;
    } else {
      hasMore = false;
    }
  }
  
  return allStories;
};

/**
 * Fetch all changelog entries from Storyblok with pagination support
 * @param {Object} storyblokApi - The Storyblok API instance
 * @param {Object} options - Additional query options (version, sort_by, etc.)
 * @returns {Promise<Array>} Array of all changelog entries
 */
export const fetchAllChangelogEntries = async (storyblokApi, options = {}) => {
  return fetchAllStories(storyblokApi, {
    filter_query: {
      component: {
        in: "changelog-entry"
      }
    },
    sort_by: 'first_published_at:desc',
    excluding_fields: 'blocks',
    ...options
  });
};

/**
 * Fetch all news items from Storyblok with pagination support
 * @param {Object} storyblokApi - The Storyblok API instance
 * @param {Object} options - Additional query options (version, sort_by, etc.)
 * @returns {Promise<Array>} Array of all news items
 */
export const fetchAllNewsItems = async (storyblokApi, options = {}) => {
  return fetchAllStories(storyblokApi, {
    filter_query: {
      component: {
        in: "news-item"
      }
    },
    sort_by: 'first_published_at:desc',
    excluding_fields: 'blocks',
    resolve_relations: 'news-item.source',
    ...options
  });
};

/**
 * Load image manifest from the filesystem
 * @returns {Promise<Object>} Image manifest object
 */
export const loadImageManifest = async () => {
  try {
    // Check if we're in a browser environment
    if (typeof window !== 'undefined') {
      return {};
    }
    
    const fs = await import('fs');
    const path = await import('path');
    
    const manifestPath = path.join(process.cwd(), 'public', 'files', 'news', 'image-manifest.json');
    
    // Check if file exists before trying to read it
    if (!fs.existsSync(manifestPath)) {
      console.warn('Image manifest file does not exist:', manifestPath);
      return {};
    }
    
    const manifestData = fs.readFileSync(manifestPath, 'utf8');
    return JSON.parse(manifestData);
  } catch (error) {
    console.warn('Could not load image manifest:', error.message);
    return {};
  }
};

/**
 * Fetch news data with image manifest - shared utility for news pages
 * @param {Object} storyblokApi - The Storyblok API instance
 * @param {Object} options - Additional query options (version, sort_by, etc.)
 * @returns {Promise<Object>} Object with newsItems and imageManifest
 */
export const fetchNewsData = async (storyblokApi, options = {}) => {
  try {
    // Fetch all news items with pagination support
    const allItems = await fetchAllNewsItems(storyblokApi, options);

    // Load image manifest
    const imageManifest = await loadImageManifest();

    // Sort by content.date or first_published_at as fallback, newest first
    const sortedItems = (allItems || []).sort((a, b) => {
      const dateA = new Date(a.content.date || a.first_published_at || a.created_at);
      const dateB = new Date(b.content.date || b.first_published_at || b.created_at);
      return dateB - dateA; // Newest first
    });

    return {
      newsItems: sortedItems,
      imageManifest
    };
  } catch (error) {
    console.error('Error fetching news data:', error);
    return {
      newsItems: [],
      imageManifest: {}
    };
  }
};