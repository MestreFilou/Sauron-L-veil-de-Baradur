import type {
  Approche,
  EtatJeu,
  EtiquettesTexteLibre,
  Evenement,
  Fait,
  IdPersonnage,
  IdRegion,
  IssueActe,
  Murmure,
  OrdreFer,
  Registre,
  ResultatDuel,
  ResultatVoix,
  Secret,
  TypeEvenement,
} from '@sauron/engine';
import { hacher, REGLES } from '@sauron/engine';
import banqueFr from '../banque/fr.json';
import type { ContexteVoix, Narrateur } from './narrateur';
import type { promptAnalyse } from './prompts';

type Variantes = string[];

/** Les trois issues d'une Voix : réussite, échec simple, et échec qui démasque la Tour (la cible reconnaît l'Ennemi). */
export type IssueVoix = 'reussite' | 'echec' | 'retour';
type ParIssue = Partial<Record<IssueVoix, Variantes>>;
type ParApproche = Record<Approche, { gagnee: Variantes; perdue: Variantes }>;

/** Moment d'une manche dans le duel : la première, celle du milieu, la dernière (celle qui tranche). */
export type TempsDuel = 'premiere' | 'seconde' | 'decisive';

/** Catégorie d'un personnage, pour choisir le bon gabarit de murmure (un crébain ne sait pas les noms). */
export type Categorie = 'hobbit' | 'rodeur' | 'magicien' | 'elfe' | 'gens' | 'ombre';
/** Zone d'une région, pour la couleur locale des murmures (« calme.comte », « terreur.inquiete.bree »). */
export type Zone = 'comte' | 'foret' | 'bree' | 'sauvage' | 'riviere' | 'route' | 'lointain';

/** Condition d'un jalon canon : tout doit être vrai pour que l'événement du livre ait lieu. */
export interface ConditionCanon {
  /** Ces personnages doivent se trouver dans cette région (ou l'une de ces régions). */
  presents?: { personnages: IdPersonnage[]; regions: IdRegion[] };
  /** Au moins un Nazgûl disponible dans l'une de ces régions. */
  nazgulDans?: IdRegion[];
}

export interface JalonDevie {
  tour: number;
  id: string;
  condition: ConditionCanon;
  /** « Dans une autre histoire… », au conditionnel passé. */
  textes: Variantes;
}

export interface Banque {
  /**
   * Gabarits par source puis par clé de fait. La clé la plus précise gagne :
   * « terreur.inquiete.bree », puis « terreur.inquiete », puis « terreur ».
   */
  murmures: Record<Murmure['source'], Record<string, Variantes>>;
  deformations: Variantes;
  /** Déformations propres à un type de fait, préférées aux génériques. */
  deformationsParType?: Partial<Record<Fait['type'], Variantes>>;
  compagnons: Record<string, string>;
  nombres: string[];
  categories?: Record<IdPersonnage, Categorie>;
  zones?: Record<IdRegion, Zone>;
  voix: Record<Registre, ParIssue & { reussite: Variantes; echec: Variantes }>;
  personnages: Record<string, Partial<Record<Registre, ParIssue>>>;
  duel: ParApproche & {
    victoire: Variantes;
    defaite: Variantes;
    /** Fragments par moment du duel ; à défaut, les fragments par approche ci-dessus. */
    temps?: Partial<Record<TempsDuel, Partial<ParApproche>>>;
    /** Duel de regard (une seule manche, l'Œil contre un Sage). */
    regard?: { victoire: Variantes; defaite: Variantes };
    /** Final propre à un esprit. */
    personnages?: Record<IdPersonnage, { victoire?: Variantes; defaite?: Variantes }>;
  };
  journal: {
    vide: Variantes;
    /** Phrase d'ouverture selon l'événement le plus marquant du jour. */
    types?: Partial<Record<TypeEvenement, Variantes>>;
    /** Phrase de clôture selon le moment de l'acte. */
    clotures?: Record<'debut' | 'milieu' | 'fin', Variantes>;
  };
  /** Nom de lieu à glisser dans une phrase (« le Bois de Chet », « Bree »), par région. */
  lieux?: Record<string, string>;
  /** Les événements du livre que Sauron peut faire dévier, et ce qui se serait passé « dans une autre histoire ». */
  canon?: { jalons: JalonDevie[]; fins: Record<IssueActe, Variantes> };
  /** Le constructeur de murmure (remplace le texte libre). */
  constructeur?: Constructeur;
}

export interface Constructeur {
  /** Comment la Voix interpelle chaque esprit. */
  appels: Record<IdPersonnage, Variantes>;
  appelDefaut: Variantes;
  /** Leviers par secret révélé, puis par registre. */
  secrets: Record<string, Partial<Record<Registre, Variantes>>>;
  /** Leviers par peur connue, par personnage puis registre. */
  peurs: Record<IdPersonnage, Partial<Record<Registre, Variantes>>>;
  /** Leviers sans secret ni peur. */
  generique: Record<Registre, Variantes>;
  /** Paranoïa dirigée contre un allié ({allie}). */
  allie: Variantes;
  /** Ce que le Commandement ordonne ({lieu} pour « deplacer »). */
  fer: Record<OrdreFer['type'], Variantes>;
  /** Mot de la fin, par registre. */
  clotures: Record<Registre, Variantes>;
}

export const BANQUE_FR = banqueFr as unknown as Banque;

/** Noms lisibles, pour remplir les gabarits (la banque ne connaît que des identifiants). */
export interface Noms {
  personnages: Record<string, string>;
  regions: Record<string, string>;
}

const ELIDABLES = new Set(['de', 'que', 'le', 'la', 'ne', 'se', 'je', 'me', 'te']);

/** Joint un mot et la valeur qui le suit : « à » + « le Comté » → « au Comté », « de » + « Aragorn » → « d’Aragorn ». */
function joindre(mot: string, valeur: string): string {
  const m = mot.toLowerCase();
  const maj = (x: string) => (mot[0] === mot[0]!.toUpperCase() ? x.charAt(0).toUpperCase() + x.slice(1) : x);
  if (m === 'à' || m === 'de') {
    const art = /^([lL]es?) (.*)$/.exec(valeur);
    const le = art?.[1]!.toLowerCase() === 'le';
    if (art) return maj(`${m === 'à' ? (le ? 'au' : 'aux') : le ? 'du' : 'des'} ${art[2]}`);
  }
  if (ELIDABLES.has(m) && /^[aeiouéèêâîôûAEIOUÉÈÊÂÎÔÛ]/.test(valeur)) return `${mot.slice(0, -1)}’${valeur}`;
  return valeur ? `${mot} ${valeur}` : mot;
}

/**
 * Remplace {variable} ; une variable absente reste vide. Contracte et élide
 * au point de jonction seulement (« à {lieu} » avec « les Galgals » donne
 * « aux Galgals »), jamais dans le texte écrit à la main (« de les diviser »).
 * Une phrase qui commence par une variable prend sa majuscule.
 */
export function remplir(gabarit: string, vars: Record<string, string>): string {
  return gabarit
    .replace(/(^|[\s«(’'])([àÀ]|[dD]e|[qQ]ue|[lL][ea]|[nNsSjJmMtT]e) \{(\w+)\}|\{(\w+)\}/g, (_, avant: string | undefined, mot: string | undefined, k1: string | undefined, k2: string | undefined) =>
      k1 !== undefined ? `${avant}${joindre(mot!, vars[k1] ?? '')}` : (vars[k2!] ?? ''),
    )
    .replace(/ {2,}/g, ' ')
    .replace(/ ([.,])/g, '$1')
    .replace(/([.!?] )([a-zàâçéèêîôû])/g, (_, a: string, b: string) => a + b.toUpperCase());
}

/** Contractions du français dans un texte déjà rempli : « à le Comté » → « au Comté », « de les Galgals » → « des Galgals ». */
export function contracter(s: string): string {
  return s
    .replace(/(^|[\s«(’'])à le /g, '$1au ')
    .replace(/(^|[\s«(’'])à les /g, '$1aux ')
    .replace(/(^|[\s«(’'])de le /g, '$1du ')
    .replace(/(^|[\s«(’'])de les /g, '$1des ')
    .replace(/(^|[\s«(’'])À le /g, '$1Au ')
    .replace(/(^|[\s«(’'])À les /g, '$1Aux ');
}

/** Choix de variante déterministe : le même murmure donne toujours le même texte. */
export function variante(liste: Variantes, ...cle: (string | number)[]): string {
  if (!liste.length) return '';
  return liste[hacher(...cle) % liste.length]!;
}

const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ------------------------------------------------------------------ */
/* Murmures : du fait à la clé de gabarit                              */
/* ------------------------------------------------------------------ */

/** Clés de gabarit d'un fait, de la plus précise à la plus générale. */
export function clesFait(banque: Banque, fait: Fait, tourCourant: number): string[] {
  const zone = banque.zones?.[fait.region];
  const cat = 'personnage' in fait ? banque.categories?.[fait.personnage] : undefined;
  const cles: string[] = [];
  switch (fait.type) {
    case 'presence':
      if ((fait.nombre ?? 1) > 1) cles.push('presence.groupe');
      if (cat) cles.push(`presence.${cat}`);
      break;
    case 'absence':
      if (cat) cles.push(`absence.${cat}`);
      break;
    case 'terreur':
      if (zone) cles.push(`terreur.${fait.statut}.${zone}`);
      cles.push(`terreur.${fait.statut}`);
      break;
    case 'passage_porteur':
      cles.push(tourCourant - fait.tour <= 1 ? 'passage_porteur.frais' : 'passage_porteur.ancien');
      break;
    case 'nazgul':
      cles.push(fait.nombre <= 1 ? 'nazgul.un' : fait.nombre <= 4 ? 'nazgul.plusieurs' : 'nazgul.nombreux');
      break;
    case 'calme':
      if (zone) cles.push(`calme.${zone}`);
      break;
  }
  cles.push(fait.type);
  return cles;
}

/** Les gabarits retenus pour un murmure : ceux de la clé la plus précise qui en a. */
export function gabaritsMurmure(banque: Banque, m: Murmure): { cle: string; liste: Variantes } {
  const parSource = banque.murmures[m.source] ?? {};
  for (const cle of clesFait(banque, m.fait, m.tour)) {
    const liste = parSource[cle];
    if (liste?.length) return { cle, liste };
  }
  return { cle: 'brut', liste: [m.faitTexte] };
}

/* ------------------------------------------------------------------ */
/* Voix                                                                */
/* ------------------------------------------------------------------ */

/**
 * L'issue d'une Voix telle que la banque la raconte. « retour » : l'échec
 * démasque la Tour (duel perdu, ou Méfiance qui franchit le seuil d'alerte).
 */
export function issueVoix(r: ResultatVoix): IssueVoix {
  if (r.reussie) return 'reussite';
  if (r.duel) return r.duel.victoire ? 'reussite' : 'retour';
  const mefianceAvant = Math.round(-(r.detail.mefiance ?? 0) / REGLES.mefiance.facteurVoix);
  return mefianceAvant + REGLES.mefiance.voixRatee >= REGLES.mefiance.alerte.seuil ? 'retour' : 'echec';
}

/* ------------------------------------------------------------------ */
/* Duel                                                                */
/* ------------------------------------------------------------------ */

export function tempsManche(i: number, total: number): TempsDuel {
  if (i === 0) return 'premiere';
  return i === total - 1 ? 'decisive' : 'seconde';
}

/* ------------------------------------------------------------------ */
/* Journal                                                             */
/* ------------------------------------------------------------------ */

/** Du plus marquant au plus banal ; l'aube et l'Essence ne vont jamais au Journal. */
const PRIORITE_JOURNAL: TypeEvenement[] = [
  'fin',
  'combat',
  'pulsation',
  'detection',
  'duel',
  'corruption',
  'forme',
  'voix',
  'seuil',
  'nazgul',
  'oeil',
  'murmures',
  'deplacement_pnj',
];

export function momentActe(tour: number): 'debut' | 'milieu' | 'fin' {
  if (tour <= 9) return 'debut';
  return tour <= 20 ? 'milieu' : 'fin';
}

/* ------------------------------------------------------------------ */
/* « Dans une autre histoire… »                                        */
/* ------------------------------------------------------------------ */

function conditionTenue(etat: EtatJeu, c: ConditionCanon): boolean {
  if (c.presents) {
    for (const id of c.presents.personnages) {
      const p = etat.personnages[id];
      if (!p || p.sortiDeJeu || !c.presents.regions.includes(p.region)) return false;
    }
  }
  if (c.nazgulDans) {
    const ok = Object.values(etat.nazgul).some((n) => n.indisponibleJusquA < etat.tour && c.nazgulDans!.includes(n.region));
    if (!ok) return false;
  }
  return true;
}

/**
 * Les événements du livre que la partie a fait dévier au tour donné (le tour
 * courant par défaut). À appeler pendant le tour du jalon, après l'aube : la
 * condition se lit sur l'état réel. Le client choisit quand l'afficher (le
 * soir même, ou quelques tours plus tard pour ne rien trahir des positions).
 */
export function revelationsCanon(etat: EtatJeu, tour = etat.tour, banque: Banque = BANQUE_FR): { id: string; tour: number; texte: string }[] {
  return (banque.canon?.jalons ?? [])
    .filter((j) => j.tour === tour && !conditionTenue(etat, j.condition))
    .map((j) => ({ id: j.id, tour: j.tour, texte: variante(j.textes, etat.graine, j.id) }));
}

/** Ce qui se serait passé dans le livre, affiché à la fin de l'acte. */
export function revelationFin(issue: IssueActe, graine = 0, banque: Banque = BANQUE_FR): string {
  return variante(banque.canon?.fins[issue] ?? [], graine, issue);
}

/* ------------------------------------------------------------------ */
/* Constructeur de murmure (remplace le texte libre)                   */
/* ------------------------------------------------------------------ */

export interface ChoixMurmure {
  registre: Registre;
  cible: IdPersonnage;
  /** Secret révélé par l'Œil, sur lequel la Voix s'appuie. */
  secret?: Pick<Secret, 'id'> | null;
  /** La peur de la cible est connue de la Tour. */
  peurConnue?: boolean;
  /** Paranoïa : nom de l'allié contre qui monter la cible. */
  allie?: string | null;
  ordreFer?: OrdreFer;
  /** Nom de lieu pour « deplacer ». */
  lieu?: string;
  /** Change la variante (bouton « une autre tournure »). */
  tournure?: number;
}

/**
 * Assemble la phrase que la Voix murmure, à partir des choix du joueur :
 * appel, levier (secret, sinon peur, sinon générique), allié ou ordre, clôture.
 * Le texte n'influe jamais sur les chances : seuls les choix comptent.
 */
export function construireMurmure(c: ChoixMurmure, banque: Banque = BANQUE_FR): string {
  const k = banque.constructeur;
  if (!k) return '';
  const t = c.tournure ?? 0;
  const v = (liste: Variantes | undefined, ...cle: (string | number)[]) => (liste?.length ? variante(liste, c.cible, c.registre, t, ...cle) : '');
  const appel = v(k.appels[c.cible]?.length ? k.appels[c.cible] : k.appelDefaut, 'appel');
  const levier =
    (c.secret && v(k.secrets[c.secret.id]?.[c.registre], 'secret', c.secret.id)) ||
    (c.peurConnue && v(k.peurs[c.cible]?.[c.registre], 'peur')) ||
    v(k.generique[c.registre], 'generique');
  const morceaux = [`${appel}…`, levier];
  if (c.registre === 'paranoia' && c.allie) morceaux.push(v(k.allie, 'allie'));
  if (c.registre === 'fer') morceaux.push(v(k.fer[c.ordreFer?.type ?? 'se_taire'], 'fer'));
  morceaux.push(v(k.clotures[c.registre], 'cloture'));
  return majuscule(remplir(morceaux.filter(Boolean).join(' '), { allie: c.allie ?? '', lieu: c.lieu ?? '' }));
}

/* ------------------------------------------------------------------ */
/* Le narrateur                                                        */
/* ------------------------------------------------------------------ */

/**
 * Narrateur par banque de textes préécrits. C'est le narrateur par défaut :
 * le jeu se joue entièrement sans IA. Écrire de nouvelles variantes dans
 * banque/fr.json suffit à enrichir le jeu.
 */
export class NarrateurBanque implements Narrateur {
  constructor(
    private readonly noms: Noms,
    private readonly banque: Banque = BANQUE_FR,
  ) {}

  private varsFait(m: Murmure, tourCourant: number): Record<string, string> {
    const f = m.fait;
    const vars: Record<string, string> = { lieu: this.banque.lieux?.[f.region] ?? this.noms.regions[f.region] ?? f.region };
    if ('personnage' in f) vars.qui = this.noms.personnages[f.personnage] ?? f.personnage;
    if (f.type === 'presence') vars.compagnons = this.banque.compagnons[String((f.nombre ?? 1) - 1)] ?? '';
    if (f.type === 'nazgul') vars.nombre = this.banque.nombres[f.nombre] ?? String(f.nombre);
    if (f.type === 'passage_porteur') {
      const j = Math.max(0, tourCourant - f.tour);
      vars.jours = j === 0 ? 'quelques heures' : j === 1 ? 'un jour' : `${this.banque.nombres[j] ?? j} jours`;
    }
    return vars;
  }

  /** Texte d'un seul murmure (exposé pour les tests de cohérence). */
  ecrireMurmure(m: Murmure): string {
    const { liste } = gabaritsMurmure(this.banque, m);
    let texte = majuscule(remplir(variante(liste, m.id, 'texte'), this.varsFait(m, m.tour)));
    if (m.deformation) {
      const propres = this.banque.deformationsParType?.[m.fait.type];
      texte += variante(propres?.length ? propres : this.banque.deformations, m.id, 'deformation');
    }
    return texte;
  }

  async ecrireMurmures(murmures: Murmure[]): Promise<Record<string, string>> {
    return Object.fromEntries(murmures.map((m) => [m.id, this.ecrireMurmure(m)]));
  }

  /**
   * Entrée du Journal de Barad-dûr. Avec des événements du moteur, la banque
   * ouvre sur le plus marquant, garde les deux suivants et clôt selon le
   * moment de l'acte ; avec de simples phrases, elle les reprend telles quelles.
   */
  async ecrireJournal(date: string, evenements: (string | Evenement)[]): Promise<string> {
    const j = this.banque.journal;
    const evts = evenements.filter((e): e is Evenement => typeof e !== 'string');
    const phrases = evenements.filter((e): e is string => typeof e === 'string');
    if (!evts.length) {
      if (!phrases.length) return `${date}. ${variante(j.vide, date)}`;
      return `${date}. ${phrases.slice(0, 3).join(' ')}`;
    }
    const retenus = evts
      .filter((e) => e.public && PRIORITE_JOURNAL.includes(e.type))
      .sort((a, b) => PRIORITE_JOURNAL.indexOf(a.type) - PRIORITE_JOURNAL.indexOf(b.type))
      .slice(0, 3);
    const tour = evts[0]!.tour;
    const cloture = j.clotures ? variante(j.clotures[momentActe(tour)], date, 'cloture') : '';
    if (!retenus.length) return [`${date}.`, variante(j.vide, date), cloture].filter(Boolean).join(' ');
    const ouverture = variante(j.types?.[retenus[0]!.type] ?? [], date, retenus[0]!.type);
    return [`${date}.`, ouverture, ...retenus.map((e) => e.texte), cloture, ...phrases].filter(Boolean).join(' ');
  }

  /** Sans IA, l'analyse du murmure libre se contente d'indices lexicaux, sans aucun bonus de style. */
  async analyserTexteLibre(params: Parameters<typeof promptAnalyse>[0]): Promise<EtiquettesTexteLibre> {
    const t = params.texte.toLowerCase();
    const registreDetecte: Registre = /obéis|suis-les|va |rapporte|tais-toi|je t'ordonne/.test(t)
      ? 'fer'
      : /mérites|offre|à toi|pouvoir|promets|sers-moi/.test(t)
        ? 'annatar'
        : 'paranoia';
    const secret = params.secretsConnus.find((s) =>
      s.texte
        .toLowerCase()
        .split(/[\s,.’']+/)
        .filter((w) => w.length > 6)
        .some((w) => t.includes(w)),
    );
    return { registreDetecte, secretUtilise: secret?.id ?? null, coherencePersonnage: 0, subtilite: 0, contradictionLore: false };
  }

  async reactionVoix(ctx: ContexteVoix): Promise<string> {
    const r = ctx.resultat;
    const issue = issueVoix(r);
    const registre = r.ordre.registre;
    const propres = this.banque.personnages[r.ordre.cible]?.[registre];
    const generiques = this.banque.voix[registre];
    // Du plus précis au plus général ; « retour » retombe sur « echec ».
    const candidats = [propres?.[issue], issue === 'retour' ? propres?.echec : undefined, generiques[issue], generiques.echec];
    const liste = candidats.find((l) => l?.length) ?? [];
    const allie = r.ordre.allie ? (this.noms.personnages[r.ordre.allie] ?? '') : '';
    return remplir(variante(liste, r.ordre.cible, registre, issue, r.jet), { qui: ctx.cible.nom, allie });
  }

  async narrerDuel(duel: ResultatDuel, nomCible: string) {
    const d = this.banque.duel;
    const vars = { qui: nomCible, verite: duel.veriteApprise ?? '' };
    const total = duel.manches.length;
    const manches = duel.manches.map((m, i) => {
      const issue = m.gagnee ? 'gagnee' : 'perdue';
      const propres = total > 1 ? d.temps?.[tempsManche(i, total)]?.[m.approche]?.[issue] : undefined;
      return remplir(variante(propres?.length ? propres : d[m.approche][issue], duel.cible, i, m.jet), vars);
    });
    const issueFinale = duel.victoire ? 'victoire' : 'defaite';
    const finals = [d.personnages?.[duel.cible]?.[issueFinale], total === 1 ? d.regard?.[issueFinale] : undefined, d[issueFinale]];
    const liste = finals.find((l) => l?.length) ?? [];
    return { manches, final: remplir(variante(liste, duel.cible, total), vars) };
  }
}
