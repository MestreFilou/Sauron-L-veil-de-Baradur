import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { EtiquettesTexteLibre, Murmure, ResultatDuel, ResultatVoix } from '@sauron/engine';
import { z } from 'zod';
import {
  promptAnalyse,
  promptDuel,
  promptJournal,
  promptMurmures,
  promptVoix,
  SYSTEME_ANALYSE,
  SYSTEME_DUEL,
  SYSTEME_JOURNAL,
  SYSTEME_MURMURES,
  SYSTEME_VOIX,
} from './prompts';

/** Répartition des modèles (mécaniques, 9.1). */
export const MODELES = {
  murmures: 'claude-haiku-5-5',
  journal: 'claude-haiku-5-5',
  analyse: 'claude-sonnet-5-5',
  voix: 'claude-sonnet-5-5',
  duel: 'claude-sonnet-5-5',
  noirParler: 'claude-sonnet-5-5',
} as const;

/* ------------------------------------------------------------------ */
/* Schémas des sorties structurées                                     */
/* ------------------------------------------------------------------ */

export const SchemaMurmures = z.object({
  murmures: z.array(z.object({ id: z.string(), texte: z.string() })),
});

export const SchemaEtiquettes = z.object({
  registreDetecte: z.enum(['paranoia', 'annatar', 'fer']),
  secretUtilise: z.string().nullable(),
  coherencePersonnage: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  subtilite: z.union([z.literal(0), z.literal(1)]),
  contradictionLore: z.boolean(),
});

export const SchemaJournal = z.object({ resume: z.string() });
export const SchemaReaction = z.object({ pensee: z.string() });
export const SchemaDuel = z.object({ manches: z.array(z.string()), final: z.string() });

/* ------------------------------------------------------------------ */
/* Interface commune                                                   */
/* ------------------------------------------------------------------ */

export interface ContexteVoix {
  resultat: ResultatVoix;
  cible: { nom: string; peur: string; traits: string[] };
  murmureJoueur: string | null;
  faitsInterdits: string[];
  journal: string[];
}

export interface Narrateur {
  /** Texte de chaque murmure, par identifiant. */
  ecrireMurmures(murmures: Murmure[], journal: string[]): Promise<Record<string, string>>;
  /** Résumé de trois phrases du jour écoulé. */
  ecrireJournal(date: string, evenements: string[]): Promise<string>;
  /** Étiquettes du murmure libre, que le moteur convertit en bonus plafonnés. */
  analyserTexteLibre(params: Parameters<typeof promptAnalyse>[0]): Promise<EtiquettesTexteLibre>;
  reactionVoix(ctx: ContexteVoix): Promise<string>;
  narrerDuel(duel: ResultatDuel, nomCible: string): Promise<{ manches: string[]; final: string }>;
}

/* ------------------------------------------------------------------ */
/* Narrateur Claude                                                    */
/* ------------------------------------------------------------------ */

/** Prompt système fixe, mis en cache (le lore et les consignes ne changent pas d'un appel à l'autre). */
const systeme = (texte: string) => [{ type: 'text' as const, text: texte, cache_control: { type: 'ephemeral' as const } }];

export class NarrateurClaude implements Narrateur {
  constructor(private readonly client: Anthropic = new Anthropic()) {}

  /** Haiku : volume élevé, texte court. Pas de repli côté serveur pour ce modèle. */
  private async haiku<T extends z.ZodType>(system: string, contenu: string, schema: T, maxTokens: number): Promise<z.infer<T>> {
    const r = await this.client.messages.parse({
      model: MODELES.murmures,
      max_tokens: maxTokens,
      system: systeme(system),
      output_config: { effort: 'low', format: zodOutputFormat(schema) },
      messages: [{ role: 'user', content: contenu }],
    });
    if (r.stop_reason === 'refusal' || !r.parsed_output) throw new Error(`Narrateur : réponse inutilisable (${r.stop_reason}).`);
    return r.parsed_output as z.infer<T>;
  }

  /** Sonnet : jugement fin et psychologie. Repli automatique côté serveur en cas de refus. */
  private async sonnet<T extends z.ZodType>(system: string, contenu: string, schema: T, maxTokens: number): Promise<z.infer<T>> {
    const r = await this.client.beta.messages.parse({
      model: MODELES.voix,
      max_tokens: maxTokens,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: systeme(system),
      output_config: { effort: 'medium', format: betaZodOutputFormat(schema) },
      messages: [{ role: 'user', content: contenu }],
    });
    if (r.stop_reason === 'refusal' || !r.parsed_output) throw new Error(`Narrateur : réponse inutilisable (${r.stop_reason}).`);
    return r.parsed_output as z.infer<T>;
  }

  async ecrireMurmures(murmures: Murmure[], journal: string[]): Promise<Record<string, string>> {
    if (!murmures.length) return {};
    const r = await this.haiku(SYSTEME_MURMURES, promptMurmures(murmures, journal), SchemaMurmures, 4000);
    const attendus = new Set(murmures.map((m) => m.id));
    return Object.fromEntries(r.murmures.filter((m) => attendus.has(m.id)).map((m) => [m.id, m.texte]));
  }

  async ecrireJournal(date: string, evenements: string[]): Promise<string> {
    return (await this.haiku(SYSTEME_JOURNAL, promptJournal(date, evenements), SchemaJournal, 1500)).resume;
  }

  async analyserTexteLibre(params: Parameters<typeof promptAnalyse>[0]): Promise<EtiquettesTexteLibre> {
    const e = await this.sonnet(SYSTEME_ANALYSE, promptAnalyse(params), SchemaEtiquettes, 2000);
    // Garde-fou : un secret hors de la liste connue est ignoré (4.3).
    const connu = params.secretsConnus.some((s) => s.id === e.secretUtilise);
    return { ...e, secretUtilise: connu ? e.secretUtilise : null };
  }

  async reactionVoix(ctx: ContexteVoix): Promise<string> {
    return (await this.sonnet(SYSTEME_VOIX, promptVoix(ctx), SchemaReaction, 2000)).pensee;
  }

  async narrerDuel(duel: ResultatDuel, nomCible: string) {
    return this.sonnet(SYSTEME_DUEL, promptDuel(duel, nomCible), SchemaDuel, 3000);
  }
}

/**
 * Claude en complément de la banque : chaque appel qui échoue (pas de clé, pas
 * de réseau, refus) retombe sur le texte préécrit. Sans principal, c'est la banque seule.
 */
export function narrateurAvecRepli(principal: Narrateur | null, secours: Narrateur): Narrateur {
  if (!principal) return secours;
  const essayer =
    <A extends unknown[], R>(f: (...a: A) => Promise<R>, g: (...a: A) => Promise<R>) =>
    async (...a: A) => {
      try {
        return await f(...a);
      } catch (e) {
        console.warn('[narrateur] repli sur la banque :', e);
        return g(...a);
      }
    };
  return {
    ecrireMurmures: essayer(principal.ecrireMurmures.bind(principal), secours.ecrireMurmures.bind(secours)),
    ecrireJournal: essayer(principal.ecrireJournal.bind(principal), secours.ecrireJournal.bind(secours)),
    analyserTexteLibre: essayer(principal.analyserTexteLibre.bind(principal), secours.analyserTexteLibre.bind(secours)),
    reactionVoix: essayer(principal.reactionVoix.bind(principal), secours.reactionVoix.bind(secours)),
    narrerDuel: essayer(principal.narrerDuel.bind(principal), secours.narrerDuel.bind(secours)),
  };
}
