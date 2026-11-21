import { creerPartie, indexerMonde } from '@sauron/engine';
import { eriador } from '@sauron/world';
import { describe, expect, it } from 'vitest';
import { associer } from '../src/ecrans/artworks';
import { MURMURES, tirer } from '../src/ecrans/murmures';
import { aReprendre, envelopper, etatDe, lireEnveloppe, quand, resumer, type Enveloppe } from '../src/partie/sauvegardes';

const monde = indexerMonde(eriador);

describe('sauvegardes', () => {
  it('une enveloppe se relit et rend le même état', () => {
    const etat = creerPartie(monde, 42);
    const env = envelopper('emplacement-1', etat, '22 septembre 3018', new Date('2026-11-20T21:40:00Z'));
    const relue = lireEnveloppe(JSON.stringify(env))!;
    expect(relue.tour).toBe(1);
    expect(relue.date).toBe('22 septembre 3018');
    expect(etatDe(relue)).toEqual(etat);
  });

  it('un fichier illisible ou d’un autre format est ignoré', () => {
    expect(lireEnveloppe('pas du json')).toBeNull();
    expect(lireEnveloppe(JSON.stringify({ format: 2, id: 'auto', etat: '{}' }))).toBeNull();
  });

  it('« Continuer » reprend la plus récente des parties pas finies', () => {
    const a = creerPartie(monde, 1);
    const b = creerPartie(monde, 2);
    const finie = { ...creerPartie(monde, 3), issue: 'statu_quo' as const };
    const m = new Map<string, Enveloppe>([
      ['auto', envelopper('auto', a, '', new Date('2026-11-20T10:00:00Z'))],
      ['emplacement-1', envelopper('emplacement-1', b, '', new Date('2026-11-20T12:00:00Z'))],
      ['emplacement-2', envelopper('emplacement-2', finie, '', new Date('2026-11-20T14:00:00Z'))],
    ]);
    expect(resumer(m.get('emplacement-2')!).finie).toBe(true);
    expect(aReprendre(m)?.id).toBe('emplacement-1');
    expect(aReprendre(new Map())).toBeNull();
  });

  it('dit quand la partie a été enregistrée', () => {
    const maintenant = new Date(2026, 10, 20, 22, 0);
    expect(quand(new Date(2026, 10, 20, 21, 55).toISOString(), maintenant)).toBe('il y a 5 min');
    expect(quand(new Date(2026, 10, 20, 9, 5).toISOString(), maintenant)).toBe('aujourd’hui, 9 h 05');
    expect(quand(new Date(2026, 10, 19, 21, 40).toISOString(), maintenant)).toBe('hier, 21 h 40');
    expect(quand(new Date(0).toISOString(), maintenant)).toBe('date inconnue');
  });
});

describe('écrans de chargement', () => {
  it('associe les images présentes à leurs crédits, et garde celles sans crédit', () => {
    const urls = new Map([
      ['b.webp', '/assets/b.webp'],
      ['a.jpg', '/assets/a.jpg'],
    ]);
    const r = associer(
      [
        { fichier: 'b.webp', titre: 'Barad-dûr', artiste: 'X', cadrage: 'center top' },
        { fichier: 'absente.png', titre: 'Absente' },
      ],
      urls,
    );
    expect(r.map((x) => x.fichier)).toEqual(['b.webp', 'a.jpg']);
    expect(r[0]).toMatchObject({ titre: 'Barad-dûr', artiste: 'X', cadrage: 'center top' });
    expect(r[1]).toMatchObject({ titre: null, artiste: null, cadrage: 'center' });
  });

  it('une image de fond accompagne son artwork sans entrer dans la rotation', () => {
    const urls = new Map([
      ['3d/rendus/tour.webp', '/assets/tour.webp'],
      ['3d/fonds/large.webp', '/assets/large.webp'],
      ['autre.png', '/assets/autre.png'],
    ]);
    const r = associer([{ fichier: '3d/rendus/tour.webp', fond: '3d/fonds/large.webp' }, { fichier: 'autre.png', fond: 'absent.webp' }], urls);
    expect(r.map((x) => x.fichier)).toEqual(['3d/rendus/tour.webp', 'autre.png']);
    expect(r[0]!.fond).toBe('/assets/large.webp');
    expect(r[1]!.fond).toBeNull();
  });

  it('ne tire jamais deux fois de suite le même murmure', () => {
    let precedent = null as (typeof MURMURES)[number] | null;
    for (const alea of [0, 0, 0.5, 0.5, 0.99, 0.99]) {
      const m = tirer(MURMURES, precedent, () => alea);
      expect(m).not.toBe(precedent);
      precedent = m;
    }
  });
});
