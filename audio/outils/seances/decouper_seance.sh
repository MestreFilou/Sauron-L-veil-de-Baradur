#!/bin/bash
# Découpe une prise sur les silences et passe chaque phrase dans la chaîne retenue.
# Usage (depuis audio/) :
#   outils/seances/decouper_seance.sh prise.wav <séance> [--toutes]   # les phrases pas encore enregistrées de la séance, dans l'ordre
#   outils/seances/decouper_seance.sh prise.wav --ids id1 [id2 ...]   # des phrases précises, dans cet ordre
# Réglages : SILENCE_S (défaut 1.2 s de silence entre phrases), SEUIL (défaut -40d).
# Dépendances : sox, ffmpeg, node.
set -e
cd "$(dirname "$0")/../.."
PRISE=$1; shift
[ -f "$PRISE" ] || { echo "Prise introuvable : $PRISE"; exit 1; }
CHAINE=outils/chaine_retenue
EQ="$(cat $CHAINE/eq_yeti.txt)"
SILENCE_S=${SILENCE_S:-1.2}; SEUIL=${SEUIL:-'-40d'}

if [ "$1" = --ids ]; then
  shift
  LISTE=$(node -e '
    const b=require("./banque/voix.json").repliques;
    for (const id of process.argv.slice(1)) { const r=b.find(x=>x.id===id); if(!r){console.error("id inconnu : "+id);process.exit(1)} console.log(r.id+"\t"+r.methode) }' "$@")
else
  LISTE=$(node outils/seances/script_lecture.mjs --ids "$@")
fi
N=$(printf '%s\n' "$LISTE" | grep -c . || true)
[ "$N" -gt 0 ] || { echo "Aucune phrase à traiter."; exit 1; }

T=$(mktemp -d)
# Mono 44,1 kHz, léger débruitage pour que les silences soient bien détectés.
ffmpeg -loglevel error -y -i "$PRISE" -ac 1 -ar 44100 -af "highpass=f=60,afftdn=nr=12" "$T/prise.wav" </dev/null
mkdir "$T/morceaux"
sox "$T/prise.wav" "$T/morceaux/m.wav" silence 1 0.05 "$SEUIL" 1 "$SILENCE_S" "$SEUIL" : newfile : restart
# On écarte les morceaux de moins de 0,3 s (souffles, clics).
MORCEAUX=()
for f in $(ls "$T"/morceaux/*.wav | sort -V); do
  d=$(soxi -D "$f"); awk -v d="$d" 'BEGIN{exit !(d>=0.3)}' && MORCEAUX+=("$f")
done
if [ "${#MORCEAUX[@]}" -ne "$N" ]; then
  rm -rf decoupe_a_verifier; mkdir -p decoupe_a_verifier; cp "${MORCEAUX[@]}" decoupe_a_verifier/ 2>/dev/null || true
  echo "La prise donne ${#MORCEAUX[@]} morceaux pour $N phrases attendues : rien n'a été rangé."
  echo "Les morceaux sont dans audio/decoupe_a_verifier/. Essaie SILENCE_S=0.8 (phrases collées) ou SILENCE_S=1.8 (pauses dans une phrase)."
  rm -rf "$T"; exit 1
fi

mkdir -p voix
i=0
while IFS=$'\t' read -r id methode; do
  [ -n "$id" ] || continue
  src=${MORCEAUX[$i]}; i=$((i+1))
  if [ "$methode" = anglais_inverse ]; then sens=reverse; else sens=endroit; fi
  echo "$i/$N  $id ($sens)"
  bash $CHAINE/render_rec.sh "$src" "voix/$id.mp3" "$sens" "$EQ"
done <<< "$LISTE"
rm -rf "$T"
echo "Écoute les fichiers dans audio/voix/, puis : node outils/seances/marquer_enregistrees.mjs"
