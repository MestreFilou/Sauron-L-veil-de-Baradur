import type { Monde } from './monde';
import { aRegle, region, regionsJouables } from './monde';
import type { EtatJeu, IdRegion } from './types';

export interface EstimationPiste {
  /** Probabilité estimée que le porteur soit dans chaque région (somme = 1). */
  probabilites: Record<IdRegion, number>;
  regionProbable: IdRegion;
  /** 0 à 1 : la plus forte probabilité. */
  certitude: number;
  /**
   * Ce que la progression autorise à afficher (6.1) :
   * diffuse (A0), à une région près (A1), exacte (A2 ou position connue ce tour).
   */
  precision: 'diffuse' | 'region_a_1_pres' | 'exacte';
}

/**
 * Carte de chaleur de l'Anneau (2.8), construite UNIQUEMENT à partir de ce que
 * Sauron sait : dernière position connue diffusée par le temps écoulé, murmures
 * pondérés par leur fiabilité ou leur classement, régions vérifiées vides.
 * Le moteur ne triche pas : la vraie position n'entre jamais dans le calcul.
 */
export function estimerPiste(monde: Monde, etat: EtatJeu): EstimationPiste {
  const jouables = regionsJouables(monde).map((r) => r.id);
  let p: Record<IdRegion, number> = Object.fromEntries(jouables.map((id) => [id, 0.02]));
  const c = etat.connaissance.anneau;
  let depuis: number;
  if (c) {
    p[c.region] = (p[c.region] ?? 0) + 4;
    depuis = c.tour;
  } else {
    // A0, le Nom : Gollum a parlé du Comté et de Sacquet.
    for (const id of jouables) if (id.startsWith('comte')) p[id] = 2;
    depuis = 1;
  }
  // Diffusion : chaque jour écoulé, la moitié de la masse peut avoir changé de région.
  const diffuser = (q: Record<IdRegion, number>) => {
    const n: Record<IdRegion, number> = Object.fromEntries(jouables.map((id) => [id, 0]));
    for (const id of jouables) {
      const v = q[id] ?? 0;
      const voisins = region(monde, id).voisins.filter((x) => jouables.includes(x.id));
      n[id] = (n[id] ?? 0) + v * (voisins.length ? 0.5 : 1);
      for (const w of voisins) n[w.id] = (n[w.id] ?? 0) + (v * 0.5) / voisins.length;
    }
    return n;
  };
  for (let t = depuis; t < etat.tour; t++) p = diffuser(p);

  // Murmures récents sur le porteur ou son passage.
  for (const m of etat.murmures) {
    if (m.fait.type !== 'passage_porteur' && !(m.fait.type === 'presence' && m.fait.personnage === etat.anneau.porteur)) continue;
    let poids = m.fiabilite;
    if (m.verifie) poids = m.verite === 'faux' ? 0 : 1.5;
    else if (m.classement === 'vrai') poids = 1.2;
    else if (m.classement === 'faux') poids = 0;
    let bosse: Record<IdRegion, number> = Object.fromEntries(jouables.map((id) => [id, 0]));
    bosse[m.fait.region] = poids * 2;
    for (let t = m.tour; t < etat.tour; t++) bosse = diffuser(bosse);
    for (const id of jouables) p[id] = (p[id] ?? 0) + (bosse[id] ?? 0);
  }
  // Régions vérifiées vides ce tour ou le précédent.
  for (const [id, t] of Object.entries(etat.connaissance.sansPorteur)) {
    if (t >= etat.tour - 1 && p[id] !== undefined && !(c && c.exact && c.tour === etat.tour && c.region === id)) p[id] = p[id]! * (t === etat.tour ? 0.05 : 0.3);
  }
  // Fondcombe est un sanctuaire : l'Œil n'y voit rien, mais on sait qu'on y perd la piste.
  for (const id of jouables) if (aRegle(region(monde, id), 'sanctuaire')) p[id] = (p[id] ?? 0) * 0.5;

  if (c && c.exact && c.tour === etat.tour) p = Object.fromEntries(jouables.map((id) => [id, id === c.region ? 1 : 0]));
  const total = Object.values(p).reduce((a, b) => a + b, 0) || 1;
  for (const id of jouables) p[id] = (p[id] ?? 0) / total;
  const regionProbable = jouables.reduce((a, b) => ((p[b] ?? 0) > (p[a] ?? 0) ? b : a));
  const exacte = Boolean(c && c.exact && c.tour === etat.tour);
  return {
    probabilites: p,
    regionProbable,
    certitude: p[regionProbable] ?? 0,
    precision: exacte ? 'exacte' : etat.anneau.etape === 'A0' ? 'diffuse' : 'region_a_1_pres',
  };
}
