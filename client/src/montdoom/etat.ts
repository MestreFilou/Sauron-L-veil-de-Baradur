/** État de l'écran du Mont Destin (purement interface : le moteur n'en sait rien). */
import type { IdOuvrage } from '@sauron/engine';
import { create } from 'zustand';

interface EtatMontDoom {
  ouvert: boolean;
  salle: string;
  ouvrageChoisi: IdOuvrage | null;
  ouvrageSurvole: IdOuvrage | null;
  /** Dernier chantier achevé (pour la gerbe de feu de la scène). */
  chantier: { id: IdOuvrage; n: number } | null;
  ouvrir(): void;
  fermer(): void;
  choisirSalle(id: string): void;
  choisirOuvrage(id: IdOuvrage | null): void;
  survolerOuvrage(id: IdOuvrage | null): void;
  feter(id: IdOuvrage): void;
}

export const useMontDoom = create<EtatMontDoom>((set) => ({
  ouvert: false,
  salle: 'ouvrages',
  ouvrageChoisi: null,
  ouvrageSurvole: null,
  chantier: null,
  ouvrir: () => set({ ouvert: true }),
  fermer: () => set({ ouvert: false, ouvrageSurvole: null }),
  choisirSalle: (salle) => set({ salle }),
  choisirOuvrage: (ouvrageChoisi) => set({ ouvrageChoisi, salle: 'ouvrages' }),
  survolerOuvrage: (ouvrageSurvole) => set({ ouvrageSurvole }),
  feter: (id) => set((s) => ({ chantier: { id, n: (s.chantier?.n ?? 0) + 1 } })),
}));
