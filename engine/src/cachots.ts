import { voisinage } from './carte';
import { ajouterEssence, ajouterVisibilite, changerDoute, changerMefiance, changerTerreur, connaitrePosition, estHeros, evenement, presents } from './etat';
import type { Monde } from './monde';
import { nazgulDef, personnage, region } from './monde';
import { borner } from './outils';
import { REGLES } from './regles';
import type { Captif, EtatJeu, GesteCachot, IdNazgul, IdPersonnage } from './types';
import { ErreurRegle } from './types';

/**
 * Les cachots de Barad-dûr. Un Nazgûl enlève un homme du commun ; la Tour
 * l'interroge, le tourmente jusqu'à ce qu'il plie, le relâche (en espion s'il
 * a plié, en témoin terrifié sinon) ou l'exécute pour l'exemple.
 *
 * Le prisonnier sort de la carte (`sortiDeJeu`) tant qu'il est aux cachots :
 * il ne marche plus, ne rapporte plus de murmures et ne subit plus la Voix.
 */

export const captifs = (etat: EtatJeu): Captif[] => etat.captifs ?? [];

export const captif = (etat: EtatJeu, id: IdPersonnage): Captif | undefined => captifs(etat).find((c) => c.personnage === id);

/** Raison pour laquelle ce personnage ne peut pas être capturé ici, ou null. */
export function empechementCapture(monde: Monde, etat: EtatJeu, nazgul: IdNazgul, pnj: IdPersonnage): string | null {
  const def = personnage(monde, pnj);
  const p = etat.personnages[pnj];
  if (def.role !== 'pnj') return `${def.nom} est trop grand pour les cachots : on ne capture que les gens du commun.`;
  if (!p || p.sortiDeJeu || def.horsCarte) return `${def.nom} n’est plus en jeu.`;
  if (captif(etat, pnj)) return `${def.nom} est déjà aux cachots.`;
  if (p.region !== etat.nazgul[nazgul]?.region) return `${def.nom} n’est pas là où se tient ${nazgulDef(monde, nazgul).nom}.`;
  return null;
}

/** Crépuscule : le Nazgûl enlève le PNJ s'il est encore là. */
export function capturer(monde: Monde, etat: EtatJeu, nazgul: IdNazgul, pnj: IdPersonnage): void {
  const nom = nazgulDef(monde, nazgul).nom;
  const def = personnage(monde, pnj);
  const raison = empechementCapture(monde, etat, nazgul, pnj);
  if (raison) {
    evenement(etat, 'cachot', `${nom} cherche ${def.nom} pour l’emmener, en vain.`);
    return;
  }
  const p = etat.personnages[pnj]!;
  const c = REGLES.cachots.capture;
  const lieu = p.region;
  p.sortiDeJeu = true;
  p.agent = false;
  // Sauron sait où il est : aux cachots, plus sur la carte.
  connaitrePosition(etat, pnj);
  delete etat.connaissance.positions[pnj];
  etat.captifs = [...captifs(etat), { personnage: pnj, depuis: etat.tour, origine: lieu, par: nazgul, interrogatoires: 0, plie: p.doute >= REGLES.cachots.seuilPlier }];
  changerTerreur(monde, etat, lieu, c.terreur);
  ajouterVisibilite(etat, c.visibilite, `${nom} enlève ${def.nom}`);
  evenement(etat, 'cachot', `${nom} enlève ${def.nom} à ${region(monde, lieu).nom}. On l’emmène vers les cachots de la Tour.`, {
    donnees: { personnage: pnj, nazgul, region: lieu },
  });
}

/** Le Doute d'un prisonnier (hors carte, `changerDoute` l'ignorerait). */
function rongerCaptif(etat: EtatJeu, id: IdPersonnage, delta: number): void {
  const p = etat.personnages[id]!;
  p.doute = borner(p.doute + delta, 0, 100);
}

/** Coût d'un geste (pour la validation et l'affichage). */
export function coutGeste(geste: GesteCachot): { pa: number; essence: number } {
  const r = REGLES.cachots[geste];
  return { pa: r.pa, essence: r.essence };
}

export function validerGeste(monde: Monde, etat: EtatJeu, geste: GesteCachot, pnj: IdPersonnage): void {
  const def = personnage(monde, pnj);
  const c = captif(etat, pnj);
  if (!c) throw new ErreurRegle(`${def.nom} n’est pas aux cachots.`);
  if (c.depuis === etat.tour) throw new ErreurRegle(`${def.nom} est encore sur la route de la Tour.`);
  if (etat.ordres.some((o) => o.type === 'cachot' && o.pnj === pnj)) throw new ErreurRegle(`On ne s’occupe de ${def.nom} qu’une fois par nuit.`);
}

/** Crépuscule : un geste sur un prisonnier. */
export function gesteCachot(monde: Monde, etat: EtatJeu, geste: GesteCachot, pnj: IdPersonnage): void {
  const c = captif(etat, pnj);
  if (!c) return;
  const def = personnage(monde, pnj);
  const p = etat.personnages[pnj]!;
  const R = REGLES.cachots;
  const lieu = region(monde, c.origine).nom;
  const retirer = () => {
    etat.captifs = captifs(etat).filter((x) => x.personnage !== pnj);
  };

  switch (geste) {
    case 'interroger': {
      c.interrogatoires++;
      rongerCaptif(etat, pnj, R.interroger.doute);
      const k = etat.connaissance;
      if (!k.peurs.includes(pnj)) {
        k.peurs.push(pnj);
        evenement(etat, 'cachot', `Dans les cachots, ${def.nom} avoue ce qu’il craint : ${def.peur}.`, { donnees: { personnage: pnj } });
      } else if (!k.destinations.includes(pnj)) {
        k.destinations.push(pnj);
        evenement(etat, 'cachot', `${def.nom} livre ce qu’il voulait faire : ${def.destination}.`, { donnees: { personnage: pnj } });
      } else {
        const s = def.secrets.find((x) => !k.secrets.some((y) => y.id === x.id));
        if (s) {
          k.secrets.push({ id: s.id, personnage: pnj, tour: etat.tour });
          evenement(etat, 'cachot', `${def.nom} crache un secret : ${s.texte}`, { donnees: { personnage: pnj, secret: s.id } });
        } else {
          evenement(etat, 'cachot', `${def.nom} n’a plus rien à livrer. Il pleure et répète les mêmes mots.`, { donnees: { personnage: pnj } });
        }
      }
      break;
    }
    case 'tourmenter': {
      etat.jauges.essence -= R.tourmenter.essence;
      rongerCaptif(etat, pnj, R.tourmenter.doute);
      ajouterVisibilite(etat, R.tourmenter.visibilite, `tourments de ${def.nom}`);
      if (!c.plie && p.doute >= R.seuilPlier) {
        c.plie = true;
        evenement(etat, 'cachot', `${def.nom} plie. Relâché, il servira la Tour.`, { donnees: { personnage: pnj } });
      } else {
        evenement(etat, 'cachot', `${def.nom} est tourmenté dans le noir (Doute ${p.doute}).`, { donnees: { personnage: pnj } });
      }
      break;
    }
    case 'relacher': {
      retirer();
      p.sortiDeJeu = false;
      p.region = c.origine;
      connaitrePosition(etat, pnj);
      if (c.plie) {
        p.agent = true;
        ajouterVisibilite(etat, R.relacher.visibiliteAgent, `${def.nom} relâché en espion`);
        evenement(etat, 'cachot', `${def.nom} rentre à ${lieu}, l’air hagard. Il rapportera à la Tour ce qu’il voit.`, { donnees: { personnage: pnj } });
      } else {
        changerTerreur(monde, etat, c.origine, R.relacher.terreur);
        for (const q of presents(monde, etat, c.origine)) if (estHeros(monde, q.id)) changerMefiance(etat, q.id, R.relacher.mefianceHeros);
        evenement(etat, 'cachot', `${def.nom} rentre à ${lieu} et raconte les cachots. La peur gagne, et l’on se méfie.`, { donnees: { personnage: pnj } });
      }
      break;
    }
    case 'executer': {
      retirer();
      p.sortiDeJeu = true;
      p.agent = false;
      delete etat.connaissance.positions[pnj];
      changerTerreur(monde, etat, c.origine, R.executer.terreur);
      for (const rid of voisinage(monde, c.origine, 0)) {
        for (const q of presents(monde, etat, rid)) if (estHeros(monde, q.id)) changerDoute(etat, q.id, R.executer.doutePresents);
      }
      ajouterVisibilite(etat, R.executer.visibilite, `exécution de ${def.nom}`);
      ajouterEssence(etat, R.executer.gainEssence, `exécution de ${def.nom}`);
      evenement(etat, 'cachot', `${def.nom} est exécuté. On retrouve sa cape à ${lieu}, pour l’exemple.`, { donnees: { personnage: pnj } });
      break;
    }
  }
}
