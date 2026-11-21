# Effets sonores

Effets d'interface et d'événement, et fonds d'ambiance (forge de Barad-dûr en mode Œil, vent du Monde de l'Ombre). Tous sont générés par `audio/outils/generer_sons/generer.py` : des créations originales du projet, versionnées, sans droits extérieurs.

Le manifeste `effets.json` relie chaque effet à son fichier, avec son volume, une légère variation de vitesse à chaque lecture et un délai minimal entre deux lectures. Pour changer un son, remplacer le fichier (ou pointer vers un autre) : le code n'a pas à bouger.

Dans le jeu, `client/src/son/effets.ts` décide quel effet joue quand l'état change (ordre donné, fin de tour, Regard, Anneau senti, duel, Monde de l'Ombre, murmure classé, règle qui refuse un geste), et les boutons font un léger son au survol et au clic. Le volume se règle avec le curseur « Effets » du bouton du son.
