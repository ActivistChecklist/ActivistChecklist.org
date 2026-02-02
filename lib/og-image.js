const fs = require('fs');
const path = require('path');

// Import icons from shared config
const { GUIDE_ICONS, DEFAULT_ICON } = require('../config/icons.js');

const WIDTH = 1200;
const HEIGHT = 630;

const BRAND_PRIMARY = '#6c5ce7';
const BRAND_DARK = '#1a1333';

// Pages that should use the default OG image instead of a custom one
const USE_DEFAULT_OG_IMAGE = [
  'home',
  '',
  'privacy',
  'contact',
  'resources',
  'about',
  'checklists',
  'flyer',
];

let _fontData = null;
let _buttonFontData = null;
let _logoBase64 = null;

/**
 * Extract SVG data from a react-icons component
 */
function extractIconSvgData(IconComponent) {
  if (!IconComponent) return null;
  try {
    const el = IconComponent({});
    const viewBox = el.props?.attr?.viewBox || '0 0 512 512';
    const children = el.props?.children || [];
    // Extract all SVG elements (path, rect, circle, etc.)
    const elements = children.map(child => ({
      type: child.type,
      props: { ...child.props },
    }));
    return { viewBox, elements };
  } catch (e) {
    return null;
  }
}

/**
 * Get icon for a given slug
 */
function getIconForSlug(slug) {
  if (!slug) return extractIconSvgData(DEFAULT_ICON);
  // Try to match slug to a guide key
  const normalizedSlug = slug.toLowerCase().replace(/\//g, '');
  for (const [key, icon] of Object.entries(GUIDE_ICONS)) {
    if (normalizedSlug.includes(key)) {
      return extractIconSvgData(icon);
    }
  }
  return extractIconSvgData(DEFAULT_ICON);
}

/**
 * Load and cache the font as a buffer for satori
 */
function getFontData() {
  if (_fontData) return _fontData;
  // Try the decompressed v20 800-weight TTF first, then the variable font
  const candidates = [
    path.join(process.cwd(), 'public', 'fonts', 'libre-franklin-extrabold.ttf'),
    path.join(process.cwd(), 'public', 'fonts', 'libre-franklin-v20-latin-800.ttf'),
  ];
  for (const fontPath of candidates) {
    if (fs.existsSync(fontPath)) {
      _fontData = fs.readFileSync(fontPath);
      return _fontData;
    }
  }
  console.warn('OG image font not found');
  return null;
}

/**
 * Load and cache the button font (Source Sans 3 Semibold) as a buffer for satori
 */
function getButtonFontData() {
  if (_buttonFontData) return _buttonFontData;
  const fontPath = path.join(process.cwd(), 'public', 'fonts', 'source-sans-3-semibold.ttf');
  if (fs.existsSync(fontPath)) {
    _buttonFontData = fs.readFileSync(fontPath);
    return _buttonFontData;
  }
  console.warn('Button font not found');
  return null;
}

/**
 * Load and cache the logo as a base64 data URI for embedding in satori
 */
function getLogoBase64() {
  if (_logoBase64) return _logoBase64;
  const logoPath = path.join(process.cwd(), 'public', 'images', 'logo-stacked-color-transparent.png');
  if (!fs.existsSync(logoPath)) {
    console.warn('Logo not found:', logoPath);
    return null;
  }
  const buf = fs.readFileSync(logoPath);
  _logoBase64 = `data:image/png;base64,${buf.toString('base64')}`;
  return _logoBase64;
}

/**
 * Build SVG element tree for an icon
 */
function buildIconElement(iconData, size = 48) {
  if (!iconData) return null;
  
  // Check if this is a stroke-based icon (has strokeWidth) or fill-based
  const hasStroke = iconData.elements.some(el => el.props?.strokeWidth);
  
  return {
    type: 'svg',
    props: {
      width: size,
      height: size,
      viewBox: iconData.viewBox,
      // For stroke-based icons: no fill, use stroke
      // For fill-based icons: use fill, no stroke
      fill: hasStroke ? 'none' : BRAND_PRIMARY,
      stroke: hasStroke ? BRAND_PRIMARY : 'none',
      children: iconData.elements.map((element, i) => {
        // Remove children prop from the element props (they're empty arrays)
        const { children, ...props } = element.props;
        return {
          type: element.type,
          props: {
            key: i,
            ...props,
          },
        };
      }),
    },
  };
}

/**
 * Build the satori element tree for an OG image.
 * Satori uses a React-like element format: { type, props, children }
 */
function buildImageTree(title, componentType, slug = '') {
  const typeLabel = componentType === 'guide' ? 'SECURITY CHECKLIST' : 'RESOURCE';
  const iconData = getIconForSlug(slug);
  const logoSrc = getLogoBase64();

  // Satori handles text wrapping and sizing natively via flexbox,
  // but we still want to pick a reasonable font size based on title length.
  let fontSize = 100;
  if (title.length > 80) fontSize = 70;
  else if (title.length > 60) fontSize = 80;
  else if (title.length > 40) fontSize = 90;
  else if (title.length > 25) fontSize = 100;

  return {
    type: 'div',
    props: {
      style: {
        width: WIDTH,
        height: HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        backgroundColor: 'white',
      },
      children: [
        // Primary accent bar at top
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: 0,
              left: 0,
              width: WIDTH,
              height: 24,
              backgroundColor: BRAND_PRIMARY,
            },
          },
        },
        // Main content area
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              flex: 1,
              paddingLeft: 70,
              paddingRight: 70,
              paddingTop: 50,
              paddingBottom: 50,
            },
            children: [
              // Type label at top
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: 36,
                    fontWeight: 800,
                    color: BRAND_PRIMARY,
                    letterSpacing: '0.14em',
                    marginBottom: 24,
                  },
                  children: typeLabel,
                },
              },
              // Icon box + Title row
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    alignItems: 'flex-start',
                  },
                  children: [
                    // Icon box
                    iconData ? {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 100,
                          height: 100,
                          borderRadius: 20,
                          backgroundColor: 'rgba(108, 92, 231, 0.1)',
                          marginRight: 28,
                          flexShrink: 0,
                        },
                        children: [buildIconElement(iconData, 60)],
                      },
                    } : null,
                    // Title
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          fontSize,
                          fontWeight: 800,
                          color: BRAND_DARK,
                          letterSpacing: '-0.03em',
                          lineHeight: 1.1,
                          flexWrap: 'wrap',
                          flex: 1,
                        },
                        children: title,
                      },
                    },
                  ].filter(Boolean),
                },
              },
              // CTA button + logo row
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 'auto',
                    marginLeft: iconData ? 128 : 0, // 100 (icon) + 28 (gap) if icon exists
                  },
                  children: [
                    // Button
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          alignItems: 'center',
                          backgroundColor: BRAND_PRIMARY,
                          color: 'white',
                          fontFamily: 'Source Sans 3',
                          fontWeight: 600,
                          fontSize: 48,
                          paddingLeft: 40,
                          paddingRight: 36,
                          paddingTop: 24,
                          paddingBottom: 24,
                          borderRadius: 16,
                        },
                        children: [
                          {
                            type: 'span',
                            props: {
                              children: 'Read Guide',
                            },
                          },
                          {
                            type: 'span',
                            props: {
                              style: {
                                marginLeft: 16,
                                fontSize: 48,
                              },
                              children: '→',
                            },
                          },
                        ],
                      },
                    },
                    // Logo
                    logoSrc ? {
                      type: 'img',
                      props: {
                        src: logoSrc,
                        style: {
                          height: 100,
                        },
                      },
                    } : null,
                  ].filter(Boolean),
                },
              },
            ],
          },
        },
      ].filter(Boolean),
    },
  };
}

/**
 * Render an OG image to SVG using satori, then convert to PNG with sharp.
 */
async function renderOgImage(title, componentType, slug = '', options = {}) {
  const satori = require('satori').default || require('satori');
  const sharp = require('sharp');

  const fontData = getFontData();
  const buttonFontData = getButtonFontData();
  if (!fontData) return null;

  const element = buildImageTree(title, componentType, slug);

  const fonts = [
    {
      name: 'Libre Franklin',
      data: fontData,
      weight: 800,
      style: 'normal',
    },
  ];
  
  if (buttonFontData) {
    fonts.push({
      name: 'Source Sans 3',
      data: buttonFontData,
      weight: 600,
      style: 'normal',
    });
  }

  const svg = await satori(element, {
    width: WIDTH,
    height: HEIGHT,
    fonts,
  });

  const compressionLevel = options.compressionLevel ?? 9;
  return sharp(Buffer.from(svg))
    .png({ compressionLevel })
    .toBuffer();
}

/**
 * Generate an OG image PNG for a story, saving to public/images/og/
 */
async function generateOgImageForStory(story) {
  const title = story.content?.title || story.name;
  if (!title) return null;

  const componentType = story.content?.component || 'page';
  const slug = (story.full_slug || '').replace(/\/$/, '') || 'home';
  
  // Use default OG image for certain pages
  if (USE_DEFAULT_OG_IMAGE.includes(slug)) {
    return '/images/og-image.png';
  }

  const safeName = slug.replace(/\//g, '-');
  const fileName = `${safeName}.png`;

  const outputDir = path.join(process.cwd(), 'public', 'images', 'og');
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, fileName);

  if (fs.existsSync(outputPath)) {
    return `/images/og/${fileName}`;
  }

  try {
    const buffer = await renderOgImage(title, componentType, slug);
    if (!buffer) return null;
    fs.writeFileSync(outputPath, buffer);
    return `/images/og/${fileName}`;
  } catch (error) {
    console.warn(`Failed to generate OG image for "${title}":`, error.message);
    return null;
  }
}

/**
 * Generate OG image and return PNG buffer (for API route / preview)
 */
async function generateOgImageBuffer(title, componentType = 'page', slug = '') {
  return renderOgImage(title, componentType, slug, { compressionLevel: 6 });
}

module.exports = {
  generateOgImageForStory,
  generateOgImageBuffer,
  buildImageTree,
  getFontData,
};
