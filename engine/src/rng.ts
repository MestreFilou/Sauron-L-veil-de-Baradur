/**
 * Générateur aléatoire à graine (mulberry32).
 *
 * Le moteur ne garde aucun état de hasard entre deux appels : chaque phase de
 * chaque tour dérive son propre générateur de (graine de partie, tour, sel).
 * Rejouer un tour avec le même état donne donc exactement le même résultat,
 * ce qui permet de déboguer et de rejouer une partie (mécaniques, 3.5).
 */
export interface Rng {
  /** Flottant uniforme dans [0, 1). */
  next(): number;
  /** Vrai avec une probabilité exprimée en pourcentage (0 à 100). */
  chance(pourcent: number): boolean;
  /** Entier uniforme dans [min, max] (bornes incluses). */
  entier(min: number, max: number): number;
  /** Un élément au hasard (le tableau ne doit pas être vide). */
  choisir<T>(liste: readonly T[]): T;
  /** Un élément au hasard, pondéré. */
  choisirPondere<T>(liste: readonly T[], poids: (x: T) => number): T | undefined;
  /** Jet d10 × 10 + d10 : un entier dans [0, 99], pour lire les jets comme dans le document. */
  d100(): number;
}

function mulberry32(a: number): () => number {
  let s = a >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hachage FNV-1a 32 bits d'une suite de clés. */
export function hacher(...cles: (string | number)[]): number {
  let h = 0x811c9dc5;
  for (const cle of cles) {
    const s = String(cle);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    h ^= 0x7c; // séparateur
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function creerRng(graine: number, ...sel: (string | number)[]): Rng {
  const next = mulberry32(hacher(graine, ...sel));
  const rng: Rng = {
    next,
    chance: (p) => next() * 100 < p,
    entier: (min, max) => min + Math.floor(next() * (max - min + 1)),
    choisir: (liste) => {
      if (liste.length === 0) throw new Error('choisir() sur une liste vide');
      return liste[Math.floor(next() * liste.length)]!;
    },
    choisirPondere: (liste, poids) => {
      const p = liste.map((x) => Math.max(0, poids(x)));
      const total = p.reduce((a, b) => a + b, 0);
      if (total <= 0) return undefined;
      let r = next() * total;
      for (let i = 0; i < liste.length; i++) {
        r -= p[i]!;
        if (r < 0) return liste[i];
      }
      return liste[liste.length - 1];
    },
    d100: () => Math.floor(next() * 100),
  };
  return rng;
}
