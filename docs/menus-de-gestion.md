# Menus de gestion : la Cour de Barad-dûr

La Cour regroupe trois menus de gestion, ouverts par le bouton **La Cour** du panneau des Neuf ou la touche **C** (Échap pour fermer). Le principe vient de *Crusader Kings III* : des menus où l'on gère des personnages, des prisonniers et de grandes décisions, chacun avec ses conditions affichées une à une. Le style reste celui du jeu (obsidienne, bronze, braise) : sièges voûtés pour les Neuf, cellules à barreaux, sceaux de la Tour.

Règle d'or inchangée : **le code décide**. Chaque geste devient une Action du moteur (`affecter`, `ordonner`, `annuler_ordre`) ; les menus ne lisent que la `vueJoueur`. Tous les chiffres sont dans `engine/src/regles.ts` (`cachots`, `decisions`).

## 1. Les Neuf (le « conseil » de la Tour)

Ce que CK3 fait avec le conseil (chaque conseiller reçoit une tâche permanente qui tourne seule), la Tour le fait avec les Neuf. Le cercle montre les neuf sièges ; la fiche du Nazgûl choisi donne :

- ses **dons**, lus dans ses règles (monture et vitesse, flair, Seigneur d'Angmar, lame de Morgul, Khamûl qui craint le jour, signal faible) ;
- sa **mission** permanente (`EtatNazgul.affectation`, moteur : `engine/src/affectations.ts`) ;
- ses **ordres du soir**, à donner ou annuler, y compris Enlever ;
- ses **hauts faits** récents, tirés du Journal.

| Mission | Ce que le moteur pré-remplit à chaque phase des ordres |
| --- | --- |
| Aux ordres | rien |
| Battre la campagne | Traque sur place |
| Tenir un passage (région) | Marche vers la région, puis Embuscade dès que la précédente s'éteint |
| Suivre la piste | Marche vers la dernière trace connue de l'Anneau (ou la région la plus probable), puis Traque |
| Semer l'effroi (région) | Marche vers la région, puis Cri une fois sur place |

Une mission ne contourne aucune règle : ses ordres passent par la validation normale (PA, signal faible, une action par tour) et ceux qui échouent sont ignorés. Ils apparaissent dans la liste des ordres et s'annulent comme les autres. Un Nazgûl qui a déjà reçu un ordre ce tour n'en reçoit pas d'autre de sa mission.

## 2. Les cachots

Moteur : `engine/src/cachots.ts`. Un Nazgûl peut **enlever** un homme du commun (rôle `pnj`) qui se trouve dans sa région : c'est son action du tour (2 PA, Terreur +10, Visibilité +4). Les héros et les Sages ne se laissent pas prendre en Acte I. Le prisonnier sort de la carte (plus de marche, de murmures ni de Voix) et arrive aux cachots à l'aube.

| Geste | Coût | Effet |
| --- | --- | --- |
| Interroger | 1 PA | Arrache sa peur, puis ce qu'il voulait faire, puis ses secrets, un par nuit. Doute +10. |
| Tourmenter | 1 PA, 1 Essence | Doute +25, Visibilité +1. À 60 de Doute, il **plie**. |
| Relâcher | gratuit | Plié : il rentre chez lui en **agent**. Sinon il raconte les cachots : Terreur +10 chez lui, Méfiance +10 des héros présents. |
| Exécuter | gratuit | Terreur +20 chez lui, Doute +5 des héros présents, Essence +1, Visibilité +3. Sans retour. |

Un geste par prisonnier et par nuit ; rien le soir même de la capture.

## 3. Les décisions

Moteur : `engine/src/decisions.ts`. Comme dans CK3, chaque décision montre ses conditions (remplies ou non), son coût et sa recharge. Une décision prise devient un ordre du tour : elle se résout au Crépuscule, après tout le reste, et ses conditions sont relues à ce moment-là.

| Décision | Conditions | Coût | Effet | Recharge |
| --- | --- | --- | --- | --- |
| Presser les Neuf | un Nazgûl loin de la chasse | 3 Ess. | les indisponibles reviennent 2 tours plus tôt, V +2 | 6 tours |
| Le Silence de la Tour | Visibilité ≥ 25 | — | V −8 (jamais sous le plancher), 2 PA de moins au tour suivant | 8 tours |
| Les langues des tavernes | au moins un agent | 1 PA, 1 Ess. | Terreur +10 là où sont les agents, V +2 | 4 tours |
| Les crébains de Dun | Visibilité < 60 | 1 PA, 2 Ess. | révèle la Terreur de toutes les régions visibles, V +2 | 5 tours |
| Les montures ailées | Acte II, Forme 2 | 15 Ess. | les Neuf passent en Ombre ailée | une fois |

« Les montures ailées » reste verrouillée en Acte I : elle montre ce qui viendra.

## 4. Intégrer la Cour dans un autre écran

`client/src/cour/Cour.tsx` exporte :

- `Cour` : la fenêtre par-dessus la carte, pilotée par le store (`cour`, `ouvrirCour(onglet?)`, `fermerCour()`) ;
- `ContenuCour({ onglet, choisirOnglet, onFermer? })` : le même contenu sans fenêtre, à poser dans un autre écran (celui du Mont Destin, par exemple) ;
- `OngletNeuf`, `OngletCachots`, `OngletDecisions` : chaque menu seul.

Depuis n'importe où : `useJeu.getState().ouvrirCour('cachots')`.
