# Game Design Document (GDD) & Brief de Brainstorming : *L'Œil de Barad-dûr*

> **Note d'intention pour l'IA (Claude) :** Ce document sert de base de travail pour concevoir ensemble un jeu vidéo/narratif où le joueur incarne Sauron durant le Troisième Âge. Avant de générer du code, je souhaite brainstormer avec toi sur l'architecture technique, le choix du moteur graphique/interface et l'intégration des modèles d'IA pour gérer la narration dynamique.

---

## 1. Pitch & Vision du Jeu
* **Concept :** Incarner Sauron au Troisième Âge. Le joueur est une entité désincarnée, tapie dans la tour sombre de Barad-dûr. Il est omniscient par fragments, omniprésent par la peur, mais physiquement absent des champs de bataille.
* **Pilier central (L'Asymétrie) :** Le joueur ne gagne pas par la micro-gestion militaire classique, mais par la **manipulation psychologique**, la **gestion de l'information** et la **paranoïa**.
* **Ton :** Sombre, stratégique, psychologique, fidèle à l'œuvre de Tolkien (l'ombre rampante plutôt que le spectaculaire).

---

## 2. Mécaniques de Gameplay Principales

### A. L'Asymétrie de l'Information (Le Système du Palantír)
* **L'Œil (Focus Absolu) :** Le joueur ne peut poser son regard complet que sur une seule région ou un seul personnage par tour. Il accède aux pensées secrètes et mouvements exacts, mais devient aveugle au reste de la carte. De plus, la cible peut *sentir* le regard (augmentant sa méfiance).
* **Les Murmures (Écoute Passive) :** Le reste de la Terre du Milieu remonte des rapports fragmentaires, biaisés ou contradictoires (espions, crébains, rumeurs). Le joueur doit déduire le vrai du faux.

### B. Les Neuf Nazgûl : Yeux Mobiles & Vecteurs de Terreur
Les Nazgûl agissent comme des caméras déportées et des armes psychologiques, mais avec un coût tactique :
* **Vision Spectrale (Monde de l'Ombre) :** Permet de voir les auras magiques, la peur et la trace de l'Anneau Unique, au détriment de la perception des détails banals du monde physique.
* **Le Dilemme Renseignement vs Terreur :**
  * *Posture Traque (Cavaliers Noirs) :* Déplacement rapide, collecte d'informations précises, mais génère de la panique locale.
  * *Posture Fléau (Ombres Ailées) :* Révélation au grand jour, brise le moral des armées ennemies mais fait exploser la jauge de **Visibilité** de Sauron.
* **Spécialisation & Risques :** Profils distincts (Roi-Sorcier, Khamûl sensible au jour, Messagers) et risque de « perte de signal » télépathique si un spectre est trop loin ou vaincu (ex: gué de Bruinen).

### C. La Voix de Sauron (Manipulation Mentale)
Le joueur peut projeter sa volonté dans l'esprit des dirigeants (Dénethor, Saroumane, Théoden) ou des porteurs de l'Anneau via 3 registres :
1. **Le Murmure de la Paranoïa :** Amplifier les peurs existantes pour isoler les alliés (ex: faire douter Dénethor de Gandalf).
2. **La Promesse d'Annatar :** Séduction, offre de puissance ou de solutions faciles aux esprits orgueilleux (ex: Saroumane, Boromir).
3. **Le Commandement de Fer :** Domination brute sur les esprits faibles (Orques, Suderons), mais risque de **duel mental** et de contrecoup (retour de flamme) face à des volontés fortes (Aragorn, Gandalf, Galadriel).
* *Bonus narratif :* Utilisation d'un champ de texte libre où le joueur rédige ses propres chuchotements en exploitant les secrets découverts par ses espions.
* *Incarnation physique :* Envoi de la **Bouche de Sauron** comme héraut pour bluffer ou démoraliser avant une bataille.

### D. Le Paradoxe du Pouvoir (Jauge de Visibilité)
* Agir dans l'ombre maintient les Peuples Libres divisés et complaisants.
* Déployer trop tôt sa puissance (armées, Nazgûl au grand jour) unifie l'Ouest, accélère la formation du Conseil Blanc et déclenche la quête de destruction de l'Anneau.

### E. L'Enquête Inversée (La Traque de l'Anneau)
* Le joueur ignore où se trouve l'Anneau au départ.
* Il croise les indices (interrogatoire de Gollum, rumeurs à Bree, utilisation de l'Anneau) pour déduire l'itinéraire de la Communauté et tendre des embuscades psychologiques ou physiques.

---

## 3. Architecture Technique & Questions de Brainstorming

Avant de passer au développement, explorons ensemble les meilleures options techniques pour ce projet :

### Question 1 : Choix du Moteur Graphique / Interface
Quelle stack technique privilégier selon l'ambition du prototype (uniquement web/navigateur ou application desktop) ?
* **Option A (Interface Stratégique Web - React / Tailwind / Canvas/SVG) :** Idéal pour un jeu de type *Grand Strategy / Tableau de bord de Barad-dûr* (carte interactive de la Terre du Milieu, fiches psychologiques des personnages, journal de rumeurs, shaders d'ombre/feu pour l'Œil).
* **Option B (Moteur 2D léger - Phaser.js / PixiJS) :** Pertinent si l'on veut des déplacements fluides des Nazgûl, des effets de brouillard de guerre dynamiques et des transitions visuelles entre le monde physique et le monde spectral.
* **Option C (Moteur dédié - Godot) :** Si l'on vise un vrai jeu indépendant complet hors navigateur, avec gestion poussée des shaders et de l'audio.

### Question 2 : Choix du Modèle d'IA & Architecture Narrative
Le jeu repose sur des PNJ dotés d'une psychologie complexe qui réagissent aux chuchotements libres du joueur :
* **Gestion du State (État du monde) :** Comment structurer le JSON d'état du monde (jauges de Doute, Terreur, Visibilité, positions des acteurs) pour que le LLM reste cohérent sur 50 tours sans halluciner ?
* **Architecture Hybride (Code déterministe + LLM) :** Quelle répartition entre les règles codées en dur (déplacements, probabilités de détection, gestion des ressources) et les appels au LLM (génération des rumeurs biaisées, réactions psychologiques à la *Voix de Sauron*, dialogues du Conseil Blanc) ?
* **Choix des modèles (API) :** Quel équilibre entre un modèle rapide/peu coûteux pour générer les murmures de fond et un modèle plus puissant (type Claude Sonnet/Opus) pour résoudre les duels mentaux et la psychologie des héros ?

---

## 4. Prochaine Étape
Analyse ce document et propose-moi :
1. Ton avis sur la cohérence des mécaniques et d'éventuelles idées pour renforcer le sentiment d'omniscience/invisibilité.
2. Une recommandation argumentée sur le **moteur graphique** et l'**architecture IA** la plus adaptée pour démarrer un premier prototype jouable rapidement.