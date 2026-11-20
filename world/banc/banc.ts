/**
 * Fait jouer les bots sur l'Eriador et résume les parties.
 * Utilisé par world/tests/equilibrage.test.ts et par `npm run banc`.
 */
import type { Action, EtatJeu, IssueActe, Monde } from '@sauron/engine';
import { appliquer, creerPartie, ErreurRegle, indexerMonde } from '@sauron/engine';
import { eriador } from '../src';
import type { Bot } from './bots';

export const mondeEriador = indexerMonde(eriador);

export interface ResumePartie {
  issue: IssueActe;
  tourFin: number;
  visibiliteFinale: number;
  visibiliteMax: number;
  /** Tour où chaque palier de Visibilité a été franchi. */
  paliers: Record<number, number>;
  /** Visibilité à la fin de chaque tour. */
  courbe: number[];
  ordresDonnes: number;
  embuscades: number;
  marque: boolean;
}

function essayer(monde: Monde, etat: EtatJeu, action: Action): EtatJeu | null {
  try {
    return appliquer(monde, etat, action);
  } catch (e) {
    if (e instanceof ErreurRegle) return null;
    throw e;
  }
}

export function jouerPartie(bot: Bot, graine: number, monde: Monde = mondeEriador): ResumePartie {
  let etat = creerPartie(monde, graine);
  const paliers: Record<number, number> = {};
  const courbe: number[] = [];
  let vMax = etat.jauges.visibilite;
  let ordresDonnes = 0;
  let embuscades = 0;
  let marque = false;
  while (etat.phase !== 'fin') {
    const tour = etat.tour;
    etat =
      essayer(monde, etat, { type: 'poser_oeil', cible: bot.oeil(monde, etat) }) ??
      appliquer(monde, etat, { type: 'poser_oeil', cible: { type: 'region', id: 'bree' } });
    for (const ordre of bot.ordres(monde, etat)) {
      const suivant = essayer(monde, etat, { type: 'ordonner', ordre });
      if (suivant) {
        etat = suivant;
        ordresDonnes++;
      }
    }
    etat = appliquer(monde, etat, { type: 'fin_des_ordres' });
    const evts = etat.journal.at(-1)?.evenements ?? [];
    embuscades += evts.filter((e) => e.type === 'combat').length;
    if (etat.anneau.etape === 'A2' || etat.anneau.etape === 'A3') marque = true;
    vMax = Math.max(vMax, etat.jauges.visibilite);
    for (const p of etat.jauges.paliers) paliers[p] ??= tour;
    courbe.push(etat.jauges.visibilite);
  }
  return {
    issue: etat.issue!,
    tourFin: etat.tour,
    visibiliteFinale: etat.jauges.visibilite,
    visibiliteMax: vMax,
    paliers,
    courbe,
    ordresDonnes,
    embuscades,
    marque,
  };
}

export interface Bilan {
  bot: string;
  parties: number;
  issues: Record<IssueActe, number>;
  /** Victoire noire ou grise. */
  victoires: number;
  tauxVictoire: number;
  vFinaleMoyenne: number;
  vMaxMoyenne: number;
  /** Tour moyen de franchissement des paliers 40 / 60 / 80 (parties où il est franchi). */
  tourPalier: Record<number, number | null>;
  partPalier: Record<number, number>;
  tourFinMoyen: number;
  /** Tour moyen des victoires (noire ou grise). */
  tourVictoire: number | null;
  ordresParTour: number;
  /** Visibilité moyenne aux tours 5, 10, 15, 20, 25. */
  courbeMoyenne: number[];
}

const moyenne = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function evaluer(bot: Bot, parties = 40, graineDepart = 1, monde: Monde = mondeEriador): Bilan {
  const resumes = Array.from({ length: parties }, (_, i) => jouerPartie(bot, graineDepart + i, monde));
  const issues: Record<IssueActe, number> = { victoire_noire: 0, victoire_grise: 0, statu_quo: 0, ouest_s_eveille: 0 };
  for (const r of resumes) issues[r.issue]++;
  const victoires = issues.victoire_noire + issues.victoire_grise;
  const tourPalier: Record<number, number | null> = {};
  const partPalier: Record<number, number> = {};
  for (const p of [40, 60, 80, 100]) {
    const t = resumes.map((r) => r.paliers[p]).filter((x): x is number => x !== undefined);
    tourPalier[p] = t.length ? Math.round(moyenne(t) * 10) / 10 : null;
    partPalier[p] = t.length / parties;
  }
  const courbeMoyenne = [5, 10, 15, 20, 25].map((t) => Math.round(moyenne(resumes.map((r) => r.courbe[Math.min(t, r.courbe.length) - 1]!))));
  return {
    bot: bot.nom,
    parties,
    issues,
    victoires,
    tauxVictoire: victoires / parties,
    vFinaleMoyenne: Math.round(moyenne(resumes.map((r) => r.visibiliteFinale))),
    vMaxMoyenne: Math.round(moyenne(resumes.map((r) => r.visibiliteMax))),
    tourPalier,
    partPalier,
    tourFinMoyen: Math.round(moyenne(resumes.map((r) => r.tourFin)) * 10) / 10,
    tourVictoire: victoires ? Math.round(moyenne(resumes.filter((r) => r.issue === 'victoire_noire' || r.issue === 'victoire_grise').map((r) => r.tourFin)) * 10) / 10 : null,
    ordresParTour: Math.round((moyenne(resumes.map((r) => r.ordresDonnes / r.tourFin)) * 10)) / 10,
    courbeMoyenne,
  };
}

/** Tableau lisible (Markdown) d'une série de bilans. */
export function tableau(bilans: Bilan[]): string {
  const lignes = [
    '| Bot | Noire | Grise | Statu quo | Éveil | Victoires | Tour victoire | Fin | V finale | V max | V t5/t10/t15/t20/t25 | Palier 60 (tour) | Palier 80 (tour) |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const b of bilans) {
    const pal = (p: number) => (b.partPalier[p] ? `${Math.round(b.partPalier[p]! * 100)} % (t${b.tourPalier[p]})` : '0 %');
    lignes.push(
      `| ${b.bot} | ${b.issues.victoire_noire} | ${b.issues.victoire_grise} | ${b.issues.statu_quo} | ${b.issues.ouest_s_eveille} | ${b.victoires}/${b.parties} | ${b.tourVictoire ?? '–'} | ${b.tourFinMoyen} | ${b.vFinaleMoyenne} | ${b.vMaxMoyenne} | ${b.courbeMoyenne.join(' / ')} | ${pal(60)} | ${pal(80)} |`,
    );
  }
  return lignes.join('\n');
}
