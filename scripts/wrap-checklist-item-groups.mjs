#!/usr/bin/env node
/**
 * One-time (or re-runnable) transform: wrap consecutive self-closing
 * <ChecklistItem slug="..." /> lines (outside existing <ChecklistItemGroup>) in
 * <ChecklistItemGroup>...</ChecklistItemGroup> when there are 2+ in a row.
 *
 * Usage: node scripts/wrap-checklist-item-groups.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GUIDES_DIR = path.join(__dirname, '../content/en/guides');

const CHECKLIST_ITEM_LINE = /^\s*<ChecklistItem\s[^>]+\/>\s*$/;

function isChecklistItemLine(line) {
  return CHECKLIST_ITEM_LINE.test(line);
}

function transformContent(content) {
  const lines = content.split('\n');
  const out = [];
  let i = 0;
  let groupDepth = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('<ChecklistItemGroup')) {
      groupDepth += 1;
      out.push(line);
      i += 1;
      continue;
    }
    if (trimmed === '</ChecklistItemGroup>') {
      groupDepth = Math.max(0, groupDepth - 1);
      out.push(line);
      i += 1;
      continue;
    }

    if (groupDepth > 0) {
      out.push(line);
      i += 1;
      continue;
    }

    if (isChecklistItemLine(line)) {
      const run = [];
      while (i < lines.length && isChecklistItemLine(lines[i])) {
        run.push(lines[i]);
        i += 1;
      }
      if (run.length >= 2) {
        const indentMatch = run[0].match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1] : '';
        out.push(`${indent}<ChecklistItemGroup>`);
        for (const rl of run) {
          out.push(`${indent}  ${rl.trim()}`);
        }
        out.push(`${indent}</ChecklistItemGroup>`);
      } else {
        out.push(...run);
      }
      continue;
    }

    out.push(line);
    i += 1;
  }

  return out.join('\n');
}

function main() {
  const names = fs.readdirSync(GUIDES_DIR).filter((f) => f.endsWith('.mdx'));
  let changedFiles = 0;
  for (const name of names) {
    const filePath = path.join(GUIDES_DIR, name);
    const before = fs.readFileSync(filePath, 'utf8');
    const after = transformContent(before);
    if (after !== before) {
      fs.writeFileSync(filePath, after, 'utf8');
      console.log('updated', name);
      changedFiles += 1;
    }
  }
  console.log(`Done. ${changedFiles} file(s) modified.`);
}

main();
