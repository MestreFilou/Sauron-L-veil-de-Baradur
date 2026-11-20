import type { EtiquettesTexteLibre, Fait, Murmure, Registre, ResultatDuel } from '@sauron/engine';
import { hacher } from '@sauron/engine';
import banqueFr from '../banque/fr.json';
import type { ContexteVoix, Narrateur } from './narrateur';
import type { promptAnalyse } from './prompts';

type Variantes = string[];
type ParIssue = { reussite?: Variantes; echec?: Variantes };

export interface Banque {
  murmures: Record<Murmure['source'], Record<Fait['type'], Variantes>>;
  deformations: Variantes;
  compagnons: Record<string, string>;
  nombres: string[];
  voix: Record<Registre, Required<ParIssue>>;
  personnages: Record<string, Partial<Record<Registre, ParIssue>>>;
  duel: Record<'ecraser' | 'insinuer' | 'feindre', { gagnee: Variantes; perdue: Variantes }> & { victoire: Variantes; defaite: Variantes };
  journal: { vide: Variantes };
  /** Nom de lieu à glisser dans une phrase (« le Bois de Chet », « Bree »), par région. */
  lieux?: Record<string, string>;
}

export const BANQUE_FR = banqueFr as unknown as Banque;

/** Noms lisibles, pour remplir les gabarits (la banque ne connaît que des identifiants). */
export interface Noms {
  personnages: Record<string, string>;
  regions: Record<string, string>;
}

/** Remplace {variable} ; une variable absente reste vide. */
export function remplir(gabarit: string, vars: Record<string, string>): string {
  return contracter(gabarit.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? ''));
}

/** Contractions du français après remplissage : « à le Comté » → « au Comté », « de les Galgals » → « des Galgals ». */
export function contracter(s: string): string {
  return s
    .replace(/(^|[\s«(’'])à le /g, '$1au ')
    .replace(/(^|[\s«(’'])à les /g, '$1aux ')
    .replace(/(^|[\s«(’'])de le /g, '$1du ')
    .replace(/(^|[\s«(’'])de les /g, '$1des ')
    .replace(/(^|[\s«(’'])À le /g, '$1Au ')
    .replace(/(^|[\s«(’'])À les /g, '$1Aux ');
}

/** Choix de variante déterministe : le même murmure donne toujours le même texte. */
export function variante(liste: Variantes, ...cle: (string | number)[]): string {
  if (!liste.length) return '';
  return liste[hacher(...cle) % liste.length]!;
}

const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Narrateur par banque de textes préécrits. C'est le narrateur par défaut :
 * le jeu se joue entièrement sans IA. Écrire de nouvelles variantes dans
 * banque/fr.json suffit à enrichir le jeu.
 */
export class NarrateurBanque implements Narrateur {
  constructor(
    private readonly noms: Noms,
    private readonly banque: Banque = BANQUE_FR,
  ) {}

  private varsFait(m: Murmure, tourCourant: number): Record<string, string> {
    const f = m.fait;
    const vars: Record<string, string> = { lieu: this.banque.lieux?.[f.region] ?? this.noms.regions[f.region] ?? f.region };
    if ('personnage' in f) vars.qui = this.noms.personnages[f.personnage] ?? f.personnage;
    if (f.type === 'presence') vars.compagnons = this.banque.compagnons[String((f.nombre ?? 1) - 1)] ?? '';
    if (f.type === 'nazgul') vars.nombre = this.banque.nombres[f.nombre] ?? String(f.nombre);
    if (f.type === 'passage_porteur') {
      const j = Math.max(0, tourCourant - f.tour);
      vars.jours = j === 0 ? 'quelques heures' : j === 1 ? 'un jour' : `${this.banque.nombres[j] ?? j} jours`;
    }
    return vars;
  }

  async ecrireMurmures(murmures: Murmure[]): Promise<Record<string, string>> {
    return Object.fromEntries(
      murmures.map((m) => {
        const liste = this.banque.murmures[m.source]?.[m.fait.type] ?? [m.faitTexte];
        let texte = majuscule(remplir(variante(liste, m.id, 'texte'), this.varsFait(m, m.tour)));
        if (m.deformation) texte += variante(this.banque.deformations, m.id, 'deformation');
        return [m.id, texte];
      }),
    );
  }

  async ecrireJournal(date: string, evenements: string[]): Promise<string> {
    if (!evenements.length) return `${date}. ${variante(this.banque.journal.vide, date)}`;
    return `${date}. ${evenements.slice(0, 3).join(' ')}`;
  }

  /** Sans IA, l'analyse du murmure libre se contente d'indices lexicaux, sans aucun bonus de style. */
  async analyserTexteLibre(params: Parameters<typeof promptAnalyse>[0]): Promise<EtiquettesTexteLibre> {
    const t = params.texte.toLowerCase();
    const registreDetecte: Registre = /obéis|suis-les|va |rapporte|tais-toi|je t'ordonne/.test(t)
      ? 'fer'
      : /mérites|offre|à toi|pouvoir|promets|sers-moi/.test(t)
        ? 'annatar'
        : 'paranoia';
    const secret = params.secretsConnus.find((s) =>
      s.texte
        .toLowerCase()
        .split(/[\s,.’']+/)
        .filter((w) => w.length > 6)
        .some((w) => t.includes(w)),
    );
    return { registreDetecte, secretUtilise: secret?.id ?? null, coherencePersonnage: 0, subtilite: 0, contradictionLore: false };
  }

  async reactionVoix(ctx: ContexteVoix): Promise<string> {
    const issue = ctx.resultat.reussie ? 'reussite' : 'echec';
    const registre = ctx.resultat.ordre.registre;
    const propres = this.banque.personnages[ctx.resultat.ordre.cible]?.[registre]?.[issue];
    const liste = propres?.length ? propres : this.banque.voix[registre][issue];
    return remplir(variante(liste, ctx.resultat.ordre.cible, registre, issue, ctx.resultat.jet), { qui: ctx.cible.nom });
  }

  async narrerDuel(duel: ResultatDuel, nomCible: string) {
    const vars = { qui: nomCible, verite: duel.veriteApprise ?? '' };
    return {
      manches: duel.manches.map((m, i) => remplir(variante(this.banque.duel[m.approche][m.gagnee ? 'gagnee' : 'perdue'], duel.cible, i, m.jet), vars)),
      final: remplir(variante(duel.victoire ? this.banque.duel.victoire : this.banque.duel.defaite, duel.cible, duel.manches.length), vars),
    };
  }
}
