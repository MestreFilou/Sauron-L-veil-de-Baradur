/**
 * Effets sonores et fonds d'ambiance (manifeste audio/effets/effets.json).
 * Comme pour les voix et la musique, le code ne lit que le manifeste :
 * changer un son ne demande aucune modification ici.
 */
import effetsJson from '../effets/effets.json';

export type IdEffet =
  | 'ui_survol'
  | 'ui_clic'
  | 'ui_onglet'
  | 'ordre'
  | 'ordre_annule'
  | 'fin_tour'
  | 'regard'
  | 'anneau'
  | 'repousse'
  | 'ombre_entrer'
  | 'ombre_sortir'
  | 'murmure'
  | 'refus'
  | 'rituel'
  | 'duel'
  | 'entree';

/** Le fond d'ambiance suit le mode : la forge de Barad-dûr, ou le vent du Monde de l'Ombre. */
export type Fond = 'oeil' | 'ombre';

export interface Effet {
  /** Relatif au dossier audio/effets/. */
  fichier: string;
  volume_db: number;
  /** Écart de vitesse tiré à chaque lecture (0,05 = ±5 %). */
  variation: number;
  /** Délai minimal entre deux lectures du même effet. */
  intervalle_s: number;
}

export interface SonDeFond {
  fichier: string;
  volume_db: number;
}

export interface ManifesteEffets {
  version: 1;
  effets: Record<IdEffet, Effet>;
  fonds: Record<Fond, SonDeFond>;
}

export const EFFETS = effetsJson as unknown as ManifesteEffets;

/** Vitesse de lecture d'un effet, d'après un tirage entre 0 et 1 (0,5 = vitesse normale). */
export const vitesseEffet = (e: Pick<Effet, 'variation'>, tirage: number) => 1 + e.variation * (2 * Math.min(1, Math.max(0, tirage)) - 1);

/** Contrôle de cohérence du manifeste ; renvoie la liste des problèmes. */
export function verifierEffets(m: ManifesteEffets = EFFETS, existe?: (fichier: string) => boolean): string[] {
  const pb: string[] = [];
  const tous: [string, { fichier: string; volume_db: number }][] = [...Object.entries(m.effets), ...Object.entries(m.fonds).map(([k, v]) => [`fond ${k}`, v] as [string, SonDeFond])];
  for (const [id, e] of tous) {
    if (!e.fichier) pb.push(`${id} : fichier manquant`);
    if (!Number.isFinite(e.volume_db) || e.volume_db > 6) pb.push(`${id} : volume_db hors bornes`);
    if (existe && e.fichier && !existe(e.fichier)) pb.push(`${id} : fichier ${e.fichier} introuvable`);
  }
  for (const [id, e] of Object.entries(m.effets)) {
    if (!(e.variation >= 0 && e.variation < 0.5)) pb.push(`${id} : variation hors bornes`);
    if (!(e.intervalle_s >= 0)) pb.push(`${id} : intervalle négatif`);
  }
  return pb;
}
