const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '../public');
const SOURCE_SVG = path.join(ICONS_DIR, 'logo.svg');

// Icon sizes needed for PWA
const SIZES = [
  16, 32, 48, 72, 96, 120, 128, 144, 152, 180, 192, 384, 512
];

async function generateIcons() {
  // Read the SVG file
  const svgBuffer = fs.readFileSync(SOURCE_SVG);

  // Generate regular icons
  for (const size of SIZES) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(ICONS_DIR, `icon-${size}x${size}.png`));
  }

  // Generate maskable icons (with padding)
  for (const size of [192, 512]) {
    await sharp(svgBuffer)
      .resize(Math.floor(size * 0.8), Math.floor(size * 0.8))
      .extend({
        top: Math.floor(size * 0.1),
        bottom: Math.floor(size * 0.1),
        left: Math.floor(size * 0.1),
        right: Math.floor(size * 0.1),
        background: { r: 24, g: 24, b: 27, alpha: 1 }
      })
      .png()
      .toFile(path.join(ICONS_DIR, `icon-${size}x${size}-maskable.png`));
  }

  // Generate apple-touch-icon
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(ICONS_DIR, 'apple-touch-icon.png'));

  // Generate favicon.png (we'll use this instead of .ico)
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(path.join(ICONS_DIR, 'favicon.png'));

  console.log('✅ Generated all PWA icons successfully!');
}

generateIcons().catch(console.error);
