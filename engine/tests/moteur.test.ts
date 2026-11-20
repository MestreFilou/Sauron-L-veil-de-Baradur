import { describe, expect, it } from 'vitest';
import {
  appliquer,
  avancerNazgul,
  chanceDetection,
  chanceManche,
  chanceVoix,
  charger,
  cheminNazgul,
  creerPartie,
  creerRng,
  distance,
  ErreurRegle,
  estimerPiste,
  indexerMonde,
  nombreMurmures,
  paRestants,
  profilVerite,
  REGLES,
  rejouer,
  sauvegarder,
  vueJoueur,
} from '../src';
import type { Action, DonneesMonde, EtatJeu, Ordre } from '../src';
import { donneesTest, mondeTest as monde } from './fixture';

const partie = (graine = 7) => creerPartie(monde, graine);
const oeil = (id: string): Action => ({ type: 'poser_oeil', cible: { type: 'region', id } });
const ordre = (o: Ordre): Action => ({ type: 'ordonner', ordre: o });
const fin: Action = { type: 'fin_des_ordres' };
/** Passe un tour entier sans rien faire d'autre que poser l'Œil. */
const tourCalme = (etat: EtatJeu, region = 'ouest') => rejouer(monde, etat, [oeil(region), fin]);

describe('hasard à graine', () => {
  it('donne la même suite pour la même graine et le même sel', () => {
    const a = creerRng(42, 3, 'aube');
    const b = creerRng(42, 3, 'aube');
    expect([a.next(), a.next(), a.d100()]).toEqual([b.next(), b.next(), b.d100()]);
    expect(creerRng(42, 4, 'aube').next()).not.toEqual(creerRng(42, 3, 'aube').next());
  });
});

describe('carte en graphe', () => {
  it('mesure les distances en régions', () => {
    expect(distance(monde, 'ouest', 'ouest')).toBe(0);
    expect(distance(monde, 'ouest', 'colline')).toBe(3);
    expect(distance(monde, 'ouest', 'mordor')).toBe(Infinity);
  });

  it('fait payer au Nazgûl le détour par le Pont du Brandevin', () => {
    expect(cheminNazgul(monde, 'est', 'bouc')).toEqual(['est', 'bouc']);
    // est → bouc coûte 2 jours (1 + détour) : un Nazgûl à 2 jours de budget s'arrête à bouc.
    expect(avancerNazgul(monde, 'est', 'foret', 2)).toEqual(['est', 'bouc']);
    expect(avancerNazgul(monde, 'ouest', 'colline', 2)).toEqual(['ouest', 'est']);
  });

  it('refuse un monde incohérent', () => {
    const casse: DonneesMonde = structuredClone(donneesTest);
    casse.regions[0]!.voisins.push({ id: 'colline', joursCheval: 1, joursPied: 1, obstacle: null });
    expect(() => indexerMonde(casse)).toThrow(/réciproque/);
  });
});

describe('création de partie', () => {
  it('part des valeurs du document de mécaniques', () => {
    const e = partie();
    expect(e.tour).toBe(1);
    expect(e.phase).toBe('oeil');
    expect(e.jauges.visibilite).toBe(10);
    expect(e.jauges.essence).toBe(5);
    expect(e.jauges.pa).toBe(4);
    expect(e.anneau.etape).toBe('A0');
    expect(e.nazgul['tard']!.indisponibleJusquA).toBe(2);
    expect(e.anneau.traces['ouest']).toEqual({ force: 1, tour: 1 });
  });
});

describe('phase 2 : l’Œil', () => {
  it('révèle une région, coûte V +1 et éveille la Méfiance des fortes volontés', () => {
    const e = appliquer(monde, partie(), oeil('colline'));
    expect(e.jauges.visibilite).toBe(11);
    expect(e.oeil?.personnagesVus.map((v) => v.id)).toEqual(['sage']);
    expect(e.personnages['sage']!.mefiance).toBe(15);
    expect(e.connaissance.terreurs['colline']).toEqual({ valeur: 0, tour: 1 });
    expect(e.phase).toBe('ordres');
  });

  it('glisse sur un sanctuaire (V +3) et ne voit rien dans une zone aveugle', () => {
    const s = appliquer(monde, partie(), oeil('sanctuaire'));
    expect(s.oeil?.repousse).toBe(true);
    expect(s.oeil?.personnagesVus).toEqual([]);
    expect(s.jauges.visibilite).toBe(13);
    const f = appliquer(monde, partie(), oeil('foret'));
    expect(f.oeil?.repousse).toBe(true);
    expect(f.jauges.visibilite).toBe(11);
  });

  it('ne peut viser qu’un esprit dont Sauron connaît l’existence', () => {
    expect(() => appliquer(monde, partie(), { type: 'poser_oeil', cible: { type: 'personnage', id: 'porteur' } })).toThrow(ErreurRegle);
  });

  it('lit les pensées d’un personnage : destination, peur, un secret', () => {
    const e = appliquer(monde, partie(), { type: 'poser_oeil', cible: { type: 'personnage', id: 'fier' } });
    expect(e.oeil?.pensees?.destination).toBe('la destination de fier');
    expect(e.oeil?.pensees?.secret).toBe('le secret de fier');
    expect(e.connaissance.secrets.map((s) => s.id)).toEqual(['sec_fier']);
    expect(e.personnages['fier']!.mefiance).toBe(15);
  });

  it('engage un duel de regard contre une volonté de 90 ou plus', () => {
    const e = appliquer(monde, partie(), { type: 'poser_oeil', cible: { type: 'personnage', id: 'sage' } });
    expect(e.oeil?.duel?.manches).toHaveLength(1);
    if (!e.oeil!.duel!.victoire) {
      expect(e.oeil!.repousse).toBe(true);
      expect(e.jauges.visibilite).toBeGreaterThanOrEqual(10 + 8);
    }
  });

  it('ne se pose qu’une fois par tour', () => {
    const e = appliquer(monde, partie(), oeil('ouest'));
    expect(() => appliquer(monde, e, oeil('est'))).toThrow(/déjà posé/);
  });
});

describe('phase 3 : les Murmures', () => {
  it('en génère 5, plus les bonus des régions non observées, plus un par agent', () => {
    const e = partie();
    expect(nombreMurmures(monde, e)).toBe(5 + 2); // le carrefour donne +2
    const apres = appliquer(monde, e, oeil('carrefour'));
    expect(apres.murmures.filter((m) => m.source !== 'agent')).toHaveLength(5);
    expect(apres.murmures.every((m) => m.region !== 'carrefour')).toBe(true);
    expect(apres.murmures.every((m) => m.region !== 'foret' && m.region !== 'sanctuaire')).toBe(true);
  });

  it('suit les profils de vérité, la peur des espions et le bonus des régions Corrompues', () => {
    const e = partie();
    expect(profilVerite(monde, e, 'ouest', 'espion')).toEqual({ vrai: 60, deforme: 25, faux: 15 });
    e.regions['ouest']!.terreur = 70;
    expect(profilVerite(monde, e, 'ouest', 'espion')).toEqual({ vrai: 45, deforme: 25, faux: 30 });
    e.regions['est']!.corrompue = true;
    expect(profilVerite(monde, e, 'est', 'rumeur')).toEqual({ vrai: 55, deforme: 35, faux: 10 });
    expect(profilVerite(monde, e, 'ouest', 'nazgul', true)).toEqual({ vrai: 60, deforme: 40, faux: 0 });
  });

  it('cache la vérité au joueur tant qu’elle n’est pas vérifiée', () => {
    const e = appliquer(monde, partie(), oeil('ouest'));
    const vue = vueJoueur(monde, e);
    expect(vue.murmures.length).toBeGreaterThan(0);
    for (const m of vue.murmures) if (!m.verifie) expect(m.verite).toBeNull();
    expect(JSON.stringify(vue)).not.toContain('"traces"');
  });

  it('récompense une bonne déduction confirmée avant la fin du tour suivant', () => {
    let e = appliquer(monde, partie(3), oeil('sanctuaire'));
    const m = e.murmures.find((x) => x.source !== 'agent')!;
    e = appliquer(monde, e, { type: 'classer_murmure', murmure: m.id, classement: m.verite === 'faux' ? 'faux' : 'vrai' });
    e = appliquer(monde, e, fin);
    const essenceAvant = e.jauges.essence;
    e = appliquer(monde, e, oeil(m.region));
    const verifie = e.murmures.find((x) => x.id === m.id)!;
    expect(verifie.verifie).toBe(true);
    expect(verifie.recompense).toBe(true);
    expect(e.jauges.essence).toBe(essenceAvant + 1);
  });
});

describe('phase 4 : les ordres', () => {
  const pret = () => appliquer(monde, partie(), oeil('ouest'));

  it('décompte les PA et refuse de dépasser le budget', () => {
    let e = pret();
    e = appliquer(monde, e, ordre({ type: 'nazgul_traque', nazgul: 'roi' }));
    e = appliquer(monde, e, ordre({ type: 'nazgul_traque', nazgul: 'khamul' }));
    e = appliquer(monde, e, ordre({ type: 'voix', cible: 'faible', registre: 'annatar' }));
    e = appliquer(monde, e, ordre({ type: 'voix', cible: 'fier', registre: 'paranoia' }));
    expect(paRestants(e)).toBe(0);
    expect(() => appliquer(monde, e, ordre({ type: 'agent_placer', pnj: 'fier' }))).toThrow(/PA/);
    // Le Cri et le déplacement sont gratuits.
    expect(() => appliquer(monde, e, ordre({ type: 'nazgul_deplacer', nazgul: 'roi', destination: 'colline' }))).not.toThrow();
  });

  it('une action payante par Nazgûl, une Voix par personnage', () => {
    let e = pret();
    e = appliquer(monde, e, ordre({ type: 'nazgul_traque', nazgul: 'roi' }));
    expect(() => appliquer(monde, e, ordre({ type: 'nazgul_cri', nazgul: 'roi' }))).toThrow(/une action/);
    e = appliquer(monde, e, ordre({ type: 'voix', cible: 'faible', registre: 'paranoia' }));
    expect(() => appliquer(monde, e, ordre({ type: 'voix', cible: 'faible', registre: 'annatar' }))).toThrow(/une Voix/);
  });

  it('refuse un Nazgûl pas encore arrivé, et le Fléau en Acte I', () => {
    const e = pret();
    expect(() => appliquer(monde, e, ordre({ type: 'nazgul_traque', nazgul: 'tard' }))).toThrow(/disponible/);
    expect(() => appliquer(monde, e, ordre({ type: 'nazgul_fleau', nazgul: 'roi' }))).toThrow(/Acte II/);
  });

  it('exige de dire ce qu’ordonne un Commandement de Fer', () => {
    expect(() => appliquer(monde, pret(), ordre({ type: 'voix', cible: 'faible', registre: 'fer' }))).toThrow(/ordonné/);
  });

  it('un Nazgûl isolé n’entend la Tour qu’un tour sur deux', () => {
    const e = pret();
    e.nazgul['khamul']!.region = 'sanctuaire';
    e.nazgul['roi']!.region = 'ouest';
    // tour 1 (impair) : refusé
    expect(() => appliquer(monde, e, ordre({ type: 'nazgul_traque', nazgul: 'khamul' }))).toThrow(/un tour sur deux/);
  });
});

describe('la Voix de Sauron', () => {
  it('applique la formule 4.1 à la lettre', () => {
    const e = appliquer(monde, partie(), oeil('ouest'));
    // faible : D 60, W 20, M 0. Annatar : +20 (avide/désir). 50 + 60 - 20 + 20 = 110 → borné à 95.
    expect(chanceVoix(monde, e, { type: 'voix', cible: 'faible', registre: 'annatar' }).chance).toBe(95);
    // fier : D 30, W 65, M 0, paranoïa sans peur connue : 50 + 30 - 65 = 15.
    expect(chanceVoix(monde, e, { type: 'voix', cible: 'fier', registre: 'paranoia' }).chance).toBe(15);
    e.personnages['fier']!.mefiance = 20;
    // Méfiance / 2 : 15 - 10 = 5 (plancher).
    expect(chanceVoix(monde, e, { type: 'voix', cible: 'fier', registre: 'paranoia' }).chance).toBe(5);
  });

  it('ajoute le secret révélé par l’Œil et le texte libre, plafonné', () => {
    const e = appliquer(monde, partie(), { type: 'poser_oeil', cible: { type: 'personnage', id: 'fier' } });
    const c = chanceVoix(monde, e, {
      type: 'voix',
      cible: 'fier',
      registre: 'paranoia',
      secret: 'sec_fier',
      etiquettes: { registreDetecte: 'paranoia', secretUtilise: null, coherencePersonnage: 2, subtilite: 1, contradictionLore: false },
    });
    // 50 + 30 - 65 - 15/2 (M 15 après le Regard) + 15 (peur connue) + 20 (secret) + 15 (texte) = 57,5 → 58
    expect(c.detail).toMatchObject({ secret: 20, texte: 15, registre: 15, mefiance: -8 });
    expect(c.chance).toBe(57);
    expect(c.duel).toBe(false);
  });

  it('déclenche un duel mental pour un Commandement contre une volonté de 60 ou plus', () => {
    let e = appliquer(monde, partie(), oeil('ouest'));
    e = appliquer(monde, e, ordre({ type: 'voix', cible: 'fier', registre: 'fer', ordreFer: { type: 'se_taire' }, approches: ['ecraser', 'ecraser', 'ecraser'] }));
    e = appliquer(monde, e, fin);
    const duel = e.journal[0]!.evenements.find((x) => x.type === 'duel');
    expect(duel).toBeDefined();
  });

  it('une dette d’Annatar se réclame par un Commandement, sans duel', () => {
    let e = appliquer(monde, partie(), oeil('ouest'));
    e.personnages['fier']!.dette = true;
    e = appliquer(monde, e, ordre({ type: 'voix', cible: 'fier', registre: 'fer', ordreFer: { type: 'deplacer', region: 'colline' } }));
    e = appliquer(monde, e, fin);
    expect(e.personnages['fier']!.dette).toBe(false);
    // il fait un pas par jour vers la colline
    expect(e.personnages['fier']!.region).toBe('colline');
  });
});

describe('duel mental', () => {
  it('chance de manche = 50 + (P - W) / 2, bornée de 10 à 90', () => {
    expect(chanceManche(60, 80, 'insinuer', false)).toBe(40);
    expect(chanceManche(60, 80, 'insinuer', true)).toBe(55);
    expect(chanceManche(60, 80, 'ecraser', false)).toBe(50);
    expect(chanceManche(60, 80, 'feindre', false)).toBe(30);
    expect(chanceManche(60, 200, 'feindre', false)).toBe(10);
    expect(chanceManche(200, 0, 'ecraser', false)).toBe(90);
  });
});

describe('Nazgûl et Anneau', () => {
  it('détection : 40 % + 15 % × force, Khamûl +20 % mais -25 % de jour, +10 % de nuit', () => {
    const e = partie();
    e.anneau.traces['est'] = { force: 1, tour: 1 };
    expect(chanceDetection(monde, e, 'roi', 'est', false)).toBe(40 + 15 + 10);
    expect(chanceDetection(monde, e, 'khamul', 'est', false)).toBe(40 + 15 + 20 - 25);
    expect(chanceDetection(monde, e, 'khamul', 'est', true)).toBe(40 + 15 + 20 + 10);
    e.anneau.traces['est'] = { force: 5, tour: 1 };
    expect(chanceDetection(monde, e, 'roi', 'est', true)).toBe(95);
  });

  it('la Pulsation révèle le porteur aux Nazgûl à deux régions ou moins', () => {
    let e = partie();
    for (let i = 0; i < 4; i++) e = tourCalme(e, 'sanctuaire');
    expect(e.tour).toBe(5);
    expect(e.anneau.pulsation).toEqual({ region: 'carrefour', tour: 5 });
    expect(e.connaissance.anneau).toEqual({ region: 'carrefour', tour: 5, exact: true });
    expect(e.anneau.etape).toBe('A1');
  });

  it('les Nazgûl arrivent en retard par la région de retour', () => {
    let e = partie();
    e = tourCalme(e);
    e = tourCalme(e);
    expect(e.tour).toBe(3);
    expect(e.nazgul['tard']!.region).toBe('carrefour');
  });

  it('la Traque augmente la Terreur et la Visibilité', () => {
    let e = appliquer(monde, partie(), oeil('ouest'));
    e = appliquer(monde, e, ordre({ type: 'nazgul_traque', nazgul: 'roi' }));
    const v = e.jauges.visibilite;
    e = appliquer(monde, e, fin);
    expect(e.regions['carrefour']!.terreur).toBe(10 - 0); // pas de décroissance : un Nazgûl est présent
    expect(e.jauges.visibilite).toBeGreaterThanOrEqual(v + 2 - 2);
  });

  it('la Haie plafonne la Terreur à 50', () => {
    let e = appliquer(monde, partie(), oeil('ouest'));
    e.nazgul['khamul']!.region = 'bouc';
    e = appliquer(monde, e, ordre({ type: 'nazgul_cri', nazgul: 'khamul' }));
    e.regions['bouc']!.terreur = 45;
    e = appliquer(monde, e, fin);
    expect(e.regions['bouc']!.terreur).toBeLessThanOrEqual(50);
  });
});

describe('jauges et seuils', () => {
  it('la Visibilité décroît de 2 par tour calme, sans passer sous le palier atteint moins 10', () => {
    let e = partie();
    e = tourCalme(e, 'ouest'); // V 11 au tour 1
    expect(e.jauges.visibilite).toBe(11 - 2); // décroissance à l'aube du tour 2
    e.jauges.visibilite = 31;
    e.jauges.paliers = [20, 40];
    for (let i = 0; i < 2; i++) e = tourCalme(e, 'ouest');
    expect(e.jauges.visibilite).toBe(30);
  });

  it('déclenche chaque palier une seule fois', () => {
    let e = appliquer(monde, partie(), oeil('ouest'));
    e.jauges.visibilite = 39;
    e = appliquer(monde, e, ordre({ type: 'nazgul_cri', nazgul: 'roi' }));
    e = appliquer(monde, e, fin);
    expect(e.jauges.paliers).toEqual([20, 40]);
    expect(e.personnages['sage']!.mefiance).toBeGreaterThanOrEqual(10);
    const n = e.journal.flatMap((j) => j.evenements).filter((x) => x.texte.startsWith('Visibilité 40')).length;
    e = tourCalme(e);
    expect(e.journal.flatMap((j) => j.evenements).filter((x) => x.texte.startsWith('Visibilité 40')).length).toBe(n);
  });

  it('un rituel de Forme consomme tous les PA et l’Essence, puis donne +1 PA', () => {
    let e = partie();
    e.jauges.essence = 12;
    e = appliquer(monde, e, { type: 'rituel_forme' });
    expect(e.jauges.pa).toBe(0);
    expect(e.jauges.essence).toBe(2);
    e = appliquer(monde, e, fin);
    expect(e.jauges.forme).toBe(1);
    expect(e.jauges.pa).toBe(5);
  });

  it('la corruption prend après trois tours à T ≥ 60 dans une région Écrasée tenue par un Nazgûl', () => {
    let e = appliquer(monde, partie(11), oeil('ouest'));
    e.regions['colline']!.terreur = 85; // Volonté régionale 0 : la corruption réussit
    e.nazgul['roi']!.region = 'colline';
    e = appliquer(monde, e, ordre({ type: 'corruption', region: 'colline' }));
    e = appliquer(monde, e, fin);
    expect(e.regions['colline']!.corruption).not.toBeNull();
    for (let i = 0; i < 3 && !e.regions['colline']!.corrompue; i++) {
      e = rejouer(monde, e, [oeil('ouest'), ordre({ type: 'nazgul_traque', nazgul: 'roi' }), fin]);
    }
    expect(e.regions['colline']!.corrompue).toBe(true);
  });
});

describe('déterminisme et sauvegarde', () => {
  const script: Action[] = [
    oeil('carrefour'),
    ordre({ type: 'nazgul_traque', nazgul: 'roi' }),
    ordre({ type: 'voix', cible: 'faible', registre: 'annatar' }),
    fin,
    oeil('est'),
    ordre({ type: 'nazgul_deplacer', nazgul: 'khamul', destination: 'carrefour' }),
    ordre({ type: 'nazgul_embuscade', nazgul: 'roi' }),
    fin,
  ];

  it('rejoue une partie à l’identique avec la même graine', () => {
    const a = rejouer(monde, partie(99), script);
    const b = rejouer(monde, partie(99), script);
    expect(sauvegarder(a)).toEqual(sauvegarder(b));
  });

  it('ne modifie jamais l’état d’entrée', () => {
    const e = partie();
    const avant = sauvegarder(e);
    appliquer(monde, e, oeil('ouest'));
    expect(sauvegarder(e)).toEqual(avant);
  });

  it('sauvegarde et recharge sans perte', () => {
    const a = rejouer(monde, partie(5), script);
    expect(charger(sauvegarder(a))).toEqual(a);
  });
});

describe('fin de l’Acte I', () => {
  it('sans intervention, le porteur atteint le sanctuaire : statu quo', () => {
    let e = partie();
    while (e.phase !== 'fin' && e.tour < 40) e = tourCalme(e, 'foret');
    expect(e.issue).toBe('statu_quo');
    expect(e.tour).toBe(11);
  });

  it('à Visibilité 100, l’Ouest s’éveille', () => {
    let e = appliquer(monde, partie(), oeil('ouest'));
    e.jauges.visibilite = 99;
    e = appliquer(monde, e, ordre({ type: 'nazgul_cri', nazgul: 'roi' }));
    e = appliquer(monde, e, fin);
    expect(e.issue).toBe('ouest_s_eveille');
    expect(() => appliquer(monde, e, oeil('ouest'))).toThrow(/terminé/);
  });
});

describe('piste de l’Anneau', () => {
  it('part du Nom (A0) et ne regarde jamais la vraie position', () => {
    const e = partie();
    const p = estimerPiste(monde, e);
    expect(p.precision).toBe('diffuse');
    expect(Object.values(p.probabilites).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    // Déplacer le vrai porteur ne change rien à l'estimation.
    const triche = structuredClone(e);
    triche.personnages['porteur']!.region = 'gue';
    expect(estimerPiste(monde, triche)).toEqual(p);
  });

  it('devient exacte quand l’Anneau a été senti ce tour', () => {
    let e = partie();
    for (let i = 0; i < 4; i++) e = tourCalme(e, 'sanctuaire');
    const p = estimerPiste(monde, e);
    expect(p.precision).toBe('exacte');
    expect(p.regionProbable).toBe('carrefour');
    expect(p.certitude).toBe(1);
  });
});

describe('règles chiffrées', () => {
  it('reprend les profils de sources du document', () => {
    for (const s of Object.values(REGLES.murmures.sources)) expect(s.vrai + s.deforme + s.faux).toBe(100);
  });
});
