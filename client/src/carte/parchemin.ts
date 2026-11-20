/**
 * Le parchemin de l'Eriador, cuit une fois pour toutes dans des canevas 2D
 * (portage de buildParchment / buildMap de la maquette). PixiJS les reçoit
 * ensuite comme textures. La côte, les rivières et les routes viennent de
 * world/eriador/geographie.json ; reliefs, forêts et étiquettes sont le décor
 * dessiné à la main de la maquette.
 */
import type { Geographie } from '@sauron/world';
import { Alea, catmull, CINZ, FELL, fbm, hash2, INK, jit, lerp, PAPER, poly, rangeeRunes, RED, smooth, texte, toile, WATER } from './bruit';
import type { P } from './bruit';

export const W = 1600;
export const H = 1000;
/** Suréchantillonnage du parchemin (net au zoom maximal). */
export const S = 1.5;

const a = new Alea();
const R = a.R;
const rnd = a.next;

function parchemin(b: CanvasRenderingContext2D) {
  b.setTransform(S, 0, 0, S, 0, 0);
  const pw = 400,
    ph = 250,
    pc = toile(pw, ph),
    px = pc.getContext('2d')!,
    im = px.createImageData(pw, ph);
  for (let y = 0; y < ph; y++)
    for (let x = 0; x < pw; x++) {
      const n = fbm(x / 55, y / 55, 5),
        m = fbm(x / 9 + 40, y / 9, 3);
      const t = smooth(0.3, 0.72, n * 0.8 + m * 0.2);
      const i = (y * pw + x) * 4;
      im.data[i] = 235 - t * 40;
      im.data[i + 1] = 222 - t * 50;
      im.data[i + 2] = 186 - t * 64;
      im.data[i + 3] = 255;
    }
  px.putImageData(im, 0, 0);
  b.imageSmoothingEnabled = true;
  b.drawImage(pc, 0, 0, W, H);
  const gw = 800,
    gh = 500,
    gc = toile(gw, gh),
    gx = gc.getContext('2d')!,
    gi = gx.createImageData(gw, gh);
  for (let i = 0; i < gw * gh; i++) {
    const v = hash2(i, 7) < 0.5 ? 70 : 255;
    gi.data[i * 4] = gi.data[i * 4 + 1] = v;
    gi.data[i * 4 + 2] = v * 0.9;
    gi.data[i * 4 + 3] = hash2(i, 9) * 20;
  }
  gx.putImageData(gi, 0, 0);
  b.drawImage(gc, 0, 0, W, H);
  // fibres
  b.lineWidth = 0.4;
  for (let i = 0; i < 500; i++) {
    const x = R(0, W),
      y = R(0, H),
      an = R(0, 6.28),
      l = R(4, 16);
    b.strokeStyle = rnd() < 0.5 ? 'rgba(120,90,50,.10)' : 'rgba(255,250,230,.18)';
    b.beginPath();
    b.moveTo(x, y);
    b.quadraticCurveTo(x + Math.cos(an) * l * 0.5 + R(-2, 2), y + Math.sin(an) * l * 0.5 + R(-2, 2), x + Math.cos(an) * l, y + Math.sin(an) * l);
    b.stroke();
  }
  // taches
  b.globalCompositeOperation = 'multiply';
  for (let i = 0; i < 16; i++) {
    const x = R(0, W),
      y = R(0, H),
      r = R(40, 170);
    const g = b.createRadialGradient(x, y, r * 0.1, x, y, r);
    g.addColorStop(0, `rgba(160,115,60,${R(0.05, 0.14)})`);
    g.addColorStop(1, 'rgba(160,115,60,0)');
    b.fillStyle = g;
    b.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  for (let i = 0; i < 3; i++) {
    const x = R(200, 1400),
      y = R(150, 850),
      r = R(30, 60);
    b.strokeStyle = 'rgba(130,85,40,.13)';
    b.lineWidth = R(1.5, 3);
    b.beginPath();
    b.arc(x, y, r, R(0, 3), R(4, 6.4));
    b.stroke();
  }
  // pliures
  (
    [
      [W * 0.5, 0, 1, H],
      [0, H * 0.5, W, 1],
    ] as const
  ).forEach(([x, y], k) => {
    const g = k ? b.createLinearGradient(0, y - 10, 0, y + 10) : b.createLinearGradient(x - 10, 0, x + 10, 0);
    g.addColorStop(0, 'rgba(120,90,50,0)');
    g.addColorStop(0.48, 'rgba(120,90,50,.16)');
    g.addColorStop(0.52, 'rgba(120,90,50,.05)');
    g.addColorStop(1, 'rgba(120,90,50,0)');
    b.fillStyle = g;
    if (k) b.fillRect(0, y - 10, W, 20);
    else b.fillRect(x - 10, 0, 20, H);
  });
  b.globalCompositeOperation = 'source-over';
  b.fillStyle = 'rgba(255,248,225,.18)';
  b.fillRect(W * 0.5 + 1.5, 0, 1, H);
  b.fillRect(0, H * 0.5 + 1.5, W, 1);
  // brûlure des bords
  b.globalCompositeOperation = 'multiply';
  const g = b.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, W * 0.62);
  g.addColorStop(0, 'rgba(100,60,25,0)');
  g.addColorStop(1, 'rgba(95,55,22,.75)');
  b.fillStyle = g;
  b.fillRect(0, 0, W, H);
  (
    [
      [0, 0, W, 34, 0, 1],
      [0, H - 34, W, 34, 0, -1],
      [0, 0, 34, H, 1, 0],
      [W - 34, 0, 34, H, -1, 0],
    ] as const
  ).forEach(([x, y, w, h, dx, dy]) => {
    const lg = dx ? b.createLinearGradient(dx > 0 ? 0 : W, 0, dx > 0 ? 34 : W - 34, 0) : b.createLinearGradient(0, dy > 0 ? 0 : H, 0, dy > 0 ? 34 : H - 34);
    lg.addColorStop(0, 'rgba(70,40,15,.55)');
    lg.addColorStop(1, 'rgba(70,40,15,0)');
    b.fillStyle = lg;
    b.fillRect(x, y, w, h);
  });
  b.globalCompositeOperation = 'source-over';
}

function pic(c: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const h = s * R(1.0, 1.5),
    lx = x - s * R(0.9, 1.2),
    rx = x + s * R(0.9, 1.3),
    ax = x + R(-0.2, 0.2) * s,
    ay = y - h;
  c.beginPath();
  c.moveTo(lx, y);
  c.quadraticCurveTo(lx + (ax - lx) * 0.55, y - h * 0.6, ax, ay);
  c.quadraticCurveTo(ax + (rx - ax) * 0.4, y - h * 0.55, rx, y);
  c.fillStyle = PAPER;
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 1.05;
  c.stroke();
  c.lineWidth = 0.55;
  c.strokeStyle = 'rgba(58,42,28,.75)';
  const n = Math.max(2, Math.round(s / 3));
  c.beginPath();
  for (let i = 1; i <= n; i++) {
    const t = (i / (n + 1)) * 0.92,
      sx = ax + (rx - ax) * t,
      sy = ay + (y - ay) * t * 0.95;
    c.moveTo(sx, sy);
    c.lineTo(sx - s * 0.22, y - 1.2);
  }
  c.moveTo(ax, ay);
  c.lineTo(ax + s * 0.12, y - h * 0.35);
  c.stroke();
}
function chaine(spine: P[], width: number, s0: number, s1: number, step: number): [number, number, number][] {
  const sp = catmull(spine, 14),
    pk: [number, number, number][] = [];
  let acc = 0;
  for (let i = 0; i < sp.length - 1; i++) {
    const [x0, y0] = sp[i]!,
      [x1, y1] = sp[i + 1]!;
    const L = Math.hypot(x1 - x0, y1 - y0);
    acc += L;
    while (acc > step) {
      acc -= step;
      const t = rnd(),
        off = R(-width, width);
      const nx = -(y1 - y0) / L,
        ny = (x1 - x0) / L;
      pk.push([x0 + (x1 - x0) * t + nx * off, y0 + (y1 - y0) * t + ny * off, R(s0, s1) * (1 - (0.45 * Math.abs(off)) / width)]);
    }
  }
  return pk;
}
function colline(c: CanvasRenderingContext2D, x: number, y: number, s: number) {
  c.beginPath();
  c.moveTo(x - s, y);
  c.bezierCurveTo(x - s * 0.6, y - s * 1.05, x + s * 0.6, y - s * 1.05, x + s, y);
  c.fillStyle = PAPER;
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 0.9;
  c.stroke();
  c.lineWidth = 0.5;
  c.beginPath();
  c.moveTo(x + s * 0.35, y - s * 0.55);
  c.lineTo(x + s * 0.15, y - 1);
  c.moveTo(x + s * 0.65, y - s * 0.35);
  c.lineTo(x + s * 0.5, y - 1);
  c.stroke();
}
function collines(cx: number, cy: number, rx: number, ry: number, n: number, s0: number, s1: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const an = R(0, 6.28),
      r = Math.sqrt(rnd());
    out.push([cx + Math.cos(an) * rx * r, cy + Math.sin(an) * ry * r, R(s0, s1)]);
  }
  return out;
}
function arbre(c: CanvasRenderingContext2D, x: number, y: number, s: number) {
  c.beginPath();
  c.arc(x, y - s * 0.9, s * 0.72, Math.PI * 0.78, Math.PI * 2.22);
  c.closePath();
  c.fillStyle = PAPER;
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 0.75;
  c.stroke();
  c.beginPath();
  c.moveTo(x, y - s * 0.3);
  c.lineTo(x, y + s * 0.2);
  c.moveTo(x + s * 0.35, y - s * 1.15);
  c.arc(x, y - s * 0.9, s * 0.45, -0.6, 0.5);
  c.lineWidth = 0.5;
  c.stroke();
}
function foret(cx: number, cy: number, rx: number, ry: number, off: number): [number, number, number][] {
  const tr: [number, number, number][] = [];
  for (let y = cy - ry * 1.3; y < cy + ry * 1.3; y += 6.2)
    for (let x = cx - rx * 1.3; x < cx + rx * 1.3; x += 7) {
      const jx = x + R(-2.5, 2.5),
        jy = y + R(-2, 2);
      const d = ((jx - cx) / rx) ** 2 + ((jy - cy) / ry) ** 2 + (fbm(jx * 0.03 + off, jy * 0.03, 3) - 0.5) * 0.9;
      if (d < 1) tr.push([jx, jy, R(3.4, 4.8)]);
    }
  return tr;
}
function marais(c: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
  c.strokeStyle = 'rgba(58,42,28,.8)';
  c.lineWidth = 0.6;
  for (let i = 0; i < 60; i++) {
    const an = R(0, 6.28),
      r = Math.sqrt(rnd()),
      x = cx + Math.cos(an) * rx * r,
      y = cy + Math.sin(an) * ry * r;
    c.beginPath();
    c.moveTo(x - 4, y);
    c.lineTo(x + 4, y);
    c.moveTo(x, y);
    c.lineTo(x, y - 3.5);
    c.moveTo(x - 1.6, y);
    c.lineTo(x - 2.6, y - 2.6);
    c.moveTo(x + 1.6, y);
    c.lineTo(x + 2.6, y - 2.6);
    c.stroke();
  }
}

function carte(c: CanvasRenderingContext2D, geo: Geographie) {
  a.reset(4242);
  // mer et côte
  const cote = jit(catmull(geo.cote, 8), 3, 0.05, 3);
  c.save();
  c.beginPath();
  c.moveTo(-20, -20);
  cote.forEach((p) => c.lineTo(p[0], p[1]));
  c.lineTo(-20, 1020);
  c.closePath();
  c.fillStyle = 'rgba(60,90,105,.10)';
  c.fill();
  c.clip();
  for (let k = 1; k < 10; k++) {
    c.save();
    c.translate(-k * 6.5, 0);
    poly(c, cote);
    c.strokeStyle = `rgba(47,61,71,${0.42 * (1 - k / 10)})`;
    c.lineWidth = 0.65;
    c.stroke();
    c.restore();
  }
  c.restore();
  poly(c, cote);
  c.strokeStyle = INK;
  c.lineWidth = 1.4;
  c.stroke();
  // lac du Soir
  const lac: P[] = [];
  for (let i = 0; i <= 40; i++) {
    const an = (i / 40) * 6.283,
      r = 1 + (fbm(Math.cos(an) * 2 + 5, Math.sin(an) * 2, 3) - 0.5) * 0.5;
    lac.push([460 + Math.cos(an) * 44 * r, 214 + Math.sin(an) * 26 * r]);
  }
  poly(c, lac);
  c.fillStyle = 'rgba(60,90,105,.16)';
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 1.1;
  c.stroke();
  [0.75, 0.5].forEach((k) => {
    c.save();
    c.translate(460, 214);
    c.scale(k, k);
    c.translate(-460, -214);
    poly(c, lac);
    c.strokeStyle = 'rgba(47,61,71,.35)';
    c.lineWidth = 0.6 / k;
    c.stroke();
    c.restore();
  });
  // rivières
  geo.rivieres.forEach((r, ri) => {
    const p = jit(catmull(r.points, 12), 2.2, 0.06, ri * 7);
    c.strokeStyle = WATER;
    c.lineCap = 'round';
    for (let i = 0; i < p.length - 1; i++) {
      c.lineWidth = lerp(r.largeur[0], r.largeur[1], i / p.length);
      c.beginPath();
      c.moveTo(p[i]![0], p[i]![1]);
      c.lineTo(p[i + 1]![0], p[i + 1]![1]);
      c.stroke();
    }
  });
  marais(c, 935, 448, 46, 20);
  // routes
  c.save();
  c.setLineDash([6, 4.5]);
  c.strokeStyle = 'rgba(125,45,25,.8)';
  c.lineWidth = 1.5;
  poly(c, jit(catmull(geo.routes.grandeRouteEst, 6), 1.2, 0.08, 11));
  c.stroke();
  c.lineWidth = 1.2;
  poly(c, jit(catmull(geo.routes.cheminVert, 6), 1.2, 0.08, 13));
  c.stroke();
  c.setLineDash([2, 4]);
  poly(c, catmull(geo.routes.cheminFondcombe, 6));
  c.stroke();
  c.restore();
  // reliefs + forêts, triés par y
  const items: ['p' | 'h' | 't', number, number, number][] = [];
  chaine([[150, 40], [160, 150], [140, 260], [150, 372]], 22, 8, 15, 6.5).forEach((p) => items.push(['p', ...p]));
  chaine([[150, 498], [140, 620], [160, 740], [150, 860], [160, 990]], 22, 8, 15, 6.5).forEach((p) => items.push(['p', ...p]));
  chaine([[1530, 10], [1520, 150], [1545, 280], [1515, 400], [1530, 520], [1550, 650], [1525, 780], [1540, 900], [1530, 1000]], 38, 11, 23, 6).forEach((p) => items.push(['p', ...p]));
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    items.push(['h', 1043 + t * 20 + R(-5, 5), 322 + t * 130 + R(-4, 4), R(7, 10)]);
  }
  items.push(['h', 1060, 457, 13]);
  collines(705, 560, 52, 28, 16, 6, 9).forEach((p) => items.push(['h', ...p]));
  collines(885, 578, 40, 18, 8, 5, 8).forEach((p) => items.push(['h', ...p]));
  collines(1335, 250, 80, 48, 22, 6, 10).forEach((p) => items.push(['h', ...p]));
  collines(730, 215, 50, 22, 10, 5, 8).forEach((p) => items.push(['h', ...p]));
  collines(262, 478, 18, 10, 4, 5, 7).forEach((p) => items.push(['h', ...p]));
  foret(640, 484, 62, 38, 1).forEach((p) => items.push(['t', ...p]));
  foret(860, 398, 42, 26, 2).forEach((p) => items.push(['t', ...p]));
  foret(1310, 428, 58, 30, 3).forEach((p) => items.push(['t', ...p]));
  foret(455, 514, 30, 14, 4).forEach((p) => items.push(['t', ...p]));
  foret(1430, 445, 16, 10, 5).forEach((p) => items.push(['t', ...p]));
  items.sort((u, v) => u[2] - v[2]).forEach(([k, x, y, s]) => (k === 'p' ? pic(c, x, y, s) : k === 'h' ? colline(c, x, y, s) : arbre(c, x, y, s)));
  // lieux
  const point = (x: number, y: number, r: number) => {
    c.beginPath();
    c.arc(x, y, r, 0, 6.283);
    c.fillStyle = INK;
    c.fill();
  };
  const anneau = (x: number, y: number, r: number) => {
    c.beginPath();
    c.arc(x, y, r, 0, 6.283);
    c.strokeStyle = INK;
    c.lineWidth = 1;
    c.stroke();
  };
  point(360, 450, 2.6);
  point(300, 488, 2.2);
  point(585, 478, 2.2);
  point(790, 450, 3.4);
  anneau(790, 450, 6.2);
  const ruine = (x: number, y: number) => {
    c.save();
    c.translate(x, y);
    c.rotate(0.785);
    c.strokeStyle = INK;
    c.lineWidth = 1;
    c.strokeRect(-3, -3, 6, 6);
    c.restore();
  };
  ruine(720, 242);
  ruine(880, 878);
  c.beginPath();
  c.moveTo(1060, 436);
  c.lineTo(1065, 446);
  c.lineTo(1055, 446);
  c.closePath();
  c.fillStyle = RED;
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(1236, 466);
  c.lineTo(1244, 466);
  c.moveTo(1236, 474);
  c.lineTo(1244, 474);
  c.moveTo(1380, 452);
  c.lineTo(1390, 452);
  c.moveTo(1380, 463);
  c.lineTo(1390, 463);
  c.stroke();
  c.save();
  c.translate(1445, 412);
  c.fillStyle = RED;
  c.beginPath();
  for (let i = 0; i < 12; i++) {
    const r = i % 2 ? 2.4 : 6.5,
      an = (i / 12) * 6.283 - 1.57;
    c.lineTo(Math.cos(an) * r, Math.sin(an) * r);
  }
  c.closePath();
  c.fill();
  c.restore();
  c.save();
  c.translate(205, 428);
  c.strokeStyle = INK;
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(-5, 3);
  c.quadraticCurveTo(0, 6, 5, 3);
  c.moveTo(0, 4);
  c.lineTo(0, -6);
  c.lineTo(5, 1);
  c.lineTo(0, 1);
  c.stroke();
  c.restore();
  // étiquettes
  const BIG = (s: number) => `${s}px ${CINZ}`;
  texte(c, 'ERIADOR', 930, 300, { f: '600 ' + BIG(46), sp: 30, a: 0.16, halo: false });
  texte(c, 'MINHIRIATH', 1010, 955, { f: BIG(22), sp: 16, a: 0.22, halo: false });
  texte(c, 'LE COMTÉ', 405, 408, { f: `19px ${CINZ}`, sp: 9, a: 0.85 });
  texte(c, 'MONTAGNES BLEUES', 192, 240, { f: `12px ${CINZ}`, sp: 6, r: -Math.PI / 2, a: 0.8 });
  texte(c, 'MONTS BRUMEUX', 1478, 700, { f: `15px ${CINZ}`, sp: 9, r: -Math.PI / 2, a: 0.85 });
  texte(c, 'COLLINES DU TEMPS', 1092, 392, { f: `10px ${CINZ}`, sp: 4, r: (Math.PI / 2) * 0.92, a: 0.8 });
  texte(c, 'LANDES D’ETTEN', 1335, 186, { f: `12px ${CINZ}`, sp: 6 });
  texte(c, 'Vieille Forêt', 642, 512, { f: 'italic 15px ' + FELL });
  texte(c, 'Hauts des Galgals', 708, 598, { f: 'italic 14px ' + FELL });
  texte(c, 'Bois de Chet', 866, 366, { f: 'italic 13px ' + FELL });
  texte(c, 'Marais aux Moucherons', 938, 482, { f: 'italic 13px ' + FELL });
  texte(c, 'Bois aux Trolls', 1312, 388, { f: 'italic 14px ' + FELL });
  texte(c, 'Hauts du Sud', 888, 604, { f: 'italic 12px ' + FELL });
  texte(c, 'Terres Solitaires', 1180, 520, { f: 'italic 13px ' + FELL });
  texte(c, 'Brandevin', 582, 650, { f: 'italic 13px ' + FELL, r: 1.25, c: WATER });
  texte(c, 'Fontgrise', 1262, 330, { f: 'italic 13px ' + FELL, r: 1.48, c: WATER });
  texte(c, 'Bruinen', 1350, 566, { f: 'italic 13px ' + FELL, r: 1.2, c: WATER });
  texte(c, 'Grisfleuve', 1060, 830, { f: 'italic 14px ' + FELL, r: -0.2, c: WATER });
  texte(c, 'Lac du Soir', 460, 176, { f: 'italic 13px ' + FELL, c: WATER });
  texte(c, 'Lhûn', 258, 292, { f: 'italic 12px ' + FELL, r: 1.75, c: WATER });
  texte(c, 'Golfe de Lune', 48, 440, { f: 'italic 13px ' + FELL, r: -Math.PI / 2, c: WATER, halo: false });
  texte(c, 'Grande Route de l’Est', 1150, 460, { f: 'italic 11px ' + FELL, c: '#7d2d19' });
  texte(c, 'Chemin Vert', 812, 640, { f: 'italic 11px ' + FELL, r: 1.48, c: '#7d2d19' });
  texte(c, 'Hobbitebourg', 360, 436, { f: '13px ' + FELL });
  texte(c, 'Grand’Cave', 300, 502, { f: '12px ' + FELL });
  texte(c, 'Creux-de-Crique', 575, 494, { f: '12px ' + FELL });
  texte(c, 'BREE', 790, 430, { f: `600 15px ${CINZ}`, sp: 4, c: RED });
  texte(c, 'Mont Venteux', 1060, 420, { f: '15px ' + FELL, c: RED });
  texte(c, 'Amon Sûl', 1060, 404, { f: 'italic 11px ' + FELL });
  texte(c, 'Dernier Pont', 1240, 490, { f: '12px ' + FELL });
  texte(c, 'Gué de Bruinen', 1384, 480, { f: '14px ' + FELL, c: RED });
  texte(c, 'FONDCOMBE', 1445, 392, { f: `600 14px ${CINZ}`, sp: 4, c: RED });
  texte(c, 'Fornost Erain', 720, 226, { f: '12px ' + FELL });
  texte(c, 'Chaussée des Morts', 720, 262, { f: 'italic 10px ' + FELL });
  texte(c, 'Tharbad', 880, 896, { f: '12px ' + FELL });
  texte(c, 'Havres Gris', 212, 414, { f: 'italic 12px ' + FELL });
  texte(c, 'Gué de Sarn', 640, 760, { f: 'italic 12px ' + FELL });
  // cartouche
  c.save();
  c.strokeStyle = INK;
  c.lineWidth = 1.2;
  c.strokeRect(215, 775, 300, 110);
  c.lineWidth = 0.6;
  c.strokeRect(221, 781, 288, 98);
  c.fillStyle = 'rgba(232,216,178,.55)';
  c.fillRect(221.5, 781.5, 287, 97);
  texte(c, 'ERIADOR', 365, 814, { f: `600 26px ${CINZ}`, sp: 12, halo: false });
  texte(c, 'Terres entre les Montagnes', 365, 842, { f: 'italic 13px ' + FELL, halo: false });
  texte(c, 'relevé par les espions de la Tour', 365, 860, { f: 'italic 11px ' + FELL, halo: false, c: RED });
  c.strokeStyle = 'rgba(58,42,28,.7)';
  c.lineWidth = 0.7;
  rangeeRunes(c, 236, 800, 8, 6, 21);
  rangeeRunes(c, 452, 800, 8, 6, 22);
  c.restore();
  // échelle
  c.save();
  c.strokeStyle = INK;
  c.fillStyle = INK;
  c.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    if (i % 2) c.strokeRect(265 + i * 50, 905, 50, 5);
    else c.fillRect(265 + i * 50, 905, 50, 5);
  }
  c.strokeRect(265, 905, 200, 5);
  texte(c, '0', 265, 920, { f: '10px ' + FELL, halo: false });
  texte(c, '100', 365, 920, { f: '10px ' + FELL, halo: false });
  texte(c, '200 lieues', 465, 920, { f: '10px ' + FELL, halo: false });
  c.restore();
  // rose des vents
  c.save();
  c.translate(1140, 760);
  c.strokeStyle = INK;
  c.lineWidth = 0.8;
  c.beginPath();
  c.arc(0, 0, 34, 0, 6.283);
  c.stroke();
  c.beginPath();
  c.arc(0, 0, 29, 0, 6.283);
  c.stroke();
  for (let i = 0; i < 8; i++) {
    const an = (i / 8) * 6.283 - 1.5708,
      L = i % 2 ? 20 : 40,
      w = i % 2 ? 4 : 6;
    c.beginPath();
    c.moveTo(Math.cos(an) * L, Math.sin(an) * L);
    c.lineTo(Math.cos(an + 1.5708) * w, Math.sin(an + 1.5708) * w);
    c.lineTo(0, 0);
    c.closePath();
    c.fillStyle = i === 0 ? RED : INK;
    c.fill();
    c.beginPath();
    c.moveTo(Math.cos(an) * L, Math.sin(an) * L);
    c.lineTo(Math.cos(an - 1.5708) * w, Math.sin(an - 1.5708) * w);
    c.lineTo(0, 0);
    c.closePath();
    c.stroke();
  }
  c.restore();
  texte(c, 'N', 1140, 708, { f: `600 12px ${CINZ}`, c: RED, halo: false });
  // cadre & bandeau runique
  c.strokeStyle = INK;
  c.lineWidth = 1.6;
  c.strokeRect(12, 12, W - 24, H - 24);
  c.lineWidth = 0.7;
  c.strokeRect(26, 26, W - 52, H - 52);
  c.lineWidth = 0.8;
  c.strokeStyle = 'rgba(58,42,28,.8)';
  for (let k = 0; k < 9; k++) {
    const x = 70 + k * 170;
    rangeeRunes(c, x, 23.5, 8, 9, 40 + k);
    rangeeRunes(c, x + 15, H - 14.5, 8, 9, 60 + k);
  }
}

/** Le parchemin complet, en W·S × H·S pixels. */
export function cuireParchemin(geo: Geographie): HTMLCanvasElement {
  const base = toile(W * S, H * S);
  const b = base.getContext('2d')!;
  a.reset(1337);
  parchemin(b);
  carte(b, geo);
  return base;
}

/* ------------------------------------------------------------------ */
/* Corruption : noircissement et craquelures, par région               */
/* ------------------------------------------------------------------ */

type Fissure = [number, number, number, number, number, number];

/** Un site de corruption : un champ de bruit autour du centre de la région, que l'emprise découpe. */
export class SiteCorruption {
  readonly N: number;
  readonly x0: number;
  readonly y0: number;
  readonly toile: HTMLCanvasElement;
  private readonly champ: Float32Array;
  private readonly matiere: Float32Array;
  private readonly fissures: Fissure[];

  constructor(
    readonly x: number,
    readonly y: number,
    readonly r: number,
  ) {
    const demi = r * 1.4;
    this.N = Math.ceil(demi * 2 * S);
    this.x0 = x - demi;
    this.y0 = y - demi;
    const N = this.N;
    this.champ = new Float32Array(N * N);
    this.matiere = new Float32Array(N * N);
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const wx = this.x0 + i / S,
          wy = this.y0 + j / S;
        const d = Math.hypot(wx - x, wy - y) / r;
        this.champ[j * N + i] = d + (fbm(wx / 34 + x, wy / 34, 4) - 0.5);
        this.matiere[j * N + i] = fbm(wx / 9, wy / 9 + y, 2);
      }
    this.toile = toile(N, N);
    this.fissures = this.genererFissures();
  }

  private genererFissures(): Fissure[] {
    a.reset(Math.floor(this.x * 7 + this.y * 13));
    const segs: Fissure[] = [];
    const maxD = this.r * 1.35;
    const pousser = (x: number, y: number, an: number, d: number, prof: number) => {
      while (d < maxD) {
        const st = R(3.5, 7.5);
        an += R(-0.5, 0.5);
        const nx = x + Math.cos(an) * st,
          ny = y + Math.sin(an) * st;
        d += st;
        segs.push([x, y, nx, ny, d / this.r, Math.max(0.45, 1.7 - prof * 0.55)]);
        x = nx;
        y = ny;
        if (prof < 2 && rnd() < 0.13) pousser(x, y, an + R(0.6, 1.1) * (rnd() < 0.5 ? -1 : 1), d, prof + 1);
        if (prof > 0 && rnd() < 0.07) break;
      }
    };
    for (let k = 0; k < 7; k++) pousser(this.x + R(-4, 4), this.y + R(-4, 4), (k / 7) * 6.283 + R(-0.3, 0.3), 0, 0);
    return segs;
  }

  /** Redessine le site pour une emprise de 0 à 1 (coordonnées locales au site, en pixels du parchemin). */
  dessiner(emprise: number) {
    const N = this.N,
      cx = this.toile.getContext('2d')!;
    cx.setTransform(1, 0, 0, 1, 0, 0);
    cx.clearRect(0, 0, N, N);
    if (emprise < 0.01) return;
    const im = cx.createImageData(N, N),
      D = im.data,
      e = emprise * 1.05;
    for (let k = 0; k < N * N; k++) {
      const v = this.champ[k]!,
        i = k * 4;
      if (v < e - 0.1) {
        const m = this.matiere[k]!;
        D[i] = 16 + m * 26;
        D[i + 1] = 12 + m * 16;
        D[i + 2] = 10 + m * 10;
        D[i + 3] = 238;
        if (v < e - 0.16 && hash2(k, N) > 0.9982) {
          D[i] = 255;
          D[i + 1] = 120;
          D[i + 2] = 40;
        }
      } else if (v < e) {
        const t = (v - (e - 0.1)) / 0.1;
        D[i] = lerp(16, 105, t);
        D[i + 1] = lerp(12, 58, t);
        D[i + 2] = lerp(10, 24, t);
        D[i + 3] = lerp(238, 170, t);
      } else if (v < e + 0.07) {
        const t = (v - e) / 0.07;
        D[i] = 120;
        D[i + 1] = 78;
        D[i + 2] = 38;
        D[i + 3] = 80 * (1 - t);
      }
    }
    cx.putImageData(im, 0, 0);
    cx.setTransform(S, 0, 0, S, -this.x0 * S, -this.y0 * S);
    const lim = emprise * 1.28;
    cx.lineCap = 'round';
    cx.strokeStyle = 'rgba(12,8,6,.85)';
    for (const g of this.fissures) {
      if (g[4] > lim) continue;
      cx.lineWidth = g[5] * (1 - (g[4] / lim) * 0.6);
      cx.beginPath();
      cx.moveTo(g[0], g[1]);
      cx.lineTo(g[2], g[3]);
      cx.stroke();
    }
    cx.strokeStyle = 'rgba(255,246,215,.28)';
    cx.lineWidth = 0.45;
    cx.beginPath();
    for (const g of this.fissures) {
      if (g[4] > lim || g[4] < emprise) continue;
      cx.moveTo(g[0] + 0.7, g[1] + 0.7);
      cx.lineTo(g[2] + 0.7, g[3] + 0.7);
    }
    cx.stroke();
    cx.save();
    cx.globalCompositeOperation = 'lighter';
    cx.shadowColor = '#ff3d00';
    cx.shadowBlur = 5 * S;
    cx.strokeStyle = 'rgba(255,110,40,.8)';
    cx.lineWidth = 0.6;
    cx.beginPath();
    for (const g of this.fissures) {
      if (g[4] > emprise * 0.85) continue;
      cx.moveTo(g[0], g[1]);
      cx.lineTo(g[2], g[3]);
    }
    cx.stroke();
    cx.restore();
  }
}

/* ------------------------------------------------------------------ */
/* Textures annexes                                                    */
/* ------------------------------------------------------------------ */

/** Vision spectrale : négatif froid du parchemin (Monde de l'Ombre). */
export function cuireSpectral(base: HTMLCanvasElement): HTMLCanvasElement {
  const sb = toile(W * 0.6, H * 0.6);
  const x = sb.getContext('2d', { willReadFrequently: true })!;
  x.drawImage(base, 0, 0, sb.width, sb.height);
  const im = x.getImageData(0, 0, sb.width, sb.height),
    D = im.data;
  for (let i = 0; i < D.length; i += 4) {
    const L = (0.3 * D[i]! + 0.59 * D[i + 1]! + 0.11 * D[i + 2]!) / 255;
    const ink = Math.pow(smooth(0.62, 0.28, L), 0.8);
    const n = hash2(i, 3) * 6;
    D[i] = 4 + ink * 136 + n * 0.3;
    D[i + 1] = 10 + ink * 186 + n * 0.5;
    D[i + 2] = 19 + ink * 210 + n;
  }
  x.putImageData(im, 0, 0);
  return sb;
}

/** Brume qui dérive au-dessus de la carte. */
export function cuireBrume(): HTMLCanvasElement {
  const f = toile(220, 140);
  const x = f.getContext('2d')!,
    im = x.createImageData(220, 140);
  for (let j = 0; j < 140; j++)
    for (let i = 0; i < 220; i++) {
      const n = fbm(i / 26, j / 26, 4),
        k = (j * 220 + i) * 4;
      im.data[k] = 14;
      im.data[k + 1] = 9;
      im.data[k + 2] = 7;
      im.data[k + 3] = smooth(0.35, 0.8, n) * 170;
    }
  x.putImageData(im, 0, 0);
  return f;
}

/** Dégradé radial blanc → transparent : sert de halo (teinté) et de masque. */
export function cuireHalo(taille = 128, plein = 0): HTMLCanvasElement {
  const c = toile(taille, taille);
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(taille / 2, taille / 2, 0, taille / 2, taille / 2, taille / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  if (plein) g.addColorStop(plein, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, taille, taille);
  return c;
}

/** Lisière de braise du Regard : anneau rougeoyant (0 au centre, crête à 0,9). */
export function cuireLisiere(taille = 256): HTMLCanvasElement {
  const c = toile(taille, taille);
  const x = c.getContext('2d')!;
  const h = taille / 2;
  const g = x.createRadialGradient(h, h, 0, h, h, h);
  g.addColorStop(0, 'rgba(255,90,30,0)');
  g.addColorStop(0.67, 'rgba(255,70,20,.05)');
  g.addColorStop(0.86, 'rgba(255,50,10,.32)');
  g.addColorStop(0.95, 'rgba(255,40,0,0)');
  g.addColorStop(1, 'rgba(255,40,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, taille, taille);
  return c;
}
