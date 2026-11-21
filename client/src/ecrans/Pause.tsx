/**
 * Le menu de pause (Échap pendant la partie) : reprendre, sauvegarder,
 * charger, options, retour au menu principal, quitter.
 */
import { useEffect, useState } from 'react';
import { Runes } from '../Runes';
import { bureau } from '../plateforme';
import { useJeu } from '../store';
import { Options, Sauvegardes } from './Menus';

type Sous = 'sauvegarder' | 'charger' | 'options' | null;

export function Pause() {
  const pause = useJeu((s) => s.pause);
  const setPause = useJeu((s) => s.setPause);
  const retourAuTitre = useJeu((s) => s.retourAuTitre);
  const [sous, setSous] = useState<Sous>(null);

  // Échap : on désélectionne d’abord (région, Nazgûl) ou on ferme la Cour, puis on ouvre ou ferme le menu.
  useEffect(() => {
    const clavier = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || sous) return;
      const j = useJeu.getState();
      if (j.ecran !== 'jeu') return;
      if (!j.pause && (j.regionChoisie || j.nazgulChoisi || j.duel || j.cour || !j.introVue)) return;
      const t = e.target as HTMLElement;
      if (!j.pause && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT') && (t as HTMLInputElement).value) return;
      e.stopImmediatePropagation();
      setPause(!j.pause);
    };
    window.addEventListener('keydown', clavier, true);
    return () => window.removeEventListener('keydown', clavier, true);
  }, [sous, setPause]);

  useEffect(() => {
    if (!pause) setSous(null);
  }, [pause]);

  if (!pause) return null;
  return (
    <>
      <div className="modal pause" onClick={() => setPause(false)}>
        <div className="panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Pause">
          <div className="ptitle">
            La Tour veille <Runes n={6} s={41} />
          </div>
          <nav className="menu-pause">
            <button className="btn" onClick={() => setPause(false)} autoFocus>
              Reprendre
            </button>
            <button className="btn" onClick={() => setSous('sauvegarder')}>
              Sauvegarder
            </button>
            <button className="btn" onClick={() => setSous('charger')}>
              Charger
            </button>
            <button className="btn" onClick={() => setSous('options')}>
              Options
            </button>
            <button className="btn" onClick={retourAuTitre}>
              Menu principal
            </button>
            {bureau && (
              <button className="btn" onClick={() => bureau!.fenetre.quitter()}>
                Quitter le jeu
              </button>
            )}
          </nav>
          <p className="hint">La partie est sauvegardée automatiquement après chaque geste.</p>
        </div>
      </div>
      {sous === 'options' && <Options onFermer={() => setSous(null)} />}
      {sous === 'sauvegarder' && <Sauvegardes mode="sauvegarder" onFermer={() => setSous(null)} />}
      {sous === 'charger' && <Sauvegardes mode="charger" onFermer={() => setSous(null)} onCharge={() => setSous(null)} />}
    </>
  );
}
