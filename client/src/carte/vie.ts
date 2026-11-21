/**
 * La vie du monde, dessinée à la plume : fumées des cheminées, fenêtres qui
 * s'allument au crépuscule, vol de crébains. Aucune lueur, aucun dégradé :
 * des traits d'encre et de petites touches de couleur, comme sur une carte
 * qu'on aurait animée à la main.
 */
import type { Geographie } from '@sauron/world';
import { Graphics } from 'pixi.js';

type Pt = [number, number];

/** Cheminées : Bree, Hobbitebourg, Creux-de-Crique, Fondcombe. */
const CHEMINEES: Pt[] = [
  [791, 441],
  [801, 445],
  [353, 444],
  [431, 459],
  [586, 474],
  [1447, 404],
];

/** Fenêtres qui s'allument le soir (mêmes lieux, un peu plus bas). */
const FENETRES: Pt[] = [
  [781, 449],
  [791, 447],
  [800, 452],
  [787, 456],
  [797, 458],
  [352, 452],
  [368, 455],
  [430, 466],
  [470, 448],
  [497, 470],
  [585, 481],
  [1442, 414],
  [1450, 416],
];

export class Vie {
  /** Ce qui est posé sur le papier (fenêtres). */
  readonly sol = new Graphics();
  /** Ce qui passe au-dessus (fumées, oiseaux). */
  readonly ciel = new Graphics();
  /** Trajet des crébains : des Hauts du Sud vers les Galgals, puis retour. */
  private readonly vol: Pt[];

  constructor(geo: Geographie) {
    const c = (id: string, dx = 0, dy = 0): Pt => {
      const r = geo.regions[id];
      return r ? [r.centre[0] + dx, r.centre[1] + dy] : [800, 500];
    };
    this.vol = [c('route_sarn', 60, -40), c('galgals', 20, -60), c('chetwood', 40, -90), c('montauvent', -30, -110), c('terres_solitaires', -40, 60), c('route_sarn', 60, -40)];
  }

  /** `nuit` : 0 en plein jour, 1 en pleine nuit. */
  image(t: number, nuit: number) {
    const s = this.sol;
    s.clear();
    if (nuit > 0.02) {
      FENETRES.forEach(([x, y], k) => {
        // chaque fenêtre a sa bougie : elle vacille à son rythme
        const v = 0.75 + 0.25 * Math.sin(t * 0.006 + k * 2.3) * Math.sin(t * 0.0023 + k);
        s.rect(x - 0.7, y - 0.9, 1.4, 1.5).fill({ color: 0xf4b54a, alpha: Math.min(1, nuit * 1.4) * v });
      });
    }

    const g = this.ciel;
    g.clear();
    // fumées : des volutes d'encre grise qui montent et partent vers l'est
    CHEMINEES.forEach(([x, y], k) => {
      for (let i = 0; i < 5; i++) {
        const ph = (t * 0.00018 + i / 5 + k * 0.13) % 1;
        const px = x + ph * 9 + Math.sin(ph * 6 + k + i) * 2.2 * ph;
        const py = y - ph * 24;
        const r = 1.2 + ph * 3.2;
        g.arc(px, py, r, Math.PI * (0.9 + ph), Math.PI * (2.1 + ph));
        g.stroke({ width: 0.7, color: 0x4a4038, alpha: (1 - ph) * 0.5 * (1 - ph * 0.3) });
      }
    });

    // crébains : une nuée qui suit lentement son trajet (une boucle en 90 s)
    const T = 90000;
    const u = (t % T) / T;
    const n = this.vol.length - 1;
    for (let b = 0; b < 11; b++) {
      const ub = (u - b * 0.0025 + 1) % 1;
      const f = ub * n;
      const i = Math.floor(f),
        r = f - i;
      const a = this.vol[i]!,
        z = this.vol[i + 1]!;
      const ox = Math.sin(b * 2.1 + t * 0.0004) * 9 + (b % 3) * 4;
      const oy = Math.cos(b * 1.3 + t * 0.0005) * 6 + (b % 4) * 2;
      const x = a[0] + (z[0] - a[0]) * r + ox,
        y = a[1] + (z[1] - a[1]) * r + oy;
      const bat = Math.sin(t * 0.018 + b * 1.7) * 1.6;
      const e = 2.6;
      g.moveTo(x - e, y - bat).quadraticCurveTo(x - e * 0.4, y - 1.2 - bat * 0.5, x, y).quadraticCurveTo(x + e * 0.4, y - 1.2 - bat * 0.5, x + e, y - bat);
    }
    g.stroke({ width: 0.9, color: 0x1a120c, alpha: 0.8 });
  }
}
