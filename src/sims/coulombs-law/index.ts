import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num } from '../types';
import { coulomb } from '../../physics/electricity';
import { k as kC } from '../../physics/constants';
import { C } from '../../engine/colors';
import { n } from '../shared';

const CM = 0.01;

const sim: SimDefinition = {
  camera: { position: [0, 4, 11], target: [0, 0, 0], aspect: 1.5 },
  timeless: true,
  hint: 'Like charges repel, unlike attract. With three charges, the net force on each is the vector sum of the pairwise forces.',
  params: [
    { kind: 'slider', key: 'count', label: 'Number of charges', min: 2, max: 3, step: 1, default: 2 },
    { kind: 'slider', key: 'q1', label: 'Charge q₁', unit: 'µC', min: -10, max: 10, step: 0.1, default: 3 },
    { kind: 'slider', key: 'q2', label: 'Charge q₂', unit: 'µC', min: -10, max: 10, step: 0.1, default: -2 },
    { kind: 'slider', key: 'q3', label: 'Charge q₃', unit: 'µC', min: -10, max: 10, step: 0.1, default: 1, showIf: (p) => p.count === 3 },
    { kind: 'slider', key: 'r', label: 'Distance q₁–q₂', unit: 'cm', min: 1, max: 20, step: 0.1, default: 10 },
    { kind: 'slider', key: 'y3', label: 'Height of q₃ above the line', unit: 'cm', min: -10, max: 10, step: 0.1, default: 6, showIf: (p) => p.count === 3 },
    { kind: 'slider', key: 'eps', label: 'Relative permittivity εᵣ', min: 1, max: 80, step: 1, default: 1, hint: 'Air ≈ 1, water ≈ 80' },
  ],
  presets: [
    { label: 'Attraction', values: { count: 2, q1: 3, q2: -2, r: 10 } },
    { label: 'Repulsion', values: { count: 2, q1: 3, q2: 2, r: 10 } },
    { label: 'Half the distance', values: { count: 2, r: 5 } },
    { label: 'Three charges', values: { count: 3, q1: 2, q2: -2, q3: 1, y3: 6 } },
    { label: 'In water', values: { eps: 80 } },
  ],
  graphs: [
    { id: 'Fr', title: 'Force between q₁ and q₂ vs distance', x: 'r (cm)', y: 'F (N)', kind: 'curve', xRange: [1, 20], zeroY: true, series: [{ label: 'F = kq₁q₂/εᵣr²', color: C.force }] },
  ],
  learn: {
    concept: 'Coulomb’s law: the force between two point charges is proportional to the product of the charges and inversely proportional to the square of the distance between them, F = (1/4πε₀εᵣ)·q₁q₂/r². The force acts along the line joining them. Forces from several charges add as vectors (superposition).',
    variables: [['F', 'force (N); + repulsive, − attractive'], ['q₁, q₂', 'charges (C)'], ['r', 'separation (m)'], ['k', '1/4πε₀ = 8.99 × 10⁹ N·m²/C²'], ['εᵣ', 'relative permittivity of the medium']],
    observe: [
      'Halving the distance makes the force four times larger.',
      'The two force arrows are always equal and opposite (Newton’s third law).',
      'In water (εᵣ = 80) the force is 80 times weaker — why salt dissolves.',
      'With three charges each net force is the vector sum of two pair forces.',
    ],
    challenge: 'At what distance do two 1 µC charges in air repel each other with exactly 1 N?',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    kit.grid(24, 24, 'xz', -1);
    const group = kit.add(new THREE.Group());

    function charges() {
      const r = num(p, 'r');
      const list = [
        { q: num(p, 'q1') * 1e-6, x: -r / 2, y: 0 },
        { q: num(p, 'q2') * 1e-6, x: r / 2, y: 0 },
      ];
      if (num(p, 'count') === 3) list.push({ q: num(p, 'q3') * 1e-6, x: 0, y: num(p, 'y3') });
      return list;
    }
    function forces() {
      const qs = charges();
      return qs.map((a, i) => {
        let fx = 0, fy = 0;
        qs.forEach((b, j) => {
          if (i === j) return;
          const dx = (a.x - b.x) * CM, dy = (a.y - b.y) * CM;
          const d = Math.hypot(dx, dy);
          if (d === 0) return;
          const F = coulomb(a.q, b.q, d) / num(p, 'eps');
          fx += (F * dx) / d; fy += (F * dy) / d;
        });
        return { fx, fy, mag: Math.hypot(fx, fy) };
      });
    }

    function draw() {
      kit.clearGroup(group);
      const qs = charges();
      const fs = forces();
      const S = 0.3; // scene units per cm
      const fmax = Math.max(...fs.map((f) => f.mag), 1e-12);
      qs.forEach((c, i) => {
        const pos = new THREE.Vector3(c.x * S, 0, -c.y * S);
        const rad = 0.2 + 0.12 * Math.cbrt(Math.abs(c.q) / 1e-6);
        const s = kit.sphere(rad, c.q > 0 ? C.positive : c.q < 0 ? C.negative : '#94a3b8', { emissive: 0.35 });
        s.position.copy(pos);
        group.add(s);
        group.add(kit.label(`q${'₁₂₃'[i]} = ${n(c.q * 1e6, 2)} µC`, pos.clone().add(new THREE.Vector3(0, rad + 0.4, 0)), { small: true }));
        const f = fs[i];
        if (f.mag > 0) {
          const len = 0.5 + 2.5 * (f.mag / fmax);
          const a = kit.arrow(C.force, { radius: 0.045 });
          a.set(pos, [(f.fx / f.mag) * len, 0, (-f.fy / f.mag) * len], `F = ${n(f.mag)} N`);
          group.add(a);
        }
      });
      if (qs.length === 2) {
        const r = num(p, 'r') * S;
        const l = kit.line('#94a3b8', [[-r / 2, -0.6, 0], [r / 2, -0.6, 0]], { dashed: true, width: 1.2 });
        group.add(l, kit.label(`r = ${n(num(p, 'r'))} cm`, [0, -0.9, 0], { small: true }));
      }
      const G = graphs.get('Fr');
      G.plot(0, 1, 20, (rc) => coulomb(num(p, 'q1') * 1e-6, num(p, 'q2') * 1e-6, rc * CM) / num(p, 'eps'), 200);
      G.setMarkers([{ x: num(p, 'r'), y: coulomb(num(p, 'q1') * 1e-6, num(p, 'q2') * 1e-6, num(p, 'r') * CM) / num(p, 'eps'), color: C.force }]);
    }
    draw();

    return {
      setParams(np) { p = np; draw(); },
      reset() { draw(); },
      step() {},
      readouts(): Readout[] {
        const F12 = coulomb(num(p, 'q1') * 1e-6, num(p, 'q2') * 1e-6, num(p, 'r') * CM) / num(p, 'eps');
        const fs = forces();
        const out: Readout[] = [
          { label: 'Force between q₁ and q₂', value: Math.abs(F12), unit: 'N', tone: 'accent' },
          { label: 'Nature', value: F12 > 0 ? 'Repulsive' : F12 < 0 ? 'Attractive' : 'No force' },
        ];
        fs.forEach((f, i) => out.push({ label: `Net force on q${'₁₂₃'[i]}`, value: f.mag, unit: 'N' }));
        return out;
      },
      equations(): Equation[] {
        const q1 = num(p, 'q1') * 1e-6, q2 = num(p, 'q2') * 1e-6, r = num(p, 'r') * CM;
        return [
          { expr: 'F = k q₁ q₂ / (εᵣ r²)', sub: `= ${n(kC)} × ${n(q1)} × ${n(q2)} / (${n(num(p, 'eps'))} × ${n(r)}²) = ${n(coulomb(q1, q2, r) / num(p, 'eps'))} N` },
          { expr: 'k = 1/4πε₀ = 8.99 × 10⁹ N·m²/C²' },
          { expr: 'F_net = Σ Fᵢ  (vector sum)' },
        ];
      },
    };
  },
};

export default sim;
