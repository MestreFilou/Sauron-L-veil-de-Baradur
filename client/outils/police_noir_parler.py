#!/usr/bin/env python3
"""Génère la police « Noir Parler » : une écriture runique originale, à la manière des Cirth.

Chaque lettre latine (accents compris) reçoit une rune : le texte reste le même texte,
seule la police change. C'est ce qui permet au client d'afficher tout en Noir Parler puis
de basculer en clair, lettre pour lettre, sans rien traduire.

Les runes sont dessinées ici, trait par trait, sur une grille : consonnes à pleine hauteur
autour d'une hampe, voyelles plus basses et sans hampe, quelques jambages qui descendent.
Le tracé imite une plume large tenue à 45° : les traits s'épaississent selon leur angle.
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
EPAIS = 84         # épaisseur nominale du trait
APPROCHE = 70      # blanc de chaque côté de la rune

# ---------- Les branches autour d'une hampe en x = c ----------
def hampe(c, bas=0, haut=7):
    return [[(c, bas), (c, haut)]]

def TR(c, h=7): return [[(c, h), (c + 1.6, h - 1.6)]]
def TL(c, h=7): return [[(c, h), (c - 1.6, h - 1.6)]]
def MR(c): return [[(c, 3.5), (c + 1.6, 5.1)]]
def ML(c): return [[(c, 3.8), (c - 1.6, 2.2)]]
def BR(c): return [[(c, 0), (c + 1.6, 1.6)]]
def PK(c, h=7): return [[(c, h), (c + 1.7, h - 1.4), (c, h - 2.8)]]
def PK2(c): return [[(c, 4.2), (c + 1.7, 2.8), (c, 1.4)]]

def jambe(c, haut=7): return hampe(c, -2.2, haut)

C = 1.7  # hampe des consonnes
D = 2.2  # hampe des runes à deux hampes (la seconde en D + 2)

RUNES = {
    # voyelles : basses (hauteur 4.6), sans hampe
    'a': [[(0, 4.6), (1.5, 0), (3, 4.6)]],
    'e': [[(1.5, 4.6), (3, 2.3), (1.5, 0), (0, 2.3), (1.5, 4.6)]],
    'i': [[(0.3, 0), (0.3, 4.6), (1.6, 3.4)]],
    'o': [[(0, 0), (1.5, 4.6), (3, 0)], [(1.5, 4.6), (1.5, 6.2)]],
    'u': [[(0, 0), (0, 4.6), (2.6, 2.3), (0, 0)]],
    'y': [[(0, 4.6), (1.5, 1.4), (3, 4.6)], [(1.5, 1.4), (1.5, -2.2)]],
    # consonnes : une hampe et ses branches
    'b': hampe(C) + PK(C) + PK2(C),
    'c': hampe(C) + TL(C) + BR(C),
    'd': hampe(C) + PK(C),
    'f': hampe(C) + TR(C) + MR(C),
    'g': jambe(C, 4.6) + TR(C, 4.6) + [[(C, 4.6), (C, 6.4)]],
    'h': hampe(D) + hampe(D + 2) + [[(D, 2.6), (D + 2, 4.6)]],
    'j': jambe(C, 4.6) + TL(C, 4.6),
    'k': hampe(C) + MR(C) + BR(C),
    'l': hampe(C) + TL(C),
    'm': hampe(D) + hampe(D + 2) + [[(D, 7), (D + 2, 4.8)], [(D + 2, 7), (D, 4.8)]],
    'n': hampe(C) + TR(C) + ML(C),
    'p': jambe(C) + PK(C),
    'q': jambe(C) + TL(C) + TR(C),
    'r': hampe(C) + TR(C) + BR(C),
    's': [[(2.2, 7), (0, 4.7), (2.2, 2.3), (0, 0)]],
    't': hampe(C) + TL(C) + TR(C),
    'v': hampe(C) + ML(C) + BR(C),
    'w': hampe(D) + hampe(D + 2) + [[(D, 7), (D + 2, 5)]],
    'x': [[(0, 7), (2.8, 0)], [(2.8, 7), (0, 0)]],
    'z': hampe(C) + TL(C) + ML(C),
}
# ligatures du français
RUNES['œ'] = RUNES['o'] + [[(x + 3.4, y) for x, y in t] for t in RUNES['e']]
RUNES['æ'] = RUNES['a'] + [[(x + 3.4, y) for x, y in t] for t in RUNES['e']]

# ---------- Diacritiques : des marques posées au-dessus (ou sous) la rune ----------
def marque(nom, cx, haut):
    y = haut + 0.9
    if nom == 'aigu': return [[(cx - 0.5, y), (cx + 0.6, y + 1.0)]]
    if nom == 'grave': return [[(cx + 0.5, y), (cx - 0.6, y + 1.0)]]
    if nom == 'circ': return [[(cx - 0.8, y), (cx, y + 0.8), (cx + 0.8, y)]]
    if nom == 'trema': return [[(cx - 0.7, y), (cx - 0.7, y + 0.5)], [(cx + 0.7, y), (cx + 0.7, y + 0.5)]]
    if nom == 'cedille': return [[(cx, 0), (cx + 0.5, -1.0), (cx - 0.3, -1.6)]]
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
    x0, x1, _, y1 = bornes(t)
    haut = 4.6 if base in 'aeiuy' else 7
    if base == 'o': haut = 4.6
    RUNES[lettre] = t + marque(nom, (x0 + x1) / 2, haut if nom != 'cedille' else 0)

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
        for x, y in pts[1:-1]:
            r = EPAIS * 0.5
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
