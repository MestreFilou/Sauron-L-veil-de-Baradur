#!/usr/bin/env node
// Génère voix/SCRIPT_LECTURE.md à partir de banque/voix.json.
// Usage (depuis audio/) : node outils/seances/script_lecture.mjs [sortie.md]
// Sans argument : liste les ids d'une séance avec « --ids N » (sert à decouper_seance.sh).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const audio = fileURLToPath(new URL('../../', import.meta.url));
const banque = JSON.parse(readFileSync(audio + 'banque/voix.json', 'utf8')).repliques;

const SEANCES = {
  1: 'Noir Parler : l’inscription et les répliques clés',
  2: 'Paranoïa (anglais)',
  3: 'Annatar, la séduction (anglais)',
  4: 'Commandement de Fer (anglais)',
  5: 'Duel mental et cris des Nazgûl (anglais)',
  6: 'Noir Parler : nouvelles répliques',
  7: 'Ordres aux Nazgûl (anglais)',
  8: 'Prisons et interrogatoires (anglais)',
  9: 'Montagne du Destin, forge et améliorations (anglais)',
  10: 'Aube, réussites et colères (anglais)',
  11: 'Écran titre, fin de partie, Nazgûl (anglais)',
};
const JOUEES = new Set(['inscription', 'paranoia', 'annatar', 'fer', 'cri', 'duel']);

const args = process.argv.slice(2);
if (args[0] === '--ids') {
  const n = Number(args[1]);
  const toutes = args.includes('--toutes');
  for (const r of banque) if (r.seance === n && (toutes || r.statut !== 'enregistre')) console.log(`${r.id}\t${r.methode}`);
  process.exit(0);
}

const parSeance = new Map();
for (const r of banque) parSeance.set(r.seance, [...(parSeance.get(r.seance) ?? []), r]);
const nums = [...parSeance.keys()].sort((a, b) => a - b);
const fait = banque.filter((r) => r.statut === 'enregistre').length;

let md = `# Script de lecture : voix de Sauron

${banque.length} répliques, dont ${fait} enregistrées. Fichier généré depuis \`audio/banque/voix.json\` par \`audio/outils/seances/script_lecture.mjs\` : ne pas le modifier à la main.

## Avant de commencer

- **Micro** : Blue Yeti en cardioïde, à 10-15 cm, pics entre -12 et -6 dB. Export en WAV.
- **Une prise par séance.** Lis les phrases dans l’ordre, en laissant **2 secondes de silence** entre deux phrases (compte « un, deux » dans ta tête). Le découpage se fait sur ces silences : à l’intérieur d’une phrase, ne marque pas de pause de plus d’une seconde.
- **Une phrase ratée** : finis la séance quand même, puis réenregistre seulement celle-là dans une prise à part (voir « Après la séance »).
- **Noir Parler** (séances 1 et 6) : lis la ligne en gras telle quelle, à la française. Les syllabes en MAJUSCULES portent l’accent. « kh » et « gh » se raclent au fond de la gorge.
- **Anglais** (les autres séances) : lis l’anglais normalement, avec l’intention indiquée. Le script inverse la piste ensuite, donc l’accent n’a pas d’importance, seuls le rythme et le ton comptent.
- Joue au-dessus de ta voix naturelle : la chaîne descend la hauteur et ajoute les voix superposées, mais pas l’émotion.

## Après la séance

Depuis le dossier \`audio/\` du jeu (il faut sox et ffmpeg) :

\`\`\`
outils/seances/decouper_seance.sh prise.wav 3            # découpe la séance 3, traite chaque phrase, range voix/<id>.mp3
outils/seances/decouper_seance.sh reprise.wav --ids fer_en_05   # une ou plusieurs phrases refaites à part
node outils/seances/marquer_enregistrees.mjs             # passe en « enregistré » les répliques qui ont leur fichier
\`\`\`

## Séances

| Séance | Thème | Répliques | Enregistrées | Dans le jeu aujourd’hui |
|---|---|---|---|---|
`;
for (const n of nums) {
  const rs = parSeance.get(n);
  const ok = rs.filter((r) => r.statut === 'enregistre').length;
  const joue = rs.every((r) => JOUEES.has(r.registre)) ? 'oui' : rs.some((r) => JOUEES.has(r.registre)) ? 'en partie' : 'écrans à venir';
  md += `| ${n} | ${SEANCES[n] ?? ''} | ${rs.length} | ${ok} | ${joue} |\n`;
}
md += `\nLes séances 1 à 5 sont jouées dès maintenant par le jeu. Les séances 6 à 11 préparent les écrans à venir (Nazgûl, prisons, Montagne du Destin, aube, menus) : leurs registres existent déjà dans la banque.\n`;

for (const n of nums) {
  const rs = parSeance.get(n);
  md += `\n---\n\n## Séance ${n} : ${SEANCES[n] ?? ''}\n\n`;
  rs.forEach((r, i) => {
    const etat = r.statut === 'enregistre' ? ' ✓ enregistrée' : '';
    md += `**${i + 1}. \`${r.id}\`**${etat}  \n`;
    md += `*${r.intention}*\n\n`;
    md += `> **${r.lu}**\n\n`;
    if (r.noir_parler) md += `Noir Parler : ${r.noir_parler}  \n`;
    md += `Sous-titre : ${r.sous_titre}\n\n`;
  });
}
const sortie = args[0] ?? audio + 'voix/SCRIPT_LECTURE.md';
writeFileSync(sortie, md);
console.log(`${sortie} : ${banque.length} répliques, ${nums.length} séances`);
