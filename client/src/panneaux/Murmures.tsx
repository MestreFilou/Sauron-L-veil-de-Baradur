import type { Classement } from '@sauron/engine';
import { useState } from 'react';
import { hash2 } from '../carte/bruit';
import { Runes } from '../Runes';
import { cleEvenement, monde, useJeu } from '../store';

/** Un murmure peu fiable s'efface : lettres pâlies, mots noyés d'encre (direction artistique, 3). */
function Erode({ texte, fiabilite, cle }: { texte: string; fiabilite: number; cle: number }) {
  return (
    <>
      {texte.split(' ').map((mot, wi) => {
        const sep = wi ? ' ' : '';
        if (hash2(wi, cle * 97) > fiabilite + 0.58 && mot.length > 3)
          return (
            <span key={wi}>
              {sep}
              <span className="blot">{mot}</span>
            </span>
          );
        return (
          <span key={wi}>
            {sep}
            {[...mot].map((ch, ci) => {
              const h = hash2(wi * 31 + ci, cle * 131 + 7);
              const cls = h > fiabilite + 0.36 ? 'g' : h > fiabilite + 0.08 ? 'f' : undefined;
              return cls ? (
                <span key={ci} className={cls}>
                  {ch}
                </span>
              ) : (
                ch
              );
            })}
          </span>
        );
      })}
    </>
  );
}

const CLASSES: [Classement, string][] = [
  ['vrai', 'Vrai'],
  ['incertain', 'Incertain'],
  ['faux', 'Faux'],
];

export function Murmures() {
  const v = useJeu((s) => s.vue);
  const textes = useJeu((s) => s.textes);
  const etat = useJeu((s) => s.etat);
  const reactions = useJeu((s) => s.reactions);
  // La Chronique : les événements publics, du plus récent au plus ancien (ce tour, puis le Journal).
  const chronique = [...etat.journal.flatMap((j) => j.evenements), ...etat.evenements]
    .filter((e) => e.public && e.type !== 'murmures')
    .reverse()
    .slice(0, 80);
  const agir = useJeu((s) => s.agir);
  const survoler = useJeu((s) => s.survolerMurmure);
  const vise = useJeu((s) => s.murmureSurvole);
  const [onglet, setOnglet] = useState<'murmures' | 'chronique'>('murmures');
  const liste = v.murmures.filter((m) => m.tour >= v.tour - 1).sort((a, b) => b.tour - a.tour || b.fiabilite - a.fiabilite);
  const p = v.piste;
  const nomRegion = (id: string) => monde.regions.get(id)?.nom ?? id;

  return (
    <aside className="panel" id="rumors">
      <div className="ptitle">
        <span className="tabs">
          <button className={onglet === 'murmures' ? 'on' : ''} onClick={() => setOnglet('murmures')}>
            Murmures
          </button>
          <button className={onglet === 'chronique' ? 'on' : ''} onClick={() => setOnglet('chronique')}>
            Chronique
          </button>
        </span>
        <Runes n={7} s={3} />
      </div>
      <div className="trace">
        <div className="t">
          <span>
            PISTE DE L'ANNEAU · {p.precision === 'diffuse' ? 'DIFFUSE' : p.precision === 'exacte' ? nomRegion(p.regionProbable).toUpperCase() : 'À UNE RÉGION PRÈS'}
          </span>
          <span>certitude {Math.round(p.certitude * 100)} %</span>
        </div>
        <div className="bar">
          <i style={{ width: `${Math.round(p.certitude * 100)}%` }} />
        </div>
      </div>
      <div id="rlist">
        {onglet === 'murmures' &&
          (liste.length ? (
            liste.map((m, i) => {
              const texte = m.texte ?? textes[m.id] ?? m.faitTexte;
              return (
                <div key={m.id} data-murmure={m.id} className={`rum ${m.tour < v.tour ? 'ancien' : ''} ${vise === m.id ? 'vise' : ''}`} onMouseEnter={() => survoler(m.id)} onMouseLeave={() => survoler(null)}>
                  <div className="src">
                    {m.emetteur}
                    <em>{m.tour === v.tour ? 'ce tour' : 'il y a 1 tour'}</em>
                  </div>
                  <div className="txt">
                    <Erode texte={texte} fiabilite={m.verifie ? 1 : m.fiabilite} cle={i + 1 + m.tour * 13} />
                  </div>
                  <div className="rel">
                    {[1, 2, 3, 4, 5].map((k) => (
                      <b key={k} className={k <= Math.round(m.fiabilite * 5) ? 'on' : ''} />
                    ))}
                    <span style={{ marginLeft: 6 }}>fiabilité {Math.round(m.fiabilite * 100)} %</span>
                  </div>
                  {!m.verifie && (
                    <div className="cls">
                      {CLASSES.map(([c, l]) => (
                        <button key={c} className={m.classement === c ? 'on' : ''} onClick={() => agir({ type: 'classer_murmure', murmure: m.id, classement: c })}>
                          {l}
                        </button>
                      ))}
                    </div>
                  )}
                  {m.verifie ? (
                    <span className={`stamp ${m.verite === 'faux' ? '' : 'ok'}`}>{m.verite === 'faux' ? 'Mensonge' : m.verite === 'deforme' ? 'Déformé' : 'Vérifié'}</span>
                  ) : m.contredit ? (
                    <span className="stamp">Contredit</span>
                  ) : null}
                </div>
              );
            })
          ) : (
            <p className="vide">{v.phase === 'oeil' ? 'Les murmures remontent après que l’Œil s’est posé.' : 'Aucun murmure ne remonte vers la Tour.'}</p>
          ))}
        {onglet === 'chronique' &&
          (chronique.length ? (
            chronique.map((c, i) => (
              <div key={i} className="chro">
                <div className="q">Tour {c.tour}</div>
                <p>{c.texte}</p>
                {reactions[cleEvenement(c)] && <p className="pensee">{reactions[cleEvenement(c)]}</p>}
              </div>
            ))
          ) : (
            <p className="vide">La Chronique se remplit à la fin de chaque tour : ce que la nuit a fait des ordres de la Tour.</p>
          ))}
      </div>
    </aside>
  );
}
