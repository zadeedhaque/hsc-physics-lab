import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { travelling } from '../../physics/waves';
import { rad } from '../../lib/num';
import { C } from '../../engine/colors';
import { n } from '../shared';

const L = 8; // metres shown
const SX = 16 / L;

const sim: SimDefinition = {
  camera: { position: [0, 0, 16], target: [0, 0, 0], aspect: 1.7 },
  hint: 'The bottom string is the point-by-point sum of the two above it (principle of superposition).',
  params: [
    { kind: 'slider', key: 'A1', label: 'Amplitude of wave 1', unit: 'm', min: 0, max: 0.6, step: 0.01, default: 0.4 },
    { kind: 'slider', key: 'l1', label: 'Wavelength of wave 1', unit: 'm', min: 0.5, max: 6, step: 0.05, default: 2 },
    { kind: 'slider', key: 'A2', label: 'Amplitude of wave 2', unit: 'm', min: 0, max: 0.6, step: 0.01, default: 0.4 },
    { kind: 'slider', key: 'l2', label: 'Wavelength of wave 2', unit: 'm', min: 0.5, max: 6, step: 0.05, default: 2 },
    { kind: 'slider', key: 'phi', label: 'Phase difference', unit: '°', min: 0, max: 360, step: 5, default: 0 },
    { kind: 'select', key: 'dir', label: 'Wave 2 travels', default: 'same', options: [{ value: 'same', label: 'Same way →' }, { value: 'opp', label: 'Opposite ←' }] },
    { kind: 'slider', key: 'v', label: 'Wave speed', unit: 'm/s', min: 0.2, max: 3, step: 0.1, default: 1 },
  ],
  presets: [
    { label: 'Constructive (in phase)', values: { A1: 0.4, A2: 0.4, l1: 2, l2: 2, phi: 0, dir: 'same' } },
    { label: 'Destructive (180°)', values: { A1: 0.4, A2: 0.4, l1: 2, l2: 2, phi: 180, dir: 'same' } },
    { label: 'Partial (90°)', values: { phi: 90, dir: 'same' } },
    { label: 'Beats in space', values: { l1: 2, l2: 2.3, phi: 0, dir: 'same' } },
    { label: 'Standing wave', values: { l1: 2, l2: 2, dir: 'opp', phi: 0 } },
  ],
  graphs: [
    { id: 'y', title: 'Snapshot: y₁, y₂ and y₁ + y₂', x: 'x (m)', y: 'y (m)', kind: 'curve', xRange: [0, L], yRange: [-1.25, 1.25], series: [{ label: 'y₁', color: C.accent }, { label: 'y₂', color: C.acceleration }, { label: 'y₁ + y₂', color: C.weight }] },
  ],
  learn: {
    concept: 'When two waves overlap, the resultant displacement at every point is the algebraic sum of the individual displacements. In phase, crests meet crests and the waves reinforce (constructive interference); 180° out of phase, crests meet troughs and they cancel (destructive interference).',
    variables: [['y₁, y₂', 'displacements of the two waves'], ['φ', 'phase difference'], ['A', 'resultant amplitude']],
    observe: [
      'Equal waves in phase give double the amplitude; 180° out of phase they vanish.',
      'Slightly different wavelengths make a pattern of groups (beats in space).',
      'Two equal waves moving in opposite directions form a standing wave.',
    ],
    challenge: 'For two equal 0.3 m waves, what phase difference gives a resultant amplitude of 0.3 m? (Use A = 2a cos(φ/2).)',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0;
    const s1 = kit.line(C.accent, [], { width: 2.5 });
    const s2 = kit.line(C.acceleration, [], { width: 2.5 });
    const s3 = kit.line(C.weight, [], { width: 3.5 });
    const axes = kit.segments('#475569', { width: 1, dashed: true });
    axes.setSegments([-8, 3, 0, 8, 3, 0, -8, 0.5, 0, 8, 0.5, 0, -8, -2.5, 0, 8, -2.5, 0]);
    kit.label('wave 1', [-8.9, 3, 0], { color: C.accent, small: true });
    kit.label('wave 2', [-8.9, 0.5, 0], { color: C.acceleration, small: true });
    kit.label('sum', [-8.9, -2.5, 0], { color: C.weight, small: true });

    const y1 = (x: number, tt: number) => travelling(num(p, 'A1'), num(p, 'l1'), num(p, 'v') / num(p, 'l1'), x, tt);
    const y2 = (x: number, tt: number) => {
      const s = str(p, 'dir') === 'opp' ? -1 : 1;
      return travelling(num(p, 'A2'), num(p, 'l2'), num(p, 'v') / num(p, 'l2'), s * x, tt, rad(num(p, 'phi')));
    };

    return {
      setParams(np) { p = np; },
      reset() { t = 0; },
      step(dt) { t += dt; },
      render() {
        const a: THREE.Vector3[] = [], b: THREE.Vector3[] = [], c: THREE.Vector3[] = [];
        for (let i = 0; i <= 300; i++) {
          const x = (i / 300) * L;
          const X = -8 + x * SX;
          const u = y1(x, t), w = y2(x, t);
          a.push(new THREE.Vector3(X, 3 + u * 2, 0));
          b.push(new THREE.Vector3(X, 0.5 + w * 2, 0));
          c.push(new THREE.Vector3(X, -2.5 + (u + w) * 2, 0));
        }
        s1.setPoints(a); s2.setPoints(b); s3.setPoints(c);
        const G = graphs.get('y');
        G.plot(0, 0, L, (x) => y1(x, t), 200);
        G.plot(1, 0, L, (x) => y2(x, t), 200);
        G.plot(2, 0, L, (x) => y1(x, t) + y2(x, t), 200);
      },
      time: () => t,
      readouts(): Readout[] {
        const a1 = num(p, 'A1'), a2 = num(p, 'A2'), ph = rad(num(p, 'phi'));
        const same = num(p, 'l1') === num(p, 'l2') && str(p, 'dir') === 'same';
        const res = Math.sqrt(a1 * a1 + a2 * a2 + 2 * a1 * a2 * Math.cos(ph));
        let maxNow = 0;
        for (let i = 0; i <= 400; i++) maxNow = Math.max(maxNow, Math.abs(y1((i / 400) * L, t) + y2((i / 400) * L, t)));
        return [
          { label: same ? 'Resultant amplitude' : 'Largest displacement now', value: same ? res : maxNow, unit: 'm', tone: 'accent' },
          { label: 'Interference', value: same ? (Math.abs(Math.cos(ph / 2)) > 0.99 ? 'Fully constructive' : Math.abs(Math.cos(ph / 2)) < 0.01 ? 'Fully destructive' : 'Partial') : str(p, 'dir') === 'opp' ? 'Standing-wave pattern' : 'Changing pattern' },
          { label: 'Path difference for this phase', value: (num(p, 'phi') / 360) * num(p, 'l1'), unit: 'm' },
          { label: 'Wave 1 frequency', value: num(p, 'v') / num(p, 'l1'), unit: 'Hz' },
          { label: 'Wave 2 frequency', value: num(p, 'v') / num(p, 'l2'), unit: 'Hz' },
        ];
      },
      equations(): Equation[] {
        const a1 = num(p, 'A1'), a2 = num(p, 'A2');
        return [
          { expr: 'y = y₁ + y₂  (superposition)' },
          { expr: 'A = √(a₁² + a₂² + 2a₁a₂ cos φ)', sub: `= ${n(Math.sqrt(a1 * a1 + a2 * a2 + 2 * a1 * a2 * Math.cos(rad(num(p, 'phi')))))} m (same λ, same direction)` },
          { expr: 'Constructive: Δ = nλ ,  Destructive: Δ = (n + ½)λ' },
          { expr: 'Phase difference = (2π/λ) × path difference' },
        ];
      },
    };
  },
};

export default sim;
