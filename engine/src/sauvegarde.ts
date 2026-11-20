import type { EtatJeu } from './types';
import { ErreurRegle } from './types';

/** Sérialise l'état complet (phase 6, étape 4). Le monde statique n'y est pas : il se recharge depuis world/. */
export function sauvegarder(etat: EtatJeu): string {
  return JSON.stringify(etat);
}

export function charger(json: string): EtatJeu {
  const etat = JSON.parse(json) as EtatJeu;
  if (etat.version !== 1) throw new ErreurRegle(`Version de sauvegarde inconnue : ${String(etat.version)}`);
  return etat;
}
