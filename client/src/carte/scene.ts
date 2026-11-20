/**
 * La carte en PixiJS : le parchemin flou et éteint hors du Regard, net sous le
 * Regard, le cône qui tombe de l'Œil, les Neuf, les sceaux des murmures, et le
 * Monde de l'Ombre vu à travers les Neuf (avec la piste de l'Anneau).
 *
 * La scène ne lit que la vue du joueur : elle ne connaît pas la vraie position
 * du porteur, seulement l'estimation de la piste.
 */
import type { VueJoueur } from '@sauron/engine';
import type { Geographie } from '@sauron/world';
import { regionSous } from '@sauron/world';
import {
  Application,
  BlurFilter,
  ColorMatrixFilter,
  Container,
  Graphics,
  RenderTexture,
  Sprite,
  Text,
  Texture,
} from 'pixi.js';
import { OEIL_Y, regard } from '../bus';
import { CINZ, FELL, lerp, toile } from './bruit';
import { cuireBrume, cuireHalo, cuireLisiere, cuireParchemin, cuireSpectral, H, S, SiteCorruption, W } from './parchemin';

/** Demi-axes de l'ellipse du Regard, en unités monde. */
export const ER = 118;
export const ERY = 84;

export interface EtatScene {
  vue: VueJoueur;
  mode: 'oeil' | 'ombre';
  nazgulChoisi: string | null;
  regionChoisie: string | null;
  murmureSurvole: string | null;
}

export interface Rappels {
  /** Clic sur la carte (hors glisser) : région la plus proche, si elle est assez près. */
  clic(region: string | null): void;
}

/** Ancre de la fiche de région, en pixels d'écran (lue par le panneau React). */
export const ancre = { x: 0, y: 0, visible: false, rayon: 0 };

const EMPRISE: Record<string, number> = { libre: 0, inquiete: 0.22, sous_ombre: 0.5, ecrasee: 0.75, corrompue: 1 };

/** Le cône, cuit une fois : trapèze dégradé, étiré et tourné à chaque image. */
function cuireCone(): HTMLCanvasElement {
  const L = 512,
    l = 256;
  const c = toile(L, l);
  const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, L, 0);
  g.addColorStop(0, 'rgba(255,90,30,.32)');
  g.addColorStop(0.25, 'rgba(255,60,15,.08)');
  g.addColorStop(1, 'rgba(255,50,10,.16)');
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(0, l / 2 - 5);
  x.lineTo(L, 0);
  x.lineTo(L, l);
  x.lineTo(0, l / 2 + 5);
  x.closePath();
  x.fill();
  return c;
}

function teinte(hex: number, s: Sprite) {
  s.tint = hex;
  return s;
}

export class SceneCarte {
  readonly app = new Application();
  private readonly geo: Geographie;
  private rappels: Rappels;

  // caméra
  private zoom = 1.18;
  private cam = { x: 700, y: 480 };
  private sc = 1;
  private ox = 0;
  private oy = 0;

  // calques
  private monde = new Container();
  private physique = new Container();
  private ombre = new Container();
  private flou = new Container();
  private net = new Container();
  private masqueRegard!: Sprite;
  private lisiere!: Sprite;
  private gardeLumiere!: Sprite;
  private cone!: Sprite;
  private rayons = new Graphics();
  private pointilles = new Graphics();
  private ressenti = new Graphics();
  private sceaux = new Container();
  private jetons = new Container();
  private figures = new Container();
  private revelations = new Container();
  private brumes: Sprite[] = [];
  private spectres = new Container();
  private lueurs = new Container();
  private etiquettesOmbre = new Container();
  private visionRT!: RenderTexture;
  private vision = new Container();
  private texHalo!: Texture;

  // corruption
  private sites = new Map<string, { site: SiteCorruption; tex: Texture; cv: number; cible: number; de: number; t0: number }>();

  // état animé
  private souris = { x: 900, y: 470 };
  private focus = { x: 900, y: 470 };
  private verrou: { x: number; y: number; garde: boolean } | null = null;
  private spT = 0;
  private felt = 0;
  private etat: EtatScene | null = null;
  private pretes = false;

  constructor(geo: Geographie, rappels: Rappels) {
    this.geo = geo;
    this.rappels = rappels;
  }

  async monter(hote: HTMLElement) {
    await this.app.init({
      resizeTo: window,
      background: 0x070505,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      preference: 'webgl',
    });
    const cv = this.app.canvas;
    cv.id = 'map';
    hote.appendChild(cv);

    // les polices doivent être là avant de cuire les étiquettes
    await Promise.race([
      Promise.all(['italic 13px "IM Fell English"', '13px "IM Fell English"', '600 14px Cinzel', '14px Cinzel'].map((f) => document.fonts.load(f))),
      new Promise((r) => setTimeout(r, 2500)),
    ]);

    const base = cuireParchemin(this.geo);
    const texBase = Texture.from(base);
    this.texHalo = Texture.from(cuireHalo(128));

    this.app.stage.addChild(this.monde);
    this.monde.addChild(this.physique, this.ombre);

    /* --- hors du Regard : flou, désaturé, assombri --- */
    const sitesFlou = new Container();
    const sitesNet = new Container();
    const fondFlou = new Sprite(texBase);
    fondFlou.scale.set(1 / S);
    this.flou.addChild(fondFlou, sitesFlou);
    const cm = new ColorMatrixFilter();
    // lerp vers la luminance (45 %), puis assombri et réchauffé, comme buildDim
    cm.matrix = [
      0.4521, 0.17523, 0.03267, 0, 0.0314,
      0.081, 0.4893, 0.0297, 0, 0.0157,
      0.0729, 0.14337, 0.32373, 0, 0.0078,
      0, 0, 0, 1, 0,
    ];
    const blur = new BlurFilter({ strength: 2.5, quality: 2 });
    this.flou.filters = [cm, blur];
    this.physique.addChild(this.flou);

    const brume = Texture.from(cuireBrume());
    for (const a of [0.4, 0.22]) {
      const b = new Sprite(brume);
      b.alpha = a;
      b.width = W * 1.2;
      b.height = H * 1.2;
      this.brumes.push(b);
      this.physique.addChild(b);
    }

    /* --- sous le Regard : net --- */
    const fondNet = new Sprite(texBase);
    fondNet.scale.set(1 / S);
    this.net.addChild(fondNet, sitesNet);
    this.masqueRegard = new Sprite(Texture.from(cuireHalo(256, 0.68)));
    this.masqueRegard.anchor.set(0.5);
    this.net.mask = this.masqueRegard;
    this.physique.addChild(this.net, this.masqueRegard);

    this.lisiere = new Sprite(Texture.from(cuireLisiere()));
    this.lisiere.anchor.set(0.5);
    this.lisiere.blendMode = 'screen';
    this.gardeLumiere = teinte(0xe6f0ff, new Sprite(this.texHalo));
    this.gardeLumiere.anchor.set(0.5);
    this.gardeLumiere.blendMode = 'screen';
    this.cone = new Sprite(Texture.from(cuireCone()));
    this.cone.anchor.set(0, 0.5);
    this.cone.blendMode = 'screen';
    this.rayons.blendMode = 'add';
    this.physique.addChild(this.lisiere, this.gardeLumiere, this.pointilles, this.cone, this.rayons, this.revelations, this.figures, this.sceaux, this.jetons, this.ressenti);

    // sites de corruption, un par région jouable
    for (const [id, r] of Object.entries(this.geo.regions)) {
      const site = new SiteCorruption(r.centre[0], r.centre[1], r.rayon);
      const tex = Texture.from(site.toile);
      for (const parent of [sitesFlou, sitesNet]) {
        const s = new Sprite(tex);
        s.position.set(site.x0, site.y0);
        s.scale.set(1 / S);
        parent.addChild(s);
      }
      this.sites.set(id, { site, tex, cv: 0, cible: 0, de: 0, t0: 0 });
    }

    /* --- Monde de l'Ombre --- */
    const spectral = Texture.from(cuireSpectral(base));
    const fondOmbre = new Graphics().rect(0, 0, W, H).fill(0x02050a);
    const spectreTerne = new Sprite(spectral);
    spectreTerne.width = W;
    spectreTerne.height = H;
    spectreTerne.alpha = 0.14;
    const spectreVu = new Sprite(spectral);
    spectreVu.width = W;
    spectreVu.height = H;
    this.visionRT = RenderTexture.create({ width: W * 0.6, height: H * 0.6 });
    const masqueVision = new Sprite(this.visionRT);
    masqueVision.scale.set(1 / 0.6);
    spectreVu.mask = masqueVision;
    this.lueurs.blendMode = 'add';
    this.ombre.addChild(fondOmbre, spectreTerne, spectreVu, masqueVision, this.lueurs, this.spectres, this.etiquettesOmbre);
    this.ombre.alpha = 0;
    this.ombre.visible = false;

    this.brancher(cv);
    this.placer();
    window.addEventListener('resize', this.placer);
    this.pretes = true;
    if (this.etat) this.maj(this.etat);
    this.app.ticker.add(() => this.image(performance.now(), this.app.ticker.deltaMS));
  }

  detruire() {
    window.removeEventListener('resize', this.placer);
    this.app.destroy(true, { children: true, texture: true });
  }

  /* ------------------------------------------------------------------ */
  /* Caméra et interactions                                              */
  /* ------------------------------------------------------------------ */

  /** Centre utile de l'écran (entre les panneaux de gauche et de droite). */
  private vcx() {
    const vw = window.innerWidth;
    return vw > 1000 ? (300 + (vw - 370)) / 2 : vw / 2;
  }

  private placer = () => {
    const vw = window.innerWidth,
      vh = window.innerHeight;
    this.sc = Math.max(vw / W, vh / H) * this.zoom;
    this.ox = this.vcx() - this.cam.x * this.sc;
    this.oy = vh / 2 - this.cam.y * this.sc;
    this.ox = Math.min(0, Math.max(vw - W * this.sc, this.ox));
    this.oy = Math.min(0, Math.max(vh - H * this.sc, this.oy));
    this.cam.x = (this.vcx() - this.ox) / this.sc;
    this.cam.y = (vh / 2 - this.oy) / this.sc;
    this.monde.scale.set(this.sc);
    this.monde.position.set(this.ox, this.oy);
  };

  private versMonde = (sx: number, sy: number) => ({ x: (sx - this.ox) / this.sc, y: (sy - this.oy) / this.sc });
  versEcran = (x: number, y: number) => ({ x: this.ox + x * this.sc, y: this.oy + y * this.sc });

  private borner = (p: { x: number; y: number }) => ({
    x: Math.max(ER * 1.3, Math.min(W - ER * 1.3, p.x)),
    y: Math.max(ERY * 1.3, Math.min(H - ERY * 1.3, p.y)),
  });

  private brancher(cv: HTMLCanvasElement) {
    let glisse: { x: number; y: number; cx: number; cy: number } | null = null;
    let deplace = false;
    cv.addEventListener('mousedown', (e) => {
      glisse = { x: e.clientX, y: e.clientY, cx: this.cam.x, cy: this.cam.y };
      deplace = false;
    });
    window.addEventListener('mouseup', () => {
      glisse = null;
      cv.style.cursor = 'crosshair';
    });
    cv.addEventListener('mousemove', (e) => {
      if (glisse) {
        const dx = e.clientX - glisse.x,
          dy = e.clientY - glisse.y;
        if (Math.hypot(dx, dy) > 5) {
          deplace = true;
          cv.style.cursor = 'grabbing';
        }
        if (deplace) {
          this.cam.x = glisse.cx - dx / this.sc;
          this.cam.y = glisse.cy - dy / this.sc;
          this.placer();
        }
      }
      this.souris = this.borner(this.versMonde(e.clientX, e.clientY));
    });
    cv.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const avant = this.versMonde(e.clientX, e.clientY);
        this.zoom = Math.min(2.2, Math.max(1, this.zoom * Math.exp(-e.deltaY * 0.0012)));
        this.placer();
        const apres = this.versMonde(e.clientX, e.clientY);
        this.cam.x += avant.x - apres.x;
        this.cam.y += avant.y - apres.y;
        this.placer();
      },
      { passive: false },
    );
    cv.addEventListener('click', (e) => {
      if (deplace) return;
      const w = this.versMonde(e.clientX, e.clientY);
      const r = regionSous(this.geo, w.x, w.y);
      this.rappels.clic(r.distance < 2.5 ? r.id : null);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Mise à jour depuis la vue du joueur                                 */
  /* ------------------------------------------------------------------ */

  private centre(id: string): { x: number; y: number } | null {
    const r = this.geo.regions[id];
    return r ? { x: r.centre[0], y: r.centre[1] } : null;
  }

  maj(e: EtatScene) {
    this.etat = e;
    if (!this.pretes) return;
    const v = e.vue;
    const t0 = performance.now();

    // emprise de l'Ombre par région (ce que Sauron en sait)
    for (const r of v.regions) {
      const s = this.sites.get(r.id);
      if (!s) continue;
      let cible = r.corrompue ? 1 : r.statut ? (EMPRISE[r.statut] ?? 0) : 0;
      if (r.corruptionEnCours) cible = Math.max(cible, 0.38);
      if (Math.abs(cible - s.cible) > 0.001) {
        s.de = s.cv;
        s.cible = cible;
        s.t0 = t0;
      }
    }

    // verrou du Regard : la cible de l'Œil, ou la région choisie pendant les ordres
    const oeil = v.oeil;
    let idVerrou: string | null = e.regionChoisie;
    if (!idVerrou && oeil) {
      if (oeil.cible.type === 'region') idVerrou = oeil.cible.id;
      else idVerrou = v.personnages.find((p) => p.id === oeil.cible.id)?.position?.region ?? null;
    }
    const c = idVerrou ? this.centre(idVerrou) : null;
    this.verrou = c ? { ...this.borner(c), garde: Boolean(oeil?.repousse && !e.regionChoisie) } : null;
    if (c && oeil && !e.regionChoisie) this.felt = 1;

    this.dessinerJetons(v, e.nazgulChoisi);
    this.dessinerSceaux(v, e.murmureSurvole);
    this.dessinerFigures(v);
    this.dessinerOmbre(v, e.nazgulChoisi);
  }

  private dessinerJetons(v: VueJoueur, choisi: string | null) {
    this.jetons.removeChildren().forEach((c) => c.destroy({ children: true }));
    const parRegion = new Map<string, number>();
    for (const n of v.nazgul) {
      if (!n.disponible) continue;
      const c = this.centre(n.region);
      if (!c) continue;
      const k = parRegion.get(n.region) ?? 0;
      parRegion.set(n.region, k + 1);
      const an = k * 2.39996 - 0.6,
        rr = k ? 14 + 5 * Math.sqrt(k) : 0;
      const j = new Container();
      j.position.set(c.x + Math.cos(an) * rr, c.y + 14 + Math.sin(an) * rr * 0.7);
      j.label = n.id;
      const g = new Graphics();
      const sel = n.id === choisi;
      if (sel) g.circle(0, 0, 15).stroke({ width: 1.2, color: 0xffdcaa, alpha: 0.9 });
      g.circle(0, 0, 9).fill(0x1a1816).stroke({ width: 1.2, color: 0xa17c48 });
      g.circle(-2.5, -2.5, 5).fill({ color: 0x4a443e, alpha: 0.6 });
      if (n.posture === 'traque') {
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          g.circle(Math.cos(a) * 12, Math.sin(a) * 12, 0.7).fill({ color: 0xc9a46a, alpha: 0.6 });
        }
      }
      if (n.roiSorcier) {
        g.poly([-5, -1, -3.4, -5, -1.6, -2, 0, -6, 1.6, -2, 3.4, -5, 5, -1, 4, 4.5, -4, 4.5]).fill(0xd6b47c);
      } else {
        g.moveTo(0, -6).bezierCurveTo(-4, -6, -4.5, -1, -5, 5.5).lineTo(5, 5.5).bezierCurveTo(4.5, -1, 4, -6, 0, -6).closePath().fill(0xd6b47c);
        g.ellipse(0, -1.5, 1.9, 2.4).fill(0x0a0908);
      }
      j.addChild(g);
      if (n.roiSorcier || sel || n.nom.startsWith('Khamûl')) {
        const t = new Text({
          text: n.roiSorcier ? 'Le Roi-Sorcier' : n.nom,
          style: { fontFamily: FELL, fontStyle: 'italic', fontSize: 11, fill: 0xf0dfc0 },
          resolution: 3,
        });
        t.anchor.set(0.5, 0);
        t.position.set(0, 11);
        t.alpha = 0.95;
        j.addChild(t);
      }
      this.jetons.addChild(j);
    }
  }

  private dessinerSceaux(v: VueJoueur, survole: string | null) {
    this.sceaux.removeChildren().forEach((c) => c.destroy({ children: true }));
    const recents = v.murmures.filter((m) => m.tour === v.tour);
    const parRegion = new Map<string, number>();
    for (const m of recents) {
      const c = this.centre(m.region);
      if (!c) continue;
      const k = parRegion.get(m.region) ?? 0;
      parRegion.set(m.region, k + 1);
      const s = new Container();
      s.label = m.id;
      s.position.set(c.x + 10 + k * 15, c.y - 18);
      const g = new Graphics();
      const pts: number[] = [];
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * 6.283,
          rr = 6.5 + (i % 2 ? 0.8 : -0.3);
        pts.push(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      const couleur = m.verite === 'faux' || m.contredit ? 0x4b4440 : m.verite ? 0x6b5a1c : 0x8e1d10;
      g.poly(pts).fill(couleur).stroke({ width: 0.8, color: 0x000000, alpha: 0.4 });
      if (m.id === survole) g.circle(0, 0, 13).stroke({ width: 1.3, color: 0xf2c14e, alpha: 0.9 });
      const t = new Text({ text: m.verite ? (m.verite === 'faux' ? '✕' : '✓') : '?', style: { fontFamily: CINZ, fontWeight: '600', fontSize: 9, fill: 0xffdcbe }, resolution: 3 });
      t.anchor.set(0.5);
      t.position.set(0, 0.5);
      s.addChild(g, t);
      this.sceaux.addChild(s);
    }
  }

  /** Les personnages dont Sauron connaît la position récente (vue par l'Œil, un Nazgûl ou un murmure vérifié). */
  private dessinerFigures(v: VueJoueur) {
    this.figures.removeChildren().forEach((c) => c.destroy({ children: true }));
    const parRegion = new Map<string, string[]>();
    for (const p of v.personnages) {
      if (!p.position || p.position.tour < v.tour - 1) continue;
      const l = parRegion.get(p.position.region) ?? [];
      l.push(p.nom.replace(/^(Le|La|Les) /, '').split(' ')[0]!);
      parRegion.set(p.position.region, l);
    }
    for (const [id, noms] of parRegion) {
      const c = this.centre(id);
      if (!c) continue;
      const f = new Container();
      f.position.set(c.x - 24, c.y - 4);
      const g = new Graphics();
      noms.slice(0, 6).forEach((_, k) => {
        const x = k * 5.5,
          y = (k % 2) * 2;
        g.circle(x, y - 6, 1.5).fill(0x1a0c06);
        g.rect(x - 1.2, y - 4.8, 2.4, 4.8).fill(0x1a0c06);
      });
      const t = new Text({ text: noms.join(', '), style: { fontFamily: FELL, fontStyle: 'italic', fontSize: 11, fill: 0x7d2414, stroke: { color: 0xe8d8b2, width: 3, alpha: 0.8 } }, resolution: 3 });
      t.anchor.set(0, 0.5);
      t.position.set(noms.length * 5.5 + 3, -3);
      f.addChild(g, t);
      this.figures.addChild(f);
    }
  }

  private halo(x: number, y: number, r: number, couleur: number, alpha: number) {
    const s = new Sprite(this.texHalo);
    s.anchor.set(0.5);
    s.position.set(x, y);
    s.width = s.height = r * 2;
    s.tint = couleur;
    s.alpha = alpha;
    return s;
  }

  private dessinerOmbre(v: VueJoueur, choisi: string | null) {
    // vision des Neuf : un halo par Nazgûl disponible, plus large si le signal est fort
    this.vision.removeChildren().forEach((c) => c.destroy());
    for (const n of v.nazgul) {
      const c = n.disponible ? this.centre(n.region) : null;
      if (!c) continue;
      const vr = n.signal < 2 ? 80 : 150;
      const s = this.halo(c.x * 0.6, c.y * 0.6, vr * 0.6, 0xffffff, 1);
      this.vision.addChild(s);
    }
    this.app.renderer.render({ container: this.vision, target: this.visionRT, clear: true });

    this.lueurs.removeChildren().forEach((c) => c.destroy());
    this.etiquettesOmbre.removeChildren().forEach((c) => c.destroy());
    const lbl = (s: string, x: number, y: number, fill: number, italique = false) => {
      const t = new Text({
        text: s,
        style: italique ? { fontFamily: FELL, fontStyle: 'italic', fontSize: 11, fill } : { fontFamily: CINZ, fontWeight: '600', fontSize: 10, letterSpacing: 3, fill },
        resolution: 3,
      });
      t.anchor.set(0.5);
      t.position.set(x, y);
      this.etiquettesOmbre.addChild(t);
    };
    for (const r of v.regions) {
      const c = this.centre(r.id);
      const g = this.geo.regions[r.id];
      if (!c || !g) continue;
      const e = r.corrompue ? 1 : r.statut ? (EMPRISE[r.statut] ?? 0) : 0;
      if (e > 0.05) this.lueurs.addChild(this.halo(c.x, c.y, g.rayon * 1.1, 0x783cc8, 0.38 * e));
    }
    // lumières qui aveuglent : Imladris, les Galgals
    const fc = this.centre('fondcombe');
    if (fc) {
      this.lueurs.addChild(this.halo(fc.x, fc.y, 150, 0xc8e4ff, 0.55), this.halo(fc.x, fc.y, 40, 0xffffff, 0.9));
      lbl('LUMIÈRE DES ELDAR', fc.x, fc.y - 52, 0xe6f3ff);
      lbl('aveuglante · ne pas approcher', fc.x, fc.y - 38, 0x9ec9e6, true);
    }
    const gg = this.centre('galgals');
    if (gg) {
      this.lueurs.addChild(this.halo(gg.x, gg.y, 70, 0x78d2a0, 0.18));
      lbl('ÊTRES DES GALGALS', gg.x, gg.y + 40, 0x9fd8bf);
    }
    // piste de l'Anneau : la carte de chaleur, rien que ce que Sauron en sait
    const p = v.piste;
    const etale = p.precision === 'diffuse' ? 1.6 : p.precision === 'region_a_1_pres' ? 1.2 : 0.8;
    for (const [id, prob] of Object.entries(p.probabilites)) {
      const c = this.centre(id);
      const g = this.geo.regions[id];
      if (!c || !g || prob < 0.03) continue;
      this.lueurs.addChild(this.halo(c.x, c.y, g.rayon * etale, 0xf2c14e, Math.min(0.75, prob * 1.6)));
    }
    const rp = this.centre(p.regionProbable);
    if (rp) {
      lbl('L’ANNEAU', rp.x, rp.y + 34, 0xf6d27a);
      lbl(`${p.precision === 'exacte' ? 'trace fraîche' : 'piste incertaine'} · certitude ${Math.round(p.certitude * 100)} %`, rp.x, rp.y + 47, 0xc9a45a, true);
    }
    const sel = v.nazgul.find((n) => n.id === choisi);
    const cs = sel ? this.centre(sel.region) : null;
    if (sel && cs) lbl(sel.nom.toUpperCase(), cs.x, cs.y + 40, 0xd8ecf8);

    // les spectres
    this.spectres.removeChildren().forEach((c) => c.destroy());
    const parRegion = new Map<string, number>();
    for (const n of v.nazgul) {
      const c = n.disponible ? this.centre(n.region) : null;
      if (!c) continue;
      const k = parRegion.get(n.region) ?? 0;
      parRegion.set(n.region, k + 1);
      const an = k * 2.39996 - 0.6,
        rr = k ? 16 + 6 * Math.sqrt(k) : 0;
      const g = new Graphics();
      g.position.set(c.x + Math.cos(an) * rr, c.y + 14 + Math.sin(an) * rr * 0.7);
      g.label = n.roiSorcier ? 'roi' : 'spectre';
      this.spectres.addChild(g);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Boucle d'animation                                                  */
  /* ------------------------------------------------------------------ */

  private image(t: number, dtBrut: number) {
    const dt = Math.min(50, dtBrut);
    const e = this.etat;
    const spTarget = e?.mode === 'ombre' ? 1 : 0;
    this.spT += (spTarget - this.spT) * Math.min(1, dt * 0.0035);
    if (Math.abs(spTarget - this.spT) < 0.002) this.spT = spTarget;
    this.felt = Math.max(0, this.felt - dt * 0.0007);

    // corruption qui gagne (ou recule) en 1,4 s
    let redessins = 0;
    for (const s of this.sites.values()) {
      if (s.cv === s.cible || redessins > 1) continue;
      const p = Math.min(1, (t - s.t0) / 1400),
        ease = 1 - Math.pow(1 - p, 3);
      s.cv = p >= 1 ? s.cible : lerp(s.de, s.cible, ease);
      s.site.dessiner(s.cv);
      s.tex.source.update();
      redessins++;
    }

    // le Regard glisse vers sa cible
    const cible = this.verrou ?? this.souris;
    this.focus.x += (cible.x - this.focus.x) * Math.min(1, dt * 0.006);
    this.focus.y += (cible.y - this.focus.y) * Math.min(1, dt * 0.006);
    const f = this.focus;
    const ecran = this.versEcran(f.x, f.y);
    regard.x = ecran.x;
    regard.y = ecran.y;
    regard.verrouille = Boolean(this.verrou);
    ancre.x = ecran.x;
    ancre.y = ecran.y;
    ancre.rayon = ER * this.sc;
    ancre.visible = Boolean(this.verrou) && this.spT < 0.5;

    // physique
    this.physique.visible = this.spT < 0.999;
    if (this.physique.visible) {
      const [b1, b2] = this.brumes;
      b1!.position.set(-120 + Math.sin(t * 0.00011) * 90, -80 + Math.cos(t * 0.00009) * 60);
      b2!.position.set(-60 + Math.cos(t * 0.00007) * 120, -40 + Math.sin(t * 0.00013) * 70);
      const garde = Boolean(this.verrou?.garde);
      const tremble = garde ? Math.sin(t * 0.05) * 1.2 : 0;
      this.masqueRegard.position.set(f.x + tremble, f.y);
      this.masqueRegard.width = ER * 2;
      this.masqueRegard.height = ERY * 2;
      this.net.alpha = garde ? 0.35 : 1;
      this.lisiere.position.set(f.x, f.y);
      this.lisiere.width = ER * 2.1;
      this.lisiere.height = ERY * 2.1;
      this.gardeLumiere.visible = garde;
      if (garde) {
        this.gardeLumiere.position.set(f.x, f.y);
        this.gardeLumiere.width = this.gardeLumiere.height = ER * 2.2;
        this.gardeLumiere.alpha = 0.55 + 0.1 * Math.sin(t * 0.004);
      }
      // pointillés tournants de la lisière
      this.pointilles.clear();
      const aP = 0.35 + 0.15 * Math.sin(t * 0.003);
      for (let i = 0; i < 64; i++) {
        const a = (i / 64) * Math.PI * 2 + t * 0.00004;
        this.pointilles.circle(f.x + Math.cos(a) * ER * 0.96, f.y + Math.sin(a) * ERY * 0.96, 0.6);
      }
      this.pointilles.fill({ color: 0xff5a1e, alpha: aP });

      // le cône : de l'Œil (y = 40 px à l'écran) jusqu'à l'ellipse
      const E = this.versMonde(window.innerWidth / 2, OEIL_Y);
      const dx = f.x - E.x,
        dy = f.y - E.y,
        L = Math.hypot(dx, dy) || 1,
        nx = -dy / L,
        ny = dx / L;
      const demiFin = Math.hypot(nx * ER, ny * ERY) * 0.95;
      this.cone.position.set(E.x, E.y);
      this.cone.rotation = Math.atan2(dy, dx);
      this.cone.scale.set(L / 512, (demiFin * 2) / 256);
      this.rayons.clear();
      for (let k = 0; k < 6; k++) {
        const o = Math.sin(t * 0.0007 * (k + 1) + k * 2) * 0.85,
          a = 0.05 + 0.05 * Math.sin(t * 0.003 + k);
        this.rayons.moveTo(E.x, E.y).lineTo(f.x + nx * ER * o, f.y + ny * ERY * o).stroke({ width: 1 + (k % 3), color: 0xff7832, alpha: Math.max(0, a) });
      }
      this.ressenti.clear();
      if (this.felt > 0) {
        const r = ER * (1.05 + (1 - this.felt) * 0.5);
        this.ressenti.ellipse(f.x, f.y, r, (r * ERY) / ER).stroke({ width: 2, color: 0xff501e, alpha: this.felt * 0.6 });
      }
    }

    // Monde de l'Ombre
    this.ombre.visible = this.spT > 0.001;
    this.ombre.alpha = this.spT;
    if (this.ombre.visible) {
      let i = 0;
      for (const g of this.spectres.children as Graphics[]) {
        const fl = 0.7 + 0.3 * Math.sin(t * 0.005 + i * 1.7);
        g.clear();
        for (let k = 0; k < 3; k++) {
          const r = ((t * 0.02 + k * 14) % 42) + 8;
          g.ellipse(0, 4, r, r * 0.55).stroke({ width: 1, color: 0xa08ce6, alpha: 0.32 * (1 - r / 50) });
        }
        g.moveTo(0, -14).bezierCurveTo(-6, -14, -7, -6, -7, 0);
        for (let k = 0; k < 6; k++) g.lineTo(-7 + k * 2.8, (k % 2 ? 6 : 10) + Math.sin(t * 0.008 + k) * 1.4);
        g.lineTo(7, 8).bezierCurveTo(7, -6, 6, -14, 0, -14).closePath().fill({ color: 0xdeeefa, alpha: 0.85 * fl });
        g.ellipse(0, -7, 2.6, 3.4).fill(0x02050a);
        if (g.label === 'roi') g.poly([-5, -13, -3.5, -19, -1.5, -14, 0, -21, 1.5, -14, 3.5, -19, 5, -13]).fill({ color: 0xffffff, alpha: fl });
        i++;
      }
    }
  }
}
