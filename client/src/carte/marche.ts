/**
 * Calcul des marches des Neuf pour l'interface : le trajet complet, ce qui en
 * sera parcouru ce soir, et le nombre de nuits jusqu'à l'arrivée. Tout vient
 * des règles du moteur (cheminNazgul, avancerNazgul) : la carte ne fait que
 * le montrer, elle ne décide rien.
 */
import type { Monde, VueJoueur } from '@sauron/engine';
import { avancerNazgul, cheminNazgul, REGLES, region } from '@sauron/engine';

type VueNazgul = VueJoueur['nazgul'][number];

export interface Trajet {
  /** Régions du départ à l'arrivée, départ inclus. */
  chemin: string[];
  /** Index dans `chemin` de la dernière région atteinte ce soir. */
  ceSoir: number;
  /** Nombre de nuits de marche jusqu'à l'arrivée (Infinity si jamais). */
  nuits: number;
  /** Jours de route au total. */
  jours: number;
  /** Le chemin passe le gué du Bruinen, où la crue peut emporter le cavalier. */
  bruinen: boolean;
}

export function vitesseNazgul(monde: Monde, n: Pick<VueNazgul, 'id' | 'posture'>): number {
  return n.posture === 'ombre_ailee' ? REGLES.nazgul.vitesseOmbreAilee : (monde.nazgul.get(n.id)?.vitesse ?? REGLES.nazgul.vitesseTraque);
}

export function trajet(monde: Monde, n: Pick<VueNazgul, 'id' | 'posture' | 'region'>, destination: string): Trajet | null {
  const chemin = cheminNazgul(monde, n.region, destination);
  if (!chemin) return null;
  const v = vitesseNazgul(monde, n);
  const ceSoir = avancerNazgul(monde, n.region, destination, v).length - 1;
  // Nuits suivantes : le moteur repart chaque soir avec un budget neuf.
  let nuits = chemin.length > 1 ? 1 : 0;
  let ici = chemin[ceSoir]!;
  while (ici !== destination && nuits < 40) {
    const pas = avancerNazgul(monde, ici, destination, v);
    if (pas.length < 2) {
      nuits = Infinity;
      break;
    }
    ici = pas.at(-1)!;
    nuits++;
  }
  let jours = 0;
  let bruinen = false;
  for (let i = 1; i < chemin.length; i++) {
    const arete = region(monde, chemin[i - 1]!).voisins.find((x) => x.id === chemin[i]);
    jours += (arete?.joursCheval ?? 0) + (arete?.obstacle === 'brandevin' ? REGLES.nazgul.detourBrandevin : 0);
    if (arete?.obstacle === 'bruinen') bruinen = true;
  }
  return { chemin, ceSoir, nuits, jours, bruinen };
}

/** Régions que ce Nazgûl peut atteindre dès ce soir (sa région exclue). */
export function atteignablesCeSoir(monde: Monde, n: Pick<VueNazgul, 'id' | 'posture' | 'region'>, regions: string[]): Set<string> {
  const v = vitesseNazgul(monde, n);
  const ok = new Set<string>();
  for (const id of regions) {
    if (id === n.region) continue;
    const pas = avancerNazgul(monde, n.region, id, v);
    if (pas.at(-1) === id) ok.add(id);
  }
  return ok;
}

/** Libellé court d'une marche, pour l'aperçu sur la carte. */
export function libelleTrajet(t: Trajet, nomArrivee: string): string {
  const base = t.nuits <= 1 ? `${nomArrivee} · ce soir` : t.nuits === Infinity ? `${nomArrivee} · hors d'atteinte` : `${nomArrivee} · ${t.nuits} nuits`;
  return `${base} (${t.jours} j de route)${t.bruinen ? ' · gué du Bruinen' : ''}`;
}
