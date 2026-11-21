/** Le bouton du son, dans la barre du haut, et ses réglages. */
import { useEffect, useRef, useState } from 'react';
import { useReglagesSon, type ReglagesSon } from './reglages';

function Curseur({ nom, cle }: { nom: string; cle: 'general' | 'musique' | 'voix' | 'effets' }) {
  const v = useReglagesSon((s) => s[cle]);
  const regler = useReglagesSon((s) => s.regler);
  return (
    <label className="curseur">
      <span>{nom}</span>
      <input type="range" min={0} max={100} value={Math.round(v * 100)} onChange={(e) => regler({ [cle]: Number(e.target.value) / 100 } as Partial<ReglagesSon>)} />
      <b>{Math.round(v * 100)}</b>
    </label>
  );
}

function Case({ nom, cle }: { nom: string; cle: 'coupe' | 'sousTitres' | 'glose' }) {
  const v = useReglagesSon((s) => s[cle]);
  const regler = useReglagesSon((s) => s.regler);
  return (
    <label className="case">
      <input type="checkbox" checked={v} onChange={(e) => regler({ [cle]: e.target.checked } as Partial<ReglagesSon>)} />
      {nom}
    </label>
  );
}

export function BoutonSon() {
  const coupe = useReglagesSon((s) => s.coupe);
  const [ouvert, setOuvert] = useState(false);
  const boite = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: PointerEvent) => {
      if (!boite.current?.contains(e.target as Node)) setOuvert(false);
    };
    window.addEventListener('pointerdown', dehors);
    return () => window.removeEventListener('pointerdown', dehors);
  }, [ouvert]);

  return (
    <div className="son" ref={boite}>
      <button className={`btn mini${coupe ? ' coupe' : ''}`} title={coupe ? 'Son coupé (M)' : 'Son (M pour couper)'} aria-label="Réglages du son" onClick={() => setOuvert(!ouvert)}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 9h4l5-4v14l-5-4H4z" />
          {coupe ? <path d="M16 9l5 6M21 9l-5 6" className="trait" /> : <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" className="trait" />}
        </svg>
      </button>
      {ouvert && (
        <div className="panel reglages-son">
          <div className="ptitle">Son</div>
          <div className="body">
            <Curseur nom="Général" cle="general" />
            <Curseur nom="Musique" cle="musique" />
            <Curseur nom="Voix" cle="voix" />
            <Curseur nom="Effets" cle="effets" />
            <Case nom="Couper le son (M)" cle="coupe" />
            <Case nom="Sous-titres" cle="sousTitres" />
            <Case nom="Glose du Noir Parler au survol" cle="glose" />
          </div>
        </div>
      )}
    </div>
  );
}
