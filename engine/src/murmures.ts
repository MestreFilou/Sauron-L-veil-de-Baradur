import { connaitreAnneau, estHeros, evenement, ajouterEssence, nazgulDans, presents, statutRegion } from './etat';
import type { Monde } from './monde';
import { aRegle, nazgulDef, personnage, region, regionsJouables } from './monde';
import { REGLES } from './regles';
import type { Rng } from './rng';
import { estIsole } from './signal';
import type {
  EtatJeu,
  Fait,
  IdPersonnage,
  IdRegion,
  Murmure,
  SourceMurmure,
  StatutRegion,
  Verite,
} from './types';

/* ------------------------------------------------------------------ */
/* Textes factuels (le narrateur les habille ensuite)                  */
/* ------------------------------------------------------------------ */

const NOMBRES = ['aucun', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
const nombre = (n: number) => NOMBRES[n] ?? String(n);

const STATUTS: Record<StatutRegion, string> = {
  libre: 'la région est paisible',
  inquiete: 'les gens barrent leurs portes',
  sous_ombre: 'la population se terre ou s’enfuit',
  ecrasee: 'la peur écrase tout le pays',
  corrompue: 'l’Ombre a pris racine',
};

export function texteFait(monde: Monde, fait: Fait): string {
  const lieu = region(monde, fait.region).nom;
  switch (fait.type) {
    case 'presence': {
      const p = personnage(monde, fait.personnage);
      const n = fait.nombre ?? 1;
      return n > 1 ? `${p.nom} et ${nombre(n - 1)} compagnon${n > 2 ? 's' : ''} sont à ${lieu}` : `${p.nom} est à ${lieu}`;
    }
    case 'absence':
      return `${personnage(monde, fait.personnage).nom} n’est pas à ${lieu}`;
    case 'terreur':
      return `${lieu} : ${STATUTS[fait.statut]}`;
    case 'passage_porteur':
      return `quelqu’un portant un fardeau qui n’est pas le sien est passé par ${lieu}`;
    case 'nazgul':
      return `${nombre(fait.nombre)} cavalier${fait.nombre > 1 ? 's' : ''} noir${fait.nombre > 1 ? 's' : ''} rôde${fait.nombre > 1 ? 'nt' : ''} à ${lieu}`;
    case 'calme':
      return `rien d’inhabituel à ${lieu}`;
  }
}

const TONS: Record<SourceMurmure, string[]> = {
  espion: ['servile, pressé d’être payé', 'nerveux, regarde par-dessus son épaule', 'sournois'],
  crebain: ['croassé, haché, sans noms', 'vu de très haut'],
  rumeur: ['inquiet, aviné', 'goguenard, exagéré', 'chuchoté au coin du feu'],
  nazgul: ['glacé, sans détails physiques, plein d’auras', 'un souffle froid dans la pensée'],
  agent: ['précis, avide de plaire à la Main'],
};

const DEFORMATIONS: Record<Fait['type'], string[]> = {
  presence: ['le nombre change d’une unité, le nom reste exact', 'le nom est écorché', 'la direction prise est inversée'],
  absence: ['le témoin confond le jour'],
  terreur: ['la peur est exagérée', 'la peur est minimisée'],
  passage_porteur: ['le passage est daté de la veille', 'la route indiquée est la mauvaise'],
  nazgul: ['le nombre de cavaliers change', 'les cavaliers sont pris pour des brigands'],
  calme: ['un détail sans rapport est inventé'],
};

/* ------------------------------------------------------------------ */
/* Profils de vérité                                                   */
/* ------------------------------------------------------------------ */

export function profilVerite(
  monde: Monde,
  etat: EtatJeu,
  regionId: IdRegion,
  source: SourceMurmure,
  isole = false,
): Record<Verite, number> {
  const base = REGLES.murmures.sources[source];
  let vrai: number = base.vrai;
  let deforme: number = base.deforme;
  let faux: number = base.faux;
  if (source === 'nazgul' && isole) {
    vrai = REGLES.murmures.vraiSignalPerdu;
    deforme = 100 - vrai;
    faux = 0;
  }
  const er = etat.regions[regionId]!;
  if (source === 'espion' && er.terreur >= REGLES.murmures.peurEspion.seuil) {
    const d = Math.min(vrai, REGLES.murmures.peurEspion.faux);
    vrai -= d;
    faux += d;
  }
  if (regionId === 'bree' && etat.jauges.paliers.includes(20) && source !== 'nazgul') {
    const d = Math.min(vrai, REGLES.visibilite.malusFiabiliteBree);
    vrai -= d;
    faux += d;
  }
  if (er.corrompue) {
    let gain = REGLES.murmures.bonusCorrompue;
    const dFaux = Math.min(faux, gain);
    faux -= dFaux;
    gain -= dFaux;
    const dDef = Math.min(deforme, gain);
    deforme -= dDef;
    vrai += dFaux + dDef;
  }
  void monde;
  return { vrai, deforme, faux };
}

/* ------------------------------------------------------------------ */
/* Génération (phase 3)                                                */
/* ------------------------------------------------------------------ */

/** Région observée par l'Œil ce tour (celle de la cible, si c'est un personnage). */
export function regionObservee(etat: EtatJeu): IdRegion | null {
  const o = etat.oeil;
  if (!o || o.repousse) return null;
  if (o.cible.type === 'region') return o.cible.id;
  return etat.personnages[o.cible.id]?.region ?? null;
}

function faitsVrais(monde: Monde, etat: EtatJeu, regionId: IdRegion): { fait: Fait; poids: number }[] {
  const faits: { fait: Fait; poids: number }[] = [];
  const ici = presents(monde, etat, regionId);
  const groupesVus = new Set<string>();
  for (const p of ici) {
    const def = personnage(monde, p.id);
    if (def.groupe) {
      if (groupesVus.has(def.groupe)) continue;
      groupesVus.add(def.groupe);
      const membres = ici.filter((q) => personnage(monde, q.id).groupe === def.groupe);
      const tete = membres.find((q) => q.id === etat.anneau.porteur) ?? p;
      faits.push({ fait: { type: 'presence', personnage: tete.id, region: regionId, nombre: membres.length }, poids: 4 });
    } else {
      faits.push({ fait: { type: 'presence', personnage: p.id, region: regionId }, poids: estHeros(monde, p.id) ? 3 : 1 });
    }
  }
  const trace = etat.anneau.traces[regionId];
  if (trace && etat.tour - trace.tour <= 3) faits.push({ fait: { type: 'passage_porteur', region: regionId, tour: trace.tour }, poids: 3 });
  const n = nazgulDans(etat, regionId).length;
  if (n > 0) faits.push({ fait: { type: 'nazgul', region: regionId, nombre: n }, poids: 2 });
  const statut = statutRegion(etat.regions[regionId]!);
  if (statut !== 'libre') faits.push({ fait: { type: 'terreur', region: regionId, statut }, poids: 1 });
  if (faits.length === 0) faits.push({ fait: { type: 'calme', region: regionId }, poids: 1 });
  return faits;
}

/** Fabrique un fait faux plausible à partir du vrai. */
function faitFaux(monde: Monde, etat: EtatJeu, regionId: IdRegion, vrai: Fait, rng: Rng): Fait {
  if (vrai.type === 'presence' && rng.chance(50)) return { type: 'absence', personnage: vrai.personnage, region: regionId };
  if (vrai.type === 'nazgul' || vrai.type === 'passage_porteur') return { type: 'calme', region: regionId };
  const absents = monde.donnees.personnages.filter(
    (p) => !p.horsCarte && estHeros(monde, p.id) && etat.personnages[p.id]!.region !== regionId && !etat.personnages[p.id]!.sortiDeJeu,
  );
  if (absents.length && rng.chance(70)) {
    const p = rng.choisir(absents);
    return { type: 'presence', personnage: p.id, region: regionId };
  }
  if (vrai.type === 'calme') return { type: 'nazgul', region: regionId, nombre: rng.entier(1, 3) };
  return { type: 'calme', region: regionId };
}

function emetteur(monde: Monde, etat: EtatJeu, regionId: IdRegion, source: SourceMurmure, rng: Rng): string {
  const lieu = region(monde, regionId).nom;
  switch (source) {
    case 'nazgul': {
      const n = nazgulDans(etat, regionId)[0];
      return n ? `${nazgulDef(monde, n.id).nom} · lien des Neuf` : `Un des Neuf · ${lieu}`;
    }
    case 'agent': {
      const a = presents(monde, etat, regionId).find((p) => p.agent);
      return a ? `${personnage(monde, a.id).nom} · ${lieu}` : `Un agent · ${lieu}`;
    }
    case 'espion':
      return rng.choisir(['Espion de la route', 'Sudiste louche', 'Homme de Dunland']) + ` · ${lieu}`;
    case 'crebain':
      return `Crébains · ${lieu}`;
    case 'rumeur':
      return `Rumeur de taverne · ${lieu}`;
  }
}

function tirerVerite(profil: Record<Verite, number>, rng: Rng): Verite {
  const jet = rng.d100();
  if (jet < profil.vrai) return 'vrai';
  if (jet < profil.vrai + profil.deforme) return 'deforme';
  return 'faux';
}

export function creerMurmure(
  monde: Monde,
  etat: EtatJeu,
  regionId: IdRegion,
  source: SourceMurmure,
  rng: Rng,
  index: number,
  options: { verite?: Verite; isole?: boolean } = {},
): Murmure {
  const profil = profilVerite(monde, etat, regionId, source, options.isole);
  const verite = options.verite ?? tirerVerite(profil, rng);
  const candidats = faitsVrais(monde, etat, regionId);
  const vrai = rng.choisirPondere(candidats, (c) => c.poids)!.fait;
  const fait = verite === 'faux' ? faitFaux(monde, etat, regionId, vrai, rng) : vrai;
  return {
    id: `m_${etat.tour}_${index}`,
    tour: etat.tour,
    region: regionId,
    source,
    emetteur: emetteur(monde, etat, regionId, source, rng),
    verite,
    fait,
    faitTexte: texteFait(monde, fait),
    deformation: verite === 'deforme' ? rng.choisir(DEFORMATIONS[fait.type]) : null,
    ton: rng.choisir(TONS[source]),
    fiabilite: profil.vrai / 100,
    classement: null,
    tourClassement: null,
    verifie: false,
    recompense: false,
  };
}

/** Nombre de murmures du tour (3, phase 3). */
export function nombreMurmures(monde: Monde, etat: EtatJeu): number {
  const observee = regionObservee(etat);
  const corrompues = Object.values(etat.regions).filter((r) => r.corrompue).length;
  let n = REGLES.murmures.base + corrompues * REGLES.murmures.parRegionCorrompue;
  for (const r of regionsJouables(monde)) {
    if (r.murmuresBonus > 0 && r.id !== observee) n += r.murmuresBonus;
  }
  return Math.min(REGLES.murmures.max, n);
}

export function genererMurmures(monde: Monde, etat: EtatJeu, rng: Rng): Murmure[] {
  const observee = regionObservee(etat);
  const eligibles = regionsJouables(monde).filter(
    (r) => r.id !== observee && !aRegle(r, 'zone_aveugle') && r.sourcesMurmures.length > 0,
  );
  const poidsRegion = (id: IdRegion) => {
    const r = region(monde, id);
    const er = etat.regions[id]!;
    let p = Math.max(0.25, 1 + r.murmuresBonus * 0.5);
    if (er.terreur >= REGLES.terreur.seuils.inquiete) p *= REGLES.murmures.malusInquiete;
    if (er.corrompue) p += 1;
    if (nazgulDans(etat, id).length) p += 0.5;
    return p;
  };
  const nouveaux: Murmure[] = [];
  const total = nombreMurmures(monde, etat);
  for (let i = 0; i < total && eligibles.length; i++) {
    const r = rng.choisirPondere(eligibles, (x) => poidsRegion(x.id))!;
    const nz = nazgulDans(etat, r.id);
    let source: SourceMurmure;
    if (nz.length && rng.chance(50)) source = 'nazgul';
    else source = rng.choisir(r.sourcesMurmures.filter((s) => s !== 'nazgul').length ? r.sourcesMurmures.filter((s) => s !== 'nazgul') : r.sourcesMurmures);
    const isole = source === 'nazgul' && nz.length > 0 && estIsole(monde, etat, nz[0]!.id);
    nouveaux.push(creerMurmure(monde, etat, r.id, source, rng, i, { isole }));
  }
  // Chaque agent rapporte en plus un murmure fiable à 70 % sur sa région.
  let k = total;
  for (const p of Object.values(etat.personnages)) {
    if (!p.agent || p.sortiDeJeu || p.region === observee) continue;
    nouveaux.push(creerMurmure(monde, etat, p.region, 'agent', rng, k++));
  }
  return nouveaux;
}

/* ------------------------------------------------------------------ */
/* Classement et vérification                                          */
/* ------------------------------------------------------------------ */

/** Un murmure déformé repose sur un fait réel : le classer « vrai » est juste. */
export const classementJuste = (m: Murmure) =>
  (m.classement === 'vrai' && m.verite !== 'faux') || (m.classement === 'faux' && m.verite === 'faux');

export const concerne = (m: Murmure, cible: { region?: IdRegion; personnage?: IdPersonnage }) =>
  (cible.region !== undefined && (m.region === cible.region || m.fait.region === cible.region)) ||
  (cible.personnage !== undefined && 'personnage' in m.fait && m.fait.personnage === cible.personnage);

/**
 * Vérifie les murmures qui portent sur une région ou un personnage. Une bonne
 * déduction faite avant la fin du tour suivant son classement rapporte +1 Essence.
 */
export function verifierMurmures(
  etat: EtatJeu,
  cible: { region?: IdRegion; personnage?: IdPersonnage },
  par: string,
): string[] {
  const ids: string[] = [];
  for (const m of etat.murmures) {
    if (m.verifie || !concerne(m, cible)) continue;
    m.verifie = true;
    ids.push(m.id);
    if (m.fait.type === 'passage_porteur' && m.verite !== 'faux') connaitreAnneau(etat, m.fait.region, m.fait.tour, false);
    if (m.classement && m.classement !== 'incertain' && m.tourClassement !== null && etat.tour <= m.tourClassement + 1 && classementJuste(m)) {
      m.recompense = true;
      ajouterEssence(etat, REGLES.essence.bonneDeduction, `bonne déduction sur ${m.id}`);
    }
  }
  if (ids.length) evenement(etat, 'murmures', `${ids.length} murmure(s) vérifié(s) par ${par}.`, { donnees: { ids } });
  return ids;
}
