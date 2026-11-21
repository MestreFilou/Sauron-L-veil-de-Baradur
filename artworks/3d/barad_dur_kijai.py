"""
Barad-dûr d'après le modèle de Kijai, dans la scène de barad_dur.py.

Le modèle « Barad-Dûr, The Dark Tower » de Kijai (Kijai Design,
https://www.printables.com/model/234578-barad-dur-the-dark-tower) est sous
licence Creative Commons BY-NC-ND 4.0 : attribution, pas d'usage commercial,
pas de diffusion de version modifiée. Ses fichiers STL et les rendus qui en
sortent restent donc HORS du dépôt, dans artworks/kijai/ (ignoré par git).
Ce script ne contient aucune donnée du modèle : il l'importe depuis ce dossier.

On garde de barad_dur.py le ciel, la plaine de lave, l'Orodruin, la lumière,
la cendre et l'Œil de flammes ; on remplace la Tour modélisée par les pièces
du modèle (socle, tour, plaques de lave). L'Œil imprimable est remplacé par
l'Œil de flammes, logé entre les deux cornes.

    python artworks/3d/barad_dur_kijai.py --cadre portrait --sortie artworks/kijai/rendus
    (mêmes options que barad_dur.py, dont --sans-pupille et --echelle)

Fichiers attendus dans artworks/kijai/stl/ (noms de l'archive de Kijai) :
    baraddur_bottom_01_kijaidesign.stl, baraddur_tower_01_kijaidesign.stl,
    baraddur_lava_03_kijaidesign.stl
"""
import math
import sys
from pathlib import Path

import bpy

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI))
import barad_dur as bd  # noqa: E402

STL = ICI.parent / "kijai" / "stl"
PIECES = {
    "Socle (Kijai)": "baraddur_bottom_01_kijaidesign.stl",
    "Tour (Kijai)": "baraddur_tower_01_kijaidesign.stl",
    "Lave (Kijai)": "baraddur_lava_03_kijaidesign.stl",
}
# le modèle regarde vers +x ; on le tourne pour qu'il fasse face aux caméras (vers -y)
ROTATION = -math.pi / 2
# le modèle est agrandi et étiré en hauteur pour être plus écrasant : la
# forteresse monte de 15 %, la tour de 50 %. Son socle d'impression (un bloc
# plat de ~27 mm) est enfoncé dans la plaine : elle sort directement de la cendre.
ECHELLE = 1.25
ETIRE_SOCLE = 1.15
ETIRE_TOUR = 1.5
PIED_TOUR = 117.0  # z du bas de la tour dans le modèle
ENFONCE = 31.0 * ETIRE_SOCLE
FENETRES = 160  # quelques fentes de lumière, surtout en bas : assez pour l'échelle, pas un sapin de Noël


def hauteur(z, piece):
    """z du modèle → z étiré (avant l'échelle générale)."""
    if piece == "tour":
        return PIED_TOUR * ETIRE_SOCLE + (z - PIED_TOUR) * ETIRE_TOUR
    return z * ETIRE_SOCLE


# l'Œil, entre les deux cornes de la tour
OEIL_MODELE = 230.0
OEIL = (0.0, 0.0, (hauteur(OEIL_MODELE, "tour") - ENFONCE) * ECHELLE)


def matiere_kijai():
    """Fer noir et pierre : appareil de blocs, usure claire sur les arêtes (pointiness)."""
    m = bpy.data.materials.new("Fer de Kijai")
    n, l = bd.noeuds(m)
    p = n["Principled BSDF"]
    p.inputs["Metallic"].default_value = 0.6
    geo = n.new("ShaderNodeNewGeometry")
    arete = n.new("ShaderNodeMapRange")
    arete.inputs["From Min"].default_value = 0.5
    arete.inputs["From Max"].default_value = 0.56
    l.new(geo.outputs["Pointiness"], arete.inputs["Value"])
    coord = n.new("ShaderNodeTexCoord")
    briques = n.new("ShaderNodeTexBrick")
    briques.inputs["Scale"].default_value = 0.9
    briques.inputs["Mortar Size"].default_value = 0.012
    briques.inputs["Color1"].default_value = (0.03, 0.026, 0.024, 1)
    briques.inputs["Color2"].default_value = (0.018, 0.016, 0.015, 1)
    briques.inputs["Mortar"].default_value = (0.004, 0.003, 0.003, 1)
    l.new(coord.outputs["Object"], briques.inputs["Vector"])
    bruit = n.new("ShaderNodeTexNoise")
    bruit.inputs["Scale"].default_value = 0.35
    bruit.inputs["Detail"].default_value = 10
    l.new(coord.outputs["Object"], bruit.inputs["Vector"])
    usure = n.new("ShaderNodeMix"); usure.data_type = 'RGBA'
    usure.inputs["B"].default_value = (0.07, 0.052, 0.04, 1)  # fer à peine poli : une silhouette, pas une maquette
    l.new(arete.outputs["Result"], usure.inputs["Factor"])
    l.new(briques.outputs["Color"], usure.inputs["A"])
    # plus on monte, plus le fer est noir : la tour et les cornes se découpent sur le ciel
    sep = n.new("ShaderNodeSeparateXYZ")
    l.new(coord.outputs["Object"], sep.inputs["Vector"])
    nuit = n.new("ShaderNodeMapRange")
    nuit.inputs["From Min"].default_value = 110
    nuit.inputs["From Max"].default_value = 240
    nuit.inputs["To Min"].default_value = 1.0
    nuit.inputs["To Max"].default_value = 0.35
    l.new(sep.outputs["Z"], nuit.inputs["Value"])
    sombre = n.new("ShaderNodeMix"); sombre.data_type = 'RGBA'; sombre.blend_type = 'MULTIPLY'
    sombre.inputs["Factor"].default_value = 1.0
    l.new(usure.outputs["Result"], sombre.inputs["A"])
    l.new(nuit.outputs["Result"], sombre.inputs["B"])
    l.new(sombre.outputs["Result"], p.inputs["Base Color"])
    rug = n.new("ShaderNodeMapRange")
    rug.inputs["To Min"].default_value = 0.65
    rug.inputs["To Max"].default_value = 0.3
    l.new(arete.outputs["Result"], rug.inputs["Value"])
    l.new(rug.outputs["Result"], p.inputs["Roughness"])
    relief = n.new("ShaderNodeBump")
    relief.inputs["Strength"].default_value = 0.35
    somme = n.new("ShaderNodeMath"); somme.operation = 'MULTIPLY_ADD'; somme.inputs[1].default_value = 0.3
    l.new(bruit.outputs["Fac"], somme.inputs[0])
    l.new(briques.outputs["Fac"], somme.inputs[2])
    l.new(somme.outputs["Value"], relief.inputs["Height"])
    l.new(relief.outputs["Normal"], p.inputs["Normal"])
    return m


def importer(fer, lave):
    objets = []
    for nom, fichier in PIECES.items():
        chemin = STL / fichier
        if not chemin.exists():
            raise SystemExit(f"Pièce manquante : {chemin} (voir artworks/kijai/LISEZMOI.md)")
        bpy.ops.wm.stl_import(filepath=str(chemin))
        ob = bpy.context.selected_objects[0]
        ob.name = nom
        piece = "tour" if "Tour" in nom else "socle"
        # tout est appliqué aux sommets : rotation, étirement, échelle, enfoncement
        rot = bd.Matrix.Rotation(ROTATION, 4, 'Z')
        for v in ob.data.vertices:
            x, y, z = v.co
            z = hauteur(z, piece) - ENFONCE + (0.6 if "Lave" in nom else 0.0)
            v.co = (rot @ bd.Vector((x, y, z))) * ECHELLE
        ob.data.update()
        ob.data.materials.clear()
        ob.data.materials.append(lave if "Lave" in nom else fer)
        bpy.context.view_layer.objects.active = ob
        try:  # lisse les grandes surfaces, garde les arêtes vives
            bpy.ops.object.shade_auto_smooth(angle=math.radians(35))
        except Exception:
            for p in ob.data.polygons:
                p.use_smooth = False
        objets.append(ob)
    return objets


def semer_fenetres(objets, mat, nb=FENETRES):
    """Des fentes de braise sur les murs verticaux, au hasard, pondérées par la surface."""
    import random
    rng = random.Random(bd.GRAINE + 7)
    murs = []
    for ob in objets:
        if "Lave" in ob.name:
            continue
        for p in ob.data.polygons:
            # surtout la forteresse basse, rares dans la tour
            haut = p.center.z > 150
            if abs(p.normal.z) < 0.25 and p.area > 0.05 and p.center.z > 4 and (not haut or rng.random() < 0.15):
                murs.append((p.area, p.center.copy(), p.normal.copy()))
    total = sum(a for a, _, _ in murs)
    tirages = sorted(rng.random() * total for _ in range(nb))
    bm = bd.bmesh.new()
    acc, k = 0.0, 0
    for a, c, nrm in murs:
        acc += a
        while k < len(tirages) and tirages[k] <= acc:
            k += 1
            h = rng.uniform(0.6, 1.4)
            ang = math.atan2(nrm.y, nrm.x)
            bd.boite(bm, c + nrm * 0.12, (0.3, 0.32, h), ang)
    return bd.objet_bmesh("Fenêtres (Kijai)", bm, mat)


def loger_oeil():
    """L'Œil de flammes de barad_dur.py, ramené à la taille de l'anneau des cornes."""
    oeil = bpy.data.objects["Œil"]
    halo = bpy.data.objects["Halo"]
    lueur = bpy.data.objects["Lueur de l'Œil"]
    for ob in (oeil, halo, lueur):
        ob.location = OEIL
    oeil.scale = (7.4 * ECHELLE, 1.9 * ECHELLE, 10.5 * ECHELLE * ETIRE_TOUR * 0.85)
    halo.scale = (12.0 * ECHELLE, 6.0 * ECHELLE, 18.0 * ECHELLE * ETIRE_TOUR * 0.85)


# --------------------------------------------------------------------------
# Autour de la Tour : fumées, brume, montagnes, pics, avant-postes
# --------------------------------------------------------------------------

def matiere_panache(nom, densite, lueur):
    """Une colonne de fumée en volume : dense au pied, effilochée en haut, rougie par les forges."""
    m = bpy.data.materials.new(nom)
    n, l = bd.noeuds(m)
    for k in list(n):
        n.remove(k)
    coord = n.new("ShaderNodeTexCoord")
    sep = n.new("ShaderNodeSeparateXYZ")
    l.new(coord.outputs["Generated"], sep.inputs["Vector"])
    # distance à l'axe, rapportée à un panache qui s'évase en montant
    cx = n.new("ShaderNodeMath"); cx.operation = 'SUBTRACT'; cx.inputs[1].default_value = 0.5
    cy = n.new("ShaderNodeMath"); cy.operation = 'SUBTRACT'; cy.inputs[1].default_value = 0.5
    l.new(sep.outputs["X"], cx.inputs[0]); l.new(sep.outputs["Y"], cy.inputs[0])
    rayon = n.new("ShaderNodeVectorMath"); rayon.operation = 'LENGTH'
    axe = n.new("ShaderNodeCombineXYZ")
    l.new(cx.outputs["Value"], axe.inputs["X"]); l.new(cy.outputs["Value"], axe.inputs["Y"])
    l.new(axe.outputs["Vector"], rayon.inputs[0])
    evase = n.new("ShaderNodeMath"); evase.operation = 'MULTIPLY_ADD'
    evase.inputs[1].default_value = 0.38; evase.inputs[2].default_value = 0.12
    l.new(sep.outputs["Z"], evase.inputs[0])
    rel = n.new("ShaderNodeMath"); rel.operation = 'DIVIDE'
    l.new(rayon.outputs["Value"], rel.inputs[0]); l.new(evase.outputs["Value"], rel.inputs[1])
    bord = n.new("ShaderNodeMapRange")
    bord.inputs["From Min"].default_value = 1.0; bord.inputs["From Max"].default_value = 0.2
    l.new(rel.outputs["Value"], bord.inputs["Value"])
    # s'éteint vers le haut
    haut = n.new("ShaderNodeMapRange")
    haut.inputs["From Min"].default_value = 1.0; haut.inputs["From Max"].default_value = 0.55
    l.new(sep.outputs["Z"], haut.inputs["Value"])
    # et naît en douceur au pied (caché dans la forteresse)
    bas = n.new("ShaderNodeMapRange")
    bas.inputs["From Min"].default_value = 0.0; bas.inputs["From Max"].default_value = 0.12
    l.new(sep.outputs["Z"], bas.inputs["Value"])
    hb = n.new("ShaderNodeMath"); hb.operation = 'MULTIPLY'
    l.new(haut.outputs["Result"], hb.inputs[0]); l.new(bas.outputs["Result"], hb.inputs[1])
    bruit = n.new("ShaderNodeTexNoise")
    bruit.inputs["Scale"].default_value = 4.0
    bruit.inputs["Detail"].default_value = 8
    bruit.inputs["Distortion"].default_value = 0.8
    l.new(coord.outputs["Generated"], bruit.inputs["Vector"])
    volutes = n.new("ShaderNodeMapRange")
    volutes.inputs["From Min"].default_value = 0.35; volutes.inputs["From Max"].default_value = 0.75
    l.new(bruit.outputs["Fac"], volutes.inputs["Value"])
    m1 = n.new("ShaderNodeMath"); m1.operation = 'MULTIPLY'
    l.new(bord.outputs["Result"], m1.inputs[0]); l.new(hb.outputs["Value"], m1.inputs[1])
    m2 = n.new("ShaderNodeMath"); m2.operation = 'MULTIPLY'
    l.new(m1.outputs["Value"], m2.inputs[0]); l.new(volutes.outputs["Result"], m2.inputs[1])
    dens = n.new("ShaderNodeMath"); dens.operation = 'MULTIPLY'; dens.inputs[1].default_value = densite
    l.new(m2.outputs["Value"], dens.inputs[0])
    v = n.new("ShaderNodeVolumePrincipled")
    v.inputs["Color"].default_value = (0.03, 0.018, 0.014, 1)  # une fumée sombre, rougie par en dessous
    v.inputs["Absorption Color"].default_value = (0.0, 0.0, 0.0, 1)
    v.inputs["Anisotropy"].default_value = 0.3
    l.new(dens.outputs["Value"], v.inputs["Density"])
    # le pied du panache rougeoie : la forge qui le crache
    if lueur:
        pied = n.new("ShaderNodeMapRange")
        pied.inputs["From Min"].default_value = 0.05; pied.inputs["From Max"].default_value = 0.3
        pied.inputs["To Min"].default_value = lueur; pied.inputs["To Max"].default_value = 0.0
        l.new(sep.outputs["Z"], pied.inputs["Value"])
        e = n.new("ShaderNodeMath"); e.operation = 'MULTIPLY'
        l.new(pied.outputs["Result"], e.inputs[0]); l.new(m2.outputs["Value"], e.inputs[1])
        v.inputs["Emission Color"].default_value = (1.0, 0.28, 0.05, 1)
        l.new(e.outputs["Value"], v.inputs["Emission Strength"])
    o = n.new("ShaderNodeOutputMaterial")
    l.new(v.outputs["Volume"], o.inputs["Volume"])
    return m


def panaches():
    """Les forges de la forteresse crachent leur fumée ; le vent la couche vers l'est."""
    rng = __import__("random").Random(bd.GRAINE + 11)
    fumee = matiere_panache("Panache", 0.04, 0.004)
    lourde = matiere_panache("Panache de l'Orodruin", 0.012, 0.0005)
    sources = [  # (x, y, z du pied, rayon, hauteur, penche)
        (-95, -30, 40, 34, 420, 0.30), (80, -70, 30, 28, 360, 0.36),
        (-45, 75, 120, 40, 480, 0.26), (70, 55, 90, 32, 400, 0.32),
        (-115, 45, 20, 26, 300, 0.40), (20, -110, 15, 22, 260, 0.42),
    ]
    for i, (x, y, z, r, h, penche) in enumerate(sources):
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=1, depth=1, location=(0, 0, 0))
        ob = bpy.context.active_object
        ob.name = f"Panache {i + 1}"
        ob.scale = (r * 2.2, r * 2.2, h)
        ob.location = (x + math.sin(penche) * h / 2, y + rng.uniform(-10, 10), z + math.cos(penche) * h / 2)
        ob.rotation_euler = (rng.uniform(-0.05, 0.05), penche, 0)
        ob.data.materials.append(fumee)
    # l'Orodruin fume aussi, un grand panache qui s'étale sous les nuées
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=1, depth=1, location=(-560, 820, 560))
    ob = bpy.context.active_object
    ob.name = "Panache de l'Orodruin"
    ob.scale = (260, 260, 680)
    ob.rotation_euler = (0, 0.35, 0)
    ob.data.materials.append(lourde)


def brume_basse():
    """Une nappe de brume rouge au ras de la plaine, qui noie le pied de la forteresse."""
    m = bpy.data.materials.new("Brume basse")
    n, l = bd.noeuds(m)
    for k in list(n):
        n.remove(k)
    coord = n.new("ShaderNodeTexCoord")
    sep = n.new("ShaderNodeSeparateXYZ")
    l.new(coord.outputs["Generated"], sep.inputs["Vector"])
    haut = n.new("ShaderNodeMapRange")
    haut.inputs["From Min"].default_value = 0.0; haut.inputs["From Max"].default_value = 1.0
    haut.inputs["To Min"].default_value = 1.0; haut.inputs["To Max"].default_value = 0.0
    l.new(sep.outputs["Z"], haut.inputs["Value"])
    carre = n.new("ShaderNodeMath"); carre.operation = 'POWER'; carre.inputs[1].default_value = 2.0
    l.new(haut.outputs["Result"], carre.inputs[0])
    bruit = n.new("ShaderNodeTexNoise")
    bruit.inputs["Scale"].default_value = 0.012
    bruit.inputs["Detail"].default_value = 4
    l.new(coord.outputs["Object"], bruit.inputs["Vector"])
    nappes = n.new("ShaderNodeMapRange")
    nappes.inputs["From Min"].default_value = 0.3; nappes.inputs["From Max"].default_value = 0.7
    nappes.inputs["To Min"].default_value = 0.25
    l.new(bruit.outputs["Fac"], nappes.inputs["Value"])
    m1 = n.new("ShaderNodeMath"); m1.operation = 'MULTIPLY'
    l.new(carre.outputs["Value"], m1.inputs[0]); l.new(nappes.outputs["Result"], m1.inputs[1])
    dens = n.new("ShaderNodeMath"); dens.operation = 'MULTIPLY'; dens.inputs[1].default_value = 0.0035
    l.new(m1.outputs["Value"], dens.inputs[0])
    v = n.new("ShaderNodeVolumePrincipled")
    v.inputs["Color"].default_value = (0.4, 0.2, 0.13, 1)
    v.inputs["Absorption Color"].default_value = (0.3, 0.1, 0.06, 1)
    v.inputs["Anisotropy"].default_value = 0.4
    l.new(dens.outputs["Value"], v.inputs["Density"])
    o = n.new("ShaderNodeOutputMaterial")
    l.new(v.outputs["Volume"], o.inputs["Volume"])
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 300, 9))
    ob = bpy.context.active_object
    ob.name = "Brume basse"
    ob.scale = (2400, 1800, 30)
    ob.data.materials.append(m)


def chaine():
    """L'Ered Lithui, au nord : une muraille de crêtes noires sur le ciel rouge."""
    pierre = bpy.data.materials.new("Roc de l'Ered Lithui")
    n, _ = bd.noeuds(pierre)
    n["Principled BSDF"].inputs["Base Color"].default_value = (0.005, 0.0045, 0.0045, 1)
    n["Principled BSDF"].inputs["Roughness"].default_value = 1.0
    rng = __import__("random").Random(bd.GRAINE + 12)
    bm = bd.bmesh.new()
    nx, ny = 360, 24
    pics = [(rng.uniform(-2400, 2400), rng.uniform(40, 200), rng.uniform(80, 260)) for _ in range(30)]
    octaves = [(110 / 1.9 ** k, 420 / 2.1 ** k, rng.uniform(0, 6.28)) for k in range(8)]
    lignes = []
    for j in range(ny):
        t = j / (ny - 1)  # 0 : versant face à nous, 1 : la crête
        ligne = []
        for i in range(nx):
            x = -2600 + 5200 * i / (nx - 1)
            # une crête fractale (des sinus aux phases tirées au sort), puis des sommets plus hauts
            crete = 170 + sum(amp * abs(math.sin(x / per + ph)) for amp, per, ph in octaves)
            for px, ph, pl in pics:
                crete += ph * math.exp(-((x - px) / pl) ** 2)
            y = 1350 + 260 * t + 30 * math.sin(x / 180)
            z = -20 + (crete + 20) * math.sin(t * math.pi / 2) ** 0.8
            ligne.append(bm.verts.new((x, y, z)))
        lignes.append(ligne)
    for j in range(ny - 1):
        for i in range(nx - 1):
            bm.faces.new((lignes[j][i], lignes[j][i + 1], lignes[j + 1][i + 1], lignes[j + 1][i]))
    ob = bd.objet_bmesh("Ered Lithui", bm, pierre, lisse=True)
    t = bpy.data.textures.new("crêtes", 'CLOUDS'); t.noise_scale = 40; t.noise_depth = 5
    dep = ob.modifiers.new("éboulis", 'DISPLACE'); dep.texture = t; dep.strength = 35
    dep.texture_coords = 'GLOBAL'
    return ob


def couloir(x, y):
    """Vrai si (x, y) masquerait la forteresse depuis les caméras."""
    if math.hypot(x, y) < 175:
        return True
    if y < -100:
        t = (y + 440) / 340  # 0 à la caméra, 1 devant la forteresse
        centre = 100 - 100 * t
        return abs(x - centre) < 40 + 120 * t
    return False


def pics(pierre):
    """Des aiguilles de roche volcanique qui crèvent la cendre, plus serrées au loin."""
    rng = __import__("random").Random(bd.GRAINE + 13)
    bm = bd.bmesh.new()
    poses = 0
    while poses < 120:
        x, y = rng.uniform(-750, 750), rng.uniform(-420, 700)
        if couloir(x, y):
            continue
        poses += 1
        loin = math.hypot(x - 100, y + 440)
        # en groupes : deux ou trois aiguilles penchées l'une vers l'autre
        for _ in range(rng.choice((1, 1, 2, 3))):
            h = min(rng.uniform(6, 30) * (0.6 + loin / 1100), 40)
            r = h * rng.uniform(0.08, 0.16)
            gx, gy = x + rng.uniform(-r, r) * 2, y + rng.uniform(-r, r) * 2
            # une aiguille en deux tronçons cassés, plus une épaule à son pied
            mi = h * rng.uniform(0.35, 0.6)
            haut = bd.prisme(bm, gx, gy, -4, mi, r, r * 0.6, rng.choice((5, 6, 7)), rng.uniform(0, 6), 0.35, rng)
            bd.prisme(bm, gx + r * 0.6, gy, -4, mi * 0.5, r * 1.3, r * 0.3, 5, rng.uniform(0, 6), 0.4, rng)
            dx0, dy0 = rng.uniform(-0.12, 0.12) * h, rng.uniform(-0.12, 0.12) * h
            for v in haut:
                v.co.x += dx0; v.co.y += dy0
            haut = bd.prisme(bm, gx + dx0, gy + dy0, mi - 1, h, r * 0.6, r * 0.04, rng.choice((4, 5)), rng.uniform(0, 6), 0.3, rng)
            dx, dy = rng.uniform(-0.25, 0.25) * h, rng.uniform(-0.25, 0.25) * h
            for v in haut:
                v.co.x += dx; v.co.y += dy
    return bd.objet_bmesh("Aiguilles", bm, pierre)


def avant_postes(fer, feu):
    """Quelques tours de guet dans la plaine, un feu à leur sommet : l'échelle de la Tour."""
    rng = __import__("random").Random(bd.GRAINE + 14)
    bm, bf = bd.bmesh.new(), bd.bmesh.new()
    for x, y in [(-330, 120), (290, 260), (-520, 380), (430, -60), (-260, -180), (180, 520), (-80, 560)]:
        h = rng.uniform(35, 70)
        r = h * 0.14
        bd.prisme(bm, x, y, -3, h * 0.35, r * 1.8, r * 1.3, 8, 0, 0.1, rng)
        bd.prisme(bm, x, y, h * 0.35, h, r, r * 0.8, 6, 0.3)
        for k in range(4):  # créneaux en crocs
            a = k * math.pi / 2 + 0.3
            bd.prisme(bm, x + r * 0.9 * math.cos(a), y + r * 0.9 * math.sin(a), h, h + r * 1.4, r * 0.3, 0.05, 4)
        bd.boite(bf, (x, y, h + 0.6), (r * 1.1, r * 1.1, 1.2))
        lum = bpy.data.lights.new("Feu de guet", 'POINT')
        lum.color = (1.0, 0.32, 0.07)
        lum.energy = 4e4
        lum.shadow_soft_size = 3
        ob = bpy.data.objects.new("Feu de guet", lum)
        ob.location = (x, y, h + 3)
        bd.lier(ob)
        for z in (h * 0.5, h * 0.75):  # deux fentes de lumière
            a = rng.uniform(0, 6.28)
            bd.boite(bf, (x + r * math.cos(a), y + r * math.sin(a), z), (0.5, 0.5, 1.6), a)
    bd.objet_bmesh("Tours de guet", bm, fer)
    bd.objet_bmesh("Feux de guet", bf, feu)

def silhouette():
    """Moins de lumière de face, un liseré rouge par derrière : la Tour se découpe sur le ciel."""
    for nom in ("Lueur sous la Tour", "Reflet de lave"):
        bpy.data.objects[nom].data.energy *= 0.3
    for nom, pos, cible, e in [
        ("Liseré gauche", (-200, 260, 320), (0, 0, 300), 5e6),
        ("Liseré droit", (220, 240, 260), (0, 0, 240), 4e6),
        ("Liseré forteresse", (60, 300, 120), (0, 0, 110), 4e6),
    ]:
        lum = bpy.data.lights.new(nom, 'AREA')
        lum.energy = e
        lum.size = 60
        lum.spread = math.radians(25)
        lum.color = (1.0, 0.3, 0.07)
        ob = bpy.data.objects.new(nom, lum)
        ob.location = pos
        ob.rotation_euler = (bd.Vector(cible) - bd.Vector(pos)).to_track_quat('-Z', 'Y').to_euler()
        bd.lier(ob)


def construire(cadre):
    if cadre == "regard":
        bd.construire_regard()
        return
    bd.vider_scene()
    fer = bd.matiere_fer()
    pierre = bd.matiere_pierre()
    lave, _ = bd.matiere_braise(30.0, (1.0, 0.28, 0.04, 1))
    lave.name = "Lave"
    lave_socle, _ = bd.matiere_braise(12.0, (1.0, 0.3, 0.05, 1))
    lave_socle.name = "Lave du socle"
    braise_m, _ = bd.matiere_braise(40.0, (1.0, 0.45, 0.1, 1))
    braise_m.name = "Braises"
    cendre_m = bpy.data.materials.new("Cendre")
    n, _ = bd.noeuds(cendre_m)
    n["Principled BSDF"].inputs["Base Color"].default_value = (0.012, 0.011, 0.011, 1)
    n["Principled BSDF"].inputs["Roughness"].default_value = 1.0

    bd.monde()
    bd.plaine(bd.matiere_sol())
    pieces = importer(matiere_kijai(), lave_socle)
    fenetre, _ = bd.matiere_braise(9.0, (1.0, 0.3, 0.06, 1))
    semer_fenetres(pieces, fenetre)
    _, lum_oeil = bd.poser_oeil(bd.matiere_oeil())
    loger_oeil()
    bd.orodruin(pierre, lave)
    bd.nuees(None, bd.matiere_fumee())
    panaches()
    brume_basse()
    chaine()
    pics(pierre)
    feu_guet, _ = bd.matiere_braise(25.0, (1.0, 0.36, 0.08, 1))
    avant_postes(matiere_kijai(), feu_guet)
    c, b = bd.cendres(braise_m, cendre_m)
    bd.lumieres()
    silhouette()
    cam = bd.camera(cadre)
    if cadre == "portrait":
        # un peu plus de recul : la forteresse de Kijai est plus large que la mienne
        cam.location = (40, -330, 3)
        cam.data.lens = 22
        cam.rotation_euler = (bd.Vector((0, 0, 185)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    elif cadre == "paysage":
        cam.location = (100, -440, 8)
        cam.data.lens = 21
        cam.rotation_euler = (bd.Vector((-50, 0, 185)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    elif cadre == "couronne":
        cam.location = (14, -150, OEIL[2] - 18)
        cam.rotation_euler = (bd.Vector(OEIL) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    bd.animer(lum_oeil, b, c)
    # l'anneau des cornes est tout proche : l'Œil l'éclaire moins fort que dans ma tour
    fc = lum_oeil.animation_data.drivers.find("energy")
    fc.driver.expression = fc.driver.expression.replace("2.6e6", "5e5")


if __name__ == "__main__":
    bd.construire = construire  # le reste (options, rendu) est celui de barad_dur.py
    bd.principal()
