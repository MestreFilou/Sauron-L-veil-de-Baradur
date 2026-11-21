# L'Œil de Barad-dûr

Un jeu de stratégie au tour par tour où l'on incarne Sauron, dans l'Eriador de 3018 (Acte I : du 22 septembre au Gué de Bruinen). Les documents de conception sont dans [`docs/`](docs/).

## Lancer le jeu

### L'application (double-clic)

```bash
npm install
npm run app:paquet   # fabrique l'installeur pour ce système, dans desktop/dist/
```

Sous Windows, on obtient `Oeil-de-Barad-dur-0.1.0-win-x64.exe` (installeur, avec raccourci) et `Oeil-de-Barad-dur-0.1.0-portable.exe` (un seul fichier, sans installation). Sous macOS un `.dmg`, sous Linux un `.AppImage`. Il faut construire sur le système visé.

Pour essayer l'application sans l'empaqueter :

```bash
npm run app          # construit le client et ouvre la fenêtre
```

L'application s'ouvre sur l'écran titre : continuer, nouvelle partie, charger, options (volumes, sous-titres, plein écran), crédits. En jeu, **Échap** ouvre le menu (sauvegarder, charger, options, menu principal) et **F11** passe en plein écran. La partie est sauvegardée automatiquement après chaque geste, et trois emplacements se remplissent à la main. Les sauvegardes sont des fichiers JSON dans le dossier de l'utilisateur (`%APPDATA%\L'Œil de Barad-dûr\sauvegardes` sous Windows) ; le menu Options sait l'ouvrir.

### Pour développer

```bash
npm run dev        # le client sur http://localhost:5173 (sauvegardes dans le navigateur)
npm run app:dev    # la fenêtre de l'application sur ce même serveur (dans un second terminal)
npm test           # tests du moteur, du monde, de la narration, de l'audio et des écrans
npm run typecheck
npm run banc       # banc d'équilibrage : 11 bots, 40 parties chacun
npm run build      # client de production dans client/dist
```

Le jeu se joue **entièrement sans IA** : les murmures, les pensées des personnages touchés par la Voix, les duels et le Journal viennent d'une banque de textes préécrits (`narrative/banque/fr.json`). Claude n'est qu'un complément optionnel, branché côté serveur (`NarrateurClaude` + `narrateurAvecRepli`), qui retombe sur la banque au moindre échec.

## Organisation

| Dossier | Rôle |
| --- | --- |
| `engine/` | Moteur de règles pur et testé : boucle de tour, jauges, jets à graine, vue du joueur. Aucune interface, aucun réseau. Tous les chiffres sont dans `engine/src/regles.ts`. |
| `world/` | Données de l'Eriador en JSON : régions, personnages, les Neuf, calendrier canon, géographie de la carte. |
| `narrative/` | Banque de textes (narrateur par défaut), prompts et appels à Claude (Haiku 5.5 pour les murmures et le Journal, Sonnet 5.5 pour la Voix et les duels). |
| `audio/` | Lexique du Noir Parler ; banque des voix enregistrées par Lucas (`banque/voix.json`, fichiers dans `voix/`, effets appliqués hors ligne par `outils/chaine_retenue/render_rec.sh`) ; musique par ambiance dans `musique/`, dossier remplaçable et non versionné. |
| `client/` | Interface : React pour les panneaux, PixiJS pour la carte, le Regard et le Monde de l'Ombre, l'Œil en champ de feu. Écran titre, chargement et menus dans `client/src/ecrans/`, sauvegardes dans `client/src/partie/`. |
| `desktop/` | L'application de bureau (Electron) : la fenêtre, les sauvegardes sur disque, le plein écran, l'empaquetage (`electron-builder`). |
| `artworks/` | Images des écrans de chargement et leurs crédits (`ecrans.json`). Les images ne sont pas versionnées : usage privé, comme la musique. |
| `docs/` | Game design document, mécaniques de la boucle de tour, menus de gestion (la Cour), direction artistique et maquette. |

Règle d'or : **le code décide, le texte raconte**. Le moteur tranche chaque issue ; le narrateur (banque ou Claude) ne fait que l'habiller, et son texte n'est jamais relu par le moteur.
