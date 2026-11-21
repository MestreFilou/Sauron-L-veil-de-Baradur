/**
 * L'état de l'interface. Le moteur reste la seule source de vérité : chaque
 * geste du joueur devient une Action passée à `appliquer`, et les panneaux ne
 * lisent que la `vueJoueur` (ce que Sauron sait). L'état complet ne sert
 * qu'à rejouer le moteur et à sauvegarder.
 */
import type { Action, EtatJeu, Evenement, Monde, ResultatDuel, ResultatVoix, VueJoueur } from '@sauron/engine';
import { appliquer, creerPartie, ErreurRegle, indexerMonde, personnage, vueJoueur } from '@sauron/engine';
import { NarrateurBanque } from '@sauron/narrative/banque';
import { eriador } from '@sauron/world';
import { create } from 'zustand';
import { bus } from './bus';
import { sauvegardeAuto } from './partie/sauvegardes';

export const monde: Monde = indexerMonde(eriador);

/**
 * Le narrateur par défaut est la banque de textes préécrits : le jeu se joue
 * entièrement sans IA. Claude (NarrateurClaude, via narrateurAvecRepli) peut
 * s'y greffer côté serveur, jamais avec une clé dans le navigateur.
 */
const narrateur = new NarrateurBanque({
  personnages: Object.fromEntries(eriador.personnages.map((p) => [p.id, p.nom])),
  regions: Object.fromEntries(eriador.regions.map((r) => [r.id, r.nom])),
});

export type Mode = 'oeil' | 'ombre';

/** Où en est le joueur : l'écran titre, l'écran de chargement, ou la partie. */
export type Ecran = 'titre' | 'chargement' | 'jeu';

export const cleEvenement = (e: Evenement) => `${e.tour}|${e.texte}`;

interface Store {
  etat: EtatJeu;
  vue: VueJoueur;
  textes: Record<string, string>;
  reactions: Record<string, string>;
  duel: { cible: string; manches: string[]; final: string; victoire: boolean } | null;
  mode: Mode;
  nazgulChoisi: string | null;
  regionChoisie: string | null;
  murmureSurvole: string | null;
  introVue: boolean;
  toast: { texte: string; n: number } | null;
  ecran: Ecran;
  /** Le menu de pause est ouvert (Échap). */
  pause: boolean;
  /** La scène PixiJS est montée et le parchemin cuit. */
  cartePrete: boolean;

  agir(action: Action): boolean;
  nouvellePartie(graine?: number): void;
  /** Lance une partie (nouvelle ou chargée) en passant par l'écran de chargement. */
  lancer(etat: EtatJeu): void;
  entrer(): void;
  retourAuTitre(): void;
  setPause(p: boolean): void;
  setMode(m: Mode): void;
  choisirNazgul(id: string | null): void;
  choisirRegion(id: string | null): void;
  survolerMurmure(id: string | null): void;
  fermerIntro(): void;
  fermerDuel(): void;
  annoncer(texte: string): void;
}

const graineAuHasard = () => Math.floor(Math.random() * 2 ** 31);

/** Sauvegarde automatique après chaque geste (la date du jeu sert au menu). */
const enregistrer = (etat: EtatJeu) => void sauvegardeAuto(etat, vueJoueur(monde, etat).date);

/** Une partie fraîche, en attendant que l'écran titre en lance une. Rien n'est sauvegardé tant qu'on n'y joue pas. */
const initial = creerPartie(monde, graineAuHasard());

export const useJeu = create<Store>((set, get) => {
  /** Écrit les murmures qui n'ont pas encore de texte (banque, synchrone en pratique). */
  const habillerMurmures = async (etat: EtatJeu) => {
    const manquants = etat.murmures.filter((m) => !get().textes[m.id]);
    if (!manquants.length) return;
    const t = await narrateur.ecrireMurmures(manquants);
    set((s) => ({ textes: { ...s.textes, ...t } }));
  };

  /** Pensées des personnages touchés par la Voix, habillées par le narrateur (clé : tour et texte de l'événement). */
  const penser = async (evenements: Evenement[]) => {
    const nouvelles: Record<string, string> = {};
    for (const e of evenements) {
      const r = e.donnees?.resultat as ResultatVoix | undefined;
      if (e.type !== 'voix' || !r) continue;
      const def = personnage(monde, r.ordre.cible);
      nouvelles[cleEvenement(e)] = await narrateur.reactionVoix({
        resultat: r,
        cible: { nom: def.nom, peur: def.peur, traits: def.traits },
        murmureJoueur: r.ordre.texteLibre ?? null,
        faitsInterdits: [],
        journal: [],
      });
    }
    set((s) => ({ reactions: { ...s.reactions, ...nouvelles } }));
  };

  const raconterDuel = async (duel: ResultatDuel) => {
    const nom = personnage(monde, duel.cible).nom;
    const n = await narrateur.narrerDuel(duel, nom);
    set({ duel: { cible: nom, ...n, victoire: duel.victoire } });
  };

  return {
    etat: initial,
    vue: vueJoueur(monde, initial),
    textes: {},
    reactions: {},
    duel: null,
    mode: 'oeil',
    nazgulChoisi: null,
    regionChoisie: null,
    murmureSurvole: null,
    introVue: false,
    toast: null,
    ecran: 'titre',
    pause: false,
    cartePrete: false,

    agir(action) {
      const avant = get().etat;
      let etat: EtatJeu;
      try {
        etat = appliquer(monde, avant, action);
      } catch (e) {
        if (e instanceof ErreurRegle) {
          get().annoncer(e.message);
          return false;
        }
        throw e;
      }
      const vue = vueJoueur(monde, etat);
      set({ etat, vue });
      void sauvegardeAuto(etat, vue.date);
      void habillerMurmures(etat);

      if (action.type === 'poser_oeil') {
        bus.emit('flare', 1);
        const o = etat.oeil;
        if (o?.repousse) get().annoncer('Une lumière blanche brûle l’Œil. Le Regard est repoussé.');
        else if (o?.anneauSenti) get().annoncer('Là ! Quelque chose répond au Regard. L’Anneau est proche.');
        if (o?.duel) void raconterDuel(o.duel);
      }
      if (action.type === 'rituel_forme') {
        bus.emit('flare', 1);
        get().annoncer('La Tour se replie sur elle-même. Une Forme plus dense prend corps.');
      }
      if (action.type === 'fin_des_ordres') {
        void penser(etat.journal.at(-1)?.evenements ?? []);
        set({ nazgulChoisi: null, regionChoisie: null });
      }
      return true;
    },

    nouvellePartie(graine) {
      get().lancer(creerPartie(monde, graine ?? graineAuHasard()));
    },

    lancer(etat) {
      set({
        etat,
        vue: vueJoueur(monde, etat),
        textes: {},
        reactions: {},
        duel: null,
        mode: 'oeil',
        nazgulChoisi: null,
        regionChoisie: null,
        murmureSurvole: null,
        introVue: false,
        pause: false,
        ecran: 'chargement',
      });
      enregistrer(etat);
      void habillerMurmures(etat);
    },

    entrer: () => set({ ecran: 'jeu' }),
    retourAuTitre: () => set({ ecran: 'titre', pause: false, duel: null, mode: 'oeil', introVue: false }),
    setPause: (pause) => set({ pause }),

    setMode: (mode) => set({ mode }),
    choisirNazgul: (nazgulChoisi) => set({ nazgulChoisi }),
    choisirRegion: (regionChoisie) => set({ regionChoisie }),
    survolerMurmure: (murmureSurvole) => set({ murmureSurvole }),
    fermerIntro: () => set({ introVue: true }),
    fermerDuel: () => set({ duel: null }),
    annoncer: (texte) => set((s) => ({ toast: { texte, n: (s.toast?.n ?? 0) + 1 } })),
  };
});
