// Prints the license of every installed package so the OSS inventory can be reviewed.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = 'node_modules';
const rows = [];
const visit = (dir) => {
  const pkg = join(dir, 'package.json');
  if (existsSync(pkg)) {
    const p = JSON.parse(readFileSync(pkg, 'utf8'));
    if (p.name && p.version) rows.push([p.name, p.version, typeof p.license === 'string' ? p.license : 'UNKNOWN']);
  }
};
for (const name of readdirSync(root)) {
  if (name.startsWith('.')) continue;
  if (name.startsWith('@')) for (const sub of readdirSync(join(root, name))) visit(join(root, name, sub));
  else visit(join(root, name));
}
const runtime = Object.keys(JSON.parse(readFileSync('package.json', 'utf8')).dependencies);
const flagged = rows.filter(([, , l]) => !/^(MIT|ISC|Apache-2\.0|BSD-[23]-Clause|OFL-1\.1|0BSD|BlueOak-1\.0\.0|CC0-1\.0|Python-2\.0|CC-BY-4\.0|\(MIT OR CC0-1\.0\))$/.test(l));
console.log('Runtime (shipped):');
for (const r of rows.filter(([n]) => runtime.includes(n))) console.log('  ' + r.join('  '));
console.log(`\n${rows.length} packages installed. Needs review: ${flagged.length}`);
for (const r of flagged) console.log('  ' + r.join('  '));
