import { describe, expect, it } from 'vitest';
import { appliquer, charger, creerPartie, ErreurRegle, paMax, REGLES, rejouer, sauvegarder, vueJoueur } from '../src';
import type { Action, EtatJeu, IdOuvrage } from '../src';
import { demonter } from '../src/nazgul';
import { mondeTest as monde } from './fixture';

const batir = (ouvrage: IdOuvrage): Action => ({ type: 'batir_ouvrage', ouvrage });
const oeil: Action = { type: 'poser_oeil', cible: { type: 'region', id: 'ouest' } };
const fin: Action = { type: 'fin_des_ordres' };
const riche = (essence = 60): EtatJeu => {
  const e = creerPartie(monde, 7);
  e.jauges.essence = essence;
  return e;
};

describe('ouvrages du Mont Destin', () => {
  it('coûte l’Essence et monte d’un niveau, un seul chantier par tour', () => {
    const e = appliquer(monde, riche(10), batir('forges'));
    expect(e.ouvrages?.forges).toBe(1);
    expect(e.jauges.essence).toBe(10 - REGLES.ouvrages.forges.couts[0]);
    expect(e.evenements.some((x) => x.type === 'ouvrage')).toBe(true);
    expect(() => appliquer(monde, e, batir('cendres'))).toThrow(ErreurRegle);
    const v = vueJoueur(monde, e);
    expect(v.ouvrages.forges).toBe(1);
    expect(v.chantierCeTour).toBe(true);
  });

  it('refuse un chantier sans assez d’Essence, ou un ouvrage achevé', () => {
    expect(() => appliquer(monde, riche(1), batir('chambre'))).toThrow(/Essence/);
    let e = riche();
    e.ouvrages = { chambre: 1 };
    expect(() => appliquer(monde, e, batir('chambre'))).toThrow(/achevé/);
  });

  it('ne dépense pas l’Essence réservée par les ordres', () => {
    let e = rejouer(monde, riche(REGLES.corruption.essence + 3), [oeil, { type: 'ordonner', ordre: { type: 'corruption', region: 'est' } }]);
    expect(() => appliquer(monde, e, batir('forges'))).toThrow(/il en reste 3/);
  });

  it('les Forges ajoutent de l’Essence à chaque nuit', () => {
    const sans = rejouer(monde, riche(20), [oeil, fin]);
    const avec = rejouer(monde, riche(20), [batir('forges'), oeil, fin]);
    expect(avec.jauges.essence - (sans.jauges.essence - REGLES.ouvrages.forges.couts[0])).toBe(REGLES.ouvrages.forges.essenceParNiveau);
  });

  it('la Chambre du Regard donne un PA de plus, dans la limite du maximum', () => {
    const e = riche();
    const base = paMax(e);
    e.ouvrages = { chambre: 1 };
    expect(paMax(e)).toBe(Math.min(REGLES.pa.max, base + 1));
    const suivant = rejouer(monde, e, [oeil, fin]);
    expect(suivant.jauges.pa).toBe(Math.min(REGLES.pa.max, base + 1));
  });

  it('les Écuries noires raccourcissent le retour d’un Nazgûl démonté', () => {
    const e = riche();
    const id = Object.keys(e.nazgul)[0]!;
    e.ouvrages = { ecuries: 2 };
    demonter(monde, e, id, 'test');
    expect(e.nazgul[id]!.indisponibleJusquA).toBe(e.tour + REGLES.nazgul.demonte.duree - 2 * REGLES.ouvrages.ecuries.retourParNiveau);
  });

  it('le Voile de cendres accélère la décroissance de la Visibilité', () => {
    const depart = riche();
    depart.jauges.visibilite = 30;
    const voile = structuredClone(depart);
    voile.ouvrages = { cendres: 2 };
    const a = rejouer(monde, depart, [oeil, fin]);
    const b = rejouer(monde, voile, [oeil, fin]);
    expect(a.jauges.visibilite - b.jauges.visibilite).toBe(2 * REGLES.ouvrages.cendres.decroissanceParNiveau);
  });

  it('se sauvegarde, et une ancienne sauvegarde sans ouvrages reste jouable', () => {
    const e = appliquer(monde, riche(), batir('ecuries'));
    expect(charger(sauvegarder(e)).ouvrages?.ecuries).toBe(1);
    const ancienne = riche();
    delete ancienne.ouvrages;
    const repris = charger(sauvegarder(ancienne));
    expect(vueJoueur(monde, repris).ouvrages.forges).toBe(0);
    expect(appliquer(monde, repris, batir('forges')).ouvrages?.forges).toBe(1);
  });
});
