# Voix enregistrées

Un fichier par réplique, produit par la chaîne retenue (`../outils/chaine_retenue/render_rec.sh`) et nommé d'après son identifiant dans `../banque/voix.json` : `voix/<id>.mp3`.

- `methode: "anglais_inverse"` : lire le champ `lu` (anglais), puis `outils/chaine_retenue/render_rec.sh prise.wav voix/<id>.mp3 reverse "$(cat outils/chaine_retenue/eq_rec.txt)"` (depuis `audio/`).
- `methode: "noir_parler"` : lire la phonétique du champ `lu`, puis la même commande sans `reverse`.

Une fois le fichier livré, passer la réplique à `"statut": "enregistre"` et renseigner `duree_s` (`soxi -D voix/<id>.mp3`). `npm test` vérifie que chaque réplique enregistrée a bien son fichier.
