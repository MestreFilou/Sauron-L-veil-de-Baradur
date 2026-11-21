/**
 * L'état de l'interface. Le moteur reste la seule source de vérité : chaque
 * geste du joueur devient une Action passée à `appliquer`, et les panneaux ne
 * lisent que la `vueJoueur` (ce que Sauron sait). L'état complet ne sert
 * qu'à rejouer le moteur et à sauvegarder.
 */
import type { Action, EtatJeu, Evenement, Monde, ResultatDuel, ResultatVoix, VueJoueur } from '@sauron/engine';
import { appliquer, charger, creerPartie, ErreurRegle, indexerMonde, personnage, sauvegarder, vueJoueur } from '@sauron/engine';
import { NarrateurBanque } from '@sauron/narrative/banque';
import { eriador } from '@sauron/world';
import { create } from 'zustand';
import { bus } from './bus';

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

const CLE = 'oeil-de-barad-dur/partie';

export type Mode = 'oeil' | 'ombre';

/** Les onglets de la Cour de Barad-dûr (menus de gestion). */
export type OngletCour = 'neuf' | 'cachots' | 'decisions';

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
  /** Onglet ouvert de la Cour, ou null si elle est fermée. */
  cour: OngletCour | null;

  agir(action: Action): boolean;
  nouvellePartie(graine?: number): void;
  setMode(m: Mode): void;
  choisirNazgul(id: string | null): void;
  choisirRegion(id: string | null): void;
  survolerMurmure(id: string | null): void;
  fermerIntro(): void;
  fermerDuel(): void;
  annoncer(texte: string): void;
  ouvrirCour(onglet?: OngletCour): void;
  fermerCour(): void;
}

function demarrer(): EtatJeu {
  try {
    const s = localStorage.getItem(CLE);
    if (s) return charger(s);
  } catch {
    /* sauvegarde illisible ou stockage bloqué : nouvelle partie */
  }
  return creerPartie(monde, Math.floor(Math.random() * 2 ** 31));
}

function enregistrer(etat: EtatJeu) {
  try {
    localStorage.setItem(CLE, sauvegarder(etat));
  } catch {
    /* stockage indisponible : la partie continue sans sauvegarde */
  }
}

const initial = demarrer();

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

  void habillerMurmures(initial);

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
    cour: null,

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
      set({ etat, vue: vueJoueur(monde, etat) });
      enregistrer(etat);
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
      const etat = creerPartie(monde, graine ?? Math.floor(Math.random() * 2 ** 31));
      set({ etat, vue: vueJoueur(monde, etat), textes: {}, reactions: {}, duel: null, nazgulChoisi: null, regionChoisie: null });
      enregistrer(etat);
      void habillerMurmures(etat);
    },

    setMode: (mode) => set({ mode }),
    choisirNazgul: (nazgulChoisi) => set({ nazgulChoisi }),
    choisirRegion: (regionChoisie) => set({ regionChoisie }),
    survolerMurmure: (murmureSurvole) => set({ murmureSurvole }),
    fermerIntro: () => set({ introVue: true }),
    fermerDuel: () => set({ duel: null }),
    annoncer: (texte) => set((s) => ({ toast: { texte, n: (s.toast?.n ?? 0) + 1 } })),
    ouvrirCour: (onglet) => set((s) => ({ cour: onglet ?? s.cour ?? 'neuf' })),
    fermerCour: () => set({ cour: null }),
  };
});
