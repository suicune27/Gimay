#!/usr/bin/env node
/**
 * Lint: Check for hardcoded hex colors in component files.
 * 
 * Scans all .tsx and .ts files in src/ for patterns like:
 *   bg-[#XXXXXX], text-[#XXXXXX], border-[#XXXXXX], etc.
 * 
 * Excludes brand colors, semantic Tailwind colors, comments, and PrismJS styles.
 *
 * Usage: node scripts/lint-hex-colors.mjs
 */

import { readFileSync, readdirSync } from 'fs';
import { join, extname } from 'path';

const SRC_DIR = 'src';
const EXTENSIONS = ['.tsx', '.ts'];
const IGNORE_DIRS = new Set(['node_modules', 'themes', '.git']);

// Allowed hex patterns in full line context
const ALLOWED_LINE_PATTERNS = [
  /text-\[#3ECF8E\]/, /text-\[#EF4444\]/, /text-\[#10B981\]/, /text-\[#3B82F6\]/,
  /bg-\[#3ECF8E\]/,   /bg-\[#EF4444\]/,   /bg-\[#10B981\]/,   /bg-\[#3B82F6\]/,
  /border-\[#3ECF8E\]/, /border-\[#EF4444\]/, /border-\[#10B981\]/, /border-\[#3B82F6\]/,
  /shadow-\[/,           /drop-shadow-\[/,
  /hover:bg-\[/,       /focus:bg-\[/,
  /selection:bg-\[/,   /disabled:bg-\[/,
  /bg-\[#F59E0B\]/,   /text-\[#F59E0B\]/, /border-\[#F59E0B\]/, /from-\[#F59E0B\]/, /via-\[#F59E0B\]/,
  /#2563EB/,           /#EF4444/,            /#10B981/,            /#3B82F6/,
  /bg-amber-/, /text-amber-/, /border-amber-/,
  /shadow-\[0_0_\d+px_#3ECF8E\]/,
];

// Allowed semantic color name prefixes
const ALLOWED_SEMANTIC = [
  'amber', 'emerald', 'red', 'blue', 'purple', 'green',
  'yellow', 'indigo', 'violet', 'pink', 'rose', 'teal',
  'cyan', 'sky', 'orange', 'lime', 'fuchsia',
  'slate', 'zinc', 'gray', 'neutral', 'stone',
  'white', 'black',
];

function isAllowed(fullLine) {
  for (const p of ALLOWED_LINE_PATTERNS) {
    if (p.test(fullLine)) return true;
  }
  for (const c of ALLOWED_SEMANTIC) {
    if (fullLine.includes(`-${c}-`)) return true;
  }
  if (fullLine.trim().startsWith('//') || fullLine.trim().startsWith('*')) return true;
  if (fullLine.includes('--') && fullLine.includes(':')) return true;
  if (fullLine.includes('.token') || fullLine.includes('prism')) return true;
  return false;
}

function walkDir(dir) {
  const files = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && !IGNORE_DIRS.has(entry.name))
      files.push(...walkDir(fullPath));
    else if (entry.isFile() && EXTENSIONS.includes(extname(entry.name)))
      files.push(fullPath);
  }
  return files;
}

let errors = 0;
for (const file of walkDir(SRC_DIR)) {
  const lines = readFileSync(file, 'utf-8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Match both 6-char and 3-char hex codes inside brackets
    const hexMatches = line.match(/\[#[0-9A-Fa-f]{6}\]|\[#[0-9A-Fa-f]{3}\](?!\w)/g);
    if (!hexMatches) continue;
    for (const match of hexMatches) {
      if (!isAllowed(line)) {
        const rel = file.replace(/\\/g, '/');
        console.log(`  ${rel}:${i + 1}  ${match}  ${line.slice(0, 120)}`);
        errors++;
      }
    }
  }
}

if (errors > 0) {
  console.log(`\n❌ Found ${errors} hardcoded hex color(s). Replace with CSS variable classes.`);
  process.exit(1);
} else {
  console.log('✅ No hardcoded hex colors found in component files.');
}
