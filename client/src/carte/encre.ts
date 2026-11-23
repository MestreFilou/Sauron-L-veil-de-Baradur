/**
 * Les procédés « à la main » de la carte : hachures à la plume, bord de lavis
 * du Regard, cercle tracé à l'encre rouge, brume au pointillé, sceaux de cire
 * des murmures et figurines peintes. Tout est cuit une fois dans des canevas
 * 2D, sans dégradé lisse ni lueur : de l'encre, de la cire et du papier.
 *
 * La lumière vient toujours du nord-ouest, comme sur les reliefs du
 * parchemin : flanc est ombré de hachures, ombre portée vers le sud-est.
 */
import type { SourceMurmure } from '@sauron/engine';
import { Alea, fbm, hash2, smooth, toile } from './bruit';

const al = new Alea();
const R = al.R;
const rnd = al.next;

const ENCRE = (a: number) => `rgba(52,36,22,${a})`;
const SANG = (a: number) => `rgba(125,36,20,${a})`;

/* ------------------------------------------------------------------ */
/* Hachures de l'inconnu                                               */
/* ------------------------------------------------------------------ */

/** Tuile de hachures à la plume, raccordable (256 px), traits obliques irréguliers. */
export function cuireHachures(T = 256): HTMLCanvasElement {
  const c = toile(T, T);
  const x = c.getContext('2d')!;
  al.reset(4242);
  x.lineCap = 'round';
  const trait = (x0: number, y0: number, an: number, L: number, w: number, a: number) => {
    for (const dx of [-T, 0, T])
      for (const dy of [-T, 0, T]) {
        x.strokeStyle = ENCRE(a);
        x.lineWidth = w;
        x.beginPath();
        x.moveTo(x0 + dx, y0 + dy);
        // légère courbe : la plume ne va jamais tout droit
        const mx = x0 + dx + (Math.cos(an) * L) / 2 + R(-0.6, 0.6),
          my = y0 + dy + (Math.sin(an) * L) / 2 + R(-0.6, 0.6);
        x.quadraticCurveTo(mx, my, x0 + dx + Math.cos(an) * L, y0 + dy + Math.sin(an) * L);
        x.stroke();
      }
  };
  // passe principale : obliques montantes, par paquets
  for (let k = 0; k < 520; k++) {
    const an = -0.78 + R(-0.08, 0.08);
    trait(R(0, T), R(0, T), an, R(7, 22), R(0.55, 1.05), R(0.28, 0.55));
  }
  // contre-hachures plus rares, là où l'inconnu s'épaissit
  for (let k = 0; k < 140; k++) {
    const px = R(0, T),
      py = R(0, T);
    if (fbm(px / 60, py / 60, 2) < 0.52) continue;
    trait(px, py, 0.72 + R(-0.1, 0.1), R(6, 14), R(0.5, 0.8), R(0.18, 0.35));
  }
  return c;
}

/* ------------------------------------------------------------------ */
/* Le Regard : bord de lavis, cercle à l'encre                         */
/* ------------------------------------------------------------------ */

/**
 * Masque du Regard : un disque au bord irrégulier, comme un lavis qui a bu le
 * papier ; la lisière est tramée de points, pas fondue.
 */
export function cuireMasqueRegard(T = 512): HTMLCanvasElement {
  const c = toile(T, T);
  const x = c.getContext('2d')!;
  const im = x.createImageData(T, T);
  const h = T / 2;
  for (let j = 0; j < T; j++)
    for (let i = 0; i < T; i++) {
      const dx = (i - h) / h,
        dy = (j - h) / h;
      const d = Math.hypot(dx, dy);
      const an = Math.atan2(dy, dx);
      const r = 0.84 + 0.07 * (fbm(Math.cos(an) * 2.2 + 5, Math.sin(an) * 2.2 + 5, 3) - 0.5) * 2 + 0.02 * (fbm(i / 9, j / 9, 2) - 0.5);
      const bord = 0.07;
      let v = 0;
      if (d < r - bord) v = 1;
      else if (d < r) v = hash2(i, j) < smooth(r, r - bord, d) ? 1 : 0;
      const k = (j * T + i) * 4;
      im.data[k] = im.data[k + 1] = im.data[k + 2] = 255;
      im.data[k + 3] = v * 255;
    }
  x.putImageData(im, 0, 0);
  return c;
}

/** Le cercle qu'un scribe trace autour de ce qu'on regarde : deux passes de plume rouge, qui se chevauchent. */
export function cuireCercleEncre(T = 512, graine = 7): HTMLCanvasElement {
  const c = toile(T, T);
  const x = c.getContext('2d')!;
  al.reset(graine);
  const h = T / 2;
  x.lineCap = 'round';
  for (let passe = 0; passe < 2; passe++) {
    const a0 = R(0, 6.28);
    const tour = 6.283 + R(0.25, 0.5);
    const r0 = h * (0.9 + passe * 0.025);
    const n = 160;
    let px = 0,
      py = 0;
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const an = a0 + t * tour;
      const r = r0 * (1 + 0.018 * Math.sin(an * 3 + passe * 2) + 0.01 * Math.sin(an * 7 + graine));
      const qx = h + Math.cos(an) * r,
        qy = h + Math.sin(an) * r;
      if (k > 0) {
        // la plume appuie au milieu du geste, s'allège aux extrémités
        const pression = Math.sin(Math.PI * t);
        x.strokeStyle = SANG(0.55 + 0.35 * pression);
        x.lineWidth = (passe ? 2.2 : 3.4) * (0.35 + 0.65 * pression);
        x.beginPath();
        x.moveTo(px, py);
        x.lineTo(qx, qy);
        x.stroke();
      }
      px = qx;
      py = qy;
    }
  }
  return c;
}

/* ------------------------------------------------------------------ */
/* Brume au pointillé                                                  */
/* ------------------------------------------------------------------ */

/** Brume gravée : des points d'encre dont la densité suit un bruit, comme sur une estampe. */
export function cuireBrumePointillee(w = 1100, hh = 700): HTMLCanvasElement {
  const c = toile(w, hh);
  const x = c.getContext('2d')!;
  const im = x.createImageData(w, hh);
  for (let j = 0; j < hh; j++)
    for (let i = 0; i < w; i++) {
      const n = fbm(i / 70, j / 52, 4);
      const dens = smooth(0.5, 0.78, n) * 0.22;
      if (hash2(i * 3 + 1, j * 7 + 2) < dens) {
        const k = (j * w + i) * 4;
        im.data[k] = 38;
        im.data[k + 1] = 27;
        im.data[k + 2] = 18;
        im.data[k + 3] = 150 + hash2(i, j) * 90;
      }
    }
  x.putImageData(im, 0, 0);
  return c;
}

/* ------------------------------------------------------------------ */
/* Sceaux de cire                                                      */
/* ------------------------------------------------------------------ */

export type EtatSceau = 'clos' | 'vrai' | 'brise';

const CIRE: Record<EtatSceau, { fond: string; creux: string; clair: string }> = {
  clos: { fond: '#8a1e10', creux: '#5e1208', clair: 'rgba(255,190,160,.55)' },
  vrai: { fond: '#7a2a12', creux: '#4e1a0a', clair: 'rgba(255,200,150,.45)' },
  brise: { fond: '#4a4440', creux: '#2e2a27', clair: 'rgba(230,220,210,.3)' },
};

/** Le motif frappé dans la cire, selon la source du murmure. */
function motif(x: CanvasRenderingContext2D, source: SourceMurmure) {
  x.beginPath();
  switch (source) {
    case 'nazgul': // un capuchon
      x.moveTo(0, -11);
      x.bezierCurveTo(-8, -11, -9, -2, -10, 10);
      x.lineTo(10, 10);
      x.bezierCurveTo(9, -2, 8, -11, 0, -11);
      x.moveTo(-3.5, -2);
      x.ellipse(0, -2, 3.5, 4.5, 0, Math.PI, 0);
      break;
    case 'crebain': // un corbeau en vol
      x.moveTo(-13, -3);
      x.quadraticCurveTo(-6, -8, 0, 0);
      x.quadraticCurveTo(6, -8, 13, -3);
      x.moveTo(-2, 1);
      x.lineTo(0, 6);
      x.lineTo(2, 1);
      break;
    case 'espion': // un œil
      x.moveTo(-12, 0);
      x.quadraticCurveTo(0, -10, 12, 0);
      x.quadraticCurveTo(0, 10, -12, 0);
      x.moveTo(3.5, 0);
      x.arc(0, 0, 3.5, 0, 6.283);
      break;
    case 'rumeur': // une chope
      x.rect(-7, -8, 11, 15);
      x.moveTo(4, -4);
      x.quadraticCurveTo(10, -3, 9, 2);
      x.quadraticCurveTo(8, 5, 4, 4);
      x.moveTo(-7, -8);
      x.quadraticCurveTo(-2, -13, 4, -8);
      break;
    case 'agent': // une clef
      x.arc(-6, 0, 4.5, 0, 6.283);
      x.moveTo(-1.5, 0);
      x.lineTo(12, 0);
      x.moveTo(8, 0);
      x.lineTo(8, 5);
      x.moveTo(11, 0);
      x.lineTo(11, 4);
      break;
  }
}

/** Un sceau de cire de 96 px (≈ 16 unités monde), lumière du nord-ouest. */
export function cuireSceau(source: SourceMurmure, etat: EtatSceau): HTMLCanvasElement {
  const T = 96;
  const c = toile(T, T);
  const x = c.getContext('2d')!;
  const coul = CIRE[etat];
  al.reset(source.length * 31 + etat.length * 7);
  x.translate(T / 2, T / 2);

  // contour de la cire écrasée, avec deux coulures
  const pts: [number, number][] = [];
  const n = 40;
  const coulures = [R(0, 6.28), R(0, 6.28)];
  for (let k = 0; k < n; k++) {
    const an = (k / n) * 6.283;
    let r = 33 + 3 * (fbm(Math.cos(an) * 1.7 + 3, Math.sin(an) * 1.7, 3) - 0.5) * 2;
    for (const cA of coulures) {
      const d = Math.abs(((an - cA + 9.42) % 6.283) - 3.14);
      r += Math.max(0, 9 - d * 22);
    }
    pts.push([Math.cos(an) * r, Math.sin(an) * r]);
  }
  const contour = () => {
    x.beginPath();
    pts.forEach(([px, py], k) => (k ? x.lineTo(px, py) : x.moveTo(px, py)));
    x.closePath();
  };

  // ombre portée au sud-est
  x.save();
  x.translate(3, 4);
  contour();
  x.fillStyle = 'rgba(40,25,12,.35)';
  x.fill();
  x.restore();

  x.save();
  if (etat === 'brise') {
    // une écaille manque : on la découpe avant de peindre
    x.beginPath();
    x.rect(-48, -48, 96, 96);
    x.moveTo(6, -40);
    x.lineTo(40, -40);
    x.lineTo(40, 8);
    x.lineTo(14, 4);
    x.lineTo(10, -8);
    x.closePath();
    x.clip('evenodd');
  }
  contour();
  x.fillStyle = coul.fond;
  x.fill();
  x.lineWidth = 1.4;
  x.strokeStyle = 'rgba(30,10,5,.6)';
  x.stroke();

  // le creux laissé par la matrice
  x.beginPath();
  x.arc(0, 0, 22, 0, 6.283);
  x.fillStyle = coul.creux;
  x.fill();
  // bourrelet : clair au nord-ouest, sombre au sud-est
  x.lineWidth = 2.4;
  x.strokeStyle = coul.clair;
  x.beginPath();
  x.arc(0, 0, 23.5, Math.PI * 0.95, Math.PI * 1.7);
  x.stroke();
  x.strokeStyle = 'rgba(20,6,2,.55)';
  x.beginPath();
  x.arc(0, 0, 21, Math.PI * 1.95, Math.PI * 0.7);
  x.stroke();

  // le motif, frappé en relief : une arête claire, une arête sombre
  x.lineCap = 'round';
  x.lineJoin = 'round';
  x.save();
  x.translate(-0.9, -0.9);
  motif(x, source);
  x.lineWidth = 2.2;
  x.strokeStyle = coul.clair;
  x.stroke();
  x.restore();
  x.save();
  x.translate(0.8, 0.8);
  motif(x, source);
  x.lineWidth = 2.2;
  x.strokeStyle = 'rgba(20,6,2,.7)';
  x.stroke();
  x.restore();

  // reflet peint sur la cire (un trait, pas un dégradé)
  x.strokeStyle = coul.clair;
  x.lineWidth = 2;
  x.beginPath();
  x.arc(0, 0, 29, Math.PI * 1.08, Math.PI * 1.38);
  x.stroke();
  x.restore();

  if (etat === 'brise') {
    x.strokeStyle = 'rgba(15,10,8,.85)';
    x.lineWidth = 1.3;
    x.beginPath();
    x.moveTo(-26, 18);
    x.lineTo(-10, 6);
    x.lineTo(-4, 9);
    x.lineTo(10, -8);
    x.stroke();
  }
  return c;
}

/* ------------------------------------------------------------------ */
/* Figurines                                                           */
/* ------------------------------------------------------------------ */

export type Figure = 'nazgul' | 'roi' | 'hobbit' | 'homme' | 'rodeur' | 'mage' | 'elfe';

/** Le genre de figurine qui convient à un personnage. */
export function figurePour(id: string): Figure {
  if (['frodon', 'sam', 'merry', 'pippin', 'l_ancien', 'maggotte', 'gros_bolger'].includes(id)) return 'hobbit';
  if (id === 'aragorn') return 'rodeur';
  if (id === 'gandalf' || id === 'saroumane') return 'mage';
  if (id === 'elrond' || id === 'glorfindel') return 'elfe';
  return 'homme';
}

const PEINTURE: Record<Figure, { manteau: string; clair: string; peau?: string }> = {
  nazgul: { manteau: '#1d1917', clair: '#6e655c' },
  roi: { manteau: '#191514', clair: '#7a6a58' },
  hobbit: { manteau: '#58653a', clair: '#a3ad7a', peau: '#d9b48c' },
  homme: { manteau: '#6a4a2e', clair: '#b08a62', peau: '#c99c76' },
  rodeur: { manteau: '#454a38', clair: '#8f957a', peau: '#c39672' },
  mage: { manteau: '#7e7b76', clair: '#d6d2c8', peau: '#d5b08e' },
  elfe: { manteau: '#b9b294', clair: '#efe9d2', peau: '#e2c7a6' },
};

/** Hauteur de chaque silhouette (en px de la toile, sur 128). */
const TAILLE: Record<Figure, number> = { nazgul: 92, roi: 98, hobbit: 58, homme: 84, rodeur: 90, mage: 94, elfe: 92 };

/**
 * Une figurine peinte sur son socle ovale, vue un peu de haut (comme une
 * pièce de jeu posée sur la carte). Toile 72 × 128 ; le centre du socle est
 * à (36, 112).
 */
export function cuireFigurine(f: Figure): HTMLCanvasElement {
  const L = 72,
    Hh = 128;
  const c = toile(L, Hh);
  const x = c.getContext('2d')!;
  const p = PEINTURE[f];
  const bx = 36,
    by = 112;
  const h = TAILLE[f];
  const l = f === 'hobbit' ? 15 : 17; // demi-largeur au bas du manteau

  // ombre portée vers le sud-est
  x.fillStyle = 'rgba(40,26,14,.32)';
  x.beginPath();
  x.ellipse(bx + 9, by + 4, 26, 8, -0.12, 0, 6.283);
  x.fill();

  // socle : ovale de métal, face supérieure claire, tranche sombre
  x.fillStyle = '#2a221b';
  x.beginPath();
  x.ellipse(bx, by + 3, 22, 8, 0, 0, 6.283);
  x.fill();
  x.fillStyle = '#4b3f33';
  x.beginPath();
  x.ellipse(bx, by, 22, 7.5, 0, 0, 6.283);
  x.fill();
  x.strokeStyle = 'rgba(210,180,130,.5)';
  x.lineWidth = 1.2;
  x.beginPath();
  x.ellipse(bx, by, 21, 7, 0, Math.PI * 0.95, Math.PI * 1.75);
  x.stroke();

  // silhouette : manteau en cloche, tête, attribut
  const haut = by - h;
  const corps = new Path2D();
  corps.moveTo(bx - l, by - 2);
  corps.bezierCurveTo(bx - l + 2, by - h * 0.45, bx - l * 0.55, haut + h * 0.28, bx - l * 0.42, haut + h * 0.2);
  corps.lineTo(bx + l * 0.42, haut + h * 0.2);
  corps.bezierCurveTo(bx + l * 0.55, haut + h * 0.28, bx + l - 2, by - h * 0.45, bx + l, by - 2);
  corps.quadraticCurveTo(bx, by + 3, bx - l, by - 2);
  const tete = new Path2D();
  const rt = f === 'hobbit' ? 7.5 : 7;
  if (f === 'nazgul' || f === 'roi' || f === 'rodeur') {
    // capuchon pointu
    tete.moveTo(bx - rt - 2, haut + h * 0.24);
    tete.quadraticCurveTo(bx - rt, haut + 2, bx + 1, haut);
    tete.quadraticCurveTo(bx + rt + 1, haut + 4, bx + rt + 2, haut + h * 0.24);
    tete.closePath();
  } else {
    tete.ellipse(bx, haut + rt + 2, rt, rt + 1, 0, 0, 6.283);
  }

  x.fillStyle = p.manteau;
  x.fill(corps);
  x.fill(tete);

  // ombre propre : hachures sur le flanc est
  x.save();
  const ombre = new Path2D();
  ombre.addPath(corps);
  ombre.addPath(tete);
  x.clip(ombre);
  x.strokeStyle = 'rgba(10,6,4,.5)';
  x.lineWidth = 1;
  for (let yy = haut - 20; yy < by + 20; yy += 3) {
    x.beginPath();
    x.moveTo(bx + 1, yy);
    x.lineTo(bx + l + 6, yy - (l + 5) * 0.8);
    x.stroke();
  }
  x.fillStyle = 'rgba(10,6,4,.25)';
  x.fillRect(bx + 3, haut, l + 4, h);
  x.restore();

  // lumière du nord-ouest : un trait clair sur le bord gauche
  x.strokeStyle = p.clair;
  x.lineWidth = 2;
  x.beginPath();
  x.moveTo(bx - l + 1.5, by - 5);
  x.bezierCurveTo(bx - l + 3, by - h * 0.45, bx - l * 0.55 + 1, haut + h * 0.3, bx - l * 0.4 + 1, haut + h * 0.22);
  x.stroke();

  // visage
  if (f === 'nazgul' || f === 'roi') {
    x.fillStyle = '#050403';
    x.beginPath();
    x.ellipse(bx, haut + h * 0.16, 3.6, 4.6, 0, 0, 6.283);
    x.fill();
    x.fillStyle = '#d9542a';
    x.fillRect(bx - 2, haut + h * 0.15, 1.3, 1.3);
    x.fillRect(bx + 0.8, haut + h * 0.15, 1.3, 1.3);
  } else if (p.peau) {
    x.fillStyle = p.peau;
    x.beginPath();
    x.ellipse(bx - 0.5, haut + rt + 3, rt * 0.62, rt * 0.7, 0, 0, 6.283);
    x.fill();
  }

  // attributs
  x.lineCap = 'round';
  if (f === 'roi') {
    x.fillStyle = '#b8955a';
    x.beginPath();
    x.moveTo(bx - 7, haut + 6);
    x.lineTo(bx - 5, haut - 3);
    x.lineTo(bx - 2, haut + 3);
    x.lineTo(bx, haut - 5);
    x.lineTo(bx + 2, haut + 3);
    x.lineTo(bx + 5, haut - 3);
    x.lineTo(bx + 7, haut + 6);
    x.closePath();
    x.fill();
  }
  if (f === 'mage') {
    // chapeau pointu et bâton
    x.fillStyle = p.manteau;
    x.beginPath();
    x.moveTo(bx - 12, haut + 5);
    x.lineTo(bx + 12, haut + 5);
    x.lineTo(bx + 3, haut - 16);
    x.closePath();
    x.fill();
    x.strokeStyle = '#4a3624';
    x.lineWidth = 2.2;
    x.beginPath();
    x.moveTo(bx - l - 3, by - 1);
    x.lineTo(bx - l + 1, haut - 6);
    x.stroke();
  }
  if (f === 'rodeur' || f === 'homme') {
    x.strokeStyle = f === 'rodeur' ? '#9a958a' : '#4a3624';
    x.lineWidth = 1.8;
    x.beginPath();
    x.moveTo(bx + l - 3, by - 6);
    x.lineTo(bx + l + 4, by - h * 0.62);
    x.stroke();
  }
  if (f === 'elfe') {
    x.strokeStyle = '#e8dfc0';
    x.lineWidth = 1.2;
    x.beginPath();
    x.moveTo(bx - rt + 1, haut + rt + 1);
    x.quadraticCurveTo(bx - rt - 4, haut + h * 0.35, bx - rt + 1, haut + h * 0.42);
    x.stroke();
  }

  // contour à l'encre
  x.strokeStyle = 'rgba(20,12,6,.9)';
  x.lineWidth = 1.3;
  x.stroke(corps);
  x.stroke(tete);
  return c;
}

/** Point d'ancrage de la figurine (centre du socle), en fraction de la toile. */
export const ANCRE_FIGURINE = { x: 36 / 72, y: 112 / 128 };
/** Hauteur de la toile de figurine, pour la mettre à l'échelle du monde. */
export const HAUTEUR_FIGURINE = 128;

/** Un tirage reproductible (pour les petites variations d'animation). */
export const tirage = (g: number) => {
  al.reset(g);
  return rnd();
};

/**
 * Un Cavalier Noir en figurine : cheval et cavalier encapuchonné sur un
 * socle ovale. Toile 112 × 128 ; le centre du socle est à (56, 112).
 */
export function cuireCavalier(roi: boolean): HTMLCanvasElement {
  const L = 112;
  const c = toile(L, HAUTEUR_FIGURINE);
  const x = c.getContext('2d')!;
  const bx = 56,
    by = 112;
  const noir = roi ? '#16120f' : '#1b1715';
  const clair = roi ? '#857160' : '#6e655c';

  x.fillStyle = 'rgba(40,26,14,.32)';
  x.beginPath();
  x.ellipse(bx + 10, by + 4, 40, 9, -0.08, 0, 6.283);
  x.fill();
  x.fillStyle = '#2a221b';
  x.beginPath();
  x.ellipse(bx, by + 3, 36, 9, 0, 0, 6.283);
  x.fill();
  x.fillStyle = '#4b3f33';
  x.beginPath();
  x.ellipse(bx, by, 36, 8.5, 0, 0, 6.283);
  x.fill();
  x.strokeStyle = 'rgba(210,180,130,.5)';
  x.lineWidth = 1.2;
  x.beginPath();
  x.ellipse(bx, by, 35, 8, 0, Math.PI * 0.95, Math.PI * 1.75);
  x.stroke();

  // le cheval, tourné vers l'ouest
  const cheval = new Path2D();
  cheval.moveTo(84, 70); // croupe
  cheval.bezierCurveTo(88, 80, 84, 90, 76, 92);
  cheval.lineTo(46, 92);
  cheval.bezierCurveTo(38, 90, 36, 82, 37, 74); // poitrail
  cheval.lineTo(30, 56); // encolure
  cheval.lineTo(20, 60); // chanfrein
  cheval.lineTo(17, 56);
  cheval.lineTo(26, 46); // tête
  cheval.lineTo(31, 44); // oreilles
  cheval.lineTo(33, 47);
  cheval.bezierCurveTo(44, 54, 50, 66, 56, 68); // crinière
  cheval.bezierCurveTo(66, 66, 78, 64, 84, 70);
  cheval.closePath();
  const jambes: [number, number, number, number][] = [
    [44, 90, 40, 110],
    [50, 91, 52, 110],
    [74, 90, 70, 110],
    [80, 88, 84, 109],
  ];
  // cavalier : manteau qui tombe sur le flanc, capuchon pointu
  const cavalier = new Path2D();
  cavalier.moveTo(48, 86);
  cavalier.bezierCurveTo(50, 70, 52, 52, 55, 40);
  cavalier.quadraticCurveTo(54, 26, 60, 20); // pointe du capuchon
  cavalier.quadraticCurveTo(68, 28, 67, 40);
  cavalier.bezierCurveTo(70, 52, 74, 66, 76, 88);
  cavalier.quadraticCurveTo(62, 92, 48, 86);

  x.lineCap = 'round';
  x.strokeStyle = noir;
  x.lineWidth = 4;
  for (const [a, b, c2, d] of jambes) {
    x.beginPath();
    x.moveTo(a, b);
    x.lineTo(c2, d);
    x.stroke();
  }
  // queue
  x.lineWidth = 3;
  x.beginPath();
  x.moveTo(85, 72);
  x.quadraticCurveTo(95, 82, 91, 100);
  x.stroke();

  x.fillStyle = noir;
  x.fill(cheval);
  x.fill(cavalier);

  // ombre propre en hachures (flanc est)
  x.save();
  const tout = new Path2D();
  tout.addPath(cheval);
  tout.addPath(cavalier);
  x.clip(tout);
  x.strokeStyle = 'rgba(0,0,0,.55)';
  x.lineWidth = 1;
  for (let yy = 10; yy < 130; yy += 3) {
    x.beginPath();
    x.moveTo(62, yy);
    x.lineTo(96, yy - 26);
    x.stroke();
  }
  x.restore();

  // lumière du nord-ouest sur les arêtes
  x.strokeStyle = clair;
  x.lineWidth = 1.8;
  x.beginPath();
  x.moveTo(37, 76);
  x.lineTo(30, 57);
  x.moveTo(26, 47);
  x.lineTo(31, 44);
  x.moveTo(49, 84);
  x.bezierCurveTo(51, 70, 53, 52, 55.5, 41);
  x.quadraticCurveTo(55, 28, 59.5, 21.5);
  x.stroke();

  // le vide sous le capuchon, deux braises
  x.fillStyle = '#050403';
  x.beginPath();
  x.ellipse(59, 33, 4, 5.2, 0, 0, 6.283);
  x.fill();
  x.fillStyle = '#d9542a';
  x.fillRect(56.6, 32, 1.4, 1.4);
  x.fillRect(59.6, 32, 1.4, 1.4);
  if (roi) {
    x.fillStyle = '#b8955a';
    x.beginPath();
    x.moveTo(53, 27);
    x.lineTo(54.5, 17);
    x.lineTo(57, 23);
    x.lineTo(60, 13);
    x.lineTo(63, 23);
    x.lineTo(65.5, 17);
    x.lineTo(67, 27);
    x.closePath();
    x.fill();
  }
  // l'œil du cheval, et le contour à l'encre
  x.fillStyle = '#b13a1a';
  x.fillRect(25, 49, 1.5, 1.5);
  x.strokeStyle = 'rgba(10,6,4,.95)';
  x.lineWidth = 1.3;
  x.stroke(cheval);
  x.stroke(cavalier);
  return c;
}

/** Point d'ancrage du cavalier (centre du socle), en fraction de la toile. */
export const ANCRE_CAVALIER = { x: 56 / 112, y: 112 / 128 };
