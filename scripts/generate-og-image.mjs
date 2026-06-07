// Generates a 1200×630 Open Graph image for social sharing previews
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '..', 'public');
const outPath = path.join(outDir, 'og-image.png');

const width = 1200;
const height = 630;

const svgOverlay = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0C0C0E;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#050506;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="accentLine" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#3ECF8E;stop-opacity:0" />
      <stop offset="50%" style="stop-color:#3ECF8E;stop-opacity:0.8" />
      <stop offset="100%" style="stop-color:#3ECF8E;stop-opacity:0" />
    </linearGradient>
    <linearGradient id="glow" x1="50%" y1="50%" x2="50%" y2="0%">
      <stop offset="0%" style="stop-color:#3ECF8E;stop-opacity:0.08" />
      <stop offset="100%" style="stop-color:#3ECF8E;stop-opacity:0" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${width}" height="${height}" fill="url(#bgGrad)" />

  <!-- Grid overlay -->
  <g opacity="0.03" stroke="#FFFFFF" stroke-width="0.5">
    ${Array.from({length: 40}, (_, i) => `<line x1="${i * 30}" y1="0" x2="${i * 30}" y2="${height}" />`).join('\n    ')}
    ${Array.from({length: 22}, (_, i) => `<line x1="0" y1="${i * 30}" x2="${width}" y2="${i * 30}" />`).join('\n    ')}
  </g>

  <!-- Top accent glow -->
  <ellipse cx="${width/2}" cy="315" rx="400" ry="280" fill="url(#glow)" />

  <!-- Top accent line -->
  <rect x="0" y="0" width="${width}" height="3" fill="url(#accentLine)" />

  <!-- Terminal chevron logo -->
  <g transform="translate(${width/2 - 30}, 175)">
    <rect x="0" y="0" width="60" height="60" rx="12" fill="#3ECF8E" opacity="0.15" />
    <polyline points="18,35 30,23 42,35" fill="none" stroke="#3ECF8E" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
    <line x1="22" y1="45" x2="38" y2="45" stroke="#3ECF8E" stroke-width="3" stroke-linecap="round" />
  </g>

  <!-- Main title -->
  <text x="${width/2}" y="295" text-anchor="middle" font-family="monospace, sans-serif" font-size="72" font-weight="900" fill="#FFFFFF" letter-spacing="8">
    GIMAY
  </text>

  <!-- Tagline -->
  <text x="${width/2}" y="340" text-anchor="middle" font-family="monospace, sans-serif" font-size="18" font-weight="bold" fill="#666666" letter-spacing="6">
    TACTICAL API COMMAND SUITE
  </text>

  <!-- Badge -->
  <rect x="${width/2 - 70}" y="370" width="140" height="28" rx="14" fill="none" stroke="#3ECF8E" stroke-width="1" opacity="0.4" />
  <text x="${width/2}" y="390" text-anchor="middle" font-family="monospace, sans-serif" font-size="10" font-weight="black" fill="#3ECF8E" letter-spacing="3" opacity="0.7">
    FREE • OPEN SOURCE
  </text>

  <!-- Bottom accent line -->
  <rect x="0" y="${height-3}" width="${width}" height="3" fill="url(#accentLine)" />
</svg>`;

try {
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const svgBuffer = Buffer.from(svgOverlay);
  const image = sharp(svgBuffer)
    .resize(width, height)
    .png();

  await image.toFile(outPath);
  console.log(`✅ OG image generated: ${outPath} (${width}×${height})`);
} catch (err) {
  console.error('❌ Failed to generate OG image:', err);
  process.exit(1);
}
