const fs = require('fs');
const path = require('path');

const WIDTH = 1200;
const HEIGHT = 630;

// Brand colors (from globals.css)
const BRAND_PRIMARY = '#6c5ce7'; // hsl(247, 100%, 65.5%)
const BRAND_DARK = '#1a1333';    // hsl(247, 53%, 7%)

let _fontBase64 = null;
let _logoBuffer = null;
let _logoMeta = null;

/**
 * Load and cache the variable font TTF as base64 for embedding in SVG
 */
function getFontBase64() {
  if (_fontBase64) return _fontBase64;
  const fontPath = path.join(process.cwd(), 'public', 'fonts', 'LibreFranklin-VariableFont_wght.ttf');
  if (!fs.existsSync(fontPath)) {
    console.warn('OG image font not found:', fontPath);
    return null;
  }
  _fontBase64 = fs.readFileSync(fontPath).toString('base64');
  return _fontBase64;
}

/**
 * Load and cache the logo as a resized buffer for compositing
 */
async function getLogoBuffer() {
  if (_logoBuffer) return { buffer: _logoBuffer, meta: _logoMeta };
  const logoPath = path.join(process.cwd(), 'public', 'images', 'logo-bg-white.png');
  if (!fs.existsSync(logoPath)) {
    console.warn('Logo not found:', logoPath);
    return null;
  }
  const sharp = require('sharp');
  // Resize logo to be prominent in the top-right
  _logoBuffer = await sharp(logoPath)
    .resize({ height: 80, fit: 'inside' })
    .toBuffer();
  _logoMeta = await sharp(_logoBuffer).metadata();
  return { buffer: _logoBuffer, meta: _logoMeta };
}

/**
 * Word-wrap text to fit within a character limit
 */
function wrapText(text, charsPerLine) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length <= charsPerLine) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines;
}

/**
 * Calculate font size that fits the title within bounds.
 */
function fitTitle(title, maxWidth, maxLines = 3) {
  const sizes = [72, 64, 56, 48, 42, 36, 32];

  for (const fontSize of sizes) {
    const avgCharWidth = fontSize * 0.52;
    const charsPerLine = Math.floor(maxWidth / avgCharWidth);
    const lines = wrapText(title, charsPerLine);

    if (lines.length <= maxLines) {
      return { fontSize, lines };
    }
  }

  // Fallback: smallest size, truncated
  const avgCharWidth = 32 * 0.52;
  const charsPerLine = Math.floor(maxWidth / avgCharWidth);
  const allLines = wrapText(title, charsPerLine);
  const lines = allLines.slice(0, maxLines);
  if (allLines.length > maxLines) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s+\S*$/, '') + '...';
  }

  return { fontSize: 32, lines };
}

/**
 * Escape XML special characters
 */
function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate SVG markup for an OG image (logo composited separately via sharp)
 */
function generateSvg(title, componentType, fontBase64) {
  const maxTextWidth = 940;
  const { fontSize, lines } = fitTitle(title, maxTextWidth);
  const lineHeight = fontSize * 1.18;

  // Layout: type label near top, title vertically centered in remaining space
  const labelY = 180;
  const titleAreaTop = labelY + 30;
  const titleAreaBottom = HEIGHT - 60;
  const titleAreaHeight = titleAreaBottom - titleAreaTop;
  const titleBlockHeight = lines.length * lineHeight;
  const titleStartY = titleAreaTop + (titleAreaHeight - titleBlockHeight) / 2 + fontSize * 0.8;

  const titleLines = lines.map((line, i) => {
    const y = Math.round(titleStartY + (i * lineHeight));
    return `<text x="70" y="${y}" font-family="LibreFranklin" font-weight="800" font-size="${fontSize}" fill="${BRAND_DARK}" letter-spacing="-0.02em">${escapeXml(line)}</text>`;
  }).join('\n    ');

  const typeLabel = componentType === 'guide' ? 'SECURITY CHECKLIST' : 'RESOURCE';

  return `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @font-face {
        font-family: 'LibreFranklin';
        src: url('data:font/ttf;base64,${fontBase64}') format('truetype');
      }
    </style>
  </defs>

  <!-- Background -->
  <rect width="${WIDTH}" height="${HEIGHT}" fill="white"/>

  <!-- Accent bar at top -->
  <rect x="0" y="0" width="${WIDTH}" height="6" fill="${BRAND_PRIMARY}"/>

  <!-- Type label -->
  <text x="72" y="${labelY}" font-family="LibreFranklin" font-weight="800" font-size="18" fill="${BRAND_PRIMARY}" letter-spacing="0.14em">${typeLabel}</text>

  <!-- Title -->
  ${titleLines}
</svg>`;
}

/**
 * Generate an OG image PNG for a story, saving to public/images/og/
 * Returns the relative path to the image, or null on failure.
 */
async function generateOgImageForStory(story) {
  const title = story.content?.title || story.name;
  if (!title) return null;

  const fontBase64 = getFontBase64();
  if (!fontBase64) return null;

  const componentType = story.content?.component || 'page';
  const slug = (story.full_slug || '').replace(/\/$/, '') || 'home';
  const safeName = slug.replace(/\//g, '-');
  const fileName = `${safeName}.png`;

  const outputDir = path.join(process.cwd(), 'public', 'images', 'og');
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, fileName);

  // Skip if already generated (cache for rebuild speed)
  if (fs.existsSync(outputPath)) {
    return `/images/og/${fileName}`;
  }

  try {
    const sharp = require('sharp');
    const svg = generateSvg(title, componentType, fontBase64);
    const logo = await getLogoBuffer();

    const composites = [];
    if (logo) {
      composites.push({
        input: logo.buffer,
        top: 50,
        left: WIDTH - logo.meta.width - 60,
      });
    }

    await sharp(Buffer.from(svg))
      .composite(composites)
      .png({ compressionLevel: 9 })
      .toFile(outputPath);

    return `/images/og/${fileName}`;
  } catch (error) {
    console.warn(`Failed to generate OG image for "${title}":`, error.message);
    return null;
  }
}

/**
 * Generate OG image and return PNG buffer (for API route / preview)
 */
async function generateOgImageBuffer(title, componentType = 'page') {
  const fontBase64 = getFontBase64();
  if (!fontBase64) return null;

  const sharp = require('sharp');
  const svg = generateSvg(title, componentType, fontBase64);
  const logo = await getLogoBuffer();

  const composites = [];
  if (logo) {
    composites.push({
      input: logo.buffer,
      top: 50,
      left: WIDTH - logo.meta.width - 60,
    });
  }

  return sharp(Buffer.from(svg))
    .composite(composites)
    .png({ compressionLevel: 6 })
    .toBuffer();
}

module.exports = {
  generateOgImageForStory,
  generateOgImageBuffer,
  generateSvg,
  fitTitle,
  getFontBase64,
};
