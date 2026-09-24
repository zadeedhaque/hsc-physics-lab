import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { bool, num } from '../types';
import { travelling } from '../../physics/waves';
import { C } from '../../engine/colors';
import { n } from '../shared';

const SPAN = 14;

const sim: SimDefinition = {
  camera: { position: [0, 0.5, 13], target: [0, 0.3, 0], aspect: 1.8 },
  hint: 'Nodes (red) never move; antinodes (green) swing the most. The pattern does not travel.',
  params: [
    { kind: 'slider', key: 'n', label: 'Harmonic n (loops)', min: 1, max: 8, step: 1, default: 3 },
    { kind: 'slider', key: 'L', label: 'Length between fixed ends', unit: 'm', min: 0.5, max: 4, step: 0.05, default: 2 },
    { kind: 'slider', key: 'v', label: 'Wave speed', unit: 'm/s', min: 0.5, max: 50, step: 0.5, default: 4 },
    { kind: 'slider', key: 'A', label: 'Amplitude of each travelling wave', unit: 'm', min: 0.01, max: 0.15, step: 0.005, default: 0.06 },
    { kind: 'toggle', key: 'comps', label: 'Show the two travelling waves', default: false },
  ],
  presets: [
    { label: 'Fundamental (n = 1)', values: { n: 1 } },
    { label: '2nd harmonic', values: { n: 2 } },
    { label: '3rd harmonic', values: { n: 3 } },
    { label: 'Show components', values: { comps: true, n: 2 } },
  ],
  graphs: [
    { id: 'y', title: 'Displacement along the string (now)', x: 'x (m)', y: 'y (m)', kind: 'curve', zeroY: true, series: [{ label: 'standing wave', color: C.weight }, { label: 'envelope', color: '#94a3b8', dashed: true }] },
  ],
  learn: {
    concept: 'A standing (stationary) wave forms when two identical waves travel in opposite directions. Points that never move are nodes; points of maximum vibration are antinodes, λ/2 apart. On a string fixed at both ends only whole numbers of half-wavelengths fit: L = nλ/2, so fₙ = nv/2L.',
    variables: [['n', 'harmonic number (number of loops)'], ['L', 'length of string (m)'], ['λₙ', '2L/n (m)'], ['fₙ', 'nv/2L (Hz)'], ['v', 'wave speed (m/s)']],
    observe: [
      'The number of loops equals the harmonic number.',
      'Adjacent nodes are half a wavelength apart.',
      'All points between two nodes move in phase; neighbouring loops are opposite.',
      'Energy is not carried along a standing wave.',
    ],
    challenge: 'A 1.5 m string has v = 60 m/s. Which harmonic has a frequency of 80 Hz?',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0;
    const string = kit.line(C.weight, [], { width: 3.5 });
    const c1 = kit.line(C.accent, [], { width: 1.5, opacity: 0.6 });
    const c2 = kit.line(C.acceleration, [], { width: 1.5, opacity: 0.6 });
    const env = kit.line('#94a3b8', [], { dashed: true, width: 1 });
    const env2 = kit.line('#94a3b8', [], { dashed: true, width: 1 });
    const markers = kit.add(new THREE.Group());
    const clampL = kit.box(0.25, 1.4, 0.6, '#475569');
    const clampR = kit.box(0.25, 1.4, 0.6, '#475569');
    clampL.position.set(-SPAN / 2 - 0.12, 0, 0); clampR.position.set(SPAN / 2 + 0.12, 0, 0);

    const lam = () => (2 * num(p, 'L')) / num(p, 'n');
    const f = () => num(p, 'v') / lam();
    const sc = () => SPAN / num(p, 'L');
    const ys = () => 1.6 / Math.max(num(p, 'A') * 2, 0.02) * 0.6;
    const yWave = (x: number, tt: number) => travelling(num(p, 'A'), lam(), f(), x, tt) + travelling(num(p, 'A'), lam(), f(), -x, tt, Math.PI);

    function build() {
      kit.clearGroup(markers);
      const nn = num(p, 'n');
      for (let k = 0; k <= nn; k++) {
        const x = -SPAN / 2 + (k / nn) * SPAN;
        const m = kit.sphere(0.1, C.friction, { emissive: 0.4 });
        m.position.set(x, 0, 0);
        markers.add(m, kit.label('N', [x, -0.4, 0], { color: C.friction, small: true }));
      }
      for (let k = 0; k < nn; k++) {
        const x = -SPAN / 2 + ((k + 0.5) / nn) * SPAN;
        markers.add(kit.label('A', [x, -1.8, 0], { color: C.normal, small: true }));
      }
      const envPts: [number, number, number][] = [], envNeg: [number, number, number][] = [];
      for (let i = 0; i <= 200; i++) {
        const x = (i / 200) * num(p, 'L');
        const a = 2 * num(p, 'A') * Math.abs(Math.sin((2 * Math.PI * x) / lam())) * ys();
        envPts.push([-SPAN / 2 + x * sc(), a, 0]); envNeg.push([-SPAN / 2 + x * sc(), -a, 0]);
      }
      env.setPoints(envPts); env2.setPoints(envNeg);
      graphs.get('y').plot(1, 0, num(p, 'L'), (x) => 2 * num(p, 'A') * Math.abs(Math.sin((2 * Math.PI * x) / lam())), 200);
    }
    build();

    return {
      setParams(np) { p = np; build(); },
      reset() { t = 0; },
      step(dt) { t += dt * Math.min(1, 2 / f()); }, // keep high harmonics watchable
      render() {
        const pts: THREE.Vector3[] = [], a: THREE.Vector3[] = [], b: THREE.Vector3[] = [];
        for (let i = 0; i <= 300; i++) {
          const x = (i / 300) * num(p, 'L');
          const X = -SPAN / 2 + x * sc();
          pts.push(new THREE.Vector3(X, yWave(x, t) * ys(), 0));
          a.push(new THREE.Vector3(X, travelling(num(p, 'A'), lam(), f(), x, t) * ys(), -0.2));
          b.push(new THREE.Vector3(X, travelling(num(p, 'A'), lam(), f(), -x, t, Math.PI) * ys(), -0.2));
        }
        string.setPoints(pts);
        c1.visible = c2.visible = bool(p, 'comps');
        if (bool(p, 'comps')) { c1.setPoints(a); c2.setPoints(b); }
        graphs.get('y').plot(0, 0, num(p, 'L'), (x) => yWave(x, t), 200);
      },
      time: () => t,
      readouts(): Readout[] {
        return [
          { label: 'Wavelength λ = 2L/n', value: lam(), unit: 'm', tone: 'accent' },
          { label: 'Frequency fₙ = nv/2L', value: f(), unit: 'Hz', tone: 'accent' },
          { label: 'Fundamental f₁', value: num(p, 'v') / (2 * num(p, 'L')), unit: 'Hz' },
          { label: 'Node spacing λ/2', value: lam() / 2, unit: 'm' },
          { label: 'Nodes', value: num(p, 'n') + 1 },
          { label: 'Antinodes', value: num(p, 'n') },
          { label: 'Max amplitude 2A', value: 2 * num(p, 'A'), unit: 'm' },
        ];
      },
      equations(): Equation[] {
        return [
          { expr: 'y = 2A sin(kx) cos(ωt)', note: 'Sum of y₁ = A sin(kx − ωt) and y₂ = A sin(kx + ωt) (with the reflection phase).' },
          { expr: 'L = n λ / 2', sub: `λ = 2 × ${n(num(p, 'L'))} / ${num(p, 'n')} = ${n(lam())} m` },
          { expr: 'fₙ = n v / 2L', sub: `f = ${num(p, 'n')} × ${n(num(p, 'v'))} / (2 × ${n(num(p, 'L'))}) = ${n(f())} Hz` },
        ];
      },
    };
  },
};

export default sim;
