/**
 * Les emplacements de sauvegarde : une sauvegarde automatique, réécrite après
 * chaque geste, et trois emplacements que le joueur remplit lui-même.
 *
 * Chaque fichier est une enveloppe : quelques métadonnées pour le menu (tour,
 * date du jeu, moment de l'enregistrement) et l'état complet, sérialisé par le
 * moteur (`sauvegarder`) et relu par lui (`charger`), qui en vérifie la version.
 *
 * Dans l'application de bureau, ce sont des fichiers JSON dans le dossier de
 * l'utilisateur ; dans un navigateur, des entrées du stockage local.
 */
import type { EtatJeu } from '@sauron/engine';
import { charger, sauvegarder } from '@sauron/engine';
import { bureau, type FichierSauvegarde } from '../plateforme';

export const AUTO = 'auto';
export const EMPLACEMENTS = ['emplacement-1', 'emplacement-2', 'emplacement-3'] as const;
export const TOUS = [AUTO, ...EMPLACEMENTS];

export interface Enveloppe {
  format: 1;
  id: string;
  /** Moment de l'enregistrement, ISO 8601. */
  le: string;
  tour: number;
  /** Date du jeu (« 24 septembre 3018 »), pour le menu. */
  date: string;
  etat: string;
}

export interface Resume {
  id: string;
  le: string;
  tour: number;
  date: string;
  /** L'acte est terminé (la partie ne se continue plus). */
  finie: boolean;
}

export function envelopper(id: string, etat: EtatJeu, date: string, maintenant = new Date()): Enveloppe {
  return { format: 1, id, le: maintenant.toISOString(), tour: etat.tour, date, etat: sauvegarder(etat) };
}

/** Relit une enveloppe ; null si le fichier est illisible ou d'un format inconnu. */
export function lireEnveloppe(texte: string): Enveloppe | null {
  try {
    const o = JSON.parse(texte) as Partial<Enveloppe>;
    if (o?.format !== 1 || typeof o.etat !== 'string' || typeof o.id !== 'string') return null;
    return { format: 1, id: o.id, le: String(o.le ?? ''), tour: Number(o.tour) || 1, date: String(o.date ?? ''), etat: o.etat };
  } catch {
    return null;
  }
}

/** L'état du jeu contenu dans l'enveloppe (lève une ErreurRegle si la version ne va pas). */
export const etatDe = (e: Enveloppe): EtatJeu => charger(e.etat);

export function resumer(e: Enveloppe): Resume {
  let finie = false;
  try {
    finie = Boolean((JSON.parse(e.etat) as { issue?: unknown }).issue);
  } catch {
    /* illisible : le menu proposera quand même de la charger, et le moteur dira non */
  }
  return { id: e.id, le: e.le, tour: e.tour, date: e.date, finie };
}

/** Les plus récentes d'abord. */
export const parDate = (a: Resume, b: Resume) => b.le.localeCompare(a.le);

/* ------------------------------------------------------------------ */
/* Stockage                                                            */
/* ------------------------------------------------------------------ */

interface Stockage {
  lister(): Promise<FichierSauvegarde[]>;
  ecrire(id: string, texte: string): Promise<void>;
  effacer(id: string): Promise<void>;
}

const PREFIXE = 'oeil-de-barad-dur/sauvegarde/';
/** Ancienne clé, d'avant les emplacements : relue comme sauvegarde automatique. */
const ANCIENNE = 'oeil-de-barad-dur/partie';

const navigateur: Stockage = {
  async lister() {
    const r: FichierSauvegarde[] = [];
    try {
      for (const id of TOUS) {
        const t = localStorage.getItem(PREFIXE + id);
        if (t) r.push({ id, texte: t });
      }
      const vieille = localStorage.getItem(ANCIENNE);
      if (vieille && !r.some((f) => f.id === AUTO)) {
        const etat = charger(vieille);
        r.push({ id: AUTO, texte: JSON.stringify(envelopper(AUTO, etat, '', new Date(0))) });
      }
    } catch {
      /* stockage bloqué ou ancienne sauvegarde illisible */
    }
    return r;
  },
  async ecrire(id, texte) {
    localStorage.setItem(PREFIXE + id, texte);
  },
  async effacer(id) {
    localStorage.removeItem(PREFIXE + id);
    if (id === AUTO) localStorage.removeItem(ANCIENNE);
  },
};

const stockage: Stockage = bureau?.sauvegardes ?? navigateur;

export async function listerSauvegardes(): Promise<Map<string, Enveloppe>> {
  const m = new Map<string, Enveloppe>();
  try {
    for (const f of await stockage.lister()) {
      const e = lireEnveloppe(f.texte);
      if (e && TOUS.includes(f.id)) m.set(f.id, { ...e, id: f.id });
    }
  } catch {
    /* rien de lisible */
  }
  return m;
}

/** La sauvegarde la plus récente d'une partie pas encore finie : c'est elle que « Continuer » reprend. */
export function aReprendre(m: Map<string, Enveloppe>): Enveloppe | null {
  const r = [...m.values()].map(resumer).filter((x) => !x.finie).sort(parDate)[0];
  return r ? m.get(r.id)! : null;
}

export async function ecrireSauvegarde(id: string, etat: EtatJeu, date: string): Promise<void> {
  await stockage.ecrire(id, JSON.stringify(envelopper(id, etat, date)));
}

export async function effacerSauvegarde(id: string): Promise<void> {
  await stockage.effacer(id);
}

/**
 * Sauvegarde automatique : une écriture à la fois, et seule la plus récente
 * compte (si le joueur va plus vite que le disque, les états intermédiaires
 * sont sautés).
 */
let enAttente: { etat: EtatJeu; date: string } | null = null;
let enCours: Promise<void> | null = null;

export function sauvegardeAuto(etat: EtatJeu, date: string): Promise<void> {
  enAttente = { etat, date };
  if (!enCours) {
    enCours = (async () => {
      while (enAttente) {
        const { etat: e, date: d } = enAttente;
        enAttente = null;
        try {
          await ecrireSauvegarde(AUTO, e, d);
        } catch {
          /* disque plein ou stockage bloqué : la partie continue sans sauvegarde */
        }
      }
      enCours = null;
    })();
  }
  return enCours;
}

export function nomEmplacement(id: string): string {
  if (id === AUTO) return 'Sauvegarde automatique';
  const n = EMPLACEMENTS.indexOf(id as (typeof EMPLACEMENTS)[number]);
  return n >= 0 ? `Emplacement ${['I', 'II', 'III'][n]}` : id;
}

/** « il y a 5 min », « hier, 21 h 40 », « le 18 nov., 14 h 02 ». */
export function quand(iso: string, maintenant = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getTime() === 0) return 'date inconnue';
  const min = Math.round((maintenant.getTime() - d.getTime()) / 60000);
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const heure = `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`;
  const jour = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const ecart = Math.round((jour(maintenant) - jour(d)) / 86400000);
  if (ecart === 0) return `aujourd’hui, ${heure}`;
  if (ecart === 1) return `hier, ${heure}`;
  return `le ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}, ${heure}`;
}
