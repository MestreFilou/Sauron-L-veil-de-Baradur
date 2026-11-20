/** Petit bus d'événements entre React et les boucles d'animation (l'Œil, la carte). */
type Ecouteur = (v: number) => void;
const ecouteurs = new Map<string, Set<Ecouteur>>();

export const bus = {
  on(nom: string, f: Ecouteur) {
    if (!ecouteurs.has(nom)) ecouteurs.set(nom, new Set());
    ecouteurs.get(nom)!.add(f);
    return () => ecouteurs.get(nom)!.delete(f);
  },
  emit(nom: string, v = 1) {
    ecouteurs.get(nom)?.forEach((f) => f(v));
  },
};

/** Où se pose le Regard, en pixels d'écran (écrit par la carte, lu par l'Œil). */
export const regard = { x: 0, y: 0, verrouille: false };

/** Centre de l'Œil à l'écran : le cône part de là (direction artistique, 5 bis). */
export const OEIL_Y = 40;
