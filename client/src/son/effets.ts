/**
 * Quels effets sonores jouer quand l'état du jeu change. Fonction pure, comme
 * ambianceDuJeu : elle compare deux instantanés et rend la liste des effets,
 * pour pouvoir être testée sans navigateur.
 */
import type { IdEffet } from '@sauron/audio';
import type { EtatJeu } from '@sauron/engine';

export interface Instantane {
  etat: Pick<EtatJeu, 'tour' | 'ordres' | 'oeil' | 'rituel' | 'murmures' | 'issue'>;
  mode: 'oeil' | 'ombre';
  duel: unknown;
  introVue: boolean;
  toast: { n: number } | null;
}

export interface EffetAJouer {
  id: IdEffet;
  /** En secondes, pour laisser un premier son respirer avant le suivant. */
  retard?: number;
}

export function effetsDuChangement(avant: Instantane, apres: Instantane): EffetAJouer[] {
  const out: EffetAJouer[] = [];
  const a = avant.etat;
  const b = apres.etat;

  if (apres.introVue && !avant.introVue) out.push({ id: 'entree' });

  if (b.tour !== a.tour) {
    // Fin des ordres : la Tour sonne le tour suivant. (Une nouvelle partie remet le tour à 1 : rien.)
    if (b.tour > a.tour) out.push({ id: 'fin_tour' });
  } else {
    if (b.ordres.length > a.ordres.length) out.push({ id: 'ordre' });
    else if (b.ordres.length < a.ordres.length) out.push({ id: 'ordre_annule' });

    if (b.oeil && b.oeil !== a.oeil && !a.oeil) {
      if (b.oeil.repousse) out.push({ id: 'repousse' });
      else {
        out.push({ id: 'regard' });
        if (b.oeil.anneauSenti) out.push({ id: 'anneau', retard: 0.7 });
      }
    }
    if (b.rituel && !a.rituel) out.push({ id: 'rituel' });

    const classes = (e: typeof a) => new Map(e.murmures.map((m) => [m.id, m.classement]));
    const avantC = classes(a);
    if (b.murmures.some((m) => avantC.has(m.id) && avantC.get(m.id) !== m.classement)) out.push({ id: 'murmure' });
  }

  if (apres.duel && !avant.duel) out.push({ id: 'duel' });

  if (apres.mode !== avant.mode) out.push({ id: apres.mode === 'ombre' ? 'ombre_entrer' : 'ombre_sortir' });

  // Une annonce sans que l'état bouge : une règle a refusé le geste.
  if (apres.toast && apres.toast.n !== avant.toast?.n && apres.etat === avant.etat) out.push({ id: 'refus' });

  return out;
}

/** Le son d'un clic sur un élément d'interface : null s'il n'en fait pas. */
export function effetDuClic(el: Element | null): IdEffet | null {
  const b = el?.closest('button, .btn, [role="button"], input[type="checkbox"], input[type="range"]');
  if (!b || (b as HTMLButtonElement).disabled) return null;
  if (b.closest('.tabs, .reg')) return 'ui_onglet';
  if (b.matches('input[type="range"]')) return null;
  return 'ui_clic';
}

/** L'élément survolé qui mérite un léger son (un bouton actif), ou null. */
export function cibleSurvol(el: Element | null): Element | null {
  const b = el?.closest('button, .btn, [role="button"]');
  return b && !(b as HTMLButtonElement).disabled ? b : null;
}
