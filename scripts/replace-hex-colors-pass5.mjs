/**
 * Pass 5: Final targeted pass for remaining mappable hex colors.
 * Converts patterns to CSS variable references so .light mode works automatically.
 *
 * Run: node scripts/replace-hex-colors-pass5.mjs
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
  // ---- SmokeTestPanel: border-[#1E1E28] -> border-[var(--bg-code)] ----
  // #1E1E28 is close to --bg-code (#1C1C22)
  [/border-\[#1E1E28\]/g, 'border-[var(--bg-code)]'],

  // ---- Sidebar: icon fills text-[#1D1D22] -> text-[var(--border-subtle)] ----
  // #1D1D22 is close to --border-subtle (#222222)
  [/text-\[#1D1D22\]/g, 'text-[var(--border-subtle)]'],
  [/bg-\[#1D1D22\]/g, 'bg-[var(--border-subtle)]'],

  // ---- HeaderEditor: border-[#181818] -> border-[var(--bg-elevated)] ----
  // #181818 is close to --bg-elevated (#1A1A1A)
  [/border-\[#181818\]/g, 'border-[var(--bg-elevated)]'],

  // ---- SmokeSuitePanel: bg-[#101012] -> bg-elevated ----
  [/bg-\[#101012\]/g, 'bg-elevated'],
  [/bg-\[#0A0A10\]/g, 'bg-deep'],

  // ---- Sidebar: bg-[#121216] -> bg-elevated ----
  [/bg-\[#121216\]/g, 'bg-elevated'],
  [/bg-\[#121217\]/g, 'bg-elevated'],

  // ---- Various: remaining bg depth mappings ----
  [/bg-\[#141414\]/g, 'bg-elevated'],
  [/bg-\[#050505\]/g, 'bg-deep'],
  [/bg-\[#050506\]/g, 'bg-deep'],
  [/bg-\[#111\]/g, 'bg-input'],

  // ---- ScriptLibraryModal: icon fill text-[#151518] -> text-[var(--border-subtle)] ----
  [/text-\[#151518\]/g, 'text-[var(--border-subtle)]'],

  // ---- B9BAC4 gray text -> use var so .light can override ----
  [/text-\[#B9BAC4\]/g, 'text-[var(--text-muted)]'],

  // ---- #2B3A30 dark green (danger bg) -> reference bg-danger ----
  [/bg-\[#2B3A30\]/g, 'bg-[var(--bg-danger)]'],

  // ---- #0A0A0A text on brand buttons (keep but reference variable since it's dark-on-brand) ----
  // This is used on brand green buttons, should stay dark in both modes
  [/text-\[#0A0A0A\]/g, 'text-[var(--bg-deep)]'],
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

console.log(`✅ Pass 5 complete: ${changedCount} files modified.`);
