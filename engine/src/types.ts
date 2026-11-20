/**
 * Types du moteur. Deux familles :
 * - les définitions statiques du monde (`*Def`, chargées depuis world/),
 * - l'état mutable d'une partie (`EtatJeu`), entièrement sérialisable en JSON.
 */

export type IdRegion = string;
export type IdPersonnage = string;
export type IdNazgul = string;

/* ------------------------------------------------------------------ */
/* Monde statique                                                      */
/* ------------------------------------------------------------------ */

export type Obstacle = 'brandevin' | 'bruinen';

export interface Voisin {
  id: IdRegion;
  joursCheval: number;
  joursPied: number;
  obstacle: Obstacle | null;
}

export type SourceMurmure = 'espion' | 'crebain' | 'rumeur' | 'nazgul' | 'agent';

export type RegleSpeciale =
  /** Ni l'Œil ni les Nazgûl n'y voient, aucun murmure (Vieille Forêt). */
  | 'zone_aveugle'
  /** Invisible à l'Œil, corruption impossible en Acte I (Fondcombe). */
  | 'sanctuaire'
  /** Un Nazgûl posté ici voit aussi les régions voisines (Montauvent). */
  | 'point_haut'
  /** Les Nazgûl qui traversent risquent d'être démontés si Elrond veille (Gué). */
  | 'crue'
  /** Point d'entrée des Nazgûl venus du Sud. */
  | 'entree_nazgul';

export interface RegionDef {
  id: IdRegion;
  royaume: string;
  nom: string;
  terrain: string;
  voisins: Voisin[];
  volonteRegionale: number;
  /**
   * Défense des lieux contre une embuscade nocturne (haies, portes, gens du pays) :
   * s'ajoute à celle des présents. Les terres sauvages n'en ont pas.
   */
  defenseCombat?: number;
  /** Plafond de Terreur (la Haie du Pays de Bouc : 50). */
  terreurPlafond?: number;
  sourcesMurmures: SourceMurmure[];
  /** Modificateur du nombre de murmures venus de cette région (Bree +2, Terres Solitaires -2). */
  murmuresBonus: number;
  /** Bonus de détection de l'Anneau pour un Nazgûl présent (Galgals +10). */
  bonusDetection?: number;
  reglesSpeciales: RegleSpeciale[];
  /** Nœud sans géométrie (Mordor, Tharbad…) : émet et reçoit, mais n'est pas jouable. */
  horsCarte?: boolean;
  terreurInitiale?: number;
}

/** `guerisseur` : ralentit le froid de la lame de Morgul (Aragorn et l'athelas). */
export type Trait = 'orgueil' | 'desir' | 'humble' | 'avide' | 'peureux' | 'loyal' | 'sage' | 'guerisseur';

export interface Secret {
  id: string;
  texte: string;
  type: 'relation' | 'mensonge' | 'objet' | 'intention' | 'peur';
}

export interface EtapeItineraire {
  /** Tour canon d'arrivée dans la région (avant tout retard). */
  tour: number;
  region: IdRegion;
  /** Le porteur met l'Anneau ce tour-là (Bree, Montauvent, Gué). */
  metAnneau?: boolean;
}

export interface PersonnageDef {
  id: IdPersonnage;
  nom: string;
  titre?: string;
  camp: 'peuples_libres' | 'neutre' | 'ombre';
  /** Héros : visé par les jauges de l'Ouest. PNJ : gens du commun. */
  role: 'heros' | 'sage' | 'pnj';
  volonte: number;
  douteInitial: number;
  traits: Trait[];
  peur: string;
  /** Destination réelle, révélée par l'Œil. */
  destination: string;
  secrets: Secret[];
  relations: Record<IdPersonnage, number>;
  itineraire: EtapeItineraire[];
  /** Les membres d'un même groupe partagent le retard (la Communauté). */
  groupe?: string;
  /** Défense en combat contre les Nazgûl (Aragorn, Gandalf, Glorfindel). */
  defenseCombat?: number;
  /** Porte l'Anneau au début de la partie. */
  porteur?: boolean;
  /** Absent de la carte en Acte I (Saroumane). */
  horsCarte?: boolean;
  /** Sauron connaît son existence dès le départ (il peut viser son esprit). */
  connuDeSauron?: boolean;
  /** Déjà au service de la Tour au tour 1 (Bill Fougeron). */
  agentInitial?: boolean;
}

export interface NazgulDef {
  id: IdNazgul;
  nom: string;
  titre?: string;
  vitesse: number;
  bonusDetection: number;
  roiSorcier?: boolean;
  /** Khamûl : toutes ses chances -25 % de jour. */
  sensibleAuJour?: boolean;
  regionDepart: IdRegion;
  /** Les Nazgûl encore sur la route de Tharbad arrivent plus tard. */
  disponibleAuTour?: number;
}

export interface JalonCanon {
  tour: number;
  date: string;
  evenement: string;
}

export interface DonneesMonde {
  royaume: string;
  regions: RegionDef[];
  personnages: PersonnageDef[];
  nazgul: NazgulDef[];
  calendrier: JalonCanon[];
  /** Région d'où repartent les Nazgûl démontés (Mordor). */
  regionRetraite: IdRegion;
  /** Région où ils reviennent en jeu. */
  regionRetour: IdRegion;
  /** Le refuge que vise le porteur (Fondcombe) et son gardien (Elrond) : repos, soin, fin d'acte. */
  refuge: { region: IdRegion; gardien: IdPersonnage };
}

/* ------------------------------------------------------------------ */
/* État d'une partie                                                   */
/* ------------------------------------------------------------------ */

export type Phase = 'oeil' | 'ordres' | 'fin';

export type StatutRegion = 'libre' | 'inquiete' | 'sous_ombre' | 'ecrasee' | 'corrompue';

export interface Embuscade {
  nazgul: IdNazgul;
  /** Personnage guetté ; sans cible, la première proie venue (le porteur d'abord). */
  cible: IdPersonnage | null;
  posee: number;
  expire: number;
}

export interface EtatRegion {
  id: IdRegion;
  terreur: number;
  corrompue: boolean;
  corruption: { lancee: number; toursTenus: number } | null;
  embuscades: Embuscade[];
}

export interface EtatPersonnage {
  id: IdPersonnage;
  region: IdRegion;
  doute: number;
  mefiance: number;
  relations: Record<IdPersonnage, number>;
  /** Promesse d'Annatar acceptée : suit le choix de Sauron au prochain point de décision. */
  dette: boolean;
  agent: boolean;
  brise: boolean;
  /**
   * Blessure de la lame de Morgul. `froid` monte chaque nuit (moins vite sous les
   * soins d'un guérisseur, pas du tout près d'un Sage) ; à `froidSpectre`, le porteur
   * devient un spectre. Absent dans les anciennes sauvegardes : on repart de `depuis`.
   */
  blessureMorgul: { depuis: number; froid?: number } | null;
  /** Tours de retard sur l'itinéraire canon (partagé par le groupe). */
  retard: number;
  /** Destination imposée par un Commandement de Fer, prioritaire sur l'itinéraire. */
  detour: IdRegion | null;
  seuilsDoute: number[];
  alerteDonnee: boolean;
  /** Vérités sur Sauron apprises (retour de flamme) ; propagées aux alliés au tour suivant. */
  verites: string[];
  veritesAPropager: string[];
  /** Commandement « se taire » : ne prévient plus ses alliés jusqu'à ce tour. */
  silenceJusquA: number;
  dernierContact: number;
  sortiDeJeu: boolean;
  /** Le groupe veille après une embuscade : défense en plus jusqu'au tour indiqué (inclus). */
  vigilance?: { defense: number; jusquA: number };
}

export type Posture = 'traque' | 'ombre_ailee';

export interface EtatNazgul {
  id: IdNazgul;
  region: IdRegion;
  posture: Posture;
  /** Démonté ou pas encore arrivé : indisponible jusqu'à ce tour (inclus). */
  indisponibleJusquA: number;
  lameMorgulUtilisee: boolean;
}

export type EtapeAnneau = 'A0' | 'A1' | 'A2' | 'A3';

export interface EtatAnneau {
  porteur: IdPersonnage;
  /** Trace laissée par région : force et tour. Cachée au joueur. */
  traces: Record<IdRegion, { force: number; tour: number }>;
  metCeTour: boolean;
  pulsation: { region: IdRegion; tour: number } | null;
  detections: number;
  etape: EtapeAnneau;
  saisi: boolean;
}

export interface SecretConnu {
  id: string;
  personnage: IdPersonnage;
  tour: number;
}

/** Ce que Sauron sait. La vue du joueur se construit uniquement à partir d'ici. */
export interface Connaissance {
  secrets: SecretConnu[];
  peurs: IdPersonnage[];
  destinations: IdPersonnage[];
  personnagesConnus: IdPersonnage[];
  positions: Record<IdPersonnage, { region: IdRegion; tour: number }>;
  terreurs: Record<IdRegion, { valeur: number; tour: number }>;
  /** Où Sauron sait que l'Anneau était (Pulsation, détection, Œil). */
  anneau: { region: IdRegion; tour: number; exact: boolean } | null;
  /** Régions où l'on a vérifié que le porteur n'était pas (Œil, Traque infructueuse). */
  sansPorteur: Record<IdRegion, number>;
}

export type CibleOeil = { type: 'region'; id: IdRegion } | { type: 'personnage'; id: IdPersonnage };

export interface RevelationOeil {
  cible: CibleOeil;
  /** L'Œil glisse (sanctuaire, zone aveugle) : rien n'est révélé. */
  repousse: boolean;
  personnagesVus: { id: IdPersonnage; doute: number; mefiance: number }[];
  terreur?: number;
  murmuresVerifies: string[];
  anneauSenti: boolean;
  pensees?: { destination: string; peur: string; secret: string | null; doute: number; mefiance: number };
  duel?: ResultatDuel;
}

export type Verite = 'vrai' | 'deforme' | 'faux';
export type Classement = 'vrai' | 'faux' | 'incertain';

/** Fait réel sous-jacent d'un murmure, choisi par le code. */
export type Fait =
  | { type: 'presence'; personnage: IdPersonnage; region: IdRegion; nombre?: number }
  | { type: 'absence'; personnage: IdPersonnage; region: IdRegion }
  | { type: 'terreur'; region: IdRegion; statut: StatutRegion }
  | { type: 'passage_porteur'; region: IdRegion; tour: number }
  | { type: 'nazgul'; region: IdRegion; nombre: number }
  | { type: 'calme'; region: IdRegion };

export interface Murmure {
  id: string;
  tour: number;
  region: IdRegion;
  source: SourceMurmure;
  /** Nom lisible de la source (« Bill Fougeron », « Crébains des Collines »). */
  emetteur: string;
  /** Cachée au joueur tant qu'elle n'est pas vérifiée. */
  verite: Verite;
  /** Le fait affirmé par le murmure (déjà faussé si `verite` vaut « faux »). */
  fait: Fait;
  /** Phrase factuelle du fait, à habiller par Haiku. */
  faitTexte: string;
  deformation: string | null;
  ton: string;
  /** 0 à 1 : pilote le rendu effacé de la rumeur (direction artistique, 3). */
  fiabilite: number;
  classement: Classement | null;
  tourClassement: number | null;
  verifie: boolean;
  recompense: boolean;
  /** Texte final écrit par le narrateur (Haiku) ; jamais relu par le moteur. */
  texte?: string;
}

export type Registre = 'paranoia' | 'annatar' | 'fer';
export type Approche = 'ecraser' | 'insinuer' | 'feindre';

/** Étiquettes renvoyées par Sonnet sur le murmure en texte libre (4.3). */
export interface EtiquettesTexteLibre {
  registreDetecte: Registre;
  secretUtilise: string | null;
  coherencePersonnage: 0 | 1 | 2;
  subtilite: 0 | 1;
  contradictionLore: boolean;
}

export type OrdreFer =
  | { type: 'deplacer'; region: IdRegion }
  | { type: 'se_taire' }
  | { type: 'livrer' };

export type Ordre =
  | {
      type: 'voix';
      cible: IdPersonnage;
      registre: Registre;
      /** Paranoïa : l'allié contre qui monter la cible. */
      allie?: IdPersonnage;
      /** Secret révélé par l'Œil sur lequel s'appuie la Voix. */
      secret?: string;
      /** Murmure sur lequel s'appuie la Voix. */
      murmure?: string;
      texteLibre?: string;
      etiquettes?: EtiquettesTexteLibre;
      /** Commandement de Fer : ce qui est ordonné. */
      ordreFer?: OrdreFer;
      /** Duel mental : approche de chacune des trois manches. */
      approches?: Approche[];
    }
  | { type: 'nazgul_deplacer'; nazgul: IdNazgul; destination: IdRegion }
  | { type: 'nazgul_traque'; nazgul: IdNazgul }
  | { type: 'nazgul_interroger'; nazgul: IdNazgul; pnj: IdPersonnage }
  | { type: 'nazgul_embuscade'; nazgul: IdNazgul; cible?: IdPersonnage }
  | { type: 'nazgul_cri'; nazgul: IdNazgul }
  | { type: 'nazgul_fleau'; nazgul: IdNazgul }
  | { type: 'agent_placer'; pnj: IdPersonnage }
  | { type: 'corruption'; region: IdRegion };

export type TypeEvenement =
  | 'aube'
  /** Après coup : ce que le livre racontait de ce jour (« Dans une autre histoire… »). */
  | 'canon'
  | 'deplacement_pnj'
  | 'oeil'
  | 'duel'
  | 'murmures'
  | 'nazgul'
  | 'detection'
  | 'pulsation'
  | 'voix'
  | 'combat'
  | 'corruption'
  | 'forme'
  | 'seuil'
  | 'essence'
  | 'fin';

export interface Evenement {
  type: TypeEvenement;
  tour: number;
  /** Phrase factuelle, en français, produite par le code. Le narrateur peut l'habiller. */
  texte: string;
  /** Visible du joueur ? (les événements cachés servent au débogage et aux tests). */
  public: boolean;
  donnees?: Record<string, unknown>;
}

export interface ResultatManche {
  approche: Approche;
  chance: number;
  jet: number;
  gagnee: boolean;
}

export interface ResultatDuel {
  cible: IdPersonnage;
  puissance: number;
  volonte: number;
  manches: ResultatManche[];
  victoire: boolean;
  /** 1 = retour de flamme complet, 0,5 = atténué par les feintes. */
  facteurRetour: number;
  veriteApprise: string | null;
}

export interface ResultatVoix {
  ordre: Extract<Ordre, { type: 'voix' }>;
  chance: number;
  jet: number;
  reussie: boolean;
  duel: ResultatDuel | null;
  detail: Record<string, number>;
}

export type IssueActe = 'victoire_noire' | 'victoire_grise' | 'statu_quo' | 'ouest_s_eveille';

export interface Jauges {
  visibilite: number;
  paliers: number[];
  essence: number;
  pa: number;
  forme: number;
  /** PA perdus au prochain tour (retour de flamme). */
  malusPa: number;
}

export interface EtatJeu {
  version: 1;
  graine: number;
  tour: number;
  phase: Phase;
  jauges: Jauges;
  regions: Record<IdRegion, EtatRegion>;
  personnages: Record<IdPersonnage, EtatPersonnage>;
  nazgul: Record<IdNazgul, EtatNazgul>;
  anneau: EtatAnneau;
  connaissance: Connaissance;
  /** Ce que l'Œil a révélé ce tour. */
  oeil: RevelationOeil | null;
  /** Sauron se replie pour un rituel de Forme ce tour (l'Œil ne se pose pas). */
  rituel: boolean;
  murmures: Murmure[];
  ordres: Ordre[];
  /** Une action à V +3 ou plus a eu lieu ce tour. */
  actionVisible: boolean;
  /** Voix déjà projetées ce tour (une par personnage). */
  voixCeTour: IdPersonnage[];
  evenements: Evenement[];
  /** Historique des événements publics des tours passés (le Journal de Barad-dûr s'en nourrit). */
  journal: { tour: number; evenements: Evenement[]; resume?: string }[];
  issue: IssueActe | null;
}

export type Action =
  | { type: 'poser_oeil'; cible: CibleOeil; approche?: Approche }
  | { type: 'rituel_forme' }
  | { type: 'classer_murmure'; murmure: string; classement: Classement }
  | { type: 'ordonner'; ordre: Ordre }
  | { type: 'annuler_ordre'; index: number }
  | { type: 'fin_des_ordres' };

export class ErreurRegle extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErreurRegle';
  }
}
