import { ajouterVisibilite, changerTerreur, evenement } from './etat';
import type { Monde } from './monde';
import { aRegle, nazgulDef, region, regionsJouables } from './monde';
import { REGLES } from './regles';
import type { EtatJeu, IdDecision } from './types';
import { ErreurRegle } from './types';

/**
 * Les décisions de la Tour : de grands choix ponctuels, chacun avec ses
 * conditions (affichées une à une, remplies ou non), son coût et sa recharge.
 * Une décision prise devient un ordre du tour : elle se résout au Crépuscule
 * et s'annule comme les autres ordres.
 */

/** L'Acte en cours. Cette version ne contient que l'Acte I. */
const ACTE = 1;

export interface Condition {
  texte: string;
  remplie: boolean;
}

export interface DecisionDef {
  id: IdDecision;
  nom: string;
  /** Une phrase d'ambiance. */
  description: string;
  /** Ce que fait la décision, chiffres compris. */
  effet: string;
  conditions(monde: Monde, etat: EtatJeu): Condition[];
  resoudre(monde: Monde, etat: EtatJeu): void;
}

const D = REGLES.decisions;

const nazgulEnRetard = (etat: EtatJeu) => Object.values(etat.nazgul).filter((n) => n.indisponibleJusquA >= etat.tour);
const agentsEnJeu = (etat: EtatJeu) => Object.values(etat.personnages).filter((p) => p.agent && !p.sortiDeJeu);

export const DECISIONS: DecisionDef[] = [
  {
    id: 'presser_les_neuf',
    nom: 'Presser les Neuf',
    description: 'La Tour tire sur les liens des Anneaux. Ceux qui sont encore sur la route, ou rentrés démontés, reviennent plus tôt à la chasse.',
    effet: `Les Nazgûl indisponibles reviennent ${D.presser_les_neuf.gainTours} tours plus tôt. Visibilité +${D.presser_les_neuf.visibilite}.`,
    conditions: (_m, etat) => [{ texte: 'Au moins un des Neuf est loin de la chasse', remplie: nazgulEnRetard(etat).length > 0 }],
    resoudre(monde, etat) {
      const noms: string[] = [];
      for (const n of nazgulEnRetard(etat)) {
        // L'Aube suivante fait revenir ceux dont l'indisponibilité finit ce tour-ci : on ne descend pas plus bas.
        n.indisponibleJusquA = Math.max(etat.tour, n.indisponibleJusquA - D.presser_les_neuf.gainTours);
        noms.push(nazgulDef(monde, n.id).nom);
      }
      ajouterVisibilite(etat, D.presser_les_neuf.visibilite, 'les Neuf pressés');
      evenement(etat, 'decision', `La Tour presse les Neuf. ${noms.join(', ')} hâte${noms.length > 1 ? 'nt' : ''} le pas.`);
    },
  },
  {
    id: 'silence_de_la_tour',
    nom: 'Le Silence de la Tour',
    description: 'L’Œil se voile et Barad-dûr se tait. On cesse de parler des Hommes Noirs, mais la Tour agit moins.',
    effet: `Visibilité ${D.silence_de_la_tour.visibilite} (jamais sous le plancher du dernier palier). ${D.silence_de_la_tour.malusPa} PA de moins au prochain tour.`,
    conditions: (_m, etat) => [{ texte: `Visibilité d’au moins ${D.silence_de_la_tour.visibiliteMin}`, remplie: etat.jauges.visibilite >= D.silence_de_la_tour.visibiliteMin }],
    resoudre(_m, etat) {
      ajouterVisibilite(etat, D.silence_de_la_tour.visibilite, 'le Silence de la Tour');
      etat.jauges.malusPa += D.silence_de_la_tour.malusPa;
      evenement(etat, 'decision', 'La Tour se tait. Sur les routes de l’Ouest, on finit par se demander si l’on n’a pas rêvé.');
    },
  },
  {
    id: 'langues_des_tavernes',
    nom: 'Les langues des tavernes',
    description: 'Les agents de la Tour racontent, à voix basse, ce qui attend ceux qui cachent un voyageur.',
    effet: `Terreur +${D.langues_des_tavernes.terreur} partout où un agent est en place. Visibilité +${D.langues_des_tavernes.visibilite}.`,
    conditions: (_m, etat) => [{ texte: 'Au moins un agent au service de la Tour', remplie: agentsEnJeu(etat).length > 0 }],
    resoudre(monde, etat) {
      const lieux = [...new Set(agentsEnJeu(etat).map((p) => p.region))];
      for (const r of lieux) changerTerreur(monde, etat, r, D.langues_des_tavernes.terreur);
      ajouterVisibilite(etat, D.langues_des_tavernes.visibilite, 'rumeurs des agents');
      evenement(etat, 'decision', `Dans les tavernes de ${lieux.map((r) => region(monde, r).nom).join(', ')}, on parle des Cavaliers à voix basse.`);
    },
  },
  {
    id: 'crebains_de_dun',
    nom: 'Les crébains de Dun',
    description: 'Des nuées de corbeaux noirs survolent l’Eriador et rapportent où la peur a pris.',
    effet: `Révèle la Terreur de toutes les régions que l’Œil peut voir. Visibilité +${D.crebains_de_dun.visibilite}.`,
    conditions: (_m, etat) => [
      { texte: `Visibilité sous ${D.crebains_de_dun.visibiliteMax} (au-delà, les Elfes abattent les nuées)`, remplie: etat.jauges.visibilite < D.crebains_de_dun.visibiliteMax },
    ],
    resoudre(monde, etat) {
      for (const r of regionsJouables(monde)) {
        if (aRegle(r, 'zone_aveugle') || aRegle(r, 'sanctuaire')) continue;
        etat.connaissance.terreurs[r.id] = { valeur: etat.regions[r.id]!.terreur, tour: etat.tour };
      }
      ajouterVisibilite(etat, D.crebains_de_dun.visibilite, 'les crébains');
      evenement(etat, 'decision', 'Les crébains reviennent de l’Ouest. La Tour sait où la peur a pris racine.');
    },
  },
  {
    id: 'montures_ailees',
    nom: 'Les montures ailées',
    description: 'Les Neuf abandonnent leurs chevaux pour des bêtes ailées venues d’un monde plus ancien.',
    effet: 'Les Neuf passent en Ombre ailée : 3 jours de route par tour et le Fléau. Une seule fois.',
    conditions: (_m, etat) => [
      { texte: 'Acte II : les chevaux sont perdus au Gué', remplie: ACTE >= 2 },
      { texte: `Forme ${D.montures_ailees.formeMin} au moins`, remplie: etat.jauges.forme >= D.montures_ailees.formeMin },
    ],
    resoudre(_m, etat) {
      for (const n of Object.values(etat.nazgul)) n.posture = 'ombre_ailee';
      evenement(etat, 'decision', 'Les Neuf montent des bêtes ailées. Le ciel de l’Eriador n’est plus sûr.');
    },
  },
];

export function decisionDef(id: IdDecision): DecisionDef {
  const d = DECISIONS.find((x) => x.id === id);
  if (!d) throw new ErreurRegle(`Décision inconnue : ${id}`);
  return d;
}

export function coutDecision(id: IdDecision): { pa: number; essence: number } {
  return { pa: D[id].pa, essence: D[id].essence };
}

/** Tour où la décision redevient possible (null : jamais, déjà prise une fois pour toutes). */
export function rechargeDecision(etat: EtatJeu, id: IdDecision): number | null {
  const prise = etat.decisions?.[id];
  if (prise === undefined) return etat.tour;
  const r = D[id].recharge;
  return r === null ? null : prise + r;
}

export function validerDecision(monde: Monde, etat: EtatJeu, id: IdDecision): void {
  const d = decisionDef(id);
  if (etat.ordres.some((o) => o.type === 'decision' && o.decision === id)) throw new ErreurRegle(`« ${d.nom} » est déjà décidé ce tour.`);
  const prochaine = rechargeDecision(etat, id);
  if (prochaine === null) throw new ErreurRegle(`« ${d.nom} » ne se décide qu’une fois.`);
  if (prochaine > etat.tour) throw new ErreurRegle(`« ${d.nom} » ne se décide pas avant le tour ${prochaine}.`);
  const manque = d.conditions(monde, etat).find((c) => !c.remplie);
  if (manque) throw new ErreurRegle(`« ${d.nom} » : ${manque.texte.charAt(0).toLowerCase()}${manque.texte.slice(1)}.`);
}

/** Crépuscule : la décision prend effet (ses conditions sont relues, l'état a pu changer). */
export function resoudreDecision(monde: Monde, etat: EtatJeu, id: IdDecision): void {
  const d = decisionDef(id);
  if (d.conditions(monde, etat).some((c) => !c.remplie)) {
    evenement(etat, 'decision', `« ${d.nom} » ne prend pas : les conditions ne sont plus réunies.`);
    return;
  }
  etat.jauges.essence -= D[id].essence;
  etat.decisions = { ...(etat.decisions ?? {}), [id]: etat.tour };
  d.resoudre(monde, etat);
}
