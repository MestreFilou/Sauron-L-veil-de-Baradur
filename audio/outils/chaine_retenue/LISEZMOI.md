# Chaîne de voix retenue (= voix_lucas_v3)

Choisie par Lucas le 20/11/2026. Pour toute nouvelle prise :
  ./render_rec.sh prise.wav sortie.mp3 [reverse] "$(cat eq_rec.txt)"
`reverse` : inverse la prise avant les effets (méthode anglais inversé). Sans : à l'endroit (pour le Noir Parler).
Dépendances : sox, ffmpeg.
