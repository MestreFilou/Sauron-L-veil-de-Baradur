import { describe, expect, it } from 'vitest';
import { appliquer, creerPartie, indexerMonde } from '@sauron/engine';
import { eriador } from '@sauron/world';
import { BANQUE_FR, contracter, NarrateurBanque, narrateurAvecRepli, promptMurmures, remplir, SYSTEME_MURMURES } from '../src';
import type { Narrateur } from '../src';

const monde = indexerMonde(eriador);
const noms = {
  personnages: Object.fromEntries(eriador.personnages.map((p) => [p.id, p.nom])),
  regions: Object.fromEntries(eriador.regions.map((r) => [r.id, r.nom])),
};
const etat = appliquer(monde, creerPartie(monde, 4), { type: 'poser_oeil', cible: { type: 'region', id: 'bree' } });

describe('banque de textes (le jeu sans IA)', () => {
  it('couvre chaque source et chaque type de fait', () => {
    for (const source of ['espion', 'crebain', 'rumeur', 'nazgul', 'agent'] as const) {
      for (const type of ['presence', 'absence', 'terreur', 'passage_porteur', 'nazgul', 'calme'] as const) {
        expect(BANQUE_FR.murmures[source][type].length, `${source}/${type}`).toBeGreaterThan(0);
      }
    }
  });

  it('écrit chaque murmure, sans variable non remplie, et toujours le même texte', async () => {
    const n = new NarrateurBanque(noms);
    const a = await n.ecrireMurmures(etat.murmures);
    const b = await n.ecrireMurmures(etat.murmures);
    expect(Object.keys(a).sort()).toEqual(etat.murmures.map((m) => m.id).sort());
    expect(a).toEqual(b);
    for (const t of Object.values(a)) {
      expect(t).not.toMatch(/[{}]/);
      expect(t.length).toBeGreaterThan(10);
    }
  });

  it('préfère les répliques propres à un personnage', async () => {
    const n = new NarrateurBanque(noms);
    const texte = await n.reactionVoix({
      resultat: { ordre: { type: 'voix', cible: 'bill_fougeron', registre: 'annatar' }, chance: 95, jet: 3, reussie: true, duel: null, detail: {} },
      cible: { nom: 'Bill Fougeron', peur: '', traits: [] },
      murmureJoueur: null,
      faitsInterdits: [],
      journal: [],
    });
    expect(texte).toContain('Bill Fougeron ricane');
  });

  it('remplit les gabarits', () => {
    expect(remplir('{qui} à {lieu}{rien}', { qui: 'Frodon', lieu: 'Bree' })).toBe('Frodon à Bree');
  });
});

describe('Claude en complément', () => {
  it('retombe sur la banque si l’appel échoue', async () => {
    const panne: Narrateur = {
      ecrireMurmures: () => Promise.reject(new Error('pas de réseau')),
      ecrireJournal: () => Promise.reject(new Error('pas de réseau')),
      analyserTexteLibre: () => Promise.reject(new Error('pas de réseau')),
      reactionVoix: () => Promise.reject(new Error('pas de réseau')),
      narrerDuel: () => Promise.reject(new Error('pas de réseau')),
    };
    const n = narrateurAvecRepli(panne, new NarrateurBanque(noms));
    const textes = await n.ecrireMurmures(etat.murmures, []);
    expect(Object.keys(textes)).toHaveLength(etat.murmures.length);
  });

  it('ne montre jamais la vérité d’un murmure au modèle', () => {
    const p = promptMurmures(etat.murmures, []);
    expect(p).not.toMatch(/"verite"/);
    expect(SYSTEME_MURMURES).not.toMatch(/\d{4}-\d{2}/);
  });
});

describe('Lieux et contractions', () => {
  it('contracte « à le » et « de les » après remplissage', () => {
    expect(contracter('Des cavaliers à le Bois de Chet, venus de les Galgals.')).toBe('Des cavaliers au Bois de Chet, venus des Galgals.');
    expect(remplir('Rien à {lieu}.', { lieu: 'les Terres Solitaires' })).toBe('Rien aux Terres Solitaires.');
  });

  it('chaque région jouable a un nom de lieu dans la banque', () => {
    for (const r of eriador.regions) expect(BANQUE_FR.lieux?.[r.id], r.id).toBeTruthy();
  });

  it('aucun murmure ne laisse de gabarit non rempli ni de « à le »', async () => {
    const n = new NarrateurBanque(noms);
    const textes = Object.values(await n.ecrireMurmures(etat.murmures));
    for (const t of textes) {
      expect(t).not.toMatch(/\{\w+\}/);
      expect(t).not.toMatch(/\bà le |\bà les /);
    }
  });
});
