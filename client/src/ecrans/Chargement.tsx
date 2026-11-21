/**
 * L'écran de chargement : un artwork dans son cadre, un murmure, un conseil,
 * et une ligne de braise qui avance pendant que la carte se prépare derrière
 * (le parchemin se cuit au montage de la scène PixiJS). Quand tout est prêt,
 * un clic ou une touche fait entrer dans la partie.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Runes } from '../Runes';
import { useJeu } from '../store';
import { artworkSuivant } from './artworks';
import { CONSEILS, MURMURES, tirer } from './murmures';
import { DecorMordor } from './Titre';

/** Le temps minimum, pour qu'on ait le temps de lire le murmure. */
const DUREE_MIN_MS = 3200;

let dernierMurmure: (typeof MURMURES)[number] | null = null;
let dernierConseil: string | null = null;

export function Chargement() {
  const cartePrete = useJeu((s) => s.cartePrete);
  const entrer = useJeu((s) => s.entrer);
  const tour = useJeu((s) => s.vue.tour);
  const [minimum, setMinimum] = useState(false);
  const [image, setImage] = useState<'attente' | 'ok' | 'erreur'>('attente');
  const debut = useRef(performance.now());

  const { art, murmure, conseil } = useMemo(() => {
    const m = tirer(MURMURES, dernierMurmure);
    const c = tirer(CONSEILS, dernierConseil);
    dernierMurmure = m;
    dernierConseil = c;
    return { art: artworkSuivant(), murmure: m, conseil: c };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setMinimum(true), DUREE_MIN_MS);
    return () => clearTimeout(t);
  }, []);

  const pret = cartePrete && minimum && image !== 'attente';

  useEffect(() => {
    if (!pret) return;
    const go = (e: KeyboardEvent | PointerEvent) => {
      if (e instanceof KeyboardEvent && ['Shift', 'Control', 'Alt', 'Meta', 'F11', 'F12'].includes(e.key)) return;
      entrer();
    };
    window.addEventListener('keydown', go);
    window.addEventListener('pointerdown', go);
    return () => {
      window.removeEventListener('keydown', go);
      window.removeEventListener('pointerdown', go);
    };
  }, [pret, entrer]);

  // Sans artwork (dossier vide), on passe directement au décor dessiné.
  useEffect(() => {
    if (!art) setImage('erreur');
  }, [art]);

  const avecImage = art && image !== 'erreur';
  const legende = art && (art.titre || art.artiste) ? [art.titre, art.artiste].filter(Boolean).join(' · ') : null;

  return (
    <div id="chargement" className={pret ? 'pret' : ''} style={{ ['--duree' as string]: `${DUREE_MIN_MS}ms` }}>
      {avecImage ? (
        <div className="fond-art" style={{ backgroundImage: `url("${art.url}")` }} aria-hidden="true" />
      ) : (
        <DecorMordor avecOeil={false} />
      )}
      <div className="voile" aria-hidden="true" />

      <div className="chargement-scene">
        {avecImage && (
          <figure className="cadre-art">
            <img
              src={art.url}
              alt={art.titre ?? ''}
              style={{ objectPosition: art.cadrage }}
              onLoad={() => setImage('ok')}
              onError={() => setImage('erreur')}
              className={image === 'ok' ? 'vu' : ''}
            />
            {legende && <figcaption>{legende}</figcaption>}
          </figure>
        )}
        <div className="chargement-texte">
          <div className="ptitle-libre">
            {tour > 1 ? 'La partie reprend' : 'Acte I · l’Eriador'} <Runes n={7} s={tour * 13 + 3} />
          </div>
          <blockquote>
            <p>« {murmure.texte} »</p>
            <cite>{murmure.source}</cite>
          </blockquote>
          <p className="conseil">
            <span>Conseil</span>
            {conseil}
          </p>
        </div>
      </div>

      <div className="chargement-pied">
        <div className="etat">{pret ? 'Cliquer ou appuyer sur une touche pour entrer' : cartePrete ? 'Le Regard s’ouvre…' : 'Les espions de la Tour relèvent la carte…'}</div>
        <div className="ligne-braise">
          <i style={{ animationDuration: `${Math.max(DUREE_MIN_MS - (performance.now() - debut.current), 0)}ms` }} />
        </div>
      </div>
    </div>
  );
}
