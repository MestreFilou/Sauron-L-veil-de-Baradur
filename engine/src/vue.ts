import { estHeros, statutRegion } from './etat';
import type { Monde } from './monde';
import { nazgulDef, personnage, region, regionsJouables } from './monde';
import { paRestants, essenceRestante } from './partie';
import type { EstimationPiste } from './piste';
import { estimerPiste } from './piste';
import { estIsole, forceSignal } from './signal';
import { dateDuTour } from './tour';
import type {
  Classement,
  EtatJeu,
  Evenement,
  Fait,
  IdNazgul,
  IdPersonnage,
  IdRegion,
  Jauges,
  Ordre,
  Posture,
  RevelationOeil,
  SourceMurmure,
  StatutRegion,
  Verite,
} from './types';

/**
 * Vue du joueur : ce que Sauron sait, et rien d'autre. C'est ce que reçoivent
 * l'interface et le narrateur. La vérité cachée (position du porteur, vérité
 * des murmures non vérifiés, Doute des inconnus) n'y figure pas.
 */
export interface VueJoueur {
  tour: number;
  date: string;
  phase: EtatJeu['phase'];
  jauges: Jauges & { paRestants: number; essenceRestante: number; terreurMoyenne: number };
  regions: {
    id: IdRegion;
    nom: string;
    /** Terreur exacte si l'Œil ou un Nazgûl l'a mesurée, avec le tour de la mesure. */
    terreur: { valeur: number; tour: number } | null;
    statut: StatutRegion | null;
    corrompue: boolean;
    corruptionEnCours: boolean;
    nazgul: IdNazgul[];
  }[];
  nazgul: {
    id: IdNazgul;
    nom: string;
    titre?: string;
    region: IdRegion;
    posture: Posture;
    disponible: boolean;
    signal: number;
    isole: boolean;
    roiSorcier: boolean;
  }[];
  personnages: {
    id: IdPersonnage;
    nom: string;
    titre?: string;
    /** Dernière position connue. */
    position: { region: IdRegion; tour: number } | null;
    /** Valeurs exactes seulement si l'Œil les a lues ce tour. */
    doute: number | null;
    mefiance: number | null;
    agent: boolean;
    heros: boolean;
    peurConnue: string | null;
    destinationConnue: string | null;
  }[];
  secrets: { id: string; personnage: IdPersonnage; texte: string; tour: number }[];
  murmures: {
    id: string;
    tour: number;
    region: IdRegion;
    source: SourceMurmure;
    emetteur: string;
    fait: Fait;
    faitTexte: string;
    texte: string | null;
    fiabilite: number;
    classement: Classement | null;
    verifie: boolean;
    /** La vérité n'est montrée qu'une fois vérifiée. */
    verite: Verite | null;
    /** Un autre murmure du tour affirme le contraire. */
    contredit: boolean;
  }[];
  oeil: RevelationOeil | null;
  ordres: Ordre[];
  piste: EstimationPiste;
  evenements: Evenement[];
  issue: EtatJeu['issue'];
}

function contradictoires(a: Fait, b: Fait): boolean {
  if (a.type === 'presence' && b.type === 'absence') return a.personnage === b.personnage && a.region === b.region;
  if (a.type === 'absence' && b.type === 'presence') return contradictoires(b, a);
  if ('personnage' in a && 'personnage' in b && a.type === 'presence' && b.type === 'presence') return a.personnage === b.personnage && a.region !== b.region;
  if ((a.type === 'nazgul' && b.type === 'calme') || (a.type === 'calme' && b.type === 'nazgul')) return a.region === b.region;
  return false;
}

export function vueJoueur(monde: Monde, etat: EtatJeu): VueJoueur {
  const k = etat.connaissance;
  const lusCeTour = new Map<IdPersonnage, { doute: number; mefiance: number }>();
  if (etat.oeil) {
    for (const v of etat.oeil.personnagesVus) lusCeTour.set(v.id, v);
    if (etat.oeil.pensees && etat.oeil.cible.type === 'personnage') lusCeTour.set(etat.oeil.cible.id, etat.oeil.pensees);
  }
  const jouables = regionsJouables(monde);
  const terreurs = jouables.map((r) => k.terreurs[r.id]?.valeur).filter((x): x is number => x !== undefined);
  const recents = etat.murmures.filter((m) => m.tour >= etat.tour - 1);
  return {
    tour: etat.tour,
    date: dateDuTour(etat.tour).texte,
    phase: etat.phase,
    jauges: {
      ...etat.jauges,
      paRestants: paRestants(etat),
      essenceRestante: essenceRestante(etat),
      terreurMoyenne: terreurs.length ? Math.round(terreurs.reduce((a, b) => a + b, 0) / terreurs.length) : 0,
    },
    regions: jouables.map((r) => {
      const er = etat.regions[r.id]!;
      const mesure = k.terreurs[r.id] ?? null;
      const nz = Object.values(etat.nazgul).filter((n) => n.region === r.id && n.indisponibleJusquA < etat.tour);
      // Les Neuf sentent la peur là où ils sont : la Terreur y est connue.
      const terreur = nz.length ? { valeur: er.terreur, tour: etat.tour } : mesure;
      return {
        id: r.id,
        nom: r.nom,
        terreur,
        statut: terreur ? statutRegion({ ...er, terreur: terreur.valeur }) : er.corrompue ? 'corrompue' : null,
        corrompue: er.corrompue,
        corruptionEnCours: er.corruption !== null,
        nazgul: nz.map((n) => n.id),
      };
    }),
    nazgul: Object.values(etat.nazgul).map((n) => {
      const def = nazgulDef(monde, n.id);
      const v = {
        id: n.id,
        nom: def.nom,
        region: n.region,
        posture: n.posture,
        disponible: n.indisponibleJusquA < etat.tour,
        signal: forceSignal(monde, etat, n.id),
        isole: estIsole(monde, etat, n.id),
        roiSorcier: Boolean(def.roiSorcier),
      };
      return def.titre ? { ...v, titre: def.titre } : v;
    }),
    personnages: k.personnagesConnus
      .map((id) => personnage(monde, id))
      .map((def) => {
        const p = etat.personnages[def.id]!;
        const lu = lusCeTour.get(def.id);
        const v = {
          id: def.id,
          nom: def.nom,
          position: k.positions[def.id] ?? null,
          doute: lu?.doute ?? null,
          mefiance: lu?.mefiance ?? null,
          agent: p.agent,
          heros: estHeros(monde, def.id),
          peurConnue: k.peurs.includes(def.id) ? def.peur : null,
          destinationConnue: k.destinations.includes(def.id) ? def.destination : null,
        };
        return def.titre ? { ...v, titre: def.titre } : v;
      }),
    secrets: k.secrets.map((s) => ({ ...s, texte: personnage(monde, s.personnage).secrets.find((x) => x.id === s.id)?.texte ?? '' })),
    murmures: etat.murmures.map((m) => ({
      id: m.id,
      tour: m.tour,
      region: m.region,
      source: m.source,
      emetteur: m.emetteur,
      fait: m.fait,
      faitTexte: m.faitTexte,
      texte: m.texte ?? null,
      fiabilite: m.fiabilite,
      classement: m.classement,
      verifie: m.verifie,
      verite: m.verifie ? m.verite : null,
      contredit: recents.some((x) => x.id !== m.id && contradictoires(x.fait, m.fait)),
    })),
    oeil: etat.oeil,
    ordres: etat.ordres,
    piste: estimerPiste(monde, etat),
    evenements: etat.evenements.filter((e) => e.public),
    issue: etat.issue,
  };
}

/** Nom lisible d'une région (raccourci pour l'interface). */
export const nomRegion = (monde: Monde, id: IdRegion) => region(monde, id).nom;
