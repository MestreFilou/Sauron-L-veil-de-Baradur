# Script de lecture : voix de Sauron

90 répliques, dont 0 enregistrées. Fichier généré depuis `audio/banque/voix.json` par `audio/outils/seances/script_lecture.mjs` : ne pas le modifier à la main.

## Avant de commencer

- **Micro** : Blue Yeti en cardioïde, à 10-15 cm, pics entre -12 et -6 dB. Export en WAV.
- **Une prise par séance.** Lis les phrases dans l’ordre, en laissant **2 secondes de silence** entre deux phrases (compte « un, deux » dans ta tête). Le découpage se fait sur ces silences : à l’intérieur d’une phrase, ne marque pas de pause de plus d’une seconde.
- **Une phrase ratée** : finis la séance quand même, puis réenregistre seulement celle-là dans une prise à part (voir « Après la séance »).
- **Noir Parler** (séances 1 et 6) : lis la ligne en gras telle quelle, à la française. Les syllabes en MAJUSCULES portent l’accent. « kh » et « gh » se raclent au fond de la gorge.
- **Anglais** (les autres séances) : lis l’anglais normalement, avec l’intention indiquée. Le script inverse la piste ensuite, donc l’accent n’a pas d’importance, seuls le rythme et le ton comptent.
- Joue au-dessus de ta voix naturelle : la chaîne descend la hauteur et ajoute les voix superposées, mais pas l’émotion.

## Après la séance

Depuis le dossier `audio/` du jeu (il faut sox et ffmpeg) :

```
outils/seances/decouper_seance.sh prise.wav 3            # découpe la séance 3, traite chaque phrase, range voix/<id>.mp3
outils/seances/decouper_seance.sh reprise.wav --ids fer_en_05   # une ou plusieurs phrases refaites à part
node outils/seances/marquer_enregistrees.mjs             # passe en « enregistré » les répliques qui ont leur fichier
```

## Séances

| Séance | Thème | Répliques | Enregistrées | Dans le jeu aujourd’hui |
|---|---|---|---|---|
| 1 | Noir Parler : l’inscription et les répliques clés | 7 | 0 | oui |
| 2 | Paranoïa (anglais) | 8 | 0 | oui |
| 3 | Annatar, la séduction (anglais) | 8 | 0 | oui |
| 4 | Commandement de Fer (anglais) | 8 | 0 | oui |
| 5 | Duel mental et cris des Nazgûl (anglais) | 10 | 0 | oui |
| 6 | Noir Parler : nouvelles répliques | 10 | 0 | en partie |
| 7 | Ordres aux Nazgûl (anglais) | 8 | 0 | écrans à venir |
| 8 | Prisons et interrogatoires (anglais) | 6 | 0 | écrans à venir |
| 9 | Montagne du Destin, forge et améliorations (anglais) | 6 | 0 | écrans à venir |
| 10 | Aube, réussites et colères (anglais) | 14 | 0 | écrans à venir |
| 11 | Écran titre, fin de partie, Nazgûl (anglais) | 5 | 0 | en partie |

Les séances 1 à 5 sont jouées dès maintenant par le jeu. Les séances 6 à 11 préparent les écrans à venir (Nazgûl, prisons, Montagne du Destin, aube, menus) : leurs registres existent déjà dans la banque.

---

## Séance 1 : Noir Parler : l’inscription et les répliques clés

**1. `anneau_inscription`**  
*Solennel et lent, comme une incantation gravée. Appuie chaque « nazg », respire entre les vers sans dépasser une seconde de pause.*

> **ACH nazg dour-ba-tou-LOUK, ACH nazg gim-ba-TOUL, ACH nazg thra-ka-tou-LOUK agh BOUR-zoum-i-chi krim-pa-TOUL**

Noir Parler : Ash nazg durbatulûk, ash nazg gimbatul, ash nazg thrakatulûk agh burzum-ishi krimpatul.  
Sous-titre : Un Anneau pour les gouverner tous, un Anneau pour les trouver, un Anneau pour les amener tous et dans les ténèbres les lier.

**2. `paranoia_01`**  
*Bas, tout près de l’oreille. Un secret qu’on confie, pas une menace.*

> **gaz-GAT-izg OUL-bour. ACH krou gim-ba-TOUL-izg**

Noir Parler : Gazgat-izg ulbur. Ash krû gimbatul-izg.  
Sous-titre : L’Œil te regarde. L’un des tiens te livrera.

**3. `paranoia_02`**  
*Glissé, presque soufflé. « Krou » tombe comme un verdict.*

> **douch-NAT-izg. MOZG-oul krou**

Noir Parler : Dushnat-izg. Mozg-ul krû.  
Sous-titre : Doute. Leurs pensées sont traîtresses.

**4. `annatar_01`**  
*Chaud, flatteur, un sourire dans la voix.*

> **nazg ACH-izg. dour-BAT-izg**

Noir Parler : Nazg ash-izg. Durbat-izg.  
Sous-titre : Un anneau pour toi. Pour que tu gouvernes.

**5. `fer_01`**  
*Ordre claqué. « SNA-ga » sec et méprisant.*

> **thra-KAT-izg ! SNA-ga !**

Noir Parler : Thrakat-izg! Snaga!  
Sous-titre : Viens à moi ! Esclave !

**6. `fer_02`**  
*Lent et lourd, chaque syllabe écrase.*

> **ra-KHAT-oul THROUM-i-chi**

Noir Parler : Rakhat-ul thrûm-ishi.  
Sous-titre : Brise-les dans la peur.

**7. `cri_nazgul`**  
*Cri du Nazgûl : aigu, déchiré, le plus long possible sur « GOUL ». Recule du micro de 30 cm.*

> **GOUL ! GOUL-ouk !**

Noir Parler : Gûl! Gûl-ûk!  
Sous-titre : (cri des Nazgûl)


---

## Séance 2 : Paranoïa (anglais)

**1. `paranoia_en_01`**  
*Confidentiel, complice. Tu aides la cible à ouvrir les yeux.*

> **They whisper about you when you sleep. Ask yourself who gains if you fall.**

Sous-titre : Ils parlent de toi quand tu dors. Demande-toi qui gagne si tu tombes.

**2. `paranoia_en_02`**  
*Calme, désolé pour elle. Le coup est dans « already ».*

> **Your friend has already chosen. He simply has not told you yet.**

Sous-titre : Ton ami a déjà choisi. Il ne te l’a simplement pas encore dit.

**3. `paranoia_en_03`**  
*Insinuant, une question qui reste en l’air.*

> **They smile at you. Have you seen what they do when you turn away?**

Sous-titre : Ils te sourient. As-tu vu ce qu’ils font quand tu te détournes ?

**4. `paranoia_en_04`**  
*Doux et définitif, comme une mauvaise nouvelle qu’on annonce.*

> **The wizard is not coming. He never meant to.**

Sous-titre : Le magicien ne viendra pas. Il n’en a jamais eu l’intention.

**5. `paranoia_en_05`**  
*Lent. Un temps avant « Now », sans dépasser une seconde.*

> **Count your friends. Now count the ones you trust.**

Sous-titre : Compte tes amis. Maintenant, compte ceux en qui tu as confiance.

**6. `paranoia_en_06`**  
*Murmuré, inquiet, comme si tu partageais sa peur.*

> **Who told them where you would sleep tonight?**

Sous-titre : Qui leur a dit où tu dormirais cette nuit ?

**7. `paranoia_en_07`**  
*Soupçonneux, sur Aragorn. Appuie « hidden ».*

> **He carries a broken sword and a hidden name. What else is he hiding?**

Sous-titre : Il porte une épée brisée et un nom caché. Que cache-t-il d’autre ?

**8. `paranoia_en_08`**  
*Très bas, presque tendre. La phrase la plus cruelle.*

> **You are alone. You have always been alone.**

Sous-titre : Tu es seul. Tu l’as toujours été.


---

## Séance 3 : Annatar, la séduction (anglais)

**1. `annatar_en_01`**  
*Annatar, le Seigneur des Dons : bienveillant, admiratif.*

> **You were meant for more than this. Serve me, and it shall be yours.**

Sous-titre : Tu étais fait pour plus que cela. Sers-moi, et tout ceci sera à toi.

**2. `annatar_en_02`**  
*Léger, raisonnable, presque amusé. Rien de grave.*

> **I do not ask for loyalty. Only for a little help, and a great reward.**

Sous-titre : Je ne te demande pas d’être loyal. Seulement un peu d’aide, et une grande récompense.

**3. `annatar_en_03`**  
*Complice, sur l’Anneau : tu donnes raison à la cible.*

> **Keep it. Why should another decide what is yours?**

Sous-titre : Garde-le. Pourquoi un autre déciderait-il de ce qui est à toi ?

**4. `annatar_en_04`**  
*Rêveur, une promesse qui fait voir le jardin.*

> **A garden as wide as the world. Only say yes.**

Sous-titre : Un jardin grand comme le monde. Dis seulement oui.

**5. `annatar_en_05`**  
*Grave et respectueux, tu parles à un héritier blessé.*

> **I can give you the crown your blood was denied.**

Sous-titre : Je peux te donner la couronne qu’on a refusée à ton sang.

**6. `annatar_en_06`**  
*Berceuse. Lent, apaisant, de plus en plus bas.*

> **No more fear. No more cold. Only rest.**

Sous-titre : Plus de peur. Plus de froid. Seulement le repos.

**7. `annatar_en_07`**  
*Enthousiaste, tu offres la gloire.*

> **They will sing of you, if you let me help.**

Sous-titre : On chantera ton nom, si tu me laisses t’aider.

**8. `annatar_en_08`**  
*Nostalgique, sincère en apparence.*

> **I was a friend to the Elves once. I can be a friend to you.**

Sous-titre : J’ai été l’ami des Elfes, jadis. Je peux être le tien.


---

## Séance 4 : Commandement de Fer (anglais)

**1. `fer_en_01`**  
*Trois ordres secs, un silence entre chacun.*

> **Kneel. Do not sleep. Watch them, and report.**

Sous-titre : À genoux. Ne dors pas. Surveille-les, et rapporte.

**2. `fer_en_02`**  
*Froid, sans élever la voix.*

> **Be silent. Speak of this to no one.**

Sous-titre : Tais-toi. N’en parle à personne.

**3. `fer_en_03`**  
*Exigeant, une main qui serre la gorge.*

> **Tell me everything you know.**

Sous-titre : Dis-moi tout ce que tu sais.

**4. `fer_en_04`**  
*Monocorde, la cible marche comme une marionnette.*

> **Walk. Do not look back.**

Sous-titre : Marche. Ne te retourne pas.

**5. `fer_en_05`**  
*Deux mots, très lents, irrésistibles.*

> **Put it on.**

Sous-titre : Passe-le à ton doigt.

**6. `fer_en_06`**  
*Montée : calme sur la première phrase, écrasant sur la seconde.*

> **You will obey. You have no other choice.**

Sous-titre : Tu obéiras. Tu n’as pas d’autre choix.

**7. `fer_en_07`**  
*Ordre de trahison, net, presque pressé.*

> **Open the door. Let them in.**

Sous-titre : Ouvre la porte. Laisse-les entrer.

**8. `fer_en_08`**  
*La phrase la plus forte du registre : lente, chaque mot détaché.*

> **Kneel before the Eye.**

Sous-titre : Agenouille-toi devant l’Œil.


---

## Séance 5 : Duel mental et cris des Nazgûl (anglais)

**1. `duel_victoire_en_01`**  
*Victoire au duel mental. Mépris tranquille.*

> **Your will is a candle. I am the night.**

Sous-titre : Ta volonté est une chandelle. Je suis la nuit.

**2. `duel_defaite_en_01`**  
*Défaite au duel : rage contenue, menace.*

> **You have seen too much. You will regret it.**

Sous-titre : Tu en as trop vu. Tu le regretteras.

**3. `duel_victoire_en_02`**  
*Satisfait, un peu moqueur.*

> **Your walls were made of paper. Now they are ash.**

Sous-titre : Tes murs étaient de papier. Ils sont de cendre.

**4. `duel_victoire_en_03`**  
*Doux et terrifiant, presque un murmure.*

> **You belong to me. You will not even remember.**

Sous-titre : Tu m’appartiens. Tu ne t’en souviendras même pas.

**5. `duel_victoire_en_04`**  
*Triomphe solennel face à Aragorn.*

> **Kneel, heir of kings, as your father's father knelt.**

Sous-titre : À genoux, héritier des rois, comme le père de ton père.

**6. `duel_defaite_en_02`**  
*Blessé mais patient. Un temps court avant « Not forever ».*

> **Your light burns. Not forever.**

Sous-titre : Ta lumière brûle. Pas pour toujours.

**7. `duel_defaite_en_03`**  
*Méprisant, la rage sous la surface.*

> **Run, then. The Eye remembers.**

Sous-titre : Fuis, donc. L’Œil se souvient.

**8. `duel_defaite_en_04`**  
*Calme glacial, celui qui a l’éternité.*

> **You have won a night. I have all the nights to come.**

Sous-titre : Tu as gagné une nuit. J’ai toutes celles qui viennent.

**9. `cri_nazgul_en_01`**  
*Nazgûl : sifflé, aigu, haché. Pas la voix de Sauron.*

> **Baggins! Shire! Baggins!**

Sous-titre : Sacquet ! Comté ! Sacquet !

**10. `cri_nazgul_en_02`**  
*Nazgûl : hurlé puis étiré sur « Ring ».*

> **Give up the Ring!**

Sous-titre : Rends l’Anneau !


---

## Séance 6 : Noir Parler : nouvelles répliques

**1. `paranoia_03`**  
*Soufflé, deux blocs séparés par un court silence (moins d’une seconde).*

> **NOUR-i-chi… THROUM**

Noir Parler : Nûr-ishi, thrûm.  
Sous-titre : Dans l’ombre, la peur.

**2. `paranoia_04`**  
*Lent, réfléchi, comme un plan qu’on énonce pour soi.*

> **douch-NAT-oul, agh krim-PAT-oul**

Noir Parler : Dushnat-ul, agh krimpat-ul.  
Sous-titre : Qu’ils doutent, et qu’ils soient liés.

**3. `annatar_02`**  
*Invitation chaleureuse, presque un honneur accordé.*

> **thra-KAT-izg LOUG-bourz**

Noir Parler : Thrakat-izg Lug-búrz.  
Sous-titre : Je t’amènerai à la Tour sombre.

**4. `duel_victoire_np_01`**  
*Victoire : lent, appuyé, la mâchoire serrée.*

> **MOZG-izg… ra-KHAT**

Noir Parler : Mozg-izg rakhat.  
Sous-titre : Ton esprit, je le brise.

**5. `duel_defaite_np_01`**  
*Défaite : de la douleur qui devient un cri de rage.*

> **GHACH. GHACH BOUR-zoum-I-chi !**

Noir Parler : Ghâsh. Ghâsh burzum-ishi!  
Sous-titre : Le feu. Le feu dans les ténèbres !

**6. `nazgul_np_01`**  
*Ordre aux Neuf, crié, comme au loin.*

> **GIM-bat NAZG !**

Noir Parler : Gimbat nazg!  
Sous-titre : Trouvez l’Anneau !

**7. `nazgul_np_02`**  
*Deux ordres froids, posés.*

> **gaz-GAT-oul. thra-KAT-oul**

Noir Parler : Gazgat-ul. Thrakat-ul.  
Sous-titre : Surveillez-les. Amenez-les.

**8. `forge_np_01`**  
*Exalté, la Montagne répond.*

> **GHACH ! dour-BAT-ouk**

Noir Parler : Ghâsh! Durbat-ûk.  
Sous-titre : Le feu ! Pour tout gouverner.

**9. `prison_np_01`**  
*Mépris craché au visage d’un prisonnier.*

> **KROU ! SNA-ga KROU !**

Noir Parler : Krû! Snaga krû!  
Sous-titre : Traître ! Esclave sans force !

**10. `aube_np_01`**  
*La phrase signature : très lente, grave, sans effort.*

> **OUL-bour gaz-GAT-ouk**

Noir Parler : Ulbur gazgat-ûk.  
Sous-titre : L’Œil voit tout.


---

## Séance 7 : Ordres aux Nazgûl (anglais)

**1. `nazgul_en_01`**  
*Ordre de mission, sobre et sans réplique.*

> **Ride. Find it, and bring it to me.**

Sous-titre : Chevauchez. Trouvez-le, et rapportez-le-moi.

**2. `nazgul_en_02`**  
*Trois phrases courtes, la dernière plus basse.*

> **Hunt by night. Rest by day. Do not fail me.**

Sous-titre : Chassez la nuit. Reposez-vous le jour. Ne me décevez pas.

**3. `nazgul_en_03`**  
*Précis, comme une adresse qu’on donne.*

> **Go to the Shire. Ask for Baggins.**

Sous-titre : Allez dans le Comté. Demandez Sacquet.

**4. `nazgul_en_04`**  
*Garde, posté : calme et ferme.*

> **Watch the roads. Let nothing pass.**

Sous-titre : Surveillez les routes. Que rien ne passe.

**5. `nazgul_en_05`**  
*Rappel, impatient.*

> **Return to me. I have need of you elsewhere.**

Sous-titre : Revenez à moi. J’ai besoin de vous ailleurs.

**6. `nazgul_en_06`**  
*Solennel, presque rituel.*

> **Nine you were. Nine you remain. Go.**

Sous-titre : Neuf vous étiez. Neuf vous restez. Allez.

**7. `nazgul_en_07`**  
*Au Roi-Sorcier : respect froid entre maître et lieutenant.*

> **Lord of Morgul, lead them.**

Sous-titre : Seigneur de Morgul, mène-les.

**8. `nazgul_en_08`**  
*Menace, sans crier.*

> **Fail me again, and I will unmake you.**

Sous-titre : Échoue encore, et je te déferai.


---

## Séance 8 : Prisons et interrogatoires (anglais)

**1. `prison_en_01`**  
*Patient, presque doux.*

> **Speak, and the pain will end.**

Sous-titre : Parle, et la douleur cessera.

**2. `prison_en_02`**  
*Ennuyé, sûr de lui.*

> **You will tell me. They all do, in the end.**

Sous-titre : Tu me le diras. Ils le font tous, à la fin.

**3. `prison_en_03`**  
*Pressant, deux questions qui claquent.*

> **Where is it? Who carries it?**

Sous-titre : Où est-il ? Qui le porte ?

**4. `prison_en_04`**  
*Paranoïa en cellule : tendre et cruel.*

> **Your friends have forgotten you. I have not.**

Sous-titre : Tes amis t’ont oublié. Pas moi.

**5. `prison_en_05`**  
*Libération d’un prisonnier retourné : satisfait.*

> **Release him. Let him carry my word home.**

Sous-titre : Relâchez-le. Qu’il rapporte ma parole chez lui.

**6. `prison_en_06`**  
*Ordre aux geôliers, détaché.*

> **Take him to the dark. Let him think.**

Sous-titre : Emmenez-le dans le noir. Qu’il réfléchisse.


---

## Séance 9 : Montagne du Destin, forge et améliorations (anglais)

**1. `forge_en_01`**  
*Fier, intime, en ouvrant l’écran de gestion.*

> **The mountain still remembers my hand.**

Sous-titre : La Montagne se souvient encore de ma main.

**2. `forge_en_02`**  
*Ordre qui monte en puissance.*

> **Feed the fire. Let Orodruin wake.**

Sous-titre : Nourrissez le feu. Qu’Orodruin s’éveille.

**3. `forge_en_03`**  
*Ambition, la voix s’élève.*

> **Build higher. Let every land see my tower.**

Sous-titre : Bâtissez plus haut. Que chaque terre voie ma tour.

**4. `forge_en_04`**  
*Avidité, de plus en plus fort.*

> **More iron. More fire. More.**

Sous-titre : Plus de fer. Plus de feu. Plus.

**5. `forge_en_05`**  
*Amélioration terminée : satisfaction lourde.*

> **It is done. My strength grows.**

Sous-titre : C’est fait. Ma force grandit.

**6. `forge_en_06`**  
*Sur l’Anneau, lent, possessif.*

> **Here I made it. Here it will return to me.**

Sous-titre : Ici je l’ai forgé. Ici il me reviendra.


---

## Séance 10 : Aube, réussites et colères (anglais)

**1. `aube_en_01`**  
*Début de tour : las, irrité.*

> **Another dawn. And still it eludes me.**

Sous-titre : Une aube de plus. Et il m’échappe encore.

**2. `aube_en_02`**  
*Début de tour : serein, menaçant.*

> **The sun rises. My shadow grows longer.**

Sous-titre : Le soleil se lève. Mon ombre s’allonge.

**3. `aube_en_03`**  
*Rapports de la nuit : attentif, exigeant.*

> **Tell me what the night has seen.**

Sous-titre : Dites-moi ce que la nuit a vu.

**4. `aube_en_04`**  
*Confiant, lent.*

> **Time is mine. Theirs is running out.**

Sous-titre : Le temps est à moi. Le leur s’épuise.

**5. `triomphe_en_01`**  
*Découverte : un souffle de plaisir.*

> **Yes. Yes… I see it now.**

Sous-titre : Oui. Oui… je le vois, maintenant.

**6. `triomphe_en_02`**  
*Agent recruté : satisfait.*

> **Another one falls into my hand.**

Sous-titre : Encore un qui tombe dans ma main.

**7. `triomphe_en_03`**  
*Peur qui se répand : amusé.*

> **They begin to understand.**

Sous-titre : Ils commencent à comprendre.

**8. `triomphe_en_04`**  
*Porteur repéré : très bas, lent, chaque mot pesé.*

> **I have found you.**

Sous-titre : Je t’ai trouvé.

**9. `triomphe_en_05`**  
*Ville prise : froid.*

> **Let it burn.**

Sous-titre : Qu’elle brûle.

**10. `colere_en_01`**  
*Démasqué : colère soudaine.*

> **No! They have seen me!**

Sous-titre : Non ! Ils m’ont vu !

**11. `colere_en_02`**  
*Échec d’un serviteur : mépris.*

> **Fools. Worthless, all of you.**

Sous-titre : Imbéciles. Bons à rien, tous.

**12. `colere_en_03`**  
*Porteur perdu : rage retenue, le dernier mot sec.*

> **It slipped through my fingers. Again.**

Sous-titre : Il m’a filé entre les doigts. Encore.

**13. `colere_en_04`**  
*Gandalf intervient : haine froide.*

> **The wizard meddles. He will pay.**

Sous-titre : Le magicien se mêle de tout. Il paiera.

**14. `colere_en_05`**  
*Explosion, puis retour au calme.*

> **Silence! I will not be mocked.**

Sous-titre : Silence ! On ne se moque pas de moi.


---

## Séance 11 : Écran titre, fin de partie, Nazgûl (anglais)

**1. `accueil_en_01`**  
*Écran titre : accueil sombre, possessif.*

> **You have come back to me.**

Sous-titre : Tu m’es revenu.

**2. `accueil_en_02`**  
*Nouvelle partie : invitation solennelle.*

> **Sit upon my throne. See through my Eye.**

Sous-titre : Assieds-toi sur mon trône. Vois par mon Œil.

**3. `fin_victoire_en_01`**  
*Victoire finale : triomphe immense, lent.*

> **The Ring is mine. All lands kneel.**

Sous-titre : L’Anneau est à moi. Toutes les terres s’agenouillent.

**4. `fin_defaite_en_01`**  
*Défaite finale : incrédulité, puis cri qui s’éteint.*

> **No… no! The Ring… it is unmade!**

Sous-titre : Non… non ! L’Anneau… il est détruit !

**5. `cri_nazgul_en_03`**  
*Nazgûl : chuchoté, reniflé, aigu.*

> **It is here… we can smell it.**

Sous-titre : Il est ici… nous le sentons.

