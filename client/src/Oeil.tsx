/**
 * L'Œil : champ de feu calculé par pixel, pupille fendue vectorielle, braises
 * (direction artistique, 5 bis). Portage direct de eyeField / drawEye de la
 * maquette. Le champ est petit (176 × 110) : le calcul tient sur le CPU et se
 * portera tel quel en shader.
 */
import { useEffect, useRef } from 'react';
import { bus, OEIL_Y, regard } from './bus';
import { cl, fbm, smooth, toile } from './carte/bruit';
import { useJeu } from './store';

const EW = 216,
  EH = 136,
  FW = 176,
  FH = 110;
/** Demi-largeur / demi-hauteur de l'amande (unités : demi-largeur du canevas). */
const EA = 0.6,
  EB = 0.25;

function distanceAmande(x: number, y: number) {
  const ax = Math.abs(x) / EA;
  if (ax < 1) return Math.abs(y) - EB * Math.pow(1 - ax * ax, 0.72);
  return Math.hypot(Math.abs(x) - EA, y);
}

export function Oeil() {
  const ref = useRef<HTMLCanvasElement>(null);
  const ombre = useJeu((s) => s.mode === 'ombre');
  const phase = useJeu((s) => s.vue.phase);
  const repousse = useJeu((s) => Boolean(s.vue.oeil?.repousse));

  useEffect(() => {
    const cv = ref.current!;
    const ex = cv.getContext('2d')!;
    const EF = toile(FW, FH),
      efx = EF.getContext('2d')!,
      efi = efx.createImageData(FW, FH);
    let flare = 0,
      pupW = 0.07,
      last = performance.now(),
      raf = 0;
    const g = { x: 0, y: 0 };
    const braises: { x: number; y: number; vx: number; vy: number; l: number }[] = [];
    const off = bus.on('flare', (v) => (flare = Math.max(flare, v)));

    const champ = (t: number) => {
      const D = efi.data,
        ts = t * 0.001,
        gx = g.x * 0.11,
        gy = g.y * 0.05,
        fl = 1 + flare * 0.6;
      for (let j = 0; j < FH; j++)
        for (let i = 0; i < FW; i++) {
          const x = (i - FW / 2) / (FW / 2),
            y = (j - FH / 2) / (FW / 2),
            k = (j * FW + i) * 4,
            d = distanceAmande(x, y);
          if (d < 0) {
            // iris : feu qui tourbillonne et rayonne depuis la pupille
            const dx = x - gx,
              dy = (y - gy) * 2.1,
              r = Math.hypot(dx, dy) / EA,
              a = Math.atan2(dy, dx);
            const fib = fbm(Math.cos(a) * 2.2 + 7, Math.sin(a) * 2.2 + r * 3.2 - ts * 1.1, 3),
              sw = fbm(x * 7 + ts * 0.4, y * 7 - ts * 0.7, 2);
            let h = 1.12 - r * 1.15 + (fib - 0.5) * 1.4 + (sw - 0.5) * 0.5;
            h *= 0.35 + 0.65 * smooth(0, 0.09, -d);
            h *= fl;
            D[k] = 255 * cl(h * 2.1 + 0.22);
            D[k + 1] = 255 * cl(h * 2.1 - 0.85) * 0.84;
            D[k + 2] = 255 * cl(h * 2.1 - 1.85) * 0.66;
            D[k + 3] = 255;
          } else if (d < 0.5) {
            // couronne de flammes qui montent
            const up = y < 0 ? 1 : 0.4,
              L = 0.08 + 0.15 * up + (0.07 * Math.abs(x)) / EA;
            const n = fbm(x * 5.2 + Math.sin(ts * 0.7 + y * 3) * 0.15, y * 4.6 + ts * 2.1, 3);
            let I = (n * 2.0 - 0.55) * fl - d / L + 0.7 * Math.exp(-d / 0.025);
            if (d < 0.018) I *= 0.15 + (0.85 * d) / 0.018; // paupière sombre qui dessine l'amande
            D[k] = 255 * cl(I * 2.1);
            D[k + 1] = 255 * cl(I * 2.1 - 1) * 0.72;
            D[k + 2] = 255 * cl(I * 2.1 - 2) * 0.5;
            D[k + 3] = 255 * cl(I * 2.4);
          } else D[k + 3] = 0;
        }
      efx.putImageData(efi, 0, 0);
    };

    const image = (t: number) => {
      const dt = Math.min(50, t - last);
      last = t;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(EW * dpr),
        h = Math.round(EH * dpr);
      if (cv.width !== w) {
        cv.width = w;
        cv.height = h;
      }
      // la pupille suit le Regard
      const ax = window.innerWidth / 2,
        an = Math.atan2(regard.y - OEIL_Y, regard.x - ax),
        dd = Math.min(1, Math.hypot(regard.x - ax, regard.y - OEIL_Y) / 500);
      const gaze = { x: Math.cos(an) * dd, y: Math.sin(an) * dd };
      g.x += (gaze.x - g.x) * Math.min(1, dt * 0.008);
      g.y += (gaze.y - g.y) * Math.min(1, dt * 0.008);
      flare = Math.max(0, flare - dt * 0.0009);
      const tw = (regard.verrouille ? 0.032 : 0.075) * (1 + 0.1 * Math.sin(t * 0.0021)) * (1 + flare * 0.5);
      pupW += (tw - pupW) * Math.min(1, dt * 0.006);
      champ(t);

      ex.setTransform(1, 0, 0, 1, 0, 0);
      ex.clearRect(0, 0, w, h);
      const S2 = w / FW;
      ex.imageSmoothingEnabled = true;
      ex.imageSmoothingQuality = 'high';
      ex.globalCompositeOperation = 'lighter';
      ex.globalAlpha = 0.45;
      ex.filter = `blur(${5 * dpr}px)`;
      ex.drawImage(EF, 0, (h - FH * S2) / 2, w, FH * S2);
      ex.filter = 'none';
      ex.globalCompositeOperation = 'source-over';
      ex.globalAlpha = 1;
      ex.drawImage(EF, 0, (h - FH * S2) / 2, w, FH * S2);
      // pupille fendue, vectorielle et nette
      const U = w / 2,
        cx = w / 2 + g.x * 0.11 * U,
        cy = h / 2 + g.y * 0.05 * U,
        ph = EB * U * 1.02,
        pw = pupW * U;
      ex.save();
      ex.translate(cx, cy);
      ex.globalCompositeOperation = 'multiply';
      ex.save();
      ex.scale(1, ph / (pw * 3));
      const gr = ex.createRadialGradient(0, 0, pw * 0.4, 0, 0, pw * 3);
      gr.addColorStop(0, 'rgba(120,10,0,.85)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      ex.fillStyle = gr;
      ex.beginPath();
      ex.arc(0, 0, pw * 3, 0, 6.283);
      ex.fill();
      ex.restore();
      ex.globalCompositeOperation = 'source-over';
      ex.beginPath();
      ex.moveTo(0, -ph);
      ex.quadraticCurveTo(pw * 1.9, 0, 0, ph);
      ex.quadraticCurveTo(-pw * 1.9, 0, 0, -ph);
      ex.closePath();
      ex.shadowColor = 'rgba(255,70,10,.9)';
      ex.shadowBlur = 6 * dpr;
      ex.fillStyle = '#050101';
      ex.fill();
      ex.shadowBlur = 0;
      ex.strokeStyle = 'rgba(255,120,40,.35)';
      ex.lineWidth = 0.8 * dpr;
      ex.stroke();
      ex.restore();
      // braises qui s'échappent
      if (braises.length < 26 && Math.random() < dt * 0.02 * (1 + flare * 3)) {
        const a = Math.random() * 6.283;
        braises.push({
          x: w / 2 + Math.cos(a) * EA * U * 0.8,
          y: h / 2 + Math.sin(a) * EB * U * 0.9,
          vx: (Math.random() - 0.5) * 0.03 * dpr,
          vy: -(0.025 + Math.random() * 0.04) * dpr,
          l: 1,
        });
      }
      ex.globalCompositeOperation = 'lighter';
      for (let i = braises.length - 1; i >= 0; i--) {
        const p = braises[i]!;
        p.x += p.vx * dt + Math.sin(t * 0.004 + i) * 0.15;
        p.y += p.vy * dt;
        p.l -= dt * 0.0011;
        if (p.l <= 0) {
          braises.splice(i, 1);
          continue;
        }
        ex.fillStyle = `rgba(255,${(120 + p.l * 100) | 0},40,${p.l * 0.9})`;
        ex.beginPath();
        ex.arc(p.x, p.y, (0.6 + p.l) * dpr, 0, 6.283);
        ex.fill();
      }
      ex.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(image);
    };
    raf = requestAnimationFrame(image);
    return () => {
      cancelAnimationFrame(raf);
      off();
    };
  }, []);

  const libelle = repousse ? 'Le Regard est repoussé' : phase === 'oeil' ? 'Le Regard erre' : 'Le Regard est posé';
  return (
    <div id="eye">
      <canvas id="eyecv" ref={ref} aria-hidden="true" />
      <div className="lbl" style={{ opacity: ombre ? 0 : 1 }}>
        {libelle}
      </div>
    </div>
  );
}
