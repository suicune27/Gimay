/**
 * Pass 4: Convert remaining mappable hex colors missed by passes 1-3.
 * Handles patterns like border-[#1C1C22], bg-[#121216], etc.
 * 
 * Run: node scripts/replace-hex-colors-pass4.mjs
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
  // border- patterns for code backgrounds (missed in earlier passes)
  [/border-\[#1C1C22\]/g, 'border-[var(--bg-code)]'],
  [/border-\[#1C1C25\]/g, 'border-[var(--bg-code)]'],
  [/border-\[#1C1C24\]/g, 'border-[var(--bg-code)]'],

  // border- patterns for subtle borders (missed)
  [/border-\[#1D1D22\]/g, 'border-subtle'],
  [/border-\[#15151E\]/g, 'border-subtle'],
  [/border-\[#121216\]/g, 'border-subtle'],

  // hover:border patterns
  [/hover:border-\[#1C1C22\]/g, 'hover:border-[var(--bg-code)]'],
  [/hover:border-\[#1C1C25\]/g, 'hover:border-[var(--bg-code)]'],
  [/hover:border-\[#222222\]/g, 'hover:border-subtle'],
  [/hover:border-\[#333333\]/g, 'hover:border-strong'],

  // focus:border patterns
  [/focus:border-\[#1C1C22\]/g, 'focus:border-[var(--bg-code)]'],

  // Remaining bg patterns (various depths)
  [/bg-\[#1E1E28\]/g, 'bg-elevated'],
  [/bg-\[#181818\]/g, 'bg-elevated'],
  [/bg-\[#121216\]/g, 'bg-elevated'],
  [/bg-\[#121217\]/g, 'bg-elevated'],
  [/bg-\[#121212\]/g, 'bg-elevated'],
  [/bg-\[#14141A\]/g, 'bg-elevated'],
  [/bg-\[#15151E\]/g, 'bg-elevated'],
  [/bg-\[#080809\]/g, 'bg-deep'],
  [/bg-\[#070707\]/g, 'bg-deep'],
  [/bg-\[#050505\]/g, 'bg-deep'],
  [/bg-\[#050506\]/g, 'bg-deep'],
  [/bg-\[#0A0A0A\]/g, 'bg-deep'],
  [/bg-\[#0C0C0C\]/g, 'bg-surface'],
  [/bg-\[#0D0D0E\]/g, 'bg-surface'],
  [/bg-\[#0E0E12\]/g, 'bg-surface'],
  [/bg-\[#141414\]/g, 'bg-elevated'],
  [/bg-\[#1A1A1A\]/g, 'bg-elevated'],
  [/bg-\[#1a1a1a\]/g, 'bg-elevated'],
  [/bg-\[#000000\]/g, 'bg-deep'],
  [/bg-\[#111\]/g, 'bg-input'],
  [/bg-\[#000\]/g, 'bg-deep'],

  // Remaining text patterns
  [/text-\[#333333\]/g, 'text-dim'],
  [/text-\[#222\]/g, 'text-dim'],
  [/text-\[#A5A5AF\]/g, 'text-muted'],
  [/text-\[#A0A0AA\]/g, 'text-muted'],
  [/text-\[#9999A1\]/g, 'text-muted'],
  [/text-\[#88889F\]/g, 'text-muted'],
  [/text-\[#70707A\]/g, 'text-dim'],

  // Remaining border patterns
  [/border-\[#151518\]/g, 'border-sidebar'],
  [/border-\[#222\]/g, 'border-subtle'],
  [/border-\[#333333\]/g, 'border-strong'],
  [/border-\[#1A1A1A\]/g, 'border-subtle'],
  [/border-\[#1A1A22\]/g, 'border-subtle'],

  // Focus bg patterns
  [/focus:bg-\[#070707\]/g, 'focus:bg-surface'],

  // hover:bg patterns
  [/hover:bg-\[#333333\]/g, 'hover:bg-strong'],
  [/hover:bg-\[#222222\]/g, 'hover:bg-elevated'],
  [/hover:bg-\[#050505\]/g, 'hover:bg-deep'],
  [/hover:bg-\[#151515\]/g, 'hover:bg-elevated'],

  // from-/via-/to- gradient patterns
  [/from-\[#1C1C22\]/g, 'from-[var(--bg-code)]'],
  [/from-\[#1C1C25\]/g, 'from-[var(--bg-code)]'],
  [/via-\[#1C1C22\]/g, 'via-[var(--bg-code)]'],
  [/via-\[#1C1C25\]/g, 'via-[var(--bg-code)]'],
  [/to-\[#1C1C22\]/g, 'to-[var(--bg-code)]'],
  [/to-\[#1C1C25\]/g, 'to-[var(--bg-code)]'],
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

console.log(`✅ Pass 4 complete: ${changedCount} files modified.`);
