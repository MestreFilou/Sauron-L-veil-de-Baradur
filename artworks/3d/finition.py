"""
Finition des rendus de Barad-dûr : halo lumineux (bloom) autour des feux,
vignettage, léger grain, puis export WebP pour le jeu.

    python artworks/3d/finition.py rendus/barad_dur_portrait.png sortie.webp
    python artworks/3d/finition.py --planche dossier/f_*.png artworks/3d/regard/oeil_regard.webp

La planche assemble les images de l'Œil de l'interface (--cadre regard) en
une grille de 8 colonnes, fond noir changé en transparence.

Il suffit de Pillow et numpy (pas besoin de Blender).
"""
import sys

import numpy as np
from PIL import Image, ImageFilter


def flou(a, rayon):
    im = Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8))
    return np.asarray(im.filter(ImageFilter.GaussianBlur(rayon)), dtype=np.float32) / 255


def finir(entree, sortie, qualite=90):
    im = Image.open(entree).convert("RGB")
    a = np.asarray(im, dtype=np.float32) / 255
    h, w, _ = a.shape
    d = max(w, h)
    # bloom : seules les braises (lave, fenêtres, l'Œil) débordent
    lum = a.max(axis=2, keepdims=True)
    feux = a * np.clip((lum - 0.45) / 0.4, 0, 1)
    halo = 0.55 * flou(feux, d * 0.004) + 0.45 * flou(feux, d * 0.014) + 0.35 * flou(feux, d * 0.04)
    halo *= np.array([1.0, 0.55, 0.3], dtype=np.float32)  # le halo tire vers l'orange
    a = 1 - (1 - a) * (1 - np.clip(halo, 0, 1))  # fusion « écran »
    # vignettage doux
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    r = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h * 0.45) / (h / 2)) ** 2)
    a *= (1 - 0.45 * np.clip(r - 0.55, 0, 1) ** 1.5)[..., None]
    # grain de cendre, très léger
    rng = np.random.default_rng(1937)
    a += rng.normal(0, 0.012, (h, w, 1)).astype(np.float32)
    out = Image.fromarray(np.clip(a * 255 + 0.5, 0, 255).astype(np.uint8))
    if sortie.lower().endswith(".webp"):
        out.save(sortie, "WEBP", quality=qualite, method=6)
    else:
        out.save(sortie)


def planche(images, sortie, colonnes=8):
    """Assemble les images en grille ; le noir devient transparent (le feu garde sa lumière)."""
    ims = [np.asarray(Image.open(f).convert("RGB"), dtype=np.float32) / 255 for f in sorted(images)]
    h, w, _ = ims[0].shape
    lignes = (len(ims) + colonnes - 1) // colonnes
    out = np.zeros((h * lignes, w * colonnes, 4), dtype=np.float32)
    for i, a in enumerate(ims):
        alpha = np.clip(a.max(axis=2, keepdims=True) * 1.25, 0, 1)
        rgb = np.where(alpha > 1e-4, np.clip(a / np.maximum(alpha, 1e-4), 0, 1), 0)
        y, x = (i // colonnes) * h, (i % colonnes) * w
        out[y:y + h, x:x + w, :3] = rgb
        out[y:y + h, x:x + w, 3:] = alpha
    Image.fromarray((out * 255 + 0.5).astype(np.uint8), "RGBA").save(sortie, "WEBP", quality=86, method=6)
    print(f"{len(ims)} images de {w}×{h}, {colonnes} colonnes → {sortie}")


if __name__ == "__main__":
    if sys.argv[1] == "--planche":
        planche(sys.argv[2:-1], sys.argv[-1])
    else:
        finir(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 90)
