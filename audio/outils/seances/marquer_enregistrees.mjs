#!/usr/bin/env node
// Passe à « enregistre » chaque réplique dont le fichier voix/<id>.mp3 existe, avec sa durée (soxi -D).
// Usage (depuis audio/) : node outils/seances/marquer_enregistrees.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const audio = fileURLToPath(new URL('../../', import.meta.url));
const chemin = audio + 'banque/voix.json';
const b = JSON.parse(readFileSync(chemin, 'utf8'));
let n = 0;
for (const r of b.repliques) {
  const f = audio + r.fichier;
  if (!existsSync(f)) continue;
  const d = Number(execFileSync('soxi', ['-D', f], { encoding: 'utf8' }).trim());
  const duree = Math.round(d * 100) / 100;
  if (r.statut !== 'enregistre' || r.duree_s !== duree) n++;
  r.statut = 'enregistre';
  r.duree_s = duree;
}
writeFileSync(chemin, JSON.stringify(b, null, 1) + '\n');
console.log(`${n} réplique(s) mise(s) à jour ; ${b.repliques.filter((r) => r.statut === 'enregistre').length}/${b.repliques.length} enregistrées.`);
execFileSync('node', [audio + 'outils/seances/script_lecture.mjs'], { stdio: 'inherit' });
