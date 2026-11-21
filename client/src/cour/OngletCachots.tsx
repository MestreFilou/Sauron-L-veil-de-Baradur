import type { GesteCachot, Ordre, VueJoueur } from '@sauron/engine';
import { coutGeste, coutOrdre, REGLES } from '@sauron/engine';
import { monde, useJeu } from '../store';
import { BARREAUX, CAPUCHE, COURONNE } from './sigles';

type CaptifVue = VueJoueur['captifs'][number];

const nomRegion = (id: string) => (monde.regions.get(id)?.nom ?? id).split(' · ')[0]!;
const nomNazgul = (id: string) => monde.nazgul.get(id)?.nom ?? id;
const C = REGLES.cachots;

const GESTES: { id: GesteCachot; nom: string; effet: (c: CaptifVue) => string; danger?: boolean }[] = [
  {
    id: 'interroger',
    nom: 'Interroger',
    effet: (c) => (c.aLivrer ? `Arrache sa peur, puis ce qu’il voulait faire, puis ses secrets. Doute +${C.interroger.doute}.` : 'Il n’a plus rien à livrer.'),
  },
  {
    id: 'tourmenter',
    nom: 'Tourmenter',
    effet: () => `Doute +${C.tourmenter.doute}. À ${C.seuilPlier}, il plie : relâché, il servira la Tour. Visibilité +${C.tourmenter.visibilite}.`,
  },
  {
    id: 'relacher',
    nom: 'Relâcher',
    effet: (c) =>
      c.plie
        ? `Il rentre à ${nomRegion(c.origine)} en espion : un agent de plus.`
        : `Il rentre à ${nomRegion(c.origine)} et raconte : Terreur +${C.relacher.terreur}, Méfiance +${C.relacher.mefianceHeros} des héros présents.`,
  },
  {
    id: 'executer',
    nom: 'Exécuter',
    effet: (c) => `Pour l’exemple : Terreur +${C.executer.terreur} à ${nomRegion(c.origine)}, Essence +${C.executer.gainEssence}, Visibilité +${C.executer.visibilite}. Sans retour.`,
    danger: true,
  },
];

const prix = (g: GesteCachot) => {
  const c = coutGeste(g);
  const p = [c.pa ? `${c.pa} PA` : '', c.essence ? `${c.essence} Ess.` : ''].filter(Boolean);
  return p.length ? p.join(' · ') : 'gratuit';
};

function Cellule({ c, numero }: { c: CaptifVue; numero: number }) {
  const v = useJeu((s) => s.vue);
  const agir = useJeu((s) => s.agir);
  const enRoute = c.depuis === v.tour;
  const index = v.ordres.findIndex((o) => o.type === 'cachot' && o.pnj === c.id);
  const prevu = index >= 0 ? (v.ordres[index] as Extract<Ordre, { type: 'cachot' }>) : null;
  const jours = v.tour - c.depuis;
  return (
    <article className={`cellule ${c.plie ? 'plie' : ''}`}>
      <header>
        <span className="tok">{BARREAUX}</span>
        <div>
          <h3>
            <span className="num">Cellule {['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][numero] ?? numero + 1}</span> {c.nom}
          </h3>
          <i>
            Pris à {nomRegion(c.origine)} par {nomNazgul(c.par)}
            {enRoute ? ', en route vers la Tour' : `, il y a ${jours} jour${jours > 1 ? 's' : ''}`}
          </i>
        </div>
        <span className={`statut ${c.plie ? 'plie' : ''}`}>{c.plie ? 'Plié' : 'Résiste'}</span>
      </header>
      <div className="doute" title={`Doute ${c.doute} / 100. Il plie à ${C.seuilPlier}.`}>
        <span>Doute</span>
        <span className="barre">
          <i style={{ width: `${c.doute}%` }} />
          <em style={{ left: `${C.seuilPlier}%` }} />
        </span>
        <b>{c.doute}</b>
      </div>
      <p className="note">
        Interrogé {c.interrogatoires} fois{c.aLivrer ? '.' : ' : il n’a plus rien à livrer.'}
      </p>
      {prevu ? (
        <div className="prevu">
          Cette nuit : <b>{GESTES.find((g) => g.id === prevu.geste)?.nom}</b>
          <button className="btn mini" onClick={() => agir({ type: 'annuler_ordre', index })}>
            Annuler
          </button>
        </div>
      ) : (
        <div className="gestes">
          {GESTES.map((g) => (
            <button
              key={g.id}
              className={`btn mini ${g.danger ? 'danger' : ''}`}
              disabled={v.phase !== 'ordres' || enRoute}
              title={g.effet(c)}
              onClick={() => agir({ type: 'ordonner', ordre: { type: 'cachot', geste: g.id, pnj: c.id } })}
            >
              {g.nom} · {prix(g.id)}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

/** Les proies : gens du commun que Sauron sait là où se tient un Nazgûl disponible. */
function Proies() {
  const v = useJeu((s) => s.vue);
  const etat = useJeu((s) => s.etat);
  const agir = useJeu((s) => s.agir);
  const captifs = new Set(v.captifs.map((c) => c.id));
  const proies = v.nazgul
    .filter((n) => n.disponible)
    .flatMap((n) =>
      v.personnages
        .filter((p) => !captifs.has(p.id) && monde.personnages.get(p.id)?.role === 'pnj' && p.position?.region === n.region)
        .map((p) => ({ n, p, ordre: { type: 'nazgul_capturer', nazgul: n.id, pnj: p.id } as Ordre })),
    );
  const promis = (id: string) => v.ordres.some((o) => o.type === 'nazgul_capturer' && o.pnj === id);
  return (
    <section className="proies">
      <h4>Proies à portée</h4>
      {proies.length ? (
        <ul>
          {proies.map(({ n, p, ordre }) => (
            <li key={`${n.id}-${p.id}`}>
              <span className="tok petit">{n.roiSorcier ? COURONNE : CAPUCHE}</span>
              <span>
                <b>{p.nom}</b> à {nomRegion(n.region)}, près de {n.nom}
                {p.position && p.position.tour < v.tour ? <em> (vu il y a {v.tour - p.position.tour} j)</em> : null}
                {p.agent ? <em> · sert déjà la Tour</em> : null}
              </span>
              <button className="btn mini danger" disabled={v.phase !== 'ordres' || promis(p.id)} onClick={() => agir({ type: 'ordonner', ordre })}>
                {promis(p.id) ? 'Promis aux cachots' : `Enlever · ${coutOrdre(etat, ordre).pa} PA`}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="note">Aucun homme du commun connu là où se tiennent les Neuf. Les héros et les Sages ne se laissent pas prendre.</p>
      )}
      <p className="note">
        Un enlèvement est l’action du Nazgûl pour ce tour : Terreur +{C.capture.terreur}, Visibilité +{C.capture.visibilite}. Le prisonnier arrive aux cachots à l’aube.
      </p>
    </section>
  );
}

/** Onglet des cachots de Barad-dûr. */
export function OngletCachots() {
  const v = useJeu((s) => s.vue);
  return (
    <div className="onglet cachots">
      <div className="cellules">
        {v.captifs.length ? (
          v.captifs.map((c, i) => <Cellule key={c.id} c={c} numero={i} />)
        ) : (
          <p className="vide">Les cachots sont vides. Sous la Tour, on attend des voix à faire parler.</p>
        )}
      </div>
      <Proies />
    </div>
  );
}
