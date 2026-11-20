import { useEffect, useState } from 'react';
import { Carte } from './Carte';
import { Oeil } from './Oeil';
import { Fiche, Modes, Ordres } from './panneaux/Commandes';
import { Haut } from './panneaux/Haut';
import { Murmures } from './panneaux/Murmures';
import { Neuf } from './panneaux/Neuf';
import { Voix } from './panneaux/Voix';
import { Runes } from './Runes';
import { Son } from './son/Son';
import { useJeu } from './store';

function Toast() {
  const toast = useJeu((s) => s.toast);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!toast) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 3200);
    return () => clearTimeout(t);
  }, [toast]);
  return (
    <div id="toast" className={visible ? 'show' : ''}>
      {toast?.texte}
    </div>
  );
}

function Intro() {
  const vue = useJeu((s) => s.introVue);
  const fermer = useJeu((s) => s.fermerIntro);
  const tour = useJeu((s) => s.vue.tour);
  return (
    <div id="intro" className={vue ? 'hide' : ''} onClick={fermer}>
      <div className="panel">
        <div className="ptitle">
          {tour > 1 ? 'La partie reprend' : 'Acte I · l’Eriador'} <Runes n={8} s={11} />
        </div>
        <div className="body">
          <p>Eriador, automne 3018 du Troisième Âge. Gollum a parlé : le Comté, Sacquet. L’Anneau est quelque part à l’ouest, et l’Œil ne sait pas encore où.</p>
          <ul>
            <li>
              À l’aube, <b>pose le Regard</b> sur une région ou sonde un esprit. Ce qu’il touche devient net.
            </li>
            <li>
              Lis les <b>Murmures</b>, et classe-les : vrais, faux ou incertains. Une bonne déduction rapporte de l’Essence.
            </li>
            <li>
              Donne tes <b>ordres</b> : les Neuf marchent, traquent, tendent des embuscades ; la <b>Voix</b> ronge les esprits.
            </li>
            <li>
              <b>S</b> bascule dans le Monde de l’Ombre, où la piste de l’Anneau luit. Trop de <b>Visibilité</b> éveille l’Ouest.
            </li>
          </ul>
        </div>
        <div className="go" style={{ fontFamily: 'Cinzel, serif', fontSize: 10, letterSpacing: '.3em', color: 'var(--bronze-clair)' }}>
          Cliquer pour entrer
        </div>
      </div>
    </div>
  );
}

function Duel() {
  const duel = useJeu((s) => s.duel);
  const fermer = useJeu((s) => s.fermerDuel);
  if (!duel) return null;
  return (
    <div className="modal" onClick={fermer}>
      <div className="panel duel">
        <div className="ptitle">
          Duel mental · {duel.cible} <Runes n={5} s={17} />
        </div>
        <div className="body">
          {duel.manches.map((m, i) => (
            <p key={i}>{m}</p>
          ))}
          <p className="final">{duel.final}</p>
        </div>
        <div className="go">
          <button className="btn mini">{duel.victoire ? 'La volonté plie' : 'Se retirer'}</button>
        </div>
      </div>
    </div>
  );
}

const ISSUES: Record<string, { titre: string; texte: string }> = {
  victoire_noire: { titre: 'Victoire noire', texte: 'L’Anneau est saisi avant Fondcombe. La Tour se souviendra de cet automne.' },
  victoire_grise: { titre: 'Victoire grise', texte: 'Le Porteur atteint Imladris, mais marqué, rongé. L’Anneau pèsera plus lourd sur la route.' },
  statu_quo: { titre: 'Statu quo', texte: 'Le Porteur gagne Fondcombe. Les Neuf rentrent démontés, et l’Œil doit chercher ailleurs.' },
  ouest_s_eveille: { titre: 'L’Ouest s’éveille', texte: 'La Tour s’est trop montrée. Les Sages s’unissent avant que l’Anneau ne soit trouvé.' },
};

function Fin() {
  const issue = useJeu((s) => s.vue.issue);
  const nouvelle = useJeu((s) => s.nouvellePartie);
  if (!issue) return null;
  const i = ISSUES[issue] ?? { titre: issue, texte: '' };
  return (
    <div className="modal">
      <div className="panel">
        <div className="ptitle">
          Fin de l’Acte I · {i.titre} <Runes n={6} s={29} />
        </div>
        <div className="body">
          <p>{i.texte}</p>
        </div>
        <div className="go">
          <button className="btn mini" onClick={() => nouvelle()}>
            Nouvelle partie
          </button>
        </div>
      </div>
    </div>
  );
}

export function App() {
  return (
    <>
      <Carte />
      <div className="vignette" />
      <Haut />
      <Oeil />
      <Neuf />
      <Modes />
      <Murmures />
      <div className="basmilieu">
        <Ordres />
        <Voix />
      </div>
      <Fiche />
      <Toast />
      <Duel />
      <Fin />
      <Son />
      <Intro />
    </>
  );
}
