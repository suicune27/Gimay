/**
 * Replace hardcoded brand blue (#2563EB / rgba(37,99,235))
 * with var(--brand) / rgba(var(--brand-rgb),...) so the brand color
 * switches between green (dark) and blue (light).
 *
 * Run: node scripts/replace-brand-var.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, extname } from 'path';

const SRC_DIR = 'src';
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
  // Hex brand color patterns — all in className strings
  [/text-\[#2563EB\]/g, 'text-[var(--brand)]'],
  [/bg-\[#2563EB\]/g, 'bg-[var(--brand)]'],
  [/border-\[#2563EB\]/g, 'border-[var(--brand)]'],
  [/border-l-\[#2563EB\]/g, 'border-l-[var(--brand)]'],
  [/border-t-\[#2563EB\]/g, 'border-t-[var(--brand)]'],
  [/from-\[#2563EB\]/g, 'from-[var(--brand)]'],
  [/via-\[#2563EB\]/g, 'via-[var(--brand)]'],

  // Compact rgba (no spaces after commas)
  [/rgba\(37,99,235,/g, 'rgba(var(--brand-rgb),'],

  // Sparse rgba (spaces after commas)
  [/rgba\(37,\s*99,\s*235,/g, 'rgba(var(--brand-rgb),'],

  // Shadow glow patterns with hex
  [/shadow-\[0_0_6px_#2563EB\]/g, 'shadow-[0_0_6px_var(--brand)]'],
  [/shadow-\[0_0_8px_#2563EB\]/g, 'shadow-[0_0_8px_var(--brand)]'],
  [/shadow-\[0_0_5px_#2563EB\]/g, 'shadow-[0_0_5px_var(--brand)]'],

  // Inline style brand colors (used in SVG or style attributes)
  [/: '#2563EB'/g, ": 'var(--brand)'"],
  [/: \"#2563EB\"/g, ': "var(--brand)"'],
  [/color: #2563EB/gi, 'color: var(--brand)'],
];

// Also handle lowercase versions
REPLACEMENTS.push(
  [/#2563eb/g, '#2563EB'.replace('#2563EB', 'var(--brand)')] // already covered by uppercase
);

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

console.log(`\n✅ Brand variable replacement complete: ${changedCount} files modified.`);
