/**
 * Chaîne de traitement de la voix de Sauron (mécaniques, 10.3), en Web Audio :
 * voix transposée vers le bas, sous-couche à l'octave inférieure (-12 dB),
 * couche chuchotée décalée de 30 ms (-18 dB), saturation légère, passe-bas
 * vers 6 kHz, réverbération à convolution (grande salle de pierre).
 *
 * Note : la transposition passe par `playbackRate`, qui ralentit aussi la voix.
 * C'est voulu pour Sauron (plus lent, plus lourd) ; une vraie transposition à
 * tempo constant demandera un AudioWorklet.
 */
export interface OptionsVoix {
  demiTons: number;
  sousCoucheDb: number;
  chuchotementDb: number;
  decalageChuchotementMs: number;
  passeBasHz: number;
  saturation: number;
  salle: 'barad_dur' | 'esprit';
}

export const VOIX_SAURON: OptionsVoix = {
  demiTons: -4,
  sousCoucheDb: -12,
  chuchotementDb: -18,
  decalageChuchotementMs: 30,
  passeBasHz: 6000,
  saturation: 0.25,
  salle: 'barad_dur',
};

/** Le cri des Nazgûl : pas de transposition vers le bas, aigus saturés. */
export const CRI_NAZGUL: OptionsVoix = { ...VOIX_SAURON, demiTons: 2, sousCoucheDb: -40, saturation: 0.8, passeBasHz: 12000, salle: 'esprit' };

export const dbVersGain = (db: number) => Math.pow(10, db / 20);
export const demiTonsVersTaux = (dt: number) => Math.pow(2, dt / 12);

/** Courbe de saturation douce (tanh), pour un WaveShaperNode. */
export function courbeSaturation(force: number, n = 1024): Float32Array {
  const k = 1 + force * 20;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  return c;
}

/** Réponse impulsionnelle synthétique : bruit à décroissance exponentielle. */
export function reponseImpulsionnelle(ctx: BaseAudioContext, salle: OptionsVoix['salle']): AudioBuffer {
  const duree = salle === 'barad_dur' ? 3.2 : 0.9;
  const len = Math.floor(ctx.sampleRate * duree);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  let s = 12345;
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      s = (s * 16807) % 2147483647;
      d[i] = ((s / 2147483647) * 2 - 1) * Math.pow(1 - i / len, salle === 'barad_dur' ? 2.5 : 4);
    }
  }
  return buf;
}

/**
 * Joue une réplique (le buffer de la voix, et en option sa version chuchotée)
 * à travers la chaîne. Renvoie la durée en secondes, pour caler les sous-titres.
 */
export function jouerVoix(ctx: AudioContext, voix: AudioBuffer, options: OptionsVoix = VOIX_SAURON, chuchote?: AudioBuffer): number {
  const sortie = ctx.createGain();
  const filtre = ctx.createBiquadFilter();
  filtre.type = 'lowpass';
  filtre.frequency.value = options.passeBasHz;
  const sat = ctx.createWaveShaper();
  sat.curve = courbeSaturation(options.saturation) as Float32Array<ArrayBuffer>;
  const reverb = ctx.createConvolver();
  reverb.buffer = reponseImpulsionnelle(ctx, options.salle);
  const humide = ctx.createGain();
  humide.gain.value = options.salle === 'barad_dur' ? 0.45 : 0.2;
  sat.connect(filtre);
  filtre.connect(sortie);
  filtre.connect(reverb);
  reverb.connect(humide);
  humide.connect(sortie);
  sortie.connect(ctx.destination);

  const t0 = ctx.currentTime + 0.05;
  const taux = demiTonsVersTaux(options.demiTons);
  const couche = (buffer: AudioBuffer, rate: number, gainDb: number, decalage = 0) => {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = dbVersGain(gainDb);
    src.connect(g);
    g.connect(sat);
    src.start(t0 + decalage);
  };
  couche(voix, taux, 0);
  couche(voix, taux / 2, options.sousCoucheDb);
  if (chuchote) couche(chuchote, taux, options.chuchotementDb, options.decalageChuchotementMs / 1000);
  return voix.duration / taux;
}

/** Synthèse vocale branchable (ElevenLabs, Piper, XTTS…) : le jeu ne l'exige pas. */
export interface SyntheseVocale {
  synthetiser(phonetique: string, voix: string): Promise<ArrayBuffer>;
}
