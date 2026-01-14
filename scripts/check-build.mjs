import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import readline from 'readline';

const OUTPUT_DIR = 'out';
const APPROVED_URLS_FILE = '.approved-urls.json';

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Promisify readline question
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
  console.log(chalk.yellow.bold('\n🔍 New URLs found that need approval:'));
  // Sort URLs alphabetically
  const sortedUrls = [...urls].sort();
  sortedUrls.forEach((url, index) => {
    const files = Array.from(urlLocations.get(url));
    console.log(`\n   ${chalk.gray(`${index + 1}.`)} ${chalk.bold(url)}`);
    files.forEach(file => console.log(`      ${chalk.gray(file)}`));
  });

  const answer = await question(chalk.yellow('\nWould you like to approve all these URLs? (y/n): '));
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
const CONTEXT_CHARS = 150; // Number of characters to show before and after match

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Store all findings
const findings = [];
// Store all URLs with their locations
const urlLocations = new Map(); // url -> Set<string> (filenames)

// Only match explicit http/https URLs
const URL_PATTERN = /https?:\/\/[^\s"'<>()]+/gi;

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

function extractUrls(content, filePath) {
  let match;
  while ((match = URL_PATTERN.exec(content)) !== null) {
    const url = match[0];
    if (!urlLocations.has(url)) {
      urlLocations.set(url, new Set());
    }
    urlLocations.get(url).add(filePath);
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

function checkForbiddenStrings(content, filePath) {
  const fileFindings = [];

  for (const forbiddenString of FORBIDDEN_STRINGS) {
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

  // Extract URLs if needed
  extractUrls(content, filePath);
}

function isTargetFile(file) {
  return file.endsWith('.html') || file.endsWith('.js');
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
    console.error(chalk.red(`⚠️  Output directory '${chalk.bold(outputDir)}' does not exist. Run buildstatic first. (This scripts attempts to run on every build so that it is in the correct place before indexing. So if you don't need a static build right now, that's okay.)`));
    process.exit(0);
  }

  console.log(chalk.blue(`Scanning ${chalk.bold(outputDir)} for forbidden strings and URLs...`));
  await scanDirectory(outputDir);

  // Check for new URLs and ask for approval
  const newUrls = Array.from(urlLocations.keys()).filter(url => !approvedUrls.has(url));

  if (newUrls.length > 0) {
    const areApproved = await approveUrls(newUrls);

    if (areApproved) {
      newUrls.forEach(url => approvedUrls.add(url));
      console.log(chalk.green(`✅ Added ${newUrls.length} URLs to approved list (total: ${approvedUrls.size})`));
    } else {
      newUrls.forEach(url => {
        console.log(chalk.red(`❌ URL rejected: ${url}`));
        findings.push({
          file: Array.from(urlLocations.get(url))[0],
          string: url,
          context: 'URL not approved'
        });
      });
    }

    // Save updated approved URLs
    saveApprovedUrls(approvedUrls);
  } else {
    console.log(chalk.blue(`ℹ️  All ${approvedUrls.size} URLs already approved`));
  }

  // Print replacement stats
  console.log('\n' + chalk.blue.bold('🔄 Replacement Statistics:'));
  if (replacementStats.size > 0) {
    REPLACEMENTS.forEach(({ pattern, replacement }) => {
      const count = replacementStats.get(pattern.toString()) || 0;
      if (count > 0) {
        console.log(`   ${chalk.gray('•')} Replaced ${chalk.bold(count)} occurrences of ${chalk.yellow(pattern)} with ${chalk.green(replacement)}`);
      }
    });
  } else {
    console.log(chalk.yellow('   No replacements made'));
  }

  if (findings.length > 0) {
    console.error(chalk.red.bold('❌ Found forbidden strings:'));

    // Group findings by file
    const groupedFindings = findings.reduce((acc, finding) => {
      if (!acc[finding.file]) {
        acc[finding.file] = [];
      }
      acc[finding.file].push(finding);
      return acc;
    }, {});

    // Output grouped findings
    Object.entries(groupedFindings).forEach(([file, fileFindings], fileIndex) => {
      console.error(`\n${chalk.yellow.bold(`File ${fileIndex + 1}:`)} ${chalk.yellow(file)}`);
      fileFindings.forEach((finding, index) => {
        console.error(`   ${chalk.red(`${index + 1}. Found "${chalk.bold(finding.string)}"`)}`)
        console.error(`      ${chalk.gray('Context:')} ${finding.context}`);
      });
    });
  } else {
    console.log(chalk.green.bold('✅ No forbidden strings found'));
  }

  rl.close();
  process.exit(findings.length > 0 ? 1 : 0);
} catch (error) {
  console.error(chalk.red.bold('❌ Error:'), chalk.red(error.message));
  rl.close();
  process.exit(1);
}
