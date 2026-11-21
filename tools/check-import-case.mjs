// Najde importy, které na Windows fungují, ale na Linuxu (GitHub) ne:
// název souboru v importu se liší velikostí písmen nebo soubor chybí.
// Použití: node tools/check-import-case.mjs
import fs from 'node:fs';
import path from 'node:path';

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]
  );

let problems = 0;
for (const file of walk('src').filter((f) => f.endsWith('.js'))) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
    const target = path.join(path.dirname(file), match[1]);
    const names = fs.existsSync(path.dirname(target)) ? fs.readdirSync(path.dirname(target)) : [];
    const base = path.basename(target);
    if (!names.includes(base)) {
      problems += 1;
      const similar = names.filter((name) => name.toLowerCase().startsWith(base.toLowerCase().replace(/\.js$/, '')));
      console.log(`${file} → ${match[1]}  (na disku: ${similar.join(', ') || 'nic'})`);
    }
  }
}
console.log(problems ? `Problémů: ${problems}` : 'Všechny importy sedí.');
