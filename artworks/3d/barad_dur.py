"""
Barad-dûr, modélisée de zéro en Python pour Blender (bpy).

Un design original, d'après les mots de Tolkien plutôt que d'après les films :
une forteresse noire « plus vaste que tout ce que la vue peut embrasser »,
bâtie en gradins de fer et de pierre, hérissée de tours et de créneaux, une
couronne de cornes de fer au sommet, et dans cette couronne l'Œil, « bordé de
feu, jaune comme celui d'un chat », sa pupille une fente noire. Au pied, la
plaine de Gorgoroth : cendre, roche fendue de lave, et l'Orodruin au loin.

Lancer (Blender 4.2+ ou le module bpy de PyPI, Cycles sur CPU) :

    blender -b -P artworks/3d/barad_dur.py -- --cadre portrait --sortie rendus/
    python artworks/3d/barad_dur.py --cadre paysage --echantillons 256

Options :
    --cadre portrait|paysage|tous   le format du rendu (3:5 pour le cadre de
                                    l'écran de chargement, 16:9 pour le fond)
    --echelle 0.25..1               fraction de la résolution finale (aperçu)
    --echantillons N                échantillons Cycles (défaut 192)
    --sortie DOSSIER                où écrire les PNG
    --blend FICHIER                 enregistre aussi la scène .blend
    --images A:B                    rend les images A à B de la boucle animée
                                    (sinon, une image fixe)
"""
import math
import random
import sys
import argparse
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector, Matrix

GRAINE = 1937  # l'année où Tolkien commence Le Seigneur des Anneaux
BOUCLE = 96    # images de la boucle animée (4 s à 24 i/s)


# --------------------------------------------------------------------------
# Outils
# --------------------------------------------------------------------------

def vider_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def lier(obj, coll=None):
    (coll or bpy.context.scene.collection).objects.link(obj)
    return obj


def objet_bmesh(nom, bm, mat=None, lisse=False):
    me = bpy.data.meshes.new(nom)
    bm.to_mesh(me)
    bm.free()
    if lisse:
        for p in me.polygons:
            p.use_smooth = True
    ob = bpy.data.objects.new(nom, me)
    if mat:
        ob.data.materials.append(mat)
    return lier(ob)


def noeuds(mat_ou_monde):
    if mat_ou_monde.node_tree is None:  # Blender < 5 : les nœuds sont à activer
        mat_ou_monde.use_nodes = True
    return mat_ou_monde.node_tree.nodes, mat_ou_monde.node_tree.links


def prisme(bm, cx, cy, z0, z1, r0, r1, cotes, rot=0.0, irreg=0.0, rng=None):
    """Un prisme effilé (de r0 en bas à r1 en haut), à base polygonale."""
    bas, haut = [], []
    for i in range(cotes):
        a = rot + 2 * math.pi * i / cotes
        k = 1.0 + (rng.uniform(-irreg, irreg) if rng and irreg else 0.0)
        bas.append(bm.verts.new((cx + r0 * k * math.cos(a), cy + r0 * k * math.sin(a), z0)))
        haut.append(bm.verts.new((cx + r1 * k * math.cos(a), cy + r1 * k * math.sin(a), z1)))
    for i in range(cotes):
        j = (i + 1) % cotes
        bm.faces.new((bas[i], bas[j], haut[j], haut[i]))
    bm.faces.new(list(reversed(bas)))
    bm.faces.new(haut)
    return haut


def boite(bm, centre, taille, rot_z=0.0):
    m = Matrix.Translation(centre) @ Matrix.Rotation(rot_z, 4, 'Z') @ Matrix.Diagonal((*taille, 1.0))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)


def corne(bm, base, direction, longueur, rayon, courbure, cotes=6, pas=14, torsion=0.0):
    """Une corne de fer : un tube qui s'amincit en pointe en se recourbant vers le haut."""
    d = Vector(direction).normalized()
    haut = Vector((0, 0, 1))
    anneaux = []
    for s in range(pas + 1):
        t = s / pas
        # le chemin : part dans « direction », se redresse vers le ciel
        p = Vector(base) + d * (longueur * t * (1 - 0.55 * t)) + haut * (longueur * (0.25 * t + courbure * t * t))
        tangente = (d * (1 - 1.1 * t) + haut * (0.25 + 2 * courbure * t)).normalized()
        n1 = tangente.cross(haut if abs(tangente.dot(haut)) < 0.95 else Vector((1, 0, 0))).normalized()
        n2 = tangente.cross(n1).normalized()
        r = rayon * (1 - t) ** 1.25 + 0.02
        anneau = []
        for i in range(cotes):
            a = 2 * math.pi * i / cotes + torsion * t
            # section en losange aplati : une lame plus qu'un tube
            q = p + n1 * (r * math.cos(a)) + n2 * (r * 0.6 * math.sin(a))
            anneau.append(bm.verts.new(q))
        anneaux.append(anneau)
    for s in range(pas):
        for i in range(cotes):
            j = (i + 1) % cotes
            bm.faces.new((anneaux[s][i], anneaux[s][j], anneaux[s + 1][j], anneaux[s + 1][i]))
    bm.faces.new(list(reversed(anneaux[0])))
    pointe = bm.verts.new(sum((v.co for v in anneaux[-1]), Vector()) / cotes + haut * 0.6)
    for i in range(cotes):
        j = (i + 1) % cotes
        bm.faces.new((anneaux[-1][i], anneaux[-1][j], pointe))


# --------------------------------------------------------------------------
# Matières
# --------------------------------------------------------------------------

def matiere_fer():
    m = bpy.data.materials.new("Fer noir")
    n, l = noeuds(m)
    p = n["Principled BSDF"]
    p.inputs["Base Color"].default_value = (0.018, 0.016, 0.016, 1)
    p.inputs["Metallic"].default_value = 0.55
    p.inputs["Roughness"].default_value = 0.42
    # des stries verticales et un grain, pour que la lueur accroche le métal
    coord = n.new("ShaderNodeTexCoord")
    mapn = n.new("ShaderNodeMapping")
    mapn.inputs["Scale"].default_value = (0.6, 0.6, 0.08)
    bruit = n.new("ShaderNodeTexNoise")
    bruit.inputs["Scale"].default_value = 6.0
    bruit.inputs["Detail"].default_value = 8.0
    l.new(coord.outputs["Object"], mapn.inputs["Vector"])
    l.new(mapn.outputs["Vector"], bruit.inputs["Vector"])
    rampe = n.new("ShaderNodeValToRGB")
    rampe.color_ramp.elements[0].position = 0.35
    rampe.color_ramp.elements[0].color = (0.28, 0.28, 0.28, 1)
    rampe.color_ramp.elements[1].position = 0.75
    rampe.color_ramp.elements[1].color = (0.62, 0.62, 0.62, 1)
    l.new(bruit.outputs["Fac"], rampe.inputs["Fac"])
    l.new(rampe.outputs["Color"], p.inputs["Roughness"])
    relief = n.new("ShaderNodeBump")
    relief.inputs["Strength"].default_value = 0.35
    l.new(bruit.outputs["Fac"], relief.inputs["Height"])
    l.new(relief.outputs["Normal"], p.inputs["Normal"])
    return m


def matiere_pierre():
    m = bpy.data.materials.new("Pierre de cendre")
    n, l = noeuds(m)
    p = n["Principled BSDF"]
    p.inputs["Roughness"].default_value = 0.92
    coord = n.new("ShaderNodeTexCoord")
    bruit = n.new("ShaderNodeTexNoise")
    bruit.inputs["Scale"].default_value = 0.8
    bruit.inputs["Detail"].default_value = 10.0
    l.new(coord.outputs["Object"], bruit.inputs["Vector"])
    rampe = n.new("ShaderNodeValToRGB")
    rampe.color_ramp.elements[0].color = (0.012, 0.010, 0.010, 1)
    rampe.color_ramp.elements[1].color = (0.05, 0.042, 0.038, 1)
    l.new(bruit.outputs["Fac"], rampe.inputs["Fac"])
    l.new(rampe.outputs["Color"], p.inputs["Base Color"])
    relief = n.new("ShaderNodeBump")
    relief.inputs["Strength"].default_value = 0.6
    l.new(bruit.outputs["Fac"], relief.inputs["Height"])
    l.new(relief.outputs["Normal"], p.inputs["Normal"])
    return m


def matiere_braise(force=18.0, couleur=(1.0, 0.32, 0.06, 1)):
    m = bpy.data.materials.new("Braise")
    n, l = noeuds(m)
    for k in list(n):
        n.remove(k)
    e = n.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = couleur
    e.inputs["Strength"].default_value = force
    o = n.new("ShaderNodeOutputMaterial")
    l.new(e.outputs["Emission"], o.inputs["Surface"])
    return m, e


def matiere_sol():
    """La plaine de Gorgoroth : roche noire, crevasses de lave qui couvent."""
    m = bpy.data.materials.new("Gorgoroth")
    n, l = noeuds(m)
    p = n["Principled BSDF"]
    p.inputs["Roughness"].default_value = 0.95
    p.inputs["Specular IOR Level"].default_value = 0.08  # la cendre ne brille pas, même à contre-jour
    out = n["Material Output"]
    coord = n.new("ShaderNodeTexCoord")
    vor = n.new("ShaderNodeTexVoronoi")
    vor.feature = 'DISTANCE_TO_EDGE'
    vor.inputs["Scale"].default_value = 0.045
    bruit_d = n.new("ShaderNodeTexNoise")  # déforme les fissures
    bruit_d.inputs["Scale"].default_value = 0.02
    bruit_d.inputs["Detail"].default_value = 4
    mix = n.new("ShaderNodeVectorMath")
    mix.operation = 'MULTIPLY_ADD'
    mix.inputs[1].default_value = (22, 22, 22)
    l.new(bruit_d.outputs["Color"], mix.inputs[0])
    l.new(coord.outputs["Object"], mix.inputs[2])
    l.new(coord.outputs["Object"], bruit_d.inputs["Vector"])
    l.new(mix.outputs["Vector"], vor.inputs["Vector"])
    fissure = n.new("ShaderNodeMapRange")
    fissure.inputs["From Min"].default_value = 0.0
    fissure.inputs["From Max"].default_value = 0.045
    fissure.inputs["To Min"].default_value = 1.0
    fissure.inputs["To Max"].default_value = 0.0
    l.new(vor.outputs["Distance"], fissure.inputs["Value"])
    # seules certaines zones couvent
    masque_b = n.new("ShaderNodeTexNoise")
    masque_b.inputs["Scale"].default_value = 0.012
    l.new(coord.outputs["Object"], masque_b.inputs["Vector"])
    masque = n.new("ShaderNodeMapRange")
    masque.inputs["From Min"].default_value = 0.42
    masque.inputs["From Max"].default_value = 0.58
    l.new(masque_b.outputs["Fac"], masque.inputs["Value"])
    lave = n.new("ShaderNodeMath")
    lave.operation = 'MULTIPLY'
    l.new(fissure.outputs["Result"], lave.inputs[0])
    l.new(masque.outputs["Result"], lave.inputs[1])
    puiss = n.new("ShaderNodeMath")
    puiss.operation = 'POWER'
    puiss.inputs[1].default_value = 2.2
    l.new(lave.outputs["Value"], puiss.inputs[0])
    teinte = n.new("ShaderNodeValToRGB")
    els = teinte.color_ramp.elements
    els[0].position = 0.0
    els[0].color = (0, 0, 0, 1)
    els[1].position = 1.0
    els[1].color = (1.0, 0.75, 0.25, 1)
    milieu = els.new(0.45)
    milieu.color = (0.85, 0.14, 0.02, 1)
    l.new(puiss.outputs["Value"], teinte.inputs["Fac"])
    force = n.new("ShaderNodeMath")
    force.operation = 'MULTIPLY'
    force.inputs[1].default_value = 14.0
    l.new(puiss.outputs["Value"], force.inputs[0])
    l.new(teinte.outputs["Color"], p.inputs["Emission Color"])
    l.new(force.outputs["Value"], p.inputs["Emission Strength"])
    # roche
    bruit_r = n.new("ShaderNodeTexNoise")
    bruit_r.inputs["Scale"].default_value = 0.4
    bruit_r.inputs["Detail"].default_value = 12
    l.new(coord.outputs["Object"], bruit_r.inputs["Vector"])
    roche = n.new("ShaderNodeValToRGB")
    roche.color_ramp.elements[0].color = (0.004, 0.0035, 0.0035, 1)
    roche.color_ramp.elements[1].color = (0.016, 0.013, 0.012, 1)
    l.new(bruit_r.outputs["Fac"], roche.inputs["Fac"])
    l.new(roche.outputs["Color"], p.inputs["Base Color"])
    relief = n.new("ShaderNodeBump")
    relief.inputs["Strength"].default_value = 1.0
    l.new(bruit_r.outputs["Fac"], relief.inputs["Height"])
    l.new(relief.outputs["Normal"], p.inputs["Normal"])
    return m


def matiere_oeil():
    """L'Œil : une flamme en amande, jaune au cœur, rouge au bord, fente noire."""
    m = bpy.data.materials.new("Œil")
    n, l = noeuds(m)
    for k in list(n):
        n.remove(k)
    coord = n.new("ShaderNodeTexCoord")
    bruit = n.new("ShaderNodeTexNoise")
    bruit.name = "bruit_oeil"
    bruit.noise_dimensions = '4D'
    bruit.inputs["Scale"].default_value = 3.5
    bruit.inputs["Detail"].default_value = 8
    bruit.inputs["Roughness"].default_value = 0.65
    l.new(coord.outputs["Object"], bruit.inputs["Vector"])
    # coordonnées déformées par le feu
    deforme = n.new("ShaderNodeVectorMath"); deforme.operation = 'MULTIPLY_ADD'
    deforme.inputs[1].default_value = (0.42, 0.3, 0.42)
    l.new(bruit.outputs["Color"], deforme.inputs[0])
    l.new(coord.outputs["Object"], deforme.inputs[2])
    sep = n.new("ShaderNodeSeparateXYZ")
    l.new(deforme.outputs["Vector"], sep.inputs["Vector"])
    # distance « ellipse » : |x| pèse lourd, z peu (l'iris s'étire en hauteur)
    comb = n.new("ShaderNodeCombineXYZ")
    zf = n.new("ShaderNodeMath"); zf.operation = 'MULTIPLY'; zf.inputs[1].default_value = 0.55
    l.new(sep.outputs["Z"], zf.inputs[0])
    l.new(sep.outputs["X"], comb.inputs["X"])
    l.new(zf.outputs["Value"], comb.inputs["Z"])
    dist = n.new("ShaderNodeVectorMath"); dist.operation = 'LENGTH'
    l.new(comb.outputs["Vector"], dist.inputs[0])
    rampe = n.new("ShaderNodeValToRGB")
    els = rampe.color_ramp.elements
    els[0].position = 0.0; els[0].color = (1.0, 0.92, 0.55, 1)      # cœur blanc-jaune
    p2 = els.new(0.22); p2.color = (1.0, 0.6, 0.06, 1)               # iris jaune de chat
    p3 = els.new(0.5); p3.color = (0.9, 0.16, 0.01, 1)                # orange de forge
    els[-1].position = 0.85; els[-1].color = (0.22, 0.012, 0.0, 1)   # rouge sombre
    l.new(dist.outputs["Value"], rampe.inputs["Fac"])
    # la pupille : une fente noire, fine, qui tremble à peine
    ax = n.new("ShaderNodeMath"); ax.operation = 'ABSOLUTE'
    sep0 = n.new("ShaderNodeSeparateXYZ")
    l.new(coord.outputs["Object"], sep0.inputs["Vector"])
    larg = n.new("ShaderNodeMath"); larg.operation = 'MULTIPLY_ADD'
    larg.inputs[1].default_value = 0.05
    l.new(bruit.outputs["Fac"], larg.inputs[0])
    l.new(sep0.outputs["X"], larg.inputs[2])
    l.new(larg.outputs["Value"], ax.inputs[0])
    fente = n.new("ShaderNodeMapRange")
    fente.inputs["From Min"].default_value = 0.045
    fente.inputs["From Max"].default_value = 0.085
    l.new(ax.outputs["Value"], fente.inputs["Value"])
    force = n.new("ShaderNodeMath"); force.operation = 'MULTIPLY'
    force.inputs[1].default_value = 2.2
    l.new(fente.outputs["Result"], force.inputs[0])
    e = n.new("ShaderNodeEmission")
    l.new(rampe.outputs["Color"], e.inputs["Color"])
    l.new(force.outputs["Value"], e.inputs["Strength"])
    o = n.new("ShaderNodeOutputMaterial")
    l.new(e.outputs["Emission"], o.inputs["Surface"])
    return m


def matiere_fumee(densite=0.0005, couleur=(0.035, 0.022, 0.018, 1)):
    m = bpy.data.materials.new("Fumée")
    n, l = noeuds(m)
    for k in list(n):
        n.remove(k)
    v = n.new("ShaderNodeVolumePrincipled")
    v.inputs["Color"].default_value = couleur
    v.inputs["Density"].default_value = densite
    v.inputs["Anisotropy"].default_value = 0.35
    o = n.new("ShaderNodeOutputMaterial")
    l.new(v.outputs["Volume"], o.inputs["Volume"])
    return m


def matiere_nuages():
    """Une masse de fumée en nappes, dense par endroits, éclairée par en dessous."""
    m = bpy.data.materials.new("Nuées")
    n, l = noeuds(m)
    for k in list(n):
        n.remove(k)
    coord = n.new("ShaderNodeTexCoord")
    mapn = n.new("ShaderNodeMapping")
    mapn.inputs["Scale"].default_value = (1.0, 1.0, 2.6)
    l.new(coord.outputs["Object"], mapn.inputs["Vector"])
    bruit = n.new("ShaderNodeTexNoise")
    bruit.inputs["Scale"].default_value = 2.2
    bruit.inputs["Detail"].default_value = 7
    bruit.inputs["Roughness"].default_value = 0.6
    try:
        bruit.noise_dimensions = '4D'
        bruit.name = "bruit_nuees"
    except Exception:
        pass
    l.new(mapn.outputs["Vector"], bruit.inputs["Vector"])
    plage = n.new("ShaderNodeMapRange")
    plage.inputs["From Min"].default_value = 0.5
    plage.inputs["From Max"].default_value = 0.78
    plage.inputs["To Max"].default_value = 0.09
    l.new(bruit.outputs["Fac"], plage.inputs["Value"])
    v = n.new("ShaderNodeVolumePrincipled")
    v.inputs["Color"].default_value = (0.07, 0.045, 0.04, 1)
    v.inputs["Anisotropy"].default_value = 0.2
    l.new(plage.outputs["Result"], v.inputs["Density"])
    o = n.new("ShaderNodeOutputMaterial")
    l.new(v.outputs["Volume"], o.inputs["Volume"])
    return m


# --------------------------------------------------------------------------
# La Tour
# --------------------------------------------------------------------------

def batir_tour(fer, pierre, fenetre):
    rng = random.Random(GRAINE)
    objets = []

    # 1. Le socle : un roc noir dont la Tour semble sortir, et quatre gradins
    bm = bmesh.new()
    prisme(bm, 0, 0, -6, 6, 74, 60, 11, rot=0.2, irreg=0.12, rng=rng)
    socle = objet_bmesh("Socle", bm, pierre)
    socle.modifiers.new("subdiv", 'SUBSURF').levels = 2
    dep = socle.modifiers.new("relief", 'DISPLACE')
    tex = bpy.data.textures.new("roc", 'CLOUDS'); tex.noise_scale = 9; tex.noise_depth = 3
    dep.texture = tex; dep.strength = 7
    objets.append(socle)

    bm = bmesh.new()
    # (z bas, z haut, rayon bas, rayon haut, côtés)
    gradins = [
        (5, 24, 52, 47, 12),
        (24, 41, 41, 37, 12),
        (41, 57, 31, 28, 10),
        (57, 72, 23, 21, 10),
    ]
    for z0, z1, r0, r1, c in gradins:
        prisme(bm, 0, 0, z0, z1, r0, r1, c, rot=math.pi / c)
        # créneaux sur le bord de chaque terrasse
        n = int(2 * math.pi * r1 / 3.2)
        for i in range(n):
            a = 2 * math.pi * i / n
            if i % 2 == 0:
                boite(bm, (r1 * 0.985 * math.cos(a), r1 * 0.985 * math.sin(a), z1 + 1.1), (1.3, 1.6, 2.2), a)
        # contreforts : des lames qui montent du gradin inférieur
        nb = c
        for i in range(nb):
            a = 2 * math.pi * (i + 0.5) / nb + math.pi / c
            d = Vector((math.cos(a), math.sin(a), 0))
            v = []
            h = z1 - z0
            pts = [(r0 + 5.5, z0), (r0 - 0.5, z0), (r1 - 0.5, z1 + 3.0), (r1 + 1.0, z1 + 4.5), (r0 + 2.0, z0 + h * 0.45)]
            for ep in (-0.9, 0.9):
                t = Vector((-math.sin(a), math.cos(a), 0)) * ep
                v.append([bm.verts.new(d * r + t + Vector((0, 0, z))) for r, z in pts])
            k = len(pts)
            bm.faces.new(v[0]); bm.faces.new(list(reversed(v[1])))
            for j in range(k):
                jj = (j + 1) % k
                bm.faces.new((v[0][j], v[1][j], v[1][jj], v[0][jj]))
    gr = objet_bmesh("Gradins", bm, fer)
    gr.modifiers.new("biseau", 'BEVEL').width = 0.25
    objets.append(gr)

    # 2. Le fût principal : une flèche à facettes qui s'effile vers la couronne
    bm = bmesh.new()
    etages = [(72, 112, 17, 14.5), (112, 150, 13.5, 11.5), (150, 188, 10.5, 9.0), (188, 214, 8.2, 7.4)]
    for z0, z1, r0, r1 in etages:
        prisme(bm, 0, 0, z0, z1, r0, r1, 8, rot=math.pi / 8)
        prisme(bm, 0, 0, z1 - 0.4, z1 + 1.4, r1 + 1.6, r1 + 1.2, 8, rot=math.pi / 8)  # corniche
        # arêtes saillantes aux angles du fût
        for i in range(8):
            a = 2 * math.pi * i / 8
            boite(bm, (r0 * 0.96 * math.cos(a), r0 * 0.96 * math.sin(a), (z0 + z1) / 2),
                  (2.2, 2.2, z1 - z0 - 2), a + math.pi / 4)
    fut = objet_bmesh("Fût", bm, fer)
    fut.modifiers.new("biseau", 'BEVEL').width = 0.2
    objets.append(fut)

    # 2 bis. Deux donjons accolés au fût, inégaux : la Tour n'est pas symétrique
    bm = bmesh.new()
    for ang, rd, z0, h, rr in [(2.35, 15, 60, 96, 7.5), (-0.55, 16, 60, 70, 6.2), (1.0, 18, 66, 42, 5.0)]:
        cx, cy = rd * math.cos(ang), rd * math.sin(ang)
        prisme(bm, cx, cy, z0, z0 + h, rr, rr * 0.8, 8, rot=ang)
        prisme(bm, cx, cy, z0 + h, z0 + h + 1.6, rr * 1.2, rr * 1.1, 8, rot=ang)
        for i in range(8):
            aa = ang + 2 * math.pi * i / 8
            d = Vector((math.cos(aa), math.sin(aa), 0))
            corne(bm, Vector((cx, cy, z0 + h + 1.2)) + d * rr * 0.95, d, rng.uniform(5, 9) * (rr / 6), 0.9, 0.9, pas=8)
        for k in range(int(h // 9)):
            z = z0 + 6 + k * 9
            prisme(bm, cx, cy, z, z + 1.0, rr * (1.08 - 0.2 * (z - z0) / h), rr * (1.06 - 0.2 * (z - z0) / h), 8, rot=ang)
    objets.append(objet_bmesh("Donjons", bm, fer))

    # piques de fer sur les créneaux
    bm = bmesh.new()
    for z0, z1, r0, r1, c in gradins:
        n = int(2 * math.pi * r1 / 3.2)
        for i in range(0, n, 2):
            if rng.random() < 0.3:
                a = 2 * math.pi * i / n
                d = Vector((math.cos(a), math.sin(a), 0))
                corne(bm, d * r1 * 0.985 + Vector((0, 0, z1 + 2)), d * 0.15, rng.uniform(4, 9), 0.45, 1.4, cotes=4, pas=4)
    objets.append(objet_bmesh("Piques", bm, fer))

    # 3. Les tours du pourtour : deux rangées, qui montent en désordre
    bm = bmesh.new()
    tours = []
    for anneau, (rayon, z0, hmin, hmax, rt, nb) in enumerate([
        (44, 22, 28, 52, 4.2, 9),
        (33, 40, 30, 70, 3.6, 7),
        (24, 56, 40, 96, 3.0, 6),
    ]):
        for i in range(nb):
            a = 2 * math.pi * (i + 0.37 * anneau) / nb + rng.uniform(-0.12, 0.12)
            cx, cy = rayon * math.cos(a), rayon * math.sin(a)
            h = rng.uniform(hmin, hmax)
            r = rt * rng.uniform(0.85, 1.2)
            haut = prisme(bm, cx, cy, z0, z0 + h, r, r * 0.72, 6, rot=a)
            prisme(bm, cx, cy, z0 + h, z0 + h + 1.2, r * 1.25, r * 1.15, 6, rot=a)
            if rng.random() < 0.45:
                # une aiguille de fer, fine et haute
                pt = bm.verts.new((cx, cy, z0 + h + 1.2 + r * rng.uniform(5.0, 8.0)))
                base = []
                for j in range(6):
                    aa = a + 2 * math.pi * j / 6
                    base.append(bm.verts.new((cx + r * 0.55 * math.cos(aa), cy + r * 0.55 * math.sin(aa), z0 + h + 1.2)))
                for j in range(6):
                    bm.faces.new((base[j], base[(j + 1) % 6], pt))
            else:
                # une petite couronne de crocs
                for j in range(5):
                    aa = a + 2 * math.pi * j / 5
                    d = Vector((math.cos(aa), math.sin(aa), 0))
                    corne(bm, Vector((cx, cy, z0 + h + 1.0)) + d * r, d, r * rng.uniform(1.4, 2.4), r * 0.28, 1.0, cotes=4, pas=6)
            tours.append((cx, cy, z0, h, r, a))
    pourtour = objet_bmesh("Tours", bm, fer)
    pourtour.modifiers.new("biseau", 'BEVEL').width = 0.15
    objets.append(pourtour)

    # 4. Les ponts de fer qui relient les tours au fût
    bm = bmesh.new()
    for cx, cy, z0, h, r, a in tours:
        if rng.random() < 0.55:
            z = z0 + h * rng.uniform(0.45, 0.85)
            p0 = Vector((cx, cy, z))
            p1 = Vector((0, 0, z + rng.uniform(4, 12)))
            mil = (p0 + p1) / 2
            dvec = p1 - p0
            longueur = dvec.length * 0.8
            m = Matrix.Translation(mil) @ dvec.to_track_quat('X', 'Z').to_matrix().to_4x4() @ Matrix.Diagonal((longueur, 1.4, 1.1, 1))
            bmesh.ops.create_cube(bm, size=1.0, matrix=m)
    objets.append(objet_bmesh("Ponts", bm, fer))

    # 5. Les fenêtres : des fentes de braise dans la nuit
    bm = bmesh.new()
    for z0, z1, r0, r1, c in gradins:
        for i in range(c * 3):
            if rng.random() < 0.38:
                a = 2 * math.pi * (i + 0.5) / (c * 3) + math.pi / c
                z = rng.uniform(z0 + 2, z1 - 3)
                rr = r0 + (r1 - r0) * (z - z0) / (z1 - z0) + 0.15
                boite(bm, (rr * math.cos(a), rr * math.sin(a), z), (0.5, 0.45, rng.uniform(1.4, 2.6)), a)
    for z0, z1, r0, r1 in etages:
        for i in range(8):
            if rng.random() < 0.5:
                a = 2 * math.pi * (i + 0.5) / 8 + math.pi / 8
                z = rng.uniform(z0 + 2, z1 - 3)
                rr = r0 + (r1 - r0) * (z - z0) / (z1 - z0) - 0.2
                rr *= math.cos(math.pi / 8)
                boite(bm, (rr * math.cos(a), rr * math.sin(a), z), (0.6, 0.6, rng.uniform(2, 4)), a)
    for cx, cy, z0, h, r, a in tours:
        for k in range(rng.randint(0, 3)):
            aa = a + rng.choice([0, 1, 2, 3, 4, 5]) * math.pi / 3 + math.pi / 6
            z = z0 + rng.uniform(0.3, 0.9) * h
            rr = (r - (r * 0.28) * (z - z0) / h) * math.cos(math.pi / 6) + 0.05
            boite(bm, (cx + rr * math.cos(aa), cy + rr * math.sin(aa), z), (0.35, 0.4, 1.4), aa)
    objets.append(objet_bmesh("Fenêtres", bm, fenetre))

    # 6. La couronne : neuf cornes de fer, inégales, recourbées vers le ciel
    bm = bmesh.new()
    z = 215.4
    prisme(bm, 0, 0, z - 1.6, z + 1.0, 9.8, 10.6, 9, rot=0.1)
    for i in range(9):
        a = 2 * math.pi * i / 9 + 0.35  # une brèche face au spectateur : l'Œil regarde entre deux cornes
        d = Vector((math.cos(a), math.sin(a), 0))
        longueur = rng.uniform(18, 30) * (1.25 if i in (2, 6) else 1.0)
        corne(bm, d * 8.2 + Vector((0, 0, z)), d, longueur, rng.uniform(2.3, 3.0), rng.uniform(0.55, 0.9),
              torsion=rng.uniform(-0.6, 0.6))
        # un ergot plus court à la base de chaque corne
        corne(bm, d * 9.0 + Vector((0, 0, z - 4)), (d + Vector((0, 0, -0.4))).normalized(), longueur * 0.3, 1.1, 0.35, pas=7)
    couronne = objet_bmesh("Couronne", bm, fer, lisse=True)
    objets.append(couronne)
    return objets


def poser_oeil(mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=32, radius=1.0, location=(0, 0, 243))
    oeil = bpy.context.active_object
    oeil.name = "Œil"
    # une amande verticale aux pointes effilées (et non un œuf)
    for v in oeil.data.vertices:
        v.co.x *= math.sqrt(max(0.0, 1 - v.co.z ** 2)) ** 0.8
    oeil.scale = (8.6, 2.5, 15.0)
    oeil.data.materials.append(mat)
    for p in oeil.data.polygons:
        p.use_smooth = True
    # sa propre lumière : il éclaire la couronne
    lum = bpy.data.lights.new("Lueur de l'Œil", 'POINT')
    lum.color = (1.0, 0.45, 0.12)
    lum.energy = 2.6e6
    lum.shadow_soft_size = 6
    ob = bpy.data.objects.new("Lueur de l'Œil", lum)
    ob.location = (0, 0, 243)
    lier(ob)
    # un halo de feu autour : une sphère de volume qui émet
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1.0, location=(0, 0, 243))
    halo = bpy.context.active_object
    halo.name = "Halo"
    halo.scale = (15, 15, 21)
    m = bpy.data.materials.new("Halo")
    n, l = noeuds(m)
    for k in list(n):
        n.remove(k)
    coord = n.new("ShaderNodeTexCoord")
    long = n.new("ShaderNodeVectorMath"); long.operation = 'LENGTH'
    l.new(coord.outputs["Object"], long.inputs[0])
    plage = n.new("ShaderNodeMapRange")
    plage.inputs["From Min"].default_value = 0.25
    plage.inputs["From Max"].default_value = 1.0
    plage.inputs["To Min"].default_value = 1.0
    plage.inputs["To Max"].default_value = 0.0
    l.new(long.outputs["Value"], plage.inputs["Value"])
    carre = n.new("ShaderNodeMath"); carre.operation = 'POWER'; carre.inputs[1].default_value = 2.5
    l.new(plage.outputs["Result"], carre.inputs[0])
    flamme = n.new("ShaderNodeTexNoise")
    flamme.name = "bruit_halo"
    flamme.noise_dimensions = '4D'
    flamme.inputs["Scale"].default_value = 2.0
    flamme.inputs["Detail"].default_value = 6
    l.new(coord.outputs["Object"], flamme.inputs["Vector"])
    fl = n.new("ShaderNodeMapRange")
    fl.inputs["From Min"].default_value = 0.4
    fl.inputs["From Max"].default_value = 0.7
    fl.inputs["To Min"].default_value = 0.15
    fl.inputs["To Max"].default_value = 1.6
    l.new(flamme.outputs["Fac"], fl.inputs["Value"])
    carre2 = n.new("ShaderNodeMath"); carre2.operation = 'MULTIPLY'
    l.new(carre.outputs["Value"], carre2.inputs[0])
    l.new(fl.outputs["Result"], carre2.inputs[1])
    carre = carre2
    fort = n.new("ShaderNodeMath"); fort.operation = 'MULTIPLY'; fort.inputs[1].default_value = 0.18
    l.new(carre.outputs["Value"], fort.inputs[0])
    v = n.new("ShaderNodeVolumePrincipled")
    v.inputs["Density"].default_value = 0.0
    v.inputs["Emission Color"].default_value = (1.0, 0.3, 0.05, 1)
    l.new(fort.outputs["Value"], v.inputs["Emission Strength"])
    o = n.new("ShaderNodeOutputMaterial")
    l.new(v.outputs["Volume"], o.inputs["Volume"])
    halo.data.materials.append(m)
    return oeil, lum


# --------------------------------------------------------------------------
# Le Mordor autour
# --------------------------------------------------------------------------

def plaine(mat):
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=500, y_subdivisions=500, size=2400, location=(0, 0, 0))
    sol = bpy.context.active_object
    sol.name = "Gorgoroth"
    tex = bpy.data.textures.new("plaine", 'CLOUDS')
    tex.noise_scale = 160
    tex.noise_depth = 4
    dep = sol.modifiers.new("relief", 'DISPLACE')
    dep.texture = tex
    dep.strength = 9
    dep.mid_level = 0.55
    t2 = bpy.data.textures.new("rocaille", 'CLOUDS')
    t2.noise_scale = 12
    t2.noise_depth = 3
    dep2 = sol.modifiers.new("rocaille", 'DISPLACE')
    dep2.texture = t2
    dep2.strength = 0.9
    sol.data.materials.append(mat)
    for p in sol.data.polygons:
        p.use_smooth = True
    # au premier plan, un sol plus fin : le regard est au ras de la cendre
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=600, y_subdivisions=400, size=1, location=(20, -150, 0))
    pres = bpy.context.active_object
    pres.name = "Gorgoroth proche"
    pres.scale = (300, 200, 1)
    bpy.ops.object.transform_apply(scale=True)
    tp1 = bpy.data.textures.new("plaine proche", 'CLOUDS'); tp1.noise_scale = 160; tp1.noise_depth = 4
    tp2 = bpy.data.textures.new("rocaille proche", 'CLOUDS'); tp2.noise_scale = 5; tp2.noise_depth = 3
    for nom, (t, st, ml) in {"relief": (tp1, 7, 0.55), "rocaille": (tp2, 1.0, 0.5)}.items():
        d = pres.modifiers.new(nom, 'DISPLACE')
        d.texture = t
        d.strength = st
        d.mid_level = ml
        d.texture_coords = 'GLOBAL'
    pres.location.z = -0.6
    pres.data.materials.append(mat)
    for p in pres.data.polygons:
        p.use_smooth = True
    return sol


def orodruin(pierre, lave):
    """La Montagne du Destin, au loin, sa gueule rouge sous la fumée."""
    bm = bmesh.new()
    rng = random.Random(GRAINE + 1)
    cx, cy = -640, 820
    anneaux = []
    for k, (r, z) in enumerate([(360, -10), (250, 60), (150, 140), (95, 200), (70, 232), (52, 240)]):
        a_ = []
        for i in range(40):
            a = 2 * math.pi * i / 40
            rr = r * (1 + rng.uniform(-0.08, 0.08))
            a_.append(bm.verts.new((cx + rr * math.cos(a), cy + rr * math.sin(a), z + rng.uniform(-6, 6))))
        anneaux.append(a_)
    for k in range(len(anneaux) - 1):
        for i in range(40):
            j = (i + 1) % 40
            bm.faces.new((anneaux[k][i], anneaux[k][j], anneaux[k + 1][j], anneaux[k + 1][i]))
    mont = objet_bmesh("Orodruin", bm, pierre, lisse=True)
    mont.modifiers.new("subdiv", 'SUBSURF').levels = 3
    dep = mont.modifiers.new("relief", 'DISPLACE')
    t = bpy.data.textures.new("orodruin", 'CLOUDS'); t.noise_scale = 70; t.noise_depth = 4
    dep.texture = t; dep.strength = 60
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=48, depth=4, location=(cx, cy, 236))
    gueule = bpy.context.active_object
    gueule.name = "Gueule de l'Orodruin"
    gueule.data.materials.append(lave)
    lum = bpy.data.lights.new("Feu de l'Orodruin", 'POINT')
    lum.color = (1.0, 0.3, 0.06)
    lum.energy = 2.5e7
    lum.shadow_soft_size = 40
    ob = bpy.data.objects.new("Feu de l'Orodruin", lum)
    ob.location = (cx, cy, 236)
    lier(ob)
    # coulée qui descend le flanc
    bm = bmesh.new()
    pts = []
    profil = [(52, 240), (70, 232), (95, 200), (150, 140), (250, 60), (360, -10)]

    def hauteur(r):
        for (ra, za), (rb, zb) in zip(profil, profil[1:]):
            if ra <= r <= rb:
                return za + (zb - za) * (r - ra) / (rb - ra)
        return -10

    for s in range(30):
        t = s / 29
        a = -1.15 + 0.22 * math.sin(t * 5)
        r = 50 + t * 290
        pts.append(Vector((cx + r * math.cos(a), cy + r * math.sin(a), hauteur(r) + 3)))
    gauche, droite = [], []
    for s, p in enumerate(pts):
        w = 3 + 9 * (s / 29)
        nrm = Vector((-math.sin(-1.15), math.cos(-1.15), 0))
        gauche.append(bm.verts.new(p - nrm * w))
        droite.append(bm.verts.new(p + nrm * w))
    for s in range(29):
        bm.faces.new((gauche[s], droite[s], droite[s + 1], gauche[s + 1]))
    bm.free()  # (la coulée en ruban lisait comme une route : abandonnée)


def nuees(mat_nuages, mat_fumee):
    # la grande chape de fumée au-dessus de la Tour
    ciel = None
    # la brume de cendre au ras du sol, partout
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 200, 90))
    brume = bpy.context.active_object
    brume.name = "Brume de cendre"
    brume.scale = (2200, 1600, 180)
    brume.data.materials.append(mat_fumee)
    return ciel, brume


def cendres(braise_mat, cendre_mat, nb=2200):
    """Des flocons de cendre et quelques braises qui dérivent devant la Tour."""
    rng = random.Random(GRAINE + 2)
    bm_c, bm_b = bmesh.new(), bmesh.new()
    for i in range(nb):
        braise = rng.random() < 0.07
        bm = bm_b if braise else bm_c
        x = rng.uniform(-160, 160)
        y = rng.uniform(-200, 120)
        z = rng.uniform(0, 230)
        s = rng.uniform(0.06, 0.16) if braise else rng.uniform(0.12, 0.4)
        m = Matrix.Translation((x, y, z)) @ Matrix.Rotation(rng.uniform(0, 6.28), 4, Vector((rng.random(), rng.random(), rng.random())).normalized())
        bmesh.ops.create_icosphere(bm, subdivisions=0, radius=s, matrix=m)
    c = objet_bmesh("Cendres", bm_c, cendre_mat)
    b = objet_bmesh("Braises", bm_b, braise_mat)
    return c, b


def monde():
    """Le ciel : une chape de nuées basses, noires en haut, rougies par en dessous."""
    w = bpy.data.worlds.new("Ciel du Mordor")
    bpy.context.scene.world = w
    n, l = noeuds(w)
    fond = n["Background"]
    coord = n.new("ShaderNodeTexCoord")
    sep = n.new("ShaderNodeSeparateXYZ")
    l.new(coord.outputs["Generated"], sep.inputs["Vector"])
    # projection « plafond » : les nuées s'aplatissent vers l'horizon
    hz = n.new("ShaderNodeMath"); hz.operation = 'MAXIMUM'; hz.inputs[1].default_value = 0.04
    l.new(sep.outputs["Z"], hz.inputs[0])
    vx = n.new("ShaderNodeMath"); vx.operation = 'DIVIDE'
    vy = n.new("ShaderNodeMath"); vy.operation = 'DIVIDE'
    l.new(sep.outputs["X"], vx.inputs[0]); l.new(hz.outputs["Value"], vx.inputs[1])
    l.new(sep.outputs["Y"], vy.inputs[0]); l.new(hz.outputs["Value"], vy.inputs[1])
    plafond = n.new("ShaderNodeCombineXYZ")
    l.new(vx.outputs["Value"], plafond.inputs["X"]); l.new(vy.outputs["Value"], plafond.inputs["Y"])
    nu = n.new("ShaderNodeTexNoise")
    nu.name = "bruit_ciel"
    nu.noise_dimensions = '4D'
    nu.inputs["Scale"].default_value = 0.55
    nu.inputs["Detail"].default_value = 9
    nu.inputs["Roughness"].default_value = 0.62
    nu.inputs["Distortion"].default_value = 0.5
    l.new(plafond.outputs["Vector"], nu.inputs["Vector"])
    contraste = n.new("ShaderNodeMapRange")
    contraste.inputs["From Min"].default_value = 0.38
    contraste.inputs["From Max"].default_value = 0.72
    l.new(nu.outputs["Fac"], contraste.inputs["Value"])
    # l'horizon brûle ; le zénith est noir
    hauteur = n.new("ShaderNodeMapRange")
    hauteur.inputs["From Min"].default_value = 0.0
    hauteur.inputs["From Max"].default_value = 0.95
    hauteur.inputs["To Min"].default_value = 1.0
    hauteur.inputs["To Max"].default_value = 0.0
    l.new(sep.outputs["Z"], hauteur.inputs["Value"])
    hp = n.new("ShaderNodeMath"); hp.operation = 'POWER'; hp.inputs[1].default_value = 1.6
    l.new(hauteur.outputs["Result"], hp.inputs[0])
    # tout près de l'horizon, la projection s'écrase : on fond vers une lueur unie
    pres_hz = n.new("ShaderNodeMapRange")
    pres_hz.inputs["From Min"].default_value = 0.0
    pres_hz.inputs["From Max"].default_value = 0.1
    l.new(sep.outputs["Z"], pres_hz.inputs["Value"])
    melange = n.new("ShaderNodeMix")
    melange.data_type = 'FLOAT'
    melange.inputs["A"].default_value = 0.62
    l.new(pres_hz.outputs["Result"], melange.inputs["Factor"])
    l.new(contraste.outputs["Result"], melange.inputs["B"])
    lueur = n.new("ShaderNodeMath"); lueur.operation = 'MULTIPLY'
    l.new(melange.outputs["Result"], lueur.inputs[0]); l.new(hp.outputs["Value"], lueur.inputs[1])
    rampe = n.new("ShaderNodeValToRGB")
    els = rampe.color_ramp.elements
    els[0].position = 0.0; els[0].color = (0.0015, 0.001, 0.001, 1)
    a = els.new(0.2); a.color = (0.04, 0.008, 0.003, 1)
    b = els.new(0.5); b.color = (0.3, 0.055, 0.008, 1)
    els[-1].position = 1.0; els[-1].color = (0.9, 0.25, 0.04, 1)
    l.new(lueur.outputs["Value"], rampe.inputs["Fac"])
    l.new(rampe.outputs["Color"], fond.inputs["Color"])
    fond.inputs["Strength"].default_value = 1.0


def lumieres():
    # la lave et les feux de la plaine, derrière et en contrebas : un contre-jour rouge
    for nom, pos, e, taille, col in [
        ("Feux de la plaine G", (-160, 140, 8), 1.1e6, 160, (1.0, 0.25, 0.05)),
        ("Feux de la plaine D", (190, 110, 8), 0.9e6, 160, (1.0, 0.3, 0.07)),
        ("Lueur sous la Tour", (0, -90, 6), 2.5e5, 120, (1.0, 0.32, 0.08)),
    ]:
        lum = bpy.data.lights.new(nom, 'AREA')
        lum.energy = e
        lum.size = taille
        lum.color = col
        ob = bpy.data.objects.new(nom, lum)
        ob.location = pos
        ob.rotation_euler = (0, 0, 0)  # regarde vers le bas par défaut : on le retourne
        ob.rotation_euler = (math.pi, 0, 0)
        lier(ob)
    # contre-jour : la lueur des forges derrière la Tour dessine ses arêtes
    for nom, pos, cible, e, taille in [
        ("Contre-jour gauche", (-170, 130, 90), (0, 0, 110), 3.0e6, 70),
        ("Contre-jour droit", (170, 110, 60), (0, 0, 90), 2.2e6, 70),
        ("Contre-jour haut", (-60, 140, 200), (0, 0, 225), 1.0e6, 40),
        ("Reflet de lave", (-60, -120, 3), (0, 0, 70), 4e5, 30),
    ]:
        lum = bpy.data.lights.new(nom, 'AREA')
        lum.energy = e
        lum.size = taille
        lum.spread = math.radians(28)  # un faisceau : la Tour, pas la plaine
        lum.color = (1.0, 0.33, 0.09)
        ob = bpy.data.objects.new(nom, lum)
        ob.location = pos
        ob.rotation_euler = (Vector(cible) - Vector(pos)).to_track_quat('-Z', 'Y').to_euler()
        lier(ob)
    # une lune voilée, à peine : juste de quoi détacher les arêtes froides
    lune = bpy.data.lights.new("Ciel voilé", 'SUN')
    lune.energy = 0.08
    lune.color = (0.55, 0.5, 0.6)
    lune.angle = 0.2
    ob = bpy.data.objects.new("Ciel voilé", lune)
    ob.rotation_euler = (math.radians(55), 0, math.radians(200))
    lier(ob)


def camera(cadre):
    cam = bpy.data.cameras.new("Regard")
    ob = bpy.data.objects.new("Regard", cam)
    lier(ob)
    bpy.context.scene.camera = ob
    if cadre == 'portrait':
        ob.location = (30, -235, 3)
        cible = Vector((0, 0, 142))
        cam.lens = 23
    elif cadre == 'couronne':
        ob.location = (26, -150, 196)
        cible = Vector((0, 0, 226))
        cam.lens = 55
    else:
        ob.location = (90, -380, 14)
        cible = Vector((-40, 0, 118))
        cam.lens = 26
    d = cible - ob.location
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    cam.clip_end = 6000
    return ob


# --------------------------------------------------------------------------
# Animation : une boucle de 4 s (flammes de l'Œil, nuées, braises qui montent)
# --------------------------------------------------------------------------

def animer(oeil_lum, braises, cendres_ob):
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end = 1, BOUCLE
    # le 4e axe des bruits avance en cercle pour boucler parfaitement
    for mat_nom, noeud, ampl in [("Œil", "bruit_oeil", 0.6), ("Halo", "bruit_halo", 0.8)]:
        mat = bpy.data.materials.get(mat_nom)
        if not mat:
            continue
        b = mat.node_tree.nodes.get(noeud)
        if not b or "W" not in b.inputs:
            continue
        fc = b.inputs["W"].driver_add("default_value")
        fc.driver.expression = f"{ampl} * sin(frame / {BOUCLE} * 2 * pi)"
    # les braises montent puis bouclent (déplacement entier d'une « période »)
    braises.location = (0, 0, 0)
    braises.keyframe_insert("location", frame=1)
    braises.location = (6, 0, 26)
    braises.keyframe_insert("location", frame=BOUCLE + 1)
    cendres_ob.location = (0, 0, 0)
    cendres_ob.keyframe_insert("location", frame=1)
    cendres_ob.location = (-8, 0, -10)
    cendres_ob.keyframe_insert("location", frame=BOUCLE + 1)
    for ob in (braises, cendres_ob):
        ad = ob.animation_data
        if ad and ad.action:
            try:
                for fc in ad.action.fcurves:
                    for k in fc.keyframe_points:
                        k.interpolation = 'LINEAR'
            except AttributeError:
                pass  # actions en couches (Blender 5) : l'interpolation est réglée ci-dessous
    try:
        bpy.context.preferences.edit.keyframe_new_interpolation_type = 'LINEAR'
    except Exception:
        pass
    # l'Œil respire
    fc = oeil_lum.driver_add("energy")
    fc.driver.expression = f"2.6e6 * (1 + 0.12 * sin(frame / {BOUCLE} * 6 * pi))"


# --------------------------------------------------------------------------
# Rendu
# --------------------------------------------------------------------------

def regler_rendu(cadre, echelle, echantillons):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = echantillons
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.02
    sc.cycles.use_denoising = True
    try:
        sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    except Exception:
        pass
    sc.cycles.max_bounces = 6
    sc.cycles.volume_bounces = 1
    sc.cycles.volume_step_rate = 4.0
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False
    sc.cycles.blur_glossy = 1.0
    sc.cycles.sample_clamp_indirect = 8.0
    if cadre in ('portrait', 'couronne'):
        sc.render.resolution_x, sc.render.resolution_y = 1500, 2500
    else:
        sc.render.resolution_x, sc.render.resolution_y = 2560, 1440
    sc.render.resolution_percentage = int(round(echelle * 100))
    sc.render.fps = 24
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_depth = '16'
    try:
        sc.view_settings.view_transform = 'AgX'
        sc.view_settings.look = 'AgX - Punchy'
    except Exception:
        try:
            sc.view_settings.view_transform = 'Filmic'
            sc.view_settings.look = 'High Contrast'
        except Exception:
            pass
    sc.view_settings.exposure = 0.0
    sc.render.film_transparent = False


def construire(cadre):
    vider_scene()
    fer = matiere_fer()
    pierre = matiere_pierre()
    fenetre, _ = matiere_braise(26.0, (1.0, 0.36, 0.08, 1))
    fenetre.name = "Fenêtres"
    lave, _ = matiere_braise(30.0, (1.0, 0.28, 0.04, 1))
    lave.name = "Lave"
    braise_m, _ = matiere_braise(40.0, (1.0, 0.45, 0.1, 1))
    braise_m.name = "Braises"
    cendre_m = bpy.data.materials.new("Cendre")
    n, _ = noeuds(cendre_m)
    n["Principled BSDF"].inputs["Base Color"].default_value = (0.012, 0.011, 0.011, 1)
    n["Principled BSDF"].inputs["Roughness"].default_value = 1.0

    monde()
    plaine(matiere_sol())
    batir_tour(fer, pierre, fenetre)
    _, lum_oeil = poser_oeil(matiere_oeil())
    orodruin(pierre, lave)
    nuees(None, matiere_fumee())
    c, b = cendres(braise_m, cendre_m)
    lumieres()
    camera(cadre)
    animer(lum_oeil, b, c)


def principal():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument("--cadre", default="portrait", choices=["portrait", "paysage", "couronne", "tous"])
    ap.add_argument("--echelle", type=float, default=1.0)
    ap.add_argument("--echantillons", type=int, default=192)
    ap.add_argument("--sortie", default=str(Path(__file__).resolve().parent / "rendus"))
    ap.add_argument("--blend", default=None)
    ap.add_argument("--images", default=None)
    ap.add_argument("--nom", default=None)
    a = ap.parse_args(argv)
    sortie = Path(a.sortie)
    sortie.mkdir(parents=True, exist_ok=True)
    cadres = ["portrait", "paysage"] if a.cadre == "tous" else [a.cadre]
    for cadre in cadres:
        construire(cadre)
        regler_rendu(cadre, a.echelle, a.echantillons)
        sc = bpy.context.scene
        if a.blend:
            bpy.ops.wm.save_as_mainfile(filepath=str(Path(a.blend).resolve()))
        if a.images:
            debut, fin = (int(x) for x in a.images.split(":"))
            sc.frame_start, sc.frame_end = debut, fin
            sc.render.filepath = str(sortie / f"{a.nom or 'boucle_' + cadre}_")
            bpy.ops.render.render(animation=True)
        else:
            sc.frame_set(1)
            sc.render.filepath = str(sortie / f"{a.nom or 'barad_dur_' + cadre}.png")
            bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    principal()
