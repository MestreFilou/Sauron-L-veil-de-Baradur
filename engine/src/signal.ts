import { distance } from './carte';
import { nazgulDisponibles } from './etat';
import type { Monde } from './monde';
import { REGLES } from './regles';
import type { EtatJeu, IdNazgul } from './types';

/**
 * Perte de signal (5.1) : un Nazgûl à plus de 3 régions de tout autre Nazgûl
 * voit ses rapports passer à 60 % de vrai et ne reçoit les ordres qu'un tour sur deux.
 */
export function estIsole(monde: Monde, etat: EtatJeu, id: IdNazgul): boolean {
  const moi = etat.nazgul[id];
  if (!moi) return false;
  const autres = nazgulDisponibles(etat).filter((n) => n.id !== id);
  if (autres.length === 0) return true;
  return autres.every((n) => distance(monde, moi.region, n.region) > REGLES.nazgul.signal.distance);
}

/** Force du signal de 1 à 4, pour l'interface (les quatre barres des Neuf). */
export function forceSignal(monde: Monde, etat: EtatJeu, id: IdNazgul): number {
  const moi = etat.nazgul[id];
  if (!moi || moi.indisponibleJusquA >= etat.tour) return 0;
  const autres = nazgulDisponibles(etat).filter((n) => n.id !== id);
  if (!autres.length) return 1;
  const d = Math.min(...autres.map((n) => distance(monde, moi.region, n.region)));
  return d <= 1 ? 4 : d <= 2 ? 3 : d <= REGLES.nazgul.signal.distance ? 2 : 1;
}

/** Un Nazgûl isolé n'entend la Tour qu'un tour sur deux (les tours pairs). */
export const recoitOrdres = (monde: Monde, etat: EtatJeu, id: IdNazgul) => !estIsole(monde, etat, id) || etat.tour % 2 === 0;
