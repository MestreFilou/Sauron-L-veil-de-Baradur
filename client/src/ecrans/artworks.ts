/**
 * Les artworks des écrans de chargement : les images déposées dans artworks/
 * (dossier non versionné, comme la musique) et leurs crédits, lus dans
 * artworks/ecrans.json. Une image sans entrée dans le manifeste s'affiche sans
 * légende ; une entrée sans image est ignorée.
 *
 * Une entrée peut nommer un « fond » : une seconde image, large, affichée net
 * derrière le cadre au lieu de la même image floutée (les rendus 3D de la Tour,
 * dans artworks/3d/, en ont un). Une image qui sert de fond n'entre pas dans
 * la rotation des artworks.
 */
import manifeste from '../../../artworks/ecrans.json';
import { indexer } from '../son/fichiers';

export interface EntreeManifeste {
  fichier: string;
  titre?: string | null;
  artiste?: string | null;
  source?: string | null;
  licence?: string | null;
  cadrage?: string | null;
  fond?: string | null;
}

export interface Artwork {
  fichier: string;
  url: string;
  titre: string | null;
  artiste: string | null;
  source: string | null;
  licence: string | null;
  cadrage: string;
  /** URL de l'image de fond, si l'entrée en nomme une et qu'elle est présente. */
  fond: string | null;
}

const fichiers = import.meta.glob('../../../artworks/**/*.{webp,jpg,jpeg,png,avif,gif}', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

/** Associe les images présentes à leurs crédits ; l'ordre du manifeste d'abord, puis les images inconnues par nom. */
export function associer(entrees: EntreeManifeste[], urls: Map<string, string>): Artwork[] {
  const vues = new Set<string>(entrees.map((e) => e.fond).filter((f): f is string => !!f));
  const r: Artwork[] = [];
  for (const e of entrees) {
    const url = urls.get(e.fichier);
    if (!url || vues.has(e.fichier)) continue;
    vues.add(e.fichier);
    r.push({
      fichier: e.fichier,
      url,
      titre: e.titre ?? null,
      artiste: e.artiste ?? null,
      source: e.source ?? null,
      licence: e.licence ?? null,
      cadrage: e.cadrage ?? 'center',
      fond: (e.fond && urls.get(e.fond)) || null,
    });
  }
  for (const [fichier, url] of [...urls].sort(([a], [b]) => a.localeCompare(b))) {
    if (!vues.has(fichier)) r.push({ fichier, url, titre: null, artiste: null, source: null, licence: null, cadrage: 'center', fond: null });
  }
  return r;
}

export const ARTWORKS: Artwork[] = associer((manifeste as { ecrans: EntreeManifeste[] }).ecrans, indexer(fichiers, '/artworks/'));

const CLE = 'oeil-de-barad-dur/dernier-artwork';

/** L'artwork suivant : un autre à chaque chargement, dans l'ordre, en se souvenant d'une session à l'autre. */
export function artworkSuivant(): Artwork | null {
  if (!ARTWORKS.length) return null;
  let n = -1;
  try {
    n = Number(localStorage.getItem(CLE) ?? -1);
  } catch {
    /* stockage bloqué */
  }
  const i = (Number.isFinite(n) ? n + 1 : 0) % ARTWORKS.length;
  try {
    localStorage.setItem(CLE, String(i));
  } catch {
    /* tant pis : on reprendra au premier */
  }
  return ARTWORKS[i]!;
}
