/**
 * Banc d'équilibrage : des joueurs automatiques aux stratégies opposées.
 *
 * Les bots jouent par `appliquer`, comme le client, et ne lisent que ce qu'un
 * joueur sait : la connaissance de Sauron (`etat.connaissance`), l'état de ses
 * propres Nazgûl, ses jauges, et le calendrier canon des livres (un joueur qui
 * connaît Tolkien sait par où passe Frodon). Ils ne lisent jamais la vraie
 * position du porteur, ni ses retards.
 */
import type { CibleOeil, EtatJeu, IdNazgul, IdRegion, Monde, Ordre } from '@sauron/engine';
import { aRegle, chanceVoix, distance, estimerPiste, personnage, region, REGLES, voixAPortee } from '@sauron/engine';

export interface Bot {
  nom: string;
  description: string;
  oeil(monde: Monde, etat: EtatJeu): CibleOeil;
  /** Ordres proposés dans l'ordre ; ceux que le moteur refuse sont ignorés. */
  ordres(monde: Monde, etat: EtatJeu): Ordre[];
}

const PORTEUR = 'frodon';

/* ------------------------------------------------------------------ */
/* Ce que le joueur peut savoir                                        */
/* ------------------------------------------------------------------ */

/** Région où le calendrier canon place le porteur au tour donné. */
export function regionCanon(monde: Monde, tour: number): IdRegion {
  const it = personnage(monde, PORTEUR).itineraire;
  let r = it[0]!.region;
  for (const e of it) if (e.tour <= tour) r = e.region;
  return r;
}

/** Meilleure estimation du joueur : position exacte de ce tour, sinon carte de chaleur, sinon calendrier. */
export function cibleProbable(monde: Monde, etat: EtatJeu): { region: IdRegion; exacte: boolean } {
  const brute = cibleBrute(monde, etat);
  // Personne ne poursuit le porteur dans le sanctuaire : la crue du Bruinen y attend les Neuf.
  if (aRegle(region(monde, brute.region), 'sanctuaire')) return { region: region(monde, brute.region).voisins[0]!.id, exacte: false };
  return brute;
}

function cibleBrute(monde: Monde, etat: EtatJeu): { region: IdRegion; exacte: boolean } {
  const c = etat.connaissance.anneau;
  if (c && c.exact && c.tour === etat.tour) return { region: c.region, exacte: true };
  const pos = etat.connaissance.positions[PORTEUR];
  if (pos && pos.tour === etat.tour) return { region: pos.region, exacte: true };
  const est = estimerPiste(monde, etat);
  if (est.certitude >= 0.35) return { region: est.regionProbable, exacte: false };
  return { region: regionCanon(monde, etat.tour), exacte: false };
}

const nazgulLibres = (etat: EtatJeu) => Object.values(etat.nazgul).filter((n) => n.indisponibleJusquA < etat.tour);

/** L'Œil du chasseur : sur Frodon dès qu'on le connaît, sinon sur la région la plus probable. */
function oeilChasseur(monde: Monde, etat: EtatJeu): CibleOeil {
  if (etat.connaissance.personnagesConnus.includes(PORTEUR)) return { type: 'personnage', id: PORTEUR };
  return { type: 'region', id: cibleProbable(monde, etat).region };
}

/** Nazgûl triés du plus proche au plus lointain d'une région. */
function parProximite(monde: Monde, etat: EtatJeu, cible: IdRegion) {
  return nazgulLibres(etat).sort((a, b) => distance(monde, a.region, cible) - distance(monde, b.region, cible));
}

const aller = (nazgul: IdNazgul, destination: IdRegion): Ordre => ({ type: 'nazgul_deplacer', nazgul, destination });

/** Embusque d'abord ceux qui sont déjà sur place (l'embuscade se tend sans chevaucher), puis fait marcher les autres. */
function tapirPuisMarcher(o: Ordre[]): Ordre[] {
  const tapis = new Set(o.filter((x) => x.type === 'nazgul_embuscade').map((x) => ('nazgul' in x ? x.nazgul : '')));
  return [...o.filter((x) => x.type !== 'nazgul_deplacer'), ...o.filter((x) => x.type === 'nazgul_deplacer' && !tapis.has(x.nazgul))];
}

/** Petit hasard déterministe propre au bot (pour le bot aléatoire). */
function hasard(etat: EtatJeu, sel: number): number {
  let x = (etat.graine * 7919 + etat.tour * 104729 + sel * 15485863) >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) / 4294967296;
}

/* ------------------------------------------------------------------ */
/* Les bots                                                            */
/* ------------------------------------------------------------------ */

/** Ne fait que regarder. Sert de témoin : la Visibilité doit redescendre. */
export const passif: Bot = {
  nom: 'passif',
  description: 'Pose l’Œil chaque tour et ne donne aucun ordre.',
  oeil: oeilChasseur,
  ordres: () => [],
};

/** Le bot qui cassait l'équilibre : tous les Nazgûl foncent vers le porteur et s'embusquent, à chaque tour. */
export const embusqueur: Bot = {
  nom: 'embusqueur',
  description: 'Tous les Nazgûl convergent vers le porteur et posent une embuscade chaque tour, sans regarder la Visibilité.',
  oeil: oeilChasseur,
  ordres(monde, etat) {
    const { region } = cibleProbable(monde, etat);
    const o: Ordre[] = [];
    for (const n of parProximite(monde, etat, region)) {
      o.push(n.region === region ? { type: 'nazgul_embuscade', nazgul: n.id } : aller(n.id, region));
    }
    return o;
  },
};

/** Variante « partout » : les Nazgûl s'étalent sur la route canon et y tiennent des embuscades permanentes. */
export const barrage: Bot = {
  nom: 'barrage',
  description: 'Étale les Nazgûl sur les régions canon des prochains jours et y renouvelle les embuscades.',
  oeil: oeilChasseur,
  ordres(monde, etat) {
    const etapes = [0, 1, 2, 3, 5].map((k) => regionCanon(monde, etat.tour + k));
    const o: Ordre[] = [];
    nazgulLibres(etat).forEach((n, i) => {
      const r = etapes[i % etapes.length]!;
      o.push(n.region === r ? { type: 'nazgul_embuscade', nazgul: n.id } : aller(n.id, r));
    });
    return o;
  },
};

/** Fouille sans relâche : Traque partout où le porteur peut être, embuscade seulement quand il est localisé. */
export const traqueur: Bot = {
  nom: 'traqueur',
  description: 'Traque autour de la position estimée ; embusque les Nazgûl déjà sur place quand la position est exacte.',
  oeil: oeilChasseur,
  ordres(monde, etat) {
    const { region, exacte } = cibleProbable(monde, etat);
    const o: Ordre[] = [];
    for (const n of parProximite(monde, etat, region)) {
      if (exacte && n.region === region) o.push({ type: 'nazgul_embuscade', nazgul: n.id });
      else {
        o.push(aller(n.id, region));
        o.push({ type: 'nazgul_traque', nazgul: n.id });
      }
    }
    return o;
  },
};

/** Tout par la Voix : ronger Frodon et ses compagnons, les Nazgûl ne servent que de relais. */
export const voix: Bot = {
  nom: 'voix',
  description: 'Paranoïa sur Frodon (avec ses secrets), Promesse et Commandement sur Pippin ; Nazgûl en relais.',
  oeil(monde, etat) {
    return oeilChasseur(monde, etat);
  },
  ordres(monde, etat) {
    const { region } = cibleProbable(monde, etat);
    const o: Ordre[] = [];
    // Relais : les Nazgûl suivent à une région de distance.
    for (const n of parProximite(monde, etat, region)) o.push(aller(n.id, region));
    const secret = etat.connaissance.secrets.filter((s) => s.personnage === PORTEUR).at(-1);
    const cibles: Ordre[] = [
      { type: 'voix', cible: PORTEUR, registre: 'paranoia', allie: 'sam', secret: secret?.id },
      { type: 'voix', cible: 'pippin', registre: etat.personnages['pippin']?.dette ? 'fer' : 'annatar', ordreFer: { type: 'livrer' } },
      { type: 'voix', cible: 'merry', registre: 'paranoia', allie: 'frodon' },
      { type: 'voix', cible: 'sam', registre: 'paranoia', allie: 'frodon' },
    ];
    for (const c of cibles) if (c.type === 'voix' && etat.connaissance.personnagesConnus.includes(c.cible) && voixAPortee(monde, etat, c.cible)) o.push(c);
    // Un Nazgûl embusqué sur place quand le porteur est vu, pour profiter du Doute.
    const exact = cibleProbable(monde, etat);
    if (exact.exacte) {
      const ici = nazgulLibres(etat).filter((n) => n.region === region);
      for (const n of ici.slice(0, 2)) o.push({ type: 'nazgul_embuscade', nazgul: n.id });
    }
    return tapirPuisMarcher(o);
  },
};

/** La terreur avant tout : Cris (gratuits en PA) et Traques, sans retenue. */
export const terreur: Bot = {
  nom: 'terreur',
  description: 'Chaque Nazgûl crie ou traque à chaque tour près du porteur.',
  oeil: oeilChasseur,
  ordres(monde, etat) {
    const { region } = cibleProbable(monde, etat);
    const o: Ordre[] = [];
    parProximite(monde, etat, region).forEach((n, i) => {
      o.push(aller(n.id, region));
      o.push(i < 4 ? { type: 'nazgul_traque', nazgul: n.id } : { type: 'nazgul_cri', nazgul: n.id });
    });
    return o;
  },
};

/** Dernier tour où une embuscade a frappé (le joueur le lit dans le Journal). */
function derniereEmbuscade(etat: EtatJeu): number {
  for (let i = etat.journal.length - 1; i >= 0; i--) {
    if (etat.journal[i]!.evenements.some((e) => e.type === 'combat')) return etat.journal[i]!.tour;
  }
  return -Infinity;
}

/**
 * Frappe en meute, une fois la vigilance du groupe retombée, si la jauge le permet.
 * `vMax` : au-dessus, on ne frappe plus ; `meute` : Nazgûl sur place requis.
 */
function chasseRaisonnee(monde: Monde, etat: EtatJeu, opts: { vMax: number; meute: number; traques: number; voix: boolean }): Ordre[] {
  const v = etat.jauges.visibilite;
  const { region, exacte } = cibleProbable(monde, etat);
  // Le rendez-vous : là où le calendrier canon mène le porteur demain, s'il est à une région de sa position.
  const demain = regionCanon(monde, etat.tour + 1);
  const rdv = exacte && demain !== region && distance(monde, region, demain) === 1 && demain !== 'fondcombe' ? demain : region;
  const o: Ordre[] = [];
  const proches = parProximite(monde, etat, rdv);
  for (const n of proches) o.push(aller(n.id, rdv));
  // Qui sera sur place à la nuit (vitesse 2, approximée par la distance en régions).
  const meute = proches.filter((n) => distance(monde, n.region, rdv) <= 1);
  const repos = etat.tour - derniereEmbuscade(etat) > REGLES.nazgul.combat.vigilance.duree;
  // Une seule embuscade suffit : la meute se joint à l'assaut. Elle se tend là où l'on est déjà,
  // et de préférence par le Roi-Sorcier, seul porteur de la lame.
  const tapis = meute.filter((n) => n.region === rdv);
  const chef = tapis.find((n) => n.id === 'roi_sorcier') ?? tapis[0];
  const avecRoi = chef?.id === 'roi_sorcier';
  if (chef && exacte && repos && v <= opts.vMax && meute.length >= opts.meute + (avecRoi ? 0 : 1)) {
    o.push({ type: 'nazgul_embuscade', nazgul: chef.id, cible: PORTEUR });
  } else if (!exacte && v <= opts.vMax - 15) {
    for (const n of meute.slice(0, opts.traques)) o.push({ type: 'nazgul_traque', nazgul: n.id });
  }
  const secret = etat.connaissance.secrets.find((s) => s.personnage === PORTEUR && s.tour >= etat.tour - 1);
  if (opts.voix && secret && v <= opts.vMax - 10 && voixAPortee(monde, etat, PORTEUR)) {
    o.push({ type: 'voix', cible: PORTEUR, registre: 'paranoia', allie: 'sam', secret: secret.id });
  }
  return tapirPuisMarcher(o);
}

/**
 * Le joueur raisonnable : il regarde la jauge. Il rassemble les Neuf autour du
 * porteur, ne frappe qu'avec une meute (dont le Roi-Sorcier si possible), laisse
 * retomber la vigilance du groupe entre deux coups, et se retient près de 100.
 */
export const stratege: Bot = {
  nom: 'stratège',
  description: 'Rassemble les Neuf, frappe en meute quand la position est sûre et la vigilance retombée, garde de la marge sous 100.',
  oeil: oeilChasseur,
  ordres: (monde, etat) => chasseRaisonnee(monde, etat, { vMax: 80, meute: 4, traques: 2, voix: true }),
};

/** Un joueur prudent : reste sous V 60, n'agit qu'à coup sûr et en grand nombre. */
export const prudent: Bot = {
  nom: 'prudent',
  description: 'Ne frappe qu’avec cinq Nazgûl sur position exacte, et jamais au-dessus de V 50.',
  oeil: oeilChasseur,
  ordres: (monde, etat) => chasseRaisonnee(monde, etat, { vMax: 50, meute: 5, traques: 0, voix: false }),
};

/** Entre le stratège et l'embusqueur : frappe dès qu'il a trois Nazgûl sur place, sans attendre, jusqu'à V 90. */
export const agressif: Bot = {
  nom: 'agressif',
  description: 'Frappe dès que trois Nazgûl sont sur la position exacte, sans laisser retomber la vigilance, jusqu’à V 90.',
  oeil: oeilChasseur,
  ordres(monde, etat) {
    const { region, exacte } = cibleProbable(monde, etat);
    const o: Ordre[] = [];
    const proches = parProximite(monde, etat, region);
    for (const n of proches) o.push(aller(n.id, region));
    const surPlace = proches.filter((n) => distance(monde, n.region, region) <= 1);
    const tapis = surPlace.filter((n) => n.region === region);
    const chef = tapis.find((n) => n.id === 'roi_sorcier') ?? tapis[0];
    if (chef && exacte && surPlace.length >= 3 && etat.jauges.visibilite <= 90) o.push({ type: 'nazgul_embuscade', nazgul: chef.id, cible: PORTEUR });
    return tapirPuisMarcher(o);
  },
};

/**
 * La Voix mesurée : une Paranoïa par tour sur Frodon quand ses chances sont
 * correctes, appuyée sur les secrets que l'Œil arrache ; les Nazgûl suivent en
 * relais et ne frappent qu'en meute, une fois la vigilance retombée.
 */
export const murmureur: Bot = {
  nom: 'murmureur',
  description: 'Une Voix bien préparée par tour (secret frais, chance ≥ 35 %), la chasse en appoint, jusqu’à V 80.',
  oeil: oeilChasseur,
  ordres(monde, etat) {
    const o = chasseRaisonnee(monde, etat, { vMax: 70, meute: 4, traques: 0, voix: false });
    o.sort((a, b) => Number(a.type === 'nazgul_deplacer') - Number(b.type === 'nazgul_deplacer'));
    if (etat.jauges.visibilite > 80 || !etat.connaissance.personnagesConnus.includes(PORTEUR) || !voixAPortee(monde, etat, PORTEUR)) return o;
    const secret = etat.connaissance.secrets.filter((s) => s.personnage === PORTEUR).at(-1);
    const voix: Ordre = { type: 'voix', cible: PORTEUR, registre: 'paranoia', allie: 'sam', secret: secret?.id };
    if (voix.type === 'voix' && chanceVoix(monde, etat, voix).chance >= 35) o.push(voix);
    return o;
  },
};

/** Ordres tirés au hasard parmi les ordres plausibles. Sert de bruit de fond. */
export const aleatoire: Bot = {
  nom: 'aléatoire',
  description: 'Œil et ordres au hasard, dans la limite des PA.',
  oeil(monde, etat) {
    const regions = [...monde.regions.values()].filter((r) => !r.horsCarte).map((r) => r.id);
    if (hasard(etat, 1) < 0.5) return oeilChasseur(monde, etat);
    return { type: 'region', id: regions[Math.floor(hasard(etat, 2) * regions.length)]! };
  },
  ordres(monde, etat) {
    const regions = [...monde.regions.values()].filter((r) => !r.horsCarte).map((r) => r.id);
    const o: Ordre[] = [];
    nazgulLibres(etat).forEach((n, i) => {
      if (hasard(etat, 10 + i) < 0.6) o.push(aller(n.id, regions[Math.floor(hasard(etat, 20 + i) * regions.length)]!));
      const x = hasard(etat, 30 + i);
      if (x < 0.25) o.push({ type: 'nazgul_traque', nazgul: n.id });
      else if (x < 0.45) o.push({ type: 'nazgul_embuscade', nazgul: n.id });
      else if (x < 0.55) o.push({ type: 'nazgul_cri', nazgul: n.id });
    });
    return o;
  },
};

export const BOTS: Bot[] = [passif, prudent, stratege, murmureur, agressif, traqueur, embusqueur, barrage, voix, terreur, aleatoire];

