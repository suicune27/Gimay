/**
 * Extended replacement script for hardcoded hex colors.
 * Handles both 6-char and 3-char shorthand hex codes.
 * 
 * Safe patterns ONLY — brand colors (#3ECF8E etc.) are preserved.
 * text-white, shadow-*, bg-white/opacity, border-white/opacity are preserved.
 *
 * Run: node scripts/replace-hex-colors.mjs
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

// Each replacement is [regex, replacementString]
const REPLACEMENTS = [
  // ===== BACKGROUNDS (6-char) =====
  [/bg-\[#050505\]/g,   'bg-deep'],
  [/bg-\[#050506\]/g,   'bg-deep'],
  [/bg-\[#050507\]/g,   'bg-deep'],
  [/bg-\[#050508\]/g,   'bg-deep'],
  [/bg-\[#05050A\]/g,   'bg-deep'],
  [/bg-\[#070708\]/g,   'bg-deep'],
  [/bg-\[#070709\]/g,   'bg-deep'],
  [/bg-\[#080808\]/g,   'bg-deep'],
  [/bg-\[#08080A\]/g,  'bg-deep'],
  [/bg-\[#090909\]/g,   'bg-deep'],
  [/bg-\[#09090B\]/g,   'bg-deep'],
  [/bg-\[#09090C\]/g,   'bg-deep'],
  [/bg-\[#0A0A0A\]/g,   'bg-deep'],
  [/bg-\[#0A0A0B\]/g,   'bg-deep'],
  [/bg-\[#0A0A0E\]/g,   'bg-deep'],
  [/bg-\[#0A0A0F\]/g,   'bg-deep'],
  [/bg-\[#0B0B0B\]/g,   'bg-surface'],
  [/bg-\[#0B0B0C\]/g,   'bg-sidebar'],
  [/bg-\[#0C0C0E\]/g,   'bg-surface'],
  [/bg-\[#0C0C10\]/g,   'bg-card'],
  [/bg-\[#0C0C0F\]/g,   'bg-card'],
  [/bg-\[#0D0D12\]/g,   'bg-tab'],
  [/bg-\[#0E0E0E\]/g,   'bg-surface'],
  [/bg-\[#0E0E10\]/g,   'bg-surface'],
  [/bg-\[#0F0F0F\]/g,   'bg-surface'],
  [/bg-\[#0f0f0f\]/g,   'bg-surface'],
  [/bg-\[#0F0F12\]/g,   'bg-surface'],
  [/bg-\[#111111\]/g,   'bg-input'],
  [/bg-\[#141414\]/g,   'bg-elevated'],
  [/bg-\[#161616\]/g,   'bg-elevated'],
  [/bg-\[#1A1A1A\]/g,   'bg-elevated'],
  [/bg-\[#1a1a1a\]/g,   'bg-elevated'],
  [/bg-\[#1A1A1E\]/g,   'bg-elevated'],
  [/bg-\[#1A1A22\]/g,   'bg-elevated'],
  [/bg-\[#1E1E1E\]/g,   'bg-elevated'],
  [/bg-\[#1E1E28\]/g,   'bg-elevated'],
  [/bg-\[#1F1F1F\]/g,   'bg-hover-bg'],
  [/bg-\[#242424\]/g,   'bg-elevated'],
  [/bg-\[#2A2A2A\]/g,   'bg-elevated'],
  [/bg-\[#2a2a2a\]/g,   'bg-elevated'],
  [/bg-\[#2c2c2c\]/g,   'bg-elevated'],
  [/bg-\[#1C1C22\]/g,   'bg-code'],
  [/bg-\[#1C1C24\]/g,   'bg-code'],
  [/bg-\[#1C1C25\]/g,   'bg-code'],
  [/bg-\[#0C0C0E\]\/95/g, 'bg-glass-bg'],
  [/bg-\[#0A0A0C\]\/95/g, 'bg-glass-bg'],
  [/bg-\[#000000\]\/80/g, 'bg-glass-bg'],
  [/bg-\[#0c0c12\]/g,   'bg-card'],

  // ===== BACKGROUNDS (3-char shorthand) =====
  [/bg-\[#111\]/g, 'bg-input'],
  [/bg-\[#222\]/g, 'bg-elevated'],

  // ===== TEXT COLORS (6-char) =====
  [/text-\[#AAAAAA\]/g, 'text-muted'],
  [/text-\[#AAAAAF\]/g, 'text-muted'],
  [/text-\[#A0A0A0\]/g, 'text-muted'],
  [/text-\[#666666\]/g, 'text-muted'],
  [/text-\[#777777\]/g, 'text-muted'],
  [/text-\[#888888\]/g, 'text-muted'],
  [/text-\[#88888F\]/g, 'text-muted'],
  [/text-\[#999999\]/g, 'text-muted'],
  [/text-\[#abb2bf\]/g, 'text-muted'],
  [/text-\[#444444\]/g, 'text-dim'],
  [/text-\[#44444C\]/g, 'text-dim'],
  [/text-\[#44444F\]/g, 'text-placeholder'],
  [/text-\[#555555\]/g, 'text-dim'],
  [/text-\[#55555C\]/g, 'text-dim'],
  [/text-\[#333333\]/g, 'text-dim'],
  [/text-\[#33333C\]/g, 'text-dim'],
  [/text-\[#33333F\]/g, 'text-dim'],
  [/text-\[#E0E0E0\]/g, 'text-main'],
  [/text-\[#E0E0E6\]/g, 'text-main'],

  // ===== TEXT COLORS (3-char shorthand) =====
  [/text-\[#555\]/g, 'text-dim'],
  [/text-\[#888\]/g, 'text-muted'],
  [/text-\[#666\]/g, 'text-muted'],
  [/text-\[#444\]/g, 'text-dim'],
  [/text-\[#777\]/g, 'text-muted'],
  [/text-\[#AAA\]/g, 'text-muted'],
  [/text-\[#aaa\]/g, 'text-muted'],
  [/text-\[#333\]/g, 'text-dim'],
  [/text-\[#999\]/g, 'text-muted'],
  [/text-\[#bbb\]/g, 'text-muted'],

  // ===== BORDER COLORS (6-char) =====
  [/border-\[#111111\]/g, 'border-subtle'],
  [/border-\[#151518\]/g, 'border-sidebar'],
  [/border-\[#1A1A1A\]/g, 'border-subtle'],
  [/border-\[#1A1A1E\]/g, 'border-subtle'],
  [/border-\[#1A1A22\]/g, 'border-subtle'],
  [/border-\[#1D1D22\]/g, 'border-subtle'],
  [/border-\[#222222\]/g, 'border-subtle'],
  [/border-\[#222226\]/g, 'border-subtle'],
  [/border-\[#22222E\]/g, 'border-subtle'],
  [/border-\[#26262B\]/g, 'border-subtle'],
  [/border-\[#2A2A2A\]/g, 'border-subtle'],
  [/border-\[#15151A\]/g, 'border-subtle'],
  [/border-\[#333333\]/g, 'border-strong'],
  [/border-\[#444444\]/g, 'border-strong'],

  // ===== BORDER COLORS (3-char shorthand) =====
  [/border-\[#222\]/g, 'border-subtle'],
  [/border-\[#333\]/g, 'border-strong'],

  // ===== HOVER BACKGROUNDS =====
  [/hover:bg-\[#1A1A1A\]/g, 'hover:bg-elevated'],
  [/hover:bg-\[#1a1a1a\]/g, 'hover:bg-elevated'],
  [/hover:bg-\[#121216\]/g, 'hover:bg-elevated'],
  [/hover:bg-\[#1A1A1E\]/g, 'hover:bg-elevated'],
  [/hover:bg-\[#1F1F1F\]/g, 'hover:bg-hover-bg'],
  [/hover:bg-\[#0F0F0F\]/g, 'hover:bg-surface'],
  [/hover:bg-\[#0f0f0f\]/g, 'hover:bg-surface'],

  // ===== FOCUS BACKGROUNDS =====
  [/focus:bg-\[#0F0F0F\]/g, 'focus:bg-surface'],
  [/focus:bg-\[#0f0f0f\]/g, 'focus:bg-surface'],

  // ===== PLACEHOLDER =====
  [/placeholder-\[#44444F\]/g, 'placeholder-text-dim'],
  [/placeholder:text-\[#333333\]/g, 'placeholder:text-dim'],
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

console.log(`✅ Complete: ${changedCount} files modified.`);
