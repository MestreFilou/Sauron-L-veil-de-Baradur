import type { Monde } from './monde';
import { personnage, region } from './monde';
import { borner } from './outils';
import { REGLES } from './regles';
import type {
  EtatJeu,
  EtatPersonnage,
  EtatRegion,
  Evenement,
  IdPersonnage,
  IdRegion,
  StatutRegion,
  TypeEvenement,
} from './types';

/* ------------------------------------------------------------------ */
/* Création                                                            */
/* ------------------------------------------------------------------ */

/** Région de départ d'un personnage : la dernière étape de son itinéraire au tour 1. */
export function regionAuTour(etapes: { tour: number; region: IdRegion }[], tour: number): IdRegion {
  let r = etapes[0]!.region;
  for (const e of etapes) if (e.tour <= tour) r = e.region;
  return r;
}

export function etatInitial(monde: Monde, graine: number): EtatJeu {
  const d = monde.donnees;
  const regions: Record<IdRegion, EtatRegion> = {};
  for (const r of d.regions) {
    regions[r.id] = { id: r.id, terreur: r.terreurInitiale ?? 0, corrompue: false, corruption: null, embuscades: [] };
  }
  const personnages: Record<IdPersonnage, EtatPersonnage> = {};
  for (const p of d.personnages) {
    personnages[p.id] = {
      id: p.id,
      region: regionAuTour(p.itineraire, 1),
      doute: p.douteInitial,
      mefiance: 0,
      relations: { ...p.relations },
      dette: false,
      agent: p.agentInitial ?? false,
      brise: false,
      blessureMorgul: null,
      retard: 0,
      detour: null,
      seuilsDoute: [],
      alerteDonnee: false,
      verites: [],
      veritesAPropager: [],
      silenceJusquA: 0,
      dernierContact: 0,
      sortiDeJeu: false,
    };
  }
  const nazgul: EtatJeu['nazgul'] = {};
  for (const n of d.nazgul) {
    nazgul[n.id] = {
      id: n.id,
      region: n.regionDepart,
      posture: 'traque',
      indisponibleJusquA: (n.disponibleAuTour ?? 1) - 1,
      lameMorgulUtilisee: false,
    };
  }
  const porteur = d.personnages.find((p) => p.porteur)!;
  const connus = d.personnages.filter((p) => p.connuDeSauron).map((p) => p.id);
  return {
    version: 1,
    graine,
    tour: 1,
    phase: 'oeil',
    jauges: {
      visibilite: REGLES.visibilite.depart,
      paliers: [],
      essence: REGLES.essence.depart,
      pa: REGLES.pa.base,
      forme: 0,
      malusPa: 0,
    },
    regions,
    personnages,
    nazgul,
    anneau: { porteur: porteur.id, traces: {}, metCeTour: false, pulsation: null, detections: 0, etape: 'A0', saisi: false },
    connaissance: {
      secrets: [],
      peurs: [],
      destinations: [],
      personnagesConnus: connus,
      positions: {},
      terreurs: {},
      anneau: null,
      sansPorteur: {},
    },
    oeil: null,
    rituel: false,
    murmures: [],
    ordres: [],
    actionVisible: false,
    voixCeTour: [],
    evenements: [],
    journal: [],
    issue: null,
  };
}

/* ------------------------------------------------------------------ */
/* Lecture                                                             */
/* ------------------------------------------------------------------ */

export function statutRegion(r: EtatRegion): StatutRegion {
  if (r.corrompue) return 'corrompue';
  const s = REGLES.terreur.seuils;
  if (r.terreur >= s.ecrasee) return 'ecrasee';
  if (r.terreur >= s.sousOmbre) return 'sous_ombre';
  if (r.terreur >= s.inquiete) return 'inquiete';
  return 'libre';
}

export const estHeros = (monde: Monde, id: IdPersonnage) => {
  const p = personnage(monde, id);
  return p.camp === 'peuples_libres' && (p.role === 'heros' || p.role === 'sage');
};

/** Personnages présents sur la carte dans une région (hors brisés et sortis du jeu). */
export function presents(monde: Monde, etat: EtatJeu, regionId: IdRegion): EtatPersonnage[] {
  return Object.values(etat.personnages).filter(
    (p) => p.region === regionId && !p.sortiDeJeu && !personnage(monde, p.id).horsCarte,
  );
}

export const nazgulDisponibles = (etat: EtatJeu) =>
  Object.values(etat.nazgul).filter((n) => n.indisponibleJusquA < etat.tour);

export const nazgulDans = (etat: EtatJeu, regionId: IdRegion) =>
  nazgulDisponibles(etat).filter((n) => n.region === regionId);

export function paMax(etat: EtatJeu): number {
  return Math.min(REGLES.pa.max, REGLES.pa.base + (REGLES.pa.parForme[etat.jauges.forme] ?? 0));
}

export function plancherVisibilite(etat: EtatJeu): number {
  const haut = Math.max(0, ...etat.jauges.paliers);
  return haut > 0 ? haut - REGLES.visibilite.margePlancher : 0;
}

export const porteur = (etat: EtatJeu) => etat.personnages[etat.anneau.porteur]!;

/* ------------------------------------------------------------------ */
/* Écriture (sur un état déjà cloné)                                   */
/* ------------------------------------------------------------------ */

export function evenement(
  etat: EtatJeu,
  type: TypeEvenement,
  texte: string,
  options: { public?: boolean; donnees?: Record<string, unknown> } = {},
): Evenement {
  const e: Evenement = { type, tour: etat.tour, texte, public: options.public ?? true };
  if (options.donnees) e.donnees = options.donnees;
  etat.evenements.push(e);
  return e;
}

/** Ajoute de la Visibilité. Une hausse de 3 ou plus compte comme une action visible (2.1). */
export function ajouterVisibilite(etat: EtatJeu, delta: number, raison: string): void {
  if (delta === 0) return;
  const avant = etat.jauges.visibilite;
  const min = delta < 0 ? plancherVisibilite(etat) : 0;
  etat.jauges.visibilite = borner(avant + delta, Math.min(min, avant), 100);
  if (delta >= REGLES.visibilite.seuilActionVisible) etat.actionVisible = true;
  evenement(etat, 'seuil', `Visibilité ${delta > 0 ? '+' : ''}${delta} (${raison}).`, {
    public: false,
    donnees: { avant, apres: etat.jauges.visibilite, raison },
  });
}

export function changerTerreur(monde: Monde, etat: EtatJeu, regionId: IdRegion, delta: number): void {
  const r = etat.regions[regionId];
  if (!r) return;
  const plafond = region(monde, regionId).terreurPlafond ?? 100;
  r.terreur = borner(r.terreur + delta, 0, plafond);
}

export function changerDoute(etat: EtatJeu, id: IdPersonnage, delta: number): void {
  const p = etat.personnages[id];
  if (p && !p.sortiDeJeu) p.doute = borner(p.doute + delta, 0, 100);
}

export function changerMefiance(etat: EtatJeu, id: IdPersonnage, delta: number): void {
  const p = etat.personnages[id];
  if (!p) return;
  p.mefiance = borner(p.mefiance + delta, 0, 100);
  if (delta > 0) p.dernierContact = etat.tour;
}

export function ajouterEssence(etat: EtatJeu, delta: number, raison: string): void {
  etat.jauges.essence = Math.max(0, etat.jauges.essence + delta);
  if (delta !== 0) evenement(etat, 'essence', `Essence ${delta > 0 ? '+' : ''}${delta} (${raison}).`, { public: false });
}

/** Retarde tout le groupe d'un personnage (la Communauté avance ensemble). */
export function retarderGroupe(monde: Monde, etat: EtatJeu, id: IdPersonnage, tours: number): void {
  const groupe = personnage(monde, id).groupe;
  for (const p of Object.values(etat.personnages)) {
    if (p.id === id || (groupe && personnage(monde, p.id).groupe === groupe)) p.retard += tours;
  }
}

export function connaitrePosition(etat: EtatJeu, id: IdPersonnage): void {
  const p = etat.personnages[id];
  if (!p) return;
  if (!etat.connaissance.personnagesConnus.includes(id)) etat.connaissance.personnagesConnus.push(id);
  etat.connaissance.positions[id] = { region: p.region, tour: etat.tour };
}

export function connaitreAnneau(etat: EtatJeu, regionId: IdRegion, tour: number, exact: boolean): void {
  const c = etat.connaissance.anneau;
  if (!c || tour > c.tour || (tour === c.tour && exact && !c.exact)) {
    etat.connaissance.anneau = { region: regionId, tour, exact };
  }
}
