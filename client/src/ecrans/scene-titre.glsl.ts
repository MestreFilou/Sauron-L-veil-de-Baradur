/**
 * Le shader de l'écran titre, calculé par pixel sur un seul triangle plein
 * écran : ciel d'orage éclairé par en dessous, chaîne de l'Ephel Dúath et
 * Orodruin au loin, Barad-dûr en pierre noire (gradins, créneaux, contreforts,
 * cornes), rivières de lave, braises, et l'Œil : un iris de feu qui coule
 * depuis la pupille, une couronne de flammes qui monte, une pupille fendue
 * qui suit la souris.
 *
 * Repère : q = (pixel − pied de la Tour) / hauteur de l'écran. q.y va de 0
 * (bas) à 1 (haut) ; q.x est l'écart à l'axe de la Tour, dans la même unité.
 */

export const SOMMETS = /* glsl */ `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

export const FRAGMENTS = /* glsl */ `#version 300 es
precision highp float;

uniform vec2 u_res;      // taille du canevas, en pixels
uniform float u_t;       // secondes
uniform float u_tx;      // abscisse de l'axe de la Tour, en pixels
uniform vec2 u_regard;   // direction du regard (longueur ≤ 1), repère du shader (y vers le haut)
uniform float u_pupille; // demi-largeur de la fente, en unités de l'amande
uniform float u_eclat;   // embrasement de l'Œil (clic, survol), 0 à 1
uniform float u_gauche;  // assombrissement à gauche, sous le menu (0 à 1)

out vec4 sortie;

const vec2 OEIL = vec2(0.0, 0.705);  // centre de l'Œil
const float TAILLE_OEIL = 0.135;     // demi-largeur de l'amande

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

/* Feu : rouge sombre, orange, jaune, blanc (corps noir approché). */
vec3 feu(float x) {
  x = max(x, 0.0);
  return vec3(1.55 * x, 0.95 * pow(x, 2.1), 0.75 * pow(x, 4.5)) * smoothstep(0.0, 0.25, x);
}

/* L'iris : cramoisi au bord, rouge, orange, jaune puis blanc près de la pupille. */
vec3 iris(float x) {
  x = clamp(x, 0.0, 1.0);
  vec3 c = mix(vec3(0.05, 0.0, 0.0), vec3(0.55, 0.03, 0.0), smoothstep(0.0, 0.25, x));
  c = mix(c, vec3(1.0, 0.25, 0.0), smoothstep(0.2, 0.5, x));
  c = mix(c, vec3(1.0, 0.62, 0.08), smoothstep(0.45, 0.75, x));
  c = mix(c, vec3(1.0, 0.92, 0.55), smoothstep(0.75, 1.0, x));
  return c * (0.6 + 0.9 * x);
}

/* ------------------------------------------------------------------ la Tour */
float gradin(vec2 q, float y0, float y1, float w0, float w1) {
  if (q.y < y0 || q.y > y1 + 0.06) return -1.0;
  float s = clamp((q.y - y0) / (y1 - y0), 0.0, 1.0);
  float w = mix(w0, w1, s);
  float d = w - abs(q.x);
  // corniche en haut du gradin
  if (q.y > y1 - 0.009 && q.y <= y1) d = max(d, w1 + 0.011 - abs(q.x));
  // créneaux pointus au-dessus de la corniche
  if (q.y > y1) {
    float c = fract(q.x / 0.0105);
    float dent = 0.012 * (1.0 - abs(c * 2.0 - 1.0));
    d = (q.y - y1 < dent && abs(q.x) < w1 + 0.009) ? 0.002 : -1.0;
  }
  // contreforts en lame, qui montent vers l'extérieur
  float sb = (q.y - (y1 - 0.03)) / 0.085;
  if (sb > 0.0 && sb < 1.0) {
    float xc = w1 + 0.006 + 0.03 * sb;
    d = max(d, 0.0065 * (1.0 - sb) + 0.0008 - abs(abs(q.x) - xc));
  }
  return d;
}

float corne(vec2 q) {
  float s = (q.y - 0.545) / 0.30;
  if (s < 0.0 || s > 1.0) return -1.0;
  float xc = 0.035 + 0.125 * pow(s, 0.62) - 0.018 * s * s;
  float ep = 0.034 * pow(1.0 - s, 0.85) + 0.0012;
  // arête dentelée sur le dos de la corne
  ep += 0.004 * step(0.5, fract(s * 9.0)) * (1.0 - s);
  return ep - abs(abs(q.x) - xc);
}

/* > 0 dans la pierre, < 0 dans le ciel (unités : hauteur de l'écran). */
float tour(vec2 q) {
  // l'éperon rocheux sous la Tour
  float roc = 0.125 + 0.05 * exp(-pow(q.x / 0.2, 2.0)) - 0.08 * smoothstep(0.15, 0.6, abs(q.x)) + 0.03 * (fbm3(vec2(q.x * 9.0, 2.0)) - 0.5);
  float d = roc - q.y;
  d = max(d, gradin(q, 0.10, 0.215, 0.17, 0.152));
  d = max(d, gradin(q, 0.215, 0.315, 0.128, 0.114));
  d = max(d, gradin(q, 0.315, 0.40, 0.098, 0.088));
  d = max(d, gradin(q, 0.40, 0.47, 0.076, 0.068));
  d = max(d, gradin(q, 0.47, 0.53, 0.058, 0.052));
  // le cœur entre les cornes
  if (q.y > 0.53 && q.y < 0.60) d = max(d, mix(0.046, 0.028, (q.y - 0.53) / 0.07) - abs(q.x));
  // la flèche centrale, sous l'Œil
  if (q.y > 0.59 && q.y < 0.655) d = max(d, 0.011 * (1.0 - (q.y - 0.59) / 0.065) - abs(q.x));
  d = max(d, corne(q));
  return d;
}

/* ------------------------------------------------------------------ l'Œil */
// renvoie la couleur (prémultipliée) et la couverture
vec4 oeil(vec2 e, float t) {
  float B = 0.40;
  float ax = abs(e.x);
  float d = ax < 1.0 ? abs(e.y) - B * pow(max(1.0 - ax * ax, 0.0), 0.72) : length(vec2(ax - 1.0, e.y));
  vec2 pc = u_regard * vec2(0.30, 0.11);
  float eclat = 1.0 + 0.55 * u_eclat;
  vec3 c = vec3(0.0);
  float a = 0.0;

  if (d < 0.0) {
    // l'iris : un feu qui tourbillonne et coule depuis la pupille
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
    c = iris(chaleur * 0.85);
    // la pupille fendue
    float ph = B * 1.06;
    float yy = (e.y - pc.y) / ph;
    float demi = u_pupille * sqrt(max(0.0, 1.0 - yy * yy));
    float dp = abs(e.x - pc.x) - demi;
    float dedans = 1.0 - smoothstep(-0.012, 0.012, dp);
    c *= 1.0 - dedans;
    c += vec3(1.0, 0.55, 0.15) * exp(-max(dp, 0.0) * 30.0) * 0.6 * (1.0 - dedans) * step(abs(yy), 1.0);
    a = 1.0;
  }

  // la couronne de flammes, qui monte
  if (d >= 0.0 && d < 1.3) {
    float haut = smoothstep(-0.15, 0.55, e.y);
    float L = mix(0.11, 0.55, haut) * (1.0 - 0.35 * smoothstep(0.6, 1.3, ax)) + 0.04;
    vec2 fp = vec2(e.x * 3.6, e.y * 1.9 - t * 2.3);
    float w = fbm3(fp * 1.3 + vec2(0.0, t * 0.5));
    float n = fbm(fp + vec2(w * 1.3, 0.0));
    float langues = pow(1.0 - abs(fbm3(vec2(e.x * 6.0 + w, e.y * 2.0 - t * 3.0)) * 2.0 - 1.0), 3.0);
    float I = (n * 2.3 - 0.7 + 0.5 * langues) * eclat - d / L + 0.95 * exp(-d / 0.04);
    if (d < 0.03) I *= 0.05 + 0.95 * d / 0.03; // la paupière, un trait sombre qui dessine l'amande
    c = iris(I * 0.8) * smoothstep(0.0, 0.35, I);
    a = clamp(I * 2.0, 0.0, 1.0);
  }
  return vec4(c, a);
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
    if (h > 0.82) {
      vec2 pos = (vec2(h21(cel + 1.7), h21(cel + 4.1)) - 0.5) * 0.6;
      float dd = length(f - pos);
      float vie = 0.5 + 0.5 * sin(t * (2.0 + h * 5.0) + h * 40.0);
      c += vec3(1.0, 0.42, 0.12) * smoothstep(0.075 - fi * 0.015, 0.0, dd) * vie * (1.4 - fi * 0.35);
    }
  }
  return c;
}

void main() {
  vec2 px = gl_FragCoord.xy;
  float H = u_res.y;
  vec2 q = (px - vec2(u_tx, 0.0)) / H;
  vec2 ecran = px / u_res;
  float t = u_t;
  float unPixel = 1.0 / H;

  vec2 versOeil = q - OEIL;
  float dOeil = length(versOeil * vec2(1.0, 1.7));
  float lumOeil = (1.0 + 0.6 * u_eclat) * (0.9 + 0.1 * sin(t * 2.3) * sin(t * 1.7));

  // la chaleur de l'Œil fait trembler l'air
  vec2 qs = q + (vec2(bruit(q * 38.0 + vec2(0.0, -t * 3.0)), bruit(q * 38.0 + vec2(5.0, -t * 3.0))) - 0.5) * 0.006 * exp(-dOeil * 9.0);

  /* --- le ciel d'orage --- */
  // les nuages tournent lentement autour de l'Œil, comme un vortex
  vec2 rel = qs - OEIL;
  float dv = length(rel * vec2(1.0, 1.4));
  float ang = 0.55 / (dv * 3.0 + 0.35) + t * 0.025;
  rel = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * rel;
  vec2 nuage = (OEIL + rel) * vec2(1.25, 2.1) + vec2(t * 0.012, 0.0);
  vec2 dw = vec2(fbm(nuage * 1.4 + vec2(0.0, t * 0.02)), fbm(nuage * 1.4 + vec2(5.2, -t * 0.015)));
  float n = fbm(nuage * 1.9 + dw * 1.9);
  float n2 = fbm3(nuage * 5.0 + dw * 3.0 - t * 0.03);
  float densite = smoothstep(0.25, 0.85, n);
  // fond : nuit rougie, plus chaude vers l'horizon
  vec3 fond = mix(vec3(0.16, 0.03, 0.012), vec3(0.018, 0.007, 0.006), smoothstep(0.05, 0.95, q.y));
  vec3 ciel = mix(fond, vec3(0.012, 0.006, 0.005), densite * 0.85);
  ciel = mix(ciel, ciel * 0.5, smoothstep(0.4, 0.8, n2) * 0.6);
  // les nuages s'éclairent par en dessous : l'Œil, et la lave de la plaine
  float eclaire = pow(densite, 1.6) * (0.6 + 0.6 * n2);
  ciel += vec3(1.0, 0.22, 0.035) * eclaire * exp(-dOeil * 2.2) * 1.6 * lumOeil;
  ciel += vec3(0.9, 0.2, 0.04) * (1.0 - densite) * exp(-dOeil * 4.0) * 0.4 * lumOeil; // trouée de lumière autour de l'Œil
  ciel += vec3(0.85, 0.14, 0.03) * eclaire * exp(-q.y * 3.6) * 0.8;
  ciel += vec3(0.6, 0.08, 0.02) * exp(-q.y * 4.5) * 0.55;

  // le halo de l'Œil, derrière la Tour
  ciel += vec3(1.0, 0.2, 0.02) * exp(-dOeil * 7.0) * 0.35 * lumOeil;
  vec3 col = ciel;

  /* --- au loin : Orodruin et sa fumée --- */
  vec2 orod = vec2(0.44, 0.27);
  float panache = fbm(vec2(qs.x * 5.0 - qs.y * 1.5 + t * 0.03, qs.y * 3.0 - t * 0.12));
  float largeur = 0.02 + (qs.y - orod.y) * 0.45;
  float fumee = smoothstep(largeur, 0.0, abs(qs.x - orod.x - (qs.y - orod.y) * 0.55 - (panache - 0.5) * 0.12)) * step(orod.y, qs.y) * smoothstep(0.95, 0.4, qs.y);
  col = mix(col, vec3(0.02, 0.01, 0.008) + vec3(0.35, 0.06, 0.01) * exp(-(qs.y - orod.y) * 8.0), fumee * smoothstep(0.3, 0.7, panache + 0.25));

  float chaine = 0.16 + 0.045 * fbm(vec2(q.x * 3.2 + 4.0, 0.5)) + 0.02 * fbm3(vec2(q.x * 14.0, 1.0));
  chaine = max(chaine, orod.y - abs(q.x - orod.x) * 0.95 - 0.02 * fbm3(vec2(q.x * 20.0, 3.0)));
  if (q.y < chaine) {
    float k = (chaine - q.y) * 9.0;
    col = vec3(0.022, 0.009, 0.007) * (1.0 - 0.4 * fbm3(q * vec2(40.0, 60.0)));
    col += vec3(0.6, 0.09, 0.02) * exp(-k * 2.0) * 0.35;                     // arêtes contre le ciel rouge
    col += vec3(1.0, 0.35, 0.06) * exp(-length((q - orod) * vec2(1.0, 2.0)) * 55.0) * 2.2; // la bouche de feu
    // coulées sur les flancs d'Orodruin
    float sinueux = (q.x - orod.x) * 70.0 + 2.0 * fbm3(vec2(q.y * 30.0, q.x * 10.0));
    float coulee = pow(1.0 - abs(bruit(vec2(sinueux, 1.3)) * 2.0 - 1.0), 18.0);
    col += vec3(1.0, 0.3, 0.05) * coulee * smoothstep(0.09, 0.0, abs(q.x - orod.x)) * smoothstep(0.17, 0.25, q.y) * 0.9;
  }
  float chaine2 = 0.105 + 0.035 * fbm(vec2(q.x * 5.5 + 9.0, 2.0));
  if (q.y < chaine2) col = vec3(0.012, 0.006, 0.005) + vec3(0.4, 0.05, 0.01) * exp(-(chaine2 - q.y) * 40.0) * 0.4;

  /* --- la plaine de Gorgoroth et ses crevasses de lave --- */
  if (q.y < 0.085) {
    vec2 g = vec2(q.x * 9.0, q.y * 60.0 / (0.3 + q.y * 6.0));
    float fente = 1.0 - abs(fbm3(g + vec2(0.0, t * 0.05)) * 2.0 - 1.0);
    float lave = pow(fente, 14.0) * smoothstep(0.085, 0.0, q.y);
    col = mix(col, vec3(0.015, 0.007, 0.005), smoothstep(0.085, 0.06, q.y));
    col += feu(lave * (1.3 + 0.3 * sin(t * 1.3 + q.x * 30.0)));
  }

  /* --- Barad-dûr --- */
  float dT = tour(q);
  float pierre = smoothstep(-unPixel * 1.2, unPixel * 1.2, dT);
  if (pierre > 0.0) {
    float grain = fbm3(q * vec2(55.0, 140.0));
    float pans = 0.85 + 0.15 * smoothstep(0.3, 0.7, fbm3(vec2(q.x * 260.0, q.y * 8.0)));
    vec3 roc = vec3(0.034, 0.022, 0.019) * (0.45 + 0.8 * grain) * pans;
    roc *= 0.55 + 0.45 * smoothstep(-0.2, 0.15, -q.x); // le flanc droit dans l'ombre
    // lisière tournée vers l'Œil
    vec2 dirO = normalize(OEIL - q);
    float bordO = clamp(dT / 0.004, 0.0, 1.0) * (1.0 - smoothstep(-unPixel, unPixel, tour(q + dirO * 0.0045)));
    roc += vec3(1.0, 0.33, 0.06) * bordO * exp(-dOeil * 5.0) * 1.8 * lumOeil;
    // lisière basse, éclairée par la lave
    float bordB = 1.0 - smoothstep(-unPixel, unPixel, tour(q - vec2(0.0, 0.004)));
    roc += vec3(0.8, 0.16, 0.03) * bordB * exp(-q.y * 7.0) * 0.9;
    // contre-jour : le ciel rouge souligne les arêtes
    float bordG = 1.0 - smoothstep(-unPixel, unPixel, tour(q + vec2(-0.003, 0.002)));
    float bordD = 1.0 - smoothstep(-unPixel, unPixel, tour(q + vec2(0.003, 0.002)));
    roc += vec3(0.55, 0.1, 0.02) * (bordG + bordD) * 0.35;
    // le haut des cornes rougeoie
    roc += vec3(0.6, 0.12, 0.02) * exp(-dOeil * 12.0) * 0.22;
    // meurtrières
    vec2 cel = floor(vec2(q.x / 0.011, q.y / 0.019));
    vec2 f = fract(vec2(q.x / 0.011, q.y / 0.019));
    float hf = h21(cel);
    if (hf > 0.968 && q.y > 0.13 && q.y < 0.56 && dT > 0.008) {
      float fen = smoothstep(0.16, 0.04, abs(f.x - 0.5)) * smoothstep(0.32, 0.16, abs(f.y - 0.5));
      float flamme = 0.65 + 0.35 * sin(t * (1.5 + hf * 4.0) + hf * 50.0);
      roc += vec3(1.0, 0.42, 0.1) * fen * flamme * 1.1;
    }
    col = mix(col, roc, pierre);
  }

  /* --- l'Œil, et son halo derrière lui --- */
  col += vec3(1.0, 0.3, 0.05) * exp(-dOeil * 26.0) * 0.18 * lumOeil * (1.0 - pierre * 0.7);
  vec2 e = (qs - OEIL) / TAILLE_OEIL;
  if (dot(e, e) < 6.0) {
    vec4 o = oeil(e, t);
    col = col * (1.0 - o.a) + o.rgb;
  }

  /* --- braises qui montent --- */
  col += braises(q, t) * (0.35 + 0.65 * smoothstep(0.6, 0.0, q.y)) * (1.0 - 0.6 * u_gauche * smoothstep(0.55, 0.15, ecran.x));

  /* --- finition : la gauche s'assombrit sous le menu, vignette, grain, tonalité --- */
  col *= 1.0 - u_gauche * 0.72 * smoothstep(0.62, 0.0, ecran.x);
  vec2 v = ecran - 0.5;
  col *= 1.0 - 0.55 * dot(v, v) * 1.6;
  col = 1.0 - exp(-col * 1.35);
  col = pow(col, vec3(0.95, 1.0, 1.05));
  col += (h21(px + fract(t) * 91.0) - 0.5) * 0.018;
  sortie = vec4(col, 1.0);
}
`;
