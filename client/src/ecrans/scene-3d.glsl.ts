/**
 * L'écran titre en 3D, par lancer de rayons sur des champs de distance
 * (raymarching), dans un seul shader plein écran :
 *
 * - Barad-dûr modélisée : six gradins octogonaux qui s'effilent, corniches,
 *   créneaux, contreforts en lame, la flèche et les deux cornes qui tiennent
 *   l'Œil, sur un éperon rocheux ;
 * - la lumière : le rougeoiement de la plaine devant la Tour (lumière
 *   principale, chaude), le ciel embrasé derrière elle (contre-jour), et l'Œil
 *   lui-même, lumière ponctuelle avec ombres douces ;
 * - des centaines de feux aux meurtrières et le long des corniches ;
 * - un ciel d'orage rouge et noir, une trouée de feu derrière la Tour, la
 *   chaîne de l'Ephel Dúath ; brume de chaleur et brouillard au sol ;
 * - la diffusion de la lumière de l'Œil dans l'air (halo volumétrique) ;
 * - l'Œil, posé face à la caméra, dont la pupille suit la souris ;
 * - des Nazgûl sur leurs montures ailées qui tournent autour de la Tour.
 *
 * La caméra (position, axes, focale) est calculée en JavaScript, qui s'en sert
 * aussi pour savoir où l'Œil se trouve à l'écran.
 */

export const SOMMETS_3D = /* glsl */ `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

export const FRAGMENTS_3D = /* glsl */ `#version 300 es
precision highp float;

uniform vec2 u_res;
uniform float u_t;
uniform vec3 u_ro;       // position de la caméra
uniform vec3 u_cw;       // axe de visée
uniform vec3 u_cu;       // droite
uniform vec3 u_cv;       // haut
uniform float u_focale;
uniform float u_decalage; // décalage horizontal de l'image (la Tour à droite du menu), en hauteurs d'écran
uniform vec2 u_regard;
uniform float u_pupille;
uniform float u_eclat;
uniform float u_gauche;

out vec4 sortie;

const vec3 OEIL = vec3(0.0, 11.35, 0.0);
const float TAILLE_OEIL = 1.25;
const float PI = 3.14159265;

/* ------------------------------------------------------------------ bruit */
float h21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float bruit(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y);
}
const mat2 ROT = mat2(0.8, 0.6, -0.6, 0.8);
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * bruit(p); p = ROT * p * 2.02 + 17.1; a *= 0.5; }
  return s / 0.96875;
}
float fbm3(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { s += a * bruit(p); p = ROT * p * 2.03 + 11.7; a *= 0.5; }
  return s / 0.875;
}

vec3 feu(float x) {
  x = max(x, 0.0);
  return vec3(1.55 * x, 0.95 * pow(x, 2.1), 0.75 * pow(x, 4.5)) * smoothstep(0.0, 0.25, x);
}
vec3 iris(float x) {
  x = clamp(x, 0.0, 1.0);
  vec3 c = mix(vec3(0.05, 0.0, 0.0), vec3(0.55, 0.03, 0.0), smoothstep(0.0, 0.25, x));
  c = mix(c, vec3(1.0, 0.25, 0.0), smoothstep(0.2, 0.5, x));
  c = mix(c, vec3(1.0, 0.62, 0.08), smoothstep(0.45, 0.75, x));
  c = mix(c, vec3(1.0, 0.92, 0.55), smoothstep(0.75, 1.0, x));
  return c * (0.6 + 0.9 * x);
}

/* ------------------------------------------------------------------ formes */
// octogone (dans le plan xz) de demi-largeur w
float octo(vec2 p, float w) {
  p = abs(p);
  return max(max(p.x, p.y), (p.x + p.y) * 0.70710678) - w;
}
// repli angulaire : n secteurs, renvoie le point ramené dans le premier
vec2 replier(vec2 p, float n) {
  float s = 2.0 * PI / n;
  float a = atan(p.y, p.x);
  a = mod(a + s * 0.5, s) - s * 0.5;
  return length(p) * vec2(cos(a), sin(a));
}
float boite(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

// Les gradins : bas, haut, demi-largeur en bas, en haut.
const int N = 6;
const vec4 GRADINS[6] = vec4[6](
  vec4(0.0, 2.4, 1.9, 1.72),
  vec4(2.4, 4.5, 1.42, 1.3),
  vec4(4.5, 6.3, 1.1, 1.0),
  vec4(6.3, 7.8, 0.86, 0.78),
  vec4(7.8, 8.9, 0.68, 0.6),
  vec4(8.9, 9.6, 0.52, 0.46)
);

// matériau : 0 roche, 1 pierre de la Tour, 2 sol
float tour(vec3 p, out float mat) {
  mat = 1.0;
  float d = 1e5;
  vec2 pr = replier(p.xz, 8.0); // un huitième de la Tour, axe le long de x
  vec2 p16 = replier(p.xz, 16.0);
  vec2 pc = replier(p.xz, 40.0);
  for (int i = 0; i < N; i++) {
    vec4 g = GRADINS[i];
    float h = (g.y - g.x) * 0.5;
    float yc = g.x + h;
    float s = clamp((p.y - g.x) / (g.y - g.x), 0.0, 1.0);
    float w = mix(g.z, g.w, s);
    float corps = max(octo(p.xz, w), abs(p.y - yc) - h);
    // cannelures : une rainure verticale au milieu de chaque face et à chaque angle
    if (i > 0) corps = max(corps, -max(abs(p16.y) - 0.035, (w - 0.08) - p16.x));
    // corniche
    float corn = max(octo(p.xz, g.w + 0.14), abs(p.y - g.y + 0.06) - 0.08);
    // créneaux sur la corniche
    float cren = max(boite(vec3(pc.x - g.w - 0.08, p.y - g.y - 0.12, pc.y), vec3(0.06, 0.1, 0.045)), -1.0);
    // contreforts en lame, sur les huit angles, qui montent vers l'extérieur
    float sb = clamp((p.y - g.x) / (g.y - g.x + 0.6), 0.0, 1.0);
    vec3 pl = vec3(pr.x - (w + 0.05 + 0.45 * sb), p.y - (g.x + (g.y - g.x + 0.6) * 0.5), pr.y);
    float lame = boite(pl, vec3(0.13 + 0.22 * (1.0 - sb), (g.y - g.x + 0.6) * 0.5, 0.05));
    lame = max(lame, (p.y - g.y - 0.55) + (pr.x - w) * 0.6); // biseau en pointe
    d = min(d, min(min(corps, corn), min(cren, lame)));
  }
  // des cannelures verticales sur chaque face (sauf le premier gradin)
  // la forteresse au pied : un rempart et huit tourelles
  float rempart = max(octo(p.xz, 3.3), abs(p.y - 0.7) - 0.9);
  rempart = max(rempart, -max(octo(p.xz, 3.05), p.y - 1.4)); // chemin de ronde creux
  vec2 pt = replier(p.xz, 8.0);
  float tourelle = max(length(vec2(pt.x - 3.3, pt.y)) - 0.42, abs(p.y - 1.25) - 1.25);
  // couronne de pointes au sommet des tourelles
  vec2 pp = replier(vec2(pt.x - 3.3, pt.y), 6.0);
  float pointe = max(length(vec2(pp.x - 0.36, pp.y)) - 0.07 * clamp((3.25 - p.y) / 0.75, 0.0, 1.0), abs(p.y - 2.87) - 0.38);
  float toit = pointe;
  d = min(d, min(rempart, min(tourelle, toit)));
  // le cœur, entre les cornes, et la flèche
  float s = clamp((p.y - 9.6) / 1.2, 0.0, 1.0);
  d = min(d, max(octo(p.xz, mix(0.5, 0.25, s)), abs(p.y - 10.2) - 0.6));
  d = min(d, max(length(p.xz) - 0.14 * (1.0 - clamp((p.y - 10.6) / 0.9, 0.0, 1.0)), abs(p.y - 11.05) - 0.45));
  // les cornes : deux lames courbes, aplaties en z
  float sc = (p.y - 9.4) / 3.9;
  if (sc > -0.05 && sc < 1.05) {
    float u = clamp(sc, 0.0, 1.0);
    float xc = 0.4 + 1.75 * pow(u, 0.6) - 0.35 * u * u;
    float ep = 0.24 * pow(1.0 - u, 0.9) + 0.02;
    float ez = 0.2 * (1.0 - u) + 0.03;
    float corne = max(max(abs(abs(p.x) - xc) - ep, abs(p.z) - ez), abs(p.y - (9.4 + 1.95)) - 1.95);
    d = min(d, corne * 0.55);
  }
  // l'éperon rocheux
  float r2 = dot(p.xz, p.xz);
  float roc = p.y - ((1.75 + 0.5 * fbm3(p.xz * 0.45)) * exp(-r2 / 13.0) - 0.35);
  if (roc < d) { d = roc; mat = 0.0; }
  // la plaine
  float sol = p.y + 0.35;
  if (sol < d) { d = sol; mat = 2.0; }
  return d;
}
float scene(vec3 p) { float m; return tour(p, m); }

vec3 normale(vec3 p) {
  const vec2 k = vec2(1.0, -1.0) * 0.004;
  return normalize(k.xyy * scene(p + k.xyy) + k.yyx * scene(p + k.yyx) + k.yxy * scene(p + k.yxy) + k.xxx * scene(p + k.xxx));
}

float ombre(vec3 ro, vec3 rd, float tmax) {
  float r = 1.0, t = 0.05;
  for (int i = 0; i < 28; i++) {
    float h = scene(ro + rd * t);
    r = min(r, 10.0 * h / t);
    t += clamp(h, 0.04, 0.6);
    if (r < 0.01 || t > tmax) break;
  }
  return clamp(r, 0.0, 1.0);
}

/* ------------------------------------------------------------------ le ciel */
// La trouée de feu, derrière la Tour (direction, vue d'ici)
vec3 ciel(vec3 rd, float t) {
  vec2 c = rd.xy / max(rd.z, 0.05);          // repère du ciel, comme un plan au loin
  vec2 trouee = vec2(0.08, 0.3);
  float dt = length((c - trouee) * vec2(0.75, 1.5));
  vec2 nu = c * vec2(1.7, 3.4) + vec2(t * 0.012, 0.0);
  vec2 dw = vec2(fbm(nu * 1.2 + vec2(0.0, t * 0.015)), fbm(nu * 1.2 + vec2(5.2, -t * 0.01)));
  float n = fbm(nu * 1.6 + dw * 2.2);
  float n2 = fbm3(nu * 4.5 + dw * 3.0 - t * 0.02);
  // fond rouge sang, plus clair vers l'horizon et dans la trouée
  vec3 fond = mix(vec3(0.22, 0.025, 0.008), vec3(0.05, 0.006, 0.003), smoothstep(0.0, 0.6, c.y));
  fond += vec3(1.0, 0.3, 0.04) * exp(-dt * 3.8) * 0.75 + vec3(1.0, 0.6, 0.2) * exp(-dt * 10.0) * 0.7;
  // nuages noirs, épais, dont les bords s'allument face à la trouée
  float masse = smoothstep(0.36, 0.5, n + 0.08 * (n2 - 0.5)) * (1.0 - 0.6 * exp(-dt * 5.0));
  vec3 nuage = vec3(0.018, 0.005, 0.004) * (0.5 + 0.9 * n2);
  float lisere = smoothstep(0.32, 0.4, n) * (1.0 - smoothstep(0.4, 0.55, n));
  nuage += vec3(1.0, 0.3, 0.05) * lisere * (exp(-dt * 2.0) * 1.3 + 0.08);
  nuage += vec3(0.5, 0.06, 0.01) * (1.0 - masse * 0.5) * 0.15;
  vec3 col = mix(fond, nuage, masse * 0.94);
  // la chaîne de montagnes à l'horizon
  float az = atan(rd.x, rd.z);
  float crete = 0.03 + 0.05 * fbm(vec2(az * 3.0 + 2.0, 0.5)) + 0.02 * fbm3(vec2(az * 14.0, 1.0));
  if (rd.y < crete) {
    col = vec3(0.02, 0.008, 0.006) + vec3(0.6, 0.12, 0.02) * exp(-(crete - rd.y) * 60.0) * 0.4;
  }
  return col;
}

/* ------------------------------------------------------------------ l'Œil */
vec4 oeil(vec2 e, float t) {
  float B = 0.40;
  float ax = abs(e.x);
  float d = ax < 1.0 ? abs(e.y) - B * pow(max(1.0 - ax * ax, 0.0), 0.72) : length(vec2(ax - 1.0, e.y));
  vec2 pc = u_regard * vec2(0.30, 0.11);
  float eclat = 1.0 + 0.55 * u_eclat;
  vec3 c = vec3(0.0);
  float a = 0.0;
  if (d < 0.0) {
    vec2 v = (e - pc) * vec2(1.0, 1.85);
    float r = length(v);
    float an = atan(v.y, v.x);
    vec2 cercle = vec2(cos(an), sin(an));
    float fib = fbm(cercle * 2.6 + vec2(r * 4.2 - t * 1.25, -r * 2.0 + t * 0.35));
    float fib2 = fbm3(cercle * 7.0 + vec2(r * 9.0 - t * 2.1, 3.0));
    float remous = fbm3(e * 6.5 + vec2(t * 0.35, -t * 0.6));
    float chaleur = 1.18 - 1.05 * r + 1.35 * (fib - 0.5) + 0.55 * (fib2 - 0.5) + 0.45 * (remous - 0.5);
    chaleur *= 0.3 + 0.7 * smoothstep(0.0, 0.13, -d);
    chaleur *= eclat;
    c = iris(chaleur * 0.85) * 1.6;
    float ph = B * 1.06;
    float yy = (e.y - pc.y) / ph;
    float demi = u_pupille * sqrt(max(0.0, 1.0 - yy * yy));
    float dp = abs(e.x - pc.x) - demi;
    float dedans = 1.0 - smoothstep(-0.012, 0.012, dp);
    c *= 1.0 - dedans;
    c += vec3(1.0, 0.55, 0.15) * exp(-max(dp, 0.0) * 30.0) * 0.9 * (1.0 - dedans) * step(abs(yy), 1.0);
    a = 1.0;
  }
  if (d >= 0.0 && d < 1.4) {
    float haut = smoothstep(-0.15, 0.55, e.y);
    float L = mix(0.11, 0.6, haut) * (1.0 - 0.35 * smoothstep(0.6, 1.3, ax)) + 0.04;
    vec2 fp = vec2(e.x * 3.6, e.y * 1.9 - t * 2.3);
    float w = fbm3(fp * 1.3 + vec2(0.0, t * 0.5));
    float n = fbm(fp + vec2(w * 1.3, 0.0));
    float langues = pow(1.0 - abs(fbm3(vec2(e.x * 6.0 + w, e.y * 2.0 - t * 3.0)) * 2.0 - 1.0), 3.0);
    float I = (n * 2.3 - 0.7 + 0.5 * langues) * eclat - d / L + 0.95 * exp(-d / 0.04);
    if (d < 0.03) I *= 0.05 + 0.95 * d / 0.03;
    c = iris(I * 0.8) * smoothstep(0.0, 0.35, I) * 1.6;
    a = clamp(I * 2.0, 0.0, 1.0);
  }
  return vec4(c, a);
}

/* ------------------------------------------------------------------ les Nazgûl ailés */
// silhouette d'une bête ailée, centrée en 0, envergure ~1 ; renvoie la couverture
float bete(vec2 p, float battement) {
  float corps = length(p * vec2(4.5, 9.0)) - 0.32;
  float cou = length((p - vec2(0.13, 0.03)) * vec2(8.0, 18.0)) - 0.5;
  float queue = length((p + vec2(0.2, 0.01)) * vec2(5.0, 22.0)) - 0.5;
  // les ailes : deux triangles courbes dont la pointe monte et descend
  float aile = 1e5;
  for (int s = 0; s < 2; s++) {
    float sg = s == 0 ? 1.0 : -1.0;
    vec2 q = vec2(p.x * 1.4, p.y);
    vec2 bout = vec2(sg * 0.15, 0.06 + 0.32 * battement) ;
    vec2 pt = vec2(-0.05, 0.0);
    // aile = zone entre l'épaule et le bout, amincie vers le bout
    vec2 axe = vec2(sg * 0.5, 0.0) + vec2(0.0, battement * 0.45);
    vec2 r = q - pt;
    float u = clamp(dot(r, axe) / dot(axe, axe), 0.0, 1.0);
    float dist = length(r - axe * u);
    float ep = 0.075 * (1.0 - u) + 0.01;
    // bord de fuite échancré
    ep *= 1.0 - 0.35 * smoothstep(0.4, 0.5, fract(u * 3.0)) * u;
    aile = min(aile, dist - ep);
  }
  float d = min(min(corps, min(cou, queue)) * 0.05, aile);
  return 1.0 - smoothstep(-0.006, 0.006, d);
}

vec3 betes(vec2 ecr, float t, vec3 col) {
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float vit = 0.05 + fi * 0.017;
    float ph = t * vit + fi * 2.1;
    // grandes boucles autour de la Tour, plus ou moins loin
    vec2 c = vec2(u_decalage + sin(ph) * (0.35 + fi * 0.1), 0.18 + 0.12 * fi + 0.06 * sin(ph * 1.7 + fi));
    float taille = 0.055 + 0.025 * cos(ph) - fi * 0.008;
    vec2 p = (ecr - c) / taille;
    p.x *= cos(ph) > 0.0 ? 1.0 : -1.0; // de face dans le sens du vol
    float b = sin(t * (3.0 + fi * 0.6) + fi * 4.0);
    float m = bete(p, b);
    col = mix(col, vec3(0.012, 0.006, 0.006), m * 0.94);
  }
  return col;
}

/* ------------------------------------------------------------------ braises */
vec3 braises(vec2 q, float t) {
  vec3 c = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float s = 16.0 + fi * 11.0;
    vec2 p = q * s + vec2(sin(t * 0.25 + fi * 2.0 + q.y * 3.0) * 1.3, -t * (0.9 + fi * 0.45));
    vec2 cel = floor(p);
    vec2 f = fract(p) - 0.5;
    float h = h21(cel + fi * 7.3);
    if (h > 0.84) {
      vec2 pos = (vec2(h21(cel + 1.7), h21(cel + 4.1)) - 0.5) * 0.6;
      float dd = length(f - pos);
      float vie = 0.5 + 0.5 * sin(t * (2.0 + h * 5.0) + h * 40.0);
      c += vec3(1.0, 0.42, 0.12) * smoothstep(0.07 - fi * 0.015, 0.0, dd) * vie * (1.2 - fi * 0.3);
    }
  }
  return c;
}

void main() {
  vec2 px = gl_FragCoord.xy;
  vec2 ecran = px / u_res;
  vec2 uv = (px - 0.5 * u_res) / u_res.y;
  vec2 uvc = uv - vec2(u_decalage, 0.0);
  float t = u_t;
  vec3 ro = u_ro;
  vec3 rd = normalize(uvc.x * u_cu + uvc.y * u_cv + u_focale * u_cw);

  float lumOeil = (1.0 + 0.7 * u_eclat) * (0.9 + 0.1 * sin(t * 2.3) * sin(t * 1.7));
  // lumière principale : le rougeoiement de la plaine, devant et un peu à gauche
  vec3 Lp = normalize(vec3(-0.45, 0.3, -1.0));
  vec3 Cp = vec3(1.0, 0.42, 0.12) * 1.15;

  /* --- la marche du rayon --- */
  float tt = 0.0;
  float mat = -1.0;
  bool touche = false;
  // Le rayon passe-t-il près de la Tour (cylindre englobant) ? Sinon, pas besoin de marcher.
  vec2 oc = ro.xz;
  float qa = dot(rd.xz, rd.xz), qb = dot(oc, rd.xz), qc = dot(oc, oc) - 8.0 * 8.0;
  float disc = qb * qb - qa * qc;
  bool proche = false;
  if (disc > 0.0) {
    float t0 = (-qb - sqrt(disc)) / qa;
    float t1 = (-qb + sqrt(disc)) / qa;
    float y0 = ro.y + rd.y * max(t0, 0.0), y1 = ro.y + rd.y * t1;
    proche = t1 > 0.0 && min(y0, y1) < 14.5;
    if (proche) tt = max(t0, 0.0);
  }
  if (!proche) {
    if (rd.y < 0.0) { tt = (-0.35 - ro.y) / rd.y; touche = true; mat = 2.0; }
  }
  for (int i = 0; i < 140; i++) {
    if (!proche) break;
    vec3 p = ro + rd * tt;
    float m;
    float d = tour(p, m);
    if (d < 0.0015 * tt) { touche = true; mat = m; break; }
    tt += d * 0.8;
    if (tt > 120.0) break;
  }
  // passé près de la Tour sans rien toucher : la plaine au loin, ou le ciel
  if (!touche && rd.y < 0.0) { tt = (-0.35 - ro.y) / rd.y; touche = true; mat = 2.0; }

  vec3 col;
  if (touche) {
    vec3 p = ro + rd * tt;
    vec3 n = normale(p);
    // grain de la pierre (relief simulé par la texture)
    float g = fbm3(vec2(p.x + p.z, p.y) * 3.0) * 0.6 + fbm3(vec2(p.x - p.z, p.y * 2.0) * 9.0) * 0.4;
    vec3 alb = mat == 2.0 ? vec3(0.018, 0.013, 0.012) : mat == 0.0 ? vec3(0.03, 0.022, 0.02) : vec3(0.045, 0.034, 0.03);
    alb *= 0.55 + 0.9 * g;
    // lumière de la plaine
    float dif = max(dot(n, Lp), 0.0);
    float omb = dif > 0.0 ? ombre(p + n * 0.02, Lp, 20.0) : 0.0;
    col = alb * Cp * dif * (0.15 + 0.85 * omb) * 2.3;
    vec3 hv = normalize(Lp - rd);
    col += Cp * pow(max(dot(n, hv), 0.0), 24.0) * 0.22 * omb * (mat == 1.0 ? 1.0 : 0.3);
    // l'Œil, lumière ponctuelle
    vec3 lo = OEIL - p;
    float dl = length(lo);
    lo /= dl;
    float difO = max(dot(n, lo), 0.0);
    float ombO = difO > 0.0 ? ombre(p + n * 0.02, lo, dl - 0.8) : 0.0;
    vec3 Co = vec3(1.0, 0.35, 0.06) * 26.0 * lumOeil / (dl * dl + 1.0);
    col += alb * Co * difO * ombO * 1.5 + Co * pow(max(dot(n, normalize(lo - rd)), 0.0), 30.0) * 0.12 * ombO;
    // contre-jour : le ciel embrasé derrière
    float rim = pow(1.0 - max(dot(n, -rd), 0.0), 4.0);
    col += vec3(1.0, 0.28, 0.05) * rim * 0.12 * smoothstep(-0.2, 0.6, n.y + 0.3);
    // ambiance, et rebond rouge depuis le sol
    col += alb * (vec3(0.12, 0.025, 0.01) * (0.5 + 0.5 * n.y) + vec3(0.8, 0.15, 0.03) * max(-n.y, 0.0) * 0.6);
    // les feux de la Tour : meurtrières et lanternes sur les corniches
    if (mat == 1.0 && p.y < 9.7) {
      float ang = atan(p.z, p.x);
      vec2 cel = vec2(floor(ang * 9.0), floor(p.y * 3.2));
      vec2 f = vec2(fract(ang * 9.0), fract(p.y * 3.2));
      float h = h21(cel);
      float vacille = 0.6 + 0.4 * sin(t * (2.0 + h * 5.0) + h * 30.0);
      if (h > 0.86) col += vec3(1.0, 0.55, 0.18) * smoothstep(0.18, 0.04, abs(f.x - 0.5)) * smoothstep(0.32, 0.12, abs(f.y - 0.5)) * vacille * 2.2;
      // le long des corniches, des feux en rang
      for (int i = 0; i < N; i++) {
        float y1 = GRADINS[i].y;
        if (abs(p.y - (y1 + 0.02)) < 0.07) {
          float rang = fract(ang * 26.0);
          col += vec3(1.0, 0.6, 0.2) * smoothstep(0.2, 0.0, abs(rang - 0.5)) * step(0.35, h21(vec2(floor(ang * 26.0), y1))) * vacille * 1.8;
        }
      }
    }
    // la plaine : crevasses de lave
    if (mat == 2.0) {
      vec2 xz = p.xz * 0.18;
      float fente = 1.0 - abs(fbm3(xz + vec2(0.0, t * 0.02)) * 2.0 - 1.0);
      col += feu(pow(fente, 22.0) * 1.1 * (0.8 + 0.2 * sin(t + p.x))) * smoothstep(30.0, 12.0, tt);
    }
    // brouillard : rouge, plus dense au ras du sol
    float brume = 1.0 - exp(-tt * 0.008 - max(0.0, 1.2 - p.y) * 0.2);
    col = mix(col, vec3(0.12, 0.018, 0.006), brume);
  } else {
    col = ciel(rd, t);
    tt = 200.0;
  }

  /* --- l'Œil, face à la caméra --- */
  vec3 nE = normalize(ro - OEIL);
  vec3 dr = normalize(cross(vec3(0.0, 1.0, 0.0), nE));
  vec3 hautE = cross(nE, dr);
  float tE = dot(OEIL - ro, nE) / dot(rd, nE);
  if (tE > 0.0 && tE < tt + 0.3) {
    vec3 pE = ro + rd * tE - OEIL;
    vec2 e = vec2(dot(pE, -dr), dot(pE, hautE)) / TAILLE_OEIL;
    if (dot(e, e) < 6.0) {
      vec4 o = oeil(e, t);
      col = col * (1.0 - o.a) + o.rgb;
    }
  }

  /* --- la lumière de l'Œil diffusée dans l'air --- */
  vec3 w = OEIL - ro;
  float tca = dot(w, rd);
  float hh = max(length(w - rd * tca), 0.05);
  float tmax = min(tt, 150.0);
  float diff = (atan((tmax - tca) / hh) - atan(-tca / hh)) / hh;
  col += vec3(1.0, 0.3, 0.05) * diff * 0.012 * lumOeil;

  /* --- fumée basse qui traîne au pied de la Tour, éclairée par la lave --- */
  float fum = fbm(uv * vec2(2.2, 7.0) + vec2(t * 0.025, -t * 0.01)) * smoothstep(-0.12, -0.42, uv.y);
  col = mix(col, vec3(0.16, 0.03, 0.01), smoothstep(0.35, 0.8, fum) * 0.55);

  /* --- les bêtes ailées, les braises --- */
  col = betes(uv, t, col);
  col += braises(uv + vec2(0.0, 0.5), t) * 0.8 * (1.0 - 0.7 * u_gauche * smoothstep(0.55, 0.15, ecran.x));

  /* --- finition --- */
  col *= 1.0 - u_gauche * 0.7 * smoothstep(0.6, 0.0, ecran.x);
  vec2 v = ecran - 0.5;
  col *= 1.0 - 0.6 * dot(v, v) * 1.5;
  // ACES (approché)
  col = clamp((col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14), 0.0, 1.0);
  col = pow(col, vec3(1.0 / 1.1));
  col += (h21(px + fract(t) * 91.0) - 0.5) * 0.02;
  sortie = vec4(col, 1.0);
}
`;
