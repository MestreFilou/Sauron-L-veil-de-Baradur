/**
 * Barad-dûr en silhouette, à l'encre noire sur le rougeoiement du Mordor :
 * une flèche centrale entre deux cornes, des étages en gradins, quelques
 * meurtrières qui rougeoient. Dessinée en SVG (un demi-profil, mis en miroir).
 */

/** Demi-profil droit, du sommet de la flèche à la base (x : écart au centre, y : hauteur). Repère 400 × 600. */
const PROFIL: [number, number][] = [
  [0, 46], [5, 104], [12, 112], [15, 168],
  // la corne, qui s'écarte en croissant pour tenir l'Œil
  [36, 160], [72, 132], [108, 86], [130, 38], [138, 2], [144, 44], [136, 104], [108, 156], [72, 190], [46, 206],
  // les étages
  [46, 226], [56, 232], [54, 296], [68, 302], [64, 372], [84, 380], [80, 452], [108, 462], [104, 520],
  [132, 530], [150, 556], [200, 600],
];

function chemin(): string {
  const droite = PROFIL.map(([x, y]) => `${(200 + x).toFixed(1)},${y}`);
  const gauche = [...PROFIL].reverse().map(([x, y]) => `${(200 - x).toFixed(1)},${y}`);
  return `M${droite.join(' L')} L${gauche.join(' L')} Z`;
}

/** Meurtrières : [x, y, hauteur]. */
const FENETRES: [number, number, number][] = [
  [0, 140, 9], [-8, 250, 7], [10, 262, 6], [0, 330, 8], [-30, 410, 6], [22, 420, 7], [-12, 486, 6], [48, 498, 5], [-60, 506, 5],
];

export function Tour({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 400 600" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      <defs>
        <linearGradient id="tour-encre" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#170d0a" />
          <stop offset=".45" stopColor="#070404" />
          <stop offset="1" stopColor="#0c0606" />
        </linearGradient>
        <linearGradient id="tour-lisiere" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff5a1f" stopOpacity=".55" />
          <stop offset=".5" stopColor="#8a1c0c" stopOpacity=".35" />
          <stop offset="1" stopColor="#8a1c0c" stopOpacity="0" />
        </linearGradient>
        <filter id="tour-lueur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>
      <path d={chemin()} fill="url(#tour-encre)" stroke="url(#tour-lisiere)" strokeWidth="1.2" />
      <g fill="#ff6e28">
        {FENETRES.map(([x, y, h], i) => (
          <g key={i} className="meurtriere" style={{ animationDelay: `${(i * 0.73) % 4}s` }}>
            <rect x={200 + x - 1.6} y={y} width={3.2} height={h} rx={1.2} filter="url(#tour-lueur)" opacity=".9" />
            <rect x={200 + x - 0.8} y={y + 1} width={1.6} height={h - 2} rx={0.8} fill="#ffd08a" />
          </g>
        ))}
      </g>
    </svg>
  );
}

/** L'inscription de l'Anneau, en Noir Parler translittéré : décorative, la traduction s'affiche en dessous. */
export const INSCRIPTION = 'Ash nazg durbatulûk · ash nazg gimbatul · ash nazg thrakatulûk · agh burzum-ishi krimpatul ·';
export const INSCRIPTION_FR = 'Un Anneau pour les gouverner tous, un Anneau pour les trouver, un Anneau pour les amener tous et dans les ténèbres les lier.';

/**
 * L'inscription en anneau de feu autour de l'Œil : un cercle de texte qui
 * tourne lentement, aplati par CSS pour qu'on le voie en perspective.
 */
export function AnneauDeFeu({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="-300 -300 600 600" aria-hidden="true">
      <defs>
        <path id="anneau-cercle" d="M0,-250 A250,250 0 1,1 -0.1,-250 Z" />
        <filter id="anneau-feu" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="flou" />
          <feMerge>
            <feMergeNode in="flou" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g className="anneau-tourne">
        <text filter="url(#anneau-feu)" fontFamily="'IM Fell English', serif" fontStyle="italic" fontSize="31" fill="#ff8a3c" letterSpacing="1.5" textLength={1560} lengthAdjust="spacing">
          <textPath href="#anneau-cercle">{INSCRIPTION}</textPath>
        </text>
      </g>
    </svg>
  );
}
