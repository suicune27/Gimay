import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const SIZES = {
  ico: [16, 24, 32, 48, 64, 128, 256],
  png: [16, 24, 32, 48, 64, 128, 256, 512],
  favicon: [16, 32, 48],
};

const BUILD_DIR = path.resolve('build');
const PUBLIC_DIR = path.resolve('public');
const SVG_PATH = path.resolve('build/gimay-icon.svg');

if (!fs.existsSync(BUILD_DIR)) fs.mkdirSync(BUILD_DIR, { recursive: true });

async function generatePNGs() {
  const svgBuffer = fs.readFileSync(SVG_PATH);
  const pngDir = path.join(BUILD_DIR, 'png');
  if (!fs.existsSync(pngDir)) fs.mkdirSync(pngDir, { recursive: true });

  for (const size of SIZES.png) {
    const outPath = path.join(pngDir, `${size}.png`);
    await sharp(svgBuffer).resize(size, size).png().toFile(outPath);
    console.log(`  ✓ ${size}x${size} PNG`);
  }

  // Also create build/icon.png (256x256 is standard for electron-builder Linux)
  await sharp(svgBuffer).resize(256, 256).png().toFile(path.join(BUILD_DIR, 'icon.png'));
  console.log('  ✓ icon.png (256x256)');

  // Create 512x512 as icon.png for high-res Linux
  await sharp(svgBuffer).resize(512, 512).png().toFile(path.join(BUILD_DIR, 'icon-512.png'));
  console.log('  ✓ icon-512.png (512x512)');
}

async function generateICO() {
  const svgBuffer = fs.readFileSync(SVG_PATH);

  // ICO format: header + directory entries + image data (PNG)
  const images = [];
  for (const size of SIZES.ico) {
    const pngBuffer = await sharp(svgBuffer).resize(size, size).png().toBuffer();
    images.push({ size, buffer: pngBuffer });
  }

  // ICO header
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);      // Reserved
  header.writeUInt16LE(1, 2);      // ICO type (1 = icon)
  header.writeUInt16LE(images.length, 4); // Number of images

  // Directory entries
  const entrySize = 16;
  let dataOffset = 6 + images.length * entrySize;
  const entries = [];

  for (const img of images) {
    const entry = Buffer.alloc(entrySize);
    const size = img.size >= 256 ? 0 : img.size;
    entry.writeUInt8(size, 0);       // Width
    entry.writeUInt8(size, 1);       // Height
    entry.writeUInt8(0, 2);          // Colors (0 = 256+)
    entry.writeUInt8(0, 3);          // Reserved
    entry.writeUInt16LE(1, 4);       // Color planes
    entry.writeUInt16LE(32, 6);      // Bits per pixel
    entry.writeUInt32LE(img.buffer.length, 8);  // Image data size
    entry.writeUInt32LE(dataOffset, 12);        // Image data offset
    entries.push(entry);
    dataOffset += img.buffer.length;
  }

  const icoPath = path.join(BUILD_DIR, 'gimay.ico');
  const stream = fs.createWriteStream(icoPath);
  stream.write(header);
  for (const e of entries) stream.write(e);
  for (const img of images) stream.write(img.buffer);
  stream.end();

  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  console.log(`  ✓ gimay.ico (${images.length} sizes: ${SIZES.ico.join(', ')}px)`);
}

async function generateFavicon() {
  const svgBuffer = fs.readFileSync(SVG_PATH);
  if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

  // Create a multi-size favicon.ico (16, 32, 48)
  const images = [];
  for (const size of SIZES.favicon) {
    const pngBuffer = await sharp(svgBuffer).resize(size, size).png().toBuffer();
    images.push({ size, buffer: pngBuffer });
  }

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const entrySize = 16;
  let dataOffset = 6 + images.length * entrySize;
  const entries = [];

  for (const img of images) {
    const entry = Buffer.alloc(entrySize);
    entry.writeUInt8(img.size, 0);
    entry.writeUInt8(img.size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(img.buffer.length, 8);
    entry.writeUInt32LE(dataOffset, 12);
    entries.push(entry);
    dataOffset += img.buffer.length;
  }

  const icoPath = path.join(PUBLIC_DIR, 'favicon.ico');
  const stream = fs.createWriteStream(icoPath);
  stream.write(header);
  for (const e of entries) stream.write(e);
  for (const img of images) stream.write(img.buffer);
  stream.end();

  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  console.log('  ✓ public/favicon.ico');

  // Also generate SVG favicon
  fs.copyFileSync(SVG_PATH, path.join(PUBLIC_DIR, 'favicon.svg'));
  console.log('  ✓ public/favicon.svg');
}

async function main() {
  console.log('\n=== Gimay Icon Generator ===\n');

  console.log('Generating PNGs...');
  await generatePNGs();

  console.log('\nGenerating ICO...');
  await generateICO();

  console.log('\nGenerating Favicon...');
  await generateFavicon();

  console.log('\n✅ All icons generated successfully!\n');

  // Print summary
  const buildFiles = fs.readdirSync(BUILD_DIR).filter(f =>
    f.endsWith('.ico') || f.endsWith('.png') || f.endsWith('.svg')
  );
  console.log('Build directory files:');
  for (const f of buildFiles) {
    const stat = fs.statSync(path.join(BUILD_DIR, f));
    console.log(`  ${f} (${(stat.size / 1024).toFixed(1)} KB)`);
  }

  const publicFiles = fs.readdirSync(PUBLIC_DIR).filter(f =>
    f.endsWith('.ico') || f.endsWith('.svg')
  );
  console.log('\nPublic directory files:');
  for (const f of publicFiles) {
    const stat = fs.statSync(path.join(PUBLIC_DIR, f));
    console.log(`  ${f} (${(stat.size / 1024).toFixed(1)} KB)`);
  }
  console.log('');
}

main().catch(err => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
