import type { Ordre } from '@sauron/engine';
import { coutOrdre, REGLES } from '@sauron/engine';
import { CAPUCHE, COURONNE } from '../cour/sigles';
import { Runes } from '../Runes';
import { monde, useJeu } from '../store';

const LIBELLES: Partial<Record<Ordre['type'], string>> = {
  nazgul_deplacer: 'MARCHE',
  nazgul_traque: 'TRAQUE',
  nazgul_embuscade: 'EMBUSCADE',
  nazgul_cri: 'CRI',
  nazgul_interroger: 'INTERROGE',
  nazgul_fleau: 'FLÉAU',
  nazgul_capturer: 'ENLÈVE',
};

/** Les Neuf : où ils sont, leur signal, et leurs ordres du tour. */
export function Neuf() {
  const v = useJeu((s) => s.vue);
  const etat = useJeu((s) => s.etat);
  const choisi = useJeu((s) => s.nazgulChoisi);
  const choisir = useJeu((s) => s.choisirNazgul);
  const agir = useJeu((s) => s.agir);
  const ouvrirCour = useJeu((s) => s.ouvrirCour);
  const nomRegion = (id: string) => monde.regions.get(id)?.nom ?? id;
  const ordres = v.phase === 'ordres';

  return (
    <aside className="panel" id="nine">
      <div className="ptitle">
        Les Neuf
        <span>
          <button className="ouvrir-cour" onClick={() => ouvrirCour('neuf')} title="La Cour de Barad-dûr : missions, cachots, décisions (touche C)">
            La Cour
          </button>{' '}
          <Runes n={4} s={9} />
        </span>
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
                {!siens.length &&
                  (n.mission ? (
                    <span className="post mission" title={`Mission : ${n.mission.libelle}`}>
                      {n.mission.libelle.toUpperCase()}
                    </span>
                  ) : (
                    <span className="post">{n.posture === 'ombre_ailee' ? 'AILÉ' : 'TRAQUE'}</span>
                  ))}
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
                  {pnj
                    .filter((p) => monde.personnages.get(p.id)?.role === 'pnj')
                    .map((p) => {
                      const o: Ordre = { type: 'nazgul_capturer', nazgul: n.id, pnj: p.id };
                      return (
                        <button key={`c-${p.id}`} className="btn mini danger" onClick={() => donner(o)} title="L’emmener aux cachots de la Tour">
                          Enlever {p.nom.split(' ')[0]} · {coutOrdre(etat, o).pa} PA
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
