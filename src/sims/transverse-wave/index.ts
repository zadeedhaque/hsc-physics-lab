import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { bool, num, str } from '../types';
import { travelling, waveNumber } from '../../physics/waves';
import { C } from '../../engine/colors';
import { n, sampler } from '../shared';

const L = 6; // metres of medium shown
const S = 16 / L; // scene units per metre
const N = 81; // particles
const TRACK_I = 20; // index of the highlighted particle

const sim: SimDefinition = {
  camera: { position: [0, 2.2, 13], target: [0, 0, 0], aspect: 1.9 },
  hint: 'Each bead only moves up and down — the wave shape is what travels.',
  params: [
    { kind: 'slider', key: 'A', label: 'Amplitude', unit: 'm', min: 0.05, max: 0.8, step: 0.01, default: 0.4 },
    { kind: 'slider', key: 'lambda', label: 'Wavelength λ', unit: 'm', min: 0.5, max: 6, step: 0.05, default: 2 },
    { kind: 'slider', key: 'f', label: 'Frequency f', unit: 'Hz', min: 0.1, max: 3, step: 0.05, default: 0.5 },
    { kind: 'select', key: 'dir', label: 'Direction of travel', default: 'right', options: [{ value: 'right', label: '→ +x' }, { value: 'left', label: '← −x' }] },
    { kind: 'slider', key: 'phase', label: 'Initial phase φ', unit: '°', min: 0, max: 360, step: 5, default: 0 },
    { kind: 'toggle', key: 'marks', label: 'Show wavelength & amplitude marks', default: true },
  ],
  presets: [
    { label: 'Standard', values: { A: 0.4, lambda: 2, f: 0.5 } },
    { label: 'Short λ', values: { A: 0.3, lambda: 0.8, f: 1 } },
    { label: 'Long λ', values: { A: 0.5, lambda: 5, f: 0.3 } },
    { label: 'High frequency', values: { A: 0.25, lambda: 1.5, f: 2 } },
  ],
  graphs: [
    { id: 'yt', title: 'Displacement of the red particle vs time', x: 't (s)', y: 'y (m)', window: 6, series: [{ label: 'y(t) at red bead', color: C.friction }] },
    { id: 'yx', title: 'Snapshot: displacement vs position', x: 'x (m)', y: 'y (m)', kind: 'curve', xRange: [0, L], series: [{ label: 'y(x) now', color: C.accent }] },
  ],
  learn: {
    concept: 'In a transverse wave the particles of the medium oscillate perpendicular to the direction the wave travels. The wave moves one wavelength in one period, so v = fλ. The speed depends on the medium; the frequency is set by the source.',
    variables: [['A', 'amplitude (m)'], ['λ', 'wavelength (m)'], ['f', 'frequency (Hz)'], ['T', 'period = 1/f (s)'], ['v', 'wave speed (m/s)'], ['k', 'wave number 2π/λ (rad/m)']],
    observe: [
      'The red bead goes up and down but never moves along the string.',
      'Doubling f halves the period; with λ fixed the wave travels twice as fast.',
      'The y–t graph of one bead and the y–x snapshot are both sine curves — but with different horizontal axes.',
      'Crests are exactly one wavelength apart.',
    ],
    challenge: 'Set λ = 2 m. Find the frequency that makes the wave travel at 1.5 m/s, then verify by timing a crest moving 3 m.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0;
    const sample = sampler(1 / 30);
    const xs = Array.from({ length: N }, (_, i) => (i / (N - 1)) * L);

    kit.line('#64748b', [[-8.4, 0, 0], [8.4, 0, 0]], { dashed: true, width: 1, opacity: 0.6 });
    const post = kit.cylinder(0.08, 0.08, 3.4, '#475569');
    post.position.set(-8.25, 0, 0);
    const beads = xs.map((_, i) => kit.sphere(i === TRACK_I ? 0.13 : 0.08, i === TRACK_I ? C.friction : '#cbd5e1', undefined, 16));
    const string = kit.line(C.accent, [], { width: 2.5 });
    const trackV = kit.arrow(C.velocity, { label: 'v_particle', radius: 0.03 });
    const waveV = kit.arrow(C.resultant, { label: 'wave velocity', radius: 0.04 });
    const lamLine = kit.line(C.weight, [], { width: 1.5 });
    const lamLabel = kit.label('', [0, 0, 0], { color: C.weight, small: true });
    const ampLine = kit.line(C.normal, [], { width: 1.5 });
    const ampLabel = kit.label('', [0, 0, 0], { color: C.normal, small: true });
    for (let m = 0; m <= L; m++) kit.label(`${m}`, [-8 + m * S, -1.9, 0], { small: true });
    kit.label('x (m)', [8.9, -1.9, 0], { small: true, className: 'plain' });

    const dirSign = () => (str(p, 'dir') === 'left' ? -1 : 1);
    const y = (x: number, time: number) => {
      const s = dirSign();
      return travelling(num(p, 'A'), num(p, 'lambda'), num(p, 'f'), s * x, time, (num(p, 'phase') * Math.PI) / 180);
    };
    const X = (x: number) => -8 + x * S;

    return {
      setParams(np) { p = np; },
      reset() { t = 0; sample.reset(); },
      step(dt) {
        t += dt;
        if (sample.due(t)) graphs.get('yt').push(t, y(xs[TRACK_I], t));
      },
      render() {
        const pts: THREE.Vector3[] = [];
        xs.forEach((x, i) => {
          const yy = y(x, t) * S;
          beads[i].position.set(X(x), yy, 0);
          pts.push(new THREE.Vector3(X(x), yy, 0));
        });
        string.setPoints(pts);
        post.position.y = y(0, t) * S;
        // particle velocity of the tracked bead (numerical derivative)
        const h = 1e-3;
        const vp = (y(xs[TRACK_I], t + h) - y(xs[TRACK_I], t - h)) / (2 * h);
        trackV.set(beads[TRACK_I].position, [0, vp * S * 0.35, 0]);
        const v = num(p, 'f') * num(p, 'lambda');
        waveV.set([dirSign() > 0 ? 4 : 6.5, 2.7, 0], [dirSign() * Math.min(2.5, 0.6 + v * 0.35), 0, 0], `v = ${n(v)} m/s`);

        const marks = bool(p, 'marks');
        lamLine.visible = lamLabel.visible = ampLine.visible = ampLabel.visible = marks;
        if (marks) {
          // find first crest position at current time
          const k = waveNumber(num(p, 'lambda'));
          const w = 2 * Math.PI * num(p, 'f');
          const ph = (num(p, 'phase') * Math.PI) / 180;
          // crest: s·k x − ωt + φ = π/2 + 2πm
          let xc = ((Math.PI / 2 + w * t - ph) / k) * dirSign();
          const lam = num(p, 'lambda');
          xc = ((xc % lam) + lam) % lam;
          const A = num(p, 'A') * S;
          if (xc + lam <= L) {
            lamLine.setPoints([[X(xc), A + 0.35, 0], [X(xc + lam), A + 0.35, 0]]);
            lamLabel.at([X(xc + lam / 2), A + 0.65, 0]).setText(`λ = ${n(lam)} m`);
          } else { lamLine.visible = false; lamLabel.visible = false; }
          ampLine.setPoints([[X(xc), 0, 0.02], [X(xc), A, 0.02]]);
          ampLabel.at([X(xc) + 0.55, A / 2, 0]).setText(`A`);
        }
        graphs.get('yx').plot(0, 0, L, (x) => y(x, t), 160);
      },
      time: () => t,
      readouts(): Readout[] {
        const f = num(p, 'f'), lam = num(p, 'lambda');
        return [
          { label: 'Wave speed v = fλ', value: f * lam, unit: 'm/s', tone: 'accent' },
          { label: 'Period T', value: 1 / f, unit: 's' },
          { label: 'Angular frequency ω', value: 2 * Math.PI * f, unit: 'rad/s' },
          { label: 'Wave number k', value: waveNumber(lam), unit: 'rad/m' },
          { label: 'Max particle speed Aω', value: num(p, 'A') * 2 * Math.PI * f, unit: 'm/s' },
          { label: 'Red bead displacement', value: y(xs[TRACK_I], t), unit: 'm' },
        ];
      },
      equations(): Equation[] {
        const f = num(p, 'f'), lam = num(p, 'lambda'), A = num(p, 'A');
        const sgn = dirSign() > 0 ? '−' : '+';
        return [
          { expr: 'v = f λ', sub: `v = ${n(f)} × ${n(lam)} = ${n(f * lam)} m/s` },
          { expr: `y = A sin(kx ${sgn} ωt + φ)`, sub: `y = ${n(A)} sin(${n(waveNumber(lam))}x ${sgn} ${n(2 * Math.PI * f)}t + ${num(p, 'phase')}°)` },
          { expr: 'k = 2π/λ ,  ω = 2πf ,  T = 1/f', sub: `T = ${n(1 / f)} s` },
        ];
      },
    };
  },
};

export default sim;
