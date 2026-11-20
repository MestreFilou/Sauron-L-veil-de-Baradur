/**
 * Quelle ambiance musicale joue, d'après l'état du jeu (mécaniques 10.3 bis).
 * Fonction pure : elle ne lit que ce qu'on lui donne, pour pouvoir être testée.
 */
import type { Ambiance } from '@sauron/audio';
import type { IssueActe, Ordre } from '@sauron/engine';

export interface ContexteAmbiance {
  issue: IssueActe | null;
  /** La fenêtre du duel mental est ouverte. */
  duel: boolean;
  /** Une réplique de la Voix (paranoïa, Annatar, fer) est en train d'être dite. */
  voix: boolean;
  mode: 'oeil' | 'ombre';
  ordres: Ordre[];
}

/** Ordre de priorité : la fin de l'acte, puis le duel, la Voix, la traque, et Barad-dûr par défaut. */
export function ambianceDuJeu(c: ContexteAmbiance): Ambiance {
  if (c.issue) return c.issue === 'victoire_noire' || c.issue === 'victoire_grise' ? 'victoire' : 'defaite';
  if (c.duel) return 'duel';
  if (c.voix) return 'voix';
  if (c.mode === 'ombre' || c.ordres.some((o) => o.type === 'nazgul_traque')) return 'traque';
  return 'barad_dur';
}
