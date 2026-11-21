/**
 * Bruit et petits outils de dessin, repris de la maquette
 * (docs/direction-visuelle/maquette-ecran-principal.html). Tout est
 * déterministe : la carte est la même à chaque chargement.
 */
export type P = [number, number];

export function hash2(x: number, y: number): number {
  let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}

export function vnoise(x: number, y: number): number {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    xf = x - xi,
    yf = y - yi,
    u = xf * xf * (3 - 2 * xf),
    v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi),
    b = hash2(xi + 1, yi),
    c = hash2(xi, yi + 1),
    d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x: number, y: number, o: number): number {
  let s = 0,
    a = 0.5,
    f = 1,
    n = 0;
  for (let i = 0; i < o; i++) {
    s += a * vnoise(x * f + i * 17.3, y * f - i * 9.1);
    n += a;
    f *= 2.03;
    a *= 0.5;
  }
  return s / n;
}

/** Générateur de Park-Miller, comme la maquette (graine réglable). */
export class Alea {
  constructor(private graine = 1337) {}
  reset(g: number) {
    this.graine = g;
  }
  next = () => {
    this.graine = (this.graine * 16807) % 2147483647;
    return (this.graine - 1) / 2147483646;
  };
  R = (a: number, b: number) => a + (b - a) * this.next();
}

export const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const cl = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function catmull(p: P[], n = 10): P[] {
  const o: P[] = [];
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i]!,
      p1 = p[i]!,
      p2 = p[i + 1]!,
      p3 = p[i + 2] ?? p2;
    for (let k = 0; k < n; k++) {
      const t = k / n,
        t2 = t * t,
        t3 = t2 * t;
      o.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  o.push(p[p.length - 1]!);
  return o;
}

export function jit(p: P[], amp: number, freq = 0.04, off = 0): P[] {
  return p.map(([x, y], i) => {
    const a = p[Math.max(0, i - 1)]!,
      b = p[Math.min(p.length - 1, i + 1)]!;
    const dx = b[0] - a[0],
      dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 1;
    const w = (fbm(x * freq + off, y * freq + off, 3) - 0.5) * 2 * amp;
    return [x - (dy / L) * w, y + (dx / L) * w];
  });
}

export const toile = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  return c;
};

export function poly(c: CanvasRenderingContext2D, p: P[]) {
  c.beginPath();
  c.moveTo(p[0]![0], p[0]![1]);
  for (let i = 1; i < p.length; i++) c.lineTo(p[i]![0], p[i]![1]);
}

export const FELL = 'Fondamento, Georgia, serif';
export const CINZ = 'Almendra, "Times New Roman", serif';
export const INK = '#3a2a1c';
export const RED = '#7d2414';
export const WATER = '#2f3d47';
export const PAPER = 'rgba(228,212,172,.93)';

export interface OptionsTexte {
  r?: number;
  f?: string;
  sp?: number;
  a?: number;
  halo?: boolean;
  hw?: number;
  c?: string;
}

/** Texte de carte : lettres espacées, halo de parchemin. */
export function texte(c: CanvasRenderingContext2D, s: string, x: number, y: number, o: OptionsTexte = {}) {
  c.save();
  c.translate(x, y);
  if (o.r) c.rotate(o.r);
  c.font = o.f ?? `italic 13px ${FELL}`;
  c.textBaseline = 'middle';
  const sp = o.sp ?? 0;
  const ch = [...s];
  const ws = ch.map((k) => c.measureText(k).width);
  const tot = ws.reduce((a, b) => a + b, 0) + sp * (ws.length - 1);
  c.globalAlpha = o.a ?? 1;
  if (o.halo !== false) {
    c.strokeStyle = 'rgba(232,216,178,.7)';
    c.lineWidth = o.hw ?? 3;
    c.lineJoin = 'round';
    let hx = -tot / 2;
    ch.forEach((k, i) => {
      c.strokeText(k, hx, 0);
      hx += ws[i]! + sp;
    });
  }
  c.fillStyle = o.c ?? INK;
  let cx = -tot / 2;
  ch.forEach((k, i) => {
    c.fillText(k, cx, 0);
    cx += ws[i]! + sp;
  });
  c.restore();
}

/* Runes procédurales façon Cirth */
function glypheRune(c: CanvasRenderingContext2D, x: number, y: number, h: number, code: number): number {
  const w = h * 0.42;
  c.moveTo(x, y);
  c.lineTo(x, y - h);
  if (code & 1) {
    c.moveTo(x, y - h);
    c.lineTo(x + w, y - h + w);
  }
  if (code & 2) {
    c.moveTo(x, y - h);
    c.lineTo(x - w, y - h + w);
  }
  if (code & 4) {
    c.moveTo(x, y - h * 0.5);
    c.lineTo(x + w, y - h * 0.5 - w * 0.8);
  }
  if (code & 8) {
    c.moveTo(x, y - h * 0.45);
    c.lineTo(x - w, y - h * 0.45 + w * 0.7);
  }
  if (code & 16) {
    c.moveTo(x + w, y);
    c.lineTo(x + w, y - h);
    c.moveTo(x, y - h * 0.62);
    c.lineTo(x + w, y - h * 0.32);
  }
  return code & 16 ? w : 0;
}

export function rangeeRunes(c: CanvasRenderingContext2D, x: number, y: number, h: number, n: number, sv: number) {
  c.beginPath();
  let cx = x;
  for (let i = 0; i < n; i++) {
    const code = 1 + Math.floor(hash2(i, sv) * 31);
    cx += glypheRune(c, cx, y, h, code) + h * 0.72;
  }
  c.stroke();
  return cx;
}

/** Chemin SVG d'une rangée de runes (pour les titres des panneaux). */
export function cheminRunes(n: number, sv: number, h = 11): { d: string; largeur: number } {
  let d = '',
    x = 4;
  for (let i = 0; i < n; i++) {
    const code = 1 + Math.floor(hash2(i, sv) * 31),
      w = h * 0.42,
      y = h + 1,
      X = x;
    d += `M${X} ${y}L${X} ${y - h}`;
    if (code & 1) d += `M${X} ${y - h}L${X + w} ${y - h + w}`;
    if (code & 2) d += `M${X} ${y - h}L${X - w} ${y - h + w}`;
    if (code & 4) d += `M${X} ${y - h * 0.5}L${X + w} ${y - h * 0.5 - w * 0.8}`;
    if (code & 8) d += `M${X} ${y - h * 0.45}L${X - w} ${y - h * 0.45 + w * 0.7}`;
    if (code & 16) {
      d += `M${X + w} ${y}L${X + w} ${y - h}M${X} ${y - h * 0.62}L${X + w} ${y - h * 0.32}`;
      x += w;
    }
    x += h * 0.72;
  }
  return { d, largeur: x };
}
