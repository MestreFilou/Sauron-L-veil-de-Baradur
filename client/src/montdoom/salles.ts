/**
 * Les salles de l'écran de gestion. L'écran du Mont Destin est un cadre : la
 * scène 3D au fond, un panneau à droite qui affiche la salle choisie dans le
 * bandeau de gauche. Pour ajouter un menu (geôles, affectation des Nazgûl,
 * décisions…), on ajoute une entrée ici avec son `Panneau` ; sans `Panneau`,
 * la salle apparaît scellée (« à venir »).
 */
import type { ComponentType } from 'react';
import { PanneauOuvrages } from './Ouvrages';

export interface Salle {
  id: string;
  nom: string;
  /** Une ligne sous le nom, dans le bandeau. */
  sousTitre: string;
  /** Glyphe affiché dans le bandeau (un caractère). */
  glyphe: string;
  Panneau?: ComponentType;
}

export const SALLES: Salle[] = [
  { id: 'ouvrages', nom: 'Les Ouvrages', sousTitre: 'Forges et chantiers de l’Orodruin', glyphe: 'ᚦ', Panneau: PanneauOuvrages },
  { id: 'neuf', nom: 'Les Neuf', sousTitre: 'Affectations et montures', glyphe: 'ᚾ' },
  { id: 'geoles', nom: 'Les Geôles', sousTitre: 'Captifs et interrogatoires', glyphe: 'ᛉ' },
  { id: 'decisions', nom: 'Les Décisions', sousTitre: 'Desseins de la Tour', glyphe: 'ᛞ' },
];
