// Verifies every verse in src/content/scripture.ts against the World English Bible text
// served by bible-api.com. Run before every content release: `npm run verify:scripture`.
// Exits 1 on any mismatch so it can gate CI.
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/content/scripture.ts', import.meta.url), 'utf8');
const re = /V\('([^']+)', '([^']+)',\s*\n\s*'((?:[^'\\]|\\.)*)'/g;
const verses = [...src.matchAll(re)].map((m) => ({ id: m[1], ref: m[2], text: m[3].replace(/\\'/g, "'") }));
const norm = (s) => s.replace(/[“”"‘’'«»]/g, '').replace(/[—–-]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase().replace(/[.,;:!?]+$/, '');

let bad = 0;
for (const v of verses) {
  const url = `https://bible-api.com/${encodeURIComponent(v.ref)}?translation=web`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const official = norm(data.text);
    const ours = norm(v.text);
    if (official !== ours) {
      bad++;
      console.log(`✗ ${v.ref}\n  ours:     ${ours}\n  official: ${official}\n`);
    } else console.log(`✓ ${v.ref}`);
  } catch (e) {
    bad++;
    console.log(`? ${v.ref}: ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 400));
}
console.log(`\n${verses.length - bad}/${verses.length} verified`);
process.exit(bad ? 1 : 0);
