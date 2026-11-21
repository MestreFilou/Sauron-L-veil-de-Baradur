/**
 * L'écran du Mont Destin : on y descend en cliquant sur l'Œil. La scène 3D
 * occupe tout l'écran ; le bandeau de gauche liste les salles (salles.ts), le
 * panneau de droite affiche celle qui est ouverte. Échap remonte à la Tour.
 */
import type { IdOuvrage } from '@sauron/engine';
import { OUVRAGES } from '@sauron/engine';
import { useEffect, useRef, useState } from 'react';
import { romain } from '../panneaux/Haut';
import { Runes } from '../Runes';
import { useJeu } from '../store';
import { useMontDoom } from './etat';
import { FICHES } from './fiches';
import { SALLES } from './salles';
import type { SceneMontDoom } from './scene';
import { creerScene } from './scene';

function webglDisponible(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

export default function MontDoom() {
  const cv = useRef<HTMLCanvasElement>(null);
  const etiquettes = useRef<Partial<Record<IdOuvrage, HTMLElement>>>({});
  const scene = useRef<SceneMontDoom | null>(null);
  const [sansWebgl] = useState(() => !webglDisponible());
  const [arrivee, setArrivee] = useState(false);

  const vue = useJeu((s) => s.vue);
  const niveaux = vue.ouvrages;
  const { salle, ouvrageChoisi, ouvrageSurvole, chantier, fermer, choisirSalle, choisirOuvrage, survolerOuvrage } = useMontDoom();
  const active = SALLES.find((s) => s.id === salle) ?? SALLES[0]!;

  useEffect(() => {
    if (sansWebgl || !cv.current) return;
    const s = creerScene(cv.current, etiquettes.current, {
      survol: (id) => useMontDoom.getState().survolerOuvrage(id),
      choix: (id) => useMontDoom.getState().choisirOuvrage(id),
    });
    s.niveaux(useJeu.getState().vue.ouvrages);
    scene.current = s;
    const t = setTimeout(() => setArrivee(true), 60);
    return () => {
      clearTimeout(t);
      s.detruire();
      scene.current = null;
    };
  }, [sansWebgl]);

  useEffect(() => scene.current?.niveaux(niveaux), [niveaux]);
  useEffect(() => scene.current?.viser(ouvrageChoisi), [ouvrageChoisi]);
  useEffect(() => {
    if (chantier) scene.current?.celebrer(chantier.id);
  }, [chantier]);

  useEffect(() => {
    document.body.classList.add('montdoom');
    const clavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (useMontDoom.getState().ouvrageChoisi) choisirOuvrage(null);
        else fermer();
      }
    };
    window.addEventListener('keydown', clavier, true);
    return () => {
      document.body.classList.remove('montdoom');
      window.removeEventListener('keydown', clavier, true);
    };
  }, [fermer, choisirOuvrage]);

  return (
    <div id="montdoom" className={arrivee || sansWebgl ? 'arrive' : ''}>
      {sansWebgl ? <div className="sans-webgl">Le Mont Destin demande WebGL, que ce navigateur refuse.</div> : <canvas ref={cv} className="scene" />}

      <div className="etiquettes" aria-hidden="true">
        {OUVRAGES.map((id) => (
          <div
            key={id}
            ref={(el) => {
              if (el) etiquettes.current[id] = el;
            }}
            className={`etiquette${niveaux[id] ? ' bati' : ''}${ouvrageSurvole === id ? ' survol' : ''}${ouvrageChoisi === id ? ' sel' : ''}`}
          >
            <span>{FICHES[id].nom}</span>
            {niveaux[id] > 0 && <b>{romain(niveaux[id])}</b>}
          </div>
        ))}
      </div>

      <header className="md-haut">
        <div className="md-titre">
          <h2>Orodruin</h2>
          <span>Le Mont Destin · Tour {romain(vue.tour)}</span>
        </div>
        <div className="md-jauges">
          <span>
            Essence <b>{vue.jauges.essenceRestante}</b>
          </span>
          <span>
            PA <b>{vue.jauges.paRestants}</b>/{vue.jauges.pa}
          </span>
          <span>
            Visibilité <b>{vue.jauges.visibilite}</b>
          </span>
        </div>
        <button className="btn mini" onClick={fermer}>
          Remonter à la Tour · Échap
        </button>
      </header>

      <nav className="panel md-salles" aria-label="Salles de Barad-dûr">
        <div className="ptitle">
          Les Salles <Runes n={4} s={41} />
        </div>
        <ul>
          {SALLES.map((s) => (
            <li key={s.id}>
              <button className={`${s.id === active.id ? 'on' : ''}${s.Panneau ? '' : ' scellee'}`} onClick={() => choisirSalle(s.id)}>
                <i>{s.glyphe}</i>
                <span>
                  {s.nom}
                  <small>{s.Panneau ? s.sousTitre : 'Scellée · à venir'}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <aside className="panel md-panneau">
        <div className="ptitle">
          {active.nom} <Runes n={5} s={53} />
        </div>
        <div className="md-corps">
          {active.Panneau ? (
            <active.Panneau />
          ) : (
            <p className="vide">
              Cette salle est encore scellée. {active.sousTitre} : les portes s’ouvriront dans une prochaine version.
            </p>
          )}
        </div>
      </aside>

      <div className="md-aide">Glisser pour tourner · molette pour approcher · cliquer un ouvrage pour le choisir</div>
    </div>
  );
}
