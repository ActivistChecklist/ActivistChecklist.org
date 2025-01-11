/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://activistchecklist.org',
  generateRobotsTxt: false, // Since you already have a custom robots.txt
  outDir: 'out', // Since you're using static export
  generateIndexSitemap: false, // For smaller sites, you don't need index-sitemap.xml
} 