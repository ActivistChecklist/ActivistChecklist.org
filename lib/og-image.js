const fs = require('fs');
const path = require('path');

const WIDTH = 1200;
const HEIGHT = 630;

// Brand colors (from globals.css)
const BRAND_PRIMARY = '#6c5ce7'; // hsl(247, 100%, 65.5%)
const BRAND_DARK = '#1a1333';    // hsl(247, 53%, 7%)
const BRAND_GRAY_30 = '#b3b0ba'; // hsl(252, 3%, 72%)
const BRAND_ACCENT_LIGHT = '#f0eeff'; // hsl(247, 100%, 96%)

let _fontBase64 = null;
let _logoBuffer = null;

/**
 * Load and cache the font as base64 for embedding in SVG
 */
function getFontBase64() {
  if (_fontBase64) return _fontBase64;
  const fontPath = path.join(process.cwd(), 'public', 'fonts', 'libre-franklin-v20-latin-800.woff2');
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
  if (_logoBuffer) return _logoBuffer;
  const logoPath = path.join(process.cwd(), 'public', 'images', 'logo-bg-white.png');
  if (!fs.existsSync(logoPath)) {
    console.warn('Logo not found:', logoPath);
    return null;
  }
  const sharp = require('sharp');
  // Resize logo to fit in bottom bar
  _logoBuffer = await sharp(logoPath)
    .resize({ height: 40, fit: 'inside' })
    .toBuffer();
  return _logoBuffer;
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
    const avgCharWidth = fontSize * 0.55;
    const charsPerLine = Math.floor(maxWidth / avgCharWidth);
    const lines = wrapText(title, charsPerLine);

    if (lines.length <= maxLines) {
      return { fontSize, lines };
    }
  }

  // Fallback: smallest size, truncated
  const avgCharWidth = 32 * 0.55;
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
 * Generate a subtle dot pattern for visual interest
 */
function generateDotPattern(startX, startY, width, height, spacing) {
  const dots = [];
  for (let x = startX; x < startX + width; x += spacing) {
    for (let y = startY; y < startY + height; y += spacing) {
      dots.push(`<circle cx="${x}" cy="${y}" r="2" fill="${BRAND_PRIMARY}"/>`);
    }
  }
  return dots.join('\n    ');
}

/**
 * Generate SVG markup for an OG image (without logo - logo composited separately)
 */
function generateSvg(title, componentType, fontBase64) {
  const maxTextWidth = 900;
  const { fontSize, lines } = fitTitle(title, maxTextWidth);
  const lineHeight = fontSize * 1.15;

  // Vertically center the title in the main area (between label and bottom bar)
  const availableTop = 110;
  const availableBottom = HEIGHT - 90;
  const availableHeight = availableBottom - availableTop;
  const titleBlockHeight = lines.length * lineHeight;
  const titleStartY = availableTop + (availableHeight - titleBlockHeight) / 2 + fontSize * 0.8;

  const titleLines = lines.map((line, i) => {
    const y = Math.round(titleStartY + (i * lineHeight));
    return `<text x="80" y="${y}" font-family="Libre Franklin" font-weight="800" font-size="${fontSize}" fill="${BRAND_DARK}" letter-spacing="-0.02em">${escapeXml(line)}</text>`;
  }).join('\n    ');

  const typeLabel = componentType === 'guide' ? 'SECURITY CHECKLIST' : 'RESOURCE';

  return `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @font-face {
        font-family: 'Libre Franklin';
        font-weight: 800;
        src: url('data:font/woff2;base64,${fontBase64}') format('woff2');
      }
    </style>
  </defs>

  <!-- Background -->
  <rect width="${WIDTH}" height="${HEIGHT}" fill="white"/>

  <!-- Accent bar at top -->
  <rect x="0" y="0" width="${WIDTH}" height="6" fill="${BRAND_PRIMARY}"/>

  <!-- Decorative dot pattern (top-right) -->
  <g opacity="0.06">
    ${generateDotPattern(900, 20, 280, 200, 24)}
  </g>

  <!-- Type label -->
  <text x="82" y="80" font-family="Libre Franklin, system-ui, sans-serif" font-weight="800" font-size="14" fill="${BRAND_PRIMARY}" letter-spacing="0.15em">${typeLabel}</text>

  <!-- Title -->
  ${titleLines}

  <!-- Bottom bar -->
  <rect x="0" y="${HEIGHT - 90}" width="${WIDTH}" height="90" fill="${BRAND_ACCENT_LIGHT}"/>
  <line x1="0" y1="${HEIGHT - 90}" x2="${WIDTH}" y2="${HEIGHT - 90}" stroke="${BRAND_PRIMARY}" stroke-width="1" opacity="0.15"/>

  <!-- Site name -->
  <text x="80" y="${HEIGHT - 42}" font-family="Libre Franklin, system-ui, sans-serif" font-weight="800" font-size="22" fill="${BRAND_DARK}" letter-spacing="-0.01em">ActivistChecklist.org</text>

  <!-- Tagline -->
  <text x="80" y="${HEIGHT - 22}" font-family="Libre Franklin, system-ui, sans-serif" font-weight="800" font-size="13" fill="${BRAND_GRAY_30}" letter-spacing="0.02em">Digital Security for Activists</text>
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
    const logoBuffer = await getLogoBuffer();

    const composites = [];
    if (logoBuffer) {
      composites.push({
        input: logoBuffer,
        top: HEIGHT - 65,     // vertically centered in bottom bar
        left: WIDTH - 300,    // right-aligned with padding
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
  const logoBuffer = await getLogoBuffer();

  const composites = [];
  if (logoBuffer) {
    composites.push({
      input: logoBuffer,
      top: HEIGHT - 70,
      left: WIDTH - 260,
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
