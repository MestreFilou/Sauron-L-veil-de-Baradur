import { cheminNazgul } from '@sauron/engine';
import { geographieEriador } from '@sauron/world';
import { useEffect, useRef } from 'react';
import { atteignablesCeSoir, libelleTrajet, trajet } from './carte/marche';
import { SceneCarte } from './carte/scene';
import { monde, useJeu } from './store';

const regionsCarte = Object.keys(geographieEriador.regions);
const nomCourt = (id: string) => (monde.regions.get(id)?.nom ?? id).split(' · ')[0]!;

/** Les Nazgûl à qui l'on donne l'ordre : le choisi, puis son groupe. */
function selection() {
  const j = useJeu.getState();
  return j.nazgulChoisi ? [j.nazgulChoisi, ...j.groupe] : [];
}

/** Monte la scène PixiJS et lui transmet la vue du joueur à chaque changement. */
export function Carte() {
  const hote = useRef<HTMLDivElement>(null);
  const scene = useRef<SceneCarte | null>(null);

  useEffect(() => {
    const marcher = (ids: string[], region: string | null) => {
      const j = useJeu.getState();
      if (!region || !ids.length || j.vue.phase !== 'ordres') return false;
      return j.ordonnerMarche(ids, region);
    };

    const s = new SceneCarte(
      geographieEriador,
      {
        clic(region) {
          const j = useJeu.getState();
          if (j.mode === 'ombre') return;
          const { vue } = j;
          if (vue.phase === 'oeil') {
            if (region) j.agir({ type: 'poser_oeil', cible: { type: 'region', id: region } });
            return;
          }
          if (vue.phase !== 'ordres') return;
          const ids = selection();
          if (ids.length && region) {
            if (marcher(ids, region)) j.choisirNazgul(null);
            return;
          }
          j.choisirRegion(region && region !== j.regionChoisie ? region : null);
        },
        clicPion(id, ajouter) {
          const j = useJeu.getState();
          if (ajouter) j.basculerGroupe(id);
          else j.choisirNazgul(j.nazgulChoisi === id && !j.groupe.length ? null : id);
          j.choisirRegion(null);
        },
        clicDroit(region) {
          const j = useJeu.getState();
          if (j.mode === 'ombre') return;
          // Clic droit : la sélection garde la main, on peut enchaîner les ordres.
          if (!selection().length) {
            if (j.vue.phase === 'ordres') j.annoncer('Choisis d’abord un des Neuf (clic sur son pion, ou touches 1 à 9).');
            return;
          }
          if (j.vue.phase !== 'ordres') return j.annoncer('Les Neuf reçoivent leurs ordres au crépuscule, une fois l’Œil posé.');
          marcher(selection(), region);
        },
        peutSaisir(id) {
          const j = useJeu.getState();
          return j.vue.phase === 'ordres' && j.mode !== 'ombre' && Boolean(j.vue.nazgul.find((n) => n.id === id)?.disponible);
        },
        survolMurmure(id) {
          useJeu.getState().survolerMurmure(id);
        },
        deposer(id, region) {
          const j = useJeu.getState();
          // Glisser un pion du groupe emmène tout le groupe.
          const ids = selection().includes(id) ? selection() : [id];
          if (marcher(ids, region) && !selection().includes(id)) j.choisirNazgul(id);
        },
      },
      {
        trajet: (n, destination) => trajet(monde, n, destination),
        chemin: (de, vers) => cheminNazgul(monde, de, vers),
        atteignables: (n) => atteignablesCeSoir(monde, n, regionsCarte),
        libelle: (t, destination) => libelleTrajet(t, nomCourt(destination)),
      },
    );
    scene.current = s;
    let annule = false;
    const pousser = () => {
      const j = useJeu.getState();
      s.maj({ vue: j.vue, mode: j.mode, nazgulChoisi: j.nazgulChoisi, groupe: j.groupe, caps: j.caps, regionChoisie: j.regionChoisie, murmureSurvole: j.murmureSurvole });
    };
    void s.monter(hote.current!).then(() => {
      if (annule) s.detruire();
      else pousser();
    });
    const desabonner = useJeu.subscribe(pousser);

    // Touches 1 à 9 : choisir un des Neuf (Maj : l'ajouter au groupe), deux fois : centrer la carte dessus. Tab : le suivant.
    let dernier = { id: '', t: 0 };
    const clavier = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement;
      if (cible.tagName === 'TEXTAREA' || cible.tagName === 'SELECT' || cible.tagName === 'INPUT') return;
      const j = useJeu.getState();
      const dispo = j.vue.nazgul.filter((n) => n.disponible);
      let id: string | undefined;
      const chiffre = /^Digit([1-9])$/.exec(e.code);
      if (chiffre) {
        const n = j.vue.nazgul[Number(chiffre[1]) - 1];
        if (!n?.disponible) return;
        id = n.id;
      } else if (e.key === 'Tab') {
        e.preventDefault();
        if (!dispo.length) return;
        const i = dispo.findIndex((n) => n.id === j.nazgulChoisi);
        id = dispo[(i + (e.shiftKey ? dispo.length - 1 : 1)) % dispo.length]!.id;
      } else return;
      if (chiffre && e.shiftKey) j.basculerGroupe(id);
      else j.choisirNazgul(id);
      j.choisirRegion(null);
      const maintenant = performance.now();
      if (dernier.id === id && maintenant - dernier.t < 450) {
        const p = s.positionPion(id);
        if (p) s.centrerSur(p.x, p.y);
      }
      dernier = { id, t: maintenant };
    };
    window.addEventListener('keydown', clavier);

    return () => {
      annule = true;
      desabonner();
      window.removeEventListener('keydown', clavier);
      if (s.app.renderer) s.detruire();
    };
  }, []);

  return <div ref={hote} />;
}
