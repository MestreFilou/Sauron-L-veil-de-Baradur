import type { Monde } from './monde';
import { region } from './monde';
import { REGLES } from './regles';
import type { IdRegion } from './types';

/** Distance en nombre de régions (arêtes), sans tenir compte des temps de trajet. */
export function distance(monde: Monde, a: IdRegion, b: IdRegion): number {
  if (a === b) return 0;
  const vus = new Set([a]);
  let front = [a];
  let d = 0;
  while (front.length) {
    d++;
    const suivant: IdRegion[] = [];
    for (const id of front) {
      for (const v of region(monde, id).voisins) {
        if (v.id === b) return d;
        if (!vus.has(v.id)) {
          vus.add(v.id);
          suivant.push(v.id);
        }
      }
    }
    front = suivant;
  }
  return Infinity;
}

/** Régions à `rayon` arêtes ou moins (la région elle-même incluse). */
export function voisinage(monde: Monde, centre: IdRegion, rayon: number): IdRegion[] {
  return monde.donnees.regions.filter((r) => distance(monde, centre, r.id) <= rayon).map((r) => r.id);
}

/** Coût en jours pour un Nazgûl de franchir une arête (le Bac de Bouc lui est fermé). */
export function coutNazgul(monde: Monde, de: IdRegion, vers: IdRegion): number {
  const v = region(monde, de).voisins.find((x) => x.id === vers);
  if (!v) return Infinity;
  return v.joursCheval + (v.obstacle === 'brandevin' ? REGLES.nazgul.detourBrandevin : 0);
}

/** Plus court chemin (Dijkstra sur les jours à cheval). Renvoie la liste des régions, départ inclus. */
export function cheminNazgul(monde: Monde, de: IdRegion, vers: IdRegion): IdRegion[] | null {
  if (de === vers) return [de];
  const dist = new Map<IdRegion, number>([[de, 0]]);
  const prec = new Map<IdRegion, IdRegion>();
  const ouverts = new Set<IdRegion>([de]);
  while (ouverts.size) {
    let courant: IdRegion | null = null;
    for (const id of ouverts) if (courant === null || dist.get(id)! < dist.get(courant)!) courant = id;
    ouverts.delete(courant!);
    if (courant === vers) break;
    for (const v of region(monde, courant!).voisins) {
      const d = dist.get(courant!)! + coutNazgul(monde, courant!, v.id);
      if (d < (dist.get(v.id) ?? Infinity)) {
        dist.set(v.id, d);
        prec.set(v.id, courant!);
        ouverts.add(v.id);
      }
    }
  }
  if (!dist.has(vers)) return null;
  const chemin = [vers];
  while (chemin[0] !== de) chemin.unshift(prec.get(chemin[0]!)!);
  return chemin;
}

/**
 * Avance un Nazgûl vers sa destination dans la limite de son budget de jours.
 * Renvoie les régions effectivement traversées (départ inclus).
 */
export function avancerNazgul(monde: Monde, de: IdRegion, vers: IdRegion, budget: number): IdRegion[] {
  const chemin = cheminNazgul(monde, de, vers);
  if (!chemin) return [de];
  const parcours = [de];
  let reste = budget;
  for (let i = 1; i < chemin.length; i++) {
    const cout = coutNazgul(monde, chemin[i - 1]!, chemin[i]!);
    if (cout > reste) break;
    reste -= cout;
    parcours.push(chemin[i]!);
  }
  return parcours;
}
