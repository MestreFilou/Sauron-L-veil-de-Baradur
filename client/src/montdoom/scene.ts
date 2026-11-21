/**
 * Le Mont Destin en 3D (Three.js) : la plaine de Gorgoroth crevassée de lave,
 * l'Orodruin et son panache, la chaussée vers Barad-dûr et l'Œil au sommet.
 * Les ouvrages bâtis par le joueur s'y dressent : à l'état de fondations
 * fantômes tant qu'ils ne sont pas construits, puis allumés niveau par niveau.
 *
 * Tout est procédural (aucun fichier à charger) et déterministe. La scène ne
 * connaît pas le moteur : on lui passe les niveaux, elle signale survols et clics.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { IdOuvrage } from '@sauron/engine';
import { Alea, fbm, smooth } from '../carte/bruit';

export interface RappelsScene {
  survol(id: IdOuvrage | null): void;
  choix(id: IdOuvrage): void;
}

export interface SceneMontDoom {
  niveaux(n: Record<IdOuvrage, number>): void;
  /** Recentre doucement la caméra sur un ouvrage (null : vue d'ensemble). */
  viser(id: IdOuvrage | null): void;
  /** Gerbe de feu et d'étincelles quand un chantier s'achève. */
  celebrer(id: IdOuvrage): void;
  detruire(): void;
}

/* ------------------------------------------------------------------ */
/* Relief                                                              */
/* ------------------------------------------------------------------ */

const H = 27; // hauteur du cône
const RC = 4.6; // rayon du cratère

/** Hauteur du terrain : la plaine de cendres et le cône de l'Orodruin. */
function hauteur(x: number, z: number): number {
  const r = Math.hypot(x, z);
  let v: number;
  if (r < RC) v = H - 4.2 + Math.pow(r / RC, 2) * 4.2;
  else v = H * Math.exp(-Math.pow((r - RC) / 15.5, 1.25));
  const flanc = smooth(60, 8, r) * (1 - smooth(RC + 2, RC, r));
  const rugueux = (fbm(x * 0.13 + 3, z * 0.13 - 7, 4) - 0.5) * 5.2 * flanc;
  const ravines = Math.pow(Math.abs(Math.sin(Math.atan2(z, x) * 9 + fbm(x * 0.05, z * 0.05, 2) * 6)), 6) * -1.1 * flanc;
  const plaine = (fbm(x * 0.022 + 11, z * 0.022 + 5, 4) - 0.5) * 6 + (fbm(x * 0.09, z * 0.09, 2) - 0.5) * 1.2;
  return v + rugueux + ravines + plaine * (1 - smooth(30, 6, r) * 0.7);
}

/* ------------------------------------------------------------------ */
/* Textures dessinées au canevas                                       */
/* ------------------------------------------------------------------ */

/** Carte d'émission du sol : crevasses de lave et lueur du cratère. */
function textureCrevasses(etendue: number): THREE.CanvasTexture {
  const N = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const c = cv.getContext('2d')!;
  const img = c.createImageData(N, N);
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const x = (i / N - 0.5) * etendue,
        z = (j / N - 0.5) * etendue,
        r = Math.hypot(x, z);
      // fissures : vallées étroites d'un bruit « ridged »
      const n = fbm(x * 0.07 + 40, z * 0.07 - 13, 4);
      const fissure = Math.pow(1 - Math.min(1, Math.abs(n - 0.5) * 16), 4);
      const masque = smooth(18, 40, r) * smooth(120, 60, r) * smooth(0.35, 0.7, fbm(x * 0.025 + 9, z * 0.025, 3));
      const cratere = Math.exp(-r / 2.2) * 1.4;
      const k = (j * N + i) * 4;
      const I = Math.min(1, fissure * masque * 0.9 + cratere);
      img.data[k] = 255 * Math.min(1, I * 1.2);
      img.data[k + 1] = 255 * Math.pow(I, 1.8) * 0.45;
      img.data[k + 2] = 255 * Math.pow(I, 3) * 0.12;
      img.data[k + 3] = 255;
    }
  c.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Disque doux pour les particules. */
function textureDisque(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c = cv.getContext('2d')!;
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

/** L'Œil au sommet de la Tour : amande de feu et pupille fendue. */
function textureOeil(): THREE.CanvasTexture {
  const W = 256,
    Hh = 128;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = Hh;
  const c = cv.getContext('2d')!;
  const g = c.createRadialGradient(W / 2, Hh / 2, 2, W / 2, Hh / 2, W / 2);
  g.addColorStop(0, 'rgba(255,240,190,1)');
  g.addColorStop(0.18, 'rgba(255,170,60,1)');
  g.addColorStop(0.42, 'rgba(255,70,10,.85)');
  g.addColorStop(1, 'rgba(120,10,0,0)');
  c.fillStyle = g;
  c.beginPath();
  c.ellipse(W / 2, Hh / 2, W / 2, Hh / 2.6, 0, 0, 6.283);
  c.fill();
  c.fillStyle = 'rgba(10,0,0,.95)';
  c.beginPath();
  c.moveTo(W / 2, Hh * 0.2);
  c.quadraticCurveTo(W / 2 + 9, Hh / 2, W / 2, Hh * 0.8);
  c.quadraticCurveTo(W / 2 - 9, Hh / 2, W / 2, Hh * 0.2);
  c.fill();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ------------------------------------------------------------------ */
/* Particules (fumée, cendres, braises)                                */
/* ------------------------------------------------------------------ */

interface Particules {
  points: THREE.Points;
  maj(dt: number, t: number): void;
  /** Nombre de particules actives (le reste dort). */
  actives: number;
}

function particules(o: {
  max: number;
  actives: number;
  texture: THREE.Texture;
  additif: boolean;
  naitre: (p: Float32Array, v: Float32Array, i: number, alea: () => number) => void;
  vie: [number, number];
  taille: [number, number];
  couleur: (y: number, vie: number) => [number, number, number];
  opacite: number;
  monte?: number;
}): Particules {
  const pos = new Float32Array(o.max * 3),
    vit = new Float32Array(o.max * 3),
    age = new Float32Array(o.max),
    duree = new Float32Array(o.max),
    tailles = new Float32Array(o.max),
    col = new Float32Array(o.max * 3),
    alpha = new Float32Array(o.max);
  const al = new Alea(o.max * 7 + 3);
  const alea = () => al.next();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aTaille', new THREE.BufferAttribute(tailles, 1));
  geo.setAttribute('aCouleur', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTex: { value: o.texture }, uEchelle: { value: 300 }, uOpacite: { value: o.opacite } },
    vertexShader: `
      attribute float aTaille; attribute vec3 aCouleur; attribute float aAlpha;
      uniform float uEchelle; varying vec3 vC; varying float vA;
      void main(){
        vC = aCouleur; vA = aAlpha;
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        gl_PointSize = aTaille * uEchelle / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D uTex; uniform float uOpacite; varying vec3 vC; varying float vA;
      void main(){
        vec4 t = texture2D(uTex, gl_PointCoord);
        gl_FragColor = vec4(vC, t.a * vA * uOpacite);
      }`,
    transparent: true,
    depthWrite: false,
    blending: o.additif ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  const renaitre = (i: number) => {
    o.naitre(pos, vit, i, alea);
    age[i] = 0;
    duree[i] = o.vie[0] + alea() * (o.vie[1] - o.vie[0]);
    tailles[i] = o.taille[0] + alea() * (o.taille[1] - o.taille[0]);
  };
  for (let i = 0; i < o.max; i++) {
    renaitre(i);
    age[i] = alea() * duree[i]!; // déjà en vol au premier rendu
  }
  const sys: Particules = {
    points,
    actives: o.actives,
    maj(dt) {
      for (let i = 0; i < o.max; i++) {
        if (i >= sys.actives) {
          alpha[i] = 0;
          continue;
        }
        age[i]! += dt;
        if (age[i]! > duree[i]!) renaitre(i);
        const k = i * 3,
          l = age[i]! / duree[i]!;
        pos[k]! += vit[k]! * dt;
        pos[k + 1]! += vit[k + 1]! * dt;
        pos[k + 2]! += vit[k + 2]! * dt;
        vit[k + 1]! += (o.monte ?? 0) * dt;
        const [r, g, b] = o.couleur(pos[k + 1]!, l);
        col[k] = r;
        col[k + 1] = g;
        col[k + 2] = b;
        alpha[i] = Math.sin(Math.PI * Math.min(1, l * 1.15));
      }
      geo.attributes.position!.needsUpdate = true;
      geo.attributes.aCouleur!.needsUpdate = true;
      geo.attributes.aAlpha!.needsUpdate = true;
      geo.attributes.aTaille!.needsUpdate = true;
    },
  };
  return sys;
}

/* ------------------------------------------------------------------ */
/* Bâtiments                                                           */
/* ------------------------------------------------------------------ */

const PIERRE = new THREE.MeshStandardMaterial({ color: 0x1b1614, roughness: 0.92, metalness: 0.18, flatShading: true });
const FER = new THREE.MeshStandardMaterial({ color: 0x120e0d, roughness: 0.6, metalness: 0.6, flatShading: true });

/** Un « niveau » d'ouvrage : sa maçonnerie, et ce qui s'allume quand il est bâti. */
interface Etage {
  /** La maçonnerie, montrée en fantôme tant que le niveau n'est pas bâti. */
  corps: THREE.Object3D[];
  /** Lueurs et lumières, éteintes tant que le niveau n'est pas bâti. */
  feux: THREE.Object3D[];
  lumiere?: THREE.PointLight;
}

interface Ouvrage3D {
  id: IdOuvrage;
  groupe: THREE.Group;
  etages: Etage[];
  /** Point d'accroche de l'étiquette (repère monde). */
  ancre: THREE.Vector3;
  /** Vue rapprochée : cible et distance de la caméra. */
  vue: { cible: THREE.Vector3; distance: number };
  zone: THREE.Mesh;
  niveau: number;
}

const lueur = (couleur: number, intensite = 1) =>
  new THREE.MeshBasicMaterial({ color: new THREE.Color(couleur).multiplyScalar(intensite), toneMapped: false });

function poser(o: THREE.Object3D, x: number, z: number, dy = 0) {
  o.position.set(x, hauteur(x, z) + dy, z);
  return o;
}

/** Forges de l'Orodruin : trois halles à cheminée au pied du cône. */
function forges(): Omit<Ouvrage3D, 'id' | 'zone' | 'niveau'> {
  const groupe = new THREE.Group();
  const etages: Etage[] = [];
  const sites: [number, number, number][] = [
    [24, 31, 0.3],
    [31, 25, -0.4],
    [17, 37, 0.9],
  ];
  for (const [x, z, rot] of sites) {
    const halle = new THREE.Group();
    const corps = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.6, 3.4), PIERRE);
    corps.position.y = 1.2;
    const toit = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 2.6, 1.6, 4, 1), FER);
    toit.scale.set(1.45, 1, 0.95);
    toit.rotation.y = Math.PI / 4;
    toit.position.y = 3.3;
    const chem = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.7, 5.5, 6), PIERRE);
    chem.position.set(1.6, 3.6, 0.6);
    const bouche = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.25, 8), lueur(0xff7a25, 2.2));
    bouche.position.set(1.6, 6.4, 0.6);
    const porte = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.5), lueur(0xff5a14, 1.6));
    porte.position.set(-0.6, 0.75, 1.71);
    halle.add(corps, toit, chem, bouche, porte);
    halle.rotation.y = rot;
    poser(halle, x, z, -0.4);
    groupe.add(halle);
    const lumiere = new THREE.PointLight(0xff6a20, 0, 16, 1.6);
    lumiere.position.set(x + 0.5, hauteur(x, z) + 2.5, z + 2.5);
    groupe.add(lumiere);
    etages.push({ corps: [corps, toit, chem], feux: [bouche, porte], lumiere });
  }
  return { groupe, etages, ancre: new THREE.Vector3(24, hauteur(24, 31) + 9, 31), vue: { cible: new THREE.Vector3(24, 5, 30), distance: 46 } };
}

/** Voile de cendres : bouches creusées dans le flanc, qui crachent la fumée. */
function cendres(): Omit<Ouvrage3D, 'id' | 'zone' | 'niveau'> {
  const groupe = new THREE.Group();
  const etages: Etage[] = [];
  const sites: [number, number][] = [
    [-14, 13],
    [-19, 6],
  ];
  for (const [x, z] of sites) {
    const tour = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 2.1, 4.2, 7, 1, true), PIERRE);
    tour.material = PIERRE.clone();
    (tour.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    tour.position.y = 1.6;
    const gueule = new THREE.Mesh(new THREE.CircleGeometry(1.05, 12), lueur(0xff6a1a, 1.8));
    gueule.rotation.x = -Math.PI / 2;
    gueule.position.y = 3.5;
    const t = new THREE.Group();
    t.add(tour, gueule);
    poser(t, x, z, -0.8);
    groupe.add(t);
    const lumiere = new THREE.PointLight(0xff5a14, 0, 12, 1.8);
    lumiere.position.set(x, hauteur(x, z) + 4.5, z);
    groupe.add(lumiere);
    etages.push({ corps: [tour], feux: [gueule], lumiere });
  }
  return { groupe, etages, ancre: new THREE.Vector3(-16.5, hauteur(-16.5, 10) + 8, 10), vue: { cible: new THREE.Vector3(-16, 12, 9), distance: 46 } };
}

/** Écuries noires : longues halles sur la chaussée de Barad-dûr. */
function ecuries(): Omit<Ouvrage3D, 'id' | 'zone' | 'niveau'> {
  const groupe = new THREE.Group();
  const etages: Etage[] = [];
  const sites: [number, number][] = [
    [-40, -4],
    [-47, -13],
  ];
  for (const [x, z] of sites) {
    const h = new THREE.Group();
    const corps = new THREE.Mesh(new THREE.BoxGeometry(9, 2.4, 3.2), PIERRE);
    corps.position.y = 1.1;
    const toit = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 2.3, 1.7, 3, 1), FER);
    toit.rotation.z = Math.PI / 2;
    toit.rotation.y = Math.PI / 2;
    toit.scale.set(1, 4.1, 1);
    toit.position.y = 2.75;
    const pics: THREE.Mesh[] = [];
    for (let i = -2; i <= 2; i++) {
      const p = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.6, 4), FER);
      p.position.set(i * 2, 4, 0);
      pics.push(p);
    }
    const fentes: THREE.Mesh[] = [];
    for (let i = -1.5; i <= 1.5; i++) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1), lueur(0xff4a10, 1.2));
      f.position.set(i * 2.2, 1.2, 1.61);
      fentes.push(f);
    }
    h.add(corps, toit, ...pics, ...fentes);
    h.rotation.y = -0.65;
    poser(h, x, z, -0.3);
    groupe.add(h);
    etages.push({ corps: [corps, toit, ...pics], feux: fentes });
  }
  return { groupe, etages, ancre: new THREE.Vector3(-43, hauteur(-43, -8) + 7, -8), vue: { cible: new THREE.Vector3(-43, 3, -8), distance: 44 } };
}

/** Barad-dûr, au loin : la Tour, ses cornes, l'Œil, et la Chambre du Regard. */
function baradDur(oeil: THREE.Texture): { tour: THREE.Group; chambre: Omit<Ouvrage3D, 'id' | 'zone' | 'niveau'>; sprite: THREE.Sprite; lumiere: THREE.PointLight } {
  const tour = new THREE.Group();
  const X = -105,
    Z = -92,
    y0 = hauteur(X, Z) - 1;
  const etages: [number, number, number][] = [
    // rayon bas, rayon haut, hauteur
    [11, 9, 9],
    [8.6, 7, 12],
    [6.6, 5.2, 14],
    [5, 3.8, 14],
    [3.6, 2.6, 12],
  ];
  let y = y0;
  etages.forEach(([r1, r2, h], i) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, h, 8, 1), PIERRE);
    m.position.y = y + h / 2;
    m.rotation.y = (i * Math.PI) / 8;
    tour.add(m);
    // contreforts et pointes à chaque ressaut
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + (i * Math.PI) / 8;
      const p = new THREE.Mesh(new THREE.ConeGeometry(0.55, 4 + (i % 2) * 2, 4), FER);
      p.position.set(Math.cos(a) * r2 * 1.02, y + h + 1.5, Math.sin(a) * r2 * 1.02);
      tour.add(p);
    }
    y += h;
  });
  // les deux cornes qui enserrent l'Œil
  for (const s of [-1, 1]) {
    const corne = new THREE.Mesh(new THREE.ConeGeometry(1.2, 13, 5), FER);
    corne.position.set(s * 2.4, y + 5.5, 0);
    corne.rotation.z = -s * 0.22;
    tour.add(corne);
  }
  tour.position.set(X, 0, Z);
  tour.lookAt(0, 0, 0);
  tour.rotation.x = 0;
  const sommet = new THREE.Vector3(X, y + 6, Z);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: oeil, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false, color: new THREE.Color(2.2, 2.2, 2.2) }));
  sprite.position.copy(sommet);
  sprite.scale.set(10, 5, 1);
  const lumiere = new THREE.PointLight(0xff4a10, 220, 160, 1.4);
  lumiere.position.copy(sommet);

  // Chambre du Regard : couronne de baies allumées sous les cornes
  const chambre = new THREE.Group();
  const baies: THREE.Mesh[] = [];
  const yc = y - 6;
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    const b = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.2), lueur(0xffa040, 2.4));
    b.position.set(X + Math.cos(a) * 3.25, yc, Z + Math.sin(a) * 3.25);
    b.lookAt(X + Math.cos(a) * 10, yc, Z + Math.sin(a) * 10);
    baies.push(b);
    chambre.add(b);
  }
  const anneau = new THREE.Mesh(new THREE.TorusGeometry(3.9, 0.35, 6, 24), FER);
  anneau.rotation.x = Math.PI / 2;
  anneau.position.set(X, yc + 1.6, Z);
  chambre.add(anneau);
  const lum = new THREE.PointLight(0xffa040, 0, 30, 1.5);
  lum.position.set(X, yc, Z);
  chambre.add(lum);
  return {
    tour,
    sprite,
    lumiere,
    chambre: {
      groupe: chambre,
      etages: [{ corps: [anneau], feux: baies, lumiere: lum }],
      ancre: new THREE.Vector3(X, yc + 3, Z),
      vue: { cible: new THREE.Vector3(X, yc - 10, Z), distance: 75 },
    },
  };
}

/* ------------------------------------------------------------------ */
/* La scène                                                            */
/* ------------------------------------------------------------------ */

export function creerScene(cv: HTMLCanvasElement, etiquettes: Partial<Record<IdOuvrage, HTMLElement>>, rappels: RappelsScene): SceneMontDoom {
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const ciel = 0x1c0b06;
  scene.fog = new THREE.FogExp2(ciel, 0.0075);
  scene.background = new THREE.Color(0x080403);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 900);
  camera.position.set(46, 30, 104);

  // Ciel : dôme en dégradé, rougeoyant à l'horizon, nuées lentes.
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(600, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { uT: { value: 0 } },
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        varying vec3 vP; uniform float uT;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
        float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ s+=a*n(p); p*=2.03; a*=0.5; } return s; }
        void main(){
          float y = clamp(vP.y, -0.2, 1.0);
          vec3 haut = vec3(0.018,0.012,0.012), horizon = vec3(0.28,0.07,0.025);
          vec3 c = mix(horizon, haut, smoothstep(0.0, 0.45, y));
          vec2 q = vP.xz / (0.35 + y) * 2.2 + vec2(uT*0.006, uT*0.002);
          float nuee = fbm(q);
          float lueur = smoothstep(0.55, 0.0, y);
          c = mix(c, vec3(0.42,0.12,0.04) * (0.4 + lueur), smoothstep(0.45, 0.8, nuee) * 0.55 * (0.35 + lueur));
          c *= 0.6 + 0.4 * nuee;
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  scene.add(dome);

  // Lumières : un faible jour couleur de cendre, le feu d'en bas.
  scene.add(new THREE.HemisphereLight(0x5a3426, 0x0a0504, 0.55));
  const lune = new THREE.DirectionalLight(0xc06040, 0.9);
  lune.position.set(-60, 80, 40);
  scene.add(lune);
  const cratere = new THREE.PointLight(0xff5a14, 900, 120, 1.6);
  cratere.position.set(0, H + 2, 0);
  scene.add(cratere);
  const ventre = new THREE.PointLight(0xff3a0a, 260, 70, 1.4);
  ventre.position.set(0, 4, 26);
  scene.add(ventre);

  // Terrain : une seule grille pour la plaine et le cône.
  const ETENDUE = 280;
  const geo = new THREE.PlaneGeometry(ETENDUE, ETENDUE, 300, 300);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position!;
  const couleurs = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      z = p.getZ(i),
      y = hauteur(x, z);
    p.setY(i, y);
    const r = Math.hypot(x, z),
      n = fbm(x * 0.2, z * 0.2, 3);
    const roche = smooth(40, 6, r);
    const c = new THREE.Color().setRGB(0.07 + n * 0.05, 0.055 + n * 0.035, 0.05 + n * 0.025);
    c.lerp(new THREE.Color(0.16, 0.1, 0.08), roche * 0.55 * n);
    c.lerp(new THREE.Color(0.38, 0.1, 0.03), smooth(RC + 3, RC - 0.5, r) * 0.8);
    couleurs.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(couleurs, 3));
  geo.computeVertexNormals();
  const crevasses = textureCrevasses(ETENDUE);
  const sol = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0.05, emissive: 0xffffff, emissiveMap: crevasses, emissiveIntensity: 0.7 }),
  );
  scene.add(sol);

  // Lac de lave au fond du cratère.
  const lac = new THREE.Mesh(new THREE.CircleGeometry(RC * 0.92, 32), lueur(0xff6a1c, 2.2));
  lac.rotation.x = -Math.PI / 2;
  lac.position.y = H - 3.9;
  scene.add(lac);

  // Coulées de lave qui descendent les flancs.
  const coulees: THREE.MeshBasicMaterial[] = [];
  const alea = new Alea(91);
  for (const a0 of [0.1, 1.6, 4.55, 5.4]) {
    const pts: THREE.Vector3[] = [];
    let a = a0;
    for (let r = RC + 0.3; r < 30 + alea.next() * 16; r += 1.2) {
      a += (fbm(r * 0.1, a0 * 3, 2) - 0.5) * 0.09;
      const x = Math.cos(a) * r,
        z = Math.sin(a) * r;
      pts.push(new THREE.Vector3(x, hauteur(x, z) + 0.12, z));
    }
    const courbe = new THREE.CatmullRomCurve3(pts);
    const coeur = lueur(0xff7a2a, 1.4);
    coulees.push(coeur);
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(courbe, 80, 0.24, 5), coeur));
    const halo = new THREE.MeshBasicMaterial({ color: 0xff3a0a, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(courbe, 80, 1.1, 6), halo));
  }

  // Sammath Naur : la porte de feu dans le flanc, face à la Tour.
  const angleTour = Math.atan2(-92, -105);
  const rp = 13,
    xp = Math.cos(angleTour) * rp,
    zp = Math.sin(angleTour) * rp;
  const porte = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.6), lueur(0xff6a1a, 2.6));
  porte.position.set(xp, hauteur(xp, zp) + 1.2, zp);
  porte.lookAt(xp * 3, hauteur(xp, zp) + 1.2, zp * 3);
  scene.add(porte);

  // La chaussée de Barad-dûr jusqu'à la porte.
  const chaussee: THREE.Vector3[] = [];
  for (let t = 0; t <= 1; t += 0.02) {
    const x = THREE.MathUtils.lerp(-98, xp * 1.15, t),
      z = THREE.MathUtils.lerp(-85, zp * 1.15, t) + Math.sin(t * Math.PI) * 6;
    chaussee.push(new THREE.Vector3(x, Math.max(hauteur(x, z), 0) + 0.6, z));
  }
  const route = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(chaussee), 120, 0.9, 4), PIERRE);
  route.scale.y = 0.6;
  scene.add(route);

  // Barad-dûr et l'Œil.
  const oeil = textureOeil();
  const bd = baradDur(oeil);
  scene.add(bd.tour, bd.sprite, bd.lumiere);

  // Particules.
  const disque = textureDisque();
  const fumee = particules({
    max: 900,
    actives: 380,
    texture: disque,
    additif: false,
    vie: [9, 16],
    taille: [7, 16],
    opacite: 0.42,
    naitre: (pos, v, i, r) => {
      const a = r() * 6.283,
        d = r() * RC * 0.8;
      pos.set([Math.cos(a) * d, H - 1 + r() * 2, Math.sin(a) * d], i * 3);
      v.set([(r() - 0.5) * 0.6 + 0.9, 2.2 + r() * 1.6, (r() - 0.5) * 0.6 + 0.35], i * 3);
    },
    couleur: (y) => {
      const f = Math.max(0, 1 - (y - H) / 16);
      return [0.06 + 0.28 * f * f * f, 0.045 + 0.06 * f * f * f, 0.04 + 0.01 * f];
    },
  });
  const braises = particules({
    max: 420,
    actives: 260,
    texture: disque,
    additif: true,
    vie: [2, 5],
    taille: [0.12, 0.3],
    opacite: 1,
    monte: -0.9,
    naitre: (pos, v, i, r) => {
      const a = r() * 6.283,
        d = r() * RC;
      pos.set([Math.cos(a) * d, H - 2, Math.sin(a) * d], i * 3);
      v.set([(r() - 0.5) * 5, 5 + r() * 7, (r() - 0.5) * 5], i * 3);
    },
    couleur: (_y, l) => [1, 0.55 - l * 0.35, 0.15 - l * 0.12],
  });
  const cendre = particules({
    max: 700,
    actives: 700,
    texture: disque,
    additif: false,
    vie: [10, 20],
    taille: [0.08, 0.2],
    opacite: 0.6,
    naitre: (pos, v, i, r) => {
      pos.set([(r() - 0.5) * 160, 2 + r() * 50, (r() - 0.5) * 160], i * 3);
      v.set([0.9 + r() * 0.6, -0.4 - r() * 0.4, 0.2 + r() * 0.3], i * 3);
    },
    couleur: () => [0.32, 0.28, 0.26],
  });
  // Fumée des bouches à cendres et des cheminées de forge (une source par niveau bâti).
  const sources: { x: number; y: number; z: number }[] = [];
  const fumeeOuvrages = particules({
    max: 520,
    actives: 0,
    texture: disque,
    additif: false,
    vie: [5, 9],
    taille: [3, 7],
    opacite: 0.4,
    naitre: (pos, v, i, r) => {
      const s = sources.length ? sources[Math.floor(r() * sources.length)]! : { x: 0, y: -50, z: 0 };
      pos.set([s.x + (r() - 0.5), s.y, s.z + (r() - 0.5)], i * 3);
      v.set([0.7 + r() * 0.5, 1.6 + r() * 1.2, 0.3 + (r() - 0.5) * 0.4], i * 3);
    },
    couleur: () => [0.11, 0.085, 0.075],
  });
  const pointGerbe = new THREE.Vector3(0, -50, 0);
  const gerbe = particules({
    max: 300,
    actives: 0,
    texture: disque,
    additif: true,
    vie: [1.2, 2.6],
    taille: [0.12, 0.3],
    opacite: 1,
    monte: -6,
    naitre: (pos, v, i, r) => {
      pos.set([pointGerbe.x, pointGerbe.y, pointGerbe.z], i * 3);
      const a = r() * 6.283;
      v.set([Math.cos(a) * (2 + r() * 6), 6 + r() * 10, Math.sin(a) * (2 + r() * 6)], i * 3);
    },
    couleur: (_y, l) => [1, 0.7 - l * 0.4, 0.25 - l * 0.2],
  });
  let gerbeRestante = 0;
  for (const s of [fumee, braises, cendre, fumeeOuvrages, gerbe]) scene.add(s.points);

  // Les ouvrages.
  const fantome = new THREE.MeshStandardMaterial({ color: 0x8c6a3f, transparent: true, opacity: 0.12, depthWrite: false, roughness: 1, emissive: 0x3a2a18 });
  const aretes = new THREE.LineBasicMaterial({ color: 0xc9a46a, transparent: true, opacity: 0.35 });
  const aretesVives = new THREE.LineBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.85 });
  const defs = { forges: forges(), cendres: cendres(), ecuries: ecuries(), chambre: bd.chambre };
  const ouvrages: Ouvrage3D[] = (Object.keys(defs) as IdOuvrage[]).map((id) => {
    const d = defs[id];
    const boite = new THREE.Box3().setFromObject(d.groupe);
    const taille = boite.getSize(new THREE.Vector3()).addScalar(3);
    const centre = boite.getCenter(new THREE.Vector3());
    const zone = new THREE.Mesh(new THREE.BoxGeometry(taille.x, taille.y, taille.z), new THREE.MeshBasicMaterial({ visible: false }));
    zone.position.copy(centre);
    zone.userData.ouvrage = id;
    scene.add(d.groupe, zone);
    // mémorise le matériau d'origine et prépare les arêtes de chantier
    for (const e of d.etages)
      for (const c of e.corps) {
        const m = c as THREE.Mesh;
        m.userData.materiau = m.material;
        const l = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 30), aretes);
        l.userData.arete = true;
        m.add(l);
      }
    return { id, ...d, zone, niveau: -1 };
  });

  const appliquerNiveau = (o: Ouvrage3D, survole: boolean) => {
    o.etages.forEach((e, i) => {
      const bati = i < o.niveau;
      for (const c of e.corps) {
        const m = c as THREE.Mesh;
        m.material = bati ? m.userData.materiau : fantome;
        for (const enfant of m.children) {
          if (!enfant.userData.arete) continue;
          enfant.visible = !bati || survole;
          (enfant as THREE.LineSegments).material = survole ? aretesVives : aretes;
        }
      }
      for (const f of e.feux) f.visible = bati;
      if (e.lumiere) e.lumiere.userData.cible = bati ? (o.id === 'chambre' ? 60 : 45) : 0;
    });
  };

  let survole: IdOuvrage | null = null;
  let niveauxCourants: Record<IdOuvrage, number> = { forges: 0, cendres: 0, ecuries: 0, chambre: 0 };

  const majSources = () => {
    sources.length = 0;
    const f = defs.forges,
      c = defs.cendres;
    f.etages.slice(0, niveauxCourants.forges).forEach((e) => {
      const b = e.feux[0]!.getWorldPosition(new THREE.Vector3());
      sources.push({ x: b.x, y: b.y + 0.4, z: b.z });
    });
    c.etages.slice(0, niveauxCourants.cendres).forEach((e) => {
      const b = e.feux[0]!.getWorldPosition(new THREE.Vector3());
      sources.push({ x: b.x, y: b.y + 0.4, z: b.z }, { x: b.x, y: b.y + 0.4, z: b.z });
    });
    fumeeOuvrages.actives = Math.min(520, sources.length * 70);
    // le Voile épaissit le panache du cratère
    fumee.actives = Math.min(900, 380 + niveauxCourants.cendres * 240);
  };

  // Caméra : orbite lente, glisser pour tourner, molette pour approcher.
  const controles = new OrbitControls(camera, cv);
  controles.target.set(-14, 14, -8);
  controles.enableDamping = true;
  controles.dampingFactor = 0.06;
  controles.enablePan = false;
  controles.minDistance = 22;
  controles.maxDistance = 190;
  controles.minPolarAngle = 0.35;
  controles.maxPolarAngle = 1.42;
  const calme = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  controles.autoRotate = !calme;
  controles.autoRotateSpeed = 0.18;
  let visee: { cible: THREE.Vector3; distance: number } | null = null;
  controles.addEventListener('start', () => (visee = null));

  // Survol et clic.
  const rayon = new THREE.Raycaster();
  const souris = new THREE.Vector2();
  let appui = { x: 0, y: 0 };
  const sous = (e: PointerEvent): IdOuvrage | null => {
    const r = cv.getBoundingClientRect();
    souris.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    rayon.setFromCamera(souris, camera);
    const t = rayon.intersectObjects(ouvrages.map((o) => o.zone))[0];
    return (t?.object.userData.ouvrage as IdOuvrage) ?? null;
  };
  const surSurvol = (id: IdOuvrage | null) => {
    if (id === survole) return;
    const avant = ouvrages.find((o) => o.id === survole);
    survole = id;
    if (avant) appliquerNiveau(avant, false);
    const o = ouvrages.find((x) => x.id === id);
    if (o) appliquerNiveau(o, true);
    cv.style.cursor = id ? 'var(--curseur-anneau-feu)' : 'grab';
    rappels.survol(id);
  };
  const bouge = (e: PointerEvent) => surSurvol(sous(e));
  const baisse = (e: PointerEvent) => (appui = { x: e.clientX, y: e.clientY });
  const leve = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - appui.x, e.clientY - appui.y) > 5) return; // c'était un glisser
    const id = sous(e);
    if (id) rappels.choix(id);
  };
  cv.addEventListener('pointermove', bouge);
  cv.addEventListener('pointerdown', baisse);
  cv.addEventListener('pointerup', leve);
  cv.style.cursor = 'grab';

  // Rendu, avec un halo (bloom) sur ce qui brûle.
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.45, 0.88);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const taille = () => {
    const w = cv.clientWidth || window.innerWidth,
      h = cv.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.resolution.set(w / 2, h / 2);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    for (const s of [fumee, braises, cendre, fumeeOuvrages, gerbe]) (s.points.material as THREE.ShaderMaterial).uniforms.uEchelle!.value = h * 0.9;
  };
  const obs = new ResizeObserver(taille);
  obs.observe(cv);
  taille();

  const projete = new THREE.Vector3();
  const horloge = new THREE.Clock();
  let raf = 0,
    t = 0,
    flamme = 0;
  const image = () => {
    const dt = Math.min(0.05, horloge.getDelta());
    t += dt;
    (dome.material as THREE.ShaderMaterial).uniforms.uT!.value = t;
    // le feu respire
    const souffle = 0.82 + 0.18 * Math.sin(t * 1.3) + 0.08 * Math.sin(t * 3.7);
    flamme = Math.max(0, flamme - dt * 0.8);
    cratere.intensity = 900 * souffle * (1 + flamme * 1.5);
    (sol.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.65 + 0.15 * Math.sin(t * 0.7) + flamme * 0.5;
    for (const c of coulees) c.color.setRGB(1.5, 0.42 + 0.12 * Math.sin(t * 2), 0.08);
    bd.sprite.scale.set(10 * (1 + 0.04 * Math.sin(t * 2.1)) * (niveauxCourants.chambre ? 1.25 : 1), 5 * (niveauxCourants.chambre ? 1.25 : 1), 1);
    for (const o of ouvrages)
      for (const e of o.etages)
        if (e.lumiere) {
          const cible = (e.lumiere.userData.cible as number) ?? 0;
          e.lumiere.intensity += (cible * (0.85 + 0.15 * Math.sin(t * 5 + e.lumiere.id)) - e.lumiere.intensity) * Math.min(1, dt * 4);
        }
    if (gerbeRestante > 0) {
      gerbeRestante -= dt;
      gerbe.actives = 300;
    } else gerbe.actives = 0;
    for (const s of [fumee, braises, cendre, fumeeOuvrages, gerbe]) s.maj(dt, t);

    if (visee) {
      controles.target.lerp(visee.cible, Math.min(1, dt * 2.2));
      const d = camera.position.distanceTo(controles.target);
      const vers = camera.position.clone().sub(controles.target).normalize();
      camera.position.copy(controles.target).addScaledVector(vers, d + (visee.distance - d) * Math.min(1, dt * 2));
    }
    controles.update(dt);
    composer.render(dt);

    // étiquettes HTML accrochées aux ouvrages
    const w = cv.clientWidth,
      h = cv.clientHeight;
    for (const o of ouvrages) {
      const el = etiquettes[o.id];
      if (!el) continue;
      projete.copy(o.ancre).project(camera);
      const devant = projete.z < 1;
      el.style.opacity = devant ? '' : '0';
      el.style.transform = `translate(${((projete.x + 1) / 2) * w}px, ${((1 - projete.y) / 2) * h}px) translate(-50%, -100%)`;
    }
    raf = requestAnimationFrame(image);
  };
  raf = requestAnimationFrame(image);

  return {
    niveaux(n) {
      niveauxCourants = { ...n };
      for (const o of ouvrages) {
        o.niveau = n[o.id] ?? 0;
        appliquerNiveau(o, o.id === survole);
      }
      majSources();
    },
    viser(id) {
      const o = ouvrages.find((x) => x.id === id);
      visee = o ? o.vue : { cible: new THREE.Vector3(-14, 14, -8), distance: 115 };
    },
    celebrer(id) {
      const o = ouvrages.find((x) => x.id === id);
      if (!o) return;
      const e = o.etages[Math.max(0, o.niveau - 1)];
      (e?.feux[0] ?? o.zone).getWorldPosition(pointGerbe);
      gerbeRestante = 0.6;
      flamme = 1;
    },
    detruire() {
      cancelAnimationFrame(raf);
      obs.disconnect();
      cv.removeEventListener('pointermove', bouge);
      cv.removeEventListener('pointerdown', baisse);
      cv.removeEventListener('pointerup', leve);
      controles.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      for (const tx of [crevasses, disque, oeil]) tx.dispose();
      composer.dispose();
      renderer.dispose();
    },
  };
}
