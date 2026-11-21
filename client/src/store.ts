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
  /** Les autres Nazgûl sélectionnés avec Maj+clic : ils marchent avec le premier. */
  groupe: string[];
  /** Destinations lointaines : l'ordre de marche est redonné chaque soir jusqu'à l'arrivée. */
  caps: Record<string, string>;
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
  /** Maj+clic : ajoute un Nazgûl à la sélection, ou l'en retire. */
  basculerGroupe(id: string): void;
  /** Ordre de marche pour un ou plusieurs Nazgûl ; remplace l'ordre de marche déjà donné. */
  ordonnerMarche(ids: string[], destination: string): boolean;
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

const CLE_CAPS = `${CLE}/caps`;

function lireCaps(etat: EtatJeu): Record<string, string> {
  try {
    const c = JSON.parse(localStorage.getItem(CLE_CAPS) ?? '{}') as Record<string, string>;
    return Object.fromEntries(Object.entries(c).filter(([id, r]) => etat.nazgul[id] && monde.regions.has(r)));
  } catch {
    return {};
  }
}

function ecrireCaps(caps: Record<string, string>) {
  try {
    localStorage.setItem(CLE_CAPS, JSON.stringify(caps));
  } catch {
    /* stockage indisponible : les caps vivent le temps de la session */
  }
}

/** Applique une action sans bruit : le nouvel état, ou le message de la règle enfreinte. */
function essayer(etat: EtatJeu, action: Action): EtatJeu | string {
  try {
    return appliquer(monde, etat, action);
  } catch (e) {
    if (e instanceof ErreurRegle) return e.message;
    throw e;
  }
}

const indexMarche = (etat: EtatJeu, id: string) => etat.ordres.findIndex((o) => o.type === 'nazgul_deplacer' && o.nazgul === id);

/** Les caps qui tiennent encore : Nazgûl disponible, pas encore arrivé. */
function capsVivants(etat: EtatJeu, caps: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(caps).filter(([id, r]) => {
      const n = etat.nazgul[id];
      return n && n.indisponibleJusquA < etat.tour && n.region !== r;
    }),
  );
}

/** À l'heure des ordres, chaque Nazgûl qui a un cap reprend la route d'office. */
function relancerCaps(etat: EtatJeu, caps: Record<string, string>): EtatJeu {
  let e = etat;
  for (const [id, r] of Object.entries(caps)) {
    if (indexMarche(e, id) >= 0) continue;
    const suite = essayer(e, { type: 'ordonner', ordre: { type: 'nazgul_deplacer', nazgul: id, destination: r } });
    if (typeof suite !== 'string') e = suite;
  }
  return e;
}

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
    groupe: [],
    caps: lireCaps(initial),
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
      // Les marches au long cours : relancées à l'heure des ordres, oubliées à l'arrivée ou si l'ordre est annulé.
      let caps = capsVivants(etat, get().caps);
      if (etat.phase === 'ordres' && avant.phase !== 'ordres') etat = relancerCaps(etat, caps);
      if (action.type === 'annuler_ordre') caps = Object.fromEntries(Object.entries(caps).filter(([id]) => indexMarche(etat, id) >= 0));
      if (caps !== get().caps) ecrireCaps(caps);
      set({ etat, vue: vueJoueur(monde, etat), caps });
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
        set({ nazgulChoisi: null, groupe: [], regionChoisie: null });
      }
      return true;
    },

    ordonnerMarche(ids, destination) {
      let etat = get().etat;
      const caps = { ...get().caps };
      const partis: string[] = [];
      for (const id of ids) {
        const n = etat.nazgul[id];
        if (!n) continue;
        const ancien = indexMarche(etat, id);
        let sans = etat;
        if (ancien >= 0) {
          const s = essayer(etat, { type: 'annuler_ordre', index: ancien });
          if (typeof s !== 'string') sans = s;
        }
        if (n.region === destination) {
          // Rester sur place : la marche en cours est annulée.
          etat = sans;
          delete caps[id];
          continue;
        }
        const suite = essayer(sans, { type: 'ordonner', ordre: { type: 'nazgul_deplacer', nazgul: id, destination } });
        if (typeof suite === 'string') {
          get().annoncer(suite);
          continue;
        }
        etat = suite;
        caps[id] = destination;
        partis.push(id);
      }
      if (etat === get().etat) return false;
      ecrireCaps(caps);
      set({ etat, vue: vueJoueur(monde, etat), caps });
      enregistrer(etat);
      const lieu = (monde.regions.get(destination)?.nom ?? destination).split(' · ')[0];
      if (partis.length === 1) get().annoncer(`${monde.nazgul.get(partis[0]!)?.nom ?? partis[0]} chevauche vers ${lieu}.`);
      else if (partis.length > 1) get().annoncer(`${partis.length} des Neuf chevauchent vers ${lieu}.`);
      return partis.length > 0;
    },

    nouvellePartie(graine) {
      const etat = creerPartie(monde, graine ?? Math.floor(Math.random() * 2 ** 31));
      set({ etat, vue: vueJoueur(monde, etat), textes: {}, reactions: {}, duel: null, nazgulChoisi: null, groupe: [], caps: {}, regionChoisie: null });
      ecrireCaps({});
      enregistrer(etat);
      void habillerMurmures(etat);
    },

    setMode: (mode) => set({ mode }),
    choisirNazgul: (nazgulChoisi) => set({ nazgulChoisi, groupe: [] }),
    basculerGroupe: (id) =>
      set((s) => {
        if (!s.nazgulChoisi) return { nazgulChoisi: id, groupe: [] };
        if (s.nazgulChoisi === id) return { nazgulChoisi: s.groupe[0] ?? null, groupe: s.groupe.slice(1) };
        return { groupe: s.groupe.includes(id) ? s.groupe.filter((x) => x !== id) : [...s.groupe, id] };
      }),
    choisirRegion: (regionChoisie) => set({ regionChoisie }),
    survolerMurmure: (murmureSurvole) => set({ murmureSurvole }),
    fermerIntro: () => set({ introVue: true }),
    fermerDuel: () => set({ duel: null }),
    annoncer: (texte) => set((s) => ({ toast: { texte, n: (s.toast?.n ?? 0) + 1 } })),
    ouvrirCour: (onglet) => set((s) => ({ cour: onglet ?? s.cour ?? 'neuf' })),
    fermerCour: () => set({ cour: null }),
  };
});
