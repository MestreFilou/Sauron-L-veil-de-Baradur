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
# le modèle est agrandi, et son socle d'impression (un bloc plat de ~27 mm) est
# enfoncé dans la plaine : la forteresse sort directement de la cendre
ECHELLE = 1.25
ENFONCE = 27.0
# l'Œil, entre les deux cornes de la tour (coordonnées du modèle)
OEIL_MODELE = 230.0
OEIL = (0.0, 0.0, (OEIL_MODELE - ENFONCE) * ECHELLE)


def importer(fer, lave):
    objets = []
    for nom, fichier in PIECES.items():
        chemin = STL / fichier
        if not chemin.exists():
            raise SystemExit(f"Pièce manquante : {chemin} (voir artworks/kijai/LISEZMOI.md)")
        bpy.ops.wm.stl_import(filepath=str(chemin))
        ob = bpy.context.selected_objects[0]
        ob.name = nom
        ob.rotation_euler = (0, 0, ROTATION)
        ob.scale = (ECHELLE,) * 3
        ob.location.z = -ENFONCE * ECHELLE
        ob.data.materials.clear()
        ob.data.materials.append(lave if "Lave" in nom else fer)
        if "Lave" in nom:
            ob.location.z += 0.6 * ECHELLE  # les plaques de lave affleurent dans le socle
        for p in ob.data.polygons:
            p.use_smooth = False
        objets.append(ob)
    return objets


def loger_oeil():
    """L'Œil de flammes de barad_dur.py, ramené à la taille de l'anneau des cornes."""
    oeil = bpy.data.objects["Œil"]
    halo = bpy.data.objects["Halo"]
    lueur = bpy.data.objects["Lueur de l'Œil"]
    for ob in (oeil, halo, lueur):
        ob.location = OEIL
    oeil.scale = (7.4 * ECHELLE, 1.9 * ECHELLE, 10.5 * ECHELLE)
    halo.scale = (12.0 * ECHELLE, 6.0 * ECHELLE, 18.0 * ECHELLE)


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
    importer(fer, lave_socle)
    _, lum_oeil = bd.poser_oeil(bd.matiere_oeil())
    loger_oeil()
    bd.orodruin(pierre, lave)
    bd.nuees(None, bd.matiere_fumee())
    c, b = bd.cendres(braise_m, cendre_m)
    bd.lumieres()
    cam = bd.camera(cadre)
    if cadre == "portrait":
        # un peu plus de recul : la forteresse de Kijai est plus large que la mienne
        cam.location = (40, -300, 4)
        cam.rotation_euler = (bd.Vector((0, 0, 150)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    elif cadre == "couronne":
        cam.location = (14, -150, OEIL[2] - 18)
        cam.rotation_euler = (bd.Vector(OEIL) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    bd.animer(lum_oeil, b, c)
    # l'anneau des cornes est tout proche : l'Œil l'éclaire moins fort que dans ma tour
    fc = lum_oeil.animation_data.drivers.find("energy")
    fc.driver.expression = fc.driver.expression.replace("2.6e6", "9e5")


if __name__ == "__main__":
    bd.construire = construire  # le reste (options, rendu) est celui de barad_dur.py
    bd.principal()
