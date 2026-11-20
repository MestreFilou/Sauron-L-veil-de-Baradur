import type { DonneesMonde, PersonnageDef, RegionDef } from '../src';
import { indexerMonde } from '../src';

/**
 * Petit monde de test, indépendant des données de l'Eriador :
 *
 *   ouest —1— est ≈brandevin≈ bouc      foret(aveugle)
 *               \                         |
 *                2— carrefour —1— colline —1— gue ≈bruinen≈ sanctuaire
 */
const voisin = (id: string, jours = 1, obstacle: 'brandevin' | 'bruinen' | null = null) => ({ id, joursCheval: jours, joursPied: jours, obstacle });

const region = (id: string, voisins: RegionDef['voisins'], extra: Partial<RegionDef> = {}): RegionDef => ({
  id,
  royaume: 'test',
  nom: id[0]!.toUpperCase() + id.slice(1),
  terrain: 'plaine',
  voisins,
  volonteRegionale: 20,
  sourcesMurmures: ['espion', 'rumeur'],
  murmuresBonus: 0,
  reglesSpeciales: [],
  ...extra,
});

const perso = (id: string, extra: Partial<PersonnageDef>): PersonnageDef => ({
  id,
  nom: id,
  camp: 'peuples_libres',
  role: 'heros',
  volonte: 50,
  douteInitial: 20,
  traits: [],
  peur: `la peur de ${id}`,
  destination: `la destination de ${id}`,
  secrets: [{ id: `sec_${id}`, type: 'mensonge', texte: `le secret de ${id}` }],
  relations: {},
  itineraire: [{ tour: 1, region: 'ouest' }],
  ...extra,
});

export const donneesTest: DonneesMonde = {
  royaume: 'test',
  regions: [
    region('ouest', [voisin('est')]),
    region('est', [voisin('ouest'), voisin('bouc', 1, 'brandevin'), voisin('carrefour', 2)]),
    region('bouc', [voisin('est', 1, 'brandevin'), voisin('foret')], { terreurPlafond: 50 }),
    region('foret', [voisin('bouc'), voisin('colline')], { reglesSpeciales: ['zone_aveugle'], sourcesMurmures: [] }),
    region('carrefour', [voisin('est', 2), voisin('colline')], { murmuresBonus: 2 }),
    region('colline', [voisin('carrefour'), voisin('foret'), voisin('gue')], { reglesSpeciales: ['point_haut'], volonteRegionale: 0 }),
    region('gue', [voisin('colline'), voisin('sanctuaire', 1, 'bruinen')], { reglesSpeciales: ['crue'] }),
    region('sanctuaire', [voisin('gue', 1, 'bruinen')], { reglesSpeciales: ['sanctuaire'], sourcesMurmures: [], volonteRegionale: 100 }),
    region('mordor', [], { horsCarte: true, sourcesMurmures: [] }),
  ],
  personnages: [
    perso('porteur', {
      porteur: true,
      groupe: 'g',
      volonte: 55,
      douteInitial: 15,
      itineraire: [
        { tour: 1, region: 'ouest' },
        { tour: 3, region: 'est' },
        { tour: 5, region: 'carrefour', metAnneau: true },
        { tour: 8, region: 'colline' },
        { tour: 10, region: 'gue' },
        { tour: 11, region: 'sanctuaire' },
      ],
      relations: { ami: 90 },
    }),
    perso('ami', { groupe: 'g', volonte: 70, douteInitial: 5, traits: ['humble'], itineraire: [{ tour: 1, region: 'ouest' }, { tour: 3, region: 'est' }, { tour: 5, region: 'carrefour' }, { tour: 8, region: 'colline' }, { tour: 10, region: 'gue' }, { tour: 11, region: 'sanctuaire' }] }),
    perso('sage', { role: 'sage', volonte: 95, douteInitial: 0, connuDeSauron: true, defenseCombat: 35, itineraire: [{ tour: 1, region: 'colline' }] }),
    perso('elrond', { role: 'sage', volonte: 95, douteInitial: 0, connuDeSauron: true, itineraire: [{ tour: 1, region: 'sanctuaire' }] }),
    perso('faible', { role: 'pnj', camp: 'ombre', volonte: 20, douteInitial: 60, traits: ['avide', 'desir'], connuDeSauron: true, itineraire: [{ tour: 1, region: 'carrefour' }] }),
    perso('fier', { role: 'heros', volonte: 65, douteInitial: 30, traits: ['orgueil'], connuDeSauron: true, itineraire: [{ tour: 1, region: 'carrefour' }] }),
  ],
  nazgul: [
    { id: 'roi', nom: 'Le Roi', vitesse: 2, bonusDetection: 10, roiSorcier: true, regionDepart: 'carrefour' },
    { id: 'khamul', nom: 'Khamûl', vitesse: 2, bonusDetection: 20, sensibleAuJour: true, regionDepart: 'est' },
    { id: 'tard', nom: 'Le Tardif', vitesse: 2, bonusDetection: 0, regionDepart: 'mordor', disponibleAuTour: 3 },
  ],
  calendrier: [{ tour: 2, date: '23 sept.', evenement: 'Le porteur se met en route.' }],
  regionRetraite: 'mordor',
  regionRetour: 'carrefour',
  refuge: { region: 'sanctuaire', gardien: 'elrond' },
};

export const mondeTest = indexerMonde(donneesTest);
