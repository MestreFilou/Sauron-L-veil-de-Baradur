# Barad-dûr en 3D

La Tour de l'écran de chargement, modélisée de zéro dans Blender par un script Python. Le design est original : il part des mots de Tolkien (une forteresse de fer noir en gradins, hérissée de tours et de créneaux, une couronne de fer, l'Œil « bordé de feu, jaune comme celui d'un chat », sa pupille une fente noire), pas des films.

Ce qu'il y a dans la scène :

- **la Tour** : un socle de roc, quatre gradins à contreforts et créneaux, un fût à facettes de plus de 200 m, trois donjons accolés de hauteurs inégales (la Tour n'est pas symétrique), une vingtaine de tours au pourtour coiffées d'aiguilles ou de crocs, des ponts de fer, des fentes de fenêtres rougeoyantes ;
- **la couronne** : neuf cornes de fer recourbées vers le ciel, avec une brèche face au spectateur pour que l'Œil regarde entre elles ;
- **l'Œil** : une amande de feu (et non une boule), avec sa fente noire, un halo de flammes et sa propre lumière qui éclaire la couronne ;
- **le Mordor** : la plaine de Gorgoroth fendue de lave, l'Orodruin au loin, un ciel de nuées basses rougies par en dessous, de la cendre et des braises qui dérivent.

## Fichiers

| Fichier | Rôle |
|---|---|
| `barad_dur.py` | Construit la scène et la rend (Cycles). Toute la Tour est là, en Python lisible. |
| `finition.py` | Halo des feux (bloom), vignettage, grain, export WebP. Pillow et numpy seulement. |
| `rendus/barad_dur_portrait.webp` | Le rendu 3:5 affiché dans le cadre de l'écran de chargement. |
| `fonds/barad_dur_paysage.webp` | Le rendu 16:9 affiché net derrière le cadre (voir le champ `fond` de `../ecrans.json`). |

Ces WebP sont versionnés, contrairement aux autres artworks : c'est une création du projet.

## Refaire les rendus

Avec Blender 4.2 ou plus récent :

```sh
blender -b -P artworks/3d/barad_dur.py -- --cadre portrait --sortie /tmp/rendus --blend /tmp/barad_dur.blend
blender -b -P artworks/3d/barad_dur.py -- --cadre paysage --sortie /tmp/rendus
python3 artworks/3d/finition.py /tmp/rendus/barad_dur_portrait.png artworks/3d/rendus/barad_dur_portrait.webp
python3 artworks/3d/finition.py /tmp/rendus/barad_dur_paysage.png artworks/3d/fonds/barad_dur_paysage.webp
```

Sans Blender installé, le module `bpy` de PyPI suffit (`pip install bpy`, Python 3.13) : `python artworks/3d/barad_dur.py --cadre portrait`.

Options utiles : `--echelle 0.3 --echantillons 24` pour un aperçu en une minute ; `--cadre couronne` pour un gros plan sur l'Œil ; `--blend fichier.blend` pour ouvrir la scène dans Blender et la retoucher à la main. Le `.blend` n'est pas versionné (il pèse lourd et le script le refait à l'identique).

Le script prépare aussi une boucle animée de 4 s (flammes de l'Œil, halo, braises qui montent, l'Œil qui respire) : `--images 1:96` en rend les images.

Compter environ 25 minutes par rendu final sur un processeur à 4 cœurs.
