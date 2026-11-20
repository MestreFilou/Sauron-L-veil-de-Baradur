/**
 * Lecture du son en Web Audio : la musique d'ambiance (fondus enchaînés,
 * gain par piste) et les voix déjà traitées par la chaîne « légion ».
 * Rien n'est synthétisé ici (mécaniques 10.3) : on lit des fichiers.
 *
 * Graphe : pistes → musique (volume) → baisse sous la voix → sortie
 *          voix → voix (volume) → sortie
 *
 * Tout ce qui manque (fichier absent, navigateur qui refuse la lecture) se
 * traduit par du silence, jamais par une erreur visible.
 */
import type { Ambiance, Piste, Replique } from '@sauron/audio';
import { dbVersGain, pisteAmbiance } from '@sauron/audio';
import { urlMusique, urlVoix } from './fichiers';
import { gainBus, type ReglagesSon } from './reglages';

/** Gain de la musique pendant qu'une voix parle. */
const BAISSE_SOUS_VOIX = 0.35;

interface Lecture {
  ambiance: Ambiance;
  piste: Piste;
  cle: number;
  el: HTMLAudioElement;
  gain: GainNode;
}

export interface Parole {
  replique: Replique;
  /** null : pas de fichier (réplique à enregistrer), le sous-titre s'affiche seul. */
  el: HTMLAudioElement | null;
  /** Durée en secondes (fichier, banque, ou estimation sans fichier). */
  duree: number;
  /** performance.now() au départ. */
  debut: number;
}

/** Durée d'affichage d'un sous-titre sans voix : à peu près le temps de le lire. */
export const dureeLecture = (r: Replique) => Math.max(2.5, Math.min(12, r.sous_titre.length / 14));

export class MoteurSon {
  private ctx: AudioContext | null = null;
  private busMusique: GainNode | null = null;
  private baisse: GainNode | null = null;
  private busVoix: GainNode | null = null;
  private lecture: Lecture | null = null;
  private voulue: { ambiance: Ambiance; cle: number } | null = null;
  /** L'ambiance en cours, même si sa piste s'est terminée ou n'existe pas. */
  private courante: Ambiance | null = null;
  private voix: HTMLAudioElement | null = null;
  private reglages: ReglagesSon | null = null;

  /** À appeler sur un geste du joueur : les navigateurs n'ouvrent le son qu'après une interaction. */
  debloquer() {
    try {
      if (!this.ctx) {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        this.ctx = ctx;
        this.busMusique = ctx.createGain();
        this.baisse = ctx.createGain();
        this.busVoix = ctx.createGain();
        this.busMusique.connect(this.baisse).connect(ctx.destination);
        this.busVoix.connect(ctx.destination);
        if (this.reglages) this.regler(this.reglages);
        if (this.voulue) this.ambiance(this.voulue.ambiance, this.voulue.cle);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
    } catch {
      /* pas de Web Audio : le jeu reste muet */
    }
  }

  get actif() {
    return this.ctx !== null;
  }

  regler(r: ReglagesSon) {
    this.reglages = r;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.busMusique!.gain.setTargetAtTime(gainBus(r, 'musique'), t, 0.08);
    this.busVoix!.gain.setTargetAtTime(gainBus(r, 'voix'), t, 0.08);
  }

  /** Demande une ambiance. Même ambiance : rien ne change. Ambiance sans piste : la musique s'éteint en fondu. */
  ambiance(ambiance: Ambiance, cle = 0) {
    this.voulue = { ambiance, cle };
    if (!this.ctx) return;
    if (this.courante === ambiance) return;
    this.courante = ambiance;
    this.enchainer(ambiance, cle);
  }

  private enchainer(ambiance: Ambiance, cle: number) {
    const ancienne = this.lecture;
    this.lecture = null;
    if (ancienne) this.eteindre(ancienne, ancienne.piste.fondu_s);

    const piste = pisteAmbiance(ambiance, cle);
    const url = piste && urlMusique(piste.fichier);
    if (!piste || !url || !this.ctx) return;

    const ctx = this.ctx;
    const el = new Audio(url);
    el.loop = piste.boucle;
    el.preload = 'auto';
    const gain = ctx.createGain();
    gain.gain.value = 0;
    try {
      ctx.createMediaElementSource(el).connect(gain).connect(this.busMusique!);
    } catch {
      return;
    }
    const lecture: Lecture = { ambiance, piste, cle, el, gain };
    this.lecture = lecture;
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(dbVersGain(piste.volume_db), t + Math.max(0.05, piste.fondu_s));
    // Piste sans boucle : à la fin, la suivante de la même ambiance (s'il y en a une autre).
    el.addEventListener('ended', () => {
      if (this.lecture !== lecture) return;
      const suivante = pisteAmbiance(ambiance, cle + 1);
      this.lecture = null;
      if (suivante && suivante !== piste) this.enchainer(ambiance, cle + 1);
    });
    el.addEventListener('error', () => {
      if (this.lecture === lecture) this.lecture = null;
    });
    void el.play().catch(() => {});
  }

  private eteindre(l: Lecture, fondu: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const d = Math.max(0.05, fondu);
    l.gain.gain.cancelScheduledValues(t);
    l.gain.gain.setValueAtTime(l.gain.gain.value, t);
    l.gain.gain.linearRampToValueAtTime(0, t + d);
    setTimeout(() => {
      l.el.pause();
      l.el.removeAttribute('src');
      l.el.load();
      l.gain.disconnect();
    }, d * 1000 + 100);
  }

  /**
   * Dit une réplique. Une seule voix à la fois : une nouvelle coupe la précédente.
   * Sans fichier (pas encore enregistrée), renvoie une parole muette, pour que
   * le sous-titre s'affiche quand même.
   */
  dire(r: Replique, fini?: () => void): Parole {
    this.taire();
    const url = urlVoix(r.fichier);
    const debut = performance.now();
    if (!url || !this.ctx) return { replique: r, el: null, duree: r.duree_s ?? dureeLecture(r), debut };

    const ctx = this.ctx;
    const el = new Audio(url);
    el.preload = 'auto';
    try {
      ctx.createMediaElementSource(el).connect(this.busVoix!);
    } catch {
      return { replique: r, el: null, duree: dureeLecture(r), debut };
    }
    this.voix = el;
    const parole: Parole = { replique: r, el, duree: r.duree_s ?? dureeLecture(r), debut };
    el.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(el.duration) && el.duration > 0) parole.duree = el.duration;
    });
    const fin = () => {
      if (this.voix !== el) return;
      this.voix = null;
      this.relever();
      fini?.();
    };
    el.addEventListener('ended', fin);
    el.addEventListener('error', fin);
    this.baisser();
    void el.play().catch(fin);
    return parole;
  }

  taire() {
    const v = this.voix;
    if (!v) return;
    this.voix = null;
    v.pause();
    this.relever();
  }

  private baisser() {
    if (!this.ctx) return;
    this.baisse!.gain.setTargetAtTime(BAISSE_SOUS_VOIX, this.ctx.currentTime, 0.1);
  }

  private relever() {
    if (!this.ctx) return;
    this.baisse!.gain.setTargetAtTime(1, this.ctx.currentTime, 0.4);
  }
}

export const moteurSon = new MoteurSon();
