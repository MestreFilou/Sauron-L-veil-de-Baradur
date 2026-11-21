#!/usr/bin/env python3
"""Génère la police « Noir Parler » : une écriture originale dans l'esprit des Tengwar.

Chaque lettre latine (accents compris) reçoit un signe : le texte reste le même texte,
seule la police change. C'est ce qui permet au client d'afficher tout en Noir Parler puis
de basculer en clair, lettre pour lettre, sans rien traduire.

Les signes sont dessinés ici, trait par trait, comme une écriture elfique à la plume :
- les consonnes sont une hampe (courte, montante ou descendante) et une ou deux panses,
  fermées ou ouvertes, à droite ou à gauche de la hampe ;
- quelques consonnes sans hampe (une vague, une arche, un crochet) ;
- les voyelles sont un petit porteur surmonté d'une marque (point, accent, boucle),
  comme les tehtar ; les accents français se posent sous le porteur.
Le tracé imite une plume large tenue à 45° : les traits s'épaississent selon leur angle.
Ce n'est pas une copie des Tengwar : l'alphabet et les formes sont propres au jeu.
Les chiffres et la ponctuation rare sont laissés à la police de repli : ils restent lisibles.

Usage :  pip install fonttools brotli && python3 client/outils/police_noir_parler.py
Sortie : client/src/typo/NoirParler.woff2
"""
import math
from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

U = 112            # une case de la grille, en unités de fonte
EM = 1000
EPAIS = 64         # épaisseur nominale du trait
APPROCHE = 60      # blanc de chaque côté du signe

X = 4.6            # hauteur d'x : le haut des panses
PANSE = 2.3        # largeur d'une panse

# ---------- Hampes et panses ----------
HAMPES = {'C': (0, X), 'M': (0, 7.6), 'D': (-2.9, X)}   # courte, montante, descendante

def arc(cx, cy, rx, ry, a0, a1, n=14):
    return [(cx + rx * math.cos(a0 + (a1 - a0) * k / n), cy + ry * math.sin(a0 + (a1 - a0) * k / n)) for k in range(n + 1)]

def panse(s, sens, ouverte=False, haut=X, bas=0.35):
    """Une panse accrochée à la hampe en x = s, du haut de l'x vers la ligne de base."""
    cy, ry = (haut + bas) / 2, (haut - bas) / 2
    fin = -math.pi / 2 * (0.25 if ouverte else 1)       # ouverte : la plume quitte avant de revenir
    pts = arc(s, cy, PANSE, ry, math.pi / 2, fin)
    if ouverte:  # petite queue qui s'écarte de la hampe
        x, y = pts[-1]
        pts.append((x + 0.15, y - 0.5))
    return [[(s + (x - s) * sens, y) for x, y in pts]]

def consonne(hampe, panses, cote):
    """hampe C/M/D ; panses '1', '2' ou 'O' (ouverte) ; côté 'R' ou 'L'."""
    sens = 1 if cote == 'R' else -1
    s = PANSE * 2 + 0.3 if (cote == 'L' and panses == '2') else (PANSE + 0.3 if cote == 'L' else 0)
    bas, haut = HAMPES[hampe]
    traits = [[(s, bas), (s, haut)]]
    if panses == '1':
        traits += panse(s, sens)
    elif panses == '2':
        traits += panse(s, sens) + panse(s + PANSE * sens * 0.95, sens)
    else:
        traits += panse(s, sens, ouverte=True)
    return traits

# ---------- Les voyelles : un porteur et sa marque ----------
PORTEUR = [[(0.6, 0), (0.6, 2.3), (1.0, 2.7)]]
def point(cx, cy, r=0.36): return [[(cx, cy + r), (cx + r, cy), (cx, cy - r), (cx - r, cy), (cx, cy + r)]]
def boucle(cx, cy, sens): return [arc(cx, cy, 0.7 * sens, 0.7, math.pi * 0.9, -math.pi * 0.6, 10)]

TEHTAR = {
    'a': point(-0.1, 4.1) + point(1.3, 4.1) + point(0.6, 5.2),
    'e': [[(0.1, 3.8), (1.3, 5.2)]],
    'i': point(0.6, 4.4),
    'o': boucle(0.6, 4.6, 1),
    'u': boucle(0.6, 4.6, -1),
    'y': point(0.0, 4.4) + point(1.3, 4.4),
}

RUNES = {v: PORTEUR + t for v, t in TEHTAR.items()}
RUNES.update({
    't': consonne('D', '1', 'R'), 'd': consonne('D', '2', 'R'),
    'p': consonne('D', '1', 'L'), 'b': consonne('D', '2', 'L'),
    'c': consonne('D', 'O', 'R'), 'k': consonne('D', 'O', 'L'),
    'f': consonne('M', '1', 'R'), 'v': consonne('M', '2', 'R'),
    'g': consonne('M', '1', 'L'), 'j': consonne('M', '2', 'L'),
    'q': consonne('M', 'O', 'R'), 'x': consonne('M', 'O', 'L'),
    'w': consonne('C', '1', 'R'), 'n': consonne('C', '2', 'R'),
    'm': consonne('C', '2', 'L'), 'h': consonne('C', 'O', 'R'),
    'z': consonne('C', 'O', 'L'),
    # sans hampe : la vague, l'arche, le crochet
    'r': [[(0.2, 0), (0.2, 2.8)] + arc(1.35, 2.8, 1.15, 1.7, math.pi, 0.15, 12)],
    'l': [arc(1.4, 0, 1.4, X, math.pi, 0, 16)],
    's': [arc(1.3, 3.4, 1.1, 1.0, 0.2, math.pi * 1.5, 12) + arc(1.3, 1.2, 1.2, 1.2, math.pi * 0.5, -math.pi * 0.9, 12)],
})
# ligatures du français
RUNES['œ'] = RUNES['o'] + [[(x + 1.9, y) for x, y in t] for t in RUNES['e']]
RUNES['æ'] = RUNES['a'] + [[(x + 1.9, y) for x, y in t] for t in RUNES['e']]

# ---------- Accents : une marque sous le signe ----------
def marque(nom, cx):
    y = -0.9
    if nom == 'aigu': return [[(cx - 0.5, y - 0.6), (cx + 0.5, y + 0.3)]]
    if nom == 'grave': return [[(cx + 0.5, y - 0.6), (cx - 0.5, y + 0.3)]]
    if nom == 'circ': return [[(cx - 0.7, y + 0.3), (cx, y - 0.4), (cx + 0.7, y + 0.3)]]
    if nom == 'trema': return point(cx - 0.55, y, 0.34) + point(cx + 0.55, y, 0.34)
    if nom == 'cedille': return point(cx, y, 0.36)
    raise KeyError(nom)

ACCENTS = {
    'à': ('a', 'grave'), 'â': ('a', 'circ'), 'ä': ('a', 'trema'),
    'é': ('e', 'aigu'), 'è': ('e', 'grave'), 'ê': ('e', 'circ'), 'ë': ('e', 'trema'),
    'î': ('i', 'circ'), 'ï': ('i', 'trema'), 'ô': ('o', 'circ'), 'ö': ('o', 'trema'),
    'ù': ('u', 'grave'), 'û': ('u', 'circ'), 'ü': ('u', 'trema'), 'ÿ': ('y', 'trema'),
    'ç': ('c', 'cedille'), 'ñ': ('n', 'circ'), 'á': ('a', 'aigu'), 'í': ('i', 'aigu'),
    'ó': ('o', 'aigu'), 'ú': ('u', 'aigu'),
}

def bornes(traits):
    xs = [x for t in traits for x, _ in t]
    ys = [y for t in traits for _, y in t]
    return min(xs), max(xs), min(ys), max(ys)

for lettre, (base, nom) in ACCENTS.items():
    t = RUNES[base]
    cx = 0.6 if base in TEHTAR else (bornes(t)[0] + bornes(t)[1]) / 2
    RUNES[lettre] = t + marque(nom, cx)


# ponctuation dessinée (le reste tombe sur la police de repli)
LOSANGE = lambda cx, cy, r=0.45: [[(cx, cy + r), (cx + r, cy), (cx, cy - r), (cx - r, cy), (cx, cy + r)]]
PONCT = {
    '.': LOSANGE(0.5, 0.5),
    '·': LOSANGE(0.5, 3.2),
    ',': [[(0.6, 0.6), (0.1, -1.0)]],
    ':': LOSANGE(0.5, 0.5) + LOSANGE(0.5, 3.6),
    ';': LOSANGE(0.5, 3.6) + [[(0.6, 0.6), (0.1, -1.0)]],
    "'": [[(0.5, 7.2), (0.2, 5.6)]],
    '’': [[(0.5, 7.2), (0.2, 5.6)]],
    '-': [[(0, 2.6), (1.8, 3.4)]],
    '‑': [[(0, 2.6), (1.8, 3.4)]],
}
RUNES.update(PONCT)


# ---------- Du trait au contour ----------
def aire(pts):
    return sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts))) / 2

def epaisseur(dx, dy):
    """Plume large à 45° : le trait est épais quand il est perpendiculaire au bec."""
    a = math.atan2(dy, dx)
    return EPAIS * (0.62 + 0.55 * abs(math.sin(a - math.pi / 4)))

def contours(traits, dx):
    polys = []
    for t in traits:
        pts = [((x + dx) * U, y * U) for x, y in t]
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            vx, vy = x1 - x0, y1 - y0
            n = math.hypot(vx, vy) or 1
            w = epaisseur(vx, vy) / 2
            nx, ny = -vy / n * w, vx / n * w
            # on prolonge un peu le trait aux bouts pour que les angles se ferment
            ex, ey = vx / n * w * 0.35, vy / n * w * 0.35
            polys.append([(x0 - ex + nx, y0 - ey + ny), (x1 + ex + nx, y1 + ey + ny),
                          (x1 + ex - nx, y1 + ey - ny), (x0 - ex - nx, y0 - ey - ny)])
        # un nœud à chaque articulation : un octogone du diamètre du trait
        for k, (x, y) in enumerate(pts[1:-1], 1):
            ax, ay = pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]
            bx, by = pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]
            r = min(epaisseur(ax, ay), epaisseur(bx, by)) * 0.5
            polys.append([(x + r * math.cos(k * math.pi / 4 + math.pi / 8), y + r * math.sin(k * math.pi / 4 + math.pi / 8)) for k in range(8)])
    out = []
    for p in polys:
        p = [(round(x), round(y)) for x, y in p]
        if aire(p) > 0:   # TrueType : contours extérieurs dans le sens horaire
            p.reverse()
        out.append(p)
    return out

def glyphe(traits):
    x0, x1, _, _ = bornes(traits)
    dx = -x0 + APPROCHE / U + EPAIS / 2 / U
    pen = TTGlyphPen(None)
    for p in contours(traits, dx):
        pen.moveTo(p[0])
        for q in p[1:]:
            pen.lineTo(q)
        pen.closePath()
    largeur = round((x1 - x0) * U + EPAIS + 2 * APPROCHE)
    return pen.glyph(), largeur


def main():
    noms = ['.notdef', 'space']
    glyphes, metriques, cmap = {}, {}, {0x20: 'space', 0xA0: 'space'}
    vide = TTGlyphPen(None)
    glyphes['.notdef'] = vide.glyph(); metriques['.notdef'] = (500, 0)
    glyphes['space'] = TTGlyphPen(None).glyph(); metriques['space'] = (300, 0)
    for i, (car, traits) in enumerate(RUNES.items()):
        nom = f'rune{i:02d}'
        g, l = glyphe(traits)
        noms.append(nom)
        glyphes[nom] = g
        metriques[nom] = (l, 0)
        cmap[ord(car)] = nom
        maj = car.upper()
        if len(maj) == 1 and maj != car:
            cmap[ord(maj)] = nom
    fb = FontBuilder(EM, isTTF=True)
    fb.setupGlyphOrder(noms)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyphes)
    glyf = fb.font['glyf']
    lsb = {}
    for nom in noms:
        g = glyf[nom]
        g.recalcBounds(glyf)
        lsb[nom] = getattr(g, 'xMin', 0) if g.numberOfContours else 0
    fb.setupHorizontalMetrics({n: (w, lsb[n]) for n, (w, _) in metriques.items()})
    fb.setupHorizontalHeader(ascent=900, descent=-260)
    fb.setupNameTable({'familyName': 'Noir Parler', 'styleName': 'Regular',
                       'copyright': 'Dessinée pour L’Œil de Barad-dûr. Libre de droits (CC0).'})
    fb.setupOS2(sTypoAscender=820, sTypoDescender=-240, usWinAscent=900, usWinDescent=260, sxHeight=460, sCapHeight=700)
    fb.setupPost()
    sortie = Path(__file__).resolve().parent.parent / 'src' / 'typo' / 'NoirParler.woff2'
    sortie.parent.mkdir(parents=True, exist_ok=True)
    fb.font.flavor = 'woff2'
    fb.save(str(sortie))
    print(f'{sortie} : {len(RUNES)} runes, {sortie.stat().st_size} octets')


if __name__ == '__main__':
    main()
