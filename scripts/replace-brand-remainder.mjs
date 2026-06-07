/**
 * Final targeted pass: convert remaining #2563EB references in SVG,
 * CSS-in-JS, and data-driven contexts.
 *
 * Run: node scripts/replace-brand-remainder.mjs
 */

import { readFileSync, writeFileSync } from 'fs';

const FILES = [
  'src/components/AuthUI.tsx',
  'src/components/SampleSmokeTester.tsx',
  'src/components/SmokeSuitePanel.tsx',
  'src/components/SmokeTestPanel.tsx',
  'src/components/TeamModal.tsx',
  'src/features/editor/RequestEditor.tsx',
  'src/features/editor/VisualizerPanel.tsx',
];

const REPLACEMENTS = [
  // SVG stopColor (inline attribute)
  [/\bstopColor="#2563EB"/g, 'stopColor="var(--brand)"'],
  [/\bstopcolor="#2563EB"/g, 'stopcolor="var(--brand)"'],
  [/\bstopOpacity="0\.28"/g, 'stopOpacity="0.28"'],

  // SVG stroke
  [/\bstroke="#2563EB"/g, 'stroke="var(--brand)"'],

  // SVG fill (conditional)
  [/fill=\{p\.success \? '#2563EB'/g, "fill={p.success ? 'var(--brand)'"],

  // Data color (threshold-based)
  [/\? '#2563EB' :/g, "? 'var(--brand)' :"],

  // Inline CSS styles
  [/background: #2563EB/g, 'background: var(--brand)'],

  // Shadow with hex color shorthand
  [/shadow-\[#2563EB20\]/g, 'shadow-[rgba(var(--brand-rgb),0.13)]'],
  [/shadow-sm shadow-\[#2563EB\]\/5/g, 'shadow-sm shadow-[var(--brand)]/5'],

  // Focus ring
  [/focus:ring-\[#2563EB\]\/5/g, 'focus:ring-[var(--brand)]/5'],
  [/focus:ring-\[#2563EB\]\/20/g, 'focus:ring-[var(--brand)]/20'],
  [/focus:ring-1 focus:ring-\[#2563EB\]/g, 'focus:ring-1 focus:ring-[var(--brand)]'],

  // Gradient end color
  [/to-\[#2563EB\]/g, 'to-[var(--brand)]'],
];

let changedCount = 0;
for (const file of FILES) {
  let content;
  try {
    content = readFileSync(file, 'utf-8');
  } catch {
    continue;
  }
  const original = content;
  for (const [regex, replacement] of REPLACEMENTS) {
    content = content.replace(regex, replacement);
  }
  if (content !== original) {
    writeFileSync(file, content, 'utf-8');
    changedCount++;
    console.log(`  ✏️  ${file}`);
  }
}

console.log(`\n✅ Final pass complete: ${changedCount} files modified.`);
