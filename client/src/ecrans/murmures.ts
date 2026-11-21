/**
 * Ce qu'on lit sur les écrans de chargement : un murmure (écrit pour le jeu,
 * dans la voix de la Tour et de ses espions) et un conseil de jeu.
 */
export interface Murmure {
  texte: string;
  /** Qui parle, ou d'où vient le murmure. */
  source: string;
}

export const MURMURES: Murmure[] = [
  { texte: 'Un nom, un seul : Sacquet. Le reste n’est que patience.', source: 'La Tour' },
  { texte: 'L’Œil ne dort pas. Il attend seulement que tu fermes les tiens.', source: 'Murmure entendu à Bree' },
  { texte: 'Ce qui fut forgé dans le feu se souvient du feu.', source: 'Inscription d’une forge de l’Orodruin' },
  { texte: 'À Bree, on parle trop. C’est pour cela qu’on y écoute.', source: 'Rapport d’un espion de la Tour' },
  { texte: 'Chaque lumière qu’on allume dans l’Ouest est une lumière que l’on voit d’ici.', source: 'Barad-dûr' },
  { texte: 'Il n’y a pas de cachette sous le ciel. Seulement des endroits où l’on n’a pas encore regardé.', source: 'Le Regard' },
  { texte: 'La peur marche devant les Neuf, comme une ombre qui précède son maître.', source: 'Chanson de route, Eriador' },
  { texte: 'Ils croient porter l’Anneau. C’est l’Anneau qui les porte vers moi.', source: 'La Tour' },
  { texte: 'Annatar a souri aux forgerons d’Eregion. Ils l’ont remercié.', source: 'Souvenir du Deuxième Âge' },
  { texte: 'Une rumeur fausse dit toujours une chose vraie : celui qui l’a lancée a peur.', source: 'Maxime des archivistes de la Tour' },
  { texte: 'Les Rôdeurs veillent la nuit. Mais la nuit est à nous.', source: 'Murmure d’un Nazgûl' },
  { texte: 'Pas encore. Bientôt, le monde entier tournera les yeux vers l’Est.', source: 'La Tour' },
  { texte: 'Neuf cavaliers ont passé l’Isen. L’herbe n’a pas gardé leur trace, mais les chiens se taisent encore.', source: 'Rumeur des gués' },
  { texte: 'Qui a vu l’Œil une fois le voit ensuite dans toutes les braises.', source: 'Dit des gardiens du Bourg' },
  { texte: 'Le Gué n’est qu’une rivière. On ne s’y abrite pas longtemps.', source: 'Ordre transmis au Roi-Sorcier' },
  { texte: 'Les esprits qui doutent sont des portes entrouvertes.', source: 'La Voix' },
];

export const CONSEILS: string[] = [
  'La touche S bascule dans le Monde de l’Ombre, où la piste de l’Anneau luit.',
  'Une rumeur pâlie est peu fiable : classe-la comme incertaine plutôt que de te tromper.',
  'Trop de Visibilité éveille l’Ouest : la Tour gagne à rester dans l’ombre.',
  'Ce que le Regard touche devient net. Le reste du monde demeure flou et enfumé.',
  'Échap ouvre le menu : sauvegarder, charger, régler le son.',
  'Classe les Murmures : vrais, faux ou incertains. Une bonne déduction rapporte de l’Essence.',
  'F11 passe en plein écran, ou en sort.',
];

/** Un tirage différent à chaque appel, sans répéter le précédent. */
export function tirer<T>(liste: T[], precedent: T | null, alea = Math.random): T {
  if (liste.length <= 1) return liste[0]!;
  let x = liste[Math.floor(alea() * liste.length)]!;
  if (x === precedent) x = liste[(liste.indexOf(x) + 1) % liste.length]!;
  return x;
}
