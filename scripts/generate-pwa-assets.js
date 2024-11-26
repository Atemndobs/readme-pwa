const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '../public');
const SOURCE_ICON = path.join(ICONS_DIR, 'icon/icons8-voice-recognition-128.png');

// Icon sizes needed for PWA and various platforms
const SIZES = [
  16, 32, 48, 72, 96, 120, 128, 144, 152, 180, 192, 384, 512
];

async function generateIcons() {
  // Read the source icon
  const iconBuffer = fs.readFileSync(SOURCE_ICON);

  console.log('Generating icons for all platforms...');

  // Generate regular icons
  for (const size of SIZES) {
    console.log(`Generating ${size}x${size} icon...`);
    await sharp(iconBuffer)
      .resize(size, size, {
        kernel: sharp.kernel.lanczos3,
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(path.join(ICONS_DIR, `icon-${size}x${size}.png`));
  }

  // Generate maskable icons (with padding)
  for (const size of [192, 512]) {
    console.log(`Generating ${size}x${size} maskable icon...`);
    await sharp(iconBuffer)
      .resize(Math.floor(size * 0.8), Math.floor(size * 0.8), {
        kernel: sharp.kernel.lanczos3,
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
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

  console.log('Generating apple-touch-icon...');
  await sharp(iconBuffer)
    .resize(180, 180, {
      kernel: sharp.kernel.lanczos3,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toFile(path.join(ICONS_DIR, 'apple-touch-icon.png'));

  console.log('Generating favicon...');
  await sharp(iconBuffer)
    .resize(32, 32, {
      kernel: sharp.kernel.lanczos3,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toFile(path.join(ICONS_DIR, 'favicon.png'));

  console.log('✅ Generated all PWA icons successfully!');
}

generateIcons().catch(console.error);
