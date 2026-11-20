/** Réglages du son, gardés dans le navigateur d'une partie à l'autre. */
import { create } from 'zustand';

export interface ReglagesSon {
  /** Volumes de 0 à 1. */
  general: number;
  musique: number;
  voix: number;
  /** Tout couper d'un coup (touche M). */
  coupe: boolean;
  sousTitres: boolean;
  /** Au survol d'un mot en Noir Parler, sa racine et son sens (10.4). */
  glose: boolean;
}

export const REGLAGES_DEFAUT: ReglagesSon = { general: 0.8, musique: 0.6, voix: 1, coupe: false, sousTitres: true, glose: true };

const CLE = 'oeil-de-barad-dur/son';

const borne = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : d);

/** Relit des réglages enregistrés, en ignorant ce qui est illisible ou hors bornes. */
export function lireReglages(brut: string | null): ReglagesSon {
  let o: Partial<Record<keyof ReglagesSon, unknown>> = {};
  try {
    const p = brut ? JSON.parse(brut) : null;
    if (p && typeof p === 'object') o = p;
  } catch {
    /* réglages illisibles : valeurs par défaut */
  }
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
  const d = REGLAGES_DEFAUT;
  return {
    general: borne(o.general, d.general),
    musique: borne(o.musique, d.musique),
    voix: borne(o.voix, d.voix),
    coupe: bool(o.coupe, d.coupe),
    sousTitres: bool(o.sousTitres, d.sousTitres),
    glose: bool(o.glose, d.glose),
  };
}

/** Gain effectif d'un bus (musique ou voix), coupure comprise. Courbe au carré : plus naturelle à l'oreille qu'un réglage linéaire. */
export function gainBus(r: ReglagesSon, bus: 'musique' | 'voix'): number {
  if (r.coupe) return 0;
  return (r.general * r[bus]) ** 2;
}

function charger(): ReglagesSon {
  try {
    return lireReglages(localStorage.getItem(CLE));
  } catch {
    return { ...REGLAGES_DEFAUT };
  }
}

export const useReglagesSon = create<ReglagesSon & { regler(p: Partial<ReglagesSon>): void }>((set, get) => ({
  ...charger(),
  regler(p) {
    set(p);
    const { regler: _, ...r } = get();
    try {
      localStorage.setItem(CLE, JSON.stringify(r));
    } catch {
      /* stockage indisponible : les réglages valent pour la session */
    }
  },
}));
