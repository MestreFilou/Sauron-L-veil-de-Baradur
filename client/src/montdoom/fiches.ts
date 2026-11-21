/** Textes des ouvrages du Mont Destin. Les chiffres viennent de REGLES.ouvrages. */
import type { IdOuvrage } from '@sauron/engine';
import { REGLES } from '@sauron/engine';

export interface Fiche {
  nom: string;
  lieu: string;
  description: string;
  /** Effet du niveau n (1, 2, 3…), en une ligne. */
  effet: (n: number) => string;
}

const O = REGLES.ouvrages;

export const FICHES: Record<IdOuvrage, Fiche> = {
  forges: {
    nom: 'Forges de l’Orodruin',
    lieu: 'Au pied du cône',
    description: 'Des halles de fer où l’on coule ce que l’Ouest a oublié. Leur tribut monte chaque nuit vers la Tour.',
    effet: (n) => `+${n * O.forges.essenceParNiveau} Essence à chaque nuit`,
  },
  cendres: {
    nom: 'Voile de cendres',
    lieu: 'Les bouches du flanc ouest',
    description: 'Le Mont crache une nuée qui couvre le Mordor. Sous elle, l’Ombre se fait oublier plus vite.',
    effet: (n) => `Visibilité −${n * O.cendres.decroissanceParNiveau} de plus quand l’Ombre se tait`,
  },
  ecuries: {
    nom: 'Écuries noires',
    lieu: 'Sur la chaussée de Barad-dûr',
    description: 'Des stalles pour les chevaux noirs de Minas Morgul. Un Nazgûl démonté retrouve vite une monture.',
    effet: (n) => `Un Nazgûl démonté revient ${n * O.ecuries.retourParNiveau} tours plus tôt`,
  },
  chambre: {
    nom: 'Chambre du Regard',
    lieu: 'Sous les cornes de la Tour',
    description: 'Une salle haute où la volonté du Maître se concentre avant de se poser sur l’Eriador.',
    effet: (n) => `+${n * O.chambre.paParNiveau} PA à chaque aube (8 au plus)`,
  },
};
