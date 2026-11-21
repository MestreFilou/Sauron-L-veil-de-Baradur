/**
 * Les ouvrages du Mont Destin : la gestion de base de la Tour, entre deux
 * Regards. On les bâtit avec l'Essence (action `batir_ouvrage`) ; leurs effets
 * se branchent sur la boucle de tour (tribut de la nuit, décroissance de la
 * Visibilité, retour des démontés, PA de l'aube). Tous les chiffres sont dans
 * REGLES.ouvrages.
 */
import { REGLES } from './regles';
import type { EtatJeu, IdOuvrage } from './types';

/** Noms des ouvrages, pour les événements du Journal. */
export const NOMS_OUVRAGES: Record<IdOuvrage, string> = {
  forges: 'les Forges de l’Orodruin',
  cendres: 'le Voile de cendres',
  ecuries: 'les Écuries noires',
  chambre: 'la Chambre du Regard',
};

export const OUVRAGES = Object.keys(REGLES.ouvrages) as IdOuvrage[];

export const niveauOuvrage = (etat: EtatJeu, id: IdOuvrage): number => etat.ouvrages?.[id] ?? 0;

export const niveauMaxOuvrage = (id: IdOuvrage): number => REGLES.ouvrages[id].couts.length;

/** Prix du prochain niveau, ou null si l'ouvrage est achevé. */
export function coutOuvrage(etat: EtatJeu, id: IdOuvrage): number | null {
  return REGLES.ouvrages[id].couts[niveauOuvrage(etat, id)] ?? null;
}

/** Un chantier a déjà été lancé ce tour. */
export const chantierCeTour = (etat: EtatJeu): boolean => etat.dernierChantier === etat.tour;

/* Effets, lus par la boucle de tour. */

export const essenceDesForges = (etat: EtatJeu) => niveauOuvrage(etat, 'forges') * REGLES.ouvrages.forges.essenceParNiveau;

export const decroissanceDesCendres = (etat: EtatJeu) => niveauOuvrage(etat, 'cendres') * REGLES.ouvrages.cendres.decroissanceParNiveau;

export const retourDesEcuries = (etat: EtatJeu) => niveauOuvrage(etat, 'ecuries') * REGLES.ouvrages.ecuries.retourParNiveau;

export const paDeLaChambre = (etat: EtatJeu) => niveauOuvrage(etat, 'chambre') * REGLES.ouvrages.chambre.paParNiveau;
