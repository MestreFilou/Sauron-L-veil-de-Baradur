/** Salle des Ouvrages : bâtir et améliorer les chantiers du Mont Destin. */
import type { IdOuvrage } from '@sauron/engine';
import { coutOuvrage, niveauMaxOuvrage, OUVRAGES } from '@sauron/engine';
import { useJeu } from '../store';
import { useMontDoom } from './etat';
import { FICHES } from './fiches';

function Ouvrage({ id }: { id: IdOuvrage }) {
  const vue = useJeu((s) => s.vue);
  const etat = useJeu((s) => s.etat);
  const agir = useJeu((s) => s.agir);
  const choisi = useMontDoom((s) => s.ouvrageChoisi === id);
  const survole = useMontDoom((s) => s.ouvrageSurvole === id);
  const choisir = useMontDoom((s) => s.choisirOuvrage);
  const feter = useMontDoom((s) => s.feter);
  const f = FICHES[id];
  const niveau = vue.ouvrages[id];
  const max = niveauMaxOuvrage(id);
  const cout = coutOuvrage(etat, id);
  const essence = vue.jauges.essenceRestante;

  let refus: string | null = null;
  if (cout === null) refus = 'Achevé';
  else if (vue.phase === 'fin') refus = 'L’Acte est terminé';
  else if (vue.chantierCeTour) refus = 'Un chantier par tour';
  else if (cout > essence) refus = `Il manque ${cout - essence} Essence`;

  const batir = () => {
    if (agir({ type: 'batir_ouvrage', ouvrage: id })) feter(id);
  };

  return (
    <li className={`ouvrage${choisi ? ' sel' : ''}${survole ? ' survol' : ''}`} onClick={() => choisir(choisi ? null : id)}>
      <div className="tete">
        <div>
          <div className="nom">{f.nom}</div>
          <div className="lieu">{f.lieu}</div>
        </div>
        <div className="niveaux" aria-label={`Niveau ${niveau} sur ${max}`}>
          {Array.from({ length: max }, (_, i) => (
            <i key={i} className={i < niveau ? 'on' : ''} />
          ))}
        </div>
      </div>
      {choisi && (
        <div className="detail">
          <p className="desc">{f.description}</p>
          <p className="effet">{niveau > 0 ? <>Actuellement : {f.effet(niveau)}.</> : <>Pas encore bâti.</>}</p>
          {cout !== null && <p className="effet suivant">Niveau {niveau + 1} : {f.effet(niveau + 1)}.</p>}
        </div>
      )}
      <div className="pied">
        {cout !== null ? (
          <span className="cout">
            <b>{cout}</b> Essence
          </span>
        ) : (
          <span className="cout acheve">Ouvrage achevé</span>
        )}
        <button
          className="btn mini"
          disabled={refus !== null}
          title={refus ?? undefined}
          onClick={(e) => {
            e.stopPropagation();
            batir();
          }}
        >
          {cout === null ? 'Achevé' : niveau === 0 ? 'Bâtir' : 'Agrandir'}
        </button>
      </div>
      {refus && cout !== null && <div className="refus">{refus}</div>}
    </li>
  );
}

export function PanneauOuvrages() {
  const chantier = useJeu((s) => s.vue.chantierCeTour);
  return (
    <>
      <p className="intro-salle">
        L’Essence se dépense ici en pierre et en feu. {chantier ? 'Le chantier du jour est lancé : les esclaves reprendront demain.' : 'Un seul chantier par tour.'}
      </p>
      <ul className="ouvrages">
        {OUVRAGES.map((id) => (
          <Ouvrage key={id} id={id} />
        ))}
      </ul>
    </>
  );
}
