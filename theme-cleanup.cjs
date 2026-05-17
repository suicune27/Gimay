const fs = require('fs');
const path = require('path');

const directory = 'src';

// We want to replace the ugly arbitrary values generated in the previous run with clean Tailwind tokens!
const fixMap = {
  'hover:text-white': 'hover:text-main',
  'text-white': 'text-main',
  'bg-black': 'bg-deep',
  'bg-black/40': 'bg-deep/40',
  'bg-black/20': 'bg-deep/20',
  // DO NOT replace bg-black/80 or bg-black/60 as those are overlays!
};

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Manual safe replaces
  content = content.replace(/hover:text-white/g, 'hover:text-main');
  content = content.replace(/text-white(?!(\/|\]|space))/g, 'text-main');
  
  // Specific bg-black fixes that aren't overlays
  content = content.replace(/bg-black\/40/g, 'bg-deep/40');
  content = content.replace(/bg-black\/20/g, 'bg-deep/20');
  // Specifically fix `bg-black` without opacity
  content = content.replace(/bg-black(?!(\/|\]|space))/g, 'bg-deep');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Cleaned text-white and bg-black:', filePath);
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
