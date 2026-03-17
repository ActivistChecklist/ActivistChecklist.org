import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_DIR = path.resolve(__dirname, '..', 'out');

// Prefixes to skip -- these are managed by other tools or are external
const SKIP_PREFIXES = ['/_next/', '/pagefind/'];

// Patterns to extract href and src values from HTML
const HREF_PATTERN = /href="([^"]*?)"/g;
const SRC_PATTERN = /src="([^"]*?)"/g;
const SRCSET_PATTERN = /srcset="([^"]*?)"/g;

function getAllHtmlFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllHtmlFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }
  return files;
}

function shouldSkip(localPath) {
  // Skip external URLs
  if (localPath.startsWith('http://') || localPath.startsWith('https://') || localPath.startsWith('//')) {
    return true;
  }
  // Skip non-path values
  if (localPath.startsWith('mailto:') || localPath.startsWith('tel:') ||
      localPath.startsWith('javascript:') || localPath.startsWith('data:') ||
      localPath.startsWith('blob:')) {
    return true;
  }
  // Skip fragment-only links
  if (localPath.startsWith('#')) {
    return true;
  }
  // Skip empty
  if (!localPath || localPath.trim() === '') {
    return true;
  }
  // Skip known build asset prefixes
  for (const prefix of SKIP_PREFIXES) {
    if (localPath.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

function stripQueryAndFragment(urlPath) {
  let cleaned = urlPath;
  const hashIndex = cleaned.indexOf('#');
  if (hashIndex !== -1) {
    cleaned = cleaned.substring(0, hashIndex);
  }
  const queryIndex = cleaned.indexOf('?');
  if (queryIndex !== -1) {
    cleaned = cleaned.substring(0, queryIndex);
  }
  return cleaned;
}

function pathResolves(localPath) {
  const cleaned = stripQueryAndFragment(localPath);
  if (!cleaned || cleaned === '/') return true; // Root path always resolves

  const fullPath = path.join(OUT_DIR, cleaned);

  // Check if the exact path exists as a file
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    return true;
  }

  // Check if the exact path exists as a directory with index.html
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
    const indexPath = path.join(fullPath, 'index.html');
    return fs.existsSync(indexPath);
  }

  // For paths without extension (e.g., /essentials), check path/index.html
  const ext = path.extname(cleaned);
  if (!ext) {
    const indexPath = path.join(fullPath, 'index.html');
    return fs.existsSync(indexPath);
  }

  return false;
}

function extractPaths(htmlContent) {
  const paths = [];

  // Extract href values
  let match;
  while ((match = HREF_PATTERN.exec(htmlContent)) !== null) {
    paths.push({ path: match[1], type: 'link' });
  }

  // Extract src values
  while ((match = SRC_PATTERN.exec(htmlContent)) !== null) {
    paths.push({ path: match[1], type: 'resource' });
  }

  // Extract srcset values (may contain multiple URLs separated by commas)
  while ((match = SRCSET_PATTERN.exec(htmlContent)) !== null) {
    const srcsetValue = match[1];
    // srcset contains entries like "/images/photo.jpg 1x, /images/photo@2x.jpg 2x"
    for (const entry of srcsetValue.split(',')) {
      const url = entry.trim().split(/\s+/)[0];
      if (url) {
        paths.push({ path: url, type: 'resource' });
      }
    }
  }

  return paths;
}

function main() {
  if (!fs.existsSync(OUT_DIR)) {
    console.error(chalk.red(`Output directory '${OUT_DIR}' does not exist. Run buildstatic first.`));
    process.exit(0);
  }

  console.log(chalk.blue(`\nChecking internal links and images in ${chalk.bold(OUT_DIR)}...\n`));

  const htmlFiles = getAllHtmlFiles(OUT_DIR);
  console.log(chalk.gray(`  Found ${htmlFiles.length} HTML files to check`));

  const brokenLinks = [];
  const brokenResources = [];
  const checkedPaths = new Map(); // cache: path -> resolves (boolean)

  for (const file of htmlFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const extracted = extractPaths(content);
    const relativeFile = path.relative(OUT_DIR, file);

    for (const { path: extractedPath, type } of extracted) {
      if (shouldSkip(extractedPath)) continue;

      const cleaned = stripQueryAndFragment(extractedPath);
      if (!cleaned) continue;

      // Use cache to avoid re-checking the same path
      if (!checkedPaths.has(cleaned)) {
        checkedPaths.set(cleaned, pathResolves(cleaned));
      }

      if (!checkedPaths.get(cleaned)) {
        const entry = { sourceFile: relativeFile, path: extractedPath };
        if (type === 'link') {
          brokenLinks.push(entry);
        } else {
          brokenResources.push(entry);
        }
      }
    }
  }

  // Deduplicate findings (same broken path reported from multiple files is fine, but same path+file is noise)
  const dedup = (entries) => {
    const seen = new Set();
    return entries.filter(e => {
      const key = `${e.sourceFile}::${e.path}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const uniqueBrokenLinks = dedup(brokenLinks);
  const uniqueBrokenResources = dedup(brokenResources);

  // Report
  if (uniqueBrokenLinks.length > 0) {
    console.error(chalk.red.bold(`\n  Broken internal links (${uniqueBrokenLinks.length}):`));
    // Group by broken path
    const byPath = {};
    for (const entry of uniqueBrokenLinks) {
      if (!byPath[entry.path]) byPath[entry.path] = [];
      byPath[entry.path].push(entry.sourceFile);
    }
    for (const [brokenPath, files] of Object.entries(byPath)) {
      console.error(chalk.red(`    ${brokenPath}`));
      for (const f of files.slice(0, 5)) {
        console.error(chalk.gray(`      in ${f}`));
      }
      if (files.length > 5) {
        console.error(chalk.gray(`      ... and ${files.length - 5} more files`));
      }
    }
  }

  if (uniqueBrokenResources.length > 0) {
    console.error(chalk.red.bold(`\n  Broken local images/resources (${uniqueBrokenResources.length}):`));
    const byPath = {};
    for (const entry of uniqueBrokenResources) {
      if (!byPath[entry.path]) byPath[entry.path] = [];
      byPath[entry.path].push(entry.sourceFile);
    }
    for (const [brokenPath, files] of Object.entries(byPath)) {
      console.error(chalk.red(`    ${brokenPath}`));
      for (const f of files.slice(0, 5)) {
        console.error(chalk.gray(`      in ${f}`));
      }
      if (files.length > 5) {
        console.error(chalk.gray(`      ... and ${files.length - 5} more files`));
      }
    }
  }

  const totalBroken = uniqueBrokenLinks.length + uniqueBrokenResources.length;
  const totalChecked = checkedPaths.size;

  if (totalBroken === 0) {
    console.log(chalk.green.bold(`\n  All ${totalChecked} local paths verified.\n`));
    process.exit(0);
  } else {
    console.error(chalk.red.bold(`\n  ${totalBroken} broken paths found out of ${totalChecked} checked.\n`));
    process.exit(1);
  }
}

main();
