import type { Monde } from './monde';
import { region } from './monde';
import { estimerPiste } from './piste';
import type { Affectation, EtatJeu, IdNazgul, IdRegion, Ordre } from './types';
import { ErreurRegle } from './types';

/**
 * Missions permanentes des Neuf (le « conseil » de la Tour). Une affectation ne
 * contourne aucune règle : elle propose, à chaque phase des ordres, les ordres
 * qu'un joueur aurait donnés à la main. Ceux qui passent la validation sont
 * ajoutés au tour (et s'annulent comme les autres) ; les autres sont ignorés.
 */

export const LIBELLES_AFFECTATION: Record<Affectation['type'], string> = {
  battre_campagne: 'Battre la campagne',
  tenir_passage: 'Tenir un passage',
  suivre_piste: 'Suivre la piste',
  semer_effroi: 'Semer l’effroi',
};

/** Région que vise une affectation (null : sur place). */
export function regionVisee(monde: Monde, etat: EtatJeu, a: Affectation): IdRegion | null {
  switch (a.type) {
    case 'battre_campagne':
      return null;
    case 'tenir_passage':
    case 'semer_effroi':
      return a.region;
    case 'suivre_piste':
      return etat.connaissance.anneau?.region ?? estimerPiste(monde, etat).regionProbable;
  }
}

/** Les ordres qu'inspire l'affectation de ce Nazgûl ce tour-ci (non validés). */
export function ordresAffectation(monde: Monde, etat: EtatJeu, id: IdNazgul): Ordre[] {
  const n = etat.nazgul[id];
  const a = n?.affectation;
  if (!n || !a) return [];
  const o: Ordre[] = [];
  const cible = regionVisee(monde, etat, a);
  const enRoute = cible !== null && cible !== n.region;
  if (enRoute) o.push({ type: 'nazgul_deplacer', nazgul: id, destination: cible });
  switch (a.type) {
    case 'battre_campagne':
    case 'suivre_piste':
      o.push({ type: 'nazgul_traque', nazgul: id });
      break;
    case 'semer_effroi':
      if (!enRoute) o.push({ type: 'nazgul_cri', nazgul: id });
      break;
    case 'tenir_passage': {
      // Sur place, il se tapit ; il ne repose son embuscade que lorsqu'elle est éteinte.
      const tapi = Object.values(etat.regions).some((r) => r.embuscades.some((e) => e.nazgul === id && e.expire >= etat.tour));
      if (!enRoute && !tapi) o.push({ type: 'nazgul_embuscade', nazgul: id });
      break;
    }
  }
  return o;
}

/**
 * Ajoute au tour les ordres des affectations, Nazgûl par Nazgûl, pour ceux qui
 * n'ont encore rien reçu. `valider` est la validation du réducteur (injectée
 * pour éviter une dépendance circulaire avec partie.ts).
 */
export function appliquerAffectations(
  monde: Monde,
  etat: EtatJeu,
  valider: (o: Ordre) => void,
  seulement?: IdNazgul,
): void {
  if (etat.phase !== 'ordres') return;
  for (const n of Object.values(etat.nazgul)) {
    if (seulement && n.id !== seulement) continue;
    if (!n.affectation || etat.ordres.some((o) => 'nazgul' in o && o.nazgul === n.id)) continue;
    for (const o of ordresAffectation(monde, etat, n.id)) {
      try {
        valider(o);
        etat.ordres.push(o);
      } catch (e) {
        if (!(e instanceof ErreurRegle)) throw e;
      }
    }
  }
}

export function validerAffectation(monde: Monde, etat: EtatJeu, id: IdNazgul, a: Affectation | null): void {
  if (!etat.nazgul[id]) throw new ErreurRegle(`Nazgûl inconnu : ${id}`);
  if (!a) return;
  if (a.type === 'tenir_passage' || a.type === 'semer_effroi') {
    const r = region(monde, a.region);
    if (r.horsCarte) throw new ErreurRegle(`${r.nom} est hors de la carte.`);
  }
}
