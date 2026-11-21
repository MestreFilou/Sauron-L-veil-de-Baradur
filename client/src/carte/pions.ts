/**
 * Les pions des Neuf sur la carte, comme dans un jeu de stratégie : on les
 * survole, on les choisit (clic, Maj+clic, touches 1 à 9), on les glisse vers
 * une région ou on clique la destination. Les marches ordonnées sont tracées
 * (plein jusqu'à l'étape du soir, pointillé au-delà), et après la nuit les
 * pions chevauchent le long de leur chemin au lieu de sauter d'une région à
 * l'autre.
 *
 * Visuels provisoires : un jeton capuchonné, en attendant les rendus 3D des
 * Nazgûl.
 */
import type { VueJoueur } from '@sauron/engine';
import type { Geographie } from '@sauron/world';
import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { ANCRE_CAVALIER, cuireCavalier, HAUTEUR_FIGURINE } from './encre';
import { CINZ, FELL } from './bruit';
import type { Trajet } from './marche';

type VueNazgul = VueJoueur['nazgul'][number];
type Point = { x: number; y: number };

export interface OutilsPions {
  trajet(nazgul: VueNazgul, destination: string): Trajet | null;
  chemin(de: string, vers: string): string[] | null;
  atteignables(nazgul: VueNazgul): Set<string>;
  libelle(t: Trajet, destination: string): string;
}

export interface EtatPions {
  vue: VueJoueur;
  /** Le premier choisi d'abord, puis le reste du groupe. */
  choisis: string[];
  caps: Record<string, string>;
}

const RAYON = 14;
const VITESSE_ANIM = 240; // unités monde par seconde
const OR = 0xd6b47c;
const BRONZE = 0xa17c48;
const BRAISE = 0xff7a38;

/** Textures des figurines des Neuf, cuites à la première demande. */
const cache: Partial<Record<'nazgul' | 'roi', Texture>> = {};
const TEX = {
  nazgul: () => (cache.nazgul ??= Texture.from(cuireCavalier(false))),
  roi: () => (cache.roi ??= Texture.from(cuireCavalier(true))),
};

/** Décalage du k-ième des `n` pions d'une même région : en rangs de quatre, comme une troupe. */
function emplacement(k: number, n: number): Point {
  const parRang = Math.min(4, n);
  const rang = Math.floor(k / 4);
  const dansRang = Math.min(parRang, n - rang * 4);
  const i = k % 4;
  const ecart = RAYON * 2.3;
  return { x: (i - (dansRang - 1) / 2) * ecart + (rang % 2) * ecart * 0.5, y: 16 + rang * ecart * 0.85 };
}

function pointilles(g: Graphics, pts: Point[], pas = 7, trou = 5) {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!,
      b = pts[i]!;
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    for (let d = 0; d < L; d += pas + trou) {
      const f = Math.min(L, d + pas);
      g.moveTo(a.x + ((b.x - a.x) * d) / L, a.y + ((b.y - a.y) * d) / L).lineTo(a.x + ((b.x - a.x) * f) / L, a.y + ((b.y - a.y) * f) / L);
    }
  }
}

function pointe(g: Graphics, de: Point, vers: Point, couleur: number, alpha: number) {
  const an = Math.atan2(vers.y - de.y, vers.x - de.x);
  const l = 9,
    o = 0.5;
  g.poly([vers.x, vers.y, vers.x - Math.cos(an - o) * l, vers.y - Math.sin(an - o) * l, vers.x - Math.cos(an + o) * l, vers.y - Math.sin(an + o) * l]).fill({ color: couleur, alpha });
}

/** Lisse un chemin de centres de régions (une courbe à la Chaikin, deux passes). */
function adoucir(pts: Point[]): Point[] {
  let p = pts;
  for (let k = 0; k < 2 && p.length > 2; k++) {
    const q: Point[] = [p[0]!];
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i]!,
        b = p[i + 1]!;
      if (i > 0) q.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      if (i < p.length - 2) q.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    q.push(p.at(-1)!);
    p = q;
  }
  return p;
}

export class Pions {
  /** Tout ce que dessinent les pions, à placer au-dessus du parchemin. */
  readonly calque = new Container();
  private traces = new Graphics();
  private apercu = new Graphics();
  private halos = new Graphics();
  private jetons = new Container();
  private textes = new Container();

  private etat: EtatPions | null = null;
  private affiche = new Map<string, Point>();
  private file = new Map<string, Point[]>();
  private regionPrec = new Map<string, string>();
  private cibles = new Map<string, Point>();
  private survolPion: string | null = null;
  private survolRegion: string | null = null;
  private tenu: { id: string; x: number; y: number; region: string | null } | null = null;
  private cleApercu = '';

  constructor(
    private readonly geo: Geographie,
    private readonly outils: OutilsPions,
  ) {
    this.calque.addChild(this.traces, this.apercu, this.halos, this.jetons, this.textes);
  }

  private centre(id: string): Point | null {
    const r = this.geo.regions[id];
    return r ? { x: r.centre[0], y: r.centre[1] } : null;
  }

  private bas(id: string): Point | null {
    const c = this.centre(id);
    return c ? { x: c.x, y: c.y + 16 } : null;
  }

  private nazgul(id: string) {
    return this.etat?.vue.nazgul.find((n) => n.id === id);
  }

  /** Les Nazgûl visibles sur la carte (les démontés rentrent au Mordor, hors carte). */
  private visibles(v: VueJoueur) {
    return v.nazgul.filter((n) => n.disponible && this.geo.regions[n.region]);
  }

  maj(e: EtatPions) {
    this.etat = e;
    const v = e.vue;
    this.cibles.clear();
    const total = new Map<string, number>();
    for (const n of this.visibles(v)) total.set(n.region, (total.get(n.region) ?? 0) + 1);
    const parRegion = new Map<string, number>();
    const vus = new Set<string>();
    for (const n of this.visibles(v)) {
      const c = this.centre(n.region)!;
      const k = parRegion.get(n.region) ?? 0;
      parRegion.set(n.region, k + 1);
      const o = emplacement(k, total.get(n.region)!);
      const cible = { x: c.x + o.x, y: c.y + o.y };
      this.cibles.set(n.id, cible);
      vus.add(n.id);
      const avant = this.regionPrec.get(n.id);
      const ici = this.affiche.get(n.id);
      if (!ici) this.affiche.set(n.id, { ...cible });
      else if (avant && avant !== n.region) {
        // Il a chevauché pendant la nuit : il suit la route, région par région.
        const ch = this.outils.chemin(avant, n.region) ?? [avant, n.region];
        const etapes = ch.slice(1, -1).map((r) => this.bas(r)!).filter(Boolean);
        this.file.set(n.id, [...etapes, cible]);
      } else if (Math.hypot(ici.x - cible.x, ici.y - cible.y) > 0.5 && !this.file.get(n.id)?.length) {
        this.file.set(n.id, [cible]);
      }
      this.regionPrec.set(n.id, n.region);
    }
    for (const id of [...this.affiche.keys()]) {
      if (vus.has(id)) continue;
      this.affiche.delete(id);
      this.file.delete(id);
      this.regionPrec.delete(id);
    }
    this.dessinerJetons();
    this.dessinerTraces();
    this.cleApercu = '';
    this.dessinerApercu();
  }

  /* ------------------------------------------------------------------ */
  /* Interactions (appelées par la scène)                                */
  /* ------------------------------------------------------------------ */

  /** Le pion sous ce point du monde, à `tolerance` près. */
  sous(x: number, y: number, tolerance: number): string | null {
    let best: string | null = null,
      d = tolerance;
    for (const [id, p] of this.affiche) {
      // on saisit la figurine par le corps, un peu au-dessus du socle
      const dd = Math.hypot(p.x - x, p.y - 9 - y) * 0.85;
      if (dd < d) {
        d = dd;
        best = id;
      }
    }
    return best;
  }

  survoler(pion: string | null, region: string | null) {
    if (pion === this.survolPion && region === this.survolRegion) return;
    const redessiner = pion !== this.survolPion;
    this.survolPion = pion;
    this.survolRegion = region;
    if (redessiner) this.dessinerJetons();
    this.dessinerApercu();
  }

  /** Pendant un glisser-déposer : le pion suit la souris. `null` pour le relâcher. */
  tenir(t: { id: string; x: number; y: number; region: string | null } | null) {
    this.tenu = t;
    this.dessinerApercu();
  }

  /** Position affichée d'un pion (pour centrer la caméra dessus). */
  position(id: string): Point | null {
    return this.affiche.get(id) ?? null;
  }

  /* ------------------------------------------------------------------ */
  /* Dessin                                                              */
  /* ------------------------------------------------------------------ */

  private dessinerJetons() {
    const e = this.etat;
    this.jetons.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.textes.removeChildren().forEach((c) => c.destroy());
    if (!e) return;
    const v = e.vue;
    v.nazgul.forEach((n, index) => {
      if (!this.affiche.has(n.id)) return;
      const sel = e.choisis.includes(n.id);
      const survol = n.id === this.survolPion;
      const enMarche = v.ordres.some((o) => o.type === 'nazgul_deplacer' && o.nazgul === n.id);
      const j = new Container();
      j.label = n.id;
      const g = new Graphics();
      // Une figurine peinte sur son socle : plus de jeton plat. Au sol, à l'encre :
      // un ovale rouge si on l'a choisi, des tirets s'il traque.
      if (sel || survol) g.ellipse(0, 1, RAYON * 1.25, RAYON * 0.5).stroke({ width: sel ? 1.5 : 1, color: sel ? 0x7d2414 : 0x3a2a1c, alpha: 0.9 });
      if (n.posture === 'traque') {
        for (let i = 0; i < 14; i++) {
          const a0 = (i / 14) * Math.PI * 2,
            a1 = a0 + 0.22;
          g.moveTo(Math.cos(a0) * RAYON * 1.45, 1 + Math.sin(a0) * RAYON * 0.62).lineTo(Math.cos(a1) * RAYON * 1.45, 1 + Math.sin(a1) * RAYON * 0.62);
        }
        g.stroke({ width: 0.9, color: 0x3a2a1c, alpha: 0.55 });
      }
      j.addChild(g);
      const fig = new Sprite(n.roiSorcier ? TEX.roi() : TEX.nazgul());
      fig.anchor.set(ANCRE_CAVALIER.x, ANCRE_CAVALIER.y);
      fig.scale.set(36 / HAUTEUR_FIGURINE);
      j.addChild(fig);
      // ordre de marche reçu : un petit fanion
      if (enMarche) {
        const f = new Graphics();
        f.moveTo(RAYON - 3, 2).lineTo(RAYON - 3, -26).stroke({ width: 1.1, color: 0x1a0c06 });
        f.poly([RAYON - 3, -26, RAYON + 6, -23, RAYON - 3, -20]).fill(0x8e1d10);
        j.addChild(f);
      }
      // touche de sélection rapide
      const touche = new Text({ text: String(index + 1), style: { fontFamily: CINZ, fontWeight: '600', fontSize: 8, fill: 0xf0dfc0 }, resolution: 3 });
      touche.anchor.set(0.5);
      touche.style.fill = 0x3a2a1c;
      const badge = new Graphics().rect(-4.2, -4.6, 8.4, 9.2).fill(0xe8d8b2).stroke({ width: 0.7, color: 0x5a4630 });
      badge.position.set(-RAYON - 1, -4);
      badge.rotation = -0.08;
      touche.position.set(-RAYON - 1, -3.7);
      j.addChild(badge, touche);
      j.alpha = this.tenu?.id === n.id ? 0.9 : 1;
      this.jetons.addChild(j);

      if (n.roiSorcier || sel || survol || n.nom.startsWith('Khamûl')) {
        const t = new Text({
          text: n.roiSorcier ? 'Le Roi-Sorcier' : n.nom,
          style: { fontFamily: FELL, fontStyle: 'italic', fontSize: 11, fill: sel ? 0x7d2414 : 0x2e2015, stroke: { color: 0xe8d8b2, width: 3, alpha: 0.8 } },
          resolution: 3,
        });
        t.anchor.set(0.5, 0);
        t.label = n.id;
        this.textes.addChild(t);
      }
    });
    this.placerJetons();
  }

  /** Les marches déjà ordonnées, et les régions atteignables ce soir par le Nazgûl choisi. */
  private dessinerTraces() {
    const g = this.traces;
    g.clear();
    const e = this.etat;
    if (!e) return;
    const v = e.vue;
    if (v.phase === 'ordres' && e.choisis.length === 1) {
      const n = this.nazgul(e.choisis[0]!);
      if (n && this.affiche.has(n.id)) {
        for (const r of this.outils.atteignables(n)) {
          const c = this.bas(r);
          if (!c) continue;
          g.ellipse(c.x, c.y, 15, 6).stroke({ width: 1, color: BRAISE, alpha: 0.45 });
          g.ellipse(c.x, c.y, 3, 1.4).fill({ color: BRAISE, alpha: 0.5 });
        }
      }
    }
    for (const n of this.visibles(v)) {
      const ordre = v.ordres.find((o) => o.type === 'nazgul_deplacer' && o.nazgul === n.id);
      const dest = ordre?.type === 'nazgul_deplacer' ? ordre.destination : v.phase === 'oeil' ? e.caps[n.id] : undefined;
      if (!dest || dest === n.region) continue;
      const t = this.outils.trajet(n, dest);
      if (!t) continue;
      const pts = t.chemin.map((r) => this.bas(r)!);
      pts[0] = this.cibles.get(n.id) ?? pts[0]!;
      const ceSoir = adoucir(pts.slice(0, t.ceSoir + 1));
      const reste = adoucir(pts.slice(t.ceSoir));
      const alpha = e.choisis.includes(n.id) ? 0.95 : 0.7;
      if (ceSoir.length > 1) {
        g.moveTo(ceSoir[0]!.x, ceSoir[0]!.y);
        for (const p of ceSoir.slice(1)) g.lineTo(p.x, p.y);
        g.stroke({ width: 3.2, color: 0x1a0c06, alpha: alpha * 0.5 });
        g.moveTo(ceSoir[0]!.x, ceSoir[0]!.y);
        for (const p of ceSoir.slice(1)) g.lineTo(p.x, p.y);
        g.stroke({ width: 1.8, color: 0x8e1d10, alpha });
        pointe(g, ceSoir.at(-2)!, ceSoir.at(-1)!, 0x8e1d10, alpha);
      }
      if (reste.length > 1) {
        pointilles(g, reste, 5, 5);
        g.stroke({ width: 1.4, color: 0x8e1d10, alpha: alpha * 0.6 });
        const fin = reste.at(-1)!;
        g.moveTo(fin.x, fin.y).lineTo(fin.x, fin.y - 16).stroke({ width: 1.2, color: 0x1a0c06, alpha });
        g.poly([fin.x, fin.y - 16, fin.x + 9, fin.y - 13, fin.x, fin.y - 10]).fill({ color: 0x8e1d10, alpha });
      }
    }
  }

  /** L'aperçu de marche : du (des) Nazgûl choisi(s) vers la région survolée ou le point de dépôt. */
  private dessinerApercu() {
    const e = this.etat;
    const g = this.apercu;
    const ids = this.tenu ? [this.tenu.id] : (e?.choisis ?? []);
    const dest = this.tenu ? this.tenu.region : this.survolPion ? null : this.survolRegion;
    const cle = `${ids.join(',')}>${dest}|${this.tenu ? 't' : ''}`;
    if (cle === this.cleApercu) return;
    this.cleApercu = cle;
    g.clear();
    this.calque.children.filter((c) => c.label === 'apercu').forEach((c) => c.destroy());
    if (!e || e.vue.phase !== 'ordres' || !dest || !ids.length) return;
    let libelle = '';
    for (const id of ids) {
      const n = this.nazgul(id);
      if (!n || !this.affiche.has(id) || n.region === dest) continue;
      const t = this.outils.trajet(n, dest);
      if (!t) continue;
      const pts = t.chemin.map((r) => this.bas(r)!);
      pts[0] = this.cibles.get(id) ?? pts[0]!;
      const tout = adoucir(pts);
      pointilles(g, tout, 6, 4);
      g.stroke({ width: 2, color: 0xffd9a0, alpha: 0.85 });
      const soir = this.bas(t.chemin[t.ceSoir]!)!;
      g.circle(soir.x, soir.y, 7).stroke({ width: 1.6, color: BRAISE, alpha: 0.95 });
      g.circle(soir.x, soir.y, 2).fill({ color: BRAISE, alpha: 0.95 });
      if (!libelle) libelle = this.outils.libelle(t, dest);
    }
    const c = this.bas(dest);
    if (!c || !libelle) return;
    g.ellipse(c.x, c.y, 20, 8).stroke({ width: 1.6, color: 0xffd9a0, alpha: 0.9 });
    const t = new Text({
      text: libelle,
      style: { fontFamily: FELL, fontStyle: 'italic', fontSize: 11, fill: 0xffe6bf, stroke: { color: 0x0a0605, width: 3.5, alpha: 0.85 } },
      resolution: 3,
    });
    t.label = 'apercu';
    t.anchor.set(0.5, 0);
    t.position.set(c.x, c.y + 11);
    this.calque.addChild(t);
  }

  private placerJetons() {
    for (const j of this.jetons.children) {
      const p = this.tenu?.id === j.label ? this.tenu : this.affiche.get(j.label);
      if (p) j.position.set(p.x, p.y);
    }
    for (const t of this.textes.children) {
      const p = this.tenu?.id === t.label ? this.tenu : this.affiche.get(t.label);
      if (p) t.position.set(p.x, p.y + 6);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Animation                                                           */
  /* ------------------------------------------------------------------ */

  image(t: number, dt: number) {
    let bouge = false;
    for (const [id, file] of this.file) {
      if (!file.length) continue;
      const p = this.affiche.get(id);
      if (!p) continue;
      let reste = (VITESSE_ANIM * dt) / 1000;
      while (reste > 0 && file.length) {
        const c = file[0]!;
        const d = Math.hypot(c.x - p.x, c.y - p.y);
        if (d <= reste) {
          p.x = c.x;
          p.y = c.y;
          file.shift();
          reste -= d;
        } else {
          p.x += ((c.x - p.x) * reste) / d;
          p.y += ((c.y - p.y) * reste) / d;
          reste = 0;
        }
      }
      bouge = true;
    }
    if (bouge || this.tenu) this.placerJetons();

    // anneau pulsant sous les pions choisis
    const h = this.halos;
    h.clear();
    const e = this.etat;
    if (!e) return;
    // le choisi : un second trait d'encre qui respire doucement autour du socle
    const pouls = 0.5 + 0.5 * Math.sin(t * 0.004);
    for (const id of e.choisis) {
      const p = this.tenu?.id === id ? this.tenu : this.affiche.get(id);
      if (!p) continue;
      h.ellipse(p.x, p.y + 1, RAYON * (1.45 + pouls * 0.08), RAYON * (0.6 + pouls * 0.03)).stroke({ width: 0.9, color: 0x7d2414, alpha: 0.5 + 0.3 * pouls });
    }
  }
}
