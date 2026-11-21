import { avancerNazgul, distance, voisinage } from './carte';
import {
  ajouterEssence,
  ajouterVisibilite,
  changerDoute,
  changerTerreur,
  connaitreAnneau,
  connaitrePosition,
  estHeros,
  evenement,
  nazgulDans,
  nazgulDisponibles,
  porteur,
  presents,
} from './etat';
import type { Monde } from './monde';
import { aRegle, nazgulDef, personnage, region } from './monde';
import { creerMurmure, verifierMurmures } from './murmures';
import { retourDesEcuries } from './ouvrages';
import { borner } from './outils';
import { REGLES } from './regles';
import type { Rng } from './rng';
import type { EtatJeu, IdNazgul, IdPersonnage, IdRegion } from './types';

const nom = (monde: Monde, id: IdNazgul) => nazgulDef(monde, id).nom;

/** Le Nazgûl est renvoyé au Mordor pour 10 tours (5.1). */
export function demonter(monde: Monde, etat: EtatJeu, id: IdNazgul, raison: string): void {
  const n = etat.nazgul[id]!;
  n.region = monde.donnees.regionRetraite;
  const duree = Math.max(1, REGLES.nazgul.demonte.duree - retourDesEcuries(etat));
  n.indisponibleJusquA = etat.tour + duree;
  for (const r of Object.values(etat.regions)) r.embuscades = r.embuscades.filter((e) => e.nazgul !== id);
  ajouterVisibilite(etat, REGLES.nazgul.demonte.visibilite, `${nom(monde, id)} démonté`);
  evenement(etat, 'nazgul', `${nom(monde, id)} est démonté (${raison}). Il rentre au Mordor pour ${duree} tours.`);
}

/* ------------------------------------------------------------------ */
/* Déplacements                                                        */
/* ------------------------------------------------------------------ */

export function vitesse(monde: Monde, etat: EtatJeu, id: IdNazgul): number {
  const n = etat.nazgul[id]!;
  return n.posture === 'ombre_ailee' ? REGLES.nazgul.vitesseOmbreAilee : nazgulDef(monde, id).vitesse;
}

export function deplacerNazgul(monde: Monde, etat: EtatJeu, id: IdNazgul, destination: IdRegion, rng: Rng): void {
  const n = etat.nazgul[id]!;
  const parcours = avancerNazgul(monde, n.region, destination, vitesse(monde, etat, id));
  const { region: refuge, gardien } = monde.donnees.refuge;
  const elrond = etat.personnages[gardien]?.region === refuge;
  for (let i = 1; i < parcours.length; i++) {
    const de = parcours[i - 1]!;
    const vers = parcours[i]!;
    const arete = region(monde, de).voisins.find((v) => v.id === vers);
    n.region = vers;
    if (arete?.obstacle === 'bruinen' && elrond && rng.chance(REGLES.nazgul.crue.chance)) {
      demonter(monde, etat, id, 'emporté par la crue du Bruinen');
      return;
    }
  }
  if (parcours.length > 1) {
    evenement(etat, 'nazgul', `${nom(monde, id)} chevauche jusqu’à ${region(monde, n.region).nom}.`, {
      donnees: { nazgul: id, parcours },
    });
  }
}

/* ------------------------------------------------------------------ */
/* Détection de l'Anneau                                               */
/* ------------------------------------------------------------------ */

export function traceActive(etat: EtatJeu, regionId: IdRegion) {
  const t = etat.anneau.traces[regionId];
  return t && etat.tour - t.tour <= REGLES.anneau.dureeTrace ? t : null;
}

/** Chance de détecter la trace (2.8). `nuit` : +10 %, et Khamûl n'est pas gêné par le jour. */
export function chanceDetection(monde: Monde, etat: EtatJeu, id: IdNazgul, regionId: IdRegion, nuit: boolean): number {
  const t = traceActive(etat, regionId);
  if (!t) return 0;
  const def = nazgulDef(monde, id);
  let c = REGLES.anneau.detectionBase + REGLES.anneau.detectionParForce * t.force + def.bonusDetection + (region(monde, regionId).bonusDetection ?? 0);
  if (nuit) c += REGLES.anneau.bonusNuit;
  else if (def.sensibleAuJour) c -= REGLES.anneau.malusJourKhamul;
  return borner(c, 0, REGLES.anneau.detectionMax);
}

function jetDetection(monde: Monde, etat: EtatJeu, id: IdNazgul, regionId: IdRegion, nuit: boolean, rng: Rng, facteur = 1): boolean {
  if (aRegle(region(monde, regionId), 'zone_aveugle')) return false;
  const c = chanceDetection(monde, etat, id, regionId, nuit) * facteur;
  if (c <= 0) {
    if (porteur(etat).region !== regionId) etat.connaissance.sansPorteur[regionId] = etat.tour;
    return false;
  }
  if (!rng.chance(c)) return false;
  const t = traceActive(etat, regionId)!;
  const ici = porteur(etat).region === regionId;
  etat.anneau.detections++;
  connaitreAnneau(etat, regionId, ici ? etat.tour : t.tour, ici);
  if (etat.anneau.etape === 'A0' && etat.anneau.detections >= REGLES.anneau.detectionsPourPiste) {
    etat.anneau.etape = 'A1';
    ajouterVisibilite(etat, 3, 'A1, la Piste');
    evenement(etat, 'detection', 'La Piste : trois fois la trace a été flairée. La Tour sait désormais à une région près où chercher.');
  }
  evenement(
    etat,
    'detection',
    ici
      ? `${nom(monde, id)} flaire l’Anneau à ${region(monde, regionId).nom}. Il est là, tout proche.`
      : `${nom(monde, id)} trouve une trace de l’Anneau à ${region(monde, regionId).nom}, vieille de ${etat.tour - t.tour} jour(s).`,
    { donnees: { nazgul: id, region: regionId, exact: ici } },
  );
  return true;
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

export function traquer(monde: Monde, etat: EtatJeu, id: IdNazgul, rng: Rng): void {
  const n = etat.nazgul[id]!;
  const r = region(monde, n.region);
  changerTerreur(monde, etat, n.region, REGLES.nazgul.traque.terreur);
  ajouterVisibilite(etat, REGLES.nazgul.traque.visibilite, `Traque de ${nom(monde, id)}`);
  evenement(etat, 'nazgul', `${nom(monde, id)} fouille ${r.nom} et interroge les gens du pays.`);
  if (!aRegle(r, 'zone_aveugle')) {
    for (const p of presents(monde, etat, n.region)) if (estHeros(monde, p.id)) connaitrePosition(etat, p.id);
    verifierMurmures(etat, { region: n.region }, nom(monde, id));
  }
  jetDetection(monde, etat, id, n.region, false, rng);
  // Depuis un point haut, le Nazgûl voit aussi les régions voisines (à demi-chance).
  if (aRegle(r, 'point_haut')) {
    for (const v of r.voisins) if (!region(monde, v.id).horsCarte) jetDetection(monde, etat, id, v.id, false, rng, 0.5);
  }
}

export function interroger(monde: Monde, etat: EtatJeu, id: IdNazgul, pnj: IdPersonnage, rng: Rng, index: number): void {
  const n = etat.nazgul[id]!;
  const p = etat.personnages[pnj];
  const def = personnage(monde, pnj);
  if (!p || p.region !== n.region || p.sortiDeJeu) {
    evenement(etat, 'nazgul', `${nom(monde, id)} cherche ${def.nom} à ${region(monde, n.region).nom}, en vain.`);
    return;
  }
  changerTerreur(monde, etat, n.region, REGLES.nazgul.interroger.terreur);
  ajouterVisibilite(etat, REGLES.nazgul.interroger.visibilite, `${nom(monde, id)} interroge ${def.nom}`);
  changerDoute(etat, pnj, 15);
  connaitrePosition(etat, pnj);
  const m = creerMurmure(monde, etat, n.region, 'nazgul', rng, 100 + index, { verite: 'vrai' });
  m.emetteur = `${def.nom}, sous la terreur · ${region(monde, n.region).nom}`;
  m.verifie = true;
  etat.murmures.push(m);
  if (m.fait.type === 'passage_porteur') connaitreAnneau(etat, m.fait.region, m.fait.tour, false);
  evenement(etat, 'nazgul', `${def.nom}, terrifié, avoue : ${m.faitTexte}.`, { donnees: { murmure: m.id } });
}

export function poserEmbuscade(monde: Monde, etat: EtatJeu, id: IdNazgul, cible: IdPersonnage | undefined): void {
  const n = etat.nazgul[id]!;
  // Un Nazgûl ne tient qu'une embuscade : la nouvelle remplace l'ancienne.
  for (const r of Object.values(etat.regions)) r.embuscades = r.embuscades.filter((e) => e.nazgul !== id);
  etat.regions[n.region]!.embuscades.push({
    nazgul: id,
    cible: cible ?? null,
    posee: etat.tour,
    expire: etat.tour + REGLES.nazgul.embuscade.duree - 1,
  });
  ajouterVisibilite(etat, REGLES.nazgul.embuscade.visibilitePose, `${nom(monde, id)} tapi à ${region(monde, n.region).nom}`);
  evenement(etat, 'nazgul', `${nom(monde, id)} se tapit à ${region(monde, n.region).nom} et attend la nuit.`);
}

export function crier(monde: Monde, etat: EtatJeu, id: IdNazgul): void {
  const n = etat.nazgul[id]!;
  const def = nazgulDef(monde, id);
  const t = def.roiSorcier ? REGLES.nazgul.cri.terreurRoiSorcier : REGLES.nazgul.cri.terreur;
  for (const rid of voisinage(monde, n.region, 1)) {
    if (region(monde, rid).horsCarte) continue;
    changerTerreur(monde, etat, rid, t);
    for (const p of presents(monde, etat, rid)) if (estHeros(monde, p.id)) changerDoute(etat, p.id, REGLES.nazgul.cri.doute);
  }
  ajouterVisibilite(etat, REGLES.nazgul.cri.visibilite, `Cri de ${def.nom}`);
  evenement(etat, 'nazgul', `Le cri de ${def.nom} glace ${region(monde, n.region).nom} et les terres voisines.`);
}

/* ------------------------------------------------------------------ */
/* Pulsation                                                           */
/* ------------------------------------------------------------------ */

/** Le porteur met l'Anneau (2.8). */
export function pulsation(monde: Monde, etat: EtatJeu, raison: string): void {
  const p = porteur(etat);
  etat.anneau.metCeTour = true;
  etat.anneau.traces[p.region] = { force: REGLES.anneau.traceAnneauMis, tour: etat.tour };
  etat.anneau.pulsation = { region: p.region, tour: etat.tour };
  changerDoute(etat, p.id, REGLES.doute.porterAnneau);
  ajouterVisibilite(etat, REGLES.anneau.pulsationVisibilite, 'Pulsation de l’Anneau');
  const proches = nazgulDisponibles(etat).filter((n) => distance(monde, n.region, p.region) <= REGLES.anneau.pulsationPortee);
  if (proches.length) {
    connaitreAnneau(etat, p.region, etat.tour, true);
    if (etat.anneau.etape === 'A0') {
      etat.anneau.etape = 'A1';
      ajouterVisibilite(etat, 3, 'A1, la Piste');
    }
    evenement(etat, 'pulsation', `PULSATION. L’Anneau a été passé au doigt (${raison}). Les Neuf le sentent à ${region(monde, p.region).nom}.`, {
      donnees: { region: p.region, nazgul: proches.map((n) => n.id) },
    });
  } else {
    evenement(etat, 'pulsation', 'Un frémissement lointain traverse l’Ombre. L’Anneau a été passé au doigt, trop loin des Neuf pour qu’ils le situent.', {
      donnees: { region: p.region },
    });
  }
}

/* ------------------------------------------------------------------ */
/* Combats nocturnes                                                   */
/* ------------------------------------------------------------------ */

function combattre(monde: Monde, etat: EtatJeu, regionId: IdRegion, cible: IdPersonnage, embusques: IdNazgul[], rng: Rng): void {
  const c = REGLES.nazgul.combat;
  // Une embuscade déclenchée appelle toute la meute présente : les autres Nazgûl de la région se joignent à l'assaut.
  const assaillants = nazgulDans(etat, regionId);
  if (!assaillants.some((n) => embusques.includes(n.id))) return;
  const defenseurs = presents(monde, etat, regionId).filter((p) => !p.brise);
  const vigilance = Math.max(0, ...defenseurs.map((p) => (p.vigilance && p.vigilance.jusquA >= etat.tour ? p.vigilance.defense : 0)));
  const alerte = etat.jauges.paliers.includes(40) ? REGLES.visibilite.defenseAlerte : 0;
  const lieux = region(monde, regionId).defenseCombat ?? 0;
  const defense = defenseurs.reduce((s, p) => s + (personnage(monde, p.id).defenseCombat ?? 0), 0) + vigilance + alerte + lieux;
  const roi = assaillants.find((n) => nazgulDef(monde, n.id).roiSorcier);
  const comptes = Math.min(assaillants.length, c.nazgulComptesMax);
  const chance = borner(c.base + c.parNazgulSupplementaire * (comptes - 1) + (roi ? c.roiSorcier : 0) - defense, c.min, c.max);
  const jet = rng.d100();
  const lieu = region(monde, regionId).nom;
  const nomCible = personnage(monde, cible).nom;
  for (const p of defenseurs) connaitrePosition(etat, p.id);
  const e = REGLES.nazgul.embuscade;
  const visibilite = e.visibilite + e.visibiliteParNazgul * (comptes - 1);
  ajouterVisibilite(etat, visibilite, `embuscade à ${lieu}`);
  mettreEnVeille(monde, etat, cible, defenseurs);
  const donnees = { region: regionId, cible, chance, jet, assaillants: assaillants.map((n) => n.id), defense, vigilance, alerte, lieux, visibilite };

  if (cible === etat.anneau.porteur && rng.chance(REGLES.pnj.anneauSousAttaque)) pulsation(monde, etat, `surpris par l’embuscade à ${lieu}`);

  if (jet < chance) {
    if (cible === etat.anneau.porteur) {
      const p = porteur(etat);
      // Le froid de la lame est un lien : un porteur déjà marqué ne s'échappe plus.
      if (p.blessureMorgul && jet < chance * c.fractionEtreinte) {
        etreinte(monde, etat, `les Neuf l’emportent à ${lieu}`);
        evenement(etat, 'combat', `Les Neuf fondent sur ${nomCible} à ${lieu} et l’emportent.`, { donnees });
        return;
      }
      // La lame ne frappe que si le Roi-Sorcier a tendu lui-même l'embuscade, et sur une victoire nette.
      if (roi && embusques.includes(roi.id) && !roi.lameMorgulUtilisee && jet < chance * REGLES.anneau.fractionLame) {
        roi.lameMorgulUtilisee = true;
        p.blessureMorgul = { depuis: etat.tour, froid: 0 };
        etat.anneau.etape = 'A2';
        ajouterVisibilite(etat, 8, 'A2, la Marque');
        ajouterEssence(etat, REGLES.essence.herosBriseOuBlesse, `${nomCible} blessé par la lame de Morgul`);
        evenement(etat, 'combat', `La lame de Morgul frappe ${nomCible} à ${lieu}. Le froid de la blessure est un lien : la Tour saura où il est.`, { donnees });
        return;
      }
    }
    changerDoute(etat, cible, c.douteVictoire);
    evenement(etat, 'combat', `Les Neuf surprennent ${nomCible} à ${lieu}. Il en réchappe, mais la peur ne le quitte plus.`, { donnees });
  } else {
    evenement(etat, 'combat', `L’embuscade à ${lieu} échoue : ${nomCible} et ses compagnons repoussent les Neuf.`, { donnees });
    const protecteur = defenseurs.find((p) => ['glorfindel', 'gandalf'].includes(p.id));
    if (protecteur) demonter(monde, etat, assaillants[0]!.id, `chassé par ${personnage(monde, protecteur.id).nom}`);
  }
}

/** Après une embuscade, la cible, son groupe et ceux qui l'ont défendue redoublent de prudence. */
function mettreEnVeille(monde: Monde, etat: EtatJeu, cible: IdPersonnage, defenseurs: { id: IdPersonnage }[]): void {
  const v = REGLES.nazgul.combat.vigilance;
  if (v.defense <= 0) return;
  const groupe = personnage(monde, cible).groupe;
  const ids = new Set(defenseurs.map((p) => p.id));
  for (const p of Object.values(etat.personnages)) {
    if (!(ids.has(p.id) || p.id === cible || (groupe && personnage(monde, p.id).groupe === groupe))) continue;
    const actuelle = p.vigilance && p.vigilance.jusquA >= etat.tour ? p.vigilance.defense : 0;
    p.vigilance = { defense: Math.min(v.max, actuelle + v.defense), jusquA: etat.tour + v.duree };
  }
}

/** A3 : l'Anneau est saisi (6.1). */
export function etreinte(monde: Monde, etat: EtatJeu, raison: string): void {
  if (etat.anneau.saisi) return;
  etat.anneau.saisi = true;
  etat.anneau.etape = 'A3';
  ajouterVisibilite(etat, 25, 'A3, l’Étreinte');
  evenement(etat, 'combat', `L’ÉTREINTE. L’Anneau est entre les mains des Neuf (${raison}). Il part vers Barad-dûr.`);
  void monde;
}

/** Phase 5, étape 4 : embuscades déclenchées, puis chasse de Glorfindel. */
export function resoudreNuit(monde: Monde, etat: EtatJeu, rng: Rng): void {
  for (const r of Object.values(etat.regions)) {
    r.embuscades = r.embuscades.filter((e) => e.expire >= etat.tour && etat.nazgul[e.nazgul]!.region === r.id && etat.nazgul[e.nazgul]!.indisponibleJusquA < etat.tour);
    if (!r.embuscades.length) continue;
    const ici = presents(monde, etat, r.id);
    const porteurIci = ici.find((p) => p.id === etat.anneau.porteur);
    const declenchee = r.embuscades.find((e) => (e.cible ? ici.some((p) => p.id === e.cible) : Boolean(porteurIci) || ici.some((p) => estHeros(monde, p.id))));
    if (!declenchee) continue;
    const cible = declenchee.cible ?? porteurIci?.id ?? ici.find((p) => estHeros(monde, p.id))!.id;
    // La nuit, les Neuf tapis sentent mieux la trace.
    for (const e of r.embuscades) jetDetection(monde, etat, e.nazgul, r.id, true, rng);
    const embusques = r.embuscades.map((e) => e.nazgul);
    r.embuscades = [];
    combattre(monde, etat, r.id, cible, embusques, rng);
    if (etat.anneau.saisi) return;
  }
  // Palier 60 : Glorfindel chasse les Nazgûl isolés.
  const glorfindel = etat.personnages['glorfindel'];
  if (glorfindel && etat.jauges.paliers.includes(60) && !glorfindel.sortiDeJeu) {
    const seuls = nazgulDans(etat, glorfindel.region);
    if (seuls.length === 1 && rng.chance(50)) demonter(monde, etat, seuls[0]!.id, 'traqué par Glorfindel');
  }
}
