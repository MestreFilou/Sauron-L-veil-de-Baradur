import { distance } from './carte';
import {
  ajouterEssence,
  ajouterVisibilite,
  changerDoute,
  changerMefiance,
  changerTerreur,
  connaitreAnneau,
  estHeros,
  evenement,
  nazgulDans,
  nazgulDisponibles,
  paMax,
  porteur,
  presents,
  retarderGroupe,
  statutRegion,
} from './etat';
import type { Monde } from './monde';
import { aRegle, nazgulDef, personnage, region, regionsJouables } from './monde';
import { genererMurmures } from './murmures';
import { decroissanceDesCendres, essenceDesForges } from './ouvrages';
import {
  crier,
  deplacerNazgul,
  etreinte,
  interroger,
  poserEmbuscade,
  pulsation,
  resoudreNuit,
  traquer,
} from './nazgul';
import { REGLES } from './regles';
import type { Rng } from './rng';
import { creerRng } from './rng';
import type { EtatJeu, IdPersonnage, IdRegion, Ordre } from './types';
import { resoudreVoix } from './voix';

export const rngPhase = (etat: EtatJeu, phase: string) => creerRng(etat.graine, etat.tour, phase);

/** Date du tour, au format du Comté (tour 1 = 22 septembre 3018). */
export function dateDuTour(tour: number): { jour: number; mois: number; annee: number; texte: string } {
  const { annee, mois, jour } = REGLES.tour.dateDepart;
  const d = new Date(Date.UTC(2018, mois - 1, jour + tour - 1));
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const j = d.getUTCDate();
  const m = d.getUTCMonth() + 1;
  return { jour: j, mois: m, annee, texte: `${j === 1 ? '1er' : j} ${MOIS[m - 1]} ${annee}` };
}

/* ------------------------------------------------------------------ */
/* Phase 1 : Aube                                                      */
/* ------------------------------------------------------------------ */

function regionVisee(monde: Monde, etat: EtatJeu, id: IdPersonnage): IdRegion {
  const p = etat.personnages[id]!;
  const def = personnage(monde, id);
  let r = def.itineraire[0]!.region;
  for (const e of def.itineraire) if (e.tour + p.retard <= etat.tour) r = e.region;
  return r;
}

/** Fait un pas vers une région (les PNJ marchent une région par jour hors calendrier). */
function pasVers(monde: Monde, de: IdRegion, vers: IdRegion): IdRegion {
  if (de === vers) return de;
  const r = region(monde, de);
  const suivant = r.voisins.map((v) => v.id).sort((a, b) => distance(monde, a, vers) - distance(monde, b, vers))[0];
  return suivant ?? de;
}

function deplacerPnj(monde: Monde, etat: EtatJeu, rng: Rng): void {
  const avant = new Map(Object.values(etat.personnages).map((p) => [p.id, p.region]));
  const groupesRetardes = new Set<string>();
  for (const p of Object.values(etat.personnages)) {
    const def = personnage(monde, p.id);
    if (p.sortiDeJeu || def.horsCarte) continue;
    if (p.detour) {
      p.region = pasVers(monde, p.region, p.detour);
      if (p.region === p.detour) {
        p.detour = null;
        retarderGroupe(monde, etat, p.id, 1);
      }
      continue;
    }
    const cible = regionVisee(monde, etat, p.id);
    if (cible === p.region) continue;
    // Aragorn évite les régions Sous l'Ombre : le groupe attend un jour.
    const groupe = def.groupe;
    const aragornGuide = groupe && Object.values(etat.personnages).some((q) => q.id === 'aragorn' && q.region === p.region && personnage(monde, q.id).groupe === groupe);
    if (groupe && aragornGuide && !groupesRetardes.has(groupe) && etat.regions[cible]!.terreur >= REGLES.terreur.seuils.sousOmbre) {
      groupesRetardes.add(groupe);
      if (rng.chance(REGLES.pnj.evitementAragorn)) {
        retarderGroupe(monde, etat, p.id, 1);
        evenement(etat, 'deplacement_pnj', `Grand-Pas flaire la peur sur la route de ${region(monde, cible).nom} et fait attendre ses compagnons.`, { public: false });
        continue;
      }
    }
    if (groupe && groupesRetardes.has(groupe) && regionVisee(monde, etat, p.id) === p.region) continue;
    p.region = cible;
    evenement(etat, 'deplacement_pnj', `${def.nom} gagne ${region(monde, cible).nom}.`, { public: false, donnees: { personnage: p.id, de: avant.get(p.id), vers: cible } });
  }
  // Un allié de confiance qui rejoint le personnage apaise son Doute.
  for (const p of Object.values(etat.personnages)) {
    if (p.sortiDeJeu) continue;
    for (const [autre, rel] of Object.entries(p.relations)) {
      const q = etat.personnages[autre];
      if (!q || rel < REGLES.doute.seuilAllieConfiance) continue;
      if (q.region === p.region && avant.get(autre) !== avant.get(p.id)) changerDoute(etat, p.id, REGLES.doute.allieRejoint);
    }
  }
}

function porteurMetAnneau(monde: Monde, etat: EtatJeu): boolean {
  const p = porteur(etat);
  return personnage(monde, p.id).itineraire.some((e) => e.metAnneau && e.region === p.region && e.tour + p.retard === etat.tour);
}

export function aube(monde: Monde, etat: EtatJeu): void {
  const rng = rngPhase(etat, 'aube');
  etat.evenements = [];
  etat.oeil = null;
  etat.rituel = false;
  etat.ordres = [];
  etat.voixCeTour = [];
  etat.anneau.metCeTour = false;
  etat.jauges.pa = Math.max(0, paMax(etat) - etat.jauges.malusPa);
  etat.jauges.malusPa = 0;
  etat.murmures = etat.murmures.filter((m) => m.tour >= etat.tour - 2);

  // 1. Retour des Nazgûl démontés ou en route.
  for (const n of Object.values(etat.nazgul)) {
    if (n.indisponibleJusquA === etat.tour - 1 && etat.tour > 1) {
      if (n.region === monde.donnees.regionRetraite || region(monde, n.region).horsCarte) n.region = monde.donnees.regionRetour;
      evenement(etat, 'nazgul', `${nazgulDef(monde, n.id).nom} rejoint la chasse, à ${region(monde, n.region).nom}.`);
    }
  }

  // 2. Les PNJ avancent selon le calendrier canon, modifié par leur état.
  if (etat.tour > 1) deplacerPnj(monde, etat, rng);

  // 3. Décroissances.
  if (etat.tour > 1 && !etat.actionVisible) ajouterVisibilite(etat, -(REGLES.visibilite.decroissance + decroissanceDesCendres(etat)), 'l’Ombre se fait discrète');
  etat.actionVisible = false;
  if (etat.tour > 1) {
    for (const r of regionsJouables(monde)) {
      const sage = presents(monde, etat, r.id).some((p) => personnage(monde, p.id).role === 'sage');
      if (sage) changerTerreur(monde, etat, r.id, -REGLES.terreur.decroissanceSage);
      else if (!nazgulDans(etat, r.id).length) changerTerreur(monde, etat, r.id, -REGLES.terreur.decroissanceSansNazgul);
    }
    for (const p of Object.values(etat.personnages)) {
      if (p.dernierContact < etat.tour - 1) changerMefiance(etat, p.id, -REGLES.mefiance.decroissance);
      if (p.mefiance < 50) p.alerteDonnee = false;
    }
  }

  // 4. Les vérités arrachées à Sauron se propagent aux alliés.
  for (const p of Object.values(etat.personnages)) {
    if (!p.veritesAPropager.length) continue;
    for (const q of Object.values(etat.personnages)) {
      if (q.id === p.id || q.sortiDeJeu) continue;
      const allie = (p.relations[q.id] ?? 0) >= 40 || q.region === p.region;
      if (!allie) continue;
      for (const v of p.veritesAPropager) if (!q.verites.includes(v)) q.verites.push(v);
      changerMefiance(etat, q.id, REGLES.mefiance.alerte.groupe);
    }
    p.veritesAPropager = [];
  }

  // 5. La trace de l'Anneau.
  const pt = porteur(etat);
  if (!etat.anneau.saisi && !pt.sortiDeJeu) {
    etat.anneau.traces[pt.region] = { force: REGLES.anneau.traceCachee, tour: etat.tour };
    if (porteurMetAnneau(monde, etat)) pulsation(monde, etat, `à ${region(monde, pt.region).nom}`);
  }
  // A2 : la Marque donne la position exacte chaque tour.
  if (pt.blessureMorgul) connaitreAnneau(etat, pt.region, etat.tour, true);

  // Le calendrier canon reste caché au joueur : il ne le découvre qu'après coup, à la Nuit.
  evenement(etat, 'aube', `Aube du ${dateDuTour(etat.tour).texte}.`);
  etat.phase = 'oeil';
}

/* ------------------------------------------------------------------ */
/* Phase 3 : Murmures                                                  */
/* ------------------------------------------------------------------ */

export function phaseMurmures(monde: Monde, etat: EtatJeu): void {
  const nouveaux = genererMurmures(monde, etat, rngPhase(etat, 'murmures'));
  etat.murmures.push(...nouveaux);
  evenement(etat, 'murmures', `${nouveaux.length} murmures remontent vers la Tour.`, { donnees: { ids: nouveaux.map((m) => m.id) } });
  etat.phase = 'ordres';
}

/* ------------------------------------------------------------------ */
/* Phase 5 : Crépuscule                                                */
/* ------------------------------------------------------------------ */

const PAYANTES = new Set<Ordre['type']>(['nazgul_traque', 'nazgul_interroger', 'nazgul_embuscade', 'nazgul_cri', 'nazgul_fleau']);
export const estActionNazgul = (o: Ordre) => PAYANTES.has(o.type);

export function crepuscule(monde: Monde, etat: EtatJeu): void {
  const rng = rngPhase(etat, 'crepuscule');
  const ordres = etat.ordres;
  // 1. Déplacements des Nazgûl.
  for (const o of ordres) if (o.type === 'nazgul_deplacer') deplacerNazgul(monde, etat, o.nazgul, o.destination, rng);
  // 2. Traques, détections, interrogatoires (et cris).
  ordres.forEach((o, i) => {
    if (!('nazgul' in o) || etat.nazgul[o.nazgul]!.indisponibleJusquA >= etat.tour) return;
    if (o.type === 'nazgul_traque') traquer(monde, etat, o.nazgul, rng);
    else if (o.type === 'nazgul_interroger') interroger(monde, etat, o.nazgul, o.pnj, rng, i);
    else if (o.type === 'nazgul_cri') crier(monde, etat, o.nazgul);
    else if (o.type === 'nazgul_embuscade') poserEmbuscade(monde, etat, o.nazgul, o.cible);
  });
  // 3. Voix, dans l'ordre choisi.
  for (const o of ordres) if (o.type === 'voix') resoudreVoix(monde, etat, o, rng);
  // Agents.
  for (const o of ordres) {
    if (o.type !== 'agent_placer') continue;
    const p = etat.personnages[o.pnj]!;
    const def = personnage(monde, o.pnj);
    if (p.doute >= REGLES.agent.douteMin && !p.sortiDeJeu) {
      p.agent = true;
      ajouterVisibilite(etat, REGLES.agent.visibilite, `agent ${def.nom}`);
      evenement(etat, 'voix', `${def.nom} entre au service de la Tour. Il rapportera ce qu’il voit à ${region(monde, p.region).nom}.`);
    } else {
      evenement(etat, 'voix', `${def.nom} n’est pas encore assez rongé pour servir (Doute ${p.doute} < ${REGLES.agent.douteMin}).`);
    }
  }
  // 4. Embuscades nocturnes et combats.
  resoudreNuit(monde, etat, rng);
  // 5. Corruption et rituels.
  for (const o of ordres) {
    if (o.type !== 'corruption') continue;
    const r = etat.regions[o.region]!;
    const def = region(monde, o.region);
    const relais = nazgulDans(etat, o.region).length > 0 || presents(monde, etat, o.region).some((p) => p.agent);
    if (statutRegion(r) !== 'ecrasee' || !relais || r.corruption || aRegle(def, 'sanctuaire')) {
      evenement(etat, 'corruption', `La corruption de ${def.nom} ne prend pas : il faut une région Écrasée (T ≥ 80) et un Nazgûl ou un agent sur place.`);
      continue;
    }
    etat.jauges.essence -= REGLES.corruption.essence;
    r.corruption = { lancee: etat.tour, toursTenus: 0 };
    ajouterVisibilite(etat, REGLES.corruption.visibilite, `corruption de ${def.nom}`);
    evenement(etat, 'corruption', `L’Ombre plonge ses racines dans ${def.nom}. Elle doit tenir trois jours.`);
  }
  if (etat.rituel) {
    const f = etat.jauges.forme + 1;
    etat.jauges.forme = f;
    ajouterVisibilite(etat, REGLES.forme.visibilite[f] ?? 0, `rituel de Forme ${f}`);
    const NOMS = ['L’Œil sans paupière', 'L’Ombre', 'La Main Noire', 'Le Seigneur revêtu', 'La Plénitude'];
    evenement(etat, 'forme', `Sauron reprend forme : ${NOMS[f]}.`);
  }
}

/* ------------------------------------------------------------------ */
/* Phase 6 : Nuit                                                      */
/* ------------------------------------------------------------------ */

function appliquerPalier(monde: Monde, etat: EtatJeu, palier: number): void {
  const heros = Object.values(etat.personnages).filter((p) => estHeros(monde, p.id) && !p.sortiDeJeu);
  switch (palier) {
    case 20:
      evenement(etat, 'seuil', 'Visibilité 20 : on parle d’Hommes Noirs sur les routes. À Bree, les langues se taisent.');
      break;
    case 40:
      for (const p of heros) changerMefiance(etat, p.id, REGLES.visibilite.mefianceAlerte);
      evenement(etat, 'seuil', 'Visibilité 40 : Gandalf et les Rôdeurs sont en alerte.');
      break;
    case 60: {
      const g = etat.personnages['glorfindel'];
      if (g && !g.sortiDeJeu) g.detour = 'gue_bruinen';
      evenement(etat, 'seuil', 'Visibilité 60 : Elrond convoque ses alliés. Glorfindel part en patrouille vers le Gué.');
      break;
    }
    case 80:
      for (const p of heros) changerDoute(etat, p.id, REGLES.visibilite.douteUnionOuest);
      evenement(etat, 'seuil', 'Visibilité 80 : l’Ouest s’unit. La Voix coûte désormais un PA de plus.');
      break;
    case 100:
      evenement(etat, 'seuil', 'Visibilité 100 : l’Ouest s’éveille.');
      break;
  }
}

function seuilsDoute(monde: Monde, etat: EtatJeu): void {
  const s = REGLES.doute.seuils;
  for (const p of Object.values(etat.personnages)) {
    if (p.sortiDeJeu) continue;
    const def = personnage(monde, p.id);
    for (const seuil of [s.faille, s.trahison, s.brise]) {
      if (p.doute < seuil || p.seuilsDoute.includes(seuil)) continue;
      p.seuilsDoute.push(seuil);
      if (seuil === s.faille) evenement(etat, 'seuil', `${def.nom} vacille : il peut désormais mentir à ses alliés ou choisir une mauvaise route.`);
      if (seuil === s.trahison) evenement(etat, 'seuil', `${def.nom} est au bord de la trahison : une Promesse peut le faire agir pour la Tour.`);
      if (seuil === s.brise) {
        p.brise = true;
        if (estHeros(monde, p.id)) ajouterEssence(etat, REGLES.essence.herosBriseOuBlesse, `${def.nom} brisé`);
        evenement(etat, 'seuil', `${def.nom} est brisé.`);
        if (p.id === etat.anneau.porteur) etreinte(monde, etat, `${def.nom} brisé livre l’Anneau`);
        else p.sortiDeJeu = true;
      }
    }
  }
}

function verifierFin(monde: Monde, etat: EtatJeu): void {
  const p = porteur(etat);
  if (etat.anneau.saisi) etat.issue = 'victoire_noire';
  else if (etat.jauges.visibilite >= 100) etat.issue = 'ouest_s_eveille';
  else if (p.region === monde.donnees.refuge.region) etat.issue = p.blessureMorgul || etat.anneau.etape === 'A2' ? 'victoire_grise' : 'statu_quo';
  else if (etat.tour >= REGLES.tour.dureeActeI + 15) etat.issue = 'statu_quo';
  if (etat.issue) {
    const TEXTES = {
      victoire_noire: 'Victoire noire : l’Anneau part vers le Mordor.',
      victoire_grise: 'Victoire grise : le porteur atteint Fondcombe, marqué par la lame.',
      statu_quo: 'Statu quo : l’Anneau atteint Fondcombe. L’Ouest reste divisé.',
      ouest_s_eveille: 'L’Ouest s’éveille : le Conseil Blanc se dresse contre l’Ombre.',
    } as const;
    evenement(etat, 'fin', TEXTES[etat.issue], { donnees: { issue: etat.issue } });
    etat.phase = 'fin';
  }
}

export function nuit(monde: Monde, etat: EtatJeu): void {
  const rng = rngPhase(etat, 'nuit');
  void rng;
  // 1. Essence et effets passifs des régions.
  let essence = REGLES.essence.anneauxNains;
  let visPassive = 0;
  for (const r of regionsJouables(monde)) {
    const er = etat.regions[r.id]!;
    if (er.corrompue) {
      essence += REGLES.essence.regionCorrompue;
      visPassive += REGLES.corruption.visibiliteParTour;
    } else if (er.terreur >= REGLES.terreur.seuils.sousOmbre) {
      essence += REGLES.essence.regionSousOmbre;
      visPassive += REGLES.terreur.visibiliteSousOmbre;
    }
  }
  ajouterEssence(etat, essence, 'tribut de la nuit');
  const forges = essenceDesForges(etat);
  if (forges) ajouterEssence(etat, forges, 'forges de l’Orodruin');
  if (visPassive) ajouterVisibilite(etat, visPassive, 'régions sous l’Ombre');

  // Doute des héros : peur, lame de Morgul, Sages, repos à Fondcombe.
  for (const p of Object.values(etat.personnages)) {
    if (p.sortiDeJeu) continue;
    const def = personnage(monde, p.id);
    if (estHeros(monde, p.id) && etat.regions[p.region]!.terreur >= REGLES.doute.terreurForte.seuil) changerDoute(etat, p.id, REGLES.doute.terreurForte.gain);
    const sage = presents(monde, etat, p.region).some((q) => q.id !== p.id && personnage(monde, q.id).role === 'sage');
    if (sage && def.role !== 'sage') changerDoute(etat, p.id, REGLES.doute.presenceSage);
    const refuge = monde.donnees.refuge;
    if (p.region === refuge.region) {
      changerDoute(etat, p.id, REGLES.doute.reposFondcombe);
      if (p.blessureMorgul && etat.personnages[refuge.gardien]?.region === refuge.region) {
        p.blessureMorgul = null;
        evenement(etat, 'seuil', `${personnage(monde, refuge.gardien).nom} soigne ${def.nom}. Le lien de la lame se rompt.`);
      }
    }
  }

  // Corruption en cours : elle doit tenir 3 tours à T ≥ 60.
  for (const r of regionsJouables(monde)) {
    const er = etat.regions[r.id]!;
    if (!er.corruption) continue;
    if (er.terreur < REGLES.corruption.seuilMaintien) {
      er.corruption = null;
      evenement(etat, 'corruption', `La peur reflue de ${r.nom} : la corruption échoue, l’Essence engagée est perdue.`);
      continue;
    }
    er.corruption.toursTenus++;
    if (er.corruption.toursTenus >= REGLES.corruption.toursPourPrendre) {
      er.corruption = null;
      if (rng.chance(100 - r.volonteRegionale)) {
        er.corrompue = true;
        evenement(etat, 'corruption', `${r.nom} est Corrompue. Ses gens deviennent des agents potentiels.`);
      } else {
        evenement(etat, 'corruption', `${r.nom} résiste à l’Ombre (Volonté régionale ${r.volonteRegionale}).`);
      }
    }
  }

  // 2. Seuils.
  for (const palier of REGLES.visibilite.paliers) {
    if (etat.jauges.visibilite >= palier && !etat.jauges.paliers.includes(palier)) {
      etat.jauges.paliers.push(palier);
      appliquerPalier(monde, etat, palier);
    }
  }
  seuilsDoute(monde, etat);
  for (const p of Object.values(etat.personnages)) {
    if (p.sortiDeJeu || p.alerteDonnee || p.mefiance < REGLES.mefiance.alerte.seuil || p.silenceJusquA >= etat.tour) continue;
    if (!estHeros(monde, p.id)) continue;
    p.alerteDonnee = true;
    const groupe = personnage(monde, p.id).groupe;
    for (const q of Object.values(etat.personnages)) {
      if (q.id !== p.id && (q.region === p.region || (groupe && personnage(monde, q.id).groupe === groupe))) changerMefiance(etat, q.id, REGLES.mefiance.alerte.groupe);
    }
    ajouterVisibilite(etat, REGLES.mefiance.alerte.visibilite, `${personnage(monde, p.id).nom} prévient ses alliés`);
    evenement(etat, 'seuil', `${personnage(monde, p.id).nom} sent l’Œil et prévient ses compagnons.`);
  }
  // A2 : le froid de la lame gagne le porteur ; à son comble, il devient un spectre.
  const pt = porteur(etat);
  if (pt.blessureMorgul && !pt.sortiDeJeu) {
    const b = pt.blessureMorgul;
    const a = REGLES.anneau;
    const autour = presents(monde, etat, pt.region).filter((q) => q.id !== pt.id);
    const sage = autour.some((q) => personnage(monde, q.id).role === 'sage');
    const guerisseur = autour.some((q) => personnage(monde, q.id).traits.includes('guerisseur'));
    const froid = sage ? a.froidSage : guerisseur ? a.froidGuerisseur : a.froidParNuit;
    b.froid = (b.froid ?? etat.tour - b.depuis) + froid;
    // Le Doute suit le froid : les soins qui ralentissent l'un apaisent l'autre.
    changerDoute(etat, pt.id, Math.round(REGLES.doute.lameMorgul * froid));
    if (b.froid >= a.froidSpectre) etreinte(monde, etat, `${personnage(monde, pt.id).nom} devient un spectre`);
  }

  // 3. Après coup, ce que le livre racontait de ce jour.
  const jalon = monde.donnees.calendrier.find((j) => j.tour === etat.tour);
  if (jalon) evenement(etat, 'canon', `Dans une autre histoire, ce jour-là : ${jalon.evenement}`, { donnees: { jalon } });

  // 4. Fin de l'acte, Journal.
  verifierFin(monde, etat);
  etat.journal.push({ tour: etat.tour, evenements: etat.evenements.filter((e) => e.public) });
}

/** Nombre de Nazgûl à portée de relais (utile à l'interface). */
export const relaisNazgul = (etat: EtatJeu) => nazgulDisponibles(etat).map((n) => n.region);
