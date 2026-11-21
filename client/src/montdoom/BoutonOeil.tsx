/**
 * Cliquer sur l'Œil descend au Mont Destin. Le bouton est posé par-dessus le
 * canevas de l'Œil (qui ne reçoit pas la souris) ; l'écran 3D n'est chargé
 * qu'à la première descente.
 */
import type { ReactNode } from 'react';
import { Component, lazy, Suspense } from 'react';
import { bus } from '../bus';
import { useMontDoom } from './etat';
import './montdoom.css';

const MontDoom = lazy(() => import('./MontDoom'));

export function BoutonOeil() {
  const ouvrir = useMontDoom((s) => s.ouvrir);
  return (
    <button
      id="eye-bouton"
      aria-label="Descendre au Mont Destin"
      title="Descendre au Mont Destin"
      onMouseEnter={() => bus.emit('flare', 0.35)}
      onClick={() => {
        bus.emit('flare', 1);
        ouvrir();
      }}
    />
  );
}

/** Si la scène 3D plante, on le dit et on laisse remonter : la partie continue. */
class Garde extends Component<{ children: ReactNode }, { erreur: boolean }> {
  override state = { erreur: false };
  static getDerivedStateFromError() {
    return { erreur: true };
  }
  override render() {
    if (!this.state.erreur) return this.props.children;
    return (
      <div id="montdoom" className="arrive">
        <div className="sans-webgl">
          <p>Les fumées de l’Orodruin cachent la montagne : la scène n’a pas pu s’afficher.</p>
          <button className="btn mini" onClick={() => useMontDoom.getState().fermer()}>
            Remonter à la Tour
          </button>
        </div>
      </div>
    );
  }
}

export function EcranMontDoom() {
  const ouvert = useMontDoom((s) => s.ouvert);
  if (!ouvert) return null;
  return (
    <Garde>
      <Suspense fallback={<div id="montdoom" className="chargement" />}>
        <MontDoom />
      </Suspense>
    </Garde>
  );
}
