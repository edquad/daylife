/**
 * GitHub Pages: copy index.html → 404.html and stamp build version for cache busting.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const distDir = join(process.cwd(), 'dist');
const indexPath = join(distDir, 'index.html');
const version = process.env.GITHUB_SHA?.slice(0, 7) || String(Date.now());

let html = readFileSync(indexPath, 'utf8');

if (!html.includes('<base ')) {
  html = html.replace('<head>', '<head>\n    <base href="/daylife/" />');
}

if (!html.includes('name="rozka-version"')) {
  html = html.replace('</head>', `    <meta name="rozka-version" content="${version}" />\n  </head>`);
}

writeFileSync(indexPath, html);
writeFileSync(join(distDir, '404.html'), html);
console.log(`GitHub Pages SPA ready (rozka-version=${version})`);
