import { distance } from './carte';
import { resoudreDuel, visibiliteEcraser } from './duel';
import {
  ajouterEssence,
  ajouterVisibilite,
  changerDoute,
  changerMefiance,
  connaitrePosition,
  evenement,
  nazgulDisponibles,
} from './etat';
import type { Monde } from './monde';
import { personnage, region } from './monde';
import { borner } from './outils';
import { REGLES } from './regles';
import type { Rng } from './rng';
import type { EtatJeu, EtiquettesTexteLibre, IdPersonnage, Ordre, ResultatVoix } from './types';

type OrdreVoix = Extract<Ordre, { type: 'voix' }>;

/** Portée de la Voix : régions autour d'un Nazgûl ou d'un agent (+2 à partir de la Forme 1). */
export function porteeVoix(etat: EtatJeu): number {
  return REGLES.voix.portee + (etat.jauges.forme >= 1 ? REGLES.voix.porteeForme1 : 0);
}

export function voixAPortee(monde: Monde, etat: EtatJeu, cible: IdPersonnage): boolean {
  const p = etat.personnages[cible];
  if (!p) return false;
  if (etat.oeil && !etat.oeil.repousse) {
    if (etat.oeil.cible.type === 'personnage' && etat.oeil.cible.id === cible) return true;
    if (etat.oeil.personnagesVus.some((v) => v.id === cible)) return true;
  }
  const relais = [
    ...nazgulDisponibles(etat).map((n) => n.region),
    ...Object.values(etat.personnages).filter((a) => a.agent && !a.sortiDeJeu).map((a) => a.region),
  ];
  const portee = porteeVoix(etat);
  return relais.some((r) => distance(monde, r, p.region) <= portee);
}

export const coutVoix = (etat: EtatJeu) => REGLES.voix.coutPa + (etat.jauges.paliers.includes(80) ? 1 : 0);

/** Bonus de texte libre à partir des étiquettes renvoyées par Sonnet (4.3), plafonné. */
export function bonusTexteLibre(etiquettes: EtiquettesTexteLibre | undefined, registre: OrdreVoix['registre']): number {
  if (!etiquettes) return 0;
  const t = REGLES.voix.texteLibre;
  let b = Math.min(t.max, etiquettes.coherencePersonnage * t.parCoherence + etiquettes.subtilite * t.parSubtilite);
  if (etiquettes.registreDetecte !== registre) b += t.registreDifferent;
  if (etiquettes.contradictionLore) b += t.contradictionLore;
  return b;
}

/** Décompose la chance de réussite de la Voix (4.1, 4.2). */
export function chanceVoix(monde: Monde, etat: EtatJeu, ordre: OrdreVoix): { chance: number; detail: Record<string, number>; duel: boolean } {
  const def = personnage(monde, ordre.cible);
  const p = etat.personnages[ordre.cible]!;
  const detail: Record<string, number> = {
    base: REGLES.voix.base,
    doute: p.doute,
    volonte: -def.volonte,
    mefiance: 0 - Math.round(p.mefiance * REGLES.mefiance.facteurVoix),
    forme: REGLES.voix.parForme * etat.jauges.forme,
  };
  // Registre
  let registre = 0;
  let duel = false;
  if (ordre.registre === 'paranoia') {
    if (etat.connaissance.peurs.includes(ordre.cible)) registre += REGLES.voix.paranoia.peurConnue;
    if (ordre.allie && etat.personnages[ordre.allie] && etat.personnages[ordre.allie]!.region !== p.region) registre += REGLES.voix.paranoia.separes;
  } else if (ordre.registre === 'annatar') {
    if (def.traits.includes('orgueil') || def.traits.includes('desir')) registre += REGLES.voix.annatar.orgueilDesir;
    if (def.traits.includes('humble')) registre += REGLES.voix.annatar.humble;
  } else {
    if (def.volonte <= REGLES.voix.fer.seuilVolonteFaible) registre += REGLES.voix.fer.volonteFaible;
    if (def.volonte >= REGLES.voix.fer.seuilDuel && !p.dette) duel = true;
  }
  detail.registre = registre;
  // Secret et murmures
  const secretId = ordre.secret ?? ordre.etiquettes?.secretUtilise ?? undefined;
  const secret = secretId ? etat.connaissance.secrets.find((s) => s.id === secretId) : undefined;
  let bonusSecret = 0;
  if (secret && secret.tour >= etat.tour - 1) bonusSecret += REGLES.voix.secretOeil;
  if (ordre.murmure) {
    const m = etat.murmures.find((x) => x.id === ordre.murmure);
    if (m && m.verite === 'faux') bonusSecret += REGLES.voix.murmureFaux;
    else if (m && m.classement === 'vrai') bonusSecret += REGLES.voix.murmureVraiConfirme;
  }
  detail.secret = bonusSecret;
  detail.texte = bonusTexteLibre(ordre.etiquettes, ordre.registre);
  const brut = Object.values(detail).reduce((a, b) => a + b, 0);
  return { chance: borner(Math.round(brut), REGLES.voix.min, REGLES.voix.max), detail, duel };
}

function executerOrdreFer(monde: Monde, etat: EtatJeu, ordre: OrdreVoix, rng: Rng): string {
  const p = etat.personnages[ordre.cible]!;
  const def = personnage(monde, ordre.cible);
  const f = ordre.ordreFer ?? { type: 'se_taire' as const };
  switch (f.type) {
    case 'deplacer':
      p.detour = f.region;
      return `${def.nom} se met en route vers ${region(monde, f.region).nom}.`;
    case 'se_taire':
      p.silenceJusquA = etat.tour + 3;
      return `${def.nom} se tait et ne préviendra personne.`;
    case 'livrer': {
      const inconnus = def.secrets.filter((s) => !etat.connaissance.secrets.some((k) => k.id === s.id));
      for (const q of Object.values(etat.personnages)) if (q.region === p.region && !q.sortiDeJeu) connaitrePosition(etat, q.id);
      if (inconnus.length) {
        const s = rng.choisir(inconnus);
        etat.connaissance.secrets.push({ id: s.id, personnage: ordre.cible, tour: etat.tour });
        return `${def.nom} livre ce qu’il sait : « ${s.texte} »`;
      }
      return `${def.nom} livre ce qu’il sait, mais il ne sait plus rien que la Tour ignore.`;
    }
  }
}

/** Résout une Voix de Sauron (phase 5, étape 3). */
export function resoudreVoix(monde: Monde, etat: EtatJeu, ordre: OrdreVoix, rng: Rng): ResultatVoix {
  const def = personnage(monde, ordre.cible);
  const p = etat.personnages[ordre.cible]!;
  const [vReussite, vEchec] = REGLES.voix.visibilite[ordre.registre]!;
  const { chance, detail, duel: avecDuel } = chanceVoix(monde, etat, ordre);
  const resultat: ResultatVoix = { ordre, chance, jet: -1, reussie: false, duel: null, detail };
  etat.voixCeTour.push(ordre.cible);

  // La dette d'Annatar se réclame par un Commandement : il obéit sans lutter.
  if (ordre.registre === 'fer' && p.dette) {
    p.dette = false;
    resultat.reussie = true;
    const texte = executerOrdreFer(monde, etat, ordre, rng);
    ajouterVisibilite(etat, vReussite, `Commandement à ${def.nom}`);
    evenement(etat, 'voix', `${def.nom} honore sa dette envers l’Ombre. ${texte}`, { donnees: { resultat } });
    return resultat;
  }

  if (avecDuel) {
    const secretDispo = Boolean(ordre.secret && etat.connaissance.secrets.some((s) => s.id === ordre.secret));
    const duel = resoudreDuel(monde, etat, ordre.cible, def.volonte, ordre.approches, secretDispo, rng);
    resultat.duel = duel;
    resultat.reussie = duel.victoire;
    ajouterVisibilite(etat, visibiliteEcraser(duel), 'le duel écrase');
    if (duel.victoire) {
      const texte = executerOrdreFer(monde, etat, ordre, rng);
      changerDoute(etat, ordre.cible, REGLES.duel.victoire.doute);
      changerMefiance(etat, ordre.cible, REGLES.duel.victoire.mefiance);
      ajouterEssence(etat, REGLES.duel.victoire.essence, 'duel mental gagné');
      ajouterVisibilite(etat, vReussite, `Commandement à ${def.nom}`);
      evenement(etat, 'duel', `L’esprit de ${def.nom} plie sous le Commandement. ${texte}`, { donnees: { resultat } });
    } else {
      const f = duel.facteurRetour;
      ajouterVisibilite(etat, Math.round(REGLES.duel.defaite.visibilite * f), `retour de flamme contre ${def.nom}`);
      changerMefiance(etat, ordre.cible, Math.round(REGLES.duel.defaite.mefiance * f));
      if (f >= 1) etat.jauges.malusPa += REGLES.duel.defaite.pa;
      if (duel.veriteApprise) {
        p.verites.push(duel.veriteApprise);
        p.veritesAPropager.push(duel.veriteApprise);
      }
      evenement(etat, 'duel', `${def.nom} rejette le Commandement. Retour de flamme : ${def.nom} a appris que « ${duel.veriteApprise} »`, {
        donnees: { resultat },
      });
    }
    return resultat;
  }

  resultat.jet = rng.d100();
  resultat.reussie = resultat.jet < chance;
  const allie = ordre.allie ? personnage(monde, ordre.allie).nom : null;
  if (resultat.reussie) {
    changerMefiance(etat, ordre.cible, REGLES.mefiance.voixReussie);
    ajouterVisibilite(etat, vReussite, `Voix réussie sur ${def.nom}`);
    let texte = '';
    if (ordre.registre === 'paranoia') {
      changerDoute(etat, ordre.cible, REGLES.doute.voixReussie.paranoia);
      if (ordre.allie) {
        p.relations[ordre.allie] = (p.relations[ordre.allie] ?? 50) + REGLES.voix.paranoia.relationReussite;
        texte = p.relations[ordre.allie]! < 0 ? `${def.nom} se met à mentir à ${allie}.` : `${def.nom} se défie de ${allie}.`;
      } else texte = `Le doute ronge ${def.nom}.`;
    } else if (ordre.registre === 'annatar') {
      changerDoute(etat, ordre.cible, REGLES.doute.voixReussie.annatar);
      p.dette = true;
      texte = `${def.nom} accepte la promesse. Il a désormais une dette envers l’Ombre.`;
    } else {
      changerDoute(etat, ordre.cible, REGLES.doute.voixReussie.annatar);
      texte = executerOrdreFer(monde, etat, ordre, rng);
    }
    evenement(etat, 'voix', `La Voix atteint ${def.nom}. ${texte}`, { donnees: { resultat } });
  } else {
    changerMefiance(etat, ordre.cible, REGLES.mefiance.voixRatee);
    ajouterVisibilite(etat, vEchec, `Voix ratée sur ${def.nom}`);
    let texte = `${def.nom} sent une volonté étrangère et la chasse.`;
    if (ordre.registre === 'paranoia' && ordre.allie) {
      p.relations[ordre.allie] = (p.relations[ordre.allie] ?? 50) + REGLES.voix.paranoia.relationEchec;
      texte = `${def.nom} se rapproche de ${allie}.`;
    }
    if (ordre.registre === 'annatar') {
      ajouterVisibilite(etat, REGLES.voix.visibiliteIntentionRevelee, `${def.nom} devine une intention de Sauron`);
      p.verites.push('Sauron achète les esprits par des promesses.');
      texte = `${def.nom} refuse la promesse et devine qui la fait.`;
    }
    evenement(etat, 'voix', `La Voix échoue sur ${def.nom}. ${texte}`, { donnees: { resultat } });
  }
  return resultat;
}
