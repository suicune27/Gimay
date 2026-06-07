/**
 * Fix orphaned opacity suffixes from the hex color replacement.
 * Converts bg-X/YY to bg-[var(--bg-X)]/YY (Tailwind v4 compatible).
 * Run: node scripts/fix-opacity-suffixes.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, extname } from 'path';

const SRC_DIR = 'src';
const EXT = ['.tsx', '.ts'];

const BG_CLASSES = [
  'deep', 'surface', 'elevated', 'code', 'tab', 'input',
  'card', 'header', 'sidebar', 'hover-bg', 'glass-bg'
];

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

let total = 0;
for (const cls of BG_CLASSES) {
  // Build regex to match bg-X/YY where YY is digits
  const regex = new RegExp(`bg-${cls}/(\\d+)`, 'g');
  const replacement = `bg-[var(--bg-${cls})]/$1`;
  
  const files = walkDir(SRC_DIR).filter(f => !f.includes('node_modules'));
  for (const file of files) {
    let content = readFileSync(file, 'utf-8');
    const before = content;
    content = content.replace(regex, replacement);
    if (content !== before) {
      writeFileSync(file, content, 'utf-8');
      const count = (before.match(regex) || []).length;
      total += count;
    }
  }
}
console.log(`Fixed ${total} orphaned opacity suffix(es).`);
