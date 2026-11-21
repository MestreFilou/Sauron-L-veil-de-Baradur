import type { Replique } from '@sauron/audio';
import { REPLIQUES } from '@sauron/audio';
import { describe, expect, it } from 'vitest';
import { ambianceDuJeu, type ContexteAmbiance } from '../src/son/ambiance';
import { effetsDuChangement, type Instantane } from '../src/son/effets';
import { indexer } from '../src/son/fichiers';
import { gainBus, lireReglages, REGLAGES_DEFAUT } from '../src/son/reglages';
import { choisirReplique, registreDeLOrdre } from '../src/son/repliques';

const base: ContexteAmbiance = { issue: null, duel: false, voix: false, mode: 'oeil', ordres: [] };

describe('ambiance musicale', () => {
  it('Barad-dûr par défaut, la traque dans le Monde de l’Ombre ou quand un Nazgûl traque', () => {
    expect(ambianceDuJeu(base)).toBe('barad_dur');
    expect(ambianceDuJeu({ ...base, mode: 'ombre' })).toBe('traque');
    expect(ambianceDuJeu({ ...base, ordres: [{ type: 'nazgul_traque', nazgul: 'khamul' }] })).toBe('traque');
    expect(ambianceDuJeu({ ...base, ordres: [{ type: 'nazgul_cri', nazgul: 'khamul' }] })).toBe('barad_dur');
  });

  it('la fin l’emporte sur le duel, le duel sur la Voix, la Voix sur la traque', () => {
    expect(ambianceDuJeu({ ...base, voix: true, mode: 'ombre' })).toBe('voix');
    expect(ambianceDuJeu({ ...base, duel: true, voix: true })).toBe('duel');
    expect(ambianceDuJeu({ ...base, issue: 'victoire_noire', duel: true })).toBe('victoire');
    expect(ambianceDuJeu({ ...base, issue: 'victoire_grise' })).toBe('victoire');
    expect(ambianceDuJeu({ ...base, issue: 'statu_quo' })).toBe('defaite');
    expect(ambianceDuJeu({ ...base, issue: 'ouest_s_eveille' })).toBe('defaite');
  });
});

describe('réglages du son', () => {
  it('relit des réglages abîmés sans planter', () => {
    expect(lireReglages(null)).toEqual(REGLAGES_DEFAUT);
    expect(lireReglages('pas du json')).toEqual(REGLAGES_DEFAUT);
    expect(lireReglages('{"musique":3,"voix":-1,"general":"fort","coupe":true}')).toEqual({ ...REGLAGES_DEFAUT, musique: 1, voix: 0, coupe: true });
  });

  it('couper met tout à zéro, le volume suit une courbe au carré', () => {
    expect(gainBus({ ...REGLAGES_DEFAUT, coupe: true }, 'musique')).toBe(0);
    expect(gainBus({ ...REGLAGES_DEFAUT, general: 1, voix: 0.5 }, 'voix')).toBeCloseTo(0.25);
    expect(gainBus({ ...REGLAGES_DEFAUT, general: 0 }, 'voix')).toBe(0);
  });
});

describe('répliques déclenchées', () => {
  it('la Voix et le cri parlent, les autres ordres non', () => {
    expect(registreDeLOrdre({ type: 'voix', cible: 'bill_fougeron', registre: 'annatar' })).toBe('annatar');
    expect(registreDeLOrdre({ type: 'nazgul_cri', nazgul: 'khamul' })).toBe('cri');
    expect(registreDeLOrdre({ type: 'corruption', region: 'bree' })).toBeNull();
  });

  it('fait tourner les répliques d’un registre', () => {
    const c = new Map<string, number>();
    const toutes = REPLIQUES.filter((r) => r.registre === 'paranoia').map((r) => r.id);
    const ids = toutes.map(() => choisirReplique('paranoia', c)?.id);
    expect(new Set(ids)).toEqual(new Set(toutes));
  });

  it('choisit la réplique du duel selon l’issue', () => {
    const c = new Map<string, number>();
    expect(choisirReplique('duel', c, { victoire: true })?.id).toContain('victoire');
    expect(choisirReplique('duel', c, { victoire: false })?.id).toContain('defaite');
  });

  it('préfère une réplique enregistrée à une réplique à enregistrer', () => {
    const banque: Replique[] = REPLIQUES.filter((r) => r.registre === 'fer').map((r, i) => ({ ...r, statut: i === 1 ? 'enregistre' : 'a_enregistrer', duree_s: 2 }));
    const c = new Map<string, number>();
    expect([0, 1, 2].map(() => choisirReplique('fer', c, {}, banque)?.statut)).toEqual(['enregistre', 'enregistre', 'enregistre']);
  });

  it('un registre vide ne renvoie rien', () => {
    expect(choisirReplique('cri', new Map(), {}, [])).toBeUndefined();
  });
});

describe('fichiers présents', () => {
  it('indexe les URL par chemin relatif, comme dans les manifestes', () => {
    const m = indexer({ '../../../audio/musique/barad_dur/oeil.mp3': '/x.mp3' }, '/audio/musique/');
    expect(m.get('barad_dur/oeil.mp3')).toBe('/x.mp3');
    expect(indexer({ '../../../audio/voix/fer_01.mp3': '/v.mp3' }, '/audio/').get('voix/fer_01.mp3')).toBe('/v.mp3');
  });
});

describe('effets sonores', () => {
  const etat = { tour: 3, ordres: [], oeil: null, rituel: false, murmures: [{ id: 'm1', classement: null }], issue: null } as unknown as Instantane['etat'];
  const base: Instantane = { etat, mode: 'oeil', duel: null, introVue: true, toast: null };
  const ids = (a: Instantane, b: Instantane) => effetsDuChangement(a, b).map((e) => e.id);

  it('rien ne change, rien ne sonne', () => {
    expect(ids(base, { ...base })).toEqual([]);
  });

  it('entrée, fin de tour, mais pas de cloche pour une nouvelle partie', () => {
    expect(ids({ ...base, introVue: false }, base)).toEqual(['entree']);
    expect(ids(base, { ...base, etat: { ...etat, tour: 4 } })).toEqual(['fin_tour']);
    expect(ids(base, { ...base, etat: { ...etat, tour: 1 } })).toEqual([]);
  });

  it('un ordre donné ou annulé', () => {
    const o = { ...base, etat: { ...etat, ordres: [{ type: 'nazgul_cri', nazgul: 'khamul' }] } } as Instantane;
    expect(ids(base, o)).toEqual(['ordre']);
    expect(ids(o, base)).toEqual(['ordre_annule']);
  });

  it('le Regard : posé, repoussé, ou l’Anneau senti un peu après', () => {
    const oeil = (repousse: boolean, anneauSenti: boolean) => ({ ...base, etat: { ...etat, oeil: { repousse, anneauSenti } } }) as unknown as Instantane;
    expect(ids(base, oeil(false, false))).toEqual(['regard']);
    expect(ids(base, oeil(true, false))).toEqual(['repousse']);
    expect(effetsDuChangement(base, oeil(false, true))).toEqual([{ id: 'regard' }, { id: 'anneau', retard: 0.7 }]);
  });

  it('murmure classé, rituel, duel, Monde de l’Ombre', () => {
    expect(ids(base, { ...base, etat: { ...etat, murmures: [{ id: 'm1', classement: 'vrai' }] } } as unknown as Instantane)).toEqual(['murmure']);
    expect(ids(base, { ...base, etat: { ...etat, rituel: true } })).toEqual(['rituel']);
    expect(ids(base, { ...base, duel: {} })).toEqual(['duel']);
    expect(ids(base, { ...base, mode: 'ombre' })).toEqual(['ombre_entrer']);
    expect(ids({ ...base, mode: 'ombre' }, base)).toEqual(['ombre_sortir']);
  });

  it('une annonce sans changement d’état est un refus', () => {
    expect(ids(base, { ...base, toast: { n: 1 } })).toEqual(['refus']);
    expect(ids(base, { ...base, etat: { ...etat, rituel: true }, toast: { n: 1 } })).toEqual(['rituel']);
  });
});
