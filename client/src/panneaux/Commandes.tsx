import type { Ordre } from '@sauron/engine';
import { DECISIONS, REGLES } from '@sauron/engine';
import { geographieEriador } from '@sauron/world';
import { useEffect, useRef } from 'react';
import { ancre } from '../carte/scene';
import { Runes } from '../Runes';
import { monde, useJeu } from '../store';

const nom = (id: string) => monde.regions.get(id)?.nom ?? monde.personnages.get(id)?.nom ?? monde.nazgul.get(id)?.nom ?? id;
const court = (id: string) => nom(id).split(' · ')[0]!;

const GESTES = { interroger: 'Interroger', tourmenter: 'Tourmenter', relacher: 'Relâcher', executer: 'Exécuter' } as const;

export function libelleOrdre(o: Ordre): string {
  switch (o.type) {
    case 'voix':
      return `Voix sur ${court(o.cible)} (${o.registre === 'paranoia' ? 'Paranoïa' : o.registre === 'annatar' ? 'Annatar' : 'Fer'})`;
    case 'nazgul_deplacer':
      return `${court(o.nazgul)} → ${court(o.destination)}`;
    case 'nazgul_traque':
      return `${court(o.nazgul)} traque`;
    case 'nazgul_interroger':
      return `${court(o.nazgul)} interroge ${court(o.pnj)}`;
    case 'nazgul_embuscade':
      return `${court(o.nazgul)} en embuscade`;
    case 'nazgul_cri':
      return `Cri de ${court(o.nazgul)}`;
    case 'nazgul_fleau':
      return `Fléau de ${court(o.nazgul)}`;
    case 'agent_placer':
      return `Placer ${court(o.pnj)}`;
    case 'corruption':
      return `Corrompre ${court(o.region)}`;
    case 'nazgul_capturer':
      return `${court(o.nazgul)} enlève ${court(o.pnj)}`;
    case 'cachot':
      return `${GESTES[o.geste]} ${court(o.pnj)}`;
    case 'decision':
      return DECISIONS.find((d) => d.id === o.decision)?.nom ?? o.decision;
  }
}

/** Modes de vue, corruption et rituel (bas gauche). */
export function Modes() {
  const mode = useJeu((s) => s.mode);
  const setMode = useJeu((s) => s.setMode);
  const v = useJeu((s) => s.vue);
  const regionChoisie = useJeu((s) => s.regionChoisie);
  const agir = useJeu((s) => s.agir);
  const annoncer = useJeu((s) => s.annoncer);
  const cibleCorruption = regionChoisie ?? (v.oeil?.cible.type === 'region' ? v.oeil.cible.id : null);
  const prochaine = v.jauges.forme + 1;

  const corrompre = () => {
    if (!cibleCorruption) return annoncer('Choisis d’abord une région sur la carte.');
    if (agir({ type: 'ordonner', ordre: { type: 'corruption', region: cibleCorruption } })) annoncer(`L’Ombre s’étendra sur ${court(cibleCorruption)}.`);
  };

  useEffect(() => {
    const clavier = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      const j = useJeu.getState();
      if (k === 's') j.setMode(j.mode === 'ombre' ? 'oeil' : 'ombre');
      if (k === 'escape') {
        j.choisirRegion(null);
        j.choisirNazgul(null);
      }
    };
    window.addEventListener('keydown', clavier);
    return () => window.removeEventListener('keydown', clavier);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('ombre', mode === 'ombre');
  }, [mode]);

  return (
    <aside className="panel" id="modes">
      <div className="row">
        <button className={`btn ${mode === 'oeil' ? 'on' : ''}`} onClick={() => setMode('oeil')}>
          L'Œil
        </button>
        <button className={`btn ${mode === 'ombre' ? 'on' : ''}`} onClick={() => setMode('ombre')}>
          Monde de l'Ombre
        </button>
      </div>
      <div className="row" style={{ marginTop: 6 }}>
        <button className="btn" onClick={corrompre} disabled={v.phase !== 'ordres'} title={`${REGLES.corruption.pa} PA, ${REGLES.corruption.essence} Essence`}>
          Corrompre
        </button>
        <button
          className="btn"
          disabled={v.phase !== 'oeil' || prochaine >= 4}
          onClick={() => agir({ type: 'rituel_forme' })}
          title="Remplace le Regard de ce tour et consomme tous les PA"
        >
          Rituel de Forme · {REGLES.forme.cout[prochaine] ?? '—'} Ess.
        </button>
      </div>
      <div className="hint">
        {v.phase === 'oeil' ? (
          <>
            <kbd>Clic</kbd> poser le Regard sur une région
          </>
        ) : (
          <>
            <kbd>Clic</kbd> choisir une région · <kbd>Échap</kbd> relâcher
          </>
        )}
        <br />
        <kbd>S</kbd> Monde de l'Ombre · Forme {v.jauges.forme}
        <br />
        Glisser pour déplacer · molette pour zoomer
      </div>
    </aside>
  );
}

/** Les ordres du tour et la fin du tour (au-dessus de la Voix). */
export function Ordres() {
  const v = useJeu((s) => s.vue);
  const agir = useJeu((s) => s.agir);
  return (
    <section className="panel" id="orders">
      {v.phase === 'oeil' ? (
        <span className="etape">Aube. Où se pose le Regard ? Clique une région, sonde un esprit, ou replie-toi pour un rituel.</span>
      ) : (
        <>
          <div className="lst">
            {v.ordres.length ? (
              v.ordres.map((o, i) => (
                <span key={i} className="chip">
                  {libelleOrdre(o)}
                  <button title="Annuler" onClick={() => agir({ type: 'annuler_ordre', index: i })}>
                    ✕
                  </button>
                </span>
              ))
            ) : (
              <span className="etape">Les ordres du crépuscule : les Neuf, la Voix, la corruption.</span>
            )}
          </div>
          <span className="pa">
            PA <b>{v.jauges.paRestants}</b> · ESS. <b>{v.jauges.essenceRestante}</b>
          </span>
          <button className="project fin" onClick={() => agir({ type: 'fin_des_ordres' })}>
            Que la nuit tombe
          </button>
        </>
      )}
    </section>
  );
}

const STATUTS: Record<string, string> = { libre: 'libre', inquiete: 'inquiète', sous_ombre: 'sous l’Ombre', ecrasee: 'écrasée', corrompue: 'corrompue' };

/** Fiche de la région sous le Regard, accrochée à l'ellipse. */
export function Fiche() {
  const ref = useRef<HTMLDivElement>(null);
  const v = useJeu((s) => s.vue);
  const regionChoisie = useJeu((s) => s.regionChoisie);
  const o = v.oeil;
  const id = regionChoisie ?? (o?.cible.type === 'region' ? o.cible.id : o ? (v.personnages.find((p) => p.id === o.cible.id)?.position?.region ?? null) : null);
  const r = id ? v.regions.find((x) => x.id === id) : undefined;

  useEffect(() => {
    let raf = 0;
    const suivre = () => {
      const el = ref.current;
      if (el) {
        let cx = ancre.x + ancre.rayon + 16,
          cy = ancre.y - 90;
        if (cx + 280 > window.innerWidth - 372) cx = ancre.x - ancre.rayon - 16 - 270;
        cy = Math.max(90, Math.min(window.innerHeight - 250, cy));
        el.style.left = `${cx}px`;
        el.style.top = `${cy}px`;
        el.classList.toggle('show', ancre.visible && Boolean(r));
      }
      raf = requestAnimationFrame(suivre);
    };
    raf = requestAnimationFrame(suivre);
    return () => cancelAnimationFrame(raf);
  }, [r]);

  if (!r) return <div className="panel" id="card" ref={ref} />;
  const t = r.terreur?.valeur ?? null;
  const surRegion = o && !regionChoisie && o.cible.type === 'region' && o.cible.id === r.id;
  const surEsprit = o && !regionChoisie && o.cible.type === 'personnage';
  return (
    <div className="panel" id="card" ref={ref}>
      <div className="ptitle">
        <span>{r.nom.split(' · ')[0]}</span>
        <Runes n={3} s={5} />
      </div>
      <div className="body">
        <div className="emp">
          Terreur{' '}
          <span className="gbar" style={{ ['--c1' as string]: '#ff4a10', ['--c2' as string]: '#3a1208', ['--v' as string]: (t ?? 0) / 100 }}>
            <i />
          </span>
          <span>{t === null ? 'inconnue' : `${t} · ${STATUTS[r.statut ?? 'libre']}`}</span>
        </div>
        <p>{geographieEriador.regions[r.id]?.description}</p>
        {surRegion && o && (
          <div className="seen">
            {o.repousse ? (
              <b>Le Regard glisse : rien n’est révélé</b>
            ) : (
              <>
                <b>Le Regard révèle</b>{' '}
                {o.personnagesVus.length ? o.personnagesVus.map((p) => court(p.id)).join(', ') : 'personne'}
                {o.anneauSenti ? '. Et quelque chose qui répond : l’Anneau.' : '.'}
                {o.murmuresVerifies.length ? ` ${o.murmuresVerifies.length} murmure(s) vérifié(s).` : ''}
              </>
            )}
          </div>
        )}
        {surEsprit && o?.pensees && (
          <div className="seen">
            <b>Dans l’esprit de {court(o.cible.id)}</b> Il va vers {o.pensees.destination}. Il craint {o.pensees.peur}.{o.pensees.secret ? ` Un secret : ${o.pensees.secret}` : ''}
          </div>
        )}
        {r.nazgul.length > 0 && <div className="felt">{r.nazgul.map(court).join(', ')} · la peur y est mesurée</div>}
        {regionChoisie && v.phase === 'ordres' && <div className="felt">Région choisie · Corrompre : {REGLES.corruption.pa} PA, {REGLES.corruption.essence} Essence</div>}
      </div>
    </div>
  );
}
