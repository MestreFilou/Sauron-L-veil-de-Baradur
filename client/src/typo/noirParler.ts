/**
 * Le Noir Parler à l'écran.
 *
 * Tout texte qui apparaît est d'abord écrit en runes (la police « Noir Parler », une rune
 * par lettre latine), puis se consume en clair : au bout d'un instant, ou dès que la souris
 * le survole. Le texte lui-même ne change pas, seule la police change : rien à traduire, et
 * React garde la main sur ses nœuds. On ne pose qu'un attribut `data-np` sur les éléments.
 *
 *   data-np="r"  écrit en runes
 *   data-np="c"  passé en clair (avec une brève brûlure à la bascule)
 *
 * Trois modes, mémorisés par le joueur :
 *   apparition  runes, puis clair après un délai ; le survol accélère (par défaut)
 *   survol      runes tant que la souris n'est pas dessus
 *   clair       pas de runes
 */
export type ModeNoirParler = 'apparition' | 'survol' | 'clair';

export const MODES: { id: ModeNoirParler; nom: string; aide: string }[] = [
  { id: 'apparition', nom: 'Runes à l’apparition', aide: 'Le texte naît en runes puis se consume en clair.' },
  { id: 'survol', nom: 'Runes, clair au survol', aide: 'Le texte reste en runes tant que la souris ne s’y pose pas.' },
  { id: 'clair', nom: 'Toujours en clair', aide: 'Pas de runes.' },
];

const CLE = 'sauron.noirParler';
/** Délai avant la bascule en clair, puis le balayage de haut en bas (ms par pixel). */
const DELAI = 1100;
const BALAYAGE = 0.9;
/** Après le départ de la souris, en mode survol, le temps que le texte redevienne runes. */
const RETOUR = 1400;

/** Éléments dont on ne touche jamais le texte : champs de saisie, sous-titres minutés, dessins. */
const EXCLUS = 'textarea,input,select,option,script,style,svg,canvas,#soustitres,[data-np-off]';
/** L'unité qu'un survol révèle d'un coup : une ligne de liste, un murmure, un paragraphe… */
const BLOC = '.rum,.chro,li,p,button,label,.ptitle,.gauge,.turn,.trace,.chip,.target,.vfoot,.hint,#toast,#card,h1,h2,h3';

/** Ce que la souris ne peut pas survoler (bulles, fiche de région) : toujours éclairci au bout d'un instant. */
const AUTO = '#toast,#card,#eye';
const DELAI_AUTO = 450;

const LETTRE = /\p{L}/u;

let mode: ModeNoirParler = lireMode();
const ecouteurs = new Set<(m: ModeNoirParler) => void>();
/** Dernier texte vu pour chaque élément : on ne re-runifie que si les lettres ont changé. */
const vus = new WeakMap<Element, string>();
const minuteurs = new WeakMap<Element, number>();

function lireMode(): ModeNoirParler {
  try {
    const m = localStorage.getItem(CLE);
    if (m === 'apparition' || m === 'survol' || m === 'clair') return m;
  } catch {
    /* stockage indisponible : mode par défaut */
  }
  return 'apparition';
}

export function modeNoirParler(): ModeNoirParler {
  return mode;
}

export function ecouterMode(f: (m: ModeNoirParler) => void): () => void {
  ecouteurs.add(f);
  return () => ecouteurs.delete(f);
}

export function choisirMode(m: ModeNoirParler) {
  mode = m;
  try {
    localStorage.setItem(CLE, m);
  } catch {
    /* tant pis : le choix vaut pour la session */
  }
  document.documentElement.dataset.npMode = m;
  // On repart de zéro : tout ce qui est à l'écran prend le nouveau mode.
  for (const el of document.querySelectorAll('[data-np]')) {
    annuler(el);
    if (m === 'clair') el.removeAttribute('data-np');
    else if (m === 'survol') (el as HTMLElement).dataset.np = 'r';
  }
  planifier([...document.querySelectorAll('[data-np="r"]')]);
  ecouteurs.forEach((f) => f(m));
}

/** Les lettres que l'élément porte lui-même (ses nœuds texte directs). */
function lettresPropres(el: Element): string {
  let s = '';
  for (const n of el.childNodes) if (n.nodeType === Node.TEXT_NODE) s += n.nodeValue ?? '';
  return LETTRE.test(s) ? s : '';
}

function annuler(el: Element) {
  const t = minuteurs.get(el);
  if (t !== undefined) {
    clearTimeout(t);
    minuteurs.delete(el);
  }
}

function eclaircir(el: Element) {
  annuler(el);
  if ((el as HTMLElement).dataset.np === 'r') (el as HTMLElement).dataset.np = 'c';
}

/** Programme la bascule en clair, en balayant l'écran de haut en bas. */
function planifier(els: Element[]) {
  if (mode === 'clair' || !els.length) return;
  requestAnimationFrame(() => {
    for (const el of els) {
      if (!el.isConnected || (el as HTMLElement).dataset.np !== 'r') continue;
      const auto = el.closest(AUTO) !== null;
      if (mode !== 'apparition' && !auto) continue;
      const delai = auto ? DELAI_AUTO : DELAI + Math.max(0, el.getBoundingClientRect().top) * BALAYAGE;
      annuler(el);
      minuteurs.set(el, window.setTimeout(() => eclaircir(el), delai));
    }
  });
}

/** Marque en runes un élément dont le texte vient d'apparaître ou de changer. */
function marquer(el: Element, nouveaux: Element[]) {
  if (mode === 'clair' || el.closest(EXCLUS)) return;
  const lettres = lettresPropres(el);
  if (!lettres) return;
  if (vus.get(el) === lettres) return;
  vus.set(el, lettres);
  (el as HTMLElement).dataset.np = 'r';
  nouveaux.push(el);
}

function parcourir(racine: Node, nouveaux: Element[]) {
  if (racine.nodeType === Node.TEXT_NODE) {
    if (racine.parentElement) marquer(racine.parentElement, nouveaux);
    return;
  }
  if (racine.nodeType !== Node.ELEMENT_NODE) return;
  const el = racine as Element;
  if (el.matches(EXCLUS)) return;
  marquer(el, nouveaux);
  for (const e of el.querySelectorAll('*')) marquer(e, nouveaux);
}

/** Le bloc que la souris désigne, et tout ce qu'il contient d'écrit. */
function blocDe(cible: Element): Element {
  return cible.closest(BLOC) ?? cible;
}

function reveler(bloc: Element) {
  const els = [bloc, ...bloc.querySelectorAll('[data-np]')];
  for (const el of els) eclaircir(el);
}

function revoiler(bloc: Element) {
  for (const el of [bloc, ...bloc.querySelectorAll('[data-np="c"]')]) {
    if ((el as HTMLElement).dataset.np !== 'c') continue;
    annuler(el);
    minuteurs.set(
      el,
      window.setTimeout(() => {
        if (mode === 'survol' && (el as HTMLElement).dataset.np === 'c') (el as HTMLElement).dataset.np = 'r';
      }, RETOUR),
    );
  }
}

/** Branche le Noir Parler sur toute la page. À appeler une fois, avant le premier rendu. */
export function installerNoirParler(racine: Element = document.body): () => void {
  document.documentElement.dataset.npMode = mode;

  const obs = new MutationObserver((muts) => {
    const nouveaux: Element[] = [];
    for (const m of muts) {
      if (m.type === 'characterData') {
        if (m.target.parentElement) marquer(m.target.parentElement, nouveaux);
      } else {
        m.addedNodes.forEach((n) => parcourir(n, nouveaux));
        if (m.target.nodeType === Node.ELEMENT_NODE) marquer(m.target as Element, nouveaux);
      }
    }
    planifier(nouveaux);
  });
  obs.observe(racine, { childList: true, subtree: true, characterData: true });
  const initiaux: Element[] = [];
  parcourir(racine, initiaux);
  planifier(initiaux);

  const survol = (e: PointerEvent) => {
    if (mode === 'clair' || !(e.target instanceof Element)) return;
    const bloc = blocDe(e.target);
    reveler(bloc);
  };
  const sortie = (e: PointerEvent) => {
    if (mode !== 'survol' || !(e.target instanceof Element)) return;
    const bloc = blocDe(e.target);
    if (e.relatedTarget instanceof Node && bloc.contains(e.relatedTarget)) return;
    revoiler(bloc);
  };
  document.addEventListener('pointerover', survol);
  document.addEventListener('pointerout', sortie);
  return () => {
    obs.disconnect();
    document.removeEventListener('pointerover', survol);
    document.removeEventListener('pointerout', sortie);
  };
}
