/**
 * Branche le son sur le jeu : la musique suit l'état (ambianceDuJeu), les
 * gestes qui parlent déclenchent une réplique, et les sous-titres français
 * s'affichent en même temps que la voix (mécaniques 10.3, 10.3 bis, 10.4).
 */
import type { RegistreVoix } from '@sauron/audio';
import { decomposer, minuterSousTitre } from '@sauron/audio';
import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { useJeu } from '../store';
import { ambianceDuJeu } from './ambiance';
import { cibleSurvol, effetDuClic, effetsDuChangement } from './effets';
import { moteurSon, type Parole } from './moteur';
import { useReglagesSon } from './reglages';
import { choisirReplique, registreDeLOrdre } from './repliques';

/** Après la fin d'une réplique de la Voix, l'ambiance « voix » tient encore un peu. */
const MAINTIEN_VOIX_S = 6;
/** Le sous-titre reste lisible un instant après la fin de la voix. */
const RESTE_S = 1.4;

const VOIX_PROJETEE: RegistreVoix[] = ['paranoia', 'annatar', 'fer'];

interface EtatParole {
  parole: Parole | null;
  n: number;
  /** La musique « voix » joue jusqu'à cet instant (performance.now()). */
  voixJusqua: number;
}

export const useParole = create<EtatParole>(() => ({ parole: null, n: 0, voixJusqua: 0 }));

const compteurs = new Map<string, number>();

/** Dit une réplique du registre et affiche son sous-titre. */
export function dire(registre: RegistreVoix, opts: { victoire?: boolean } = {}) {
  const r = choisirReplique(registre, compteurs, opts);
  if (!r) return;
  const parole = moteurSon.dire(r, () => {
    if (useParole.getState().parole === parole && VOIX_PROJETEE.includes(registre)) {
      useParole.setState({ voixJusqua: performance.now() + MAINTIEN_VOIX_S * 1000 });
    }
  });
  useParole.setState((s) => ({
    parole,
    n: s.n + 1,
    voixJusqua: VOIX_PROJETEE.includes(registre) ? performance.now() + (parole.duree + MAINTIEN_VOIX_S) * 1000 : s.voixJusqua,
  }));
}

/** Suit le jeu et pilote le moteur. Ne rend que les sous-titres. */
export function Son() {
  const reglages = useReglagesSon();
  const [, rafraichir] = useState(0);

  // Les navigateurs n'ouvrent le son qu'après un geste du joueur.
  useEffect(() => {
    const ouvrir = () => moteurSon.debloquer();
    window.addEventListener('pointerdown', ouvrir, true);
    window.addEventListener('keydown', ouvrir, true);
    return () => {
      window.removeEventListener('pointerdown', ouvrir, true);
      window.removeEventListener('keydown', ouvrir, true);
    };
  }, []);

  useEffect(() => moteurSon.regler(reglages), [reglages]);

  // Les sons d'interface : un souffle au survol d'un bouton, un déclic au clic.
  useEffect(() => {
    let survole: Element | null = null;
    const survol = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const c = cibleSurvol(e.target as Element);
      if (c && c !== survole) moteurSon.effet('ui_survol');
      survole = c;
    };
    const clic = (e: MouseEvent) => {
      const id = effetDuClic(e.target as Element);
      if (id) moteurSon.effet(id);
    };
    window.addEventListener('pointerover', survol, true);
    window.addEventListener('click', clic, true);
    return () => {
      window.removeEventListener('pointerover', survol, true);
      window.removeEventListener('click', clic, true);
    };
  }, []);

  // M : couper ou rendre le son.
  useEffect(() => {
    const clavier = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.tagName === 'INPUT' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.toLowerCase() === 'm') {
        const r = useReglagesSon.getState();
        r.regler({ coupe: !r.coupe });
      }
    };
    window.addEventListener('keydown', clavier);
    return () => window.removeEventListener('keydown', clavier);
  }, []);

  // Les gestes qui parlent.
  useEffect(
    () =>
      useJeu.subscribe((s, avant) => {
        if (s.introVue && !avant.introVue) {
          moteurSon.debloquer();
          dire('inscription');
        }
        for (const e of effetsDuChangement(avant, s)) moteurSon.effet(e.id, { retard: e.retard });
        if (s.etat.tour === avant.etat.tour && s.etat.ordres.length > avant.etat.ordres.length) {
          const registre = registreDeLOrdre(s.etat.ordres.at(-1)!);
          if (registre) dire(registre);
        }
        if (s.duel && !avant.duel) dire('duel', { victoire: s.duel.victoire });
        if (s.etat !== avant.etat && s.etat.tour !== avant.etat.tour) moteurSon.taire();
      }),
    [],
  );

  // L'ambiance suit l'état du jeu.
  const issue = useJeu((s) => s.vue.issue);
  const duel = useJeu((s) => s.duel !== null);
  const mode = useJeu((s) => s.mode);
  const ordres = useJeu((s) => s.etat.ordres);
  const tour = useJeu((s) => s.vue.tour);
  const voixJusqua = useParole((s) => s.voixJusqua);
  const voix = voixJusqua > performance.now();
  useEffect(() => {
    if (!voix) return;
    const t = setTimeout(() => rafraichir((n) => n + 1), voixJusqua - performance.now() + 20);
    return () => clearTimeout(t);
  }, [voix, voixJusqua]);
  useEffect(() => {
    moteurSon.ambiance(ambianceDuJeu({ issue, duel, voix, mode, ordres }), tour);
  }, [issue, duel, voix, mode, ordres, tour]);

  // Sous la musique, le fond : la forge de la Tour, ou le vent du Monde de l'Ombre.
  useEffect(() => moteurSon.fond(issue ? null : mode), [mode, issue]);

  return reglages.sousTitres ? <SousTitres glose={reglages.glose} /> : null;
}

/** Les mots d'une ligne en Noir Parler, avec leur glose (racine, sens, attesté ou inventé). */
function gloser(mot: string): string | null {
  const propre = mot.replace(/[.,!?;:«»"()]/g, '');
  const morceaux = propre.split('-').filter(Boolean).map((m) => decomposer(m));
  if (!morceaux.length || morceaux.some((m) => !m)) return null;
  return morceaux
    .flatMap((m) => m!)
    .map((e) => `${e.type === 'suffixe' ? '-' : ''}${e.mot} : ${e.sens} (${e.statut === 'atteste' ? 'attesté' : e.statut === 'derive' ? 'dérivé' : 'inventé'})`)
    .join('\n');
}

function SousTitres({ glose }: { glose: boolean }) {
  const { parole, n } = useParole();
  const [t, setT] = useState(0);
  const [visible, setVisible] = useState(false);
  const survol = useRef(false);
  const [bas, setBas] = useState<number | null>(null);

  useEffect(() => {
    if (!parole) return;
    setVisible(true);
    // Juste au-dessus des panneaux du bas (leur hauteur change avec la phase du tour).
    const haut = document.querySelector('.basmilieu')?.getBoundingClientRect().top;
    setBas(haut ? Math.max(18, window.innerHeight - haut + 14) : null);
    let image = 0;
    let minuterie = 0;
    const cacher = () => {
      if (survol.current) minuterie = window.setTimeout(cacher, 500);
      else setVisible(false);
    };
    const tic = () => {
      const el = parole.el;
      const horloge = (performance.now() - parole.debut) / 1000;
      // Avec une voix, on suit sa position réelle ; la limite d'horloge couvre un fichier qui ne démarre pas.
      const fini = el ? el.ended || (el.paused && el.currentTime > 0) || el.error !== null || horloge > parole.duree + 3 : horloge >= parole.duree;
      setT(el ? el.currentTime : Math.min(horloge, parole.duree));
      if (fini) {
        setT(parole.duree);
        minuterie = window.setTimeout(cacher, RESTE_S * 1000);
      } else image = requestAnimationFrame(tic);
    };
    image = requestAnimationFrame(tic);
    return () => {
      cancelAnimationFrame(image);
      clearTimeout(minuterie);
    };
  }, [parole, n]);

  if (!parole) return null;
  const r = parole.replique;
  const mots = minuterSousTitre(r.sous_titre, parole.duree, r.reperes);
  const noir = r.noir_parler ? minuterSousTitre(r.noir_parler, parole.duree) : [];
  const muette = !parole.el;

  return (
    <div
      id="soustitres"
      className={`${visible ? 'show' : ''}${muette ? ' muette' : ''}`}
      aria-live="polite"
      style={bas !== null ? { bottom: bas } : undefined}
      onMouseEnter={() => (survol.current = true)}
      onMouseLeave={() => (survol.current = false)}
    >
      {noir.length > 0 && (
        <div className="np">
          {noir.map((m, i) => {
            const g = glose ? gloser(m.mot) : null;
            return (
              <span key={i} className={`${t >= m.debut ? 'dit' : ''}${g ? ' glose' : ''}`} title={g ?? undefined}>
                {m.mot}{' '}
              </span>
            );
          })}
        </div>
      )}
      <div className="fr">
        {mots.map((m, i) => (
          <span key={i} className={t >= m.debut ? 'dit' : ''}>
            {m.mot}{' '}
          </span>
        ))}
      </div>
      {muette && <div className="note">voix à enregistrer</div>}
    </div>
  );
}
