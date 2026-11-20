import { describe, expect, it } from 'vitest';
import type { Bilan } from '../banc/banc';
import { evaluer } from '../banc/banc';
import { BOTS } from '../banc/bots';

/**
 * Garde-fous de l'équilibrage de la Visibilité (conception, section 2.1 bis).
 * 40 parties par bot, graines fixes : le résultat est reproductible.
 * Si un réglage de regles.ts fait sortir un bot de sa fourchette, ce test le dit.
 */
const bilans = new Map<string, Bilan>(BOTS.map((b) => [b.nom, evaluer(b, 40, 1)]));
const bilan = (nom: string) => bilans.get(nom)!;
const eveil = (b: Bilan) => b.issues.ouest_s_eveille / b.parties;

describe('équilibrage de la boucle de tour', () => {
  it('aucune stratégie ne domine', () => {
    for (const b of bilans.values()) expect(b.tauxVictoire, b.bot).toBeLessThanOrEqual(0.65);
  });

  it('poser des embuscades partout ne paie plus', () => {
    expect(bilan('embusqueur').tauxVictoire).toBeLessThanOrEqual(0.25);
    expect(bilan('barrage').tauxVictoire).toBeLessThanOrEqual(0.15);
  });

  it('un joueur qui ménage la Visibilité gagne une partie sur trois à une sur deux', () => {
    for (const nom of ['stratège', 'murmureur']) {
      expect(bilan(nom).tauxVictoire, nom).toBeGreaterThanOrEqual(0.25);
      expect(bilan(nom).tauxVictoire, nom).toBeLessThanOrEqual(0.6);
    }
    expect(bilan('prudent').tauxVictoire).toBeGreaterThanOrEqual(0.1);
  });

  it('la Voix est une voie de victoire à part entière', () => {
    expect(bilan('murmureur').issues.victoire_noire + bilan('murmureur').issues.victoire_grise).toBeGreaterThanOrEqual(8);
  });

  it('la jauge crée une tension sans empêcher d’agir', () => {
    // Le joueur raisonnable vit dans la zone dangereuse au milieu de l'acte, sans s'y brûler souvent.
    const s = bilan('stratège');
    expect(s.courbeMoyenne[2]).toBeGreaterThanOrEqual(50);
    expect(s.courbeMoyenne[2]).toBeLessThanOrEqual(90);
    expect(eveil(s)).toBeLessThanOrEqual(0.25);
    // Le palier 60 tombe après le Comté, pas dès les premiers jours.
    expect(s.tourPalier[60] ?? 99).toBeGreaterThanOrEqual(7);
    // Ne rien faire efface peu à peu la trace de Sauron.
    expect(bilan('passif').vFinaleMoyenne).toBeLessThanOrEqual(15);
    expect(bilan('passif').victoires).toBe(0);
  });

  it('frapper sans compter mène à l’Éveil de l’Ouest', () => {
    for (const nom of ['agressif', 'embusqueur', 'barrage', 'voix', 'terreur', 'aléatoire']) expect(eveil(bilan(nom)), nom).toBeGreaterThanOrEqual(0.75);
  });
});
