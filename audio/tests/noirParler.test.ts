import { describe, expect, it } from 'vitest';
import { cleAudio, courbeSaturation, decomposer, EFFETS, LEXIQUE, minuterSousTitre, MUSIQUE, pisteAmbiance, REPLIQUES, repliqueFixe, repliquePour, verifierBanqueVoix, verifierEffets, verifierLigne, vitesseEffet } from '../src';
import type { Replique } from '../src';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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
    for (const r of REPLIQUES) if (r.noir_parler) expect(verifierLigne(r.noir_parler), r.id).toMatchObject({ valide: true });
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

describe('Banque audio', () => {
  const dossierAudio = fileURLToPath(new URL('..', import.meta.url));

  it('la banque des voix est cohérente, et chaque réplique enregistrée a son fichier', () => {
    expect(verifierBanqueVoix(REPLIQUES, (f) => existsSync(dossierAudio + f))).toEqual([]);
  });

  it('couvre les deux méthodes d’enregistrement', () => {
    expect(REPLIQUES.some((r) => r.methode === 'noir_parler')).toBe(true);
    expect(REPLIQUES.some((r) => r.methode === 'anglais_inverse')).toBe(true);
  });

  it('ne joue que les répliques enregistrées, sauf demande expresse', () => {
    const banque: Replique[] = [
      { ...REPLIQUES[0]!, id: 'a', registre: 'fer', statut: 'a_enregistrer' },
      { ...REPLIQUES[0]!, id: 'b', registre: 'fer', statut: 'enregistre', duree_s: 2 },
    ];
    expect(repliquePour('fer', 0, {}, banque)?.id).toBe('b');
    expect(repliquePour('fer', 1, {}, banque)?.id).toBe('b');
    expect(repliquePour('fer', 0, { memeNonEnregistrees: true }, banque)?.id).toBe('a');
    expect(repliquePour('cri', 0, {}, banque)).toBeUndefined();
  });

  it('signale une incohérence (fichier mal nommé, Noir Parler hors lexique, durée absente)', () => {
    const r: Replique = { id: 'x', registre: 'fer', methode: 'noir_parler', lu: '', noir_parler: 'Ash elendil', sous_titre: 'x', fichier: 'voix/y.mp3', statut: 'enregistre', duree_s: null, reperes: null };
    expect(verifierBanqueVoix([r]).length).toBe(3);
  });

  it('répartit le sous-titre sur la durée sans repères, et garde les repères s’il y en a', () => {
    const m = minuterSousTitre('Un Anneau pour les gouverner tous', 6);
    expect(m[0]!.debut).toBe(0);
    expect(m.at(-1)!.fin).toBeCloseTo(6);
    const rep = [{ mot: 'Ash', debut: 0.1, fin: 0.4 }];
    expect(minuterSousTitre('Ash', 1, rep)).toBe(rep);
  });

  it('la musique est rangée par ambiance ; une ambiance vide reste silencieuse', () => {
    expect(Object.keys(MUSIQUE.ambiances).sort()).toEqual(['barad_dur', 'defaite', 'duel', 'traque', 'victoire', 'voix']);
    const m = { version: 1 as const, ambiances: { ...MUSIQUE.ambiances, victoire: [], duel: [{ fichier: 'duel/a.mp3', boucle: true, volume_db: 0, fondu_s: 2 }] } };
    expect(pisteAmbiance('duel', 5, m)?.fichier).toBe('duel/a.mp3');
    expect(pisteAmbiance('victoire', 0, m)).toBeUndefined();
  });
});

describe('Musique libre et effets', () => {
  const audio = fileURLToPath(new URL('..', import.meta.url));

  it('chaque ambiance a sa piste originale, présente sur le disque', () => {
    for (const [ambiance, pistes] of Object.entries(MUSIQUE.ambiances)) {
      expect(pistes.length, ambiance).toBeGreaterThan(0);
      for (const p of pistes) expect(existsSync(`${audio}musique/${p.fichier}`), p.fichier).toBe(true);
    }
  });

  it('le manifeste des effets est cohérent et ses fichiers existent', () => {
    expect(verifierEffets(EFFETS, (f) => existsSync(`${audio}effets/${f}`))).toEqual([]);
    expect(Object.keys(EFFETS.fonds).sort()).toEqual(['oeil', 'ombre']);
  });

  it('la variation de vitesse reste dans ses bornes', () => {
    const e = { variation: 0.05 };
    expect(vitesseEffet(e, 0.5)).toBeCloseTo(1);
    expect(vitesseEffet(e, 0)).toBeCloseTo(0.95);
    expect(vitesseEffet(e, 1)).toBeCloseTo(1.05);
    expect(vitesseEffet(e, 7)).toBeCloseTo(1.05);
  });

  it('signale un effet mal décrit', () => {
    const m = { ...EFFETS, effets: { ...EFFETS.effets, ui_clic: { fichier: '', volume_db: 20, variation: 2, intervalle_s: -1 } } };
    expect(verifierEffets(m).length).toBe(4);
  });
});
