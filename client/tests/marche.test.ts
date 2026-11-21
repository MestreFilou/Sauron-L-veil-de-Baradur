import { avancerNazgul, indexerMonde } from '@sauron/engine';
import { eriador, geographieEriador } from '@sauron/world';
import { describe, expect, it } from 'vitest';
import { atteignablesCeSoir, libelleTrajet, trajet, vitesseNazgul } from '../src/carte/marche';

const monde = indexerMonde(eriador);
const khamul = { id: 'khamul', posture: 'traque' as const, region: 'comte_ouest' };
const regions = Object.keys(geographieEriador.regions);

describe('marches des Neuf sur la carte', () => {
  it('suit le chemin du moteur et coupe l’étape du soir au budget de jours', () => {
    const t = trajet(monde, khamul, 'bree')!;
    expect(t.chemin[0]).toBe('comte_ouest');
    expect(t.chemin.at(-1)).toBe('bree');
    const ceSoir = avancerNazgul(monde, 'comte_ouest', 'bree', vitesseNazgul(monde, khamul));
    expect(t.chemin[t.ceSoir]).toBe(ceSoir.at(-1));
    expect(t.nuits).toBeGreaterThan(1);
    expect(libelleTrajet(t, 'Bree')).toContain(`${t.nuits} nuits`);
  });

  it('une destination atteignable ce soir prend une seule nuit', () => {
    const proches = atteignablesCeSoir(monde, khamul, regions);
    expect(proches.size).toBeGreaterThan(0);
    expect(proches.has('comte_ouest')).toBe(false);
    for (const r of proches) expect(trajet(monde, khamul, r)!.nuits).toBe(1);
  });

  it('les montures ailées vont plus loin', () => {
    expect(vitesseNazgul(monde, { ...khamul, posture: 'ombre_ailee' })).toBeGreaterThan(vitesseNazgul(monde, khamul));
  });

  it('signale le gué du Bruinen', () => {
    expect(trajet(monde, { ...khamul, region: 'trollshaws' }, 'fondcombe')!.bruinen).toBe(true);
    expect(trajet(monde, khamul, 'bree')!.bruinen).toBe(false);
  });
});
