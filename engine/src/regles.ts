/**
 * Toutes les valeurs chiffrées des règles, en un seul endroit.
 *
 * Elles viennent de docs/mecaniques-boucle-de-tour.md (v0.2, équilibrée au banc :
 * `npm run banc`, garde-fous dans world/tests/equilibrage.test.ts). Ce sont des
 * valeurs de départ à équilibrer : on les modifie ici, jamais en dur dans le code.
 * Les références entre parenthèses renvoient aux sections du document.
 */
export const REGLES = {
  tour: {
    /** Tour 1 = 22 septembre 3018 T.A. (1). */
    dateDepart: { annee: 3018, mois: 9, jour: 22 },
    dureeActeI: 30,
  },

  visibilite: {
    depart: 10,
    /** Paliers déclenchés une seule fois (2.1). */
    paliers: [20, 40, 60, 80, 100] as const,
    decroissance: 3,
    /** Une action est « visible » si elle rapporte V +3 ou plus (2.1). */
    seuilActionVisible: 3,
    /** Plancher : dernier palier atteint moins 10. */
    margePlancher: 10,
    /** Palier 20 : les murmures venus de Bree perdent 10 points de « vrai ». */
    malusFiabiliteBree: 10,
    /** Palier 40 : Méfiance de base +10 pour tous les héros. */
    mefianceAlerte: 10,
    /** Palier 40 : les Rôdeurs veillent sur les routes, défense +10 pour les héros attaqués. */
    defenseAlerte: 10,
    /** Palier 80 : Doute de tous les héros -20, la Voix coûte +1 PA. */
    douteUnionOuest: -20,
  },

  doute: {
    voixReussie: { paranoia: 15, annatar: 10 },
    terreurForte: { seuil: 60, gain: 5 },
    lameMorgul: 5,
    porterAnneau: 3,
    presenceSage: -3,
    reposFondcombe: -10,
    /** Appliqué quand un allié de confiance rejoint le personnage (relation ≥ seuil). */
    allieRejoint: -5,
    seuilAllieConfiance: 60,
    seuils: { faille: 50, trahison: 75, brise: 100 },
  },

  mefiance: {
    oeilVolonteForte: 15,
    oeilVolonteFaible: 5,
    seuilVolonteForte: 60,
    voixReussie: 10,
    voixRatee: 25,
    decroissance: 5,
    /** Chaque point de Méfiance retire 0,5 point de chance à la Voix. */
    facteurVoix: 0.5,
    alerte: { seuil: 70, groupe: 5, visibilite: 2 },
  },

  terreur: {
    seuils: { inquiete: 30, sousOmbre: 60, ecrasee: 80 },
    decroissanceSansNazgul: 5,
    decroissanceSage: 10,
    essenceSousOmbre: 1,
    visibiliteSousOmbre: 1,
  },

  pa: {
    base: 4,
    max: 8,
    /** PA gagnés par étape de Forme (6.2). */
    parForme: [0, 1, 2, 3, 5] as const,
  },

  essence: {
    depart: 5,
    regionSousOmbre: 1,
    regionCorrompue: 2,
    duelGagne: 3,
    herosBriseOuBlesse: 2,
    bonneDeduction: 1,
    /** C1, les Trois des Sept déjà repris (6.3). */
    anneauxNains: 1,
  },

  anneau: {
    traceCachee: 1,
    traceAnneauMis: 5,
    detectionBase: 40,
    detectionParForce: 15,
    detectionMax: 95,
    bonusNuit: 10,
    malusJourKhamul: 25,
    pulsationPortee: 2,
    pulsationVisibilite: 3,
    /** Chance de sentir l'Anneau quand l'Œil se pose sur la région du porteur (3, phase 2). */
    oeilSentir: 50,
    /** A1 : trois détections de trace, ou une Pulsation. */
    detectionsPourPiste: 3,
    /**
     * A2 : le froid de la lame. +1 par nuit, +0,5 si un guérisseur (Aragorn et
     * l'athelas) est avec le porteur, 0 si un Sage l'accompagne. À 15, il devient
     * un spectre. Calé sur le canon : blessé à Montauvent (tour 15), soigné en
     * route par Aragorn puis Glorfindel, Frodon atteint Fondcombe à la limite.
     */
    froidSpectre: 15,
    froidParNuit: 1,
    froidGuerisseur: 0.5,
    froidSage: 0,
    /** A2 : la lame ne frappe que sur une victoire nette (jet sous cette fraction de la chance). */
    fractionLame: 0.5,
    /** Les traces s'effacent après ce nombre de tours. */
    dureeTrace: 6,
  },

  oeil: {
    visibiliteRegion: 1,
    visibilitePersonnage: 1,
    visibiliteSage: 3,
    seuilDuelRegard: 90,
    visibiliteDuelPerdu: 8,
  },

  murmures: {
    base: 5,
    max: 9,
    parRegionCorrompue: 1,
    /** Fiabilité de l'agent placé : 70 % de vrai (3, phase 4). */
    fiabiliteAgent: 70,
    bonusCorrompue: 20,
    /** Espion humain qui a peur (T région ≥ 60) : faux +15 %. */
    peurEspion: { seuil: 60, faux: 15 },
    /** Région Inquiète (T ≥ 30) : les espions humains rapportent moins. */
    malusInquiete: 0.5,
    /** Perte de signal d'un Nazgûl : rapports à 60 % de vrai. */
    vraiSignalPerdu: 60,
    /** Profils de sources : vrai / déformé / faux en % (3, phase 3). */
    sources: {
      espion: { vrai: 60, deforme: 25, faux: 15 },
      crebain: { vrai: 50, deforme: 40, faux: 10 },
      rumeur: { vrai: 35, deforme: 35, faux: 30 },
      nazgul: { vrai: 85, deforme: 15, faux: 0 },
      agent: { vrai: 70, deforme: 20, faux: 10 },
    },
  },

  voix: {
    base: 50,
    min: 5,
    max: 95,
    parForme: 10,
    secretOeil: 20,
    murmureVraiConfirme: 10,
    murmureFaux: -15,
    texteLibre: { registreDifferent: -10, parCoherence: 5, parSubtilite: 5, contradictionLore: -10, max: 15 },
    paranoia: { peurConnue: 15, separes: 10, relationReussite: -20, relationEchec: 10 },
    annatar: { orgueilDesir: 20, humble: -20 },
    fer: { volonteFaible: 30, seuilVolonteFaible: 40, seuilDuel: 60 },
    /** Visibilité : [réussite, échec] (3, phase 4). */
    visibilite: { paranoia: [1, 4], annatar: [2, 5], fer: [3, 3] } as Record<string, [number, number]>,
    visibiliteDuelPerdu: 10,
    visibiliteIntentionRevelee: 2,
    /** Portée en régions depuis un Nazgûl ou un agent ; +2 à partir de la Forme 1. */
    portee: 1,
    porteeForme1: 2,
    coutPa: 1,
  },

  duel: {
    puissanceBase: 60,
    puissanceParForme: 10,
    chanceMin: 10,
    chanceMax: 90,
    ecraser: { bonus: 10, visibilite: 3 },
    insinuerSecret: 15,
    feindre: { bonus: -10, poidsEchec: 0.5 },
    victoire: { doute: 25, mefiance: 20, essence: 3 },
    defaite: { visibilite: 10, mefiance: 30, pa: 1 },
  },

  nazgul: {
    vitesseTraque: 2,
    vitesseOmbreAilee: 3,
    /** Le Pont du Brandevin rallonge la route d'un Nazgûl d'une journée (le Bac lui est fermé). */
    detourBrandevin: 1,
    traque: { pa: 1, terreur: 10, visibilite: 2 },
    interroger: { pa: 1, terreur: 5, visibilite: 1 },
    /**
     * Embuscade (5.1 bis) : elle se tend sans chevaucher ce tour. Déclenchée, elle
     * coûte +4, plus 1 par Nazgûl compté au-delà du premier. `visibilitePose` reste
     * à 0 : l'essai à +1 par pose (v0.2) bridait trop les joueurs patients.
     */
    embuscade: { pa: 1, visibilitePose: 0, visibilite: 4, visibiliteParNazgul: 1, duree: 3 },
    cri: { pa: 0, terreur: 15, terreurRoiSorcier: 25, doute: 5, visibilite: 3 },
    fleau: { pa: 2, terreur: 30, visibilite: 8 },
    crue: { chance: 70 },
    demonte: { duree: 10, visibilite: 5 },
    signal: { distance: 3 },
    /**
     * Embuscade nocturne : chance de l'emporter contre la défense des présents.
     * Victoire contre le porteur : lame de Morgul si le Roi-Sorcier est là (A2),
     * Étreinte si le porteur est déjà marqué (A3), sinon la peur (Doute +15).
     */
    combat: {
      base: 30,
      parNazgulSupplementaire: 10,
      /** Au-delà de ce nombre d'assaillants, les Nazgûl se gênent : ils ne comptent plus. */
      nazgulComptesMax: 5,
      roiSorcier: 10,
      /**
       * Après une embuscade, réussie ou non, le groupe de la cible veille
       * (feux, tours de garde, routes détournées) : défense + bonus pendant
       * `duree` tours, cumulable jusqu'à `max`.
       */
      vigilance: { defense: 10, duree: 3, max: 20 },
      min: 5,
      max: 90,
      douteVictoire: 15,
      /** Contre un porteur marqué, l'Étreinte demande une victoire nette (jet sous la moitié de la chance). */
      fractionEtreinte: 0.5,
    },
  },

  agent: { pa: 1, douteMin: 60, visibilite: 1 },

  corruption: {
    pa: 2,
    essence: 3,
    visibilite: 5,
    toursPourPrendre: 3,
    seuilMaintien: 60,
    visibiliteParTour: 1,
  },

  forme: {
    /** Étapes 1 à 3 (la 4 demande l'Unique, Acte final). */
    cout: [0, 10, 20, 35, 50] as const,
    visibilite: [0, 8, 12, 18, 30] as const,
  },

  /**
   * Les ouvrages du Mont Destin, bâtis avec l'Essence depuis l'écran de gestion
   * (cliquer sur l'Œil). Un seul chantier par tour ; `couts[n]` est le prix du
   * niveau n + 1, et la longueur du tableau donne le niveau maximal.
   */
  ouvrages: {
    /** Forges de l'Orodruin : Essence en plus à chaque nuit, par niveau. */
    forges: { couts: [4, 9, 15] as const, essenceParNiveau: 1 },
    /** Voile de cendres : la Visibilité décroît plus vite quand l'Ombre se tait, par niveau. */
    cendres: { couts: [6, 12] as const, decroissanceParNiveau: 1 },
    /** Écuries noires : les Nazgûl démontés rentrent plus tôt, en tours par niveau. */
    ecuries: { couts: [7, 14] as const, retourParNiveau: 3 },
    /** Chambre du Regard : PA en plus à chaque aube (toujours plafonnés à pa.max). */
    chambre: { couts: [18] as const, paParNiveau: 1 },
  },

  pnj: {
    /** Aragorn évite les régions Sous l'Ombre : chance de retarder le groupe d'un tour. */
    evitementAragorn: 50,
    /** Chance que le porteur mette l'Anneau quand une embuscade le surprend. */
    anneauSousAttaque: 50,
  },
} as const;

export type Regles = typeof REGLES;
