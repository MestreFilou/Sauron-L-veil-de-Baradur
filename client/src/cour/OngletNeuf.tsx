import type { Affectation, Ordre, VueJoueur } from '@sauron/engine';
import { coutOrdre, REGLES, regionsJouables } from '@sauron/engine';
import { useMemo, useState } from 'react';
import { libelleOrdre } from '../panneaux/Commandes';
import { monde, useJeu } from '../store';
import { CAPUCHE, COURONNE } from './sigles';

type NazgulVue = VueJoueur['nazgul'][number];

const nomRegion = (id: string) => (monde.regions.get(id)?.nom ?? id).split(' · ')[0]!;

const MISSIONS: { type: Affectation['type'] | 'aucune'; nom: string; texte: string; region?: boolean }[] = [
  { type: 'aucune', nom: 'Aux ordres', texte: 'Il n’agit que sur tes ordres du soir.' },
  { type: 'battre_campagne', nom: 'Battre la campagne', texte: `Traque chaque tour là où il se trouve (${REGLES.nazgul.traque.pa} PA par tour, Terreur +${REGLES.nazgul.traque.terreur}).` },
  {
    type: 'tenir_passage',
    nom: 'Tenir un passage',
    texte: `Gagne la région choisie et s’y tapit en embuscade (${REGLES.nazgul.embuscade.pa} PA par pose, elle tient ${REGLES.nazgul.embuscade.duree} nuits).`,
    region: true,
  },
  { type: 'suivre_piste', nom: 'Suivre la piste', texte: `Chevauche vers la dernière trace connue de l’Anneau, puis traque (${REGLES.nazgul.traque.pa} PA par tour).` },
  {
    type: 'semer_effroi',
    nom: 'Semer l’effroi',
    texte: `Gagne la région choisie et y pousse le Cri chaque nuit (gratuit, Visibilité +${REGLES.nazgul.cri.visibilite} par cri).`,
    region: true,
  },
];

/** Les « dons » d'un Nazgûl, lus dans ses règles : ce qui le distingue des autres. */
function dons(n: NazgulVue): { nom: string; texte: string; mauvais?: boolean }[] {
  const d: { nom: string; texte: string; mauvais?: boolean }[] = [];
  d.push({
    nom: n.posture === 'ombre_ailee' ? 'Ombre ailée' : 'Cheval noir',
    texte: `${n.vitesse} jours de route par tour`,
  });
  if (n.bonusDetection > 0) d.push({ nom: 'Flair', texte: `+${n.bonusDetection} % pour sentir la trace de l’Anneau` });
  if (n.roiSorcier) {
    d.push({ nom: 'Seigneur d’Angmar', texte: `+${REGLES.nazgul.combat.roiSorcier} % en embuscade, Cri à Terreur +${REGLES.nazgul.cri.terreurRoiSorcier}` });
    d.push(
      n.lameMorgulUtilisee
        ? { nom: 'Lame de Morgul', texte: 'déjà frappée', mauvais: true }
        : { nom: 'Lame de Morgul', texte: 'prête, sur une embuscade qu’il tend lui-même' },
    );
  }
  if (n.sensibleAuJour) d.push({ nom: 'Craint le jour', texte: `−${REGLES.anneau.malusJourKhamul} % de flair hors de la nuit`, mauvais: true });
  if (n.isole && n.disponible) d.push({ nom: 'Signal faible', texte: 'trop loin des autres, il n’entend la Tour qu’un tour sur deux', mauvais: true });
  return d;
}

function lieu(n: NazgulVue, tour: number): string {
  if (!n.disponible) return n.retourAuTour ? `revient au tour ${n.retourAuTour} (${n.retourAuTour - tour} j)` : 'loin de la chasse';
  return nomRegion(n.region);
}

function Siege({ n, sel, onClick }: { n: NazgulVue; sel: boolean; onClick: () => void }) {
  const v = useJeu((s) => s.vue);
  const siens = v.ordres.filter((o) => 'nazgul' in o && o.nazgul === n.id);
  return (
    <button className={`siege ${sel ? 'sel' : ''} ${n.disponible ? '' : 'absent'}`} onClick={onClick}>
      <span className="tok">{n.roiSorcier ? COURONNE : CAPUCHE}</span>
      <span className="qui">
        <b>{n.nom}</b>
        <small>{lieu(n, v.tour)}</small>
      </span>
      <span className="mission">{n.mission ? n.mission.libelle : 'aux ordres'}</span>
      {siens.length > 0 && <span className="nb">{siens.length}</span>}
    </button>
  );
}

function EditeurMission({ n }: { n: NazgulVue }) {
  const agir = useJeu((s) => s.agir);
  const regions = useMemo(() => regionsJouables(monde), []);
  const actuelle = n.affectation;
  const regionActuelle = actuelle && 'region' in actuelle ? actuelle.region : n.disponible ? n.region : (regions[0]?.id ?? '');
  const [region, setRegion] = useState(regionActuelle);

  const confier = (type: (typeof MISSIONS)[number]['type'], r = region) => {
    if (type === 'aucune') return agir({ type: 'affecter', nazgul: n.id, affectation: null });
    const a: Affectation = type === 'tenir_passage' || type === 'semer_effroi' ? { type, region: r } : { type };
    agir({ type: 'affecter', nazgul: n.id, affectation: a });
  };

  return (
    <div className="missions">
      {MISSIONS.map((m) => {
        const on = (m.type === 'aucune' && !actuelle) || actuelle?.type === m.type;
        return (
          <label key={m.type} className={`mis ${on ? 'on' : ''}`}>
            <input type="radio" name={`mission-${n.id}`} checked={on} onChange={() => confier(m.type)} />
            <span>
              <b>{m.nom}</b>
              <em>{m.texte}</em>
              {m.region && on && (
                <select
                  value={region}
                  onChange={(e) => {
                    setRegion(e.target.value);
                    confier(m.type, e.target.value);
                  }}
                >
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {nomRegion(r.id)}
                    </option>
                  ))}
                </select>
              )}
              {on && m.type === 'suivre_piste' && n.mission?.region && <em className="vise">Il vise {nomRegion(n.mission.region)}.</em>}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function OrdresDuSoir({ n }: { n: NazgulVue }) {
  const v = useJeu((s) => s.vue);
  const etat = useJeu((s) => s.etat);
  const agir = useJeu((s) => s.agir);
  if (v.phase !== 'ordres') return <p className="note">Les ordres se donnent au crépuscule, une fois le Regard posé.</p>;
  if (!n.disponible) return <p className="note">Il est loin de la chasse : aucun ordre ne l’atteint.</p>;
  const siens = v.ordres.map((o, i) => ({ o, i })).filter(({ o }) => 'nazgul' in o && o.nazgul === n.id);
  const donner = (ordre: Ordre) => agir({ type: 'ordonner', ordre });
  const ici = v.personnages.filter((p) => !p.heros && p.position?.region === n.region);
  const proies = ici.filter((p) => monde.personnages.get(p.id)?.role === 'pnj');
  const cout = (o: Ordre) => coutOrdre(etat, o).pa;
  const prenom = (nom: string) => nom.split(' ')[0];
  return (
    <>
      <div className="chips">
        {siens.length ? (
          siens.map(({ o, i }) => (
            <span key={i} className="chip">
              {libelleOrdre(o)}
              <button title="Annuler" onClick={() => agir({ type: 'annuler_ordre', index: i })}>
                ✕
              </button>
            </span>
          ))
        ) : (
          <span className="note">Aucun ordre ce soir.</span>
        )}
      </div>
      <div className="gestes">
        <button className="btn mini" onClick={() => donner({ type: 'nazgul_traque', nazgul: n.id })}>
          Traquer · {REGLES.nazgul.traque.pa} PA
        </button>
        <button className="btn mini" onClick={() => donner({ type: 'nazgul_embuscade', nazgul: n.id })}>
          Embuscade · {REGLES.nazgul.embuscade.pa} PA
        </button>
        <button className="btn mini" onClick={() => donner({ type: 'nazgul_cri', nazgul: n.id })}>
          Cri · 0 PA
        </button>
        {ici.map((p) => {
          const o: Ordre = { type: 'nazgul_interroger', nazgul: n.id, pnj: p.id };
          return (
            <button key={`i-${p.id}`} className="btn mini" onClick={() => donner(o)}>
              Interroger {prenom(p.nom)} · {cout(o)} PA
            </button>
          );
        })}
        {proies.map((p) => {
          const o: Ordre = { type: 'nazgul_capturer', nazgul: n.id, pnj: p.id };
          return (
            <button key={`c-${p.id}`} className="btn mini danger" onClick={() => donner(o)} title="L’emmener aux cachots de la Tour">
              Enlever {prenom(p.nom)} · {cout(o)} PA
            </button>
          );
        })}
      </div>
    </>
  );
}

/** Les hauts faits récents de ce Nazgûl, tirés du Journal. */
function HautsFaits({ n }: { n: NazgulVue }) {
  const journal = useJeu((s) => s.etat.journal);
  const faits = journal
    .slice(-8)
    .flatMap((j) => j.evenements.filter((e) => ['nazgul', 'combat', 'detection', 'cachot'].includes(e.type) && e.texte.includes(n.nom)).map((e) => ({ tour: j.tour, texte: e.texte })))
    .slice(-4)
    .reverse();
  if (!faits.length) return <p className="note">Rien encore dont la Tour se souvienne.</p>;
  return (
    <ul className="faits">
      {faits.map((f, i) => (
        <li key={i}>
          <b>Tour {f.tour}</b> {f.texte}
        </li>
      ))}
    </ul>
  );
}

function Fiche({ n }: { n: NazgulVue }) {
  const v = useJeu((s) => s.vue);
  return (
    <div className="fiche">
      <div className="portrait">
        <span className="tok grand">{n.roiSorcier ? COURONNE : CAPUCHE}</span>
        <div>
          <h3>{n.nom}</h3>
          {n.titre && <i>{n.titre}</i>}
          <div className="etat">
            {lieu(n, v.tour)}
            {n.embuscade ? ` · tapi à ${nomRegion(n.embuscade.region)} jusqu’au tour ${n.embuscade.expire}` : ''}
          </div>
        </div>
        <span className={`sig ${n.signal < 2 ? 'weak' : ''}`} title="Force du lien avec la Tour">
          {[1, 2, 3, 4].map((k) => (
            <b key={k} className={k <= n.signal ? 'on' : ''} />
          ))}
        </span>
      </div>

      <h4>Dons</h4>
      <ul className="dons">
        {dons(n).map((d) => (
          <li key={d.nom} className={d.mauvais ? 'mauvais' : ''}>
            <b>{d.nom}</b> {d.texte}
          </li>
        ))}
      </ul>

      <h4>Mission</h4>
      <EditeurMission key={n.id} n={n} />

      <h4>Ordres du soir</h4>
      <OrdresDuSoir n={n} />

      <h4>Hauts faits</h4>
      <HautsFaits n={n} />
    </div>
  );
}

/** Onglet des Neuf : le cercle des neuf sièges et la fiche du Nazgûl choisi. */
export function OngletNeuf() {
  const v = useJeu((s) => s.vue);
  const choisiCarte = useJeu((s) => s.nazgulChoisi);
  const [choisi, setChoisi] = useState(() => choisiCarte ?? v.nazgul[0]?.id ?? '');
  const n = v.nazgul.find((x) => x.id === choisi) ?? v.nazgul[0];
  return (
    <div className="onglet neuf">
      <div className="cercle">
        {v.nazgul.map((x) => (
          <Siege key={x.id} n={x} sel={x.id === n?.id} onClick={() => setChoisi(x.id)} />
        ))}
      </div>
      {n && <Fiche n={n} />}
    </div>
  );
}
