/**
 * Les fenêtres partagées par l'écran titre et le menu de pause : options,
 * sauvegardes (charger, sauvegarder), crédits.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Runes } from '../Runes';
import { Case, Curseur } from '../son/Reglages';
import { basculerPleinEcran, bureau, estPleinEcran } from '../plateforme';
import {
  AUTO,
  EMPLACEMENTS,
  ecrireSauvegarde,
  effacerSauvegarde,
  etatDe,
  listerSauvegardes,
  nomEmplacement,
  quand,
  resumer,
  type Enveloppe,
} from '../partie/sauvegardes';
import { romain } from '../panneaux/Haut';
import { useJeu } from '../store';
import { ARTWORKS } from './artworks';

export function Fenetre({ titre, runes = 6, onFermer, children, className = '' }: { titre: string; runes?: number; onFermer: () => void; children: ReactNode; className?: string }) {
  useEffect(() => {
    const clavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onFermer();
      }
    };
    window.addEventListener('keydown', clavier, true);
    return () => window.removeEventListener('keydown', clavier, true);
  }, [onFermer]);
  return (
    <div className="modal fenetre-menu" onClick={onFermer}>
      <div className={`panel ${className}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={titre}>
        <div className="ptitle">
          {titre} <Runes n={runes} s={titre.length * 7} />
        </div>
        <div className="body">{children}</div>
        <div className="go">
          <button className="btn mini" onClick={onFermer}>
            Retour
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function Options({ onFermer }: { onFermer: () => void }) {
  const [plein, setPlein] = useState(false);
  useEffect(() => {
    let vivant = true;
    const lire = () => void estPleinEcran().then((v) => vivant && setPlein(v));
    lire();
    // Le plein écran change aussi par F11 ou par Échap (navigateur).
    window.addEventListener('resize', lire);
    return () => {
      vivant = false;
      window.removeEventListener('resize', lire);
    };
  }, []);
  return (
    <Fenetre titre="Options" onFermer={onFermer} className="options">
      <div className="reglages-son options-corps">
        <div className="section">Son</div>
        <Curseur nom="Général" cle="general" />
        <Curseur nom="Musique" cle="musique" />
        <Curseur nom="Voix" cle="voix" />
        <Curseur nom="Effets" cle="effets" />
        <Case nom="Couper le son (M)" cle="coupe" />
        <div className="section">Lecture</div>
        <Case nom="Sous-titres" cle="sousTitres" />
        <Case nom="Glose du Noir Parler au survol" cle="glose" />
        <div className="section">Affichage</div>
        <label className="case">
          <input
            type="checkbox"
            checked={plein}
            onChange={(e) => {
              const v = e.target.checked;
              setPlein(v);
              void basculerPleinEcran(v);
            }}
          />
          Plein écran (F11)
        </label>
        {bureau && (
          <>
            <div className="section">Sauvegardes</div>
            <button className="btn mini lien" onClick={() => void bureau!.sauvegardes.ouvrirDossier()}>
              Ouvrir le dossier des sauvegardes
            </button>
          </>
        )}
      </div>
    </Fenetre>
  );
}

/* ------------------------------------------------------------------ */

function Emplacement({ id, env, mode, occupe, onCharger, onEcrire, onEffacer }: {
  id: string;
  env: Enveloppe | undefined;
  mode: 'charger' | 'sauvegarder';
  occupe: boolean;
  onCharger(e: Enveloppe): void;
  onEcrire(id: string): void;
  onEffacer(id: string): void;
}) {
  const [confirmer, setConfirmer] = useState<'ecraser' | 'effacer' | null>(null);
  const r = env ? resumer(env) : null;
  const ecrivable = mode === 'sauvegarder' && id !== AUTO;
  return (
    <li className={`emplacement${env ? '' : ' vide'}`}>
      <div className="quoi">
        <span className="nom">{nomEmplacement(id)}</span>
        {r ? (
          <span className="detail">
            Tour <b>{romain(r.tour)}</b>
            {r.date ? ` · ${r.date}` : ''}
            {r.finie ? ' · acte terminé' : ''}
            <em>{quand(r.le)}</em>
          </span>
        ) : (
          <span className="detail">
            <em>vide</em>
          </span>
        )}
      </div>
      <div className="gestes">
        {confirmer ? (
          <>
            <span className="question">{confirmer === 'ecraser' ? 'Remplacer ?' : 'Effacer ?'}</span>
            <button
              className="btn mini danger"
              disabled={occupe}
              onClick={() => {
                setConfirmer(null);
                if (confirmer === 'ecraser') onEcrire(id);
                else onEffacer(id);
              }}
            >
              Oui
            </button>
            <button className="btn mini" onClick={() => setConfirmer(null)}>
              Non
            </button>
          </>
        ) : (
          <>
            {mode === 'charger' && env && (
              <button className="btn mini" disabled={occupe} onClick={() => onCharger(env)}>
                Charger
              </button>
            )}
            {ecrivable && (
              <button className="btn mini" disabled={occupe} onClick={() => (env ? setConfirmer('ecraser') : onEcrire(id))}>
                Sauvegarder ici
              </button>
            )}
            {env && id !== AUTO && (
              <button className="btn mini" disabled={occupe} onClick={() => setConfirmer('effacer')} title="Effacer cette sauvegarde">
                ✕
              </button>
            )}
          </>
        )}
      </div>
    </li>
  );
}

/** Liste des emplacements. En mode « sauvegarder », on écrit la partie en cours ; en mode « charger », on la remplace. */
export function Sauvegardes({ mode, onFermer, onCharge }: { mode: 'charger' | 'sauvegarder'; onFermer: () => void; onCharge?: () => void }) {
  const [liste, setListe] = useState<Map<string, Enveloppe> | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const lancer = useJeu((s) => s.lancer);

  const relire = () => void listerSauvegardes().then(setListe);
  useEffect(relire, []);

  const charger = (env: Enveloppe) => {
    try {
      lancer(etatDe(env));
      onCharge?.();
    } catch (e) {
      setMessage(`Cette sauvegarde ne se relit pas : ${(e as Error).message}`);
    }
  };
  const ecrire = async (id: string) => {
    setOccupe(true);
    try {
      const { etat, vue } = useJeu.getState();
      await ecrireSauvegarde(id, etat, vue.date);
      setMessage(`Partie sauvegardée : ${nomEmplacement(id)}.`);
    } catch (e) {
      setMessage(`La sauvegarde a échoué : ${(e as Error).message}`);
    }
    setOccupe(false);
    relire();
  };
  const effacer = async (id: string) => {
    setOccupe(true);
    try {
      await effacerSauvegarde(id);
    } catch {
      /* déjà absente */
    }
    setOccupe(false);
    relire();
  };

  return (
    <Fenetre titre={mode === 'charger' ? 'Charger une partie' : 'Sauvegarder'} onFermer={onFermer} className="sauvegardes">
      {liste === null ? (
        <p className="vide">Les archives de la Tour s’ouvrent…</p>
      ) : (
        <ul className="emplacements">
          {[AUTO, ...EMPLACEMENTS].map((id) => (
            <Emplacement key={id} id={id} env={liste.get(id)} mode={mode} occupe={occupe} onCharger={charger} onEcrire={(i) => void ecrire(i)} onEffacer={(i) => void effacer(i)} />
          ))}
        </ul>
      )}
      {message && <p className="message">{message}</p>}
      {mode === 'sauvegarder' && <p className="note">La sauvegarde automatique se met à jour après chaque geste.</p>}
    </Fenetre>
  );
}

/* ------------------------------------------------------------------ */

export function Credits({ onFermer }: { onFermer: () => void }) {
  return (
    <Fenetre titre="Crédits" onFermer={onFermer} className="credits">
      <p>
        <b>L’Œil de Barad-dûr</b>, un jeu de Lucas, d’après l’Eriador de J. R. R. Tolkien. Projet personnel, sans but commercial.
      </p>
      <div className="section">Écrans de chargement</div>
      {ARTWORKS.length ? (
        <ul>
          {ARTWORKS.map((a) => (
            <li key={a.fichier}>
              <i>{a.titre ?? a.fichier}</i>
              {' · '}
              {a.artiste ?? 'artiste inconnu'}
              {a.licence ? <span className="licence"> · {a.licence}</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="vide">Aucune image dans le dossier artworks/ : la Tour est dessinée par le jeu.</p>
      )}
      <div className="section">Polices</div>
      <p>Uncial Antiqua (Astigmatic), Almendra (Ana Sanfelippo), Fondamento (Astigmatic), sous licence SIL Open Font License. Noir Parler, écriture dessinée pour le jeu, dans le domaine public (CC0).</p>
      <div className="section">Voix et musique</div>
      <p>Voix de Sauron : Lucas, traitées par la chaîne « légion ». Musique et effets : six pistes originales et des bruitages créés par synthèse pour le jeu (audio/musique/libre/, audio/effets/), auxquels le joueur peut ajouter ses propres pistes dans audio/musique/, pour un usage privé.</p>
    </Fenetre>
  );
}
