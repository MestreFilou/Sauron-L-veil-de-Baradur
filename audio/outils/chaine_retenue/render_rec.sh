#!/bin/bash
# usage: render_rec.sh entree.wav sortie.mp3 [reverse] [eq_entries]
# Chaine legion pour une vraie voix enregistree.
set -e
IN=$1; OUTF=$2; REV=${3:-}; EQ=${4:-}; T=$(mktemp -d); FF="ffmpeg -loglevel error -y"
$FF -i $IN -ac 1 -ar 44100 -af "afftdn=nr=18:nf=-35,agate=threshold=0.02:ratio=4:attack=5:release=120" $T/clean.wav </dev/null
if [ "$REV" = reverse ]; then sox $T/clean.wav $T/a.wav reverse; else cp $T/clean.wav $T/a.wav; fi
D=$(soxi -D $T/a.wav)
$FF -f lavfi -i "anoisesrc=d=$D:c=white:r=44100:a=0.8:s=3" -ac 1 $T/wn.wav </dev/null
$FF -f lavfi -i "anoisesrc=d=$D:c=brown:r=44100:a=1:s=7" -af "lowpass=f=70,highpass=f=18,volume=7,alimiter=limit=0.95" -ac 1 $T/mod.wav </dev/null
# chaque couche a sa propre derive lente de hauteur (vibrato tres lent) pour un rendu organique
sox $T/a.wav $T/m0.wav pitch -300
$FF -i $T/m0.wav -af "vibrato=f=0.4:d=0.04" $T/main.wav </dev/null
$FF -i $T/m0.wav -i $T/mod.wav -filter_complex "[0][1]amultiply,volume=2,alimiter=limit=0.7" $T/fry.wav </dev/null
$FF -i $T/m0.wav -i $T/wn.wav -filter_complex "[0][1]amultiply,highpass=f=900,lowpass=f=7000,volume=2.5,alimiter=limit=0.6" $T/rasp.wav </dev/null
sox $T/a.wav $T/L1a.wav pitch -1200 lowpass 900 overdrive 5
$FF -i $T/L1a.wav -af "vibrato=f=0.25:d=0.05,adelay=8" $T/L1.wav </dev/null
sox $T/a.wav $T/L2a.wav pitch -700 overdrive 4
$FF -i $T/L2a.wav -af "vibrato=f=0.33:d=0.05,adelay=24,atempo=0.995" $T/L2.wav </dev/null
sox $T/a.wav $T/L3a.wav pitch -60 highpass 300
$FF -i $T/L3a.wav -af "vibrato=f=0.5:d=0.04,adelay=13,atempo=1.004" $T/L3.wav </dev/null
sox $T/a.wav $T/L4a.wav pitch -1550 lowpass 500
$FF -i $T/L4a.wav -af "vibrato=f=0.2:d=0.06,adelay=37" $T/L4.wav </dev/null
for f in main fry rasp L1 L2 L3 L4; do sox $T/$f.wav -r 44100 -c 1 -b 16 $T/${f}n.wav; done
sox -m -v 0.6 $T/mainn.wav -v 0.08 $T/fryn.wav -v 0.05 $T/raspn.wav -v 0.5 $T/L1n.wav -v 0.35 $T/L2n.wav -v 0.25 $T/L3n.wav -v 0.35 $T/L4n.wav $T/mix.wav gain -n -6
sox $T/mix.wav $T/r.wav reverb 50 60 75 100 20 -4 norm -3 pad 0.2 1.2
if [ -n "$EQ" ]; then $FF -i $T/r.wav -af "firequalizer=gain_entry='$EQ',alimiter=limit=0.9:attack=5:release=80,loudnorm=I=-18:TP=-1.5" $T/e.wav </dev/null; else cp $T/r.wav $T/e.wav; fi
$FF -i $T/e.wav -c:a libmp3lame -q:a 2 $OUTF </dev/null
rm -rf $T
