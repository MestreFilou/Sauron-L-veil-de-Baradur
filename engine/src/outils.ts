export const borner = (x: number, min: number, max: number): number => Math.min(max, Math.max(min, x));

/** Arrondi au plus proche, pour garder des jauges entières. */
export const arrondir = (x: number): number => Math.round(x);

/** Copie profonde d'un état sérialisable (le moteur ne mute jamais son entrée). */
export function cloner<T>(x: T): T {
  return structuredClone(x);
}
