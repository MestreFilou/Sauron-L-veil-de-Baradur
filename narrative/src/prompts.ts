/**
 * Prompts du narrateur. Règle d'or (mécaniques, 0.1 et 9.3) : le code décide,
 * le LLM raconte. Chaque prompt reçoit une issue déjà tranchée et l'extrait
 * d'état strictement utile ; le texte produit n'est jamais relu par le moteur.
 *
 * Les prompts système sont FIXES (aucune date, aucun identifiant de tour) pour
 * que la mise en cache du préfixe fonctionne d'un appel à l'autre.
 */
import type { Murmure, ResultatDuel, ResultatVoix } from '@sauron/engine';

export const STYLE = `Tu écris pour « L'Œil de Barad-dûr », un jeu où le joueur incarne Sauron au Troisième Âge, dans l'Eriador de 3018.
Ton : sombre, sobre, fidèle à Tolkien. L'ombre rampante plutôt que le spectaculaire.
Noms français de la traduction Ledoux : Frodon Sacquet, Samsagace Gamegie, Grand-Pas, Bree, le Poney Fringant, Mont Venteux, Fondcombe, Fontgrise, Hobbitebourg, Creux-de-Crique, Bill Fougeron, Prosper Poiredebeurre.
Tu ne décides jamais d'une issue : elle t'est donnée, tu l'habilles. Tu n'inventes aucun fait qui contredise ceux qu'on te donne.`;

/* ------------------------------------------------------------------ */
/* Murmures (Haiku 5.5)                                               */
/* ------------------------------------------------------------------ */

export const SYSTEME_MURMURES = `${STYLE}

Tâche : écrire des MURMURES, les rapports fragmentaires qui remontent vers la Tour.
Pour chaque murmure, tu reçois : la source (espion, crébain, rumeur de taverne, rapport de Nazgûl, agent), le fait affirmé, une éventuelle déformation à appliquer, et un ton.
- Écris 1 à 3 phrases, à la manière de la source : un espion est servile et précis sur les noms, les crébains sont bons sur les déplacements et nuls sur les noms, une rumeur de taverne noie un nom exact dans des détails faux, un Nazgûl voit auras, peur et trace de l'Anneau mais rate les détails physiques.
- Rapporte le fait tel qu'il est donné, même s'il est faux : c'est au joueur de deviner. Applique la déformation si elle est indiquée.
- N'écris jamais si le murmure est vrai ou faux, ni de commentaire hors du rapport.`;

export function promptMurmures(murmures: Murmure[], journal: string[]): string {
  const lignes = murmures.map((m) =>
    JSON.stringify({
      id: m.id,
      source: m.source,
      emetteur: m.emetteur,
      fait: m.faitTexte,
      deformation: m.deformation,
      ton: m.ton,
    }),
  );
  return [
    journal.length ? `Ce qui s'est passé récemment (Journal de Barad-dûr) :\n${journal.map((j) => `- ${j}`).join('\n')}` : '',
    `Murmures à écrire, un par ligne JSON :\n${lignes.join('\n')}`,
    'Rends un texte par identifiant.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

/* ------------------------------------------------------------------ */
/* Journal de Barad-dûr (Haiku 5.5)                                    */
/* ------------------------------------------------------------------ */

export const SYSTEME_JOURNAL = `${STYLE}

Tâche : tenir le JOURNAL DE BARAD-DÛR. On te donne les événements d'un jour, déjà décidés.
Écris un résumé de trois phrases exactement, du point de vue froid de la Tour. Ce résumé sert de mémoire pour la suite : garde les noms, les lieux et les conséquences, oublie les détails de style.`;

export function promptJournal(date: string, evenements: string[]): string {
  return `Jour : ${date}\nÉvénements :\n${evenements.map((e) => `- ${e}`).join('\n')}`;
}

/* ------------------------------------------------------------------ */
/* Analyse du murmure libre (Sonnet 5.5, sortie structurée)            */
/* ------------------------------------------------------------------ */

export const SYSTEME_ANALYSE = `${STYLE}

Tâche : ANALYSER un murmure que le joueur (Sauron) a écrit lui-même pour l'esprit d'un personnage. Tu ne juges pas s'il réussit : tu renvoies seulement des étiquettes.
- registreDetecte : « paranoia » (amplifier une peur, isoler d'un allié), « annatar » (séduire, promettre), « fer » (ordonner, écraser).
- secretUtilise : l'identifiant du secret connu que le texte exploite vraiment, ou null. Choisis UNIQUEMENT dans la liste fournie.
- coherencePersonnage : 0 si le texte ne touche pas ce personnage, 1 s'il le touche, 2 s'il vise juste sa psychologie.
- subtilite : 1 si le texte avance masqué (la cible croira penser seule), 0 sinon.
- contradictionLore : true si le texte contredit l'œuvre ou ce que la cible sait déjà.`;

export function promptAnalyse(params: {
  texte: string;
  registreChoisi: string;
  cible: { nom: string; peur: string | null; traits: string[] };
  secretsConnus: { id: string; texte: string }[];
}): string {
  return [
    `Cible : ${params.cible.nom}. Traits : ${params.cible.traits.join(', ') || 'aucun'}. Peur connue : ${params.cible.peur ?? 'inconnue'}.`,
    `Registre choisi par le joueur : ${params.registreChoisi}.`,
    `Secrets connus de Sauron :\n${params.secretsConnus.map((s) => `- ${s.id} : ${s.texte}`).join('\n') || '- aucun'}`,
    `Murmure écrit par le joueur :\n« ${params.texte} »`,
  ].join('\n\n');
}

/* ------------------------------------------------------------------ */
/* Réaction à la Voix et duels (Sonnet 5.5)                            */
/* ------------------------------------------------------------------ */

export const SYSTEME_VOIX = `${STYLE}

Tâche : écrire la RÉACTION INTÉRIEURE d'un personnage à la Voix de Sauron, dont l'issue est déjà tirée.
2 à 4 phrases, au discours indirect libre, dans la tête du personnage. Si la Voix a réussi, il croit penser seul. Si elle a échoué, il sent une volonté étrangère.
Respecte la liste des faits interdits : ce que le personnage ne sait pas.`;

export function promptVoix(params: {
  resultat: ResultatVoix;
  cible: { nom: string; peur: string; traits: string[] };
  murmureJoueur: string | null;
  faitsInterdits: string[];
  journal: string[];
}): string {
  const r = params.resultat;
  return [
    `Cible : ${params.cible.nom}. Traits : ${params.cible.traits.join(', ')}. Sa peur : ${params.cible.peur}.`,
    `Registre : ${r.ordre.registre}. Issue : ${r.reussie ? 'RÉUSSITE' : 'ÉCHEC'}.`,
    params.murmureJoueur ? `Ce que Sauron a murmuré : « ${params.murmureJoueur} »` : '',
    params.faitsInterdits.length ? `Faits interdits (le personnage les ignore) :\n${params.faitsInterdits.map((f) => `- ${f}`).join('\n')}` : '',
    params.journal.length ? `Contexte récent :\n${params.journal.map((j) => `- ${j}`).join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export const SYSTEME_DUEL = `${STYLE}

Tâche : narrer un DUEL MENTAL entre Sauron et une grande volonté. Chaque manche est déjà tranchée ; tu reçois l'approche de Sauron (écraser, insinuer, feindre) et le vainqueur.
Pour chaque manche, deux phrases. Puis une phrase finale qui scelle l'issue. Si la cible gagne, elle arrache à Sauron la vérité indiquée.`;

export function promptDuel(duel: ResultatDuel, nomCible: string): string {
  return [
    `Adversaire : ${nomCible} (Volonté ${duel.volonte}) contre la Puissance de Sauron (${duel.puissance}).`,
    `Manches :\n${duel.manches.map((m, i) => `${i + 1}. approche « ${m.approche} », ${m.gagnee ? 'Sauron l’emporte' : `${nomCible} l’emporte`}`).join('\n')}`,
    `Issue : ${duel.victoire ? 'Sauron gagne le duel' : `${nomCible} gagne le duel`}.`,
    duel.veriteApprise ? `Vérité arrachée à Sauron : « ${duel.veriteApprise} »` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}
