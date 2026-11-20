import { describe, expect, it } from 'vitest';
import { cleAudio, courbeSaturation, decomposer, LEXIQUE, REPLIQUES, repliqueFixe, verifierLigne } from '../src';

describe('Noir Parler', () => {
  it('décompose les mots agglutinés de l’inscription', () => {
    expect(decomposer('thrakatulûk')?.map((e) => e.mot)).toEqual(['thrak', 'at', 'ul', 'ûk']);
    expect(decomposer('krimpatul')?.map((e) => e.mot)).toEqual(['krimp', 'at', 'ul']);
    expect(decomposer('Gazgat')?.map((e) => e.mot)).toEqual(['gazg', 'at']);
  });

  it('valide l’inscription de l’Anneau et refuse un mot inventé hors lexique', () => {
    expect(verifierLigne('Ash nazg durbatulûk, ash nazg gimbatul, ash nazg thrakatulûk agh burzum-ishi krimpatul.')).toEqual({ valide: true, inconnus: [] });
    expect(verifierLigne('Gazgat-izg ulbur. Ash krû gimbatul-izg.').valide).toBe(true);
    expect(verifierLigne('Ash nazg elendil.')).toEqual({ valide: false, inconnus: ['elendil'] });
  });

  it('toutes les répliques fixes respectent le lexique', () => {
    for (const r of REPLIQUES) expect(verifierLigne(r.noir_parler), r.id).toMatchObject({ valide: true });
  });

  it('distingue l’attesté de l’inventé', () => {
    expect(LEXIQUE.find((e) => e.mot === 'nazg')?.statut).toBe('atteste');
    expect(LEXIQUE.find((e) => e.mot === 'ulbur')?.statut).toBe('invente');
  });

  it('choisit une réplique fixe par registre, et indexe le cache par texte et voix', () => {
    expect(repliqueFixe('fer', 3)?.registre).toBe('fer');
    expect(cleAudio('gaz-GAT', 'sauron')).toBe(cleAudio('gaz-GAT', 'sauron'));
    expect(cleAudio('gaz-GAT', 'sauron')).not.toBe(cleAudio('gaz-GAT', 'bouche'));
  });

  it('fabrique une courbe de saturation bornée', () => {
    const c = courbeSaturation(0.5);
    expect(c[0]).toBeCloseTo(-1);
    expect(c[c.length - 1]).toBeCloseTo(1);
  });
});
