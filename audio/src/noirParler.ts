import lexiqueJson from '../donnees/lexique_noir_parler.json';
import repliquesJson from '../donnees/repliques.json';

export interface EntreeLexique {
  mot: string;
  sens: string;
  statut: 'atteste' | 'invente' | 'derive';
  type: 'racine' | 'suffixe';
}

export interface Replique {
  id: string;
  registre: 'inscription' | 'paranoia' | 'annatar' | 'fer' | 'cri';
  noir_parler: string;
  phonetique: string;
  sous_titre: string;
  fichier: string;
}

export const LEXIQUE = (lexiqueJson as { entrees: EntreeLexique[] }).entrees;
export const REPLIQUES = (repliquesJson as { repliques: Replique[] }).repliques;

const normaliser = (s: string) => s.toLowerCase().normalize('NFC');

/**
 * Décompose un mot agglutiné (racine + suffixes, mécaniques 10.1) à partir du
 * lexique fermé. Renvoie null si le mot ne s'y décompose pas.
 * Exemple : « thrakatulûk » → thrak + at + ul + ûk.
 */
export function decomposer(mot: string, lexique: EntreeLexique[] = LEXIQUE): EntreeLexique[] | null {
  const m = normaliser(mot);
  const racines = lexique.filter((e) => e.type === 'racine').sort((a, b) => b.mot.length - a.mot.length);
  const suffixes = lexique.filter((e) => e.type === 'suffixe').sort((a, b) => b.mot.length - a.mot.length);
  const suite = (reste: string): EntreeLexique[] | null => {
    if (!reste) return [];
    for (const s of suffixes) {
      if (reste.startsWith(normaliser(s.mot))) {
        const r = suite(reste.slice(s.mot.length));
        if (r) return [s, ...r];
      }
    }
    return null;
  };
  for (const r of racines) {
    if (!m.startsWith(normaliser(r.mot))) continue;
    const rest = suite(m.slice(r.mot.length));
    if (rest) return [r, ...rest];
  }
  // Un mot peut aussi être un suffixe seul employé comme mot (« agh », « ishi »).
  const seul = suite(m);
  return seul && seul.length ? seul : null;
}

/** Vérifie qu'une ligne n'emploie que des mots du lexique (10.2, étape 3). */
export function verifierLigne(ligne: string, lexique: EntreeLexique[] = LEXIQUE): { valide: boolean; inconnus: string[] } {
  const mots = ligne
    .split(/[\s.,!?;:«»"()]+/)
    .flatMap((m) => m.split('-'))
    .filter(Boolean);
  const inconnus = mots.filter((m) => !decomposer(m, lexique));
  return { valide: inconnus.length === 0, inconnus };
}

/** Une réplique fixe du registre, choisie de façon déterministe : le jeu parle sans synthèse en direct. */
export function repliqueFixe(registre: Replique['registre'], graine = 0): Replique | undefined {
  const liste = REPLIQUES.filter((r) => r.registre === registre);
  return liste.length ? liste[Math.abs(graine) % liste.length] : undefined;
}

/** Clé de cache d'un fichier audio : hachage du texte phonétique et de la voix (10.3). */
export function cleAudio(phonetique: string, voix: string): string {
  let h = 0x811c9dc5;
  for (const c of `${voix}|${phonetique}`) {
    h ^= c.codePointAt(0)!;
    h = Math.imul(h, 0x01000193);
  }
  return `${voix}-${(h >>> 0).toString(16).padStart(8, '0')}`;
}
