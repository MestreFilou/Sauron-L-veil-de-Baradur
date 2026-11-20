import type { DonneesMonde, IdNazgul, IdPersonnage, IdRegion, NazgulDef, PersonnageDef, RegionDef } from './types';
import { ErreurRegle } from './types';

/** Le monde statique, indexé pour des recherches rapides. Construit une fois par partie. */
export interface Monde {
  donnees: DonneesMonde;
  regions: Map<IdRegion, RegionDef>;
  personnages: Map<IdPersonnage, PersonnageDef>;
  nazgul: Map<IdNazgul, NazgulDef>;
}

export function indexerMonde(donnees: DonneesMonde): Monde {
  const monde: Monde = {
    donnees,
    regions: new Map(donnees.regions.map((r) => [r.id, r])),
    personnages: new Map(donnees.personnages.map((p) => [p.id, p])),
    nazgul: new Map(donnees.nazgul.map((n) => [n.id, n])),
  };
  validerMonde(monde);
  return monde;
}

/** Vérifie la cohérence des données : voisins réciproques, références connues. */
export function validerMonde(monde: Monde): void {
  const erreurs: string[] = [];
  for (const r of monde.donnees.regions) {
    for (const v of r.voisins) {
      const autre = monde.regions.get(v.id);
      if (!autre) erreurs.push(`${r.id} → voisin inconnu ${v.id}`);
      else if (!autre.voisins.some((w) => w.id === r.id)) erreurs.push(`${r.id} ↔ ${v.id} n'est pas réciproque`);
    }
  }
  for (const p of monde.donnees.personnages) {
    for (const e of p.itineraire) if (!monde.regions.has(e.region)) erreurs.push(`${p.id} : région d'itinéraire inconnue ${e.region}`);
    for (const id of Object.keys(p.relations)) if (!monde.personnages.has(id)) erreurs.push(`${p.id} : relation vers inconnu ${id}`);
    if (p.itineraire.length === 0) erreurs.push(`${p.id} : itinéraire vide`);
  }
  for (const n of monde.donnees.nazgul) if (!monde.regions.has(n.regionDepart)) erreurs.push(`${n.id} : région de départ inconnue`);
  if (!monde.donnees.personnages.some((p) => p.porteur)) erreurs.push('aucun porteur de l’Anneau');
  if (erreurs.length) throw new ErreurRegle('Données du monde invalides :\n' + erreurs.join('\n'));
}

export function region(monde: Monde, id: IdRegion): RegionDef {
  const r = monde.regions.get(id);
  if (!r) throw new ErreurRegle(`Région inconnue : ${id}`);
  return r;
}

export function personnage(monde: Monde, id: IdPersonnage): PersonnageDef {
  const p = monde.personnages.get(id);
  if (!p) throw new ErreurRegle(`Personnage inconnu : ${id}`);
  return p;
}

export function nazgulDef(monde: Monde, id: IdNazgul): NazgulDef {
  const n = monde.nazgul.get(id);
  if (!n) throw new ErreurRegle(`Nazgûl inconnu : ${id}`);
  return n;
}

export const aRegle = (r: RegionDef, regle: RegionDef['reglesSpeciales'][number]) => r.reglesSpeciales.includes(regle);

/** Régions jouables (avec une géométrie sur la carte). */
export const regionsJouables = (monde: Monde) => monde.donnees.regions.filter((r) => !r.horsCarte);
