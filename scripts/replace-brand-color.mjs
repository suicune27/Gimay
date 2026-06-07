/**
 * Replace brand accent color from green (#3ECF8E) to blue (#2563EB).
 * Handles hex, lowercase hex, and rgba patterns.
 *
 * Run: node scripts/replace-brand-color.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, extname } from 'path';

const SRC_DIR = 'src';
const THEMES_DIR = 'src/themes';
const EXT = ['.tsx', '.ts', '.css'];

function walkDir(dir) {
  const files = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules')
        files.push(...walkDir(fullPath));
      else if (entry.isFile() && EXT.includes(extname(entry.name)))
        files.push(fullPath);
    }
  } catch {}
  return files;
}

const REPLACEMENTS = [
  // Exact brand hex — uppercase and lowercase variations
  [/#3ECF8E/g, '#2563EB'],
  [/#3ecf8e/g, '#2563eb'],

  // rgba patterns — 3ECF8E = rgb(62, 207, 142)
  // 2563EB = rgb(37, 99, 235)
  [/rgba\(62,\s*207,\s*142,/g, 'rgba(37, 99, 235,'],
  [/rgb\(62,\s*207,\s*142\)/g, 'rgb(37, 99, 235)'],
];

let changedCount = 0;
const files = walkDir(SRC_DIR);

for (const file of files) {
  let content = readFileSync(file, 'utf-8');
  const original = content;
  for (const [regex, replacement] of REPLACEMENTS) {
    content = content.replace(regex, replacement);
  }
  if (content !== original) {
    writeFileSync(file, content, 'utf-8');
    changedCount++;
    console.log(`  ✏️  ${file.replace(/\\/g, '/')}`);
  }
}

console.log(`\n✅ Brand color replacement complete: ${changedCount} files modified.`);
