# Artworks des écrans de chargement

Un dossier séparé et remplaçable, comme `audio/musique/`. Les images qu'on y dépose s'affichent sur les écrans de chargement, une différente à chaque fois.

Pour ajouter une image :

1. La déposer ici (`.webp`, `.jpg`, `.png` ou `.avif`). Les images verticales vont le mieux : elles s'affichent dans un cadre, à gauche du murmure.
2. L'ajouter dans `ecrans.json` avec son titre, son artiste et sa source, pour l'écran des crédits. Une image absente du manifeste s'affiche quand même, sans légende.
3. Relancer `npm run dev`, ou reconstruire l'application (`npm run app:paquet`) : les images sont copiées dans l'application au moment de la construction.

**Les images de ce dossier sont ignorées par git.** Celles d'aujourd'hui ne sont pas libres de droits (l'une est signée Michael Bielaczyc, les autres sont d'auteurs inconnus) : elles restent un usage privé et n'entrent jamais dans le dépôt. Le manifeste, lui, est versionné, pour garder les crédits. Pour partager le jeu un jour, il suffira de remplacer les images et le manifeste, sans toucher au code.

Sans aucune image, l'écran de chargement montre la Tour dessinée par le jeu, avec l'Œil.

Les quatre images actuelles sont aussi dans les fichiers du projet, dans `artworks/` : il suffit de les copier ici.
