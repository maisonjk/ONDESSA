// Builds a single self-contained HTML page of the app for design review links.
// JS, CSS and the Latin font subsets are inlined; the app's CSP meta, manifest and
// service worker are left out because the hosting page provides its own sandbox.
// Usage: node scripts/build-preview-page.mjs <output.html>
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2];
if (!out) throw new Error('Pass an output path');
const dist = 'dist-preview';
execSync(`npx vite build --base ./ --outDir ${dist} --emptyOutDir`, {
  stdio: 'inherit',
  env: { ...process.env, VITE_PREVIEW_PASS: 'true' },
});

let html = readFileSync(join(dist, 'index.html'), 'utf8');
const asset = (ref) => join(dist, ref.replace(/^\.?\//, ''));

const cssRef = /<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/.exec(html)[1];
let css = readFileSync(asset(cssRef), 'utf8');
css = css.replace(/@font-face\{[^}]*\}/g, (face) => {
  const url = /url\(([^)]+\.woff2)\)/.exec(face)?.[1];
  if (!url || !/-latin-(wght|standard)-/.test(url)) return '';
  const data = readFileSync(join(dist, 'assets', url.split('/').pop())).toString('base64');
  return face.replace(/src:[^;}]+/, `src:url(data:font/woff2;base64,${data}) format("woff2")`);
});

const jsRef = /<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/.exec(html)[1];
const js = readFileSync(asset(jsRef), 'utf8').replace(/<\/script/gi, '<\\/script');

html = html
  .replace(/<!doctype html>/i, '')
  .replace(/<\/?html[^>]*>|<\/?head>|<\/?body>/g, '')
  .replace(/<meta name="viewport"[^>]*>|<meta http-equiv="Content-Security-Policy"[^>]*>/g, '')
  .replace(/<link rel="(icon|manifest|apple-touch-icon)"[^>]*>/g, '')
  .replace(/<link rel="stylesheet"[^>]*>/, () => `<style>${css}</style>`)
  .replace(/<script type="module"[^>]*><\/script>/, '')
  .replace('<div id="root"></div>', () => `<div id="root"></div>\n<script type="module">${js}</script>`)
  .replace(/\n\s*\n/g, '\n')
  .trim();

writeFileSync(out, html);
console.log(`Wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
