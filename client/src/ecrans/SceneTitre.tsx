/**
 * L'écran titre en WebGL : un seul shader plein écran (scene-titre.glsl.ts).
 * Ici, on suit la souris pour diriger la pupille, on lisse le regard, on fait
 * flamber l'Œil au clic, et on baisse la résolution si la machine peine.
 * Sans WebGL 2, on retombe sur le décor dessiné en SVG.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { FRAGMENTS, SOMMETS } from './scene-titre.glsl';

/** Position de l'Œil dans le shader (OEIL), en fraction de la hauteur depuis le bas. */
const OEIL_Y = 0.705;

/** Où se dresse la Tour : à droite du menu sur un écran large, au centre sur un écran étroit. */
export function axeTour(largeur: number, hauteur: number): number {
  return largeur / hauteur > 1.25 ? largeur * 0.64 : largeur * 0.5;
}

function compiler(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
  return s;
}

export function SceneTitre({ onEchec }: { onEchec: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current!;
    const gl = cv.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!gl) return onEchec();
    let prog: WebGLProgram;
    try {
      prog = gl.createProgram()!;
      gl.attachShader(prog, compiler(gl, gl.VERTEX_SHADER, SOMMETS));
      gl.attachShader(prog, compiler(gl, gl.FRAGMENT_SHADER, FRAGMENTS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'programme');
    } catch (e) {
      console.error('Écran titre : shader refusé', e);
      return onEchec();
    }
    gl.useProgram(prog);
    // un triangle qui couvre tout l'écran
    const tampon = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tampon);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
    const u = (n: string) => gl.getUniformLocation(prog, n);
    const U = { res: u('u_res'), t: u('u_t'), tx: u('u_tx'), regard: u('u_regard'), pupille: u('u_pupille'), eclat: u('u_eclat'), gauche: u('u_gauche') };

    // La souris : position, et vitesse (un mouvement vif plisse la pupille).
    const souris = { x: -1, y: -1, vitesse: 0 };
    const bouger = (e: PointerEvent) => {
      if (souris.x >= 0) souris.vitesse += Math.hypot(e.clientX - souris.x, e.clientY - souris.y);
      souris.x = e.clientX;
      souris.y = e.clientY;
    };
    let eclat = 0;
    const cliquer = () => (eclat = 1);
    window.addEventListener('pointermove', bouger);
    window.addEventListener('pointerdown', cliquer);

    // Qualité : on commence à la résolution de l'écran (plafonnée), et on descend si les images tardent.
    let qualite = Math.min(window.devicePixelRatio || 1, 1.5);
    let lent = 0;
    const regard = { x: 0, y: 0 };
    let pupille = 0.07;
    let image = 0;
    let avant = performance.now();
    const debut = avant;

    const dessiner = (maintenant: number) => {
      const dt = Math.min(0.1, (maintenant - avant) / 1000);
      avant = maintenant;
      // trop lent (moins de ~40 images/s) pendant une seconde : on baisse la définition
      lent = dt > 0.025 ? lent + dt : Math.max(0, lent - dt * 0.5);
      if (lent > 1 && qualite > 0.5) {
        qualite = Math.max(0.5, qualite * 0.8);
        lent = 0;
      }
      const W = cv.clientWidth,
        H = cv.clientHeight;
      const w = Math.max(1, Math.round(W * qualite)),
        h = Math.max(1, Math.round(H * qualite));
      if (cv.width !== w || cv.height !== h) {
        cv.width = w;
        cv.height = h;
      }
      gl.viewport(0, 0, w, h);

      // la pupille suit la souris, depuis le centre de l'Œil à l'écran
      const ox = axeTour(W, H),
        oy = H * (1 - OEIL_Y);
      let gx = 0,
        gy = 0;
      if (souris.x >= 0) {
        const dx = souris.x - ox,
          dy = oy - souris.y; // repère du shader : y vers le haut
        const d = Math.hypot(dx, dy);
        const k = Math.min(1, d / (H * 0.45)) / Math.max(d, 1);
        gx = dx * k;
        gy = dy * k;
      } else {
        // personne ne bouge encore : l'Œil cherche, lentement
        const s = (maintenant - debut) / 1000;
        gx = Math.sin(s * 0.37) * 0.6;
        gy = Math.sin(s * 0.23) * 0.25 - 0.2;
      }
      const lissage = 1 - Math.exp(-dt * 7);
      regard.x += (gx - regard.x) * lissage;
      regard.y += (gy - regard.y) * lissage;
      const vif = Math.min(1, souris.vitesse / (H * 0.6));
      souris.vitesse *= Math.exp(-dt * 6);
      const cible = (0.075 - 0.035 * vif - 0.025 * eclat) * (1 + 0.08 * Math.sin(maintenant * 0.0021));
      pupille += (cible - pupille) * (1 - Math.exp(-dt * 6));
      eclat = Math.max(0, eclat - dt * 0.9);

      gl.uniform2f(U.res, w, h);
      gl.uniform1f(U.t, (maintenant - debut) / 1000);
      gl.uniform1f(U.tx, axeTour(w, h));
      gl.uniform2f(U.regard, regard.x, regard.y);
      gl.uniform1f(U.pupille, pupille);
      gl.uniform1f(U.eclat, eclat);
      gl.uniform1f(U.gauche, W / H > 1.25 ? 1 : 0.5);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      image = requestAnimationFrame(dessiner);
    };
    image = requestAnimationFrame(dessiner);

    const perdu = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(image);
      onEchec();
    };
    cv.addEventListener('webglcontextlost', perdu);
    return () => {
      cancelAnimationFrame(image);
      window.removeEventListener('pointermove', bouger);
      window.removeEventListener('pointerdown', cliquer);
      cv.removeEventListener('webglcontextlost', perdu);
      gl.deleteBuffer(tampon);
      gl.deleteProgram(prog);
    };
  }, [onEchec]);

  return <canvas ref={ref} className="scene-titre" aria-hidden="true" />;
}

/** Vrai si le navigateur sait faire du WebGL 2 (sinon, le décor SVG). */
export function useWebGL2(): [boolean, () => void] {
  const [ok, setOk] = useState(() => {
    try {
      return Boolean(document.createElement('canvas').getContext('webgl2'));
    } catch {
      return false;
    }
  });
  return [ok, useCallback(() => setOk(false), [])];
}
