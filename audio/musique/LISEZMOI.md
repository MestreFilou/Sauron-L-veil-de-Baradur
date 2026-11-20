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

Les fichiers audio de ce dossier sont ignorés par git : la musique des films reste un usage privé et n'entre jamais dans le dépôt. Pour partager le jeu un jour, il suffira de remplacer les fichiers et ce manifeste.
