import type { Approche, Ordre, OrdreFer, Registre } from '@sauron/engine';
import { chanceVoix, coutVoix, regionsJouables, voixAPortee } from '@sauron/engine';
import { useMemo, useRef, useState } from 'react';
import { bus } from '../bus';
import { monde, useJeu } from '../store';

const REGISTRES: { id: Registre; nom: string; c: string; ph: string }[] = [
  { id: 'paranoia', nom: 'Murmure de la Paranoïa', c: '#9a7bd0', ph: 'Ceux qui t’entourent te mentent…' },
  { id: 'annatar', nom: 'Promesse d’Annatar', c: '#e2b85c', ph: 'Tu mérites mieux que cela. Sers-moi, et tout ceci sera à toi…' },
  { id: 'fer', nom: 'Commandement de Fer', c: '#d0442a', ph: 'Obéis. Ne dors pas. Rapporte.' },
];

const TRAITS: Record<string, string> = { orgueil: 'orgueilleux', desir: 'avide de désirs', humble: 'humble', avide: 'avide', peureux: 'peureux', loyal: 'loyal', sage: 'sage' };

/** Ce que le joueur voit de sa chance : une impression, pas le chiffre (le Doute exact reste caché). */
function impression(chance: number) {
  if (chance >= 75) return 'l’esprit cède déjà';
  if (chance >= 55) return 'prise solide';
  if (chance >= 35) return 'issue incertaine';
  if (chance >= 18) return 'l’esprit résiste';
  return 'mur de volonté';
}

export function Voix() {
  const v = useJeu((s) => s.vue);
  const etat = useJeu((s) => s.etat);
  const agir = useJeu((s) => s.agir);
  const annoncer = useJeu((s) => s.annoncer);
  const cibles = useMemo(() => v.personnages.filter((p) => !monde.personnages.get(p.id)?.horsCarte), [v.personnages]);
  const [cibleId, setCible] = useState(() => cibles.find((c) => c.id === 'bill_fougeron')?.id ?? cibles[0]?.id ?? '');
  const [reg, setReg] = useState(0);
  const [texte, setTexte] = useState('');
  const [secret, setSecret] = useState('');
  const [allie, setAllie] = useState('');
  const [fer, setFer] = useState<'se_taire' | 'livrer' | 'deplacer'>('se_taire');
  const [ferRegion, setFerRegion] = useState('bree');
  const [approche, setApproche] = useState<Approche>('insinuer');
  const boite = useRef<HTMLDivElement>(null);

  const R = REGISTRES[reg]!;
  const cible = cibles.find((c) => c.id === cibleId) ?? cibles[0];
  const def = cible ? monde.personnages.get(cible.id) : undefined;
  const secrets = v.secrets.filter((s) => s.personnage === cible?.id);
  const ordreFer: OrdreFer = fer === 'deplacer' ? { type: 'deplacer', region: ferRegion } : { type: fer };

  const ordre: Extract<Ordre, { type: 'voix' }> | null = cible
    ? {
        type: 'voix',
        cible: cible.id,
        registre: R.id,
        ...(texte.trim() ? { texteLibre: texte.trim().slice(0, 200) } : {}),
        ...(secret ? { secret } : {}),
        ...(R.id === 'paranoia' && allie ? { allie } : {}),
        ...(R.id === 'fer' ? { ordreFer, approches: [approche, approche, approche] } : {}),
      }
    : null;
  const estimation = ordre ? chanceVoix(monde, etat, ordre) : null;
  const aPortee = cible ? voixAPortee(monde, etat, cible.id) : false;

  const projeter = () => {
    if (!ordre) return;
    if (!agir({ type: 'ordonner', ordre })) return;
    const s = (texte || R.ph).trim();
    [...s].slice(0, 90).forEach((ch, i) => {
      if (ch === ' ' || !boite.current) return;
      const sp = document.createElement('span');
      sp.className = 'ember';
      sp.textContent = ch;
      sp.style.left = `${10 + (i % 60) * 8.2}px`;
      sp.style.top = `${8 + Math.floor(i / 60) * 20}px`;
      sp.style.setProperty('--dx', `${Math.random() * 40 - 20}px`);
      sp.style.animationDelay = `${i * 12}ms`;
      sp.style.color = R.c;
      boite.current.appendChild(sp);
      setTimeout(() => sp.remove(), 2400);
    });
    bus.emit('flare', 0.7);
    setTexte('');
    annoncer(`La Voix partira vers ${cible!.nom} au crépuscule.`);
  };

  const sonder = () => cible && agir({ type: 'poser_oeil', cible: { type: 'personnage', id: cible.id } });

  const lieu = cible?.position ? (monde.regions.get(cible.position.region)?.nom.split(' · ')[0] ?? '') : 'position inconnue';
  const esprit = def ? def.traits.map((t) => TRAITS[t] ?? t).join(', ') || 'esprit fermé' : '';

  return (
    <section className="panel" id="voice" style={{ ['--accent' as string]: R.c }}>
      <div className="head">
        <div className="ptitle">La Voix de Sauron</div>
        <div className="target">
          Cible
          <select value={cible?.id ?? ''} onChange={(e) => setCible(e.target.value)}>
            {cibles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
                {c.agent ? ' (agent)' : ''}
              </option>
            ))}
          </select>
          <i>
            {' '}
            · {lieu} · {esprit}
          </i>
        </div>
      </div>
      <div className="reg">
        {REGISTRES.map((r, i) => (
          <button key={r.id} className={i === reg ? 'on' : ''} onClick={() => setReg(i)}>
            {r.nom}
          </button>
        ))}
      </div>
      <div className="voicebox" ref={boite}>
        <textarea id="vtext" maxLength={200} value={texte} placeholder={R.ph} onChange={(e) => setTexte(e.target.value)} />
      </div>
      <div className="vopts">
        {secrets.length > 0 && (
          <label>
            Secret{' '}
            <select value={secret} onChange={(e) => setSecret(e.target.value)}>
              <option value="">aucun</option>
              {secrets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.texte.slice(0, 60)}
                </option>
              ))}
            </select>
          </label>
        )}
        {R.id === 'paranoia' && (
          <label>
            Contre{' '}
            <select value={allie} onChange={(e) => setAllie(e.target.value)}>
              <option value="">personne en particulier</option>
              {v.personnages
                .filter((p) => p.id !== cible?.id && p.heros)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nom}
                  </option>
                ))}
            </select>
          </label>
        )}
        {R.id === 'fer' && (
          <>
            <label>
              Ordre{' '}
              <select value={fer} onChange={(e) => setFer(e.target.value as typeof fer)}>
                <option value="se_taire">se taire</option>
                <option value="livrer">livrer ce qu’il sait</option>
                <option value="deplacer">marcher vers…</option>
              </select>
            </label>
            {fer === 'deplacer' && (
              <select value={ferRegion} onChange={(e) => setFerRegion(e.target.value)}>
                {regionsJouables(monde).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nom}
                  </option>
                ))}
              </select>
            )}
            {estimation?.duel && (
              <label>
                Duel{' '}
                <select value={approche} onChange={(e) => setApproche(e.target.value as Approche)}>
                  <option value="ecraser">écraser</option>
                  <option value="insinuer">insinuer</option>
                  <option value="feindre">feindre</option>
                </select>
              </label>
            )}
          </>
        )}
      </div>
      <div className="vfoot">
        <span>
          {estimation ? (
            <>
              <b>{impression(estimation.chance).toUpperCase()}</b> · {estimation.duel ? 'duel mental certain' : 'aucun duel'} · {coutVoix(etat)} PA
              {!aPortee && ' · hors de portée des Neuf'}
            </>
          ) : (
            'Sauron ne connaît encore aucun esprit.'
          )}
        </span>
        {v.phase === 'oeil' ? (
          <button className="project" onClick={sonder} disabled={!cible}>
            Sonder cet esprit
          </button>
        ) : (
          <button className="project" onClick={projeter} disabled={!ordre || v.phase !== 'ordres'}>
            Projeter la Voix
          </button>
        )}
      </div>
    </section>
  );
}
