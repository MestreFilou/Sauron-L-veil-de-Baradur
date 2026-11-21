/**
 * L'écran titre : Barad-dûr sur le rougeoiement du Mordor, l'Œil entre les
 * cornes de la Tour, et le menu. Le fond est le rendu 3D de la Tour
 * (artworks/3d/) ; s'il manque, la scène WebGL, puis le décor SVG.
 * La musique de Barad-dûr joue si une piste est installée
 * (audio/musique/pistes.json).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Oeil } from '../Oeil';
import { aReprendre, etatDe, listerSauvegardes, quand, type Enveloppe } from '../partie/sauvegardes';
import { romain } from '../panneaux/Haut';
import { bureau, estBureau } from '../plateforme';
import { moteurSon } from '../son/moteur';
import { useJeu } from '../store';
import { FOND_TITRE } from './artworks';
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

/**
 * La fente de l'Œil de la Tour, dessinée par-dessus le rendu (rendu sans
 * pupille) : elle glisse dans l'iris vers la souris, et s'amincit quand on
 * s'approche.
 */
function PupilleTitre() {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const el = ref.current!;
    const cible = { x: -1, y: -1 };
    const pos = { x: 0, y: 0, l: 1 };
    let raf = 0,
      dernier = performance.now();
    const bouge = (e: PointerEvent) => {
      cible.x = e.clientX;
      cible.y = e.clientY;
    };
    const image = (t: number) => {
      const dt = Math.min(50, t - dernier);
      dernier = t;
      const r = el.getBoundingClientRect(),
        cx = r.left + r.width / 2,
        cy = r.top + r.height / 2;
      let vx = 0,
        vy = 0,
        largeur = 1;
      if (cible.x >= 0) {
        const dx = cible.x - cx,
          dy = cible.y - cy,
          d = Math.hypot(dx, dy),
          k = Math.min(1, d / 600);
        vx = (dx / (d || 1)) * k;
        vy = (dy / (d || 1)) * k;
        largeur = 0.7 + 0.5 * Math.min(1, d / 400); // plus fine quand la souris approche
      }
      const a = Math.min(1, dt * 0.006);
      pos.x += (vx - pos.x) * a;
      pos.y += (vy - pos.y) * a;
      pos.l += (largeur - pos.l) * a;
      el.style.transform = `translate(calc(-50% + ${pos.x * 0.75}vh), calc(-50% + ${pos.y * 0.45}vh)) scaleX(${pos.l})`;
      raf = requestAnimationFrame(image);
    };
    window.addEventListener('pointermove', bouge);
    raf = requestAnimationFrame(image);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', bouge);
    };
  }, []);
  return (
    <svg ref={ref} className="pupille-titre" viewBox="-10 -100 20 200" preserveAspectRatio="none">
      <path d="M0,-100 Q9,0 0,100 Q-9,0 0,-100 Z" />
    </svg>
  );
}

/** Le rendu 3D en plein écran, qui dérive lentement ; l'Œil y palpite et des braises montent. */
function FondTitre({ url, pupille, onErreur }: { url: string; pupille: boolean; onErreur: () => void }) {
  const [vu, setVu] = useState(false);
  return (
    <div className="fond-titre" aria-hidden="true">
      <div className="fond-titre-image">
        <img src={url} alt="" className={vu ? 'vu' : ''} onLoad={() => setVu(true)} onError={onErreur} />
        <div className="lueur-oeil" />
        {pupille && vu && <PupilleTitre />}
      </div>
      <Braises n={26} />
      <div className="fond-titre-voile" />
    </div>
  );
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
  const [rendu, setRendu] = useState(FOND_TITRE !== null);

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
      {rendu && FOND_TITRE ? (
        <FondTitre url={FOND_TITRE.url} pupille={FOND_TITRE.pupille} onErreur={() => setRendu(false)} />
      ) : webgl ? (
        <SceneTitre key={version} version={version} onEchec={repli} />
      ) : (
        <DecorMordor />
      )}
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
