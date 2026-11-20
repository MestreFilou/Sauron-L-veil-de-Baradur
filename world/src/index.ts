import type { DonneesMonde, NazgulDef, PersonnageDef, RegionDef, JalonCanon, IdRegion } from '@sauron/engine';
import regions from '../eriador/regions.json';
import personnages from '../eriador/personnages.json';
import nazgul from '../eriador/nazgul.json';
import calendrier from '../eriador/calendrier.json';
import geographie from '../eriador/geographie.json';

/** Acte I : l'Eriador, du 22 septembre au Gué de Bruinen. */
export const eriador: DonneesMonde = {
  royaume: 'eriador',
  regions: regions as unknown as RegionDef[],
  personnages: personnages as unknown as PersonnageDef[],
  nazgul: nazgul as unknown as NazgulDef[],
  calendrier: calendrier as JalonCanon[],
  regionRetraite: 'mordor',
  regionRetour: 'route_sarn',
  refuge: { region: 'fondcombe', gardien: 'elrond' },
};

export type Point = [number, number];

export interface Geographie {
  largeur: number;
  hauteur: number;
  regions: Record<IdRegion, { centre: Point; rayon: number; description: string }>;
  cote: Point[];
  rivieres: { nom: string; points: Point[]; largeur: [number, number] }[];
  routes: { grandeRouteEst: Point[]; cheminFondcombe: Point[]; cheminVert: Point[] };
}

/** Géométrie de la carte de l'Eriador (pour le client ; le moteur l'ignore). */
export const geographieEriador = geographie as unknown as Geographie;

/** La région la plus proche d'un point de la carte (pour poser le Regard au clic). */
export function regionSous(geo: Geographie, x: number, y: number): { id: IdRegion; distance: number } {
  let best: { id: IdRegion; distance: number } = { id: '', distance: Infinity };
  for (const [id, r] of Object.entries(geo.regions)) {
    const d = Math.hypot(r.centre[0] - x, r.centre[1] - y) / r.rayon;
    if (d < best.distance) best = { id, distance: d };
  }
  return best;
}
