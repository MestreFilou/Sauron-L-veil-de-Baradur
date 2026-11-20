/** Quelle réplique dire, selon ce que le joueur vient de faire. Pur, pour les tests. */
import type { RegistreVoix, Replique } from '@sauron/audio';
import { REPLIQUES, repliquePour } from '@sauron/audio';
import type { Ordre } from '@sauron/engine';

/** Le registre de voix qui accompagne un ordre, ou null si l'ordre ne parle pas. */
export function registreDeLOrdre(o: Ordre): RegistreVoix | null {
  if (o.type === 'voix') return o.registre;
  if (o.type === 'nazgul_cri') return 'cri';
  return null;
}

/**
 * Choisit la réplique, en faisant tourner les répliques d'un même registre
 * (le compteur avance à chaque appel). Les répliques pas encore enregistrées
 * sont gardées : leur sous-titre s'affiche, sans voix.
 */
export function choisirReplique(registre: RegistreVoix, compteurs: Map<string, number>, opts: { victoire?: boolean } = {}, banque: Replique[] = REPLIQUES): Replique | undefined {
  let liste = banque;
  let cle: string = registre;
  if (registre === 'duel' && opts.victoire !== undefined) {
    const issue = opts.victoire ? 'victoire' : 'defaite';
    liste = banque.filter((r) => r.registre !== 'duel' || r.id.includes(`_${issue}`));
    cle = `duel_${issue}`;
  }
  const n = compteurs.get(cle) ?? 0;
  compteurs.set(cle, n + 1);
  // Les enregistrées d'abord : tant qu'il en existe une, on n'affiche pas de sous-titre muet.
  return repliquePour(registre, n, {}, liste) ?? repliquePour(registre, n, { memeNonEnregistrees: true }, liste);
}
