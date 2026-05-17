const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src');

const replacements = {
  // Backgrounds
  'bg-[#0A0A0A]': 'bg-deep',
  'bg-[#0F0F0F]': 'bg-surface',
  'bg-[#111111]': 'bg-surface',
  'bg-[#121215]': 'bg-surface',
  'bg-[#141414]': 'bg-elevated',
  'bg-[#1A1A1A]': 'bg-elevated',
  'bg-[#1C1C1F]': 'bg-elevated',
  'bg-[#141417]': 'bg-elevated',
  'bg-[#0C0C0E]/90': 'bg-surface/90',
  'bg-[#09090C]/50': 'bg-surface/50',
  'bg-[#050506]': 'bg-deep',
  'bg-[#141416]': 'bg-elevated',
  'bg-[#0D0D0D]': 'bg-surface',
  
  // Borders
  'border-[#1A1A1A]': 'border-subtle',
  'border-[#222222]': 'border-subtle',
  'border-[#222]': 'border-subtle',
  'border-[#2C2C2F]': 'border-strong',
  'border-[#242429]': 'border-subtle',
  'border-[#333333]': 'border-strong',
  'border-[#131316]': 'border-subtle',
  'border-[#111111]': 'border-subtle',
  
  // Texts
  'text-[#AAAAAA]': 'text-muted',
  'text-[#888888]': 'text-muted',
  'text-[#555555]': 'text-dim',
  'text-[#444444]': 'text-dim',
  'text-[#44444F]': 'text-dim',
  'text-[#4E4E54]': 'text-dim',
  'text-[#8E8E93]': 'text-muted',
  'text-[#9E9EAE]': 'text-muted',
  'text-[#D1D1D6]': 'text-main',
  'text-[#E0E0E0]': 'text-main',
  'text-[#222222]': 'text-main',
  'text-[#111111]': 'text-main',
  'text-white': 'text-main',
  
  // Hover
  'hover:bg-[#1A1A1A]': 'hover:bg-elevated',
  'hover:bg-[#222222]': 'hover:bg-subtle',
  'hover:bg-[#111111]': 'hover:bg-elevated',
  'hover:bg-[#1C1C1F]': 'hover:bg-elevated',
  'hover:bg-[#0C0C0F]': 'hover:bg-elevated',
  'hover:bg-[#202024]': 'hover:bg-subtle',
  'hover:bg-[#2C2C2F]': 'hover:bg-strong',
  'hover:text-white': 'hover:text-main',
  
  // Gradients
  'from-[#0A0A0A]': 'from-deep',
  'to-[#0A0A0A]': 'to-deep',
  'via-[#0A0A0A]': 'via-deep',
};

function walkDir(dir) {
  let files = fs.readdirSync(dir);
  for (let file of files) {
    let fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let newContent = content;
      
      for (const [oldVal, newVal] of Object.entries(replacements)) {
        // We use split/join for global replacement
        newContent = newContent.split(oldVal).join(newVal);
      }
      
      if (content !== newContent) {
        fs.writeFileSync(fullPath, newContent, 'utf8');
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

walkDir(directoryPath);
console.log('Refactoring complete!');
