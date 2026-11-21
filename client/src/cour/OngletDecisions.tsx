import type { VueJoueur } from '@sauron/engine';
import { REGLES } from '@sauron/engine';
import { useJeu } from '../store';
import { MANQUE, REMPLIE, SCEAU } from './sigles';

type DecisionVue = VueJoueur['decisions'][number];

function Decision({ d }: { d: DecisionVue }) {
  const v = useJeu((s) => s.vue);
  const agir = useJeu((s) => s.agir);
  const j = v.jauges;
  const paOk = d.cout.pa <= j.paRestants;
  const essOk = d.cout.essence <= j.essenceRestante;
  const recharge = REGLES.decisions[d.id].recharge;
  const index = v.ordres.findIndex((o) => o.type === 'decision' && o.decision === d.id);
  const enRecharge = d.possibleAuTour !== null && d.possibleAuTour > v.tour;
  const close = d.possibleAuTour === null;
  const possible = d.disponible && paOk && essOk && v.phase === 'ordres';
  return (
    <article className={`decision ${d.ordonnee ? 'ordonnee' : ''} ${d.disponible ? '' : 'fermee'}`}>
      <header>
        <span className="tok">{SCEAU}</span>
        <h3>{d.nom}</h3>
      </header>
      <p className="desc">{d.description}</p>
      <p className="effet">{d.effet}</p>
      <ul className="conditions">
        {d.conditions.map((c) => (
          <li key={c.texte} className={c.remplie ? 'ok' : 'ko'}>
            {c.remplie ? REMPLIE : MANQUE} {c.texte}
          </li>
        ))}
        <li className={paOk && essOk ? 'ok' : 'ko'}>
          {paOk && essOk ? REMPLIE : MANQUE} Coût : {[d.cout.pa ? `${d.cout.pa} PA` : '', d.cout.essence ? `${d.cout.essence} Essence` : ''].filter(Boolean).join(', ') || 'rien'}
        </li>
      </ul>
      <footer>
        <span className="recharge">
          {close
            ? 'Déjà prise, une fois pour toutes'
            : enRecharge
              ? `Possible à nouveau au tour ${d.possibleAuTour}`
              : recharge === null
                ? 'Une seule fois'
                : `Recharge : ${recharge} tours`}
        </span>
        {d.ordonnee ? (
          <button className="btn mini" onClick={() => agir({ type: 'annuler_ordre', index })}>
            Décidé ce soir · annuler
          </button>
        ) : (
          <button className="project" disabled={!possible} onClick={() => agir({ type: 'ordonner', ordre: { type: 'decision', decision: d.id } })}>
            Décider
          </button>
        )}
      </footer>
    </article>
  );
}

/** Onglet des décisions de la Tour. */
export function OngletDecisions() {
  const v = useJeu((s) => s.vue);
  const ouvertes = v.decisions.filter((d) => d.disponible || d.ordonnee);
  const fermees = v.decisions.filter((d) => !d.disponible && !d.ordonnee);
  return (
    <div className="onglet decisions">
      {v.phase !== 'ordres' && <p className="note bandeau">Les décisions se prennent au crépuscule, avec les ordres du soir. Elles se résolvent à la nuit tombée.</p>}
      <div className="grille">
        {[...ouvertes, ...fermees].map((d) => (
          <Decision key={d.id} d={d} />
        ))}
      </div>
    </div>
  );
}
