import { describe, expect, it } from 'vitest';
import { appliquer, charger, creerPartie, ErreurRegle, indexerMonde, paRestants, REGLES, rejouer, sauvegarder, vueJoueur } from '../src';
import type { Action, DonneesMonde, EtatJeu, Ordre } from '../src';
import { donneesTest } from './fixture';

/** Le monde de test, avec un homme du commun de plus au Carrefour (là où se tient le Roi). */
const donnees: DonneesMonde = {
  ...donneesTest,
  personnages: [
    ...donneesTest.personnages,
    {
      id: 'paysan',
      nom: 'Le Paysan',
      camp: 'peuples_libres',
      role: 'pnj',
      volonte: 40,
      douteInitial: 10,
      traits: ['peureux'],
      peur: 'les loups',
      destination: 'rentrer chez lui',
      secrets: [{ id: 'sec_paysan', type: 'objet', texte: 'il cache un sac de pièces' }],
      relations: {},
      itineraire: [{ tour: 1, region: 'carrefour' }],
      connuDeSauron: true,
    },
  ],
};
const monde = indexerMonde(donnees);

const oeil = (id = 'ouest'): Action => ({ type: 'poser_oeil', cible: { type: 'region', id } });
const ordre = (o: Ordre): Action => ({ type: 'ordonner', ordre: o });
const fin: Action = { type: 'fin_des_ordres' };
const partie = (graine = 7) => creerPartie(monde, graine);
const auxOrdres = (e: EtatJeu = partie()) => appliquer(monde, e, oeil());

describe('affectations des Neuf', () => {
  it('« battre la campagne » pré-remplit une traque à chaque tour', () => {
    let e = appliquer(monde, partie(), { type: 'affecter', nazgul: 'roi', affectation: { type: 'battre_campagne' } });
    e = auxOrdres(e);
    expect(e.ordres).toContainEqual({ type: 'nazgul_traque', nazgul: 'roi' });
    e = rejouer(monde, e, [fin, oeil()]);
    expect(e.ordres).toContainEqual({ type: 'nazgul_traque', nazgul: 'roi' });
    // L'ordre pré-rempli s'annule comme un autre.
    e = appliquer(monde, e, { type: 'annuler_ordre', index: e.ordres.findIndex((o) => o.type === 'nazgul_traque') });
    expect(e.ordres.some((o) => o.type === 'nazgul_traque')).toBe(false);
  });

  it('prend effet tout de suite pendant les ordres, si le Nazgûl n’a rien reçu', () => {
    const e = appliquer(monde, auxOrdres(), { type: 'affecter', nazgul: 'khamul', affectation: { type: 'semer_effroi', region: 'est' } });
    expect(e.ordres).toContainEqual({ type: 'nazgul_cri', nazgul: 'khamul' });
  });

  it('« tenir un passage » fait marcher puis se tapir, sans reposer une embuscade encore active', () => {
    let e = appliquer(monde, partie(), { type: 'affecter', nazgul: 'khamul', affectation: { type: 'tenir_passage', region: 'ouest' } });
    e = auxOrdres(e);
    expect(e.ordres).toContainEqual({ type: 'nazgul_deplacer', nazgul: 'khamul', destination: 'ouest' });
    expect(e.ordres.some((o) => o.type === 'nazgul_embuscade')).toBe(false);
    e = rejouer(monde, e, [fin, oeil()]);
    expect(e.nazgul['khamul']!.region).toBe('ouest');
    expect(e.ordres).toContainEqual({ type: 'nazgul_embuscade', nazgul: 'khamul' });
  });

  it('respecte les PA : ce qui ne passe pas la validation est ignoré', () => {
    let e = partie();
    e = { ...e, jauges: { ...e.jauges, pa: 1 } };
    for (const id of ['roi', 'khamul']) e = appliquer(monde, e, { type: 'affecter', nazgul: id, affectation: { type: 'battre_campagne' } });
    e = auxOrdres(e);
    expect(e.ordres.filter((o) => o.type === 'nazgul_traque')).toHaveLength(1);
    expect(paRestants(e)).toBe(0);
  });

  it('se retire avec null', () => {
    let e = appliquer(monde, partie(), { type: 'affecter', nazgul: 'roi', affectation: { type: 'battre_campagne' } });
    e = appliquer(monde, e, { type: 'affecter', nazgul: 'roi', affectation: null });
    e = auxOrdres(e);
    expect(e.ordres).toEqual([]);
  });

  it('refuse une région hors carte', () => {
    expect(() => appliquer(monde, partie(), { type: 'affecter', nazgul: 'roi', affectation: { type: 'tenir_passage', region: 'mordor' } })).toThrow(ErreurRegle);
  });

  it('apparaît dans la vue du joueur', () => {
    const e = appliquer(monde, partie(), { type: 'affecter', nazgul: 'roi', affectation: { type: 'suivre_piste' } });
    const n = vueJoueur(monde, e).nazgul.find((x) => x.id === 'roi')!;
    expect(n.mission?.libelle).toBe('Suivre la piste');
    expect(n.mission?.region).toBeTruthy();
  });
});

describe('cachots', () => {
  const capturer: Ordre = { type: 'nazgul_capturer', nazgul: 'roi', pnj: 'paysan' };

  it('un Nazgûl enlève un homme du commun : il quitte la carte et entre aux cachots', () => {
    const avant = auxOrdres();
    const e = appliquer(monde, avant, ordre(capturer));
    expect(paRestants(e)).toBe(paRestants(avant) - REGLES.cachots.capture.pa);
    const apres = appliquer(monde, e, fin);
    expect(apres.captifs).toHaveLength(1);
    expect(apres.captifs![0]).toMatchObject({ personnage: 'paysan', origine: 'carrefour', par: 'roi', plie: false });
    expect(apres.personnages['paysan']!.sortiDeJeu).toBe(true);
    expect(vueJoueur(monde, apres).captifs[0]!.aLivrer).toBe(true);
  });

  it('refuse les héros et les Sages, et ceux qui ne sont pas là', () => {
    const e = auxOrdres();
    expect(() => appliquer(monde, e, ordre({ type: 'nazgul_capturer', nazgul: 'roi', pnj: 'fier' }))).toThrow(/gens du commun/);
    expect(() => appliquer(monde, e, ordre({ type: 'nazgul_capturer', nazgul: 'khamul', pnj: 'paysan' }))).toThrow(/n’est pas là/);
  });

  it('interroger arrache la peur, puis l’intention, puis les secrets', () => {
    let e = rejouer(monde, auxOrdres(), [ordre(capturer), fin, oeil()]);
    const interroger = ordre({ type: 'cachot', geste: 'interroger', pnj: 'paysan' });
    e = rejouer(monde, e, [interroger, fin, oeil()]);
    expect(e.connaissance.peurs).toContain('paysan');
    e = rejouer(monde, e, [interroger, fin, oeil()]);
    expect(e.connaissance.destinations).toContain('paysan');
    e = rejouer(monde, e, [interroger, fin, oeil()]);
    expect(e.connaissance.secrets.map((s) => s.id)).toContain('sec_paysan');
    expect(vueJoueur(monde, e).captifs[0]!.aLivrer).toBe(false);
  });

  it('on ne touche pas un prisonnier le soir même de sa capture', () => {
    const e = appliquer(monde, auxOrdres(), ordre(capturer));
    // La capture se résout au crépuscule : il n'est pas encore aux cachots.
    expect(() => appliquer(monde, e, ordre({ type: 'cachot', geste: 'interroger', pnj: 'paysan' }))).toThrow(/pas aux cachots/);
  });

  it('tourmenté, il plie ; relâché, il devient un agent chez lui', () => {
    let e = rejouer(monde, auxOrdres(), [ordre(capturer), fin, oeil()]);
    const tourmenter = ordre({ type: 'cachot', geste: 'tourmenter', pnj: 'paysan' });
    e = rejouer(monde, e, [tourmenter, fin, oeil()]);
    e = rejouer(monde, e, [tourmenter, fin, oeil()]);
    expect(e.captifs![0]!.plie).toBe(true);
    e = rejouer(monde, e, [ordre({ type: 'cachot', geste: 'relacher', pnj: 'paysan' }), fin]);
    expect(e.captifs).toEqual([]);
    expect(e.personnages['paysan']).toMatchObject({ agent: true, sortiDeJeu: false, region: 'carrefour' });
  });

  it('relâché sans avoir plié, il sème la peur et la méfiance', () => {
    let e = rejouer(monde, auxOrdres(), [ordre(capturer), fin, oeil()]);
    const t = e.regions['carrefour']!.terreur;
    e = rejouer(monde, e, [ordre({ type: 'cachot', geste: 'relacher', pnj: 'paysan' }), fin]);
    expect(e.personnages['paysan']!.agent).toBe(false);
    expect(e.regions['carrefour']!.terreur).toBeGreaterThan(t - REGLES.terreur.decroissanceSansNazgul);
  });

  it('exécuté, il sort du jeu pour de bon et rapporte de l’Essence', () => {
    let e = rejouer(monde, auxOrdres(), [ordre(capturer), fin, oeil()]);
    const essence = e.jauges.essence;
    e = appliquer(monde, e, ordre({ type: 'cachot', geste: 'executer', pnj: 'paysan' }));
    e = appliquer(monde, e, fin);
    expect(e.captifs).toEqual([]);
    expect(e.personnages['paysan']!.sortiDeJeu).toBe(true);
    expect(e.jauges.essence).toBeGreaterThan(essence);
  });

  it('survit à la sauvegarde', () => {
    const e = rejouer(monde, auxOrdres(), [ordre(capturer), fin]);
    expect(charger(sauvegarder(e)).captifs).toEqual(e.captifs);
  });
});

describe('décisions de la Tour', () => {
  it('montre les conditions, remplies ou non', () => {
    const d = vueJoueur(monde, auxOrdres()).decisions;
    const ailees = d.find((x) => x.id === 'montures_ailees')!;
    expect(ailees.disponible).toBe(false);
    expect(ailees.conditions.some((c) => !c.remplie)).toBe(true);
    // Au tour 1, le Tardif n'est pas encore arrivé : on peut presser les Neuf.
    expect(d.find((x) => x.id === 'presser_les_neuf')!.disponible).toBe(true);
  });

  it('« Presser les Neuf » fait revenir plus tôt ceux qui sont loin, puis se recharge', () => {
    let e = appliquer(monde, auxOrdres(), ordre({ type: 'decision', decision: 'presser_les_neuf' }));
    expect(() => appliquer(monde, e, ordre({ type: 'decision', decision: 'presser_les_neuf' }))).toThrow(/déjà décidé/);
    e = appliquer(monde, e, fin);
    // Il devait revenir au tour 3 : il revient à l'aube du tour 2.
    expect(e.nazgul['tard']!.indisponibleJusquA).toBe(1);
    expect(e.evenements.some((x) => x.texte.includes('rejoint la chasse'))).toBe(true);
    expect(e.decisions?.presser_les_neuf).toBe(1);
    e = appliquer(monde, e, oeil());
    expect(() => appliquer(monde, e, ordre({ type: 'decision', decision: 'presser_les_neuf' }))).toThrow(/pas avant le tour/);
  });

  it('refuse une décision dont une condition manque', () => {
    expect(() => appliquer(monde, auxOrdres(), ordre({ type: 'decision', decision: 'silence_de_la_tour' }))).toThrow(/visibilité/);
    expect(() => appliquer(monde, auxOrdres(), ordre({ type: 'decision', decision: 'montures_ailees' }))).toThrow(/acte II/);
  });

  it('« Les crébains de Dun » révèlent la Terreur des régions visibles', () => {
    const e = rejouer(monde, auxOrdres(), [ordre({ type: 'decision', decision: 'crebains_de_dun' }), fin]);
    expect(e.connaissance.terreurs['colline']).toBeDefined();
    expect(e.connaissance.terreurs['foret']).toBeUndefined();
    expect(e.connaissance.terreurs['sanctuaire']).toBeUndefined();
  });

  it('« Le Silence de la Tour » baisse la Visibilité et coûte des PA au tour suivant', () => {
    let e = auxOrdres();
    e = { ...e, jauges: { ...e.jauges, visibilite: 30 } };
    e = rejouer(monde, e, [ordre({ type: 'decision', decision: 'silence_de_la_tour' }), fin]);
    expect(e.jauges.visibilite).toBeLessThan(30);
    expect(e.jauges.pa).toBe(REGLES.pa.base - REGLES.decisions.silence_de_la_tour.malusPa);
  });
});
