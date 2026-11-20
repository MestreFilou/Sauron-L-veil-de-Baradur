import type { Ordre } from '@sauron/engine';
import { coutOrdre, REGLES } from '@sauron/engine';
import { Runes } from '../Runes';
import { monde, useJeu } from '../store';

const CAPUCHE = (
  <svg viewBox="0 0 16 16">
    <path
      d="M8 1C5 1 3.4 3.6 3.4 6.6 3.4 9 2.6 11.6 1.5 15h13c-1.1-3.4-1.9-6-1.9-8.4C12.6 3.6 11 1 8 1zm0 4.2c1.2 0 2 1 2 2.3 0 .9-.9 1.6-2 1.6s-2-.7-2-1.6c0-1.3.8-2.3 2-2.3z"
      fillRule="evenodd"
    />
  </svg>
);
const COURONNE = (
  <svg viewBox="0 0 16 16">
    <path d="M2 5l2.5 2L6 2.5 8 6l2-3.5L11.5 7 14 5l-1 4H3zM3.2 10h9.6c-.8 2-1.3 3.6-1.6 5H4.8c-.3-1.4-.8-3-1.6-5z" />
  </svg>
);

const LIBELLES: Partial<Record<Ordre['type'], string>> = {
  nazgul_deplacer: 'MARCHE',
  nazgul_traque: 'TRAQUE',
  nazgul_embuscade: 'EMBUSCADE',
  nazgul_cri: 'CRI',
  nazgul_interroger: 'INTERROGE',
  nazgul_fleau: 'FLÉAU',
};

/** Les Neuf : où ils sont, leur signal, et leurs ordres du tour. */
export function Neuf() {
  const v = useJeu((s) => s.vue);
  const etat = useJeu((s) => s.etat);
  const choisi = useJeu((s) => s.nazgulChoisi);
  const choisir = useJeu((s) => s.choisirNazgul);
  const agir = useJeu((s) => s.agir);
  const nomRegion = (id: string) => monde.regions.get(id)?.nom ?? id;
  const ordres = v.phase === 'ordres';

  return (
    <aside className="panel" id="nine">
      <div className="ptitle">
        Les Neuf <Runes n={6} s={9} />
      </div>
      <ul>
        {v.nazgul.map((n) => {
          const siens = v.ordres.filter((o) => 'nazgul' in o && o.nazgul === n.id);
          const sel = n.id === choisi;
          const donner = (ordre: Ordre) => agir({ type: 'ordonner', ordre });
          // PNJ que ce Nazgûl peut interroger : ceux que Sauron sait présents dans sa région
          const pnj = v.personnages.filter((p) => !p.heros && p.position?.region === n.region);
          return (
            <li
              key={n.id}
              className={`${sel ? 'sel' : ''} ${n.disponible ? '' : 'absent'}`}
              onClick={() => n.disponible && choisir(sel ? null : n.id)}
            >
              <span className="tok">{n.roiSorcier ? COURONNE : CAPUCHE}</span>
              <div className="nm">
                {n.nom}
                {siens.map((o, i) => (
                  <span key={i} className={`post ordre ${o.type === 'nazgul_fleau' ? 'fleau' : ''}`}>
                    {LIBELLES[o.type]}
                  </span>
                ))}
                {!siens.length && <span className="post">{n.posture === 'ombre_ailee' ? 'AILÉ' : 'TRAQUE'}</span>}
                <small>
                  {n.disponible ? nomRegion(n.region) : 'sur la route du Sud'}
                  {n.titre ? ` · ${n.titre}` : ''}
                  {n.isole && n.disponible ? (
                    <>
                      {' · '}
                      <span className="warn">signal faible, n’entend qu’un tour sur deux</span>
                    </>
                  ) : null}
                </small>
              </div>
              <span className={`sig ${n.signal < 2 ? 'weak' : ''}`}>
                {[1, 2, 3, 4].map((k) => (
                  <b key={k} className={k <= n.signal ? 'on' : ''} />
                ))}
              </span>
              {sel && ordres && (
                <div className="actions" onClick={(e) => e.stopPropagation()}>
                  <button className="btn mini" onClick={() => donner({ type: 'nazgul_traque', nazgul: n.id })}>
                    Traquer · {REGLES.nazgul.traque.pa} PA
                  </button>
                  <button className="btn mini" onClick={() => donner({ type: 'nazgul_embuscade', nazgul: n.id })}>
                    Embuscade · {REGLES.nazgul.embuscade.pa} PA
                  </button>
                  <button className="btn mini" onClick={() => donner({ type: 'nazgul_cri', nazgul: n.id })}>
                    Cri · 0 PA
                  </button>
                  {pnj.map((p) => {
                    const o: Ordre = { type: 'nazgul_interroger', nazgul: n.id, pnj: p.id };
                    return (
                      <button key={p.id} className="btn mini" onClick={() => donner(o)}>
                        Interroger {p.nom.split(' ')[0]} · {coutOrdre(etat, o).pa} PA
                      </button>
                    );
                  })}
                  <p className="hint">
                    <kbd>Clic</kbd> sur la carte : y marcher (gratuit, {n.posture === 'ombre_ailee' ? REGLES.nazgul.vitesseOmbreAilee : REGLES.nazgul.vitesseTraque} jours de route par tour).
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
