import { geographieEriador } from '@sauron/world';
import { useEffect, useRef } from 'react';
import { SceneCarte } from './carte/scene';
import { useJeu } from './store';

/** Monte la scène PixiJS et lui transmet la vue du joueur à chaque changement. */
export function Carte() {
  const hote = useRef<HTMLDivElement>(null);
  const scene = useRef<SceneCarte | null>(null);

  useEffect(() => {
    const s = new SceneCarte(geographieEriador, {
      clic(region) {
        const j = useJeu.getState();
        if (j.mode === 'ombre') return;
        const { vue, nazgulChoisi } = j;
        if (vue.phase === 'oeil') {
          if (region) j.agir({ type: 'poser_oeil', cible: { type: 'region', id: region } });
          return;
        }
        if (vue.phase !== 'ordres') return;
        if (nazgulChoisi && region) {
          const n = vue.nazgul.find((x) => x.id === nazgulChoisi);
          if (n && n.region !== region && j.agir({ type: 'ordonner', ordre: { type: 'nazgul_deplacer', nazgul: nazgulChoisi, destination: region } })) {
            j.annoncer(`${n.nom} se met en marche.`);
            j.choisirNazgul(null);
          }
          return;
        }
        j.choisirRegion(region && region !== j.regionChoisie ? region : null);
      },
    });
    scene.current = s;
    let annule = false;
    const pousser = () => {
      const j = useJeu.getState();
      s.maj({ vue: j.vue, mode: j.mode, nazgulChoisi: j.nazgulChoisi, regionChoisie: j.regionChoisie, murmureSurvole: j.murmureSurvole });
    };
    // Le montage part au tour suivant : en mode strict, React monte, démonte et
    // remonte aussitôt ; une seule scène est alors créée (deux applications PixiJS
    // qui s'initialisent en même temps, dont l'une détruite, cassent l'autre).
    // On ne pousse rien à la scène tant qu'elle n'est pas montée (le parchemin
    // cuit pendant l'écran de chargement).
    let desabonner = () => {};
    let monte = false;
    const depart = setTimeout(() => {
      monte = true;
      void s.monter(hote.current!).then(() => {
        if (annule) return s.detruire();
        pousser();
        desabonner = useJeu.subscribe(pousser);
        useJeu.setState({ cartePrete: true });
      });
    }, 0);
    return () => {
      annule = true;
      clearTimeout(depart);
      desabonner();
      useJeu.setState({ cartePrete: false });
      if (monte && s.app.renderer) s.detruire();
    };
  }, []);

  return <div ref={hote} />;
}
