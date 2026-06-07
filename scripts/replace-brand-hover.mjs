/**
 * Replace all leftover green brand hover colors with var(--brand-hover).
 *
 * Run: node scripts/replace-brand-hover.mjs
 */

import { readFileSync, writeFileSync } from 'fs';

const PATTERNS = [
  ['src/components/AuthUI.tsx', [
    [/hover:bg-\[#46e6a0\]/g, 'hover:bg-[var(--brand-hover)]'],
    [/shadow-lg shadow-\[#2563EB\]\/10/g, 'shadow-lg shadow-[rgba(var(--brand-rgb),0.1)]'],
  ]],
  ['src/components/CollectionImportModal.tsx', [
    [/hover:bg-\[#46e6a0\]/g, 'hover:bg-[var(--brand-hover)]'],
  ]],
  ['src/components/DatabaseMigrationModal.tsx', [
    [/hover:bg-\[#46e6a0\]/g, 'hover:bg-[var(--brand-hover)]'],
  ]],
  ['src/components/ConfirmModal.tsx', [
    [/hover:bg-\[#34B37A\]/g, 'hover:bg-[var(--brand-hover)]'],
  ]],
  ['src/components/TeamModal.tsx', [
    [/hover:bg-\[#32B379\]/g, 'hover:bg-[var(--brand-hover)]'],
    [/text-\[#070708\]/g, 'text-[var(--bg-deep)]'],
  ]],
  ['src/features/editor/CollectionEditor.tsx', [
    [/hover:bg-\[#34B37A\]/g, 'hover:bg-[var(--brand-hover)]'],
  ]],
  ['src/components/SmokeSuitePanel.tsx', [
    [/hover:bg-\[#32B379\]/g, 'hover:bg-[var(--brand-hover)]'],
    [/text-\[#070708\]/g, 'text-[var(--bg-deep)]'],
  ]],
  ['src/features/editor/EnvironmentEditor.tsx', [
    [/hover:bg-\[#34B37A\]/g, 'hover:bg-[var(--brand-hover)]'],
  ]],
  ['src/components/NameModal.tsx', [
    [/hover:bg-\[#34B37A\]/g, 'hover:bg-[var(--brand-hover)]'],
  ]],
  ['src/components/LandingPage.tsx', [
    [/hover:bg-\[#34B37A\]/g, 'hover:bg-[var(--brand-hover)]'],
  ]],
  ['src/components/SampleSmokeTester.tsx', [
    [/hover:bg-\[#34B37A\]/g, 'hover:bg-[var(--brand-hover)]'],
  ]],
  ['src/features/editor/RequestEditor.tsx', [
    [/hover:bg-\[#34B37A\]/g, 'hover:bg-[var(--brand-hover)]'],
  ]],
];

let totalChanged = 0;
for (const [file, replacements] of PATTERNS) {
  let content;
  try {
    content = readFileSync(file, 'utf-8');
  } catch {
    console.error(`  ⚠️  Could not read ${file}`);
    continue;
  }
  const original = content;
  for (const [regex, replacement] of replacements) {
    content = content.replace(regex, replacement);
  }
  if (content !== original) {
    writeFileSync(file, content, 'utf-8');
    totalChanged++;
    console.log(`  ✏️  ${file}`);
  }
}

console.log(`\n✅ Brand hover fix complete: ${totalChanged} files modified.`);
