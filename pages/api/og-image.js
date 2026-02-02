import { generateOgImageBuffer } from '@/lib/og-image';

export default async function handler(req, res) {
  // Only available in development
  if (process.env.NODE_ENV !== 'development') {
    return res.status(404).json({ error: 'Not found' });
  }

  const { title = 'Activist Checklist', type = 'page' } = req.query;

  try {
    const buffer = await generateOgImageBuffer(title, type);
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
