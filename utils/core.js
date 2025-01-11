export const isProd = process.env.NODE_ENV === 'production';
export const isDev = process.env.NODE_ENV === 'development';
export const isStaticBuild = process.env.BUILD_MODE === 'static';
export const isVercel = process.env.VERCEL === 'true';

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