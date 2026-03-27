export const isProd = process.env.NODE_ENV === 'production';
export const isDev = process.env.NODE_ENV === 'development';
export const isStaticBuild = process.env.BUILD_MODE === 'static';
export const isVercel = process.env.VERCEL === 'true';

/**
 * Language switcher + browser-language banner: off in production builds unless explicitly enabled.
 * Set NEXT_PUBLIC_SHOW_TRANSLATION_UI=true when non-English locales are ready to surface in the UI.
 */
export const isTranslationUiVisible =
  process.env.NODE_ENV !== 'production' ||
  process.env.NEXT_PUBLIC_SHOW_TRANSLATION_UI === 'true';

export const getRevalidate = () => {
  // 0 will revalidate on every request
  return !isStaticBuild ? { revalidate: 0 } : {};
};

export const truncateText = (text, maxLength = 150) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
};

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
