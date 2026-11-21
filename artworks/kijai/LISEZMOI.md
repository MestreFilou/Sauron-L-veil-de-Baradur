# Barad-dûr d'après le modèle de Kijai (local, jamais versionné)

Ce dossier contient le modèle **« Barad-Dûr, The Dark Tower » de Kijai (Kijai Design)** et les rendus que le jeu en tire.

- Source : https://www.printables.com/model/234578-barad-dur-the-dark-tower
- Licence : **Creative Commons BY-NC-ND 4.0** (https://creativecommons.org/licenses/by-nc-nd/4.0/). Il faut créditer l'auteur, aucun usage commercial n'est permis, et aucune version modifiée ne peut être diffusée.

Les rendus faits dans Blender sont une adaptation du modèle. Ils servent donc au jeu **en privé seulement**. C'est pourquoi tout ce dossier est ignoré par git, sauf ce fichier : ni les STL ni les rendus n'entrent dans le dépôt. Si le jeu est publié un jour, il faudra retirer ces rendus (le jeu retombe alors tout seul sur la Tour modélisée dans `artworks/3d/`) ou obtenir l'accord de Kijai.

## Installer

1. Mettre les STL de l'archive de Kijai dans `stl/` : `baraddur_bottom_01_kijaidesign.stl`, `baraddur_tower_01_kijaidesign.stl`, `baraddur_lava_03_kijaidesign.stl`.
2. Faire les rendus (Blender 4.2+, ou `pip install bpy`) :

```sh
python artworks/3d/barad_dur_kijai.py --cadre portrait --nom portrait --sortie /tmp/kijai
python artworks/3d/barad_dur_kijai.py --cadre paysage  --nom paysage  --sortie /tmp/kijai
python artworks/3d/barad_dur_kijai.py --cadre paysage  --nom titre    --sortie /tmp/kijai --sans-pupille
mkdir -p artworks/kijai/rendus
python3 artworks/3d/finition.py /tmp/kijai/portrait.png artworks/kijai/rendus/barad_dur_portrait.webp
python3 artworks/3d/finition.py /tmp/kijai/paysage.png  artworks/kijai/rendus/barad_dur_paysage.webp 85
python3 artworks/3d/finition.py /tmp/kijai/titre.png    artworks/kijai/rendus/barad_dur_titre.webp 85
```

Le jeu les prend alors en priorité, pour l'écran titre et le premier écran de chargement, et les crédits nomment Kijai.
