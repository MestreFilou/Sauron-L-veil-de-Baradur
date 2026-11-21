#!/usr/bin/env python3
"""
Génère la musique d'ambiance et les effets sonores du jeu, entièrement par
synthèse (aucun échantillon extérieur, donc aucun droit à céder ni à créditer
en dehors de ce dépôt). Les sorties sont des mp3 versionnés :

  audio/musique/libre/*.mp3   six pistes en boucle, une par ambiance
  audio/effets/*.mp3          effets d'interface, d'événement et fonds d'ambiance

usage : python3 audio/outils/generer_sons/generer.py [--seulement nom1,nom2] [--wav dossier]
Dépendances : python3, numpy, ffmpeg (libmp3lame).
"""
from __future__ import annotations

import argparse
import subprocess
import sys
import tempfile
import time
import wave
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from synthe import (SR, Piste, adoucir_bords, balayage_bas, battement_coeur, bourdon, bruit, choeur, cloche,  # noqa: E402
                    convoluer, cordes, cuivre, decroissance, derive, enclume, enveloppe, espace, formants, hz,
                    n_, normaliser, passe_bande, passe_bas, passe_haut, phase, reponse_salle, tambour, temps, TAU,
                    boucler, VOYELLES)

RACINE = Path(__file__).resolve().parents[2]
MUSIQUE = RACINE / 'musique' / 'libre'
EFFETS = RACINE / 'effets'


# --- Sortie -------------------------------------------------------------------------

def ecrire_mp3(x: np.ndarray, chemin: Path, debit='128k', rms_db: float | None = None, crete=0.89):
    """Normalise (RMS visé ou crête), limite en douceur, encode en mp3."""
    if rms_db is not None:
        rms = np.sqrt((x ** 2).mean())
        x = x * (10 ** (rms_db / 20) / (rms + 1e-12))
    m = np.abs(x).max()
    if m > crete:
        # limiteur doux : au-dessus du seuil, compression en tanh
        seuil = crete * 0.8
        a = np.abs(x)
        x = np.where(a > seuil, np.sign(x) * (seuil + (crete - seuil) * np.tanh((a - seuil) / (crete - seuil))), x)
    if rms_db is None:
        x = normaliser(x, crete)
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2').T.copy()
    chemin.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as d:
        w = Path(d) / 'a.wav'
        with wave.open(str(w), 'wb') as f:
            f.setnchannels(2)
            f.setsampwidth(2)
            f.setframerate(SR)
            f.writeframes(pcm.tobytes())
        if ARGS.wav:
            Path(ARGS.wav).mkdir(parents=True, exist_ok=True)
            (Path(ARGS.wav) / (chemin.stem + '.wav')).write_bytes(w.read_bytes())
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(w), '-c:a', 'libmp3lame', '-b:a', debit, str(chemin)], check=True)
    print(f'  {chemin.relative_to(RACINE)}  {x.shape[1] / SR:5.1f} s')


def seed(nom: str) -> np.random.Generator:
    return np.random.default_rng(abs(hash_stable(nom)))


def hash_stable(s: str) -> int:
    h = 2166136261
    for c in s.encode():
        h = ((h ^ c) * 16777619) & 0xFFFFFFFF
    return h


def reverbe_boucle(sec: np.ndarray, ir: np.ndarray, mouille: float) -> np.ndarray:
    """Réverbération d'une boucle : la queue retombe sur le début, la couture disparaît."""
    y = boucler(convoluer(sec, ir), sec.shape[1])
    return sec * (1 - mouille) + y * mouille


# =====================================================================================
# Musique
# =====================================================================================

ACCORDS = {
    'Dm': ['D3', 'F3', 'A3'], 'Dm_g': ['D2', 'A2', 'F3'], 'Eb': ['Eb3', 'G3', 'Bb3'], 'Bb': ['Bb2', 'D3', 'F3'],
    'Gm': ['G2', 'Bb2', 'D3'], 'A': ['A2', 'C#3', 'E3'], 'C': ['C3', 'E3', 'G3'], 'Dsus': ['D3', 'G3', 'A3'],
    'D': ['D3', 'F#3', 'A3'], 'Ebm7': ['Eb3', 'Gb3', 'Bb3'],
}


def m_barad_dur():
    """L'écran principal : bourdon de la Tour, chœur grave, tambours lents, enclume au loin. 96 s."""
    rng = seed('barad_dur')
    L, beat = 96.0, 1.0
    p = Piste(L)
    p.poser(bourdon(rng, 'D1', L, brillance=500, periode=L), 0, 0.55)
    p.poser(bourdon(rng, 'A1', L, brillance=380, periode=L), 0, 0.22)
    suite = ['Dm', 'Eb', 'Dm', 'Bb', 'Gm', 'Eb', 'Dsus', 'A']
    for i, a in enumerate(suite):
        for j, note in enumerate(ACCORDS[a]):
            p.poser(choeur(rng, note, 14.5, voyelle='o' if i % 2 else 'a', voix=4, attaque=3.5, relache=4), i * 12 - 0.8, 0.5 - j * 0.06, pan=(j - 1) * 0.3)
    # basse de chœur qui marque la tonique
    for i in range(0, 8, 2):
        p.poser(choeur(rng, 'D2', 24, voyelle='u', voix=3, attaque=4, relache=5, souffle=0.03), i * 12, 0.35)
    # tambours : boum . . boum-boum . . (deux mesures de 4)
    grand = [tambour(rng, 110, 44, 0.7, 2.6) for _ in range(3)]
    petit = [tambour(rng, 150, 62, 0.35, 1.5, 0.5) for _ in range(3)]
    for m in range(0, int(L / beat), 8):
        if m < 8:
            continue
        p.poser(grand[m % 3], m * beat, 0.55)
        p.poser(petit[(m + 1) % 3], (m + 2.5) * beat, 0.22, pan=-0.2)
        p.poser(grand[(m + 2) % 3], (m + 4) * beat, 0.45)
        p.poser(petit[m % 3], (m + 6.5) * beat, 0.2, pan=0.2)
        p.poser(petit[(m + 2) % 3], (m + 7) * beat, 0.26, pan=0.25)
    # cuivres aux changements de phrase
    for i, n in enumerate(['D2', 'Bb1', 'G1', 'A1']):
        p.poser(cuivre(rng, n, 7, attaque=2.5, relache=3, force=0.8), i * 24 + 0.5, 0.18)
    # enclume de la forge, lointaine
    for t in (6.0, 30.0, 54.5, 78.0):
        for k in range(3):
            p.poser(enclume(rng, 690 + rng.uniform(-20, 20)), t + k * 1.05, 0.05 * (1 - k * 0.25), pan=0.6)
    ir = reponse_salle(rng, rt60=5.5, sombre=3000)
    return reverbe_boucle(p.rendre(), ir, 0.42)


def m_traque():
    """Un Nazgûl sur une piste : ostinato de cordes graves, tambours en 3+3+2, chœur qui monte. 64 s à 120."""
    rng = seed('traque')
    L, croche = 64.0, 0.25
    p = Piste(L)
    p.poser(bourdon(rng, 'D1', L, brillance=420, periode=L), 0, 0.45)
    cache: dict[tuple, np.ndarray] = {}

    def note(n, accent):
        k = (n, accent)
        if k not in cache:
            cache[k] = cordes(rng, n, 0.34, attaque=0.012, relache=0.14, voix=4, brillance=1800 + 1200 * accent)
        return cache[k]

    motif = ['D2', 'D2', 'Eb2', 'D2', 'D2', 'D2', 'F2', 'Eb2', 'D2', 'D2', 'Eb2', 'D2', 'C2', 'D2', 'Bb1', 'C2']
    for i in range(int(L / croche)):
        n = motif[i % len(motif)]
        if (i // 64) % 2 == 1 and n == 'D2':
            n = 'D2' if i % 4 else 'G2'
        accent = 1 if i % 8 in (0, 3, 6) else 0
        p.poser(note(n, accent), i * croche, 0.42 + 0.22 * accent)
    # octave supérieure dans la seconde moitié
    for i in range(int(L / croche / 2), int(L / croche)):
        if i % 2 == 0:
            p.poser(note(motif[i % 16].replace('2', '3').replace('1', '2'), 0), i * croche, 0.16, pan=0.4)
    gros = [tambour(rng, 115, 48, 0.55, 2.0) for _ in range(3)]
    sec = [tambour(rng, 190, 85, 0.18, 0.9, 0.8) for _ in range(4)]
    for mesure in range(int(L / 2)):
        t0 = mesure * 2
        for j, c in enumerate((0, 3, 6)):
            p.poser(gros[(mesure + j) % 3], t0 + c * croche, 0.5 if c == 0 else 0.34)
        if mesure % 2 == 1:
            for j, c in enumerate((4, 5, 7)):
                p.poser(sec[(mesure + j) % 4], t0 + c * croche, 0.12 + 0.04 * j, pan=0.3 * (j - 1))
    for i, n in enumerate(['A3', 'Bb3', 'C4', 'C#4']):
        p.poser(choeur(rng, n, 18, voyelle='a', voix=5, attaque=6, relache=3), i * 16 - 1, 0.32)
        p.poser(choeur(rng, 'D3', 18, voyelle='a', voix=3, attaque=5, relache=3), i * 16 - 1, 0.24)
    for i in range(4):
        p.poser(cuivre(rng, 'D2', 1.6, attaque=0.05, relache=0.9, force=1), i * 16 + 15 * 0.5 * 2 - 0.0, 0.28)
    p.poser(cordes(rng, 'D4', 32, tremolo=13, attaque=10, relache=4, voix=5), 32, 0.09, pan=-0.3)
    p.poser(cordes(rng, 'Eb4', 32, tremolo=12, attaque=12, relache=4, voix=5), 32, 0.07, pan=0.3)
    ir = reponse_salle(rng, rt60=3.2, sombre=3800)
    return reverbe_boucle(p.rendre(), ir, 0.3)


def m_voix():
    """La Voix projetée : nappes de chœur bouche fermée, très lentes, cloches à l'envers. 48 s."""
    rng = seed('voix')
    L = 48.0
    p = Piste(L)
    p.poser(bourdon(rng, 'D1', L, brillance=260, periode=L), 0, 0.5)
    p.poser(bourdon(rng, 'D2', L, brillance=420, battement=0.3, periode=L), 0, 0.18)
    for i, notes in enumerate([['D4', 'Eb4', 'A3'], ['C4', 'Eb4', 'G3'], ['D4', 'E4', 'Bb3'], ['C#4', 'Eb4', 'A3']]):
        for j, n in enumerate(notes):
            p.poser(choeur(rng, n, 16, voyelle='u', voix=4, attaque=6, relache=6, souffle=0.12), i * 12 - 2, 0.3, pan=(j - 1) * 0.6)
    for t in (9.0, 33.0):
        c = cloche(rng, hz('A4'), 5, tau=2.5)[:, ::-1] * enveloppe(5, 0.01, 0.15)
        p.poser(c, t, 0.12, pan=-0.4)
        p.poser(cloche(rng, hz('Eb5'), 5, tau=2.5)[:, ::-1] * enveloppe(5, 0.01, 0.15), t + 12, 0.1, pan=0.4)
    # chuchotis : bruit dans des formants qui changent
    for k in range(8):
        d = 4.0
        b = np.vstack([bruit(rng, d, 'rose'), bruit(rng, d, 'rose')])
        v = 'aoue'[k % 4]
        b = formants(b, VOYELLES[v]) * enveloppe(d, 1.5, 2, 2) * (0.5 + 0.5 * derive(rng, d, 3) ** 2)
        p.poser(passe_haut(b, 400), k * 6 + 1.5, 0.05, pan=rng.uniform(-0.8, 0.8))
    ir = reponse_salle(rng, rt60=7, sombre=2600)
    return reverbe_boucle(p.rendre(), ir, 0.55)


def m_duel():
    """Duel mental : cœur à 72, triton grave, cordes en trémolo serré. 40 s."""
    rng = seed('duel')
    L, beat = 40.0, 60 / 72
    p = Piste(L)
    p.poser(bourdon(rng, 'D1', L, brillance=450, periode=L), 0, 0.45)
    p.poser(bourdon(rng, 'G#1', L, brillance=380, periode=L), 0, 0.28)
    coeur = [battement_coeur(rng) for _ in range(2)]
    for i in range(int(round(L / beat))):
        p.poser(coeur[i % 2], i * beat, 0.9)
    tam = [tambour(rng, 100, 42, 0.8, 2.6) for _ in range(2)]
    for i in range(0, int(round(L / beat)), 4):
        p.poser(tam[(i // 4) % 2], i * beat, 0.35)
    p.poser(cordes(rng, 'D3', L, tremolo=14, attaque=4, relache=4, voix=5), 0, 0.2, pan=-0.4)
    p.poser(cordes(rng, 'Eb3', L, tremolo=13, attaque=4, relache=4, voix=5), 0, 0.17, pan=0.4)
    p.poser(cordes(rng, 'Ab3', 20, tremolo=15, attaque=8, relache=4, voix=5), 20, 0.12)
    for i, n in enumerate(['D4', 'C#4']):
        p.poser(choeur(rng, n, 22, voyelle='e', voix=5, attaque=8, relache=6), i * 20 - 1, 0.18)
    ir = reponse_salle(rng, rt60=3.5, sombre=3200)
    return reverbe_boucle(p.rendre(), ir, 0.32)


def m_victoire():
    """Victoire : cuivres et chœur à pleine voix, gong et tambours. 48 s."""
    rng = seed('victoire')
    L, beat = 48.0, 0.75
    p = Piste(L)
    p.poser(bourdon(rng, 'D1', L, brillance=600, periode=L), 0, 0.45)
    suite = ['Dm', 'Bb', 'C', 'Dm', 'Gm', 'Eb', 'A', 'D']
    for i, a in enumerate(suite):
        for j, n in enumerate(ACCORDS[a]):
            p.poser(choeur(rng, n, 7.2, voyelle='a', voix=5, attaque=0.8, relache=2), i * 6, 0.5, pan=(j - 1) * 0.4)
            p.poser(cuivre(rng, n.replace('3', '2'), 6.5, attaque=0.4, relache=2, force=1), i * 6, 0.17, pan=(1 - j) * 0.3)
    gong = cloche(rng, 49, 9, tau=4.5, brillance=0.6)
    for i in range(0, 8, 2):
        p.poser(gong, i * 6, 0.45)
    gros = [tambour(rng, 110, 44, 0.6, 2.4) for _ in range(3)]
    for b in range(int(L / beat)):
        if b % 4 in (0, 2) or b % 8 == 7:
            p.poser(gros[b % 3], b * beat, 0.55 if b % 4 == 0 else 0.35)
    ir = reponse_salle(rng, rt60=5, sombre=3500)
    return reverbe_boucle(p.rendre(), ir, 0.38)


def m_defaite():
    """Défaite : le chœur descend, le vent passe, une cloche lointaine. 48 s."""
    rng = seed('defaite')
    L = 48.0
    p = Piste(L)
    p.poser(bourdon(rng, 'D1', L, brillance=240, periode=L), 0, 0.42)
    for i, (a, b) in enumerate([('D3', 'F3'), ('C3', 'Eb3'), ('Bb2', 'D3'), ('A2', 'C#3')]):
        p.poser(choeur(rng, a, 15, voyelle='u', voix=4, attaque=5, relache=6), i * 12 - 1.5, 0.42, pan=-0.3)
        p.poser(choeur(rng, b, 15, voyelle='o', voix=4, attaque=6, relache=6), i * 12 - 1, 0.3, pan=0.3)
    vent = np.vstack([bruit(rng, L, 'rose'), bruit(rng, L, 'rose')])
    vent = passe_bande(vent, 500, 1.2) * (0.45 + 0.55 * (0.5 + 0.5 * derive(rng, L, 0.12, L)))
    p.poser(vent, 0, 0.05)
    for t in (4.0, 28.0):
        p.poser(cloche(rng, hz('D3'), 8, tau=3.5), t, 0.16, pan=0.5)
    ir = reponse_salle(rng, rt60=6.5, sombre=2400)
    return reverbe_boucle(p.rendre(), ir, 0.5)


MUSIQUES = {
    'barad_dur': m_barad_dur, 'traque': m_traque, 'voix': m_voix,
    'duel': m_duel, 'victoire': m_victoire, 'defaite': m_defaite,
}


# =====================================================================================
# Effets
# =====================================================================================

def avec_salle(rng, x, rt60=1.2, mouille=0.25, sombre=4000):
    y = espace(x if x.ndim == 2 else np.vstack([x, x]), reponse_salle(rng, rt60, sombre=sombre), mouille)
    nz = np.nonzero(np.abs(y).max(axis=0) > 1e-4 * np.abs(y).max())[0]
    return adoucir_bords(y[:, : nz[-1] + 1])


def st(x):
    return x if x.ndim == 2 else np.vstack([x, x])


def e_ui_survol(rng):
    d = 0.06
    c = passe_bande(bruit(rng, d), 3200, 0.5) * decroissance(d, 0.006, 0.0005)
    ton = np.sin(phase(np.full(n_(d), 1480.0))) * decroissance(d, 0.012, 0.001) * 0.5
    return avec_salle(rng, st(c * 0.6 + ton), 0.4, 0.15)


def e_ui_clic(rng):
    d = 0.25
    t = temps(d)
    corps = np.sin(phase(170 + 160 * np.exp(-t / 0.01))) * decroissance(d, 0.035)
    clic = passe_bande(bruit(rng, d), 2500, 0.7) * decroissance(d, 0.004, 0.0004)
    return avec_salle(rng, st(np.tanh(1.5 * corps) * 0.8 + clic * 0.6), 0.5, 0.18)


def e_ui_onglet(rng):
    d = 0.22
    b = np.vstack([bruit(rng, d, 'rose'), bruit(rng, d, 'rose')])
    b = balayage_bas(b, 900, 4500, 16) * enveloppe(d, 0.05, 0.15, 2)
    return avec_salle(rng, b, 0.4, 0.15)


def e_ordre(rng):
    tam = tambour(rng, 160, 70, 0.22, 1.2, 0.6)
    enc = enclume(rng, 520, 1.6) * 0.35
    n = max(tam.shape[1], enc.shape[1])
    x = np.zeros((2, n))
    x[:, : tam.shape[1]] += tam
    x[:, n_(0.02): n_(0.02) + enc.shape[1]] += enc[:, : n - n_(0.02)]
    return avec_salle(rng, x, 1.4, 0.25)


def e_ordre_annule(rng):
    d = 0.5
    b = np.vstack([bruit(rng, d, 'rose'), bruit(rng, d, 'rose')])
    b = balayage_bas(b, 3500, 400, 16) * enveloppe(d, 0.02, 0.35, 1.5)
    t = temps(d)
    thud = np.sin(phase(120 * np.exp(-t / 0.3))) * decroissance(d, 0.08) * 0.6
    return avec_salle(rng, b * 0.6 + st(thud), 0.8, 0.2)


def e_fin_tour(rng):
    d = 7.0
    g = cloche(rng, 55, d, tau=3.5, brillance=0.7)
    tam = tambour(rng, 100, 40, 0.9, 3.0)
    x = g * 0.7
    x[:, : tam.shape[1]] += tam * 0.9
    x[:, : n_(d)] += choeur(rng, 'D2', d, voyelle='o', voix=4, attaque=0.6, relache=5, souffle=0.04)[:, : n_(d)] * 0.6
    return avec_salle(rng, x, 4.5, 0.4, 3000)


def e_regard(rng):
    """Le Regard se pose : souffle de feu qui enfle, grondement."""
    d = 2.2
    t = temps(d)
    b = np.vstack([bruit(rng, d, 'rose'), bruit(rng, d, 'rose')])
    env = np.minimum(1, t / 0.5) ** 2 * np.exp(-np.maximum(0, t - 0.5) / 0.6)
    feu = balayage_bas(b, 300, 3800, 24) * env
    crepit = np.zeros(n_(d))
    for _ in range(40):
        i = rng.integers(0, n_(d * 0.8))
        k = n_(0.01)
        crepit[i:i + k] += rng.standard_normal(k) * np.exp(-np.arange(k) / 60)
    crepit = passe_haut(crepit, 1800) * env * 0.5
    roar = np.sin(phase(38 + 18 * env)) * env * 0.9
    return avec_salle(rng, feu + st(crepit + roar), 2.2, 0.3, 2500)


def e_anneau(rng):
    """Quelque chose répond au Regard : scintillement et chœur aigu."""
    d = 4.0
    x = np.zeros((2, n_(d)))
    for k, f in enumerate([hz('A5'), hz('E6'), hz('Bb5'), hz('D6')]):
        c = cloche(rng, f, d - k * 0.12, tau=1.6, rapports=(1, 2.0, 3.01, 4.2))
        x[:, n_(k * 0.12): n_(k * 0.12) + c.shape[1]] += c * (0.5 - k * 0.07)
    x += choeur(rng, 'A4', d, voyelle='a', voix=5, attaque=0.3, relache=2.5) * 1.2
    x += choeur(rng, 'D4', d, voyelle='a', voix=4, attaque=0.3, relache=2.5) * 0.8
    return avec_salle(rng, x, 4, 0.45, 5000)


def e_repousse(rng):
    """Une lumière blanche brûle l'Œil : éclat brillant puis chute."""
    d = 2.0
    t = temps(d)
    b = np.vstack([bruit(rng, d), bruit(rng, d)])
    eclat = passe_haut(b, 2500) * decroissance(d, 0.25, 0.005)
    chute = np.sin(phase(900 * np.exp(-t / 0.5) + 60)) * decroissance(d, 0.6, 0.01) * 0.5
    grond = np.sin(phase(np.full(n_(d), 45.0))) * decroissance(d, 0.7, 0.05)
    return avec_salle(rng, eclat * 0.5 + st(chute + grond), 2.5, 0.35)


def e_ombre(rng, entrer=True):
    d = 1.6
    t = temps(d)
    b = np.vstack([bruit(rng, d, 'rose'), bruit(rng, d, 'rose')])
    if entrer:
        w = balayage_bas(b, 5000, 250, 24) * enveloppe(d, 0.08, 1.0, 1.5)
        ton = np.sin(phase(70 * np.exp(-t / 1.2) + 30)) * enveloppe(d, 0.2, 1.2) * 0.8
    else:
        w = balayage_bas(b, 250, 5000, 24) * enveloppe(d, 0.9, 0.25, 1.5)
        ton = np.sin(phase(30 + 70 * (1 - np.exp(-t / 0.8)))) * enveloppe(d, 0.8, 0.3) * 0.5
    return avec_salle(rng, w * 0.8 + st(ton), 2.5, 0.35, 2500)


def e_murmure(rng):
    """Un murmure classé : souffle chuchoté qui passe d'une voyelle à l'autre."""
    d = 0.9
    out = np.zeros((2, n_(d)))
    for i, v in enumerate('eao'):
        b = np.vstack([bruit(rng, d, 'rose'), bruit(rng, d, 'rose')])
        b = formants(b, [(f * 1.25, bw, g) for f, bw, g in VOYELLES[v]])
        a = np.clip(1 - np.abs(temps(d) / d * 3 - i - 0.5), 0, 1) ** 1.5
        out += b * a
    out = passe_haut(out, 700) * enveloppe(d, 0.1, 0.3)
    return avec_salle(rng, out, 1.2, 0.3)


def e_refus(rng):
    d = 0.7
    t = temps(d)
    def coup(dec, f):
        x = np.zeros(n_(d))
        i = n_(dec)
        tt = t[: n_(d) - i]
        x[i:] = np.sin(phase(f * (1 + 0.4 * np.exp(-tt / 0.02)))) * np.exp(-tt / 0.07) * np.minimum(1, tt / 0.002)
        return x
    s = np.tanh(2 * (coup(0, 110) + coup(0.14, 92)))
    s = passe_bas(s, 900)
    return avec_salle(rng, st(s), 0.6, 0.15)


def e_rituel(rng):
    """La Tour se replie sur elle-même : grondement qui enfle, chœur très grave."""
    d = 4.5
    b = np.vstack([bruit(rng, d, 'brun'), bruit(rng, d, 'brun')])
    b = passe_bas(b, 160) * enveloppe(d, 2.2, 1.6, 1.5)
    x = b * 1.2 + choeur(rng, 'D2', d, voyelle='u', voix=4, attaque=2, relache=1.8) * 0.9
    x += choeur(rng, 'A1', d, voyelle='o', voix=3, attaque=2.5, relache=1.8) * 0.6
    tam = tambour(rng, 90, 36, 1.0, 2.0)
    i = n_(2.3)
    x[:, i:i + tam.shape[1]] += tam[:, : x.shape[1] - i] * 0.8
    return avec_salle(rng, x, 4, 0.4, 2500)


def e_duel(rng):
    """Ouverture du duel mental : souffle à l'envers, puis impact."""
    d = 3.0
    pre = 1.0
    b = np.vstack([bruit(rng, pre, 'rose'), bruit(rng, pre, 'rose')])
    pre_s = balayage_bas(b, 300, 6000, 16) * (temps(pre) / pre) ** 3
    x = np.zeros((2, n_(d)))
    x[:, : pre_s.shape[1]] += pre_s * 0.7
    imp = tambour(rng, 120, 40, 0.8, d - pre)
    g = cloche(rng, 62, d - pre, tau=1.6, brillance=0.5)
    x[:, n_(pre):] += imp[:, : n_(d) - n_(pre)] + g[:, : n_(d) - n_(pre)] * 0.5
    return avec_salle(rng, x, 3.5, 0.38, 2800)


def e_entree(rng):
    """On entre dans la partie : coup sourd et gong."""
    d = 6.0
    x = cloche(rng, 46, d, tau=3.2, brillance=0.5) * 0.8
    tam = tambour(rng, 95, 36, 1.1, 3.5)
    x[:, : tam.shape[1]] += tam
    x += choeur(rng, 'D2', d, voyelle='a', voix=4, attaque=0.2, relache=4.5) * 0.5
    return avec_salle(rng, x, 5, 0.45, 2800)


# --- Fonds d'ambiance (boucles) ---------------------------------------------------------

def f_forge(rng):
    """Barad-dûr : grondement de la forge, crépitements, marteau lointain. 32 s en boucle."""
    L = 32.0
    p = Piste(L)
    g = np.vstack([bruit(rng, L, 'brun'), bruit(rng, L, 'brun')])
    g = passe_bas(g, 140) * (0.7 + 0.3 * derive(rng, L, 0.2, L))
    p.poser(g, 0, 1.0)
    feu = np.vstack([bruit(rng, L, 'rose'), bruit(rng, L, 'rose')])
    feu = passe_bande(feu, 600, 1.0) * (0.5 + 0.5 * (0.5 + 0.5 * derive(rng, L, 0.7, L)) ** 2)
    p.poser(feu, 0, 0.12)
    cr = np.zeros(n_(L))
    for _ in range(260):
        i = rng.integers(0, n_(L) - 2000)
        k = rng.integers(60, 600)
        cr[i:i + k] += rng.standard_normal(k) * np.exp(-np.arange(k) / (k / 5)) * rng.uniform(0.2, 1) ** 2
    p.poser(passe_haut(cr, 1500), 0, 0.2)
    for t in (3.0, 11.5, 19.0, 26.5):
        for k in range(rng.integers(2, 4)):
            p.poser(enclume(rng, 640 + rng.uniform(-30, 30), 2.0), t + k * 0.9, 0.06, pan=rng.uniform(-0.7, 0.7))
    ir = reponse_salle(rng, 3.5, sombre=2500)
    return reverbe_boucle(p.rendre(), ir, 0.35)


def f_vent(rng):
    """Le Monde de l'Ombre : vent froid qui siffle, plainte grave. 32 s en boucle."""
    L = 32.0
    p = Piste(L)
    for fc, v in ((280, 0.15), (700, 0.22), (1500, 0.3), (2800, 0.4)):
        b = np.vstack([bruit(rng, L, 'rose'), bruit(rng, L, 'rose')])
        b = passe_bande(b, fc, 0.35) * (0.5 + 0.5 * derive(rng, L, v, L)) ** 3
        p.poser(b, 0, 0.5 * (300 / fc) ** 0.3)
    t = temps(L)
    plainte = np.sin(phase(hz('D2') * (1 + 0.01 * derive(rng, L, 0.1, L)))) * (0.5 + 0.5 * derive(rng, L, 0.06, L)) ** 2
    p.poser(st(passe_bas(plainte, 300)), 0, 0.25)
    ir = reponse_salle(rng, 5, sombre=3000)
    return reverbe_boucle(p.rendre(), ir, 0.45)


EFFETS_LISTE = {
    'ui_survol': e_ui_survol, 'ui_clic': e_ui_clic, 'ui_onglet': e_ui_onglet,
    'ordre': e_ordre, 'ordre_annule': e_ordre_annule, 'fin_tour': e_fin_tour,
    'regard': e_regard, 'anneau': e_anneau, 'repousse': e_repousse,
    'ombre_entrer': lambda r: e_ombre(r, True), 'ombre_sortir': lambda r: e_ombre(r, False),
    'murmure': e_murmure, 'refus': e_refus, 'rituel': e_rituel, 'duel': e_duel, 'entree': e_entree,
}
FONDS = {'fond_forge': f_forge, 'fond_vent': f_vent}


def main():
    voulus = set(ARGS.seulement.split(',')) if ARGS.seulement else None
    debut = time.time()
    print('Musique')
    for nom, f in MUSIQUES.items():
        if voulus and nom not in voulus:
            continue
        ecrire_mp3(f(), MUSIQUE / f'{nom}.mp3', '128k', rms_db=-17)
    print('Effets')
    for nom, f in EFFETS_LISTE.items():
        if voulus and nom not in voulus:
            continue
        ecrire_mp3(f(seed(nom)), EFFETS / f'{nom}.mp3', '128k')
    for nom, f in FONDS.items():
        if voulus and nom not in voulus:
            continue
        ecrire_mp3(f(seed(nom)), EFFETS / f'{nom}.mp3', '128k', rms_db=-20)
    print(f'fini en {time.time() - debut:.0f} s')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--seulement', default='')
    ap.add_argument('--wav', default='')
    ARGS = ap.parse_args()
    main()
