/**
 * Petits reliefs des lieux habités : villages, smials, tours, ruines.
 * Dessinés à l'encre sur le parchemin, éclairés du nord-ouest comme les
 * montagnes (flanc est ombré, ombre portée vers le sud-est).
 * Aucun tirage aléatoire ici : le reste de la carte ne bouge pas.
 */
import { INK, PAPER, RED } from './bruit';

type C = CanvasRenderingContext2D;

/** Teinte du flanc à l'ombre. */
export const OMBRE = 'rgba(120,88,52,.42)';
const TOIT = 'rgba(125,60,35,.55)';

/** Ombre portée au sol : ellipse floue décalée vers le sud-est. */
export function ombreSol(c: C, x: number, y: number, rx: number, ry: number, a = 0.22) {
  c.save();
  c.globalCompositeOperation = 'multiply';
  const g = c.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, `rgba(90,60,30,${a})`);
  g.addColorStop(1, 'rgba(90,60,30,0)');
  c.fillStyle = g;
  c.translate(x, y);
  c.scale(1, ry / rx);
  c.translate(-x, -y);
  c.beginPath();
  c.arc(x, y, rx, 0, 6.283);
  c.fill();
  c.restore();
}

function trait(c: C, w: number, s = INK) {
  c.strokeStyle = s;
  c.lineWidth = w;
  c.lineJoin = 'round';
  c.lineCap = 'round';
}

/** Butte ombrée (sert de socle à Bree, Amon Sûl, Fornost). */
export function butte(c: C, x: number, y: number, s: number) {
  ombreSol(c, x + s * 0.45, y + s * 0.08, s * 1.3, s * 0.35, 0.2);
  c.save();
  c.beginPath();
  c.moveTo(x - s, y);
  c.bezierCurveTo(x - s * 0.6, y - s * 0.85, x + s * 0.6, y - s * 0.85, x + s, y);
  c.closePath();
  c.fillStyle = PAPER;
  c.fill();
  c.clip();
  c.fillStyle = OMBRE;
  c.fillRect(x + s * 0.05, y - s, s, s);
  c.restore();
  c.beginPath();
  c.moveTo(x - s, y);
  c.bezierCurveTo(x - s * 0.6, y - s * 0.85, x + s * 0.6, y - s * 0.85, x + s, y);
  trait(c, 0.9);
  c.stroke();
  // hachures du flanc est
  c.beginPath();
  for (let k = 0; k < 4; k++) {
    const t = 0.25 + k * 0.18;
    c.moveTo(x + s * t, y - s * 0.62 * (1 - t * t) - 0.5);
    c.lineTo(x + s * t - s * 0.12, y - 0.8);
  }
  trait(c, 0.45, 'rgba(58,42,28,.7)');
  c.stroke();
}

/** Maison à pignon, w de large. */
export function maison(c: C, x: number, y: number, w: number, rouge = false) {
  const h = w * 0.55,
    t = w * 0.6;
  // corps
  c.beginPath();
  c.rect(x - w / 2, y - h, w, h);
  c.fillStyle = PAPER;
  c.fill();
  c.fillStyle = OMBRE;
  c.fillRect(x, y - h, w / 2, h);
  trait(c, 0.7);
  c.strokeRect(x - w / 2, y - h, w, h);
  // toit
  c.beginPath();
  c.moveTo(x - w / 2 - w * 0.12, y - h);
  c.lineTo(x - w * 0.05, y - h - t);
  c.lineTo(x + w / 2 + w * 0.12, y - h);
  c.closePath();
  c.fillStyle = rouge ? TOIT : 'rgba(150,118,72,.6)';
  c.fill();
  trait(c, 0.7);
  c.stroke();
  // porte
  c.fillStyle = INK;
  c.fillRect(x - w * 0.18, y - h * 0.55, w * 0.16, h * 0.55);
}

/** Smial de hobbit : butte herbue, porte ronde, fenêtre ronde. */
export function smial(c: C, x: number, y: number, s: number) {
  butte(c, x, y, s);
  c.beginPath();
  c.arc(x - s * 0.15, y - s * 0.22, s * 0.2, Math.PI, 0);
  c.lineTo(x + s * 0.05, y);
  c.lineTo(x - s * 0.35, y);
  c.closePath();
  c.fillStyle = 'rgba(46,80,52,.85)';
  c.fill();
  trait(c, 0.55);
  c.stroke();
  c.beginPath();
  c.arc(x + s * 0.38, y - s * 0.28, s * 0.09, 0, 6.283);
  c.fillStyle = INK;
  c.fill();
  // herbes au sommet
  c.beginPath();
  for (let k = -2; k <= 2; k++) {
    const gx = x + k * s * 0.22;
    c.moveTo(gx, y - s * 0.62 + Math.abs(k) * s * 0.1);
    c.lineTo(gx - 0.8, y - s * 0.62 + Math.abs(k) * s * 0.1 - 2);
  }
  trait(c, 0.45);
  c.stroke();
}

/** Tour (carrée), éventuellement en ruine (sommet brisé). */
export function tour(c: C, x: number, y: number, w: number, h: number, ruinee = false, blanche = false) {
  ombreSol(c, x + w * 0.9, y, w * 1.4, w * 0.4, 0.22);
  const sommet = y - h;
  c.beginPath();
  c.moveTo(x - w / 2, y);
  c.lineTo(x - w / 2, sommet);
  if (ruinee) {
    c.lineTo(x - w * 0.2, sommet + h * 0.12);
    c.lineTo(x - w * 0.05, sommet + h * 0.02);
    c.lineTo(x + w * 0.15, sommet + h * 0.22);
    c.lineTo(x + w / 2, sommet + h * 0.3);
  } else {
    // créneaux
    const n = 3,
      cw = w / (2 * n - 1);
    for (let i = 0; i < 2 * n - 1; i++) {
      const cx0 = x - w / 2 + i * cw;
      if (i % 2) {
        c.lineTo(cx0, sommet + cw);
        c.lineTo(cx0 + cw, sommet + cw);
        c.lineTo(cx0 + cw, sommet);
      } else c.lineTo(cx0 + cw, sommet);
    }
  }
  c.lineTo(x + w / 2, y);
  c.closePath();
  c.fillStyle = blanche ? 'rgba(244,236,214,.97)' : PAPER;
  c.fill();
  c.save();
  c.clip();
  c.fillStyle = blanche ? 'rgba(120,88,52,.22)' : OMBRE;
  c.fillRect(x + w * 0.08, sommet - 2, w, h + 2);
  c.restore();
  trait(c, 0.8);
  c.stroke();
  // meurtrières
  c.fillStyle = INK;
  c.fillRect(x - w * 0.12, sommet + h * 0.38, w * 0.14, h * 0.14);
  if (h > w * 2.2) c.fillRect(x - w * 0.12, sommet + h * 0.62, w * 0.14, h * 0.12);
}

/** Pan de mur en ruine. */
export function murRuine(c: C, x: number, y: number, w: number, h: number) {
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x, y - h);
  c.lineTo(x + w * 0.3, y - h * 0.8);
  c.lineTo(x + w * 0.45, y - h * 0.95);
  c.lineTo(x + w * 0.7, y - h * 0.45);
  c.lineTo(x + w, y - h * 0.55);
  c.lineTo(x + w, y);
  c.closePath();
  c.fillStyle = PAPER;
  c.fill();
  trait(c, 0.7);
  c.stroke();
  c.beginPath();
  c.moveTo(x + 1, y - h * 0.4);
  c.lineTo(x + w - 1, y - h * 0.4);
  trait(c, 0.4, 'rgba(58,42,28,.6)');
  c.stroke();
}

/** Pont de pierre à arches. */
export function pont(c: C, x: number, y: number, w: number, arches = 3, brise = false) {
  const h = w * 0.32,
    aw = w / arches;
  c.beginPath();
  c.moveTo(x - w / 2, y - h);
  if (brise) {
    c.lineTo(x - aw * 0.3, y - h);
    c.lineTo(x - aw * 0.1, y - h * 0.4);
    c.moveTo(x + aw * 0.25, y - h * 0.5);
    c.lineTo(x + aw * 0.4, y - h);
  }
  c.lineTo(x + w / 2, y - h);
  trait(c, 1.1);
  c.stroke();
  c.beginPath();
  for (let i = 0; i < arches; i++) {
    const ax = x - w / 2 + aw * (i + 0.5);
    if (brise && Math.abs(ax - x) < aw * 0.6) continue;
    c.moveTo(ax - aw / 2, y);
    c.arc(ax, y, aw * 0.36, Math.PI, 0);
    c.lineTo(ax + aw / 2, y);
  }
  trait(c, 0.7);
  c.stroke();
  c.beginPath();
  c.moveTo(x - w / 2, y - h);
  c.lineTo(x - w / 2, y);
  c.moveTo(x + w / 2, y - h);
  c.lineTo(x + w / 2, y);
  c.stroke();
}

/** Bree : butte, haie circulaire, maisons serrées. */
export function bree(c: C, x: number, y: number) {
  butte(c, x - 6, y + 4, 16);
  // haie (fossé) : arc pointillé autour du village
  c.save();
  c.setLineDash([1.6, 1.8]);
  c.beginPath();
  c.ellipse(x, y + 1, 17, 8, 0, 0.1, Math.PI - 0.1);
  trait(c, 1.1, 'rgba(46,70,40,.85)');
  c.stroke();
  c.restore();
  maison(c, x - 9, y - 1, 6);
  maison(c, x + 1, y - 3, 7, true);
  maison(c, x + 10, y + 1, 6);
  maison(c, x - 3, y + 5, 6.5, true);
  maison(c, x + 7, y + 7, 5.5);
}

/** Fondcombe : maison elfique, deux tours effilées. */
export function fondcombe(c: C, x: number, y: number) {
  ombreSol(c, x + 6, y + 1, 16, 4, 0.2);
  const fleche = (fx: number, fy: number, w: number, h: number) => {
    c.beginPath();
    c.rect(fx - w / 2, fy - h, w, h);
    c.fillStyle = PAPER;
    c.fill();
    c.fillStyle = OMBRE;
    c.fillRect(fx, fy - h, w / 2, h);
    trait(c, 0.7);
    c.strokeRect(fx - w / 2, fy - h, w, h);
    c.beginPath();
    c.moveTo(fx - w / 2 - 0.8, fy - h);
    c.lineTo(fx, fy - h - w * 2.2);
    c.lineTo(fx + w / 2 + 0.8, fy - h);
    c.closePath();
    c.fillStyle = RED;
    c.fill();
    trait(c, 0.6);
    c.stroke();
  };
  fleche(x - 9, y, 4, 12);
  maison(c, x, y, 11, true);
  fleche(x + 9, y, 3.6, 9);
  // arche d'entrée
  c.beginPath();
  c.arc(x - 0.6, y - 2.2, 1.6, Math.PI, 0);
  c.lineTo(x + 1, y);
  c.moveTo(x - 2.2, y - 2.2);
  c.lineTo(x - 2.2, y);
  trait(c, 0.5);
  c.stroke();
}

/** Phare des Havres Gris. */
export function phare(c: C, x: number, y: number) {
  tour(c, x, y, 4.2, 15, false, true);
  c.save();
  c.globalCompositeOperation = 'multiply';
  c.fillStyle = 'rgba(255,190,90,.5)';
  c.beginPath();
  c.arc(x, y - 17, 3.4, 0, 6.283);
  c.fill();
  c.restore();
}

/** Moulin (Hobbitebourg) : petite tour ronde et ailes. */
export function moulin(c: C, x: number, y: number) {
  ombreSol(c, x + 3, y, 6, 2, 0.2);
  c.beginPath();
  c.moveTo(x - 2.6, y);
  c.lineTo(x - 2, y - 8);
  c.lineTo(x + 2, y - 8);
  c.lineTo(x + 2.6, y);
  c.closePath();
  c.fillStyle = PAPER;
  c.fill();
  trait(c, 0.7);
  c.stroke();
  c.beginPath();
  for (let k = 0; k < 4; k++) {
    const an = 0.5 + (k * Math.PI) / 2;
    c.moveTo(x, y - 8);
    c.lineTo(x + Math.cos(an) * 6, y - 8 + Math.sin(an) * 6);
  }
  trait(c, 0.8);
  c.stroke();
}
