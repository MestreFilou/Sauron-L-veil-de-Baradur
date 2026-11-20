# L'Œil de Barad-dûr

Un jeu de stratégie au tour par tour où l'on incarne Sauron, dans l'Eriador de 3018 (Acte I : du 22 septembre au Gué de Bruinen). Les documents de conception sont dans [`docs/`](docs/).

## Lancer le jeu

```bash
npm install
npm run dev        # le client sur http://localhost:5173
npm test           # tests du moteur, du monde, de la narration et de l'audio
npm run typecheck
npm run build      # client de production dans client/dist
```

Le jeu se joue **entièrement sans IA** : les murmures, les pensées des personnages touchés par la Voix, les duels et le Journal viennent d'une banque de textes préécrits (`narrative/banque/fr.json`). Claude n'est qu'un complément optionnel, branché côté serveur (`NarrateurClaude` + `narrateurAvecRepli`), qui retombe sur la banque au moindre échec.

## Organisation

| Dossier | Rôle |
| --- | --- |
| `engine/` | Moteur de règles pur et testé : boucle de tour, jauges, jets à graine, vue du joueur. Aucune interface, aucun réseau. Tous les chiffres sont dans `engine/src/regles.ts`. |
| `world/` | Données de l'Eriador en JSON : régions, personnages, les Neuf, calendrier canon, géographie de la carte. |
| `narrative/` | Banque de textes (narrateur par défaut), prompts et appels à Claude (Haiku 5.5 pour les murmures et le Journal, Sonnet 5.5 pour la Voix et les duels). |
| `audio/` | Lexique du Noir Parler, répliques fixes et chaîne de traitement de la voix de Sauron (Web Audio). |
| `client/` | Interface : React pour les panneaux, PixiJS pour la carte, le Regard et le Monde de l'Ombre, l'Œil en champ de feu. |
| `docs/` | Game design document, mécaniques de la boucle de tour, direction artistique et maquette. |

Règle d'or : **le code décide, le texte raconte**. Le moteur tranche chaque issue ; le narrateur (banque ou Claude) ne fait que l'habiller, et son texte n'est jamais relu par le moteur.
