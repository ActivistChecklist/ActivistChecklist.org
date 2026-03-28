import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import readline from 'readline';
import {
  sectionStart,
  sectionEnd,
  detail,
  attention,
  subsection,
} from './lib/build-cli.mjs';

const OUTPUT_DIR = 'out';
const APPROVED_URLS_FILE = '.approved-urls.json';

const URL_APPROVAL_MODE = (process.env.CHECKBUILD_URL_APPROVAL || 'prompt').toLowerCase();
const isInteractive = URL_APPROVAL_MODE === 'prompt';

// Only create readline interface when we intend to prompt.
const rl = isInteractive
  ? readline.createInterface({ input: process.stdin, output: process.stdout })
  : null;

// Promisify readline question (only used in interactive mode)
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// Load approved URLs from file
function loadApprovedUrls() {
  try {
    if (fs.existsSync(APPROVED_URLS_FILE)) {
      return new Set(JSON.parse(fs.readFileSync(APPROVED_URLS_FILE, 'utf8')));
    }
  } catch (error) {
    console.warn(chalk.yellow(`Warning: Could not load approved URLs: ${error.message}`));
  }
  return new Set();
}

// Save approved URLs to file
function saveApprovedUrls(approvedUrls) {
  try {
    fs.writeFileSync(APPROVED_URLS_FILE, JSON.stringify([...approvedUrls], null, 2));
  } catch (error) {
    console.error(chalk.red(`Error saving approved URLs: ${error.message}`));
  }
}

// Ask for URL approval
async function approveUrls(urls) {
  const sortedUrls = [...urls].sort();

  if (!isInteractive) {
    detail(
      `${sortedUrls.length} new external URL(s) — acknowledged without listing (CHECKBUILD_URL_APPROVAL≠prompt)`
    );
    return true;
  }

  attention('🔍', 'New URLs found that need approval');
  sortedUrls.forEach((url, index) => {
    const files = Array.from(urlLocations.get(url));
    detail(`${index + 1}. ${url}`);
    files.forEach((file) => detail(`   ${file}`));
  });

  const answer = await question(chalk.yellow('\nApprove all these URLs? (y/n): '));
  return answer.toLowerCase().startsWith('y');
}

// Define all find/replace patterns
const REPLACEMENTS = [
  // Replace storyblock CDN images with local images
  {
    pattern: /@?https?:\/\/[a-z-]+\.storyblok\.com\/f\/\d+\/[\w-]+\/[\w-]+\//g,
    replacement: '/images/'
  },
  // Make sure that none of their scripts call their API ever
  {
    pattern: /storyblok\.com/g,
    replacement: 'BLOCKEDSTORYBLOK'
  },
  // Comes from Stroyblok
  {
    pattern: /cdn\.jsdelivr\.net/g,
    replacement: 'BLOCKEDJSDELIVR'
  },
  // Google fonts
  {
    pattern: /fonts\.googleapis\.com/g,
    replacement: 'BLOCKEDGOOGLE'
  },
  // Next.js documentation URLs (error messages in bundled code)
  {
    pattern: /https?:\/\/nextjs\.org\/docs\/messages\/[^\s"'<>()]+/g,
    replacement: 'BLOCKEDNEXTJSDOCS'
  }
];

const FORBIDDEN_STRINGS = [
  '://localhost',
  'localhost:300',
  '://127.0.0.1',
  'notion.so',
  'notion.site',
  'storyblok.io',
];

// Exceptions: allow specific forbidden strings in bundled third-party code.
// Keystatic uses "http://localhost" as a base URL for the URL constructor (not a real request)
// and registers 127.0.0.1 as a GitHub OAuth callback for local development.
const FORBIDDEN_STRING_EXCEPTIONS = [
  { string: '://localhost', filePattern: '_next/static/chunks/' },
  { string: 'localhost:300', filePattern: '_next/static/chunks/' },
  { string: '://127.0.0.1', filePattern: '_next/static/chunks/' },
];
const CONTEXT_CHARS = 150; // Number of characters to show before and after match

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Store all findings
const findings = [];
// Store all URLs with their locations
const urlLocations = new Map(); // url -> Set<string> (filenames)

// Extract only real HTML attributes (avoid JSON/script blobs like __NEXT_DATA__)
const HREF_PATTERN = /href="([^"]*?)"/gi;
const SRC_PATTERN = /src="([^"]*?)"/gi;
const SRCSET_PATTERN = /srcset="([^"]*?)"/gi;

// Store replacement stats
const replacementStats = new Map();

function getContext(content, matchIndex, matchLength) {
  const start = Math.max(0, matchIndex - CONTEXT_CHARS);
  const end = Math.min(content.length, matchIndex + matchLength + CONTEXT_CHARS);

  let context = content.substring(start, end);
  if (start > 0) context = '...' + context;
  if (end < content.length) context = context + '...';

  return context;
}

function recordUrl(url, filePath) {
  if (!url || typeof url !== 'string') return;
  if (!url.startsWith('http://') && !url.startsWith('https://')) return;
  if (!urlLocations.has(url)) {
    urlLocations.set(url, new Set());
  }
  urlLocations.get(url).add(filePath);
}

function extractUrls(content, filePath) {
  // Only extract from rendered HTML attributes. This avoids false positives
  // from serialized JSON, escaped strings, and code examples in page source.
  if (!filePath.endsWith('.html')) return;

  let match;
  while ((match = HREF_PATTERN.exec(content)) !== null) {
    recordUrl(match[1], filePath);
  }
  while ((match = SRC_PATTERN.exec(content)) !== null) {
    recordUrl(match[1], filePath);
  }
  while ((match = SRCSET_PATTERN.exec(content)) !== null) {
    const entries = match[1].split(',');
    for (const entry of entries) {
      const srcUrl = entry.trim().split(/\s+/)[0];
      recordUrl(srcUrl, filePath);
    }
  }
}

function applyReplacements(content) {
  let newContent = content;
  for (const { pattern, replacement } of REPLACEMENTS) {
    const matches = content.match(pattern) || [];
    const count = matches.length;
    if (count > 0) {
      const key = pattern.toString();
      replacementStats.set(key, (replacementStats.get(key) || 0) + count);
    }
    newContent = newContent.replace(pattern, replacement);
  }
  return newContent;
}

function readAndTransformFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const transformedContent = applyReplacements(content);

  if (transformedContent !== content) {
    fs.writeFileSync(filePath, transformedContent);
  }

  return transformedContent;
}

function isExcepted(forbiddenString, filePath) {
  return FORBIDDEN_STRING_EXCEPTIONS.some(
    ex => ex.string === forbiddenString && filePath.includes(ex.filePattern)
  );
}

function checkForbiddenStrings(content, filePath) {
  const fileFindings = [];

  for (const forbiddenString of FORBIDDEN_STRINGS) {
    if (isExcepted(forbiddenString, filePath)) continue;

    let index = content.indexOf(forbiddenString);
    while (index !== -1) {
      const context = getContext(content, index, forbiddenString.length);
      fileFindings.push({
        file: filePath,
        string: forbiddenString,
        context
      });
      index = content.indexOf(forbiddenString, index + 1);
    }
  }

  return fileFindings;
}

async function scanFile(filePath) {
  // Read and transform the file
  const content = readAndTransformFile(filePath);

  // Check for forbidden strings
  const fileFindings = checkForbiddenStrings(content, filePath);
  findings.push(...fileFindings);

  // Extract URLs only from non-bundled files
  // Bundled JS files contain doc URLs from React/Next.js/webpack that aren't actual content links
  if (!isBundledJsFile(filePath)) {
    extractUrls(content, filePath);
  }
}

function isTargetFile(file) {
  return file.endsWith('.html') || file.endsWith('.js');
}

// Check if a file is a bundled JS file (framework code with embedded doc URLs)
function isBundledJsFile(filePath) {
  return filePath.includes('_next/static/chunks/');
}

async function scanDirectory(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      await scanDirectory(fullPath);
    } else if (stat.isFile() && isTargetFile(file)) {
      await scanFile(fullPath);
    }
  }
}

try {
  const outputDir = path.resolve(__dirname, '..', OUTPUT_DIR);
  const approvedUrls = loadApprovedUrls();

  if (!fs.existsSync(outputDir)) {
    sectionStart('🔒', 'Check build — scrub output & scan');
    detail(`No out/ at ${outputDir}`);
    detail('Skipping (normal when you are not doing a static export)');
    sectionEnd(true, ['Skipped — no output directory']);
    process.exit(0);
  }

  sectionStart('🔒', 'Check build — scrub output & scan');
  detail(`Scanning ${outputDir} (HTML/JS for tokens & external URLs)`);
  await scanDirectory(outputDir);

  const newUrls = Array.from(urlLocations.keys()).filter(url => !approvedUrls.has(url));
  let newUrlsApproved = true;

  if (newUrls.length > 0) {
    const areApproved = await approveUrls(newUrls);
    newUrlsApproved = areApproved;

    if (areApproved) {
      if (isInteractive) {
        newUrls.forEach(url => approvedUrls.add(url));
        detail(`Added ${newUrls.length} URL(s) to approved list (total ${approvedUrls.size})`);
      } else {
        detail(`Proceeding with ${newUrls.length} new URL(s) — not saved to ${APPROVED_URLS_FILE}`);
      }
    } else {
      newUrls.forEach(url => {
        detail(`Rejected URL: ${url}`);
        findings.push({
          file: Array.from(urlLocations.get(url))[0],
          string: url,
          context: 'URL not approved'
        });
      });
    }

    if (isInteractive && areApproved) {
      saveApprovedUrls(approvedUrls);
    }
  } else {
    detail(`External URLs: no new links (${approvedUrls.size} already in approved list)`);
  }

  subsection('🔄', 'Replacement statistics');
  if (replacementStats.size > 0) {
    REPLACEMENTS.forEach(({ pattern, replacement }) => {
      const count = replacementStats.get(pattern.toString()) || 0;
      if (count > 0) {
        detail(`${count}× ${String(pattern).slice(0, 48)}… → ${replacement}`);
      }
    });
  } else {
    detail('No pattern replacements applied');
  }

  const replacementTotal = [...replacementStats.values()].reduce((a, b) => a + b, 0);

  if (findings.length > 0) {
    subsection('🚫', 'Forbidden strings & blocked URLs');
    const groupedFindings = findings.reduce((acc, finding) => {
      if (!acc[finding.file]) {
        acc[finding.file] = [];
      }
      acc[finding.file].push(finding);
      return acc;
    }, {});

    Object.entries(groupedFindings).forEach(([file, fileFindings], fileIndex) => {
      console.error(`\n${chalk.yellow.bold(`  File ${fileIndex + 1}:`)} ${chalk.yellow(file)}`);
      fileFindings.forEach((finding, index) => {
        console.error(`     ${chalk.red(`${index + 1}. "${chalk.bold(finding.string)}"`)}`);
        console.error(`        ${chalk.gray(finding.context)}`);
      });
    });
  } else {
    subsection('🚫', 'Forbidden strings');
    detail('None found');
  }

  const summary = [];
  if (newUrls.length === 0) {
    summary.push(`External URLs: ${approvedUrls.size} known, none new`);
  } else if (newUrlsApproved) {
    summary.push(
      `External URLs: ${newUrls.length} new — ${isInteractive ? 'approved' : 'acknowledged (CI/non-interactive)'}`
    );
  } else {
    summary.push(`External URLs: ${newUrls.length} new — rejected`);
  }
  summary.push(
    replacementTotal > 0
      ? `Rewrites: ${replacementTotal} substitution(s) in output`
      : 'Rewrites: none'
  );
  summary.push(
    findings.length === 0
      ? 'Forbidden / policy: clean'
      : `Forbidden / policy: ${findings.length} issue(s)`
  );

  sectionEnd(findings.length === 0, summary);

  if (rl) rl.close();
  process.exit(findings.length > 0 ? 1 : 0);
} catch (error) {
  console.error(chalk.red.bold('Check build error:'), chalk.red(error.message));
  if (rl) rl.close();
  process.exit(1);
}
