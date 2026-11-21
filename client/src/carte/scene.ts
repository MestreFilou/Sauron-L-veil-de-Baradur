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
  ColorMatrixFilter,
  Container,
  Graphics,
  RenderTexture,
  Sprite,
  Text,
  Texture,
  TilingSprite,
} from 'pixi.js';
import { OEIL_Y, regard } from '../bus';
import { CINZ, FELL, lerp, toile } from './bruit';
import type { OutilsPions } from './pions';
import { Pions } from './pions';
import type { EtatSceau, Figure } from './encre';
import { ANCRE_FIGURINE, cuireBrumePointillee, cuireCercleEncre, cuireFigurine, cuireHachures, cuireMasqueRegard, cuireSceau, figurePour, HAUTEUR_FIGURINE } from './encre';
import { Vie } from './vie';
import { cuireHalo, cuireParchemin, cuireSpectral, H, S, SiteCorruption, W } from './parchemin';

/** Demi-axes de l'ellipse du Regard, en unités monde. */
export const ER = 118;
export const ERY = 84;

export interface EtatScene {
  vue: VueJoueur;
  mode: 'oeil' | 'ombre';
  nazgulChoisi: string | null;
  /** Les autres Nazgûl choisis avec Maj+clic. */
  groupe: string[];
  /** Destinations lointaines des marches au long cours. */
  caps: Record<string, string>;
  regionChoisie: string | null;
  murmureSurvole: string | null;
}

export interface Rappels {
  /** Clic sur la carte (hors glisser) : région la plus proche, si elle est assez près. */
  clic(region: string | null): void;
  /** Clic sur un pion des Neuf (`ajouter` : Maj enfoncée). */
  clicPion(id: string, ajouter: boolean): void;
  /** Clic droit : marche vers la région, comme dans un jeu de stratégie. */
  clicDroit(region: string | null): void;
  /** Le pion peut-il être saisi pour un glisser-déposer ? */
  peutSaisir(id: string): boolean;
  /** Pion lâché sur une région. */
  deposer(id: string, region: string | null): void;
  /** Survol d'un sceau de murmure sur la carte (`null` en sortant). */
  survolMurmure?(id: string | null): void;
  /** Clic sur un sceau de murmure. */
  clicMurmure?(id: string): void;
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
  private pions: Pions;
  private figures = new Container();
  private revelations = new Container();
  private brumes: Sprite[] = [];
  private spectres = new Container();
  private lueurs = new Container();
  private etiquettesOmbre = new Container();
  private visionRT!: RenderTexture;
  private vision = new Container();
  private texHalo!: Texture;
  private texSceaux = new Map<string, Texture>();
  private texFigures = new Map<Figure, Texture>();
  /** Les sceaux posés : position, et l'instant où ils sont tombés (pour l'animation). */
  private poses = new Map<string, { x: number; y: number; t0: number; texte: string; entete: string }>();
  private sceauSurvole: string | null = null;
  private billet = new Container();
  private enquete = new Container();
  private vie!: Vie;
  private lumiere = new Graphics();
  private teinteLumiere = { r: 1, g: 1, b: 1, a: 0 };
  /** Le jour affiché : quand il change, la nuit passe sur la carte avant l'aube. */
  private tourVu = 0;
  private nuitJusqua = 0;

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

  constructor(geo: Geographie, rappels: Rappels, outils: OutilsPions) {
    this.geo = geo;
    this.rappels = rappels;
    this.pions = new Pions(geo, outils);
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
      Promise.all(['italic 13px Fondamento', '13px Fondamento', '700 14px Almendra', '14px Almendra'].map((f) => document.fonts.load(f))),
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
      0.6045, 0.1972, 0.0383, 0, 0.012,
      0.0957, 0.6678, 0.0365, 0, 0.006,
      0.0861, 0.1691, 0.4648, 0, 0,
      0, 0, 0, 1, 0,
    ];
    // Hors du Regard, la carte reste lisible : éteinte et couverte de hachures à la plume, jamais floue.
    this.flou.filters = [cm];
    const hachures = new TilingSprite({ texture: Texture.from(cuireHachures()), width: W * 2, height: H * 2 });
    hachures.scale.set(0.5);
    hachures.alpha = 0.75;
    this.flou.addChild(hachures);
    this.physique.addChild(this.flou);

    const brume = Texture.from(cuireBrumePointillee());
    for (const a of [0.55, 0.3]) {
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
    this.masqueRegard = new Sprite(Texture.from(cuireMasqueRegard()));
    this.masqueRegard.anchor.set(0.5);
    this.net.mask = this.masqueRegard;
    this.physique.addChild(this.net, this.masqueRegard);

    this.lisiere = new Sprite(Texture.from(cuireCercleEncre()));
    this.lisiere.anchor.set(0.5);
    this.gardeLumiere = teinte(0xe6f0ff, new Sprite(this.texHalo));
    this.gardeLumiere.anchor.set(0.5);
    this.gardeLumiere.blendMode = 'screen';
    this.cone = new Sprite(Texture.from(cuireCone()));
    this.cone.anchor.set(0, 0.5);
    this.cone.blendMode = 'screen';
    this.cone.alpha = 0.55;
    this.rayons.blendMode = 'add';
    this.vie = new Vie(this.geo);
    this.physique.addChild(this.vie.sol, this.enquete, this.lisiere, this.gardeLumiere, this.pointilles, this.cone, this.rayons, this.revelations, this.figures, this.pions.calque, this.sceaux, this.ressenti, this.vie.ciel, this.lumiere, this.billet);
    this.lumiere.rect(-50, -50, W + 100, H + 100).fill(0xffffff);
    this.lumiere.blendMode = 'multiply';
    this.lumiere.alpha = 0;
    for (const f of ['nazgul', 'roi', 'hobbit', 'homme', 'rodeur', 'mage', 'elfe'] as Figure[]) this.texFigures.set(f, Texture.from(cuireFigurine(f)));

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

  /** Centre la caméra sur un point du monde (double appui sur la touche d'un Nazgûl). */
  centrerSur(x: number, y: number) {
    this.cam.x = x;
    this.cam.y = y;
    this.placer();
  }

  /** Position affichée du pion d'un Nazgûl, en unités monde. */
  positionPion(id: string) {
    return this.pions.position(id);
  }

  private regionEn(x: number, y: number): string | null {
    const r = regionSous(this.geo, x, y);
    return r.distance < 2.5 ? r.id : null;
  }

  /** Tolérance de saisie d'un pion : au moins 16 px à l'écran. */
  private tolerance = () => Math.max(14, 16 / this.sc);

  private brancher(cv: HTMLCanvasElement) {
    let glisse: { x: number; y: number; cx: number; cy: number; pion: string | null } | null = null;
    let deplace = false;
    let tenu = false;
    const actif = () => this.etat?.mode !== 'ombre';
    cv.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const w = this.versMonde(e.clientX, e.clientY);
      const pion = actif() ? this.pions.sous(w.x, w.y, this.tolerance()) : null;
      glisse = { x: e.clientX, y: e.clientY, cx: this.cam.x, cy: this.cam.y, pion: pion && this.rappels.peutSaisir(pion) ? pion : null };
      deplace = false;
      tenu = false;
    });
    // Pion lâché : déposé avant que le glisser ne soit oublié (écouteur enregistré en premier).
    window.addEventListener('mouseup', (e) => {
      if (!glisse?.pion || !tenu) return;
      const w = this.versMonde(e.clientX, e.clientY);
      this.pions.tenir(null);
      this.rappels.deposer(glisse.pion, this.regionEn(w.x, w.y));
      tenu = false;
    });
    window.addEventListener('mouseup', () => {
      glisse = null;
      cv.style.cursor = '';
    });
    cv.addEventListener('mousemove', (e) => {
      const w = this.versMonde(e.clientX, e.clientY);
      if (glisse) {
        const dx = e.clientX - glisse.x,
          dy = e.clientY - glisse.y;
        if (Math.hypot(dx, dy) > 5) {
          deplace = true;
          tenu = Boolean(glisse.pion);
          cv.style.cursor = 'grabbing';
        }
        if (tenu) {
          // On emporte le pion : il suit la souris, l'aperçu montre la marche.
          this.pions.tenir({ id: glisse.pion!, x: w.x, y: w.y, region: this.regionEn(w.x, w.y) });
        } else if (deplace) {
          this.cam.x = glisse.cx - dx / this.sc;
          this.cam.y = glisse.cy - dy / this.sc;
          this.placer();
        }
      } else if (actif()) {
        const sceau = this.sceauSous(w.x, w.y);
        const pion = sceau ? null : this.pions.sous(w.x, w.y, this.tolerance());
        this.pions.survoler(pion, this.regionEn(w.x, w.y));
        this.survolerSceau(sceau);
        cv.style.cursor = pion || sceau ? 'pointer' : 'crosshair';
      }
      this.souris = this.borner(w);
    });
    cv.addEventListener('mouseleave', () => {
      this.pions.survoler(null, null);
      this.survolerSceau(null);
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
      const sceau = actif() ? this.sceauSous(w.x, w.y) : null;
      if (sceau && this.rappels.clicMurmure) return this.rappels.clicMurmure(sceau);
      const pion = actif() ? this.pions.sous(w.x, w.y, this.tolerance()) : null;
      if (pion) this.rappels.clicPion(pion, e.shiftKey);
      else this.rappels.clic(this.regionEn(w.x, w.y));
    });
    cv.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const w = this.versMonde(e.clientX, e.clientY);
      this.rappels.clicDroit(this.regionEn(w.x, w.y));
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

    this.pions.maj({ vue: v, choisis: e.nazgulChoisi ? [e.nazgulChoisi, ...e.groupe] : [], caps: e.caps });
    this.dessinerSceaux(v, e.murmureSurvole);
    this.dessinerFigures(v);
    this.dessinerEnquete(v);
    // lumière du jour : l'aube est fraîche, le crépuscule ambré, la nuit bleue
    const L: Record<string, [number, number, number, number]> = {
      oeil: [1, 0.96, 0.92, 0.12],
      ordres: [1, 0.86, 0.68, 0.32],
      fin: [0.55, 0.6, 0.78, 0.6],
    };
    const [r, g, b, a] = L[v.phase] ?? L.oeil!;
    this.teinteLumiere = { r, g, b, a };
    if (this.tourVu && v.tour > this.tourVu) this.nuitJusqua = t0 + 3200;
    this.tourVu = v.tour;
    this.dessinerOmbre(v, e.nazgulChoisi);
  }

  /** La texture d'un sceau (source × état), cuite à la demande. */
  private texSceau(source: VueJoueur['murmures'][number]['source'], etat: EtatSceau) {
    const cle = `${source}|${etat}`;
    let t = this.texSceaux.get(cle);
    if (!t) {
      t = Texture.from(cuireSceau(source, etat));
      this.texSceaux.set(cle, t);
    }
    return t;
  }

  /**
   * Les murmures du jour, en sceaux de cire posés sur leur région. Un sceau
   * clos attend d'être classé ; classé vrai, il reçoit une coche à l'encre ;
   * faux ou démenti, la cire est brisée.
   */
  private dessinerSceaux(v: VueJoueur, survole: string | null) {
    this.sceaux.removeChildren().forEach((c) => c.destroy({ children: true }));
    const recents = v.murmures.filter((m) => m.tour === v.tour);
    const parRegion = new Map<string, number>();
    const maintenant = performance.now();
    const vus = new Set<string>();
    for (const m of recents) {
      const c = this.centre(m.region);
      if (!c) continue;
      const k = parRegion.get(m.region) ?? 0;
      parRegion.set(m.region, k + 1);
      const x = c.x + 14 + k * 13,
        y = c.y - 22 + (k % 2) * 5;
      vus.add(m.id);
      const deja = this.poses.get(m.id);
      // un sceau nouveau tombe sur le papier, l'un après l'autre
      const t0 = deja?.t0 ?? maintenant + this.poses.size * 140;
      const nomSource: Record<string, string> = { espion: 'Espion', crebain: 'Crébains', rumeur: 'Taverne', nazgul: 'Les Neuf', agent: 'Agent' };
      this.poses.set(m.id, {
        x,
        y,
        t0,
        texte: m.texte ?? m.faitTexte,
        entete: `${nomSource[m.source] ?? m.emetteur} · ${(v.regions.find((r) => r.id === m.region)?.nom ?? m.region).split(' · ')[0]} · sûr à ${Math.round(m.fiabilite * 100)} %`,
      });

      const brise = m.verite === 'faux' || m.contredit || m.classement === 'faux';
      const etat: EtatSceau = brise ? 'brise' : m.verite === 'vrai' || m.classement === 'vrai' ? 'vrai' : 'clos';
      const s = new Container();
      s.label = m.id;
      s.position.set(x, y);
      const sp = new Sprite(this.texSceau(m.source, etat));
      sp.anchor.set(0.5);
      sp.scale.set(21 / 96);
      sp.rotation = ((k * 37 + m.id.length * 11) % 30) / 100 - 0.15;
      s.addChild(sp);
      if (etat === 'vrai') {
        // coche à l'encre, tracée à côté du sceau
        const g = new Graphics();
        g.moveTo(6, 2).quadraticCurveTo(8, 5, 9, 7).quadraticCurveTo(12, 0, 17, -5).stroke({ width: 1.3, color: 0x3a2a1c, alpha: 0.9 });
        s.addChild(g);
      }
      if (m.classement === 'incertain' && !m.verite) {
        const t = new Text({ text: '?', style: { fontFamily: FELL, fontStyle: 'italic', fontSize: 12, fill: 0x7d2414 }, resolution: 3 });
        t.position.set(7, -12);
        s.addChild(t);
      }
      if (m.id === survole || m.id === this.sceauSurvole) {
        // souligné à la plume, comme on entoure une note
        const g = new Graphics();
        g.ellipse(0, 1, 12, 11).stroke({ width: 1.1, color: 0x7d2414, alpha: 0.85 });
        s.addChildAt(g, 0);
      }
      this.sceaux.addChild(s);
    }
    for (const id of [...this.poses.keys()]) if (!vus.has(id)) this.poses.delete(id);
    this.dessinerBillet();
  }

  private sceauSous(x: number, y: number): string | null {
    let best: string | null = null,
      d = Math.max(9, 12 / this.sc);
    for (const [id, p] of this.poses) {
      const dd = Math.hypot(p.x - x, p.y - y);
      if (dd < d) {
        d = dd;
        best = id;
      }
    }
    return best;
  }

  private survolerSceau(id: string | null) {
    if (id === this.sceauSurvole) return;
    this.sceauSurvole = id;
    this.rappels.survolMurmure?.(id);
    if (this.etat) this.dessinerSceaux(this.etat.vue, this.etat.murmureSurvole);
  }

  /** Le billet de papier qui s'ouvre au survol d'un sceau : la source, puis le murmure lui-même. */
  private dessinerBillet() {
    this.billet.removeChildren().forEach((c) => c.destroy({ children: true }));
    const id = this.sceauSurvole ?? this.etat?.murmureSurvole ?? null;
    const p = id ? this.poses.get(id) : null;
    if (!p) return;
    const largeur = 190;
    const entete = new Text({ text: p.entete.toUpperCase(), style: { fontFamily: CINZ, fontWeight: '600', fontSize: 7.5, letterSpacing: 1.2, fill: 0x7d2414 }, resolution: 4 });
    const corps = new Text({
      text: p.texte,
      style: { fontFamily: FELL, fontSize: 11.5, lineHeight: 14, fill: 0x2e2015, wordWrap: true, wordWrapWidth: largeur - 18 },
      resolution: 4,
    });
    entete.position.set(9, 7);
    corps.position.set(9, 19);
    const h = corps.height + 27;
    const g = new Graphics();
    // un bout de papier découpé, un peu de travers, avec son ombre
    const bord = (dx: number, dy: number) => {
      g.moveTo(dx + 1, dy)
        .lineTo(dx + largeur * 0.4, dy + 1.2)
        .lineTo(dx + largeur - 1, dy - 0.5)
        .lineTo(dx + largeur, dy + h * 0.6)
        .lineTo(dx + largeur - 2, dy + h)
        .lineTo(dx + largeur * 0.55, dy + h + 1)
        .lineTo(dx, dy + h - 0.5)
        .lineTo(dx - 1, dy + h * 0.4)
        .closePath();
    };
    bord(3, 4);
    g.fill({ color: 0x281a10, alpha: 0.3 });
    bord(0, 0);
    g.fill(0xeadcb6).stroke({ width: 0.8, color: 0x6b5236, alpha: 0.9 });
    const b = new Container();
    b.addChild(g, entete, corps);
    const versDroite = p.x + largeur + 20 < this.cam.x + window.innerWidth / (2 * this.sc);
    b.position.set(versDroite ? p.x + 13 : p.x - largeur - 13, p.y - 10);
    b.rotation = versDroite ? -0.015 : 0.015;
    this.billet.addChild(b);
  }

  /** Les personnages dont Sauron connaît la position récente : des figurines peintes, posées sur la carte. */
  private dessinerFigures(v: VueJoueur) {
    this.figures.removeChildren().forEach((c) => c.destroy({ children: true }));
    const parRegion = new Map<string, { id: string; nom: string }[]>();
    for (const p of v.personnages) {
      if (!p.position || p.position.tour < v.tour - 1) continue;
      const l = parRegion.get(p.position.region) ?? [];
      l.push({ id: p.id, nom: p.nom.replace(/^(Le|La|Les) /, '').split(' ')[0]! });
      parRegion.set(p.position.region, l);
    }
    for (const [id, gens] of parRegion) {
      const c = this.centre(id);
      if (!c) continue;
      const f = new Container();
      f.position.set(c.x - 30, c.y + 2);
      const liste = gens.slice(0, 5);
      // de l'arrière vers l'avant, pour que les socles se recouvrent bien
      liste.forEach((p, k) => {
        const sp = new Sprite(this.texFigures.get(figurePour(p.id))!);
        sp.anchor.set(ANCRE_FIGURINE.x, ANCRE_FIGURINE.y);
        sp.scale.set(30 / HAUTEUR_FIGURINE);
        sp.position.set(k * 8, (k % 2) * 3);
        f.addChild(sp);
      });
      const t = new Text({
        text: gens.map((p) => p.nom).join(', '),
        style: { fontFamily: FELL, fontStyle: 'italic', fontSize: 11, fill: 0x5a1a0e, stroke: { color: 0xe8d8b2, width: 3, alpha: 0.75 } },
        resolution: 3,
      });
      t.anchor.set(0.5, 0);
      t.position.set(((liste.length - 1) * 8) / 2, 7);
      f.addChild(t);
      this.figures.addChild(f);
    }
  }

  /**
   * La piste de l'Anneau sur le parchemin : ce que la Tour en déduit, noté à
   * l'encre rouge comme sur une carte d'enquête. Un cercle en pointillé autour
   * de la région probable (plus large quand la piste est incertaine), et les
   * autres régions possibles marquées d'un simple point d'interrogation.
   */
  private dessinerEnquete(v: VueJoueur) {
    this.enquete.removeChildren().forEach((c) => c.destroy({ children: true }));
    const p = v.piste;
    const g = new Graphics();
    const rp = this.centre(p.regionProbable);
    const geo = this.geo.regions[p.regionProbable];
    if (rp && geo) {
      const etale = p.precision === 'diffuse' ? 1.15 : p.precision === 'region_a_1_pres' ? 0.95 : 0.7;
      const r = geo.rayon * etale;
      // pointillé à la main : des tirets de longueur inégale
      const n = Math.round(r * 0.55);
      for (let k = 0; k < n; k++) {
        const a0 = (k / n) * 6.283 + Math.sin(k * 3.1) * 0.02,
          a1 = a0 + (6.283 / n) * (0.45 + 0.15 * Math.sin(k * 1.7));
        const rr = r * (1 + 0.025 * Math.sin(k * 0.9));
        g.moveTo(rp.x + Math.cos(a0) * rr, rp.y + Math.sin(a0) * rr * 0.72).lineTo(rp.x + Math.cos(a1) * rr, rp.y + Math.sin(a1) * rr * 0.72);
      }
      g.stroke({ width: 1.2, color: 0x7d2414, alpha: 0.85 });
      // l'Anneau, dessiné d'un trait d'or terni
      const ax = rp.x + r * 0.62,
        ay = rp.y + r * 0.62;
      g.ellipse(ax, ay, 5.2, 4.2).stroke({ width: 1.6, color: 0x8a6a1c, alpha: 0.95 });
      g.ellipse(ax - 0.6, ay - 0.6, 5.2, 4.2).stroke({ width: 0.6, color: 0xe9cf86, alpha: 0.8 });
      const t = new Text({
        text: `l'Anneau ? ${Math.round(p.certitude * 100)} %`,
        style: { fontFamily: FELL, fontStyle: 'italic', fontSize: 12, fill: 0x7d2414, stroke: { color: 0xe8d8b2, width: 3, alpha: 0.7 } },
        resolution: 3,
      });
      t.position.set(ax + 8, ay - 9);
      this.enquete.addChild(t);
    }
    for (const [id, prob] of Object.entries(p.probabilites)) {
      if (id === p.regionProbable || prob < 0.12) continue;
      const c = this.centre(id);
      if (!c) continue;
      const t = new Text({ text: '?', style: { fontFamily: FELL, fontStyle: 'italic', fontSize: 10 + prob * 18, fill: 0x7d2414 }, resolution: 3 });
      t.alpha = 0.55 + prob;
      t.anchor.set(0.5);
      t.position.set(c.x - 18, c.y - 16);
      this.enquete.addChild(t);
    }
    this.enquete.addChildAt(g, 0);
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
      this.lisiere.width = ER * 2.02;
      this.lisiere.height = ERY * 2.02;
      // Repoussé : le cercle pâlit, l'encre bleuit comme sous une lumière froide.
      this.gardeLumiere.visible = false;
      this.lisiere.tint = garde ? 0x8aa6c8 : 0xffffff;
      this.lisiere.alpha = garde ? 0.6 : 0.95;

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
      this.pions.image(t, dt);

      // les sceaux tombent sur le papier : un peu gros d'abord, puis écrasés
      for (const s of this.sceaux.children) {
        const p = this.poses.get(s.label);
        if (!p) continue;
        const u = (t - p.t0) / 320;
        if (u >= 1) {
          if (s.scale.x !== 1) s.scale.set(1);
          s.alpha = 1;
          continue;
        }
        s.alpha = u <= 0 ? 0 : 1;
        const e = Math.max(0, u);
        s.scale.set(1 + (1 - e) * (1 - e) * 0.9);
      }

      // lumière du jour et vie du monde
      const nuitPasse = t < this.nuitJusqua;
      const lum = nuitPasse ? { r: 0.46, g: 0.52, b: 0.74, a: 0.72 } : this.teinteLumiere;
      const k = Math.min(1, dt * 0.002);
      const cur = this.lumiere.tint as number;
      const cr = ((cur >> 16) & 255) / 255,
        cg = ((cur >> 8) & 255) / 255,
        cb = (cur & 255) / 255;
      const nr = cr + (lum.r - cr) * k,
        ng = cg + (lum.g - cg) * k,
        nb = cb + (lum.b - cb) * k;
      this.lumiere.tint = (Math.round(nr * 255) << 16) | (Math.round(ng * 255) << 8) | Math.round(nb * 255);
      this.lumiere.alpha += (lum.a - this.lumiere.alpha) * k;
      const nuit = nuitPasse || this.etat?.vue.phase === 'fin' ? 1 : this.etat?.vue.phase === 'ordres' ? 0.55 : 0;
      this.vie.image(t, nuit);
      this.ressenti.clear();
      if (this.felt > 0) {
        const r = ER * (1.05 + (1 - this.felt) * 0.5);
        this.ressenti.ellipse(f.x, f.y, r, (r * ERY) / ER).stroke({ width: 1.4, color: 0x7d2414, alpha: this.felt * 0.7 });
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
