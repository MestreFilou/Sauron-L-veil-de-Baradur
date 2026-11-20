import { nazgulDisponibles } from './etat';
import type { Monde } from './monde';
import { region } from './monde';
import { borner } from './outils';
import { REGLES } from './regles';
import type { Rng } from './rng';
import type { Approche, EtatJeu, IdPersonnage, ResultatDuel, ResultatManche } from './types';

export const puissanceSauron = (etat: EtatJeu) =>
  REGLES.duel.puissanceBase + REGLES.duel.puissanceParForme * etat.jauges.forme;

/** Chance de gagner une manche (4.4). */
export function chanceManche(puissance: number, volonte: number, approche: Approche, secretDisponible: boolean): number {
  let c = 50 + (puissance - volonte) / 2;
  if (approche === 'ecraser') c += REGLES.duel.ecraser.bonus;
  if (approche === 'insinuer' && secretDisponible) c += REGLES.duel.insinuerSecret;
  if (approche === 'feindre') c += REGLES.duel.feindre.bonus;
  return borner(Math.round(c), REGLES.duel.chanceMin, REGLES.duel.chanceMax);
}

/** La vérité que la cible arrache à Sauron si elle gagne (4.4). Tirée par le code. */
export function tirerVeriteSurSauron(monde: Monde, etat: EtatJeu, rng: Rng): string {
  const options: string[] = [];
  const dispo = nazgulDisponibles(etat);
  if (dispo.some((n) => n.region.startsWith('comte'))) options.push('Il cherche le Comté.');
  if (!etat.connaissance.anneau?.exact) options.push('Il ignore où est l’Anneau.');
  const compte = new Map<string, number>();
  for (const n of dispo) compte.set(n.region, (compte.get(n.region) ?? 0) + 1);
  const [plusPeuplee] = [...compte.entries()].sort((a, b) => b[1] - a[1]);
  if (plusPeuplee) options.push(`Les Neuf sont près de ${region(monde, plusPeuplee[0]).nom}.`);
  if (!options.length) options.push('La Tour a peur de ce qu’elle ne voit pas.');
  return rng.choisir(options);
}

/**
 * Résout un duel mental en trois manches au meilleur des trois (on s'arrête à deux).
 * Les approches sont choisies à l'avance par le joueur ; à défaut, « insinuer ».
 * `manches` permet de limiter à une seule manche (duel de regard, 3 phase 2).
 */
export function resoudreDuel(
  monde: Monde,
  etat: EtatJeu,
  cible: IdPersonnage,
  volonte: number,
  approches: Approche[] | undefined,
  secretDisponible: boolean,
  rng: Rng,
  manches = 3,
): ResultatDuel {
  const puissance = puissanceSauron(etat);
  const resultat: ResultatManche[] = [];
  const victoiresRequises = Math.ceil(manches / 2);
  let gagnees = 0;
  let perdues = 0;
  for (let i = 0; i < manches && gagnees < victoiresRequises && perdues < victoiresRequises; i++) {
    const approche = approches?.[i] ?? 'insinuer';
    const chance = chanceManche(puissance, volonte, approche, secretDisponible);
    const jet = rng.d100();
    const gagnee = jet < chance;
    if (gagnee) gagnees++;
    else perdues++;
    resultat.push({ approche, chance, jet, gagnee });
  }
  const victoire = gagnees >= victoiresRequises;
  const echecs = resultat.filter((m) => !m.gagnee);
  const facteurRetour = victoire
    ? 0
    : echecs.reduce((s, m) => s + (m.approche === 'feindre' ? REGLES.duel.feindre.poidsEchec : 1), 0) / Math.max(1, echecs.length);
  return {
    cible,
    puissance,
    volonte,
    manches: resultat,
    victoire,
    facteurRetour,
    veriteApprise: victoire ? null : tirerVeriteSurSauron(monde, etat, rng),
  };
}

/** Visibilité gagnée par les manches jouées en « écraser ». */
export const visibiliteEcraser = (d: ResultatDuel) =>
  d.manches.filter((m) => m.approche === 'ecraser').length * REGLES.duel.ecraser.visibilite;
