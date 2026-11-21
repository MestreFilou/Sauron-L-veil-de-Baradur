"""
Petite boîte à outils de synthèse hors ligne (numpy seul) pour la musique et
les effets du jeu. Tout est calculé à partir de graines fixes : relancer
`generer.py` redonne exactement les mêmes fichiers.

Conventions : 44,1 kHz, signaux en float64, stéréo = tableau (2, n).
"""
from __future__ import annotations

import numpy as np

SR = 44100
TAU = 2 * np.pi


def n_(duree: float) -> int:
    return int(round(duree * SR))


def temps(duree: float) -> np.ndarray:
    return np.arange(n_(duree)) / SR


# --- Notes -----------------------------------------------------------------

NOMS = {'C': -9, 'C#': -8, 'Db': -8, 'D': -7, 'D#': -6, 'Eb': -6, 'E': -5, 'F': -4, 'F#': -3, 'Gb': -3,
        'G': -2, 'G#': -1, 'Ab': -1, 'A': 0, 'A#': 1, 'Bb': 1, 'B': 2}


def hz(note: str) -> float:
    """« D2 », « Bb3 », « C#4 » → fréquence (la 440)."""
    nom, octave = note[:-1], int(note[-1])
    return 440.0 * 2 ** ((NOMS[nom] + 12 * (octave - 4)) / 12)


# --- Hasard lissé ------------------------------------------------------------

def derive(rng: np.random.Generator, duree: float, vitesse: float = 0.3, periode: float | None = None) -> np.ndarray:
    """Bruit lent entre -1 et 1 (points tirés toutes les 1/vitesse s, interpolés en cosinus).
    Avec `periode`, la courbe boucle exactement sur cette durée."""
    n = n_(duree)
    pas = max(1, int(SR / vitesse))
    if periode:
        k = max(2, int(round(periode * vitesse)))
        pas = n_(periode) / k
        pts = rng.uniform(-1, 1, k)
        pts = np.concatenate([pts, pts[:1]])
        x = np.arange(n) / pas
        i = np.floor(x).astype(int) % k
        f = x - np.floor(x)
    else:
        k = n // pas + 2
        pts = rng.uniform(-1, 1, k + 1)
        x = np.arange(n) / pas
        i = np.floor(x).astype(int)
        f = x - i
    w = (1 - np.cos(np.pi * f)) / 2
    return pts[i] * (1 - w) + pts[i + 1] * w


# --- Filtres dans le domaine fréquentiel (statiques) ---------------------------

def _rfft_filtre(x: np.ndarray, reponse) -> np.ndarray:
    n = x.shape[-1]
    X = np.fft.rfft(x, axis=-1)
    f = np.fft.rfftfreq(n, 1 / SR)
    return np.fft.irfft(X * reponse(f), n=n, axis=-1)


def passe_bas(x, fc, ordre=2):
    return _rfft_filtre(x, lambda f: 1 / np.sqrt(1 + (f / fc) ** (2 * ordre)))


def passe_haut(x, fc, ordre=2):
    return _rfft_filtre(x, lambda f: 1 / np.sqrt(1 + (fc / np.maximum(f, 1e-6)) ** (2 * ordre)))


def passe_bande(x, fc, largeur_oct=1.0):
    return _rfft_filtre(x, lambda f: np.exp(-0.5 * (np.log2(np.maximum(f, 1e-6) / fc) / largeur_oct) ** 2))


def formants(x, liste):
    """Filtre de formants : liste de (fréquence, largeur en octaves, gain)."""
    def rep(f):
        lf = np.log2(np.maximum(f, 1e-6))
        return sum(g * np.exp(-0.5 * ((lf - np.log2(fc)) / bw) ** 2) for fc, bw, g in liste)
    return _rfft_filtre(x, rep)


def balayage_bas(x, fc_debut, fc_fin, blocs=48):
    """Passe-bas dont la coupure glisse (par blocs recouvrants, fondus en cosinus)."""
    n = x.shape[-1]
    out = np.zeros_like(x)
    taille = n // blocs + 1
    fen = np.hanning(2 * taille)
    for b in range(-1, blocs + 1):
        a = b * taille - taille // 2
        lo, hi = max(0, a), min(n, a + 2 * taille)
        if hi <= lo:
            continue
        p = min(1, max(0, (b + 0.5) / blocs))
        fc = fc_debut * (fc_fin / fc_debut) ** p
        seg = passe_bas(x[..., lo:hi], fc)
        out[..., lo:hi] += seg * fen[lo - a:hi - a]
    return out


# --- Sources --------------------------------------------------------------------

def bruit(rng, duree, couleur='blanc'):
    x = rng.standard_normal(n_(duree))
    if couleur == 'rose':
        x = _rfft_filtre(x, lambda f: 1 / np.sqrt(np.maximum(f, 20)))
    elif couleur == 'brun':
        x = _rfft_filtre(x, lambda f: 1 / np.maximum(f, 15))
    return x / (np.std(x) + 1e-12)


def phase(freq: np.ndarray, phi0=0.0) -> np.ndarray:
    return TAU * np.cumsum(freq) / SR + phi0


def additif(rng, f0, duree, amplitudes, vibrato=(5.0, 0.0), derive_cents=0.0, fmax=9000, freq_courbe=None):
    """Son additif : `amplitudes(k, fk)` donne le poids de l'harmonique k (scalaire ou tableau dans le temps)."""
    t = temps(duree)
    f = np.full_like(t, f0) if freq_courbe is None else freq_courbe
    vf, vd = vibrato
    if vd:
        f = f * (1 + vd * np.sin(TAU * vf * t + rng.uniform(0, TAU)) * np.clip(t / 1.5, 0, 1))
    if derive_cents:
        f = f * 2 ** (derive_cents * derive(rng, duree, 0.25) / 1200)
    ph = phase(f, rng.uniform(0, TAU))
    out = np.zeros_like(t)
    k = 1
    while k * f0 < fmax:
        a = amplitudes(k, k * f0)
        if np.any(a):
            out += a * np.sin(k * ph + rng.uniform(0, TAU))
        k += 1
    return out


def enveloppe(duree, attaque, relache, forme=1.0):
    t = temps(duree)
    e = np.minimum(1, t / max(attaque, 1e-4))
    e = np.minimum(e, np.clip((duree - t) / max(relache, 1e-4), 0, 1))
    return e ** forme


def decroissance(duree, tau, attaque=0.002):
    t = temps(duree)
    return np.minimum(1, t / attaque) * np.exp(-t / tau)


# --- Instruments ------------------------------------------------------------------

VOYELLES = {
    'a': [(730, 0.25, 1.0), (1090, 0.25, 0.5), (2440, 0.2, 0.25)],
    'o': [(450, 0.25, 1.0), (800, 0.25, 0.45), (2830, 0.2, 0.12)],
    'u': [(320, 0.25, 1.0), (800, 0.3, 0.25), (2300, 0.2, 0.06)],
    'e': [(500, 0.25, 1.0), (1650, 0.25, 0.4), (2500, 0.2, 0.2)],
}


def _poids_formants(fk, voyelle):
    lf = np.log2(fk)
    return sum(g * np.exp(-0.5 * ((lf - np.log2(fc)) / bw) ** 2) for fc, bw, g in VOYELLES[voyelle]) + 0.04


def choeur(rng, note, duree, voyelle='a', voix=4, attaque=2.5, relache=3.0, souffle=0.08):
    """Un pupitre de chœur grave : plusieurs voix légèrement désaccordées, vibrato, formants, souffle."""
    f0 = hz(note) if isinstance(note, str) else note
    out = np.zeros((2, n_(duree)))
    for v in range(voix):
        fv = f0 * 2 ** (rng.uniform(-9, 9) / 1200)
        s = additif(rng, fv, duree, lambda k, fk: 0.6 / k ** 0.8 + 0.3 * _poids_formants(fk, voyelle) / k ** 0.4,
                    vibrato=(rng.uniform(4.2, 5.6), rng.uniform(0.003, 0.006)), derive_cents=6, fmax=5000)
        pan = (v / max(1, voix - 1)) * 1.2 - 0.6
        out[0] += s * np.sqrt((1 - pan) / 2)
        out[1] += s * np.sqrt((1 + pan) / 2)
    if souffle:
        b = np.vstack([bruit(rng, duree, 'rose') for _ in range(2)])
        b = formants(b, VOYELLES[voyelle]) * souffle
        out += b * np.sqrt(np.abs(out).mean() + 1e-9)
    return out * enveloppe(duree, attaque, relache, 1.5) / voix


def bourdon(rng, note, duree, brillance=1200, battement=0.15, periode=None):
    """Nappe grave : dents de scie désaccordées, filtrées, avec une respiration lente."""
    f0 = hz(note) if isinstance(note, str) else note
    out = np.zeros((2, n_(duree)))
    for c in range(2):
        s = np.zeros(n_(duree))
        for d in (-battement, 0, battement):
            fd = f0 * 2 ** (d * (1 + 0.2 * c) / 12 / 10)
            s += additif(rng, fd, duree, lambda k, fk: 1 / k * (1 / (1 + (fk / brillance) ** 2)), fmax=6000)
        out[c] = s
    souffle = 0.75 + 0.25 * derive(rng, duree, 0.08, periode)
    return out * souffle / 3


def cuivre(rng, note, duree, attaque=1.2, relache=1.5, force=1.0):
    """Cor ou trombone grave : la brillance suit l'enveloppe."""
    f0 = hz(note)
    env = enveloppe(duree, attaque, relache, 1.3) * force
    def amps(k, fk):
        return env * np.exp(-(k - 1) / (1.2 + 7 * env)) / (1 + (fk / 3500) ** 2)
    s = np.zeros(n_(duree))
    for _ in range(3):
        s += additif(rng, f0 * 2 ** (rng.uniform(-6, 6) / 1200), duree, amps, vibrato=(4.8, 0.002), fmax=6000)
    s = np.tanh(s * 0.9) / 3
    return np.vstack([s, s])


def cordes(rng, note, duree, tremolo=0.0, attaque=0.4, relache=0.8, voix=5, brillance=2500):
    """Section de cordes graves (scie filtrée, ensemble) ; tremolo en Hz."""
    f0 = hz(note)
    t = temps(duree)
    out = np.zeros((2, n_(duree)))
    for v in range(voix):
        fv = f0 * 2 ** (rng.uniform(-10, 10) / 1200)
        s = additif(rng, fv, duree, lambda k, fk: 1 / k / (1 + (fk / brillance) ** 2) * (1 + 0.6 * np.exp(-0.5 * ((fk - 1100) / 400) ** 2)),
                    vibrato=(rng.uniform(5, 6.2), 0.004), fmax=7000)
        if tremolo:
            s *= 0.55 + 0.45 * np.sin(TAU * tremolo * t + rng.uniform(0, TAU)) ** 2
        pan = rng.uniform(-0.7, 0.7)
        out[0] += s * np.sqrt((1 - pan) / 2)
        out[1] += s * np.sqrt((1 + pan) / 2)
    return out * enveloppe(duree, attaque, relache) / voix


def tambour(rng, f_haut=120, f_bas=46, tau=0.55, duree=2.2, peau=0.35):
    """Grand tambour de guerre : chute de hauteur, corps sinusoïdal, frappe bruitée."""
    t = temps(duree)
    f = f_bas + (f_haut - f_bas) * np.exp(-t / 0.035)
    corps = np.sin(phase(f)) * decroissance(duree, tau)
    corps += 0.35 * np.sin(phase(f * 1.59)) * decroissance(duree, tau * 0.35)
    frappe = passe_bas(bruit(rng, duree), 1400) * decroissance(duree, 0.018) * peau
    s = np.tanh((corps + frappe) * 1.6)
    return np.vstack([s, s])


def cloche(rng, f0, duree=6.0, tau=2.2, rapports=(0.5, 1.0, 1.19, 1.56, 2.0, 2.74, 3.76, 5.4), brillance=1.0):
    """Cloche ou gong : partiels inharmoniques, les aigus s'éteignent d'abord."""
    t = temps(duree)
    s = np.zeros_like(t)
    for i, r in enumerate(rapports):
        a = 1 / (1 + i * 0.6) * (brillance if r > 2 else 1)
        battu = 1 + 0.004 * np.sin(TAU * rng.uniform(0.5, 2) * t)
        s += a * np.sin(phase(np.full_like(t, f0 * r) * battu, rng.uniform(0, TAU))) * decroissance(duree, tau / (0.6 + r * 0.4), 0.003)
    return np.vstack([s, s]) / len(rapports) * 2.5


def enclume(rng, f0=880, duree=2.5):
    return cloche(rng, f0, duree, tau=0.9, rapports=(1.0, 2.76, 5.40, 8.93, 13.34), brillance=0.7)


def battement_coeur(rng, duree=1.0):
    t = temps(duree)
    def coup(dec):
        x = np.zeros_like(t)
        i = n_(dec)
        tt = t[: len(t) - i]
        x[i:] = np.sin(phase(52 + 30 * np.exp(-tt / 0.03))) * np.exp(-tt / 0.12) * np.minimum(1, tt / 0.004)
        return x
    s = coup(0) + 0.7 * coup(0.24)
    s = passe_bas(s, 180)
    return np.vstack([s, s])


# --- Espace ----------------------------------------------------------------------

def reponse_salle(rng, rt60=4.0, predelai=0.025, sombre=3500, duree=None):
    """Réponse impulsionnelle stéréo synthétique : bruit à décroissance exponentielle, de plus en plus sombre."""
    duree = duree or rt60 * 1.1
    t = temps(duree)
    env = np.exp(-6.9 * t / rt60)
    ir = np.zeros((2, len(t)))
    for c in range(2):
        b = rng.standard_normal(len(t))
        clair = passe_bas(b, sombre)
        terne = passe_bas(b, sombre / 5)
        m = np.exp(-t / (rt60 / 3))
        ir[c] = (clair * m + terne * (1 - m)) * env
    p = n_(predelai)
    ir = np.concatenate([np.zeros((2, p)), ir], axis=1)
    return ir / np.sqrt((ir ** 2).sum(axis=1, keepdims=True))


def convoluer(x: np.ndarray, ir: np.ndarray) -> np.ndarray:
    """Convolution stéréo par FFT ; la sortie fait len(x) + len(ir) - 1."""
    if x.ndim == 1:
        x = np.vstack([x, x])
    n = x.shape[1] + ir.shape[1] - 1
    m = 1 << (n - 1).bit_length()
    X = np.fft.rfft(x, m, axis=1)
    H = np.fft.rfft(ir, m, axis=1)
    return np.fft.irfft(X * H, m, axis=1)[:, :n]


def espace(x, ir, mouille=0.35):
    y = convoluer(x, ir)
    sec = np.zeros_like(y)
    sec[:, : x.shape[1]] = x
    return sec * (1 - mouille) + y * mouille


# --- Mixage --------------------------------------------------------------------------

class Piste:
    """Tampon stéréo où l'on pose des sons. En mode boucle, ce qui dépasse la fin revient au début :
    la piste se raccorde sans couture (queues de réverbération comprises)."""

    def __init__(self, duree: float, boucle: bool = True):
        self.n = n_(duree)
        self.boucle = boucle
        self.buf = np.zeros((2, self.n))

    def poser(self, son: np.ndarray, debut: float, gain: float = 1.0, pan: float = 0.0):
        if son.ndim == 1:
            son = np.vstack([son, son])
        g = np.array([[np.sqrt(1 - pan)], [np.sqrt(1 + pan)]]) * gain
        son = son * g
        i = n_(debut)
        if not self.boucle:
            if i + son.shape[1] > self.buf.shape[1]:
                self.buf = np.concatenate([self.buf, np.zeros((2, i + son.shape[1] - self.buf.shape[1]))], axis=1)
            self.buf[:, i:i + son.shape[1]] += son
            return
        pos, j = i % self.n, 0
        while j < son.shape[1]:
            k = min(self.n - pos, son.shape[1] - j)
            self.buf[:, pos:pos + k] += son[:, j:j + k]
            j += k
            pos = 0

    def rendre(self) -> np.ndarray:
        return self.buf


def boucler(x: np.ndarray, n: int) -> np.ndarray:
    """Replie un signal plus long que n sur une boucle de n échantillons."""
    out = np.zeros((x.shape[0], n))
    for i in range(0, x.shape[1], n):
        seg = x[:, i:i + n]
        out[:, : seg.shape[1]] += seg
    return out


def normaliser(x, crete=0.89):
    m = np.abs(x).max()
    return x * (crete / m) if m > 0 else x


def adoucir_bords(x, debut=0.004, fin=0.02):
    n = x.shape[-1]
    a, b = min(n, n_(debut)), min(n, n_(fin))
    x = x.copy()
    if a:
        x[..., :a] *= np.linspace(0, 1, a)
    if b:
        x[..., n - b:] *= np.linspace(1, 0, b)
    return x
