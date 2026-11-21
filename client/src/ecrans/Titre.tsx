/**
 * L'écran titre : Barad-dûr sur le rougeoiement du Mordor, l'Œil entre les
 * cornes de la Tour, l'inscription de l'Anneau qui tourne autour de lui, et
 * le menu. La musique de Barad-dûr joue si une piste est installée
 * (audio/musique/pistes.json).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Oeil } from '../Oeil';
import { aReprendre, etatDe, listerSauvegardes, quand, type Enveloppe } from '../partie/sauvegardes';
import { romain } from '../panneaux/Haut';
import { bureau, estBureau } from '../plateforme';
import { moteurSon } from '../son/moteur';
import { useJeu } from '../store';
import { Credits, Options, Sauvegardes } from './Menus';
import { SceneTitre, useWebGL2 } from './SceneTitre';
import { AnneauDeFeu, INSCRIPTION_FR, Tour } from './Tour';

type Fenetre = 'options' | 'charger' | 'credits' | 'confirmer' | null;

/** Les braises qui montent du Mordor : positions tirées une fois. */
function Braises({ n = 34 }: { n?: number }) {
  const braises = useMemo(
    () =>
      Array.from({ length: n }, () => ({
        left: `${Math.random() * 100}%`,
        delai: `${-Math.random() * 14}s`,
        duree: `${9 + Math.random() * 9}s`,
        taille: `${1 + Math.random() * 2.4}px`,
        derive: `${(Math.random() - 0.5) * 140}px`,
      })),
    [n],
  );
  return (
    <div className="braises" aria-hidden="true">
      {braises.map((b, i) => (
        <i key={i} style={{ left: b.left, animationDelay: b.delai, animationDuration: b.duree, width: b.taille, height: b.taille, ['--derive' as string]: b.derive }} />
      ))}
    </div>
  );
}

/** L'Œil grandit avec la fenêtre, pour garder sa place entre les cornes de la Tour. */
function useEchelleOeil(): number {
  const calcul = () => Math.round(Math.min(3, Math.max(1.3, (window.innerHeight / 900) * 2)) * 20) / 20;
  const [e, setE] = useState(calcul);
  useEffect(() => {
    const maj = () => setE(calcul());
    window.addEventListener('resize', maj);
    return () => window.removeEventListener('resize', maj);
  }, []);
  return e;
}

export function DecorMordor({ avecOeil = true }: { avecOeil?: boolean }) {
  const echelle = useEchelleOeil();
  return (
    <div className="decor-mordor" aria-hidden="true">
      <div className="ciel" />
      <div className="fumee f1" />
      <div className="fumee f2" />
      <Braises />
      <div className="scene-tour">
        {avecOeil && (
          <div className="oeil-tour" style={{ ['--echelle' as string]: echelle }}>
            <AnneauDeFeu className="anneau-feu" />
            <Oeil id="oeil-titre" echelle={echelle} suivre="souris" libelle={false} />
          </div>
        )}
        <Tour className="tour" />
      </div>
      <div className="brume-sol" />
    </div>
  );
}

export function Titre() {
  const [fenetre, setFenetre] = useState<Fenetre>(null);
  const [reprise, setReprise] = useState<Enveloppe | null | undefined>(undefined);
  const nouvellePartie = useJeu((s) => s.nouvellePartie);
  const lancer = useJeu((s) => s.lancer);
  const [webgl, sansWebgl] = useWebGL2();
  // la 3D d'abord ; si la machine ne suit pas, la scène 2D ; sans WebGL, le décor SVG
  const [version, setVersion] = useState<'3d' | '2d'>('3d');
  const repli = useCallback(() => (version === '3d' ? setVersion('2d') : sansWebgl()), [version, sansWebgl]);

  useEffect(() => {
    let vivant = true;
    void listerSauvegardes().then((m) => vivant && setReprise(aReprendre(m)));
    // Dans l'application, le son peut partir sans attendre un clic (la musique de Barad-dûr).
    if (estBureau) moteurSon.debloquer();
    return () => {
      vivant = false;
    };
  }, [fenetre]);

  const continuer = () => {
    if (!reprise) return;
    try {
      lancer(etatDe(reprise));
    } catch {
      setReprise(null);
    }
  };
  const nouvelle = () => (reprise ? setFenetre('confirmer') : nouvellePartie());

  return (
    <div id="titre">
      {webgl ? <SceneTitre key={version} version={version} onEchec={repli} /> : <DecorMordor />}
      <div className="titre-colonne">
        <div className="titre-nom">
          <div className="sur-titre">Acte I · L’Eriador · automne 3018</div>
          <h1>
            L’Œil
            <span>de Barad-dûr</span>
          </h1>
          <div className="filet" />
        </div>
        <nav className="menu-titre" aria-label="Menu principal">
          {reprise && (
            <button onClick={continuer} autoFocus>
              Continuer
              <small>
                Tour {romain(reprise.tour)}
                {reprise.date ? ` · ${reprise.date}` : ''} · {quand(reprise.le)}
              </small>
            </button>
          )}
          <button onClick={nouvelle} autoFocus={!reprise}>
            Nouvelle partie
          </button>
          <button onClick={() => setFenetre('charger')}>Charger</button>
          <button onClick={() => setFenetre('options')}>Options</button>
          <button onClick={() => setFenetre('credits')}>Crédits</button>
          {bureau && <button onClick={() => bureau!.fenetre.quitter()}>Quitter</button>}
        </nav>
        <p className="inscription-fr">{INSCRIPTION_FR}</p>
      </div>
      <div className="titre-pied">F11 · plein écran</div>

      {fenetre === 'options' && <Options onFermer={() => setFenetre(null)} />}
      {fenetre === 'charger' && <Sauvegardes mode="charger" onFermer={() => setFenetre(null)} />}
      {fenetre === 'credits' && <Credits onFermer={() => setFenetre(null)} />}
      {fenetre === 'confirmer' && (
        <div className="modal fenetre-menu" onClick={() => setFenetre(null)}>
          <div className="panel" onClick={(e) => e.stopPropagation()}>
            <div className="ptitle">Nouvelle partie</div>
            <div className="body">
              <p>Une partie est en cours. Elle sera remplacée dans la sauvegarde automatique ; les emplacements I à III ne bougent pas.</p>
            </div>
            <div className="go">
              <button className="btn mini" onClick={() => setFenetre(null)}>
                Annuler
              </button>
              <button className="btn mini danger" onClick={() => nouvellePartie()} autoFocus>
                Commencer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
