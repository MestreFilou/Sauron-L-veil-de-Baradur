import { BoutonSon } from '../son/Reglages';
import { useJeu } from '../store';

const ROMAINS: [number, string][] = [
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];
export function romain(n: number): string {
  let s = '';
  for (const [v, r] of ROMAINS) while (n >= v) (s += r), (n -= v);
  return s;
}

function Jauge(p: { nom: string; v: number; max: number; c1: string; c2: string; vis?: boolean; texte?: string }) {
  return (
    <div className={`gauge${p.vis ? ' vis' : ''}`} style={{ ['--v' as string]: Math.min(1, p.v / p.max), ['--c1' as string]: p.c1, ['--c2' as string]: p.c2 }}>
      {p.nom}
      <span className="gbar">
        <i />
      </span>
      <span className="gv">{p.texte ?? p.v}</span>
    </div>
  );
}

/** Barre du haut : le tour, la date, et les jauges que Sauron connaît. */
export function Haut() {
  const v = useJeu((s) => s.vue);
  const j = v.jauges;
  return (
    <header className="topbar">
      <div className="brand">
        <h1>L'Œil de Barad-dûr</h1>
        <span className="sep" />
        <div className="turn">
          Tour<b>{romain(v.tour)}</b>
          {v.date} · Troisième Âge
        </div>
      </div>
      <div className="gauges">
        <Jauge nom="Visibilité" v={j.visibilite} max={100} c1="#ff4a10" c2="#ffb347" vis />
        <Jauge nom="Terreur" v={j.terreurMoyenne} max={100} c1="#9a7bd0" c2="#4a3470" />
        <Jauge nom="Essence" v={j.essenceRestante} max={35} c1="#d8e6f0" c2="#6f8a9c" />
        <Jauge nom="PA" v={j.paRestants} max={8} c1="#e2b85c" c2="#7a5a1c" texte={`${j.paRestants}/${j.pa}`} />
        <BoutonSon />
      </div>
    </header>
  );
}
