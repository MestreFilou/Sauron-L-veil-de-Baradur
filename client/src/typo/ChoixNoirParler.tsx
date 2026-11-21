import { useEffect, useRef, useState } from 'react';
import { MODES, choisirMode, ecouterMode, modeNoirParler } from './noirParler';

/** Bouton de la barre du haut : quand l'écriture passe-t-elle des runes au clair ? */
export function ChoixNoirParler() {
  const [mode, setMode] = useState(modeNoirParler);
  const [ouvert, setOuvert] = useState(false);
  const boite = useRef<HTMLDivElement>(null);

  useEffect(() => ecouterMode(setMode), []);
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: PointerEvent) => {
      if (!boite.current?.contains(e.target as Node)) setOuvert(false);
    };
    window.addEventListener('pointerdown', dehors);
    return () => window.removeEventListener('pointerdown', dehors);
  }, [ouvert]);

  return (
    <div className="np-choix" ref={boite} data-np-off>
      <button className="btn mini" title="Écriture : runes du Noir Parler ou clair" aria-label="Écriture du Noir Parler" onClick={() => setOuvert(!ouvert)}>
        {/* deux runes de la police du jeu */}
        nr
      </button>
      {ouvert && (
        <div className="panel np-menu">
          <div className="ptitle">Écriture</div>
          <div className="body">
            {MODES.map((m) => (
              <button key={m.id} className={mode === m.id ? 'on' : ''} onClick={() => choisirMode(m.id)}>
                <b>{m.nom}</b>
                <span>{m.aide}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
