import { resoudreDuel, visibiliteEcraser } from './duel';
import {
  ajouterVisibilite,
  changerMefiance,
  connaitreAnneau,
  connaitrePosition,
  evenement,
  presents,
} from './etat';
import type { Monde } from './monde';
import { aRegle, personnage, region } from './monde';
import { verifierMurmures } from './murmures';
import { REGLES } from './regles';
import type { Rng } from './rng';
import type { Approche, CibleOeil, EtatJeu, RevelationOeil } from './types';
import { ErreurRegle } from './types';

const regionAveugle = (monde: Monde, id: string) => {
  const r = region(monde, id);
  return aRegle(r, 'zone_aveugle') || aRegle(r, 'sanctuaire');
};

/** Coût en Méfiance du Regard sur un personnage présent. */
const mefianceRegard = (volonte: number) =>
  volonte >= REGLES.mefiance.seuilVolonteForte ? REGLES.mefiance.oeilVolonteForte : REGLES.mefiance.oeilVolonteFaible;

/** Après une Pulsation, l'Œil peut se poser sur le porteur le tour suivant sans éveiller sa Méfiance. */
const pulsationFraiche = (etat: EtatJeu) => etat.anneau.pulsation !== null && etat.anneau.pulsation.tour >= etat.tour - 1;

function poserSurRegion(monde: Monde, etat: EtatJeu, id: string, rng: Rng): RevelationOeil {
  const def = region(monde, id);
  if (def.horsCarte) throw new ErreurRegle(`${def.nom} est hors de portée de l’Œil en Acte I.`);
  const rev: RevelationOeil = { cible: { type: 'region', id }, repousse: false, personnagesVus: [], murmuresVerifies: [], anneauSenti: false };
  if (regionAveugle(monde, id)) {
    rev.repousse = true;
    const sanctuaire = aRegle(def, 'sanctuaire');
    ajouterVisibilite(etat, sanctuaire ? REGLES.oeil.visibiliteSage : REGLES.oeil.visibiliteRegion, `le Regard repoussé par ${def.nom}`);
    evenement(etat, 'oeil', sanctuaire ? `Une lumière ancienne refuse d’être vue : ${def.nom} se dérobe au Regard.` : `${def.nom} est une tache aveugle. Le Regard n’y trouve rien.`);
    return rev;
  }
  ajouterVisibilite(etat, REGLES.oeil.visibiliteRegion, `l’Œil sur ${def.nom}`);
  const er = etat.regions[id]!;
  rev.terreur = er.terreur;
  etat.connaissance.terreurs[id] = { valeur: er.terreur, tour: etat.tour };
  for (const p of presents(monde, etat, id)) {
    const pdef = personnage(monde, p.id);
    rev.personnagesVus.push({ id: p.id, doute: p.doute, mefiance: p.mefiance });
    connaitrePosition(etat, p.id);
    if (pdef.volonte >= REGLES.mefiance.seuilVolonteForte && !(p.id === etat.anneau.porteur && pulsationFraiche(etat))) {
      changerMefiance(etat, p.id, REGLES.mefiance.oeilVolonteForte);
    }
  }
  const porteur = etat.personnages[etat.anneau.porteur]!;
  if (porteur.region === id) {
    const trace = etat.anneau.traces[id];
    if (trace && trace.force >= 1 && (pulsationFraiche(etat) || rng.chance(REGLES.anneau.oeilSentir))) {
      rev.anneauSenti = true;
      connaitreAnneau(etat, id, etat.tour, true);
      evenement(etat, 'detection', `L’Œil sent l’Anneau à ${def.nom}.`);
    }
  } else {
    etat.connaissance.sansPorteur[id] = etat.tour;
  }
  rev.murmuresVerifies = verifierMurmures(etat, { region: id }, 'l’Œil');
  const noms = rev.personnagesVus.map((v) => personnage(monde, v.id).nom);
  evenement(etat, 'oeil', `L’Œil se pose sur ${def.nom}.` + (noms.length ? ` Il y voit : ${noms.join(', ')}.` : ' Il n’y voit personne d’important.'), {
    donnees: { region: id, vus: rev.personnagesVus.map((v) => v.id) },
  });
  return rev;
}

function poserSurPersonnage(monde: Monde, etat: EtatJeu, id: string, approche: Approche | undefined, rng: Rng): RevelationOeil {
  const def = personnage(monde, id);
  const p = etat.personnages[id];
  if (!p || p.sortiDeJeu) throw new ErreurRegle(`${def.nom} n’est plus en jeu.`);
  if (!etat.connaissance.personnagesConnus.includes(id)) throw new ErreurRegle(`Sauron ignore encore l’existence de ${def.nom}.`);
  if (def.horsCarte) throw new ErreurRegle(`${def.nom} est hors de la carte en Acte I.`);
  const rev: RevelationOeil = { cible: { type: 'personnage', id }, repousse: false, personnagesVus: [], murmuresVerifies: [], anneauSenti: false };
  const sage = def.role === 'sage';
  if (regionAveugle(monde, p.region)) {
    rev.repousse = true;
    ajouterVisibilite(etat, sage ? REGLES.oeil.visibiliteSage : REGLES.oeil.visibilitePersonnage, `le Regard perd ${def.nom}`);
    evenement(etat, 'oeil', `Le Regard cherche ${def.nom} et ne trouve qu’un voile.`);
    return rev;
  }
  // Duel de regard contre les plus grandes volontés (une manche).
  if (def.volonte >= REGLES.oeil.seuilDuelRegard) {
    const duel = resoudreDuel(monde, etat, id, def.volonte, approche ? [approche] : undefined, false, rng, 1);
    rev.duel = duel;
    ajouterVisibilite(etat, visibiliteEcraser(duel), 'le Regard écrase');
    if (!duel.victoire) {
      rev.repousse = true;
      ajouterVisibilite(etat, REGLES.oeil.visibiliteDuelPerdu, `${def.nom} repousse le Regard`);
      changerMefiance(etat, id, REGLES.mefiance.oeilVolonteForte);
      p.verites.push('Sauron me regarde.');
      evenement(etat, 'duel', `${def.nom} soutient le Regard et le repousse. Il sait désormais que l’Œil le cherche.`, { donnees: { duel } });
      return rev;
    }
    evenement(etat, 'duel', `Le Regard force l’esprit de ${def.nom}.`, { donnees: { duel } });
  }
  ajouterVisibilite(etat, sage ? REGLES.oeil.visibiliteSage : REGLES.oeil.visibilitePersonnage, `l’Œil sur ${def.nom}`);
  if (!(id === etat.anneau.porteur && pulsationFraiche(etat))) changerMefiance(etat, id, mefianceRegard(def.volonte));
  connaitrePosition(etat, id);
  const inconnus = def.secrets.filter((s) => !etat.connaissance.secrets.some((k) => k.id === s.id));
  const secret = inconnus.length ? rng.choisir(inconnus) : null;
  if (secret) etat.connaissance.secrets.push({ id: secret.id, personnage: id, tour: etat.tour });
  if (!etat.connaissance.peurs.includes(id)) etat.connaissance.peurs.push(id);
  if (!etat.connaissance.destinations.includes(id)) etat.connaissance.destinations.push(id);
  rev.pensees = { destination: def.destination, peur: def.peur, secret: secret?.texte ?? null, doute: p.doute, mefiance: p.mefiance };
  if (id === etat.anneau.porteur) {
    rev.anneauSenti = true;
    connaitreAnneau(etat, p.region, etat.tour, true);
  }
  rev.murmuresVerifies = verifierMurmures(etat, { personnage: id }, 'l’Œil');
  evenement(etat, 'oeil', `L’Œil fouille l’esprit de ${def.nom}, à ${region(monde, p.region).nom}.`, {
    donnees: { personnage: id, region: p.region, secret: secret?.id ?? null },
  });
  return rev;
}

/** Phase 2 : l'Œil se pose sur une seule cible (gratuit en PA). */
export function poserOeil(monde: Monde, etat: EtatJeu, cible: CibleOeil, approche: Approche | undefined, rng: Rng): RevelationOeil {
  const rev = cible.type === 'region' ? poserSurRegion(monde, etat, cible.id, rng) : poserSurPersonnage(monde, etat, cible.id, approche, rng);
  etat.oeil = rev;
  return rev;
}
