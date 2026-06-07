/**
 * Third pass: fix remaining hex color patterns missed by passes 1 and 2.
 * Handles additional prefix patterns like divide-, ring-, etc.
 * 
 * Run: node scripts/replace-hex-colors-pass3.mjs
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
  // divide- patterns (need var() because @theme has --color-border-subtle, not --color-subtle)
  [/divide-\[#222222\]/g, 'divide-[var(--border-subtle)]'],

  // Missing bg- patterns
  [/bg-\[#222222\]/g, 'bg-elevated'],
  [/bg-\[#030305\]/g, 'bg-deep'],
  [/bg-\[#181818\]/g, 'bg-elevated'],
  [/bg-\[#0D0D0D\]/g, 'bg-surface'],
  [/bg-\[#101015\]/g, 'bg-surface'],
  [/bg-\[#09090D\]/g, 'bg-deep'],
  [/bg-\[#121216\]/g, 'bg-elevated'],
  [/bg-\[#15151E\]/g, 'bg-elevated'],
  [/bg-\[#1E1E28\]/g, 'bg-elevated'],

  // Missing text- patterns
  [/text-\[#222222\]/g, 'text-dim'],
  [/text-\[#A0A0A9\]/g, 'text-muted'],
  [/text-\[#888894\]/g, 'text-muted'],
  [/text-\[#66666D\]/g, 'text-dim'],
  [/text-\[#77777F\]/g, 'text-muted'],
  [/text-\[#333338\]/g, 'text-dim'],
  [/text-\[#E1E1E6\]/g, 'text-main'],

  // Missing border- patterns
  [/border-\[#2D2D39\]/g, 'border-subtle'],
  [/border-\[#333338\]/g, 'border-strong'],

  // Hover border patterns
  [/hover:border-\[#1C1C22\]/g, 'hover:border-code'],
  [/hover:border-\[#1C1C25\]/g, 'hover:border-code'],
  [/hover:border-\[#222222\]/g, 'hover:border-subtle'],

  // Focus border
  [/focus:border-\[#1C1C22\]/g, 'focus:border-code'],

  // Misc
  [/from-\[#1C1C22\]/g, 'from-[var(--bg-code)]'],
  [/via-\[#1C1C22\]/g, 'via-[var(--bg-code)]'],
  [/to-\[#1C1C22\]/g, 'to-[var(--bg-code)]'],
  [/accent-\[#3ECF8E\]/g, 'accent-[var(--brand)]'],
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

console.log(`✅ Pass 3 complete: ${changedCount} files modified.`);
