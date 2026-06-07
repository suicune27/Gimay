/**
 * Pass 6: Final targeted pass for all remaining mappable patterns.
 * Handles text-[#050506], from-[#121216], text-[#2B3A30], etc.
 *
 * Run: node scripts/replace-hex-colors-pass6.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, extname } from 'path';

const SRC_DIR = 'src';
const EXT = ['.tsx', '.ts'];

function walkDir(dir) {
  const files = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules')
      files.push(...walkDir(fullPath));
    else if (entry.isFile() && EXT.includes(extname(entry.name)))
      files.push(fullPath);
  }
  return files;
}

const REPLACEMENTS = [
  // text-[#050506] on brand buttons / icon fills
  [/text-\[#050506\]/g, 'text-[var(--bg-deep)]'],
  [/border-\[#050506\]/g, 'border-[var(--bg-deep)]'],
  [/border-t-\[#050506\]/g, 'border-t-[var(--bg-deep)]'],

  // text-[#050505] on brand buttons
  [/text-\[#050505\]/g, 'text-[var(--bg-deep)]'],
  [/border-\[#050505\]/g, 'border-[var(--bg-deep)]'],
  [/border-t-\[#050505\]/g, 'border-t-[var(--bg-deep)]'],

  // from-[#121216] via-[#121216] gradient stops
  [/from-\[#121216\]/g, 'from-[var(--bg-elevated)]'],
  [/via-\[#121216\]/g, 'via-[var(--bg-elevated)]'],

  // border-t-[#1a1a1a] — top border
  [/border-t-\[#1a1a1a\]/g, 'border-t-[var(--bg-elevated)]'],

  // from-[#1A1A1A] — gradient start
  [/from-\[#1A1A1A\]/g, 'from-[var(--bg-elevated)]'],

  // text-[#141414] — icon fill color
  [/text-\[#141414\]/g, 'text-[var(--bg-elevated)]'],

  // text-[#2B3A30] — "Empty String" placeholder
  [/text-\[#2B3A30\]/g, 'text-dim'],

  // text-[#fff]/60 → text-white/60 (handled by .light override)
  [/text-\[#fff\]\/60/g, 'text-white/60'],

  // border-[#111] → border-subtle
  [/border-\[#111\]/g, 'border-[var(--bg-input)]'],
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
  }
}

console.log(`✅ Pass 6 complete: ${changedCount} files modified.`);
