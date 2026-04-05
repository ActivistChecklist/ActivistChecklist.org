#!/usr/bin/env node

/**
 * crowdin-hide-untranslatable.mjs
 *
 * Extracts JSX attribute values and frontmatter fields from MDX source files
 * that should NOT be translated, then hides matching strings in Crowdin.
 *
 * This includes:
 *   - JSX attributes: slug, type, size, level, mode, alignment, target, variant, icon, href, src, className
 *   - Frontmatter arrays: relatedGuides, titleBadges
 *   - Frontmatter scalars: slug, type, date, firstPublished, lastUpdated, estimatedTime, image, imageOverride, url, source, tags
 *
 * Usage:
 *   CROWDIN_PERSONAL_TOKEN=xxx CROWDIN_PROJECT_ID=123 node crowdin-hide-slugs.mjs
 *   CROWDIN_PERSONAL_TOKEN=xxx CROWDIN_PROJECT_ID=123 node crowdin-hide-slugs.mjs --apply
 *
 * Add to package.json:
 *   "scripts": {
 *     "crowdin:hide-strings": "node scripts/crowdin-hide-slugs.mjs",
 *     "crowdin:hide-strings:apply": "node scripts/crowdin-hide-slugs.mjs --apply",
 *     "crowdin:upload": "crowdin upload sources && node scripts/crowdin-hide-slugs.mjs --apply"
 *   }
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname, basename } from "path";

// --- Colors ---
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
  white: "\x1b[97m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
};

// --- Config ---
const TOKEN = process.env.CROWDIN_PERSONAL_TOKEN;
const PROJECT_ID = process.env.CROWDIN_PROJECT_ID;
const CONTENT_DIR = "./content/en"; // adjust if your source dir is different
const DRY_RUN = !process.argv.includes("--apply");
const BASE_URL = "https://api.crowdin.com/api/v2";

if (!TOKEN || !PROJECT_ID) {
  console.error(`
${c.red}${c.bold}Error:${c.reset} Missing environment variables.

Set these before running:
  ${c.cyan}CROWDIN_PERSONAL_TOKEN${c.reset}  ${c.gray}← https://crowdin.com/settings#api-key${c.reset}
  ${c.cyan}CROWDIN_PROJECT_ID${c.reset}      ${c.gray}← Project Settings > API${c.reset}

Example:
  ${c.dim}CROWDIN_PERSONAL_TOKEN=xxx CROWDIN_PROJECT_ID=123 node scripts/crowdin-hide-slugs.mjs${c.reset}
`);
  process.exit(1);
}

// --- Step 1: Extract untranslatable values from MDX files ---

// Frontmatter scalar fields whose values should not be translated
const UNTRANSLATABLE_FRONTMATTER_SCALARS = [
  "slug",           // URL identifiers
  "type",           // enum: major, minor, info, etc.
  "date",           // ISO dates
  "firstPublished", // ISO dates
  "lastUpdated",    // ISO dates
  "estimatedTime",  // durations: "30 minutes", "1 hour"
  "image",          // file paths
  "imageOverride",  // file paths
  "url",            // external URLs
  "source",         // publication/author attribution
  "tags",           // comma-separated tag identifiers
];

// JSX attributes whose values should not be translated
const UNTRANSLATABLE_ATTRIBUTES = [
  "slug", // ChecklistItem, Section - references to other content
  "type", // Alert - info, warning, success, default, error
  "size", // Button, ImageEmbed - xs, sm, md, lg, xl
  "level", // RiskLevel - everyone, medium, high
  "mode", // RiskLevel - single_line, for_you, for_you_if
  "alignment", // ImageEmbed, Button - left, center, right
  "target", // links - _self, _blank
  "variant", // Button - outline, solid, etc.
  "icon", // Button - icon names like IoCloudDownloadOutline
  "href", // URLs and internal paths
  "src", // image/video source paths
  "className", // CSS class names
];

function walkDir(dir) {
  let files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files = files.concat(walkDir(full));
    } else if (extname(full) === ".mdx" || extname(full) === ".md") {
      files.push(full);
    }
  }
  return files;
}

function extractUntranslatableStrings(contentDir) {
  const strings = new Map(); // value -> Set of sources (for debugging)
  const files = walkDir(contentDir);

  // Build regex for all untranslatable attributes
  // Match attr="value" and attr='value' in JSX/HTML attributes
  const attrPattern = UNTRANSLATABLE_ATTRIBUTES.join("|");
  const attrRegex = new RegExp(`\\b(${attrPattern})=["']([^"']+)["']`, "g");

  // Frontmatter array patterns (relatedGuides, titleBadges, etc.)
  const frontmatterArrayRegex = /^(relatedGuides|titleBadges):\s*\n((?:\s+-\s+.+\n?)+)/gm;
  const arrayItemRegex = /^\s+-\s+(.+)$/gm;

  const scalarFieldPattern = UNTRANSLATABLE_FRONTMATTER_SCALARS.join("|");
  const frontmatterScalarRegex = new RegExp(`^(${scalarFieldPattern}):\\s*["']?(.+?)["']?\\s*$`, "gm");

  for (const file of files) {
    const content = readFileSync(file, "utf-8");
    const fileName = basename(file, extname(file));

    // Extract JSX attribute values
    attrRegex.lastIndex = 0;
    let match;
    while ((match = attrRegex.exec(content)) !== null) {
      const attrName = match[1];
      const value = match[2];
      if (!strings.has(value)) {
        strings.set(value, new Set());
      }
      strings.get(value).add(JSON.stringify({ attr: attrName, file: fileName }));
    }

    // Extract frontmatter scalar values
    frontmatterScalarRegex.lastIndex = 0;
    let scalarMatch;
    while ((scalarMatch = frontmatterScalarRegex.exec(content)) !== null) {
      const fieldName = scalarMatch[1];
      const value = scalarMatch[2].trim();
      if (value && !value.startsWith("#")) {
        if (!strings.has(value)) {
          strings.set(value, new Set());
        }
        strings.get(value).add(JSON.stringify({ attr: fieldName, file: fileName }));
      }
    }

    // Extract frontmatter array values
    frontmatterArrayRegex.lastIndex = 0;
    let fmMatch;
    while ((fmMatch = frontmatterArrayRegex.exec(content)) !== null) {
      const fieldName = fmMatch[1];
      const arrayContent = fmMatch[2];
      arrayItemRegex.lastIndex = 0;
      let itemMatch;
      while ((itemMatch = arrayItemRegex.exec(arrayContent)) !== null) {
        const value = itemMatch[1].trim();
        if (value && !value.startsWith("#")) {
          if (!strings.has(value)) {
            strings.set(value, new Set());
          }
          strings.get(value).add(JSON.stringify({ attr: fieldName, file: fileName }));
        }
      }
    }
  }

  return strings;
}

// --- Step 2: Crowdin API helpers ---

async function crowdinGet(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Crowdin API error ${res.status}: ${body}`);
  }
  return res.json();
}

async function crowdinPatch(path, data) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Crowdin API error ${res.status}: ${body}`);
  }
  return res.json();
}

// --- Step 3: Find and hide slug strings in Crowdin ---

async function getAllStrings() {
  const strings = [];
  let offset = 0;
  const limit = 500;

  while (true) {
    const data = await crowdinGet(
      `/projects/${PROJECT_ID}/strings?limit=${limit}&offset=${offset}`
    );
    strings.push(...data.data);
    if (data.data.length < limit) break;
    offset += limit;
  }

  return strings;
}

// Helper to format source info from the stringsMap
function formatSource(sourcesSet) {
  const sources = [...sourcesSet].map((s) => JSON.parse(s));
  // Group by attribute
  const byAttr = {};
  for (const { attr, file } of sources) {
    if (!byAttr[attr]) byAttr[attr] = [];
    byAttr[attr].push(file);
  }

  const parts = [];
  for (const [attr, files] of Object.entries(byAttr)) {
    const uniqueFiles = [...new Set(files)];
    if (uniqueFiles.length <= 2) {
      parts.push(`${attr} in ${uniqueFiles.join(", ")}`);
    } else {
      parts.push(`${attr} in ${uniqueFiles.slice(0, 2).join(", ")} +${uniqueFiles.length - 2}`);
    }
  }
  return parts.join(" | ");
}

async function run() {
  console.log(`\n${c.bold}${c.cyan}=== Crowdin Untranslatable String Hider ===${c.reset}\n`);

  // Extract untranslatable strings from source
  console.log(`${c.blue}Scanning${c.reset} ${c.white}${CONTENT_DIR}${c.reset} for untranslatable attribute values...`);
  console.log(`${c.gray}JSX attributes: ${UNTRANSLATABLE_ATTRIBUTES.join(", ")}${c.reset}`);
  console.log(`${c.gray}Frontmatter scalars: ${UNTRANSLATABLE_FRONTMATTER_SCALARS.join(", ")}${c.reset}\n`);

  const stringsMap = extractUntranslatableStrings(CONTENT_DIR);
  const untranslatableValues = new Set(stringsMap.keys());

  console.log(`${c.green}Found${c.reset} ${c.bold}${untranslatableValues.size}${c.reset} unique untranslatable values.\n`);

  // Show a sample of what was found (grouped by type for clarity)
  if (process.argv.includes("--verbose")) {
    console.log(`${c.bold}Extracted values:${c.reset}`);
    let count = 0;
    for (const [value, sources] of stringsMap) {
      if (count++ < 50) {
        const sourceInfo = formatSource(sources);
        console.log(`  ${c.yellow}"${value}"${c.reset} ${c.gray}← ${sourceInfo}${c.reset}`);
      }
    }
    if (stringsMap.size > 50) {
      console.log(`  ${c.gray}... and ${stringsMap.size - 50} more${c.reset}\n`);
    } else {
      console.log();
    }
  }

  // Fetch all strings from Crowdin
  console.log(`${c.blue}Fetching${c.reset} strings from Crowdin project ${c.white}${PROJECT_ID}${c.reset}...`);
  const allStrings = await getAllStrings();
  console.log(`${c.green}Found${c.reset} ${c.bold}${allStrings.length}${c.reset} total strings in project.\n`);

  // Find matches
  const toHide = [];
  const alreadyHidden = [];

  for (const item of allStrings) {
    const { id, text, isHidden } = item.data;
    if (untranslatableValues.has(text)) {
      if (isHidden) {
        alreadyHidden.push({ id, text });
      } else {
        toHide.push({ id, text });
      }
    }
  }

  const totalFound = toHide.length + alreadyHidden.length;
  const notInCrowdin = untranslatableValues.size - totalFound;

  console.log(`${c.bold}Summary:${c.reset}`);
  console.log(`  ${c.gray}Matched in Crowdin:${c.reset}  ${c.bold}${totalFound}${c.reset}`);
  console.log(`  ${c.gray}Already hidden:${c.reset}      ${c.green}${alreadyHidden.length}${c.reset}`);
  console.log(`  ${c.gray}Need to hide:${c.reset}        ${toHide.length > 0 ? c.yellow : c.green}${toHide.length}${c.reset}`);
  console.log(`  ${c.gray}Not in Crowdin:${c.reset}      ${c.dim}${notInCrowdin}${c.reset}\n`);

  if (toHide.length === 0) {
    console.log(`${c.green}${c.bold}✓ Nothing to do!${c.reset}\n`);
    return;
  }

  // List what we'll hide
  console.log(`${c.bold}${DRY_RUN ? "Would hide" : "Hiding"} ${toHide.length} strings:${c.reset}\n`);

  for (const { id, text } of toHide) {
    const sourceInfo = stringsMap.has(text) ? formatSource(stringsMap.get(text)) : "";

    if (DRY_RUN) {
      console.log(`  ${c.yellow}○${c.reset} ${c.white}"${text}"${c.reset} ${c.gray}← ${sourceInfo}${c.reset}`);
    } else {
      try {
        await crowdinPatch(`/projects/${PROJECT_ID}/strings/${id}`, [
          { op: "replace", path: "/isHidden", value: true },
        ]);
        console.log(`  ${c.green}✓${c.reset} ${c.white}"${text}"${c.reset} ${c.gray}← ${sourceInfo}${c.reset}`);
      } catch (err) {
        console.log(`  ${c.red}✗${c.reset} ${c.white}"${text}"${c.reset} ${c.red}— ${err.message}${c.reset}`);
      }

      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  console.log();
  if (DRY_RUN) {
    console.log(`${c.yellow}${c.bold}Dry run complete.${c.reset} Run with ${c.cyan}--apply${c.reset} to hide the strings.\n`);
  } else {
    console.log(`${c.green}${c.bold}✓ Done!${c.reset} Hidden ${c.bold}${toHide.length}${c.reset} untranslatable strings.\n`);
  }
}

run().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
