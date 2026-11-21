# Générateur de sons

`generer.py` fabrique toute la musique et tous les effets du jeu par synthèse, sans aucun échantillon extérieur : ce sont des créations originales du projet, sans droits à céder ni crédits à porter. Chaque son part d'une graine fixe, donc relancer le script redonne les mêmes fichiers.

```bash
python3 audio/outils/generer_sons/generer.py                       # tout (une dizaine de minutes)
python3 audio/outils/generer_sons/generer.py --seulement regard,traque   # quelques sons
python3 audio/outils/generer_sons/generer.py --wav /tmp/sons       # garde aussi les WAV
```

Dépendances : Python 3, numpy, ffmpeg (libmp3lame).

## Ce qui sort

**Musique** (`audio/musique/libre/`, une piste par ambiance, bouclée sans couture : la réverbération qui dépasse la fin retombe sur le début) :

| Ambiance | Durée | Contenu |
| --- | --- | --- |
| `barad_dur` | 96 s | Bourdon de ré grave, chœur d'hommes (ré mineur, mi bémol, si bémol, sol mineur), tambours lents, cuivres aux changements de phrase, enclume de la forge au loin |
| `traque` | 64 s | Ostinato de cordes graves à 120, tambours en 3+3+2, chœur qui monte d'un demi-ton toutes les 16 s, trémolo aigu en seconde moitié |
| `voix` | 48 s | Chœur bouche fermée très lent, cloches à l'envers, chuchotis |
| `duel` | 40 s | Battement de cœur à 72, triton grave (ré, sol dièse), cordes en trémolo serré |
| `victoire` | 48 s | Cuivres et chœur à pleine voix, gong et tambours |
| `defaite` | 48 s | Chœur qui descend, vent, cloche lointaine |

**Effets** (`audio/effets/`, déclarés dans `effets.json`) : survol et clic de bouton, onglet, ordre donné ou annulé, fin de tour (gong et tambour), Regard posé (souffle de feu), Anneau senti, Regard repoussé, entrée et sortie du Monde de l'Ombre, murmure classé, refus d'une règle, rituel de Forme, ouverture du duel, entrée dans la partie ; et deux fonds en boucle de 32 s, la forge de Barad-dûr (mode Œil) et le vent du Monde de l'Ombre.

## Outils

`synthe.py` contient les briques : synthèse additive (chœur à formants, bourdon, cuivre, cordes), tambour à chute de hauteur, cloche et enclume à partiels inharmoniques, filtres par FFT, réverbération par convolution avec une réponse synthétique, et la `Piste` qui replie ce qui dépasse la fin sur le début.
