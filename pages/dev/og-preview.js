import Head from "next/head";
import { getAllGuides, getAllPages } from "@/lib/content";

export default function OgPreview({ ogTargets = [], isDev }) {
  if (!isDev) {
    return (
      <>
        <Head><meta name="robots" content="noindex" /></Head>
        <p>Not available.</p>
      </>
    );
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '40px 20px', fontFamily: 'system-ui, sans-serif' }}>
      <Head>
        <title>OG Image Preview | Dev</title>
        <meta name="robots" content="noindex" />
      </Head>

      <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px' }}>
        OG Share Image Preview
      </h1>
      <p style={{ color: '#666', marginBottom: '40px', fontSize: '14px' }}>
        Dev-only preview of generated share images. These are generated at build time for each page.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 300px)', gap: '24px' }}>
        {ogTargets.map((target) => {
          const title = target.title;
          const type = target.pageType || 'page';
          const slug = target.slug || '';
          const imgSrc = `/api/og-image?title=${encodeURIComponent(title)}&type=${encodeURIComponent(type)}&slug=${encodeURIComponent(slug)}`;

          return (
            <div key={slug} style={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', background: '#fafafa' }}>
              <img
                src={imgSrc}
                alt={`OG image for: ${title}`}
                style={{ width: '100%', display: 'block', aspectRatio: '1200/630' }}
                loading="lazy"
              />
              <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1a1333' }}>{title}</div>
                <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '1px 8px',
                    borderRadius: '4px',
                    background: type === 'guide' ? '#f0eeff' : '#f0f0f0',
                    color: type === 'guide' ? '#6c5ce7' : '#666',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    {type}
                  </span>
                  <span style={{ marginLeft: '8px', color: '#aaa' }}>/{slug}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export async function getStaticProps({ locale = 'en' }) {
  if (process.env.NODE_ENV !== 'development') {
    return { notFound: true };
  }

  const messages = (await import(`../../messages/${locale}.json`)).default;

  const guides = getAllGuides('en').map((g) => {
    const slug = g.frontmatter.slug || g.slug;
    const title = g.frontmatter.title;
    return {
      slug,
      title,
      pageType: 'guide',
    };
  });

  const pages = getAllPages('en').map((p) => {
    const slug = p.frontmatter.slug || p.slug;
    const title = p.frontmatter.title;
    return {
      slug,
      title,
      pageType: 'page',
    };
  });

  const ogTargets = [...guides, ...pages].sort((a, b) =>
    a.slug.localeCompare(b.slug)
  );

  return {
    props: { ogTargets, isDev: true, messages },
  };
}
