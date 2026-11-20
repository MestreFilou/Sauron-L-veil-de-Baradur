/**
 * Cohérence de la banque de textes de l'Acte I : couverture (chaque fait,
 * chaque esprit, chaque jalon a ses textes), grammaire après remplissage,
 * et accord avec les données du monde et le moteur.
 */
import { describe, expect, it } from 'vitest';
import type { Action, EtatJeu, Evenement, Fait, Murmure, Registre, ResultatDuel, ResultatVoix, SourceMurmure, StatutRegion, TypeEvenement } from '@sauron/engine';
import { appliquer, creerPartie, indexerMonde } from '@sauron/engine';
import { eriador } from '@sauron/world';
import {
  BANQUE_FR,
  clesFait,
  construireMurmure,
  gabaritsMurmure,
  issueVoix,
  NarrateurBanque,
  remplir,
  revelationFin,
  revelationsCanon,
  tempsManche,
} from '../src';

const B = BANQUE_FR;
const monde = indexerMonde(eriador);
const noms = {
  personnages: Object.fromEntries(eriador.personnages.map((p) => [p.id, p.nom])),
  regions: Object.fromEntries(eriador.regions.map((r) => [r.id, r.nom])),
};
const surCarte = eriador.personnages.filter((p) => !p.horsCarte);
const SOURCES: SourceMurmure[] = ['espion', 'crebain', 'rumeur', 'nazgul', 'agent'];
const REGISTRES: Registre[] = ['paranoia', 'annatar', 'fer'];
const CATEGORIES = ['hobbit', 'rodeur', 'magicien', 'elfe', 'gens', 'ombre'] as const;
const STATUTS: StatutRegion[] = ['inquiete', 'sous_ombre', 'ecrasee', 'corrompue'];

/** Sous-types de faits que chaque source doit savoir dire, avec au moins trois variantes. */
const SOUS_TYPES = [
  'presence.groupe',
  ...CATEGORIES.map((c) => `presence.${c}`),
  ...CATEGORIES.map((c) => `absence.${c}`),
  ...STATUTS.map((s) => `terreur.${s}`),
  'passage_porteur.frais',
  'passage_porteur.ancien',
  'nazgul.un',
  'nazgul.plusieurs',
  'nazgul.nombreux',
];

/** Défauts de français qu'un remplissage ne doit jamais laisser. */
function defauts(t: string): string[] {
  const d: string[] = [];
  if (/[{}]/.test(t)) d.push('variable non remplie');
  if (/(^|[\s«])([àÀ]|[dD]e) [lL]es? [A-ZÉ]/.test(t)) d.push('contraction manquante');
  if (/(^|[\s«])(de|que) [AEIOUÉ]/.test(t)) d.push('élision manquante');
  if (/ {2}/.test(t)) d.push('double espace');
  if (/'/.test(t)) d.push('apostrophe droite');
  if (/[.!?…»] [a-zàéèêç]/.test(t)) d.push('phrase sans majuscule');
  if (!/^[«A-ZÀÉÈÊÎÔÇ(]/.test(t)) d.push('pas de majuscule initiale');
  return d;
}

const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ------------------------------------------------------------------ */

describe('murmures : couverture', () => {
  it('chaque source sait dire chaque sous-type de fait, en trois variantes au moins', () => {
    for (const s of SOURCES) for (const k of SOUS_TYPES) expect(B.murmures[s][k]?.length ?? 0, `${s}/${k}`).toBeGreaterThanOrEqual(3);
  });

  it('une quarantaine de clés de faits, et chaque région qui émet a sa couleur locale pour le calme', () => {
    const cles = new Set(SOURCES.flatMap((s) => Object.keys(B.murmures[s])));
    expect(cles.size).toBeGreaterThanOrEqual(38);
    for (const r of eriador.regions) {
      for (const s of r.sourcesMurmures) {
        const cle = gabaritsMurmure(B, { source: s, fait: { type: 'calme', region: r.id }, tour: 1, faitTexte: '' } as Murmure).cle;
        expect(cle, `${s} à ${r.id}`).toBe(`calme.${B.zones![r.id]}`);
      }
    }
  });

  it('chaque personnage a une catégorie, chaque région une zone et un nom de lieu', () => {
    for (const p of eriador.personnages) expect(B.categories?.[p.id], p.id).toBeTruthy();
    for (const r of eriador.regions) {
      expect(B.zones?.[r.id], r.id).toBeTruthy();
      expect(B.lieux?.[r.id], r.id).toBeTruthy();
    }
  });

  it('les clés vont du plus précis au plus général', () => {
    expect(clesFait(B, { type: 'terreur', region: 'bree', statut: 'inquiete' }, 1)).toEqual(['terreur.inquiete.bree', 'terreur.inquiete', 'terreur']);
    expect(clesFait(B, { type: 'presence', personnage: 'frodon', region: 'bree', nombre: 4 }, 1)).toEqual(['presence.groupe', 'presence.hobbit', 'presence']);
    expect(clesFait(B, { type: 'passage_porteur', region: 'bree', tour: 3 }, 8)).toEqual(['passage_porteur.ancien', 'passage_porteur']);
    expect(clesFait(B, { type: 'nazgul', region: 'bree', nombre: 9 }, 1)[0]).toBe('nazgul.nombreux');
  });
});

describe('murmures : ce que chaque source sait et ne sait pas', () => {
  const tous = (s: SourceMurmure) => Object.entries(B.murmures[s]).flatMap(([k, v]) => v.map((t) => ({ k, t })));

  it('les crébains ne savent pas les noms', () => {
    for (const { k, t } of tous('crebain')) expect(t, k).not.toContain('{qui}');
  });

  it('les Nazgûl voient les auras, pas le nombre de compagnons', () => {
    for (const { k, t } of tous('nazgul')) expect(t, k).not.toContain('{compagnons}');
  });

  it('chaque gabarit n’emploie que les variables de son fait', () => {
    const permises: Record<string, string[]> = {
      presence: ['qui', 'lieu', 'compagnons'],
      absence: ['qui', 'lieu'],
      terreur: ['lieu'],
      passage_porteur: ['lieu', 'jours'],
      nazgul: ['lieu', 'nombre'],
      calme: ['lieu'],
    };
    for (const s of SOURCES)
      for (const [k, v] of Object.entries(B.murmures[s]))
        for (const t of v) {
          const ok = permises[k.split('.')[0]!]!;
          if (k === 'nazgul.un') ok.splice(ok.indexOf('nombre'), 1, '__');
          for (const [, nom] of t.matchAll(/\{(\w+)\}/g)) expect(ok, `${s}/${k} : {${nom}} dans « ${t} »`).toContain(nom);
          if (k === 'nazgul.un') ok.splice(ok.indexOf('__'), 1, 'nombre');
        }
  });

  it('{lieu} ne commence une phrase que là où tous les lieux de la zone sont au singulier', () => {
    const sures = new Set(['comte', 'bree', 'riviere', 'route']);
    for (const s of SOURCES)
      for (const [k, v] of Object.entries(B.murmures[s])) {
        const zone = k.split('.').at(-1)!;
        for (const t of v) if (/(^|[.!?…] )\{lieu\}/.test(t)) expect(sures.has(zone), `${s}/${k} : « ${t} »`).toBe(true);
      }
  });
});

describe('murmures : remplis dans tous les cas, sans faute', () => {
  const nombre = (n: number) => B.nombres[n]!;
  /** Les valeurs possibles de chaque variable, pour remplir chaque gabarit de toutes les façons. */
  function remplissages(cle: string, regions: string[]): Record<string, string>[] {
    const type = cle.split('.')[0]!;
    const out: Record<string, string>[] = [];
    for (const r of regions) {
      const lieu = B.lieux![r]!;
      if (type === 'presence' || type === 'absence') {
        for (const p of eriador.personnages) for (const c of ['0', '3']) out.push({ lieu, qui: p.nom, compagnons: B.compagnons[c]! });
      } else if (type === 'nazgul') {
        for (const n of [1, 3, 9]) out.push({ lieu, nombre: nombre(n) });
      } else if (type === 'passage_porteur') {
        for (const jours of ['quelques heures', 'un jour', 'trois jours']) out.push({ lieu, jours });
      } else out.push({ lieu });
    }
    return out;
  }

  it('chaque gabarit, chaque lieu de sa zone, chaque nom : du français propre', () => {
    const fautes: string[] = [];
    for (const s of SOURCES)
      for (const [k, v] of Object.entries(B.murmures[s])) {
        const zone = k.split('.').length === 3 || k.startsWith('calme.') ? k.split('.').at(-1)! : null;
        const regions = eriador.regions.map((r) => r.id).filter((r) => !zone || B.zones![r] === zone);
        for (const t of v)
          for (const vars of remplissages(k, regions)) {
            const texte = majuscule(remplir(t, vars));
            for (const d of defauts(texte)) fautes.push(`${s}/${k} : ${d} : « ${t} » (ex. « ${texte} »)`);
          }
      }
    expect([...new Set(fautes)].slice(0, 60)).toEqual([]);
  });

  it('une partie de trente tours écrit chaque murmure depuis un gabarit, jamais depuis le fait brut', async () => {
    const n = new NarrateurBanque(noms);
    let etat = creerPartie(monde, 7);
    const vus = new Set<string>();
    for (let t = 0; t < 30 && etat.phase !== 'fin'; t++) {
      etat = appliquer(monde, etat, { type: 'poser_oeil', cible: { type: 'region', id: 'route_sarn' } });
      for (const m of etat.murmures) {
        if (vus.has(m.id)) continue;
        vus.add(m.id);
        expect(gabaritsMurmure(B, m).cle, m.id).not.toBe('brut');
        const texte = n.ecrireMurmure(m);
        expect(defauts(texte), texte).toEqual([]);
      }
      etat = appliquer(monde, etat, { type: 'fin_des_ordres' });
    }
    expect(vus.size).toBeGreaterThan(50);
  });

  it('chaque type de fait a ses déformations propres', () => {
    for (const t of ['presence', 'absence', 'terreur', 'passage_porteur', 'nazgul', 'calme'] as Fait['type'][]) {
      expect(B.deformationsParType?.[t]?.length, t).toBeGreaterThan(0);
      for (const d of B.deformationsParType![t]!) expect(d.startsWith(' ')).toBe(true);
    }
  });
});

/* ------------------------------------------------------------------ */

const voix = (cible: string, registre: Registre, reussie: boolean, extra: Partial<ResultatVoix> = {}): ResultatVoix => ({
  ordre: { type: 'voix', cible, registre },
  chance: 50,
  jet: 42,
  reussie,
  duel: null,
  detail: { mefiance: 0 },
  ...extra,
});

describe('réactions à la Voix', () => {
  it('chaque esprit de la carte a ses pensées pour chaque registre et chaque issue, en trois variantes', () => {
    for (const p of surCarte)
      for (const r of REGISTRES)
        for (const i of ['reussite', 'echec', 'retour'] as const) expect(B.personnages[p.id]?.[r]?.[i]?.length ?? 0, `${p.id}/${r}/${i}`).toBeGreaterThanOrEqual(3);
  });

  it('les réactions génériques couvrent les trois issues', () => {
    for (const r of REGISTRES) for (const i of ['reussite', 'echec', 'retour'] as const) expect(B.voix[r][i]?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it('l’issue : réussite, échec simple, ou échec qui démasque la Tour', () => {
    expect(issueVoix(voix('frodon', 'paranoia', true))).toBe('reussite');
    expect(issueVoix(voix('frodon', 'paranoia', false, { detail: { mefiance: -5 } }))).toBe('echec');
    // Méfiance 50 avant, +25 à l'échec : 75, l'alerte est donnée.
    expect(issueVoix(voix('frodon', 'paranoia', false, { detail: { mefiance: -25 } }))).toBe('retour');
    const duel = { cible: 'aragorn', puissance: 60, volonte: 80, manches: [], victoire: false, facteurRetour: 1, veriteApprise: 'x' } as ResultatDuel;
    expect(issueVoix(voix('aragorn', 'fer', false, { duel }))).toBe('retour');
    expect(issueVoix(voix('aragorn', 'fer', true, { duel: { ...duel, victoire: true } }))).toBe('reussite');
  });

  it('la pensée vient de la fiche du personnage, et ne laisse aucun trou', async () => {
    const n = new NarrateurBanque(noms);
    for (const p of surCarte)
      for (const r of REGISTRES)
        for (const [reussie, m] of [
          [true, 0],
          [false, 0],
          [false, -40],
        ] as const) {
          const res = voix(p.id, r, reussie, { detail: { mefiance: m } });
          const texte = await n.reactionVoix({ resultat: res, cible: { nom: p.nom, peur: p.peur, traits: p.traits }, murmureJoueur: null, faitsInterdits: [], journal: [] });
          expect(B.personnages[p.id]![r]![issueVoix(res)]).toContain(texte);
          expect(defauts(texte), texte).toEqual([]);
        }
  });

  it('les textes génériques se remplissent pour tout le monde', () => {
    for (const r of REGISTRES)
      for (const i of ['reussite', 'echec', 'retour'] as const)
        for (const t of B.voix[r][i]!) for (const p of eriador.personnages) expect(defauts(remplir(t, { qui: p.nom })), t).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */

describe('duel mental', () => {
  it('chaque moment du duel a ses fragments pour chaque approche et chaque issue', () => {
    for (const temps of ['premiere', 'seconde', 'decisive'] as const)
      for (const a of ['ecraser', 'insinuer', 'feindre'] as const)
        for (const i of ['gagnee', 'perdue'] as const) expect(B.duel.temps?.[temps]?.[a]?.[i]?.length ?? 0, `${temps}/${a}/${i}`).toBeGreaterThanOrEqual(2);
  });

  it('la dernière manche est toujours la décisive', () => {
    expect([0, 1].map((i) => tempsManche(i, 2))).toEqual(['premiere', 'decisive']);
    expect([0, 1, 2].map((i) => tempsManche(i, 3))).toEqual(['premiere', 'seconde', 'decisive']);
  });

  it('chaque esprit capable d’un duel (Volonté 60 et plus) a son final', () => {
    for (const p of surCarte.filter((x) => x.volonte >= 60)) {
      expect(B.duel.personnages?.[p.id]?.victoire?.length, p.id).toBeGreaterThan(0);
      expect(B.duel.personnages?.[p.id]?.defaite?.length, p.id).toBeGreaterThan(0);
    }
  });

  it('raconte un duel en trois manches, et un duel de regard avec son final propre', async () => {
    const n = new NarrateurBanque(noms);
    const duel: ResultatDuel = {
      cible: 'merry',
      puissance: 60,
      volonte: 45,
      manches: [
        { approche: 'ecraser', chance: 60, jet: 10, gagnee: true },
        { approche: 'insinuer', chance: 60, jet: 90, gagnee: false },
        { approche: 'feindre', chance: 60, jet: 95, gagnee: false },
      ],
      victoire: false,
      facteurRetour: 0.75,
      veriteApprise: 'Il ignore où est l’Anneau.',
    };
    const r = await n.narrerDuel(duel, 'Meriadoc Brandebouc');
    expect(B.duel.temps!.decisive!.feindre!.perdue).toContain(r.manches[2]!.replace('Meriadoc Brandebouc', '{qui}'));
    expect(r.final).toContain('Il ignore où est l’Anneau.');
    const regard = await n.narrerDuel({ ...duel, cible: 'elrond', manches: [duel.manches[1]!] }, 'Elrond');
    expect(B.duel.personnages!.elrond!.defaite!.map((t) => remplir(t, { verite: duel.veriteApprise! }))).toContain(regard.final);
    for (const t of [...r.manches, r.final, ...regard.manches, regard.final]) expect(defauts(t), t).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */

const evt = (type: TypeEvenement, texte: string, tour = 3, pub = true): Evenement => ({ type, tour, texte, public: pub });

describe('Journal de Barad-dûr', () => {
  it('chaque type d’événement qui va au Journal a son ouverture, chaque moment de l’acte sa clôture', () => {
    const types: TypeEvenement[] = ['deplacement_pnj', 'oeil', 'duel', 'murmures', 'nazgul', 'detection', 'pulsation', 'voix', 'combat', 'corruption', 'forme', 'seuil', 'fin'];
    for (const t of types) expect(B.journal.types?.[t]?.length, t).toBeGreaterThan(0);
    for (const m of ['debut', 'milieu', 'fin'] as const) expect(B.journal.clotures?.[m]?.length).toBeGreaterThanOrEqual(3);
  });

  it('ouvre sur l’événement le plus marquant, garde trois événements, ignore l’aube et ce qui est caché', async () => {
    const n = new NarrateurBanque(noms);
    const e = await n.ecrireJournal('24 septembre 3018', [
      evt('aube', 'Aube du 24 septembre 3018. Selon le cours prévu des choses : secret.'),
      evt('oeil', 'L’Œil se pose sur Bree.'),
      evt('essence', 'Essence +1.', 3, false),
      evt('nazgul', 'Khamûl fouille le Marais du Comté.'),
      evt('pulsation', 'PULSATION.'),
      evt('murmures', '5 murmures remontent vers la Tour.'),
    ]);
    expect(e.startsWith('24 septembre 3018.')).toBe(true);
    expect(B.journal.types!.pulsation!.some((o) => e.includes(o))).toBe(true);
    expect(e).toContain('PULSATION.');
    expect(e).toContain('Khamûl');
    expect(e).not.toContain('secret');
    expect(e).not.toContain('Essence');
    expect(e).not.toContain('murmures remontent');
    expect(B.journal.clotures!.debut.some((c) => e.endsWith(c))).toBe(true);
  });

  it('un jour vide, ou de simples phrases', async () => {
    const n = new NarrateurBanque(noms);
    const vide = await n.ecrireJournal('1er octobre 3018', []);
    expect(B.journal.vide.some((v) => vide === `1er octobre 3018. ${v}`)).toBe(true);
    expect(await n.ecrireJournal('1er octobre 3018', ['Une phrase.'])).toBe('1er octobre 3018. Une phrase.');
  });
});

/* ------------------------------------------------------------------ */

describe('« Dans une autre histoire… »', () => {
  const jalons = B.canon!.jalons;

  it('chaque jalon du calendrier canon a sa révélation, et chaque révélation tombe sur un jalon', () => {
    const tours = new Set(eriador.calendrier.map((j) => j.tour));
    for (const t of tours) expect(jalons.some((j) => j.tour === t), `tour ${t}`).toBe(true);
    for (const j of jalons) expect(tours.has(j.tour), j.id).toBe(true);
  });

  it('les textes sont au conditionnel, les identifiants existent', () => {
    const regions = new Set(eriador.regions.map((r) => r.id));
    const persos = new Set(eriador.personnages.map((p) => p.id));
    for (const j of jalons) {
      for (const t of j.textes) {
        expect(t.startsWith('Dans une autre histoire,'), j.id).toBe(true);
        expect(defauts(t), t).toEqual([]);
      }
      for (const r of [...(j.condition.presents?.regions ?? []), ...(j.condition.nazgulDans ?? [])]) expect(regions.has(r), `${j.id} : ${r}`).toBe(true);
      for (const p of j.condition.presents?.personnages ?? []) expect(persos.has(p), `${j.id} : ${p}`).toBe(true);
    }
    for (const issue of ['victoire_noire', 'victoire_grise', 'statu_quo', 'ouest_s_eveille'] as const) expect(revelationFin(issue, 3)).toBeTruthy();
  });

  it('les conditions des personnages suivent l’itinéraire canon du monde', () => {
    for (const j of jalons) {
      for (const id of j.condition.presents?.personnages ?? []) {
        const it = eriador.personnages.find((p) => p.id === id)!.itineraire;
        const etape = [...it].reverse().find((e) => e.tour <= j.tour)!;
        expect(j.condition.presents!.regions, `${j.id} : ${id} est à ${etape.region} au tour ${j.tour}`).toContain(etape.region);
      }
    }
  });

  it('se révèle quand le livre dévie, et pas quand il suit son cours', () => {
    const base = creerPartie(monde, 11);
    const a8: EtatJeu = structuredClone({ ...base, tour: 8 });
    a8.personnages.frodon!.region = 'bree';
    a8.personnages.aragorn!.region = 'bree';
    expect(revelationsCanon(a8)).toEqual([]);
    a8.personnages.frodon!.region = 'chetwood';
    const r = revelationsCanon(a8);
    expect(r.map((x) => x.id)).toEqual(['poney_fringant']);
    expect(r[0]!.texte).toMatch(/^Dans une autre histoire/);
    expect(revelationsCanon(base, 1)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */

describe('constructeur de murmure', () => {
  const K = B.constructeur!;

  it('chaque secret du monde a son levier dans les trois registres', () => {
    for (const p of eriador.personnages) for (const s of p.secrets) for (const r of REGISTRES) expect(K.secrets[s.id]?.[r]?.length, `${s.id}/${r}`).toBeGreaterThan(0);
  });

  it('chaque esprit a son appel et ses leviers de peur', () => {
    for (const p of eriador.personnages) {
      expect(K.appels[p.id]?.length, p.id).toBeGreaterThan(0);
      for (const r of REGISTRES) if (!p.horsCarte) expect(K.peurs[p.id]?.[r]?.length, `${p.id}/${r}`).toBeGreaterThan(0);
    }
  });

  it('assemble une phrase propre pour chaque choix possible', () => {
    for (const p of eriador.personnages)
      for (const r of REGISTRES)
        for (const secret of [null, ...p.secrets]) {
          for (const fer of ['se_taire', 'livrer', 'deplacer'] as const) {
            const t = construireMurmure({ registre: r, cible: p.id, secret, peurConnue: true, allie: 'Samsagace Gamegie', ordreFer: fer === 'deplacer' ? { type: fer, region: 'bree' } : { type: fer }, lieu: 'Bree' });
            expect(defauts(t), t).toEqual([]);
            expect(t).toMatch(/[.!?]$/);
            if (r === 'paranoia') expect(t).toContain('Samsagace Gamegie');
            if (r === 'fer' && fer === 'deplacer') expect(t).toContain('Bree');
            if (secret) expect(t).toContain(remplir(K.secrets[secret.id]![r]![0]!, {}));
          }
        }
  });

  it('même choix, même phrase ; une autre tournure change la phrase', () => {
    const c = { registre: 'paranoia' as const, cible: 'frodon', secret: { id: 'sec_frodon_03' } };
    expect(construireMurmure(c)).toBe(construireMurmure(c));
    const tournures = new Set([0, 1, 2, 3, 4, 5].map((tournure) => construireMurmure({ ...c, tournure })));
    expect(tournures.size).toBeGreaterThan(1);
  });
});

/* ------------------------------------------------------------------ */

describe('partie complète', () => {
  it('trente tours sans Voix : le Journal s’écrit chaque jour, sans faute', async () => {
    const n = new NarrateurBanque(noms);
    let etat = creerPartie(monde, 3);
    const actions: Action[] = [{ type: 'poser_oeil', cible: { type: 'region', id: 'route_sarn' } }, { type: 'fin_des_ordres' }];
    for (let t = 0; t < 30 && etat.phase !== 'fin'; t++) {
      for (const a of actions) etat = appliquer(monde, etat, a);
      const jour = etat.journal.at(-1)!;
      const texte = await n.ecrireJournal(`jour ${jour.tour}`, jour.evenements);
      expect(defauts(majuscule(texte)), texte).toEqual([]);
    }
  });
});
