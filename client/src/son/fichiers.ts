/**
 * Les fichiers audio présents sur le disque, connus au moment où Vite lit le
 * projet. Une voix pas encore enregistrée, ou une piste de musique absente
 * (la musique n'est jamais versionnée), n'apparaît simplement pas ici : le jeu
 * reste silencieux, sans requête vers un fichier qui n'existe pas.
 */
const voix = import.meta.glob('../../../audio/voix/**/*.{mp3,ogg,wav,m4a,opus}', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const musique = import.meta.glob('../../../audio/musique/**/*.{mp3,ogg,wav,flac,m4a,opus}', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

/** Indexe les URL par chemin relatif à un dossier de base (« voix/x.mp3 », « barad_dur/y.mp3 »). */
export function indexer(urls: Record<string, string>, base: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const [chemin, url] of Object.entries(urls)) {
    const i = chemin.indexOf(base);
    if (i >= 0) m.set(chemin.slice(i + base.length), url);
  }
  return m;
}

const VOIX = indexer(voix, '/audio/');
const MUSIQUE = indexer(musique, '/audio/musique/');

/** URL d'une réplique (chemin relatif à audio/, comme dans voix.json), ou undefined si le fichier manque. */
export const urlVoix = (fichier: string) => VOIX.get(fichier);
/** URL d'une piste (chemin relatif à audio/musique/, comme dans pistes.json), ou undefined. */
export const urlMusique = (fichier: string) => MUSIQUE.get(fichier);
