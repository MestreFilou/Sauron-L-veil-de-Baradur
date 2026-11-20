import { cheminRunes } from './carte/bruit';

/** Rangée de runes procédurales façon Cirth (titres des panneaux). */
export function Runes({ n, s }: { n: number; s: number }) {
  const { d, largeur } = cheminRunes(n, s);
  return (
    <span className="runes">
      <svg width={largeur} height={13} viewBox={`0 0 ${largeur} 13`}>
        <path d={d} stroke="currentColor" strokeWidth={1} fill="none" strokeLinecap="round" />
      </svg>
    </span>
  );
}
