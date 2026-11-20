import { describe, expect, it } from 'vitest';
import type { Action, EtatJeu, Ordre } from '@sauron/engine';
import { appliquer, creerPartie, ErreurRegle, estimerPiste, indexerMonde, regionsJouables, vueJoueur } from '@sauron/engine';
import { eriador, geographieEriador, regionSous } from '../src';

const monde = indexerMonde(eriador);

describe('données de l’Eriador', () => {
  it('compte les 13 régions jouables du document de mécaniques (7.1)', () => {
    expect(regionsJouables(monde).map((r) => r.id).sort()).toEqual(
      ['bree', 'chetwood', 'comte_est', 'comte_ouest', 'fondcombe', 'galgals', 'gue_bruinen', 'montauvent', 'pays_de_bouc', 'route_sarn', 'terres_solitaires', 'trollshaws', 'vieille_foret'].sort(),
    );
  });

  it('donne une géométrie à chaque région jouable, et à elles seules', () => {
    expect(Object.keys(geographieEriador.regions).sort()).toEqual(regionsJouables(monde).map((r) => r.id).sort());
    expect(regionSous(geographieEriador, 790, 450).id).toBe('bree');
    expect(regionSous(geographieEriador, 1445, 412).id).toBe('fondcombe');
  });

  it('reprend les valeurs chiffrées des fiches', () => {
    const p = (id: string) => monde.personnages.get(id)!;
    expect([p('frodon').volonte, p('frodon').douteInitial]).toEqual([55, 15]);
    expect([p('gandalf').volonte, p('elrond').volonte, p('glorfindel').volonte]).toEqual([95, 95, 90]);
    expect(p('bill_fougeron').douteInitial).toBe(60);
    expect(monde.regions.get('pays_de_bouc')!.terreurPlafond).toBe(50);
    expect(monde.regions.get('bree')!.murmuresBonus).toBe(2);
    expect(monde.nazgul.size).toBe(9);
  });

  it('fait arriver le porteur à Fondcombe au tour 30 selon le calendrier canon', () => {
    const frodon = monde.personnages.get('frodon')!;
    expect(frodon.itineraire.at(-1)).toEqual({ tour: 30, region: 'fondcombe' });
    expect(frodon.itineraire.filter((e) => e.metAnneau).map((e) => e.region)).toEqual(['bree', 'montauvent', 'gue_bruinen']);
  });
});

/** Un Sauron simple : il regarde la région la plus probable, et lance les Neuf vers elle. */
function jouerTour(etat: EtatJeu): EtatJeu {
  const piste = estimerPiste(monde, etat);
  let e = appliquer(monde, etat, { type: 'poser_oeil', cible: { type: 'region', id: piste.regionProbable } });
  const tenter = (o: Ordre) => {
    try {
      e = appliquer(monde, e, { type: 'ordonner', ordre: o } as Action);
    } catch (err) {
      if (!(err instanceof ErreurRegle)) throw err;
    }
  };
  const cible = estimerPiste(monde, e).regionProbable;
  for (const n of Object.values(e.nazgul)) {
    if (n.indisponibleJusquA >= e.tour) continue;
    tenter({ type: 'nazgul_deplacer', nazgul: n.id, destination: cible });
    tenter({ type: 'nazgul_traque', nazgul: n.id });
  }
  return appliquer(monde, e, { type: 'fin_des_ordres' });
}

describe('un Acte I complet', () => {
  it('sans intervention, l’Anneau atteint Fondcombe : statu quo', () => {
    let e = creerPartie(monde, 2018);
    while (e.phase !== 'fin') e = appliquer(monde, appliquer(monde, e, { type: 'poser_oeil', cible: { type: 'region', id: 'vieille_foret' } }), { type: 'fin_des_ordres' });
    expect(e.issue).toBe('statu_quo');
    expect(e.tour).toBe(30);
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8])('avec un Sauron chasseur (graine %i), la partie se termine sans erreur', (graine) => {
    let e = creerPartie(monde, graine);
    while (e.phase !== 'fin' && e.tour < 60) e = jouerTour(e);
    expect(e.phase).toBe('fin');
    expect(['victoire_noire', 'victoire_grise', 'statu_quo', 'ouest_s_eveille']).toContain(e.issue);
    const vue = vueJoueur(monde, e);
    expect(vue.issue).toBe(e.issue);
  });
});
