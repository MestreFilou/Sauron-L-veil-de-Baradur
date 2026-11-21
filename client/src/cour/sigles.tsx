/** Petits sigles vectoriels de la Cour (aucune image externe). */

export const CAPUCHE = (
  <svg viewBox="0 0 16 16">
    <path
      d="M8 1C5 1 3.4 3.6 3.4 6.6 3.4 9 2.6 11.6 1.5 15h13c-1.1-3.4-1.9-6-1.9-8.4C12.6 3.6 11 1 8 1zm0 4.2c1.2 0 2 1 2 2.3 0 .9-.9 1.6-2 1.6s-2-.7-2-1.6c0-1.3.8-2.3 2-2.3z"
      fillRule="evenodd"
    />
  </svg>
);

export const COURONNE = (
  <svg viewBox="0 0 16 16">
    <path d="M2 5l2.5 2L6 2.5 8 6l2-3.5L11.5 7 14 5l-1 4H3zM3.2 10h9.6c-.8 2-1.3 3.6-1.6 5H4.8c-.3-1.4-.8-3-1.6-5z" />
  </svg>
);

/** Barreaux d'une cellule. */
export const BARREAUX = (
  <svg viewBox="0 0 16 16">
    <path d="M2 2h12v1.4H2zM2 12.6h12V14H2zM3.6 3.4h1.3v9.2H3.6zM7.35 3.4h1.3v9.2h-1.3zM11.1 3.4h1.3v9.2h-1.3z" />
  </svg>
);

/** Sceau de la Tour (décisions). */
export const SCEAU = (
  <svg viewBox="0 0 16 16">
    <path
      d="M8 1.2a6.8 6.8 0 1 0 0 13.6A6.8 6.8 0 0 0 8 1.2zm0 1.5a5.3 5.3 0 1 1 0 10.6A5.3 5.3 0 0 1 8 2.7zM8 4.6c-2 0-3.6 1.6-4.2 3.4.6 1.8 2.2 3.4 4.2 3.4s3.6-1.6 4.2-3.4C11.6 6.2 10 4.6 8 4.6zm0 1.7c.5 0 .8.8.8 1.7s-.3 1.7-.8 1.7-.8-.8-.8-1.7.3-1.7.8-1.7z"
      fillRule="evenodd"
    />
  </svg>
);

/** Condition remplie : un trait de rune vertical barré. */
export const REMPLIE = (
  <svg viewBox="0 0 12 12" className="marque ok">
    <path d="M2 6.5l2.6 2.6L10 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

/** Condition manquante. */
export const MANQUE = (
  <svg viewBox="0 0 12 12" className="marque ko">
    <path d="M3 3l6 6M9 3l-6 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
