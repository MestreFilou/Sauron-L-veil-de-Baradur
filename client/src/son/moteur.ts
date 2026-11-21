/**
 * Lecture du son en Web Audio : la musique d'ambiance (fondus enchaînés,
 * gain par piste), les voix déjà traitées par la chaîne « légion », les
 * effets et les fonds d'ambiance. Rien n'est synthétisé ici (mécaniques
 * 10.3) : on lit des fichiers, préparés hors ligne.
 *
 * Graphe : pistes → musique (volume) → baisse sous la voix → sortie
 *          voix → voix (volume) → sortie
 *          effets → effets (volume) → sortie
 *          fonds → baisse sous la voix → effets (volume)
 *
 * Tout ce qui manque (fichier absent, navigateur qui refuse la lecture) se
 * traduit par du silence, jamais par une erreur visible.
 */
import type { Ambiance, Fond, IdEffet, Piste, Replique } from '@sauron/audio';
import { dbVersGain, EFFETS, pisteAmbiance, vitesseEffet } from '@sauron/audio';
import { urlEffet, urlMusique, urlVoix } from './fichiers';
import { gainBus, type ReglagesSon } from './reglages';

/** Gain de la musique pendant qu'une voix parle. */
const BAISSE_SOUS_VOIX = 0.35;

interface Lecture {
  ambiance: Ambiance;
  piste: Piste;
  cle: number;
  /** Lecture en flux (longues pistes) … */
  el: HTMLAudioElement | null;
  /** … ou décodée en mémoire, bouclée sans couture (sans_coupure). */
  src: AudioBufferSourceNode | null;
  gain: GainNode;
}

interface LectureFond {
  fond: Fond;
  src: AudioBufferSourceNode | null;
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
  private busEffets: GainNode | null = null;
  private baisseFond: GainNode | null = null;
  private tampons = new Map<string, Promise<AudioBuffer | null>>();
  private derniers = new Map<IdEffet, number>();
  private fondEnCours: LectureFond | null = null;
  private fondVoulu: Fond | null = null;
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
        this.busEffets = ctx.createGain();
        this.baisseFond = ctx.createGain();
        this.busEffets.connect(ctx.destination);
        this.baisseFond.connect(this.busEffets);
        if (this.reglages) this.regler(this.reglages);
        // Les effets sont courts : on les décode tous d'avance pour qu'ils partent sans délai.
        for (const e of Object.values(EFFETS.effets)) {
          const url = urlEffet(e.fichier);
          if (url) void this.tampon(url);
        }
        if (this.voulue) this.ambiance(this.voulue.ambiance, this.voulue.cle);
        if (this.fondVoulu) this.fond(this.fondVoulu);
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
    this.busEffets!.gain.setTargetAtTime(gainBus(r, 'effets'), t, 0.08);
  }

  /** Décode un fichier une fois pour toutes (null s'il est illisible). */
  private tampon(url: string): Promise<AudioBuffer | null> {
    let p = this.tampons.get(url);
    if (!p) {
      const ctx = this.ctx!;
      p = fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((b) => ctx.decodeAudioData(b))
        .catch(() => null);
      this.tampons.set(url, p);
    }
    return p;
  }

  /**
   * Joue un effet. Un même effet ne se répète pas plus vite que son
   * intervalle_s, et sa vitesse varie un peu à chaque fois.
   */
  effet(id: IdEffet, { retard = 0 } = {}) {
    const e = EFFETS.effets[id];
    const url = e && urlEffet(e.fichier);
    if (!url || !this.ctx || this.ctx.state === 'closed') return;
    const maintenant = performance.now();
    if (maintenant - (this.derniers.get(id) ?? -Infinity) < e.intervalle_s * 1000) return;
    this.derniers.set(id, maintenant);
    const ctx = this.ctx;
    void this.tampon(url).then((buf) => {
      if (!buf) return;
      // Trop tard (décodage lent, premier geste) : un son d'interface n'a plus de sens,
      // un son d'événement peut encore arriver un peu après.
      if (performance.now() - maintenant > (id.startsWith('ui_') ? 400 : 2500) + retard * 1000) return;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = vitesseEffet(e, Math.random());
      const g = ctx.createGain();
      g.gain.value = dbVersGain(e.volume_db);
      src.connect(g).connect(this.busEffets!);
      src.onended = () => g.disconnect();
      src.start(ctx.currentTime + Math.max(0, retard - (performance.now() - maintenant) / 1000));
    });
  }

  /** Le fond d'ambiance (forge ou vent), en boucle, en fondu enchaîné ; null l'éteint. */
  fond(f: Fond | null) {
    this.fondVoulu = f;
    if (!this.ctx) return;
    if (this.fondEnCours?.fond === f) return;
    const ancien = this.fondEnCours;
    this.fondEnCours = null;
    const ctx = this.ctx;
    if (ancien) {
      const t = ctx.currentTime;
      ancien.gain.gain.cancelScheduledValues(t);
      ancien.gain.gain.setValueAtTime(ancien.gain.gain.value, t);
      ancien.gain.gain.linearRampToValueAtTime(0, t + 2);
      setTimeout(() => {
        try {
          ancien.src?.stop();
        } catch {
          /* déjà arrêté */
        }
        ancien.gain.disconnect();
      }, 2100);
    }
    const def = f && EFFETS.fonds[f];
    const url = def && urlEffet(def.fichier);
    if (!f || !def || !url) return;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.baisseFond!);
    const lecture: LectureFond = { fond: f, src: null, gain };
    this.fondEnCours = lecture;
    void this.tampon(url).then((buf) => {
      if (!buf || this.fondEnCours !== lecture) return gain.disconnect();
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(gain);
      lecture.src = src;
      const t = ctx.currentTime;
      // On n'entre pas toujours au même endroit de la boucle.
      src.start(t, Math.random() * buf.duration);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(dbVersGain(def.volume_db), t + 2.5);
    });
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
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.busMusique!);
    const lecture: Lecture = { ambiance, piste, cle, el: null, src: null, gain };
    this.lecture = lecture;
    const monter = () => {
      const t = ctx.currentTime;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(dbVersGain(piste.volume_db), t + Math.max(0.05, piste.fondu_s));
    };
    // Piste sans boucle : à la fin, la suivante de la même ambiance (s'il y en a une autre).
    const finie = () => {
      if (this.lecture !== lecture) return;
      const suivante = pisteAmbiance(ambiance, cle + 1);
      this.lecture = null;
      if (suivante && suivante !== piste) this.enchainer(ambiance, cle + 1);
    };

    if (piste.sans_coupure) {
      void this.tampon(url).then((buf) => {
        if (this.lecture !== lecture) return;
        if (!buf) {
          this.lecture = null;
          return;
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = piste.boucle;
        src.connect(gain);
        src.onended = finie;
        lecture.src = src;
        src.start();
        monter();
      });
      return;
    }

    const el = new Audio(url);
    el.loop = piste.boucle;
    el.preload = 'auto';
    try {
      ctx.createMediaElementSource(el).connect(gain);
    } catch {
      this.lecture = null;
      gain.disconnect();
      return;
    }
    lecture.el = el;
    monter();
    el.addEventListener('ended', finie);
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
      if (l.el) {
        l.el.pause();
        l.el.removeAttribute('src');
        l.el.load();
      }
      if (l.src) {
        l.src.onended = null;
        try {
          l.src.stop();
        } catch {
          /* pas encore démarrée */
        }
      }
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
    this.baisseFond!.gain.setTargetAtTime(BAISSE_SOUS_VOIX, this.ctx.currentTime, 0.1);
  }

  private relever() {
    if (!this.ctx) return;
    this.baisse!.gain.setTargetAtTime(1, this.ctx.currentTime, 0.4);
    this.baisseFond!.gain.setTargetAtTime(1, this.ctx.currentTime, 0.4);
  }
}

export const moteurSon = new MoteurSon();
