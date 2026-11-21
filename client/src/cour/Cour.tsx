/**
 * La Cour de Barad-dûr : les menus de gestion (les Neuf et leurs missions, les
 * cachots, les décisions de la Tour).
 *
 * Deux façons de l'afficher :
 * - `<Cour />` : la fenêtre par-dessus la carte, ouverte par `ouvrirCour()` du
 *   store (bouton des Neuf, touche C) et fermée par Échap ;
 * - `<ContenuCour />` : le même contenu sans fenêtre, à intégrer dans un autre
 *   écran (l'écran du Mont Destin, par exemple). Chaque onglet existe aussi seul :
 *   `OngletNeuf`, `OngletCachots`, `OngletDecisions`.
 *
 * Tout passe par le moteur : chaque geste devient une Action (`affecter`,
 * `ordonner`, `annuler_ordre`), et l'affichage ne lit que la vue du joueur.
 */
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Runes } from '../Runes';
import type { OngletCour } from '../store';
import { useJeu } from '../store';
import './cour.css';
import { OngletCachots } from './OngletCachots';
import { OngletDecisions } from './OngletDecisions';
import { OngletNeuf } from './OngletNeuf';
import { BARREAUX, CAPUCHE, SCEAU } from './sigles';

export { OngletCachots, OngletDecisions, OngletNeuf };

const ONGLETS: { id: OngletCour; nom: string; sigle: ReactNode }[] = [
  { id: 'neuf', nom: 'Les Neuf', sigle: CAPUCHE },
  { id: 'cachots', nom: 'Les Cachots', sigle: BARREAUX },
  { id: 'decisions', nom: 'Les Décisions', sigle: SCEAU },
];

export function ContenuCour({ onglet, choisirOnglet, onFermer }: { onglet: OngletCour; choisirOnglet: (o: OngletCour) => void; onFermer?: () => void }) {
  const v = useJeu((s) => s.vue);
  const compte: Record<OngletCour, string> = {
    neuf: `${v.nazgul.filter((n) => n.disponible).length}/${v.nazgul.length}`,
    cachots: String(v.captifs.length),
    decisions: String(v.decisions.filter((d) => d.disponible).length),
  };
  return (
    <div className="cour">
      <header className="cour-tete">
        <div className="titre">
          <h2>La Cour de Barad-dûr</h2>
          <Runes n={7} s={41} />
        </div>
        <nav>
          {ONGLETS.map((o) => (
            <button key={o.id} className={o.id === onglet ? 'on' : ''} onClick={() => choisirOnglet(o.id)}>
              <span className="sigle">{o.sigle}</span>
              {o.nom}
              <small>{compte[o.id]}</small>
            </button>
          ))}
        </nav>
        <div className="bourse">
          PA <b>{v.jauges.paRestants}</b> · Ess. <b>{v.jauges.essenceRestante}</b>
          {onFermer && (
            <button className="fermer" title="Fermer (Échap)" onClick={onFermer}>
              ✕
            </button>
          )}
        </div>
      </header>
      {onglet === 'neuf' && <OngletNeuf />}
      {onglet === 'cachots' && <OngletCachots />}
      {onglet === 'decisions' && <OngletDecisions />}
    </div>
  );
}

/** La Cour en fenêtre, par-dessus la carte. */
export function Cour() {
  const onglet = useJeu((s) => s.cour);
  const ouvrir = useJeu((s) => s.ouvrirCour);
  const fermer = useJeu((s) => s.fermerCour);

  useEffect(() => {
    const clavier = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.tagName === 'INPUT') return;
      const j = useJeu.getState();
      if (e.key === 'Escape' && j.cour) j.fermerCour();
      else if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (j.cour) j.fermerCour();
        else j.ouvrirCour();
      }
    };
    window.addEventListener('keydown', clavier);
    return () => window.removeEventListener('keydown', clavier);
  }, []);

  if (!onglet) return null;
  return (
    <div className="modal cour-fond" onClick={fermer}>
      <div className="panel cour-fenetre" onClick={(e) => e.stopPropagation()}>
        <ContenuCour onglet={onglet} choisirOnglet={ouvrir} onFermer={fermer} />
      </div>
    </div>
  );
}
