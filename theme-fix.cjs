const fs = require('fs');
const path = require('path');

const directory = 'src';

const colorMap = {
  // Backgrounds
  '#0A0A0A': 'var(--bg-deep)',
  '#0a0a0a': 'var(--bg-deep)',
  '#0F0F0F': 'var(--bg-surface)',
  '#0f0f0f': 'var(--bg-surface)',
  '#0D0D0D': 'var(--bg-surface)',
  '#0d0d0d': 'var(--bg-surface)',
  '#080808': 'var(--bg-surface)',
  '#1A1A1A': 'var(--bg-elevated)',
  '#1a1a1a': 'var(--bg-elevated)',
  '#141414': 'var(--bg-elevated)',
  '#1C1C1C': 'var(--bg-elevated)',
  '#111111': 'var(--bg-elevated)',
  '#111': 'var(--bg-elevated)',
  '#222222': 'var(--border-subtle)',
  '#222': 'var(--border-subtle)',
  '#1F1F1F': 'var(--border-subtle)',
  '#1f1f1f': 'var(--border-subtle)',
  '#2A2A2A': 'var(--border-subtle)',
  '#333333': 'var(--border-strong)',
  '#333': 'var(--border-strong)',
  '#444444': 'var(--border-strong)',
  '#444': 'var(--border-strong)',
  '#E0E0E0': 'var(--text-main)',
  '#e0e0e0': 'var(--text-main)',
  '#AAAAAA': 'var(--text-main)',
  '#aaaaaa': 'var(--text-main)',
  '#888888': 'var(--text-muted)',
  '#888': 'var(--text-muted)',
  '#666666': 'var(--text-muted)',
  '#666': 'var(--text-muted)',
  '#555555': 'var(--text-dim)',
  '#555': 'var(--text-dim)',
  '#3ECF8E': 'var(--brand)',
  '#3ecf8e': 'var(--brand)'
};

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  for (const [hex, cssVar] of Object.entries(colorMap)) {
    const regex1 = new RegExp(`bg-\\[${hex}\\]`, 'g');
    content = content.replace(regex1, `bg-[${cssVar}]`);

    const regex2 = new RegExp(`border-\\[${hex}\\]`, 'g');
    content = content.replace(regex2, `border-[${cssVar}]`);

    const regex3 = new RegExp(`text-\\[${hex}\\]`, 'g');
    content = content.replace(regex3, `text-[${cssVar}]`);
    
    const regex4 = new RegExp(`border-b-\\[${hex}\\]`, 'g');
    content = content.replace(regex4, `border-b-[${cssVar}]`);
    
    const regex5 = new RegExp(`border-t-\\[${hex}\\]`, 'g');
    content = content.replace(regex5, `border-t-[${cssVar}]`);
    
    const regex6 = new RegExp(`border-x-\\[${hex}\\]`, 'g');
    content = content.replace(regex6, `border-x-[${cssVar}]`);
    
    const regex7 = new RegExp(`border-y-\\[${hex}\\]`, 'g');
    content = content.replace(regex7, `border-y-[${cssVar}]`);
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated:', filePath);
  }
}

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

walk(directory);
