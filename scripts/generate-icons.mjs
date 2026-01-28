import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '../apps/web/public/icons');
const svgPath = join(iconsDir, 'icon.svg');

const sizes = [192, 512];

mkdirSync(iconsDir, { recursive: true });

const svg = readFileSync(svgPath, 'utf-8');

for (const size of sizes) {
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: size,
    },
  });

  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();

  const outputPath = join(iconsDir, `icon-${size}x${size}.png`);
  writeFileSync(outputPath, pngBuffer);
  console.log(`Generated: ${outputPath}`);
}

console.log('Icon generation complete!');
