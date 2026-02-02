import { generateOgImageBuffer } from '@/lib/og-image';

// Pages that should use the default OG image
const USE_DEFAULT_OG_IMAGE = ['home', '', 'privacy', 'contact', 'resources', 'about', 'checklists', 'flyer'];

export default async function handler(req, res) {
  // Only available in development
  if (process.env.NODE_ENV !== 'development') {
    return res.status(404).json({ error: 'Not found' });
  }

  const { title = 'Activist Checklist', type = 'page', slug = '' } = req.query;

  // Redirect to default OG image for certain pages
  if (USE_DEFAULT_OG_IMAGE.includes(slug)) {
    return res.redirect('/images/og-image.png');
  }

  try {
    const buffer = await generateOgImageBuffer(title, type, slug);
    if (!buffer) {
      return res.status(500).json({ error: 'Failed to generate image' });
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache');
    return res.send(buffer);
  } catch (error) {
    console.error('OG image generation error:', error);
    return res.status(500).json({ error: error.message });
  }
}
