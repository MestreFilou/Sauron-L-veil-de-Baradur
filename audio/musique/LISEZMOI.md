# Musique

Un dossier séparé et remplaçable (mécaniques 10.3 bis). Pour ajouter une piste :

1. Déposer le fichier ici, par exemple `barad_dur/the_eye.mp3`.
2. L'ajouter dans `pistes.json`, sous son ambiance :

```json
"barad_dur": [
  { "fichier": "barad_dur/the_eye.mp3", "titre": "…", "boucle": true, "volume_db": -6, "fondu_s": 3 }
]
```

Ambiances : `barad_dur` (l'écran principal), `traque` (un Nazgûl sur une piste, le Monde de l'Ombre), `voix` (la Voix projetée), `duel` (duel mental), `victoire`, `defaite`. Une ambiance sans piste reste silencieuse ; plusieurs pistes alternent.

**Musique livrée avec le jeu** : `libre/` contient six pistes originales, une par ambiance, générées par synthèse (`audio/outils/generer_sons/`). Ce sont des créations du projet, sans droits extérieurs, et elles sont versionnées. Elles sont déclarées avec `"sans_coupure": true` : décodées en mémoire et bouclées à l'échantillon près.

Les autres fichiers audio de ce dossier sont ignorés par git : la musique des films reste un usage privé et n'entre jamais dans le dépôt. Pour l'utiliser chez soi, déposer les fichiers et remplacer les entrées de `pistes.json` (ou les ajouter à côté : plusieurs pistes d'une ambiance alternent d'un tour à l'autre). Une longue piste se lit en flux, sans `sans_coupure`.

Dans le jeu (`client/src/son/ambiance.ts`), l'ambiance suit l'état, par ordre de priorité : fin de l'acte (`victoire` pour une victoire noire ou grise, `defaite` sinon), duel mental ouvert, Voix en train d'être dite (et quelques secondes après), traque (Monde de l'Ombre ou ordre de traque donné), et `barad_dur` le reste du temps. La musique baisse sous les voix. Le volume (général, musique, voix) et la coupure (touche M) se règlent avec le bouton du son, en haut à droite.
