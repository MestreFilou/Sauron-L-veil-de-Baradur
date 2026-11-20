# L'Œil de Barad-dûr : document de mécaniques (v0.1)

> Document de conception, pas de code. Il complète le GDD (`game_design_document_l_il_de_barad_d_r.md`).
> Tous les chiffres sont des **valeurs de départ à équilibrer** en jouant le prototype. Ils sont là pour que le code puisse être écrit sans trou.

---

## 0. Principes directeurs

1. **Le code décide, le LLM raconte.** Chaque résultat (réussite, échec, détection, déplacement) est calculé par des règles déterministes et des jets de dés. Le LLM reçoit le résultat déjà tranché et l'habille en texte. Seule exception bornée : l'analyse du murmure en texte libre (section 4.3), où le LLM renvoie des étiquettes structurées que le code convertit en bonus plafonnés.
2. **Tout gain coûte de la Visibilité.** Il n'existe aucune action qui rapporte sans exposer Sauron. Le joueur gère un budget d'ombre.
3. **L'information est la ressource principale.** L'Œil donne la vérité sur un point, les Murmures donnent du bruit partout. Les meilleures actions exploitent un secret vérifié.
4. **Carte en graphe de régions.** L'Eriador est le premier « royaume » d'une carte qui s'étendra (section 7).

---

## 1. Le temps et le périmètre

- **1 tour = 1 jour.** L'Acte I (Eriador) couvre environ 30 tours, du 22 septembre 3018 T.A. (les Cavaliers arrivent dans le Comté) jusqu'au Gué de Bruinen vers le 20 octobre.
- Les PNJ suivent un **calendrier canon** par défaut (départ de Frodon, Bree, Montauvent, Gué). Les actions du joueur le font dévier : c'est tout l'enjeu.
- Jalons canon utilisés comme horloge (dates approximatives, à caler) :

| Tour | Date | Événement par défaut si Sauron n'intervient pas |
|---|---|---|
| 1 | 22 sept. | Khamûl et un compagnon entrent dans le Comté |
| 2 | 23 sept. | Frodon quitte Cul-de-Sac |
| 4 | 25 sept. | Les Hobbits entrent dans la Vieille Forêt |
| 8 | 29 sept. | Le Poney Fringant, rencontre avec l'Arpenteur |
| 9 | 30 sept. | Attaque de Creux-de-Crique et de l'auberge |
| 15 | 6 oct. | Montauvent (Amon Sûl) |
| 29 | 20 oct. | Gué de Bruinen |

---

## 2. Les jauges et ressources

### 2.1 Visibilité (V), globale, 0 à 100

Mesure à quel point l'Ouest perçoit que Sauron est actif et sait ce qu'il cherche.

| Seuil | Effet (déclenché une fois, irréversible) |
|---|---|
| 20 | Les rumeurs d'« Hommes Noirs » circulent. Les murmures en provenance de Bree deviennent moins fiables (-10 %), les gens se taisent. |
| 40 | Gandalf (s'il est libre) et les Rôdeurs passent en mode alerte : déplacements accélérés de +1 région/2 tours, Méfiance de base +10 pour tous les héros. |
| 60 | Elrond convoque des alliés : Glorfindel part en patrouille (il chasse activement les Nazgûl isolés). |
| 80 | L'Ouest s'unit : Doute de tous les héros -20, et la Voix coûte +1 PA. |
| 100 | **« L'Ouest s'éveille »** : fin de l'Acte I en défaite partielle (voir 8). |

- **Décroissance** : -2 par tour sans aucune action « visible » (V+3 ou plus) ce tour-là. Plancher : la Visibilité ne redescend jamais sous le palier atteint moins 10 (une fois découvert, on ne se cache plus tout à fait).
- V de départ : **10**.

### 2.2 Doute (D), par personnage, 0 à 100

Mesure à quel point l'esprit d'un personnage est fissuré. C'est la porte d'entrée de la Voix.

- Valeurs de départ indicatives : Frodon 15, Sam 5, Merry 10, Pippin 25, Aragorn 20, Gandalf 5, Elrond 0, Glorfindel 0, Prosper Poiredebeurre 30, Bill Fougeard 60, Saroumane 55 (hors carte, Acte II).
- **Hausse** : Voix réussie (+10 à +25), Terreur forte dans sa région (+5/tour si T ≥ 60), blessure par une lame de Morgul (+5/tour tant que non soignée), porter l'Anneau (+3 par utilisation).
- **Baisse** : -3/tour en présence d'un Sage (Gandalf, Elrond, Glorfindel) dans la même région, -10 au repos à Fondcombe, -5 quand un allié de confiance est présent.
- **Seuils** : à 50, le personnage peut cacher une information à ses alliés ou faire un mauvais choix de route ; à 75, il peut trahir une fois (action dictée par Sauron) ; à 100, il est **brisé** (quitte la partie ou devient un pion, selon le personnage).

### 2.3 Volonté (W), par personnage, fixe

Stat de résistance. Frodon 55, Sam 70, Merry 45, Pippin 35, Aragorn 80, Gandalf 95, Elrond 95, Glorfindel 90, Bill Fougeard 20, PNJ commun 30.
La Volonté ne change pas, sauf événements narratifs majeurs (+10 maximum par acte).

### 2.4 Méfiance (M), par personnage, 0 à 100

Mesure à quel point le personnage **sent** le regard ou la voix de Sauron. Elle grimpe quand on l'observe ou qu'on lui parle.

- +15 quand l'Œil se pose sur lui si W ≥ 60, +5 sinon.
- +10 après une Voix réussie, +25 après une Voix ratée.
- -5 par tour sans contact.
- Effet : chaque point de Méfiance réduit les chances de la Voix de 0,5 point. À M ≥ 70, le personnage prévient ses alliés (+5 Méfiance pour tout son groupe) et V +2.

### 2.5 Terreur (T), par région, 0 à 100

Mesure la peur ambiante dans une région.

| Seuil | Effet |
|---|---|
| 30 | **Inquiète** : les auberges ferment tôt, les portes se barrent. Les espions humains rapportent moins (-1 murmure de cette région). |
| 60 | **Sous l'Ombre** : la population fuit ou se terre. Doute +5/tour pour les héros présents. Génère +1 Essence/tour. V +1/tour passivement. |
| 80 | **Écrasée** : condition nécessaire pour la Corruption (section 6.4). |

- Décroissance : -5 par tour sans Nazgûl présent, -10 si un Sage est présent.

### 2.6 Points d'Action (PA) : la Volonté de Sauron

- **4 PA par tour** au départ, +1 par étape de Forme (section 6.2), maximum 8.
- Les PA non dépensés sont perdus (pas de stockage). Un retour de flamme en duel mental retire 1 PA au tour suivant.

### 2.7 Essence d'Ombre (E), stock

La monnaie de progression (Forme, Corruption, rituels).

- Gains : +1/tour par région à T ≥ 60, +2/tour par région Corrompue, +3 par duel mental gagné, +2 par héros brisé ou blessé par une lame de Morgul, +1 par murmure correctement classé « vrai » ou « faux » avant la fin du tour suivant (récompense la déduction).
- E de départ : **5**.

### 2.8 Piste de l'Anneau, cachée

Le code connaît la position exacte du porteur. Le joueur, lui, voit une **carte de chaleur** (probabilité estimée par région) qu'il construit à partir des murmures et de l'Œil.

- Chaque tour, le porteur laisse une trace dans sa région : **force 1** (Anneau caché), **force 5** si le porteur a mis l'Anneau ce tour (Bree, Montauvent, Gué).
- Détection par un Nazgûl en Vision Spectrale dans la même région : 40 % + 15 % × force de la trace (plafonné à 95 %). Khamûl +20 %. La nuit +10 %.
- Si le porteur met l'Anneau : **Pulsation**. Tous les Nazgûl à 2 régions ou moins apprennent sa position exacte, l'Œil peut se poser dessus le tour suivant sans coût de Méfiance, et V +3 (les Sages sentent aussi le frémissement).

---

## 3. La boucle d'un tour

Le tour se découpe en six phases. Les phases 2 et 4 sont les seules où le joueur décide.

```
1. Aube (code)          monde, déplacements PNJ, décroissances
2. L'Œil se pose        le joueur choisit UNE cible
3. Murmures             5 rapports fragmentaires générés (Haiku)
4. Ordres               le joueur dépense ses PA (Voix, Nazgûl, agents, corruption)
5. Crépuscule (code)    résolution, jets, détection, textes (Sonnet pour la Voix)
6. Nuit (code)          bilan des jauges, seuils, événements, sauvegarde
```

### Phase 1 : Aube (automatique)

1. Les PNJ avancent selon leur plan de route (calendrier canon modifié par les états : un Hobbit à D ≥ 50 peut choisir une route plus risquée, Aragorn évite les routes à T ≥ 60).
2. Décroissances : V (-2 si aucune action visible au tour précédent), T (-5 par région), M (-5 par personnage).
3. Les effets à durée avancent (blessure de Morgul, agent en mission, corruption en cours).

### Phase 2 : L'Œil se pose (gratuit, une seule cible)

Le joueur choisit **une région** ou **un personnage** (s'il connaît son existence).

| Cible | Ce qu'on obtient | Coût |
|---|---|---|
| Région | Liste exacte des personnages présents, leur état visible, la valeur exacte de T, l'état de chaque murmure concernant cette région (vrai/faux). Si le porteur y est avec une trace ≥ 1 : 50 % de sentir l'Anneau (100 % après une Pulsation). | V +1. Chaque héros présent avec W ≥ 60 : M +15. |
| Personnage | Pensées : sa destination réelle, sa plus grande peur, **un secret** (relation, mensonge, objet) tiré de sa fiche. Valeurs exactes de D et M. | V +1 (+3 si Sage). M +15 (W ≥ 60) ou +5. |
| Personnage avec W ≥ 90 | Rien d'automatique : **duel de regard** (jet de duel, section 4.4, une manche). Si gagné, comme ci-dessus. Si perdu : V +8, la cible sait que Sauron la regarde. | Voir à gauche. |

Pendant ce tour, **le reste de la carte est couvert de brume** : les murmures de la phase 3 ne concernent que les régions non observées, et le joueur ne voit pas les Nazgûl hors de la région observée (il ne reçoit que leurs rapports).

### Phase 3 : Les Murmures

- **5 murmures par tour** par défaut, +1 par région Corrompue (maximum 9). Ils viennent de régions non observées par l'Œil.
- Le **code** choisit pour chaque murmure : la région, le fait réel sous-jacent, la source, et s'il est **vrai**, **déformé** ou **faux**. **Haiku** écrit seulement le texte à partir de ces champs.

| Source | Vrai | Déformé | Faux | Particularité |
|---|---|---|---|---|
| Espion humain (Bill Fougeard, Sudistes de la route) | 60 % | 25 % | 15 % | Ment davantage s'il a peur (T région ≥ 60 : faux +15 %) |
| Crébain / oiseau | 50 % | 40 % | 10 % | Bon sur les déplacements, nul sur les noms |
| Rumeur de taverne | 35 % | 35 % | 30 % | Contient souvent un nom exact au milieu de détails faux |
| Rapport de Nazgûl (Vision Spectrale) | 85 % | 15 % | 0 % | Voit auras, peur, trace de l'Anneau, mais rate les détails physiques (vêtements, nombre exact) |
| Région Corrompue | +20 % de vrai, quelle que soit la source | | | |

- Le joueur peut **classer** chaque murmure : vrai / faux / incertain. Le classement est vérifié quand l'Œil ou un Nazgûl confirme le fait. Bonne déduction : +1 E. Il n'y a aucune pénalité pour une erreur, sinon les mauvaises décisions qu'elle entraîne.
- Format JSON généré par le code puis envoyé à Haiku :
```json
{"id":"m_0412","region":"bree","source":"rumeur","verite":"deforme",
 "fait_reel":"quatre semi-hommes ont pris une chambre au Poney sous le nom de Souscolline",
 "deformation":"le nombre devient trois, le nom reste exact","ton":"inquiet, aviné"}
```

### Phase 4 : Ordres (dépense des PA)

| Action | PA | Effet résumé | Visibilité |
|---|---|---|---|
| **Voix : Murmure de la Paranoïa** | 1 | Doute +, relation entre deux personnages - | +1 (+4 si ratée) |
| **Voix : Promesse d'Annatar** | 1 | Offre : la cible accepte une action future | +2 (+5 si ratée) |
| **Voix : Commandement de Fer** | 1 | Ordre direct, duel mental si W ≥ 60 | +3 (+10 si duel perdu) |
| Nazgûl : se déplacer | 0 | 1 région (2 en posture Traque, 3 en Ombre Ailée) | 0 |
| Nazgûl : **Traque** (Cavalier Noir) | 1 | Fouille la région : jet de détection Anneau, interroge les locaux, T +10 | +2 |
| Nazgûl : **Interroger** un PNJ | 1 | Obtient un fait vrai (le PNJ est terrifié, T +5) ; le PNJ peut devenir agent | +1 |
| Nazgûl : **Embuscade** | 1 | Prépare une attaque nocturne si la cible entre dans la région | +4 si déclenchée |
| Nazgûl : **Fléau** (Ombre Ailée, Acte II+) | 2 | T +30, moral des armées brisé | +8 |
| Nazgûl : **Cri** | 0 | T +15 dans la région et ses voisines, D +5 pour les héros | +3 |
| Placer / activer un **agent** | 1 | Un PNJ à D ≥ 60 devient espion (+1 murmure fiable 70 %/tour sur sa région) | +1 |
| Lancer une **Corruption** | 2 + 3 E | Voir 6.4 | +5 |
| **Rituel de Forme** | tous | Voir 6.2 | Voir table |

**Limite** : un même personnage ne peut subir qu'une Voix par tour. Un Nazgûl ne fait qu'une action payante par tour (le déplacement est gratuit).

### Phase 5 : Crépuscule (résolution)

Ordre de résolution fixe, pour rester lisible et reproductible :
1. Déplacements des Nazgûl.
2. Traques, détections de l'Anneau, interrogatoires.
3. Voix (dans l'ordre choisi par le joueur).
4. Embuscades nocturnes et combats.
5. Corruption et rituels.

Le générateur aléatoire est **à graine** (seed par partie et par tour) : on peut rejouer un tour à l'identique pour déboguer.

### Phase 6 : Nuit (bilan)

1. Application des gains d'Essence.
2. Vérification des seuils (V, D, T) et déclenchement des événements.
3. Mise à jour du **Journal de Barad-dûr** : un résumé de 3 phrases écrit par Haiku, qui sert aussi de mémoire compacte pour les appels suivants au LLM.
4. Sauvegarde de l'état (JSON complet, section 9).

---

## 4. La Voix de Sauron en détail

### 4.1 Formule de base

```
Chance (%) = 50
           + Doute de la cible
           - Volonté de la cible
           - Méfiance / 2
           + bonus de registre
           + bonus de secret
           + bonus de texte libre (0 à +15, section 4.3)
           + 10 × étape de Forme au-delà de 0
bornée entre 5 et 95
```

**Bonus de secret** : +20 si la Voix exploite un secret révélé par l'Œil (ce tour ou le précédent), +10 si elle exploite un murmure que le joueur a classé « vrai » et qui l'est vraiment, -15 si elle s'appuie sur un murmure faux (la cible sent le mensonge).

### 4.2 Les trois registres

| Registre | Bonus | Cibles idéales | Réussite | Échec |
|---|---|---|---|---|
| **Paranoïa** | +15 si la cible a une peur connue (fiche), +10 si les deux personnages visés sont séparés | Hobbits, Prosper, Dénethor (Acte III) | D +15 ; relation cible → allié désigné -20 (sous 0, la cible ment ou s'isole) | M +25, la cible se rapproche de cet allié (relation +10) |
| **Promesse d'Annatar** | +20 si la cible a le trait « orgueil » ou « désir », -20 si « humble » (Sam, Aragorn) | Bill Fougeard, Boromir, Saroumane | D +10 ; la cible accepte une **dette** : au prochain point de décision, elle suit le choix de Sauron | M +25, la cible connaît désormais une intention de Sauron (V +2 supplémentaire) |
| **Commandement de Fer** | +30 contre W ≤ 40 ; si W ≥ 60, **duel mental** obligatoire | Orques, Hommes de Dunland, espions | Ordre exécuté immédiatement (bouger, se taire, livrer quelque chose) | Duel perdu : voir 4.4 |

### 4.3 Le murmure en texte libre

Le joueur peut écrire lui-même sa phrase (200 caractères max). **Sonnet** l'analyse et renvoie seulement des étiquettes structurées. Le code les convertit en bonus :

```json
{"registre_detecte":"paranoia","secret_utilise":"sec_frodon_02",
 "coherence_personnage":2,"subtilite":1,"contradiction_lore":false}
```

- `registre_detecte` différent du registre choisi : -10.
- `secret_utilise` doit être un identifiant de la liste de secrets connus du joueur (sinon ignoré) : applique le bonus de secret.
- `coherence_personnage` (0 à 2) × 5 + `subtilite` (0 à 1) × 5 : jusqu'à +15.
- `contradiction_lore` vrai : -10.

Le LLM ne voit jamais le jet de dés et ne choisit jamais l'issue. Une fois l'issue tirée, Sonnet écrit la réaction de la cible (pensée intérieure, 2 à 4 phrases).

### 4.4 Le duel mental

Déclenché par un Commandement contre W ≥ 60 ou par un regard sur une cible de W ≥ 90.

- **Puissance de Sauron (P)** = 60 + 10 × étape de Forme (+20 s'il porte l'Unique, Acte final).
- **Trois manches**, au meilleur des trois. Chance de gagner une manche = 50 + (P - W) / 2, bornée entre 10 et 90.
- À chaque manche, le joueur choisit une **approche** : *Écraser* (+10 chance, mais V +3), *Insinuer* (+0, utilise un secret pour +15 si disponible), *Feindre* (-10, mais un échec ne compte qu'à moitié pour le retour de flamme).
- Sonnet narre chaque manche en 2 phrases, puis le final, avec l'issue fournie.
- **Victoire** : ordre exécuté, D +25, M +20, E +3.
- **Défaite (retour de flamme)** : V +10, Sauron perd 1 PA au tour suivant, M de la cible +30, et la cible apprend **une vérité** sur Sauron, tirée par le code (« il cherche le Comté », « il ignore où est l'Anneau », « les Neuf sont près de Bree »). Cette vérité se propage à ses alliés au tour suivant.

---

## 5. Les Nazgûl

### 5.1 Fiches (Acte I)

| Nazgûl | Vitesse | Détection Anneau | Particularité |
|---|---|---|---|
| Le Roi-Sorcier | 2 | +10 % | Lame de Morgul (1 fois par acte). Cri : T +25 au lieu de +15. Ne peut être vaincu par aucun homme (règle narrative : immunité à la mort contre les Hommes). |
| Khamûl | 2 | +20 % | Le plus sensible à l'Anneau. **De jour, toutes ses chances -25 %** (sensible au jour). |
| Les sept autres | 2 | 0 | Interchangeables en jeu, nommés par le joueur ou par Haiku pour la couleur. |

- Au tour 1 : Khamûl et un compagnon dans le Comté, le Roi-Sorcier et deux autres au Gué de Sarn, quatre sur la route de Tharbad (arrivée tours 3 à 5).
- **Eau** : un Nazgûl ne franchit une rivière qu'à un gué ou un pont (Brandevin : pont de Brandevin seulement, et le Bac de Bouc lui est fermé). Au Gué de Bruinen, si Elrond est à Fondcombe, chaque Nazgûl qui traverse a 70 % d'être **démonté** par la crue.
- **Démonté / dissipé** : le Nazgûl rentre au Mordor, indisponible pendant **10 tours**, V +5 (une défaite visible).
- **Perte de signal** : un Nazgûl à plus de 3 régions de tout autre Nazgûl voit ses rapports passer de 85 % à 60 % de vrai, et il ne reçoit les ordres qu'un tour sur deux.

### 5.2 Le dilemme renseignement contre terreur

- **Posture Traque** (défaut en Acte I) : rapide, précise, T +10 par action, V modérée.
- **Posture Ombre Ailée** (débloquée en Acte II, avec les montures ailées) : vitesse 3, Fléau disponible, mais V +3 par tour passivement pour chaque Ombre Ailée visible.
- La règle de fond : **chaque point de Terreur est un point de Visibilité potentiel**. Une région à T ≥ 60 rapporte de l'Essence mais fait monter V passivement. Le joueur arbitre.

---

## 6. Arbre de progression

Quatre branches, qui se nourrissent d'Essence et coûtent toutes de la Visibilité. Elles sont pensées pour couvrir plusieurs actes : l'Eriador n'en débloque qu'une partie.

### 6.1 Branche A : Retrouver l'Anneau

| Étape | Condition | Gain | V |
|---|---|---|---|
| A0. **Le Nom** | Acquis au départ (Gollum a parlé : « Comté », « Sacquet ») | La région Comté est ciblable par l'Œil sans malus | 0 |
| A1. **La Piste** | 3 détections de trace OU 1 Pulsation | La carte de chaleur affiche la région probable avec ±1 région d'erreur | +3 |
| A2. **La Marque** | Le porteur blessé par la lame de Morgul | Position exacte chaque tour (le froid de la lame est un lien) ; D du porteur +5/tour ; au bout de 15 tours sans soin, le porteur devient un spectre et l'Anneau est livré | +8 |
| A3. **L'Étreinte** | Un Nazgûl gagne un affrontement dans la région du porteur, ou le porteur est brisé (D = 100) | L'Anneau est saisi : il est envoyé vers Barad-dûr (transport sur plusieurs tours, interceptable dans les actes suivants) | +25 |
| A4. **Le Retour** | L'Anneau atteint Barad-dûr | Débloque la Forme 4 et la branche des Trois. Victoire de campagne si combiné à certaines conditions | +40 (l'Ouest sait tout) |

### 6.2 Branche B : Reprendre forme

Chaque étape est un **rituel** : il consomme **tous les PA du tour** (Sauron se replie sur lui-même) et de l'Essence. Pendant ce tour, l'Œil ne se pose pas.

| Étape | Coût | Gain | V |
|---|---|---|---|
| 0. **L'Œil sans paupière** | Départ | Situation initiale | |
| 1. **L'Ombre** | 10 E | +1 PA/tour ; la Voix porte à 2 régions de plus d'un Nazgûl ou d'un agent | +8 |
| 2. **La Main Noire** | 20 E | +1 PA ; +10 à toutes les Voix ; peut tenir le palantír d'Isengard (Acte II, lien avec Saroumane) | +12 |
| 3. **Le Seigneur revêtu** | 35 E | +1 PA ; P de duel +10 de plus ; la Bouche de Sauron devient disponible comme héraut | +18 |
| 4. **La Plénitude** | Avoir l'Unique + 50 E | +2 PA ; P +20 ; débloque la branche des Trois | +30 |

### 6.3 Branche C : Les Anneaux des Elfes et des Nains

Note de conception : dans l'œuvre, Sauron détient déjà trois des Sept (dont celui de Thrór, pris à Thráin) et n'a jamais touché les Trois. Le jeu s'en sert comme base et invente la suite.

**Les Sept (Nains)**

| Étape | Condition | Gain | V |
|---|---|---|---|
| C1. **Les Trois Repris** | Au départ | +1 E/tour (ils nourrissent l'Ombre) | 0 |
| C2. **Le Messager d'Erebor** | Acte II (Rhovanion). 1 Promesse d'Annatar à Dáin | Si Dáin hésite (D ≥ 40) : il renseigne sur Bilbon en échange d'un anneau. Sinon, il prévient Fondcombe (V +6) | +4 |
| C3. **Le Seigneur nain lié** | Offrir un des Sept à un seigneur nain à D ≥ 60 | La région naine devient vassale (comme Corrompue, sans Terreur) ; ses murmures deviennent fiables à 80 % | +10 |

**Les Trois (Elfes)**

Ils ne s'obtiennent qu'**après A4** (l'Unique dans la main de Sauron, leur œuvre se dévoile) :

| Anneau | Porteur | Où (Eriador) | Condition | V |
|---|---|---|---|---|
| Vilya | Elrond | Fondcombe | Localisé dès qu'un Nazgûl voit Fondcombe en Vision Spectrale. Obtenu : 2 duels mentaux gagnés contre Elrond + Fondcombe à T ≥ 60 | +20 |
| Narya | Gandalf | Mobile | Localisé seulement par un duel de regard gagné contre Gandalf (son porteur est secret, même pour Sauron). Obtenu : 2 duels gagnés | +20 |
| Nenya | Galadriel | Lothlórien (Acte II) | Hors Eriador | +20 |

Chaque Anneau obtenu : +1 PA, et la région du porteur perd sa protection (Volonté régionale -50, voir 7).

### 6.4 Branche D : Corrompre les régions

Chaque région a un **statut** :

```
Libre  →  Inquiète (T ≥ 30)  →  Sous l'Ombre (T ≥ 60)  →  Écrasée (T ≥ 80)  →  Corrompue  →  Dominée
```

- **Corruption** : la région doit être Écrasée **et** abriter un agent ou un Nazgûl. Coût 2 PA + 3 E. La région doit rester à T ≥ 60 pendant **3 tours** (la corruption « prend »). Si T retombe sous 60, c'est un échec : les 3 E sont perdus.
- **Corrompue** : +2 E/tour, +1 murmure/tour, murmures de la région +20 % de vrai, les PNJ communs locaux deviennent des agents potentiels. V +5 à la bascule, puis +1/tour.
- **Dominée** (Acte II+, avec une armée ou un Seigneur nain lié) : la région fournit des troupes ; V +10 à la bascule.
- **Volonté régionale** : certaines régions résistent. Chance de réussite de la corruption = 100 - Volonté régionale (jet final à la fin des 3 tours). Valeurs : Bree 20, Comté 40 (les Hobbits sont étrangement résistants), Hauts des Galgals 0 (déjà maudits), Fondcombe 100 (impossible en Acte I), Terres Solitaires 10.

### 6.5 Récapitulatif : chaque gain se paie en Visibilité

| Type de gain | Fourchette de V |
|---|---|
| Information (Œil, Interroger) | +1 à +3 |
| Influence (Voix réussie) | +1 à +3 |
| Échec d'influence | +4 à +10 |
| Terreur (Traque, Cri, Fléau) | +2 à +8 |
| Territoire (Corruption, Domination) | +5 à +10, puis +1/tour |
| Forme | +8 à +30 |
| Anneaux | +4 à +40 |

---

## 7. La carte en régions

### 7.1 Eriador (Acte I)

| Id | Région | Voisines (jours à cheval) | Particularités |
|---|---|---|---|
| `comte_ouest` | Comté : Hobbitebourg et Cul-de-Sac | comte_est (1) | Départ de Frodon. Volonté régionale 40 |
| `comte_est` | Comté : Marais et Bois-Clos | comte_ouest (1), pays_de_bouc (1, par le Bac ou le Pont) | Rivière Brandevin |
| `pays_de_bouc` | Pays de Bouc et Creux-de-Crique | comte_est (1), vieille_foret (1) | La Haie protège : T plafonnée à 50 |
| `vieille_foret` | La Vieille Forêt | pays_de_bouc (1), galgals (1) | **Zone aveugle** : ni Œil ni Nazgûl n'y voient (Tom Bombadil). Murmures impossibles |
| `galgals` | Hauts des Galgals | vieille_foret (1), bree (1) | Esprits-servants : +10 % de détection pour un Nazgûl, Volonté régionale 0 |
| `bree` | Bree et le Poney Fringant | galgals (1), chetwood (1), route_sarn (2) | Carrefour des rumeurs : +2 murmures/tour |
| `chetwood` | Bois de Chet et Marais des Moucherons | bree (1), montauvent (2) | Route lente pour les Hobbits (2 jours à pied) |
| `montauvent` | Amon Sûl (Montauvent) | chetwood (2), terres_solitaires (1) | Point haut : un Nazgûl ici voit les régions voisines |
| `terres_solitaires` | Terres Solitaires et Dernier Pont | montauvent (1), trollshaws (1) | Peu peuplées : peu de murmures (-2) |
| `trollshaws` | Bois des Trolls | terres_solitaires (1), gue_bruinen (1) | Trolls de pierre (couleur narrative) |
| `gue_bruinen` | Gué de Bruinen | trollshaws (1), fondcombe (1) | Crue (5.1). Glorfindel y patrouille à V ≥ 60 |
| `fondcombe` | Fondcombe (Imladris) | gue_bruinen (1) | Sanctuaire : invisible à l'Œil, corruption impossible en Acte I |
| `route_sarn` | Route du Sud et Gué de Sarn | bree (2), *hors carte : Tharbad* | Point d'entrée des Nazgûl |

Les régions **hors carte** (Mordor, Isengard, Moria, Rhovanion) existent comme nœuds sans géométrie : elles émettent des événements et reçoivent des transports (Anneau, Nazgûl démontés).

### 7.2 Schéma de données d'une région

```json
{
  "id": "bree",
  "royaume": "eriador",
  "nom": "Bree",
  "polygone": "assets/eriador/bree.svg#p",
  "voisins": [{"id":"galgals","jours_cheval":1,"jours_pied":1,"obstacle":null},
              {"id":"chetwood","jours_cheval":1,"jours_pied":1,"obstacle":null}],
  "terrain": "village_carrefour",
  "volonte_regionale": 20,
  "terreur": 0,
  "statut": "libre",
  "sources_murmures": ["espion_humain","rumeur"],
  "murmures_bonus": 2,
  "regles_speciales": []
}
```

### 7.3 Penser l'extension vers une très grande carte

- **Royaumes** comme unités de chargement : `eriador`, `rhovanion`, `rohan`, `gondor`, `mordor`. Un royaume = un fichier JSON de régions + un atlas d'images. Le jeu ne charge en détail que le royaume actif et ses voisins.
- **Graphe, pas grille** : les règles ne voient que des régions et des arêtes avec un temps de trajet. Ajouter le Rohan revient à ajouter des nœuds et des arêtes vers `route_sarn` et `isengard`, sans toucher au moteur de règles.
- **Niveaux de détail** : dans PixiJS, chaque région a trois niveaux (région fine, royaume fusionné, silhouette continentale). En dézoom, l'Œil vise un royaume entier mais ne révèle que les « faits majeurs ».
- **Brouillard et Ombre** : une couche de rendu par jauge (T en teinte rouge-noir, V en halo sur Barad-dûr, brume hors de l'Œil). Les shaders du Monde de l'Ombre s'appliquent par-dessus quand le joueur suit un Nazgûl en Vision Spectrale.
- **Calendrier par acte** : chaque royaume apporte ses jalons canon (section 1), le moteur les fusionne.

---

## 8. Fin de l'Acte I

| Issue | Condition | Conséquence pour l'Acte II |
|---|---|---|
| **Victoire noire** | A3 atteint avant le Gué | L'Anneau part vers le Mordor. L'Acte II devient une course pour l'escorter face à l'Ouest |
| **Victoire grise** | Porteur marqué (A2) en arrivant à Fondcombe | Frodon arrive affaibli. Le Conseil d'Elrond se tient avec 1 membre de moins (ou un traître à D ≥ 75) |
| **Statu quo** | L'Anneau atteint Fondcombe, V < 60 | La Communauté part, mais l'Ouest est divisé (Doute de départ conservé) |
| **L'Ouest s'éveille** | V = 100 | La Communauté part avec une escorte, le Conseil Blanc agit contre Dol Guldur. L'Acte II commence avec V à 60 |

Il n'y a pas de « game over » sec : chaque issue façonne l'acte suivant.

---

## 9. Architecture IA : répartition et choix des modèles

### 9.1 Qui fait quoi

| Tâche | Qui | Pourquoi |
|---|---|---|
| Règles, jets, déplacements, jauges, vérité des murmures | **Code TypeScript** (moteur pur, testable, à graine) | Cohérence sur 30 à 50 tours, rejouable |
| Texte des murmures (5 à 9 par tour, en un seul appel) | **Claude Haiku 5.5** (`claude-haiku-5-5`) | Volume élevé, texte court, coût minime |
| Journal de Barad-dûr (résumé de tour) | **Claude Haiku 5.5** | Résumé simple, sert de mémoire compacte |
| Analyse du texte libre (étiquettes, 4.3) | **Claude Sonnet 5.5** (`claude-sonnet-5-5`), sortie structurée | Jugement fin sur le registre et la cohérence |
| Réaction des cibles à la Voix, narration des duels | **Claude Sonnet 5.5** | Psychologie des personnages, ton tolkienien |
| Lignes en Noir Parler et sous-titres (section 10) | **Claude Sonnet 5.5**, sortie structurée | Doit respecter un lexique imposé |
| Construction du lexique, fiches de personnages, répliques fixes | **Claude Opus 5.5** (`claude-opus-5-5`), **hors jeu**, une seule fois | Travail de conception, pas d'appel en cours de partie |

### 9.2 Ordre de grandeur des coûts (tarifs publics actuels)

- Haiku 5.5 : 0,10 $ / million de jetons en entrée, 0,50 $ en sortie. Un lot de murmures (≈ 3 000 jetons en entrée, 800 en sortie) coûte moins de 0,001 $.
- Sonnet 5.5 : 2 $ / 10 $ par million. Une Voix (≈ 4 000 en entrée, 600 en sortie) coûte environ 0,014 $. Un duel complet (4 appels) environ 0,05 $.
- Une partie d'Acte I (30 tours, 2 à 3 Voix par tour, quelques duels) : **de l'ordre de 1 à 2 $**. La mise en cache du contexte fixe (lore, fiches de personnages, lexique) réduit encore la facture.

### 9.3 Garde-fous pour la cohérence

- Le LLM reçoit **seulement** l'extrait d'état utile : la fiche de la cible, les 3 derniers résumés du Journal, les secrets connus, l'issue déjà tirée.
- **Sorties structurées** (schéma JSON imposé) pour tout ce que le code relit : étiquettes de texte libre, lignes en Noir Parler.
- Le texte généré n'est jamais relu par le moteur de règles comme source de vérité.
- Une liste de faits interdits par personnage (« Frodon ne sait pas que Gandalf est retenu à Orthanc ») est injectée dans le contexte pour limiter les incohérences.

---

## 10. Les voix en Noir Parler

Objectif : quand Sauron parle (Voix, duel, Cri d'un Nazgûl, héraut), le joueur **entend** une phrase en Noir Parler, grave et inhumaine, et **lit** le sous-titre français.

### 10.1 Le lexique : attesté et inventé

Le Noir Parler attesté chez Tolkien est très maigre : l'inscription de l'Anneau et une poignée de mots. On construit donc un **lexique fermé** en deux couches, chaque entrée étiquetée `atteste` ou `invente`.

**Couche attestée (base)**

| Mot | Sens | Source |
|---|---|---|
| ash | un | Inscription de l'Anneau |
| nazg | anneau | Inscription |
| durb- | gouverner | Inscription (durbatulûk) |
| gimb- | trouver | Inscription (gimbatul) |
| thrak- | amener | Inscription (thrakatulûk) |
| krimp- | lier | Inscription (krimpatul) |
| burzum | ténèbres | Inscription |
| -ishi | dans | Inscription (burzum-ishi) |
| agh | et | Inscription |
| -at | infinitif / « pour » | Inscription |
| -ul | les, eux | Inscription |
| -ûk | tous, entièrement | Inscription |
| gûl | spectre, esprit | Nazgûl |
| lug | tour | Lugbúrz (Barad-dûr) |
| búrz | sombre | Lugbúrz |
| uruk | orque | Uruk-hai |
| -hai | peuple | Uruk-hai, Olog-hai |
| olog | troll | Olog-hai |
| ghâsh | feu | Le Retour du Roi |
| snaga | esclave | Orcish (forme abâtardie) |
| sharkû | vieil homme | Orcish (forme abâtardie) |
| tark | homme de Gondor | Orcish (forme abâtardie) |

**Couche inventée (pour le jeu)**

Règles de fabrication, pour que les inventions « sonnent » juste :
- Consonnes dures et fricatives : g, k, z, r, b, d, gh, sh, th, kh. Peu de l, presque pas de f ni de v.
- Voyelles : a, u, û, i ; le e et le o sont rares.
- Langue **agglutinante** : racine + suffixes empilés (racine-at-ul-ûk), comme dans l'inscription.
- Racines de 1 ou 2 syllabes fermées (CVC ou CVCC).

Exemples de racines inventées (à valider par Lucas) :

| Mot | Sens | Statut |
|---|---|---|
| mozg- | penser, esprit | inventé |
| thrûm | peur | inventé |
| gazg- | voir, regarder | inventé |
| ulbur | œil | inventé |
| dushn- | douter | inventé |
| rakh- | briser | inventé |
| nûr | ombre | inventé |
| -izg | toi, ton | inventé |
| -um | nom abstrait (comme burz-um) | dérivé de l'attesté |
| krû | traître, faible | inventé |

Exemple de ligne construite, avec glose (Paranoïa contre Frodon) :

> **Gazgat-izg ulbur. Ash krû gimbatul-izg.**
> *gazg-at-izg ulbur* : regarder-pour-toi œil / *ash krû gimb-at-ul-izg* : un traître trouver-pour-eux-toi
> Sous-titre : « L'Œil te regarde. L'un des tiens te livrera. »

Le lexique complet (≈ 300 entrées visées) sera produit **une fois** avec Opus 5.5, relu par Lucas, puis figé dans un fichier `lexique_noir_parler.json`. En cours de partie, rien n'est inventé à la volée.

### 10.2 Génération des lignes en jeu

1. Le code fournit à **Sonnet 5.5** : le sens voulu (registre, cible, issue), et le lexique fermé.
2. Sonnet renvoie une sortie structurée :
```json
{"noir_parler":"Gazgat-izg ulbur.","phonetique":"gaz-GAT-izg OUL-bour",
 "glose":["gazg-at-izg : regarder-pour-toi","ulbur : œil"],
 "sous_titre":"L'Œil te regarde."}
```
3. Le **code vérifie** que chaque racine et chaque suffixe existent dans le lexique. Si un mot est inconnu, on relance une fois, puis on retombe sur une réplique fixe du même registre.
4. Règle de longueur : la phrase en Noir Parler fait **1 à 2 propositions courtes** (3 secondes d'audio maximum). Le sous-titre peut porter davantage que l'audio : c'est la voix qui fait l'effet, le sous-titre porte le sens.

### 10.3 Production des voix (décision du 20/11/2026)

**Choix retenu : la voix de Lucas, enregistrée puis traitée par script.** La synthèse vocale a été testée (espeak-ng/MBROLA) puis écartée, faute de naturel.

- **Enregistrement** : micro Blue Yeti en mode cardioïde, à 10-15 cm, pics entre -12 et -6 dB, export en WAV (ou mp3 ≥ 192 kbit/s).
- **Deux méthodes, selon la réplique** :
  - *Anglais inversé* (masse des répliques) : Lucas lit la phrase en anglais, le script inverse la piste puis applique les effets. Pas de phonétique à écrire.
  - *Noir Parler à l'endroit* (phrases clés : inscription de l'Anneau, répliques du lexique) : Lucas lit la phonétique, sans inversion.
- **Chaîne « légion » retenue** (`audio_tests/chaine_retenue/`) : voix principale -3 demi-tons, quatre voix superposées (-12, -7, -0,6, -15,5 demi-tons) avec chacune une dérive lente de hauteur et un léger décalage, grain très discret, réverbération moyenne, égalisation calée sur une référence de Sauron (`eq_yeti.txt` pour le Yeti).
- **Production en série** : une prise contenant plusieurs phrases est découpée automatiquement sur les silences, puis chaque phrase passe dans `render_rec.sh`. La sortie est un fichier audio par réplique, indexé dans la banque avec son sous-titre.
- **Aucune synthèse ni IA en cours de partie** : toutes les voix sont pré-enregistrées et livrées avec le jeu (voir le mode sans IA).
- **Nazgûl** : cri à produire à part (couches aiguës saturées), pas encore enregistré.

### 10.3 bis Musique

Lucas prévoit d'utiliser la musique des films. Le jeu n'étant pas publié, c'est un usage privé ; la musique est rangée dans un dossier séparé et remplaçable (`audio/musique/`), avec des pistes par ambiance (Barad-dûr, traque, Voix, duel, victoire, défaite), pour pouvoir la changer sans toucher au code si le jeu devait un jour être partagé.

### 10.4 Sous-titres

- Affichés **en même temps** que l'audio, en français, dans une typographie sobre (le Noir Parler en transcription latine au-dessus, plus petit, en rouge sombre ; le français en dessous).
- Mode **glose** activable : au survol de chaque mot en Noir Parler, sa racine et son sens (avec la mention « attesté » ou « inventé »). Ça permet au joueur d'apprendre peu à peu quelques mots, ce qui renforce l'immersion.
- Minutage : si le moteur fournit des repères temporels par mot, on les utilise pour un surlignage progressif ; sinon, on répartit le texte sur la durée du fichier audio.

---

## 11. Questions ouvertes pour Lucas

1. Faut-il garder le **Comté corruptible** dès l'Acte I, ou le réserver à un acte tardif (dans l'œuvre, c'est Saroumane qui s'en charge à la fin) ?
2. Le joueur doit-il **voir le calendrier canon** (pour savoir ce qu'il fait dévier), ou le découvrir ?
3. La couche inventée du Noir Parler : veux-tu valider chaque racine, ou laisser Opus produire le lexique complet que tu relis en une fois ?
