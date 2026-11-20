# L'Œil de Barad-dûr : direction artistique

*Version 1 · périmètre : Eriador · stack cible : React (interface) + PixiJS (carte, effets)*
Maquette associée : `maquette-ecran-principal.html` (même dossier).

---

## 1. L'intention

Le joueur ne voit jamais le monde « tel qu'il est ». Il le voit à travers trois instruments de pouvoir, et chacun a sa propre peau visuelle :

| Registre | Ce que c'est | Ce qu'on doit ressentir |
|---|---|---|
| **La Carte** | le monde tel que la Tour l'a relevé : un parchemin d'archiviste, encre brune, toponymes à la main | le savoir, l'ancien, l'Eriador immédiatement reconnaissable |
| **L'Œil** | un cône de lumière rouge qui rend une zone nette et laisse le reste flou, éteint, enfumé | la puissance, mais étroite : on voit tout d'un endroit, rien du reste |
| **Le Monde de l'Ombre** | la vision des Neuf : un négatif froid du parchemin, où ne ressortent que les auras, la peur et la trace de l'Anneau | l'étrangeté ; on perd les détails, on gagne l'invisible |

À cela s'ajoute la **Corruption**, qui n'est pas un registre mais une blessure : le parchemin noircit, se craquelle, et des braises courent dans les fissures. On voit l'Ombre gagner sur la carte elle-même.

Principe directeur, tiré du GDD : *l'ombre rampante plutôt que le spectaculaire.* Le rouge et la lumière sont rares, donc précieux. Ils marquent l'Œil, les braises de la corruption, et c'est à peu près tout.

---

## 2. Palette

### Parchemin (la Carte)
| Rôle | Hex |
|---|---|
| Vélin clair | `#EBDEBA` |
| Vélin ombré | `#C4A876` |
| Encre de fer-galle (traits, texte) | `#3A2A1C` |
| Encre rouge (lieux majeurs, routes) | `#7D2414` / `#7D2D19` |
| Encre d'eau (rivières, mer) | `#2F3D47` |

### Corruption
| Rôle | Hex |
|---|---|
| Suie (cœur) | `#100C0A` → `#2A1E17` (marbré) |
| Lisière brûlée | `#69391A` |
| Roussi (halo sur le parchemin) | `#784E26` à 30 % |
| Braise des fissures | `#FF6E28`, lueur `#FF3D00` |

### L'Œil
| Rôle | Hex |
|---|---|
| Cœur blanc-jaune | `#FFF3B8` |
| Iris | `#FFB347` → `#FF4D12` → `#9C1508` |
| Cône / lisière | `#FF3B0A` (en mode *screen*, 10 à 30 %) |

### Monde de l'Ombre
| Rôle | Hex |
|---|---|
| Fond (nuit froide) | `#02050A` |
| Traits du monde (négatif) | `#8CC4E4` |
| Spectres | `#DEEEFA`, halo `#9EC9E6` |
| Peur / emprise de l'Ombre | `#A08CE6` / `#783CC8` |
| L'Anneau et sa trace | `#F2C14E`, reflets `#FFE296` |
| Lumière des Eldar (Fondcombe, Havres) | `#C8E4FF` → blanc |
| Êtres des Galgals | `#78D2A0` |

### Interface (Barad-dûr)
| Rôle | Hex |
|---|---|
| Obsidienne (fond des panneaux) | `#0D0B0A` / `#15110F` |
| Filets, bordures | `#4A3A28` |
| Bronze terni (titres, accents) | `#8C6A3F` / `#C9A46A` |
| Texte | `#DCCAB0`, secondaire `#A8977C` |
| Registres de la Voix | Paranoïa `#9A7BD0` · Annatar `#E2B85C` · Fer `#D0442A` |

Règle : en Monde de l'Ombre, toute l'interface bascule (bronze → bleu acier `#4F7894`, titres `#9EC9E6`). Le joueur doit sentir le changement de perception jusque dans les cadres.

---

## 3. Typographie

| Usage | Police | Pourquoi |
|---|---|---|
| Titres, capitales lapidaires, jauges, grandes régions de la carte | **Cinzel** (Google Fonts, OFL) | capitales romaines gravées : autorité, pierre, inscriptions |
| Toponymes, rumeurs, pensées surprises, voix | **IM Fell English** (+ **IM Fell English SC**) | fonte du XVIIᵉ siècle numérisée avec ses imperfections : une encre qui bave, parfaite pour la carte et les textes « trouvés » |
| Corps de l'interface, descriptions | **Cormorant Garamond** | lisible en petit, élégant, cohérent avec les deux autres |
| Runes décoratives | **Cirth procédurales** (dans la maquette) ; en production, **Tengwar Annatar** ou **Tengwar Formal** (polices gratuites de la communauté) | vraies lettres elfiques pour les inscriptions : bandeaux de la carte, coins des panneaux, inscription de l'Anneau |

Règles :
- Les runes et le tengwar sont **toujours décoratifs ou doublés** d'un texte lisible. Aucune information de jeu ne doit être seulement en elfique.
- Toponymes : régions en capitales Cinzel très espacées (comme sur les cartes de Tolkien), lieux en Fell romain, cours d'eau et forêts en Fell italique.
- Les lieux majeurs (Bree, Mont Venteux, Gué, Fondcombe) sont à l'encre rouge, comme sur les cartes manuscrites originales.
- Les noms suivent la traduction française (Ledoux) : Bree, Hobbitebourg, Creux-de-Crique, Mont Venteux, Fontgrise, Fondcombe, etc.

### Rumeurs en fragments
Chaque rumeur porte une **fiabilité** (0 à 1) qui pilote son rendu : lettres pâlies, lettres presque effacées (flou), mots entiers noyés sous une tache d'encre. Une rumeur fiable se lit d'un trait ; une rumeur de taverne se devine. Le tampon « CONTREDIT » marque deux sources qui s'opposent. C'est de la typographie comme mécanique : le joueur *lit* l'incertitude.

---

## 4. Style d'illustration

**Référence principale : les cartes manuscrites de Tolkien lui-même**, et le style « carte d'atlas ancien » qui en découle.
- Montagnes en profil à l'encre, versant est hachuré ; collines en petites bosses ; forêts en couronnes d'arbres serrées ; marais en touffes ; côtes doublées de lignes d'eau parallèles.
- Routes en pointillés rouges, ruines en petits losanges, rose des vents et cartouche « relevé par les espions de la Tour ».
- Le parchemin vit : grain, fibres, taches, pliures, bords brûlés.

**Pions** : jetons de fer forgé à liseré bronze, silhouette encapuchonnée (couronne pour le Roi-Sorcier). Posture *Traque* = anneau pointillé ; *Fléau* = halo rouge (ça se voit de loin, comme la Visibilité qu'il coûte).

**Portraits** (fiches de personnages, Voix) : gravure / eau-forte monochrome sur fond sombre, une seule lumière. En Monde de l'Ombre, le même portrait passe en négatif bleu avec l'aura du personnage.

**Spectres** : silhouettes pâles, sans visage, bord déchiqueté qui ondule, cercles de peur violacés qui s'étendent au sol.

À éviter : la fantasy brillante et saturée, les effets « magiques » partout, les cadres dorés surchargés, les illustrations photoréalistes. Tout doit pouvoir sortir d'une plume ou d'une forge.

---

## 5. Les effets, et leur traduction en PixiJS

La maquette est en Canvas 2D pour tourner partout sans installation ; chaque effet a un équivalent direct en PixiJS v8.

| Effet | Maquette | PixiJS |
|---|---|---|
| Parchemin | bruit fractal + grain + taches, pré-calculé | texture pré-cuite (ou générée au chargement) ; `NoiseFilter` léger animé |
| Flou hors du Regard | version réduite, désaturée, assombrie, agrandie | `RenderTexture` de la carte + `BlurFilter` + `ColorMatrixFilter` (désaturer, assombrir) |
| Zone nette du Regard | copie nette masquée par un dégradé elliptique | même carte non filtrée, avec un `mask` (sprite de dégradé radial) qui suit le focus |
| Cône rouge | polygone en dégradé, mode *screen*, rayons qui ondulent | `Graphics` + `blendMode: 'screen'`, plus un `DisplacementFilter` léger pour la chaleur |
| Corruption | champ de bruit seuillé par le niveau d'emprise + fissures en arbre qui grandissent | shader de fragment : `step(bruit + distance, emprise)` sur une texture de suie, fissures en `Graphics` ou en texture de champ de distance, braises en *add* avec glow (`pixi-filters` : `GlowFilter`) |
| Monde de l'Ombre | négatif froid du parchemin, visible seulement près des Neuf | `ColorMatrixFilter` (négatif + teinte) sur la carte ; masque = somme des cercles de vision des Nazgûl ; auras en sprites additifs ; `DisplacementFilter` ondulant ; transition par fondu + flash |
| Trace de l'Anneau | courbe dorée de plus en plus vive vers le présent | `MeshRope` ou `Graphics` avec dégradé d'alpha, particules (`@pixi/particle-emitter`) |
| Œil (HUD) | champ de feu calculé par pixel + pupille vectorielle (voir §5 bis) | un `Filter` à shader de fragment sur un petit `Sprite`, plus un `Graphics` pour la pupille |

**Découpage React / Pixi** : un seul `<canvas>` Pixi plein écran pour la carte et tous les effets ; React par-dessus pour les panneaux (Neuf, Murmures, Voix, jauges, fiche de région). L'état du jeu (store type Zustand) alimente les deux ; Pixi ne fait qu'afficher.

**Carte très grande** : découper en tuiles (512 ou 1024 px) et plusieurs niveaux de zoom, ne charger que ce qui est visible (`pixi-viewport` pour le déplacement/zoom). La corruption et le Monde de l'Ombre fonctionnent par région, donc par tuile.


### 5 bis. L'Œil : comment il est construit

L'Œil est un petit canevas de **216 × 136 px** (CSS) accroché au centre de la barre du haut. Son centre est à **y = 40 px** de l'écran, et c'est de ce point que part le cône. Code de référence : `eyeField()` et `drawEye()` dans la maquette.

**Repère.** On calcule un champ de **176 × 110 px**. Pour chaque pixel, `x` va de −1 à 1 sur la largeur, et `y` utilise la même unité (repère isotrope).

**1. La forme en amande.** Demi-largeur `EA = 0.60`, demi-hauteur `EB = 0.25`. On calcule une distance signée `d`, négative à l'intérieur :
- si `|x| < EA` : `h = EB · (1 − (x/EA)²)^0.72` puis `d = |y| − h` (l'exposant 0.72 donne les pointes) ;
- sinon : `d = distance au point (±EA, 0)`.

**2. L'iris (d < 0).** C'est du feu qui tourbillonne et rayonne depuis la pupille.
- Centre décalé par le regard : `gx = gaze.x · 0.11`, `gy = gaze.y · 0.05`, où `gaze` est un vecteur unitaire au plus qui pointe vers la zone regardée, lissé dans le temps.
- `r = |(x − gx, (y − gy) · 2.1)| / EA` et `a = atan2(...)`.
- Fibres radiales : `fib = fbm(cos a · 2.2 + 7, sin a · 2.2 + r · 3.2 − t · 1.1, 3 octaves)`. Le terme `− t · 1.1` fait couler le feu vers l'extérieur.
- Remous : `sw = fbm(x · 7 + t · 0.4, y · 7 − t · 0.7, 2)`.
- Chaleur : `h = 1.12 − 1.15 · r + 1.4 · (fib − 0.5) + 0.5 · (sw − 0.5)`.
- Le bord s'assombrit : `h *= 0.35 + 0.65 · smoothstep(0, 0.09, −d)`, puis `h *= 1 + 0.6 · flare`.
- Couleur : `R = sat(2.1h + 0.22)`, `G = 0.84 · sat(2.1h − 0.85)`, `B = 0.66 · sat(2.1h − 1.85)`, alpha 1. On obtient du rouge sombre au bord, de l'orange, puis du jaune-blanc près de la pupille.

**3. La couronne de flammes (0 ≤ d < 0.5).**
- Longueur des flammes : `L = 0.08 + 0.15 · up + 0.07 · |x|/EA`, avec `up = 1` au-dessus de l'œil et `0.4` en dessous. Les flammes montent, et s'étirent aux pointes.
- Bruit qui monte : `n = fbm(x · 5.2 + 0.15 · sin(0.7t + 3y), y · 4.6 + 2.1t, 3)`.
- Intensité : `I = (2n − 0.55) · (1 + 0.6 · flare) − d/L + 0.7 · exp(−d / 0.025)`.
- **Paupière** : si `d < 0.018`, alors `I *= 0.15 + 0.85 · d/0.018`. Ce liseré sombre dessine l'amande.
- Couleur : `R = sat(2.1I)`, `G = 0.72 · sat(2.1I − 1)`, `B = 0.5 · sat(2.1I − 2)`, alpha `sat(2.4I)`.

**4. Composition.** Le champ est dessiné deux fois, agrandi jusqu'à la taille de l'Œil : d'abord flouté (5 px, alpha 0.45, mode additif) pour le halo, puis net par-dessus. Une ombre CSS `drop-shadow(0 0 14px rgba(255,59,10,.45))` diffuse la lueur sur la barre du haut.

**5. La pupille**, en vectoriel pour rester nette :
- un assombrissement rouge sombre (`multiply`, dégradé radial étiré en hauteur) autour de la fente ;
- la fente : deux courbes quadratiques de `(0, −ph)` à `(0, ph)` avec le point de contrôle à `±1.9 · pw`, où `ph = 1.02 · EB · U` et `U` est la demi-largeur du canevas ;
- remplissage `#050101`, lueur `rgba(255,70,10,.9)` de 6 px, contour fin `rgba(255,120,40,.35)` ;
- elle suit le regard avec le même décalage que l'iris.

**6. Ce qui l'anime.**
- **Largeur de la pupille** `pw = U · tw`, avec `tw = 0.075` quand le Regard erre et `0.032` quand il est posé. Elle respire (`× 1 + 0.1 · sin(0.0021 t)`) et se dilate avec le flare (`× 1 + 0.5 · flare`). Lissage : `pw += (tw − pw) · min(1, 0.006 · dt)`.
- **Flare**, de 0 à 1 : il passe à 1 quand on pose le Regard, à 0.8 quand on corrompt une région et à 0.7 quand on projette la Voix. Il décroît de 0.0009 par ms. Il attise l'iris et les flammes, et multiplie les braises.
- **Braises** : 26 au plus. Elles naissent sur le bord de l'amande, montent à 0.025–0.065 px/ms en ondulant, s'éteignent en 0.9 s environ et sont dessinées en mode additif.
- **Monde de l'Ombre** : l'Œil passe en `grayscale(.6) brightness(.5)`. Ce ne sont plus ses yeux qui regardent.

**Portage PixiJS.** Les étapes 1 à 3 deviennent un shader de fragment (un `Filter` sur un `Sprite` de 176 × 110 agrandi, ou directement à la taille finale, car le GPU s'en moque). Le `fbm` de la maquette est un bruit de valeur à 3 octaves (fréquence × 2.03, amplitude × 0.5, normalisé) ; n'importe quel `fbm` GLSL classique fait l'affaire. Uniformes : `uTime`, `uGaze` (vec2), `uFlare`. Le halo de l'étape 4 se fait avec un `BlurFilter` sur une copie en `blendMode: 'add'`, ou avec le `GlowFilter` de pixi-filters. La pupille (étape 5) se fait avec un `Graphics`, et les braises avec un `ParticleContainer`.

---

## 6. Comment obtenir les assets

1. **La carte (le plus important)** : à dessiner en **vectoriel** (Inkscape, Affinity ou Figma), par calques : côtes, eaux, reliefs, forêts, routes, lieux, toponymes. Pour les montagnes, arbres et collines, faire une **bibliothèque de 15 à 20 symboles à la plume** (scannés ou dessinés à la tablette dans Krita) qu'on répartit. Un script exporte ensuite les tuiles PNG à chaque niveau de zoom. La maquette montre qu'on peut même générer une bonne partie procéduralement (chaînes de montagnes, forêts) à partir de simples tracés.
2. **Textures de parchemin, suie, papier brûlé** : banques CC0 (ambientCG, Poly Haven, textures.com en gratuit) ou génération procédurale comme dans la maquette.
3. **Polices** : Google Fonts (Cinzel, IM Fell, Cormorant, toutes en licence OFL) ; Tengwar Annatar / Formal pour l'elfique.
4. **Portraits et illustrations** : génération par IA d'image (Midjourney, Flux, SDXL) avec un **prompt de style figé** (*« gravure à l'eau-forte, encre noire sur papier ancien, une seule source de lumière, style illustration du XIXᵉ »*), puis repasse dans Krita/Photoshop pour unifier (niveaux, grain, monochromie). Comme le jeu reste personnel, on peut nommer les personnages directement dans les prompts.
5. **Pions, icônes, cadres** : SVG faits main (simples, quelques dizaines), ce qui garde un trait cohérent et un poids nul.
6. **Effets** : tout en code (shaders/filtres), aucune vidéo, aucun sprite animé lourd.

Ordre conseillé : carte de l'Eriador → shaders Œil / Corruption / Ombre → pions et icônes → portraits.

---

## 7. L'écran principal (ce que montre la maquette)

- **Plein écran** : la carte, avec l'Œil qui suit la souris. Cliquer pose le Regard sur une région et ouvre sa fiche (emprise de l'Ombre, pensées surprises, la cible sent le Regard).
- **En haut** : titre, tour et date (3 octobre 3018 T.A.), jauges Visibilité / Terreur / Unité de l'Ouest. L'Œil est accroché au centre ; c'est de lui que part le cône.
- **À gauche** : les Neuf, avec posture (Traque / Fléau), position et force du signal (le Septième, près du Gué, décroche).
- **À droite** : les Murmures, avec la piste de l'Anneau et des rumeurs plus ou moins effacées. Survoler une rumeur fait pulser son sceau sur la carte.
- **En bas** : la Voix de Sauron (cible, trois registres colorés, texte libre, risque de duel mental). Projeter la Voix fait partir les lettres en braises.
- **En bas à gauche** : bascule Œil / Monde de l'Ombre et « Corrompre la région » pour voir le parchemin noircir.

Les révélations à essayer : regarder le **Marais aux Moucherons** (les hobbits et Grand-Pas apparaissent), le **Mont Venteux** (Gandalf repousse le Regard), **Fondcombe** (le Regard glisse), puis passer en Monde de l'Ombre pour voir la trace de l'Anneau.
