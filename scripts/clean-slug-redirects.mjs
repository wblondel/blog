import fs from 'node:fs';

const file = 'src/redirects/slug-redirects.json';
const map = JSON.parse(fs.readFileSync(file, 'utf-8'));
const fixed = {};
for (const [k, v] of Object.entries(map)) {
  if (!k.endsWith('/')) fixed[k] = v;
}
fs.writeFileSync(file, JSON.stringify(fixed, null, 2) + '\n');
console.log(`Done. Kept ${Object.keys(fixed).length} entries (removed trailing-slash duplicates).`);
