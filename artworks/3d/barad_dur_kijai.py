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
FENETRES = 1000  # fentes de lumière semées sur les murs : c'est elles qui donnent l'échelle


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
    usure.inputs["B"].default_value = (0.16, 0.12, 0.09, 1)  # fer poli par le vent de cendre
    l.new(arete.outputs["Result"], usure.inputs["Factor"])
    l.new(briques.outputs["Color"], usure.inputs["A"])
    l.new(usure.outputs["Result"], p.inputs["Base Color"])
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
            if abs(p.normal.z) < 0.25 and p.area > 0.05 and p.center.z > 4:
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
    fenetre, _ = bd.matiere_braise(22.0, (1.0, 0.36, 0.08, 1))
    semer_fenetres(pieces, fenetre)
    _, lum_oeil = bd.poser_oeil(bd.matiere_oeil())
    loger_oeil()
    bd.orodruin(pierre, lave)
    bd.nuees(None, bd.matiere_fumee())
    c, b = bd.cendres(braise_m, cendre_m)
    bd.lumieres()
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
