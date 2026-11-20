/**
 * Banque audio : les voix enregistrées par Lucas (mécaniques 10.3) et la
 * musique par ambiance (10.3 bis). Tout est préenregistré ; aucune synthèse
 * ni IA ne tourne en cours de partie. Le code ne lit que les manifestes JSON :
 * changer de voix ou de musique ne demande aucune modification ici.
 */
import voixJson from '../banque/voix.json';
import pistesJson from '../musique/pistes.json';
import { verifierLigne } from './noirParler';

export type RegistreVoix = 'inscription' | 'paranoia' | 'annatar' | 'fer' | 'cri' | 'duel';

export interface Repere {
  mot: string;
  debut: number;
  fin: number;
}

export interface Replique {
  id: string;
  registre: RegistreVoix;
  /** noir_parler : phonétique lue à l'endroit. anglais_inverse : phrase anglaise lue puis inversée. */
  methode: 'noir_parler' | 'anglais_inverse';
  /** Ce que Lucas lit au micro. */
  lu: string;
  /** Transcription affichée au-dessus du sous-titre ; null pour l'anglais inversé. */
  noir_parler: string | null;
  sous_titre: string;
  /** Relatif au dossier audio/. */
  fichier: string;
  statut: 'a_enregistrer' | 'enregistre';
  duree_s: number | null;
  reperes: Repere[] | null;
}

export type Ambiance = 'barad_dur' | 'traque' | 'voix' | 'duel' | 'victoire' | 'defaite';

export interface Piste {
  /** Relatif au dossier audio/musique/. */
  fichier: string;
  titre?: string;
  boucle: boolean;
  volume_db: number;
  fondu_s: number;
}

export interface ManifesteMusique {
  version: 1;
  ambiances: Record<Ambiance, Piste[]>;
}

export const REPLIQUES = (voixJson as unknown as { repliques: Replique[] }).repliques;
export const MUSIQUE = pistesJson as unknown as ManifesteMusique;

/**
 * Une réplique du registre, choisie de façon déterministe par la clé. Seules
 * les répliques enregistrées sont jouables, sauf si l'on demande aussi les
 * autres (pour afficher le sous-titre seul en attendant l'enregistrement).
 */
export function repliquePour(registre: RegistreVoix, cle = 0, { memeNonEnregistrees = false } = {}, banque: Replique[] = REPLIQUES): Replique | undefined {
  const liste = banque.filter((r) => r.registre === registre && (memeNonEnregistrees || r.statut === 'enregistre'));
  return liste.length ? liste[Math.abs(Math.trunc(cle)) % liste.length] : undefined;
}

/** Ancien nom, gardé pour compatibilité. */
export const repliqueFixe = (registre: RegistreVoix, graine = 0) => repliquePour(registre, graine, { memeNonEnregistrees: true });

/**
 * Minutage du sous-titre (10.4) : les repères mot à mot s'ils existent, sinon
 * le texte réparti sur la durée du fichier, au prorata de la longueur des mots.
 */
export function minuterSousTitre(texte: string, duree: number, reperes?: Repere[] | null): Repere[] {
  if (reperes?.length) return reperes;
  const mots = texte.split(/\s+/).filter(Boolean);
  const total = mots.reduce((s, m) => s + m.length + 1, 0);
  let t = 0;
  return mots.map((mot) => {
    const d = (duree * (mot.length + 1)) / total;
    const r = { mot, debut: t, fin: t + d };
    t += d;
    return r;
  });
}

/** Une piste pour l'ambiance (plusieurs pistes alternent selon la clé) ; undefined = silence. */
export function pisteAmbiance(ambiance: Ambiance, cle = 0, manifeste: ManifesteMusique = MUSIQUE): Piste | undefined {
  const liste = manifeste.ambiances[ambiance] ?? [];
  return liste.length ? liste[Math.abs(Math.trunc(cle)) % liste.length] : undefined;
}

/** Contrôle de cohérence de la banque des voix ; renvoie la liste des problèmes. */
export function verifierBanqueVoix(banque: Replique[] = REPLIQUES, existe?: (fichier: string) => boolean): string[] {
  const pb: string[] = [];
  const vus = new Set<string>();
  for (const r of banque) {
    if (vus.has(r.id)) pb.push(`${r.id} : identifiant en double`);
    vus.add(r.id);
    if (r.fichier !== `voix/${r.id}.mp3`) pb.push(`${r.id} : le fichier devrait être voix/${r.id}.mp3`);
    if (!r.sous_titre.trim()) pb.push(`${r.id} : sous-titre vide`);
    if (r.methode === 'noir_parler') {
      if (!r.noir_parler) pb.push(`${r.id} : transcription en Noir Parler manquante`);
      else if (!verifierLigne(r.noir_parler).valide) pb.push(`${r.id} : mots hors lexique (${verifierLigne(r.noir_parler).inconnus.join(', ')})`);
    } else if (r.noir_parler) pb.push(`${r.id} : l’anglais inversé n’a pas de transcription en Noir Parler`);
    if (r.statut === 'enregistre') {
      if (!r.duree_s || r.duree_s <= 0) pb.push(`${r.id} : durée manquante`);
      if (existe && !existe(r.fichier)) pb.push(`${r.id} : fichier ${r.fichier} introuvable`);
    }
  }
  return pb;
}
