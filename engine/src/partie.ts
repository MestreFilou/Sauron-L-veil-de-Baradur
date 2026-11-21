import { etatInitial, evenement, nazgulDisponibles } from './etat';
import type { Monde } from './monde';
import { indexerMonde, nazgulDef, personnage, region } from './monde';
import { poserOeil } from './oeil';
import { chantierCeTour, coutOuvrage, niveauOuvrage, NOMS_OUVRAGES } from './ouvrages';
import { cloner } from './outils';
import { REGLES } from './regles';
import { recoitOrdres } from './signal';
import { appliquerAffectations, validerAffectation } from './affectations';
import { coutGeste, empechementCapture, validerGeste } from './cachots';
import { coutDecision, validerDecision } from './decisions';
import { aube, crepuscule, estActionNazgul, nuit, phaseMurmures, rngPhase } from './tour';
import type { Action, DonneesMonde, EtatJeu, Ordre } from './types';
import { ErreurRegle } from './types';
import { coutVoix } from './voix';

/** Crée une partie : état initial, puis l'Aube du tour 1. */
export function creerPartie(monde: Monde | DonneesMonde, graine: number): EtatJeu {
  const m = 'donnees' in monde ? monde : indexerMonde(monde);
  const etat = etatInitial(m, graine);
  aube(m, etat);
  return etat;
}

/* ------------------------------------------------------------------ */
/* Coûts et validation des ordres (phase 4)                            */
/* ------------------------------------------------------------------ */

export function coutOrdre(etat: EtatJeu, o: Ordre): { pa: number; essence: number } {
  switch (o.type) {
    case 'voix':
      return { pa: coutVoix(etat), essence: 0 };
    case 'nazgul_traque':
      return { pa: REGLES.nazgul.traque.pa, essence: 0 };
    case 'nazgul_interroger':
      return { pa: REGLES.nazgul.interroger.pa, essence: 0 };
    case 'nazgul_embuscade':
      return { pa: REGLES.nazgul.embuscade.pa, essence: 0 };
    case 'nazgul_fleau':
      return { pa: REGLES.nazgul.fleau.pa, essence: 0 };
    case 'nazgul_cri':
    case 'nazgul_deplacer':
      return { pa: 0, essence: 0 };
    case 'agent_placer':
      return { pa: REGLES.agent.pa, essence: 0 };
    case 'corruption':
      return { pa: REGLES.corruption.pa, essence: REGLES.corruption.essence };
    case 'nazgul_capturer':
      return { pa: REGLES.cachots.capture.pa, essence: 0 };
    case 'cachot':
      return coutGeste(o.geste);
    case 'decision':
      return coutDecision(o.decision);
  }
}

export function paRestants(etat: EtatJeu): number {
  return etat.jauges.pa - etat.ordres.reduce((s, o) => s + coutOrdre(etat, o).pa, 0);
}

export function essenceRestante(etat: EtatJeu): number {
  return etat.jauges.essence - etat.ordres.reduce((s, o) => s + coutOrdre(etat, o).essence, 0);
}

/** Lève une ErreurRegle si l'ordre est impossible ; ne modifie rien. */
export function validerOrdre(monde: Monde, etat: EtatJeu, o: Ordre): void {
  if (etat.phase !== 'ordres') throw new ErreurRegle('Les ordres se donnent après les Murmures.');
  // Conditions propres aux cachots et aux décisions d'abord : elles disent mieux ce qui manque que le coût.
  if (o.type === 'cachot') validerGeste(monde, etat, o.geste, o.pnj);
  if (o.type === 'decision') validerDecision(monde, etat, o.decision);
  const cout = coutOrdre(etat, o);
  if (cout.pa > paRestants(etat)) throw new ErreurRegle(`Il ne reste que ${paRestants(etat)} PA (il en faut ${cout.pa}).`);
  if (cout.essence > essenceRestante(etat)) throw new ErreurRegle(`Il faut ${cout.essence} Essence (il en reste ${essenceRestante(etat)}).`);

  if ('nazgul' in o) {
    const n = etat.nazgul[o.nazgul];
    const def = nazgulDef(monde, o.nazgul);
    if (!n || !nazgulDisponibles(etat).some((x) => x.id === o.nazgul)) throw new ErreurRegle(`${def.nom} n’est pas disponible ce tour.`);
    if (!recoitOrdres(monde, etat, o.nazgul)) throw new ErreurRegle(`${def.nom} est trop loin des autres : il n’entend la Tour qu’un tour sur deux.`);
    if (o.type === 'nazgul_deplacer') {
      region(monde, o.destination);
      if (etat.ordres.some((x) => x.type === 'nazgul_deplacer' && x.nazgul === o.nazgul)) throw new ErreurRegle(`${def.nom} a déjà reçu un ordre de marche.`);
      if (o.destination !== n.region && etat.ordres.some((x) => x.type === 'nazgul_embuscade' && x.nazgul === o.nazgul)) {
        throw new ErreurRegle(`${def.nom} se tapit ce soir : il ne chevauche pas.`);
      }
    } else {
      // Une embuscade se prépare sur place : le Nazgûl doit déjà être dans la région au début du tour.
      if (o.type === 'nazgul_embuscade' && etat.ordres.some((x) => x.type === 'nazgul_deplacer' && x.nazgul === o.nazgul && x.destination !== n.region)) {
        throw new ErreurRegle(`${def.nom} chevauche ce tour : une embuscade se tend là où l’on est déjà.`);
      }
      if (estActionNazgul(o) && etat.ordres.some((x) => estActionNazgul(x) && 'nazgul' in x && x.nazgul === o.nazgul)) {
        throw new ErreurRegle(`${def.nom} ne fait qu’une action par tour (le déplacement est libre).`);
      }
      if (o.type === 'nazgul_fleau' && n.posture !== 'ombre_ailee') throw new ErreurRegle('Le Fléau demande les montures ailées (Acte II).');
      if (o.type === 'nazgul_interroger') personnage(monde, o.pnj);
      if (o.type === 'nazgul_capturer') {
        // Un PNJ ne se capture qu'une fois par tour, et seulement s'il est là au début du tour.
        const raison = empechementCapture(monde, etat, o.nazgul, o.pnj);
        if (raison) throw new ErreurRegle(raison);
        if (etat.ordres.some((x) => x.type === 'nazgul_capturer' && x.pnj === o.pnj)) throw new ErreurRegle(`${personnage(monde, o.pnj).nom} est déjà promis aux cachots.`);
        if (etat.ordres.some((x) => x.type === 'nazgul_deplacer' && x.nazgul === o.nazgul && x.destination !== n.region)) {
          throw new ErreurRegle(`${def.nom} chevauche ce tour : il ne peut enlever que quelqu’un qui se tient près de lui.`);
        }
      }
    }
    return;
  }
  if (o.type === 'voix') {
    const def = personnage(monde, o.cible);
    const p = etat.personnages[o.cible];
    if (!p || p.sortiDeJeu) throw new ErreurRegle(`${def.nom} n’est plus en jeu.`);
    if (!etat.connaissance.personnagesConnus.includes(o.cible)) throw new ErreurRegle(`Sauron ignore encore l’existence de ${def.nom}.`);
    if (def.horsCarte) throw new ErreurRegle(`${def.nom} est hors de portée en Acte I.`);
    if (etat.voixCeTour.includes(o.cible) || etat.ordres.some((x) => x.type === 'voix' && x.cible === o.cible)) {
      throw new ErreurRegle(`${def.nom} ne peut subir qu’une Voix par tour.`);
    }
    if (o.registre === 'fer' && !o.ordreFer) throw new ErreurRegle('Un Commandement de Fer doit dire ce qui est ordonné.');
    if (o.allie) personnage(monde, o.allie);
    if (o.texteLibre && o.texteLibre.length > 200) throw new ErreurRegle('Le murmure libre fait 200 caractères au plus.');
    return;
  }
  if (o.type === 'agent_placer') {
    personnage(monde, o.pnj);
    if (etat.personnages[o.pnj]!.agent) throw new ErreurRegle(`${personnage(monde, o.pnj).nom} sert déjà la Tour.`);
    return;
  }
  if (o.type === 'cachot' || o.type === 'decision') return;
  if (o.type === 'corruption') {
    region(monde, o.region);
    if (etat.regions[o.region]!.corrompue) throw new ErreurRegle(`${region(monde, o.region).nom} est déjà Corrompue.`);
  }
}

/* ------------------------------------------------------------------ */
/* Le réducteur                                                        */
/* ------------------------------------------------------------------ */

/**
 * Point d'entrée unique du moteur : applique une action du joueur et renvoie
 * un nouvel état (l'entrée n'est jamais modifiée). Lève ErreurRegle si l'action
 * est interdite à ce moment du tour.
 */
export function appliquer(monde: Monde, etatEntree: EtatJeu, action: Action): EtatJeu {
  if (etatEntree.phase === 'fin') throw new ErreurRegle('L’Acte est terminé.');
  const etat = cloner(etatEntree);
  switch (action.type) {
    case 'poser_oeil': {
      if (etat.phase !== 'oeil') throw new ErreurRegle('L’Œil s’est déjà posé ce tour.');
      poserOeil(monde, etat, action.cible, action.approche, rngPhase(etat, 'oeil'));
      phaseMurmures(monde, etat);
      appliquerAffectations(monde, etat, (o) => validerOrdre(monde, etat, o));
      return etat;
    }
    case 'rituel_forme': {
      if (etat.phase !== 'oeil') throw new ErreurRegle('Le rituel remplace le Regard : il se décide avant que l’Œil se pose.');
      const prochaine = etat.jauges.forme + 1;
      if (prochaine >= 4) throw new ErreurRegle('La Plénitude demande l’Unique (Acte final).');
      const cout = REGLES.forme.cout[prochaine]!;
      if (etat.jauges.essence < cout) throw new ErreurRegle(`Le rituel demande ${cout} Essence (il y en a ${etat.jauges.essence}).`);
      etat.jauges.essence -= cout;
      etat.jauges.pa = 0;
      etat.rituel = true;
      phaseMurmures(monde, etat);
      appliquerAffectations(monde, etat, (o) => validerOrdre(monde, etat, o));
      return etat;
    }
    case 'batir_ouvrage': {
      const def = REGLES.ouvrages[action.ouvrage];
      if (!def) throw new ErreurRegle('Ouvrage inconnu.');
      const cout = coutOuvrage(etat, action.ouvrage);
      if (cout === null) throw new ErreurRegle('Cet ouvrage est achevé.');
      if (chantierCeTour(etat)) throw new ErreurRegle('Les esclaves de l’Orodruin ne tiennent qu’un chantier par tour.');
      const reste = essenceRestante(etat);
      if (cout > reste) throw new ErreurRegle(`Le chantier demande ${cout} Essence (il en reste ${reste}).`);
      const niveau = niveauOuvrage(etat, action.ouvrage) + 1;
      etat.jauges.essence -= cout;
      etat.ouvrages = { ...etat.ouvrages, [action.ouvrage]: niveau };
      etat.dernierChantier = etat.tour;
      evenement(etat, 'ouvrage', `Chantier achevé au Mont Destin : ${NOMS_OUVRAGES[action.ouvrage]}, niveau ${niveau}.`, {
        donnees: { ouvrage: action.ouvrage, niveau, cout },
      });
      return etat;
    }
    case 'classer_murmure': {
      const m = etat.murmures.find((x) => x.id === action.murmure);
      if (!m) throw new ErreurRegle('Murmure inconnu.');
      if (m.verifie) throw new ErreurRegle('Ce murmure est déjà vérifié.');
      m.classement = action.classement;
      m.tourClassement = etat.tour;
      return etat;
    }
    case 'ordonner': {
      validerOrdre(monde, etat, action.ordre);
      etat.ordres.push(action.ordre);
      return etat;
    }
    case 'annuler_ordre': {
      if (etat.phase !== 'ordres') throw new ErreurRegle('Aucun ordre à annuler.');
      etat.ordres.splice(action.index, 1);
      return etat;
    }
    case 'affecter': {
      validerAffectation(monde, etat, action.nazgul, action.affectation);
      etat.nazgul[action.nazgul]!.affectation = action.affectation;
      // Pendant les ordres, la nouvelle mission prend effet tout de suite si le Nazgûl n'a encore rien reçu.
      appliquerAffectations(monde, etat, (o) => validerOrdre(monde, etat, o), action.nazgul);
      return etat;
    }
    case 'fin_des_ordres': {
      if (etat.phase !== 'ordres') throw new ErreurRegle('Il faut d’abord poser l’Œil.');
      crepuscule(monde, etat);
      nuit(monde, etat);
      if (etat.issue) return etat;
      etat.tour++;
      aube(monde, etat);
      return etat;
    }
  }
}

/** Joue plusieurs actions d'affilée (pratique pour les tests et les rejeux). */
export function rejouer(monde: Monde, etat: EtatJeu, actions: Action[]): EtatJeu {
  return actions.reduce((e, a) => appliquer(monde, e, a), etat);
}
