/**
 * `npm run banc` : fait jouer tous les bots et affiche le tableau.
 * PARTIES=100 GRAINE=1001 npm run banc pour changer d'échantillon.
 */
import { it } from 'vitest';
import { evaluer, tableau } from './banc';
import { BOTS } from './bots';

it('banc d’équilibrage', () => {
  const parties = Number(process.env.PARTIES ?? 40);
  const graine = Number(process.env.GRAINE ?? 1);
  console.log(`\n${parties} parties par bot, graines ${graine} à ${graine + parties - 1}\n\n${tableau(BOTS.map((b) => evaluer(b, parties, graine)))}\n`);
}, 600_000);
