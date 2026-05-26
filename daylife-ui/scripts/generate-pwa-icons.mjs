import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const svg = readFileSync(join(publicDir, 'icon.svg'), 'utf8');

for (const size of [192, 512]) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
  });
  const png = resvg.render().asPng();
  writeFileSync(join(publicDir, `pwa-${size}x${size}.png`), png);
}

const apple = new Resvg(svg, { fitTo: { mode: 'width', value: 180 } });
writeFileSync(join(publicDir, 'apple-touch-icon.png'), apple.render().asPng());

console.log('Generated PWA icons in public/');
