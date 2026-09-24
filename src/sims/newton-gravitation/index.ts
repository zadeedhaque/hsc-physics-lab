import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { gravForce } from '../../physics/gravitation';
import { Mearth } from '../../physics/constants';
import { C } from '../../engine/colors';
import { n } from '../shared';

const SCEN = {
  lab: { m1: 'kg', m2: 'kg', r: 'm', mScale: 1, rScale: 1 },
  space: { m1: 'Earth masses', m2: 'Earth masses', r: '× 10⁶ km', mScale: Mearth, rScale: 1e9 },
} as const;

const sim: SimDefinition = {
  camera: { position: [0, 2, 11], target: [0, 0.3, 0], aspect: 1.7 },
  timeless: true,
  hint: 'The two force arrows are always equal in size — each mass pulls the other just as hard.',
  params: [
    { kind: 'select', key: 'scale', label: 'Scale', default: 'lab', options: [{ value: 'lab', label: 'Laboratory (Cavendish)' }, { value: 'space', label: 'Astronomical' }] },
    { kind: 'slider', key: 'm1', label: 'Mass m₁', min: 0.1, max: 1000, step: 0.1, default: 150 },
    { kind: 'slider', key: 'm2', label: 'Mass m₂', min: 0.1, max: 1000, step: 0.1, default: 1 },
    { kind: 'slider', key: 'r', label: 'Separation r (centre to centre)', min: 0.2, max: 10, step: 0.05, default: 0.5 },
  ],
  presets: [
    { label: 'Cavendish balance', values: { scale: 'lab', m1: 158, m2: 0.73, r: 0.23 } },
    { label: 'Two people', values: { scale: 'lab', m1: 70, m2: 60, r: 1 } },
    { label: 'Earth–Moon', values: { scale: 'space', m1: 1, m2: 0.0123, r: 0.384 } },
    { label: 'Double the distance', values: { r: 1 } },
  ],
  graphs: [
    { id: 'Fr', title: 'Gravitational force vs separation', x: 'r', y: 'F (N)', kind: 'curve', zeroY: true, series: [{ label: 'F = Gm₁m₂/r²', color: C.force }] },
  ],
  learn: {
    concept: 'Every particle attracts every other with a force directly proportional to the product of their masses and inversely proportional to the square of the distance between them: F = Gm₁m₂/r². G is tiny, so the force between everyday objects is minute, yet it holds planets in orbit.',
    variables: [['F', 'gravitational force (N)'], ['G', '6.674 × 10⁻¹¹ N·m²/kg²'], ['m₁, m₂', 'masses (kg)'], ['r', 'distance between centres (m)']],
    observe: [
      'Doubling r divides F by four (inverse-square law).',
      'Doubling either mass doubles F.',
      'The forces on the two bodies are equal and opposite (Newton’s third law), whatever their masses.',
    ],
    challenge: 'In the Cavendish preset, how many times smaller than the weight of the small ball is the attraction? (weight = m₂g)',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    kit.grid(14, 14, 'xz', -1.6);
    const b1 = kit.sphere(1, '#94a3b8', { metalness: 0.5, roughness: 0.3 });
    const b2 = kit.sphere(1, '#cbd5e1', { metalness: 0.5, roughness: 0.3 });
    const f1 = kit.arrow(C.force, { label: 'F', radius: 0.05 });
    const f2 = kit.arrow(C.force, { label: 'F', radius: 0.05 });
    const dist = kit.line('#94a3b8', [], { dashed: true, width: 1.5 });
    const rLabel = kit.label('', [0, 0, 0], { small: true });
    const l1 = kit.label('', [0, 0, 0], { small: true });
    const l2 = kit.label('', [0, 0, 0], { small: true });

    const sc = () => SCEN[str(p, 'scale') as keyof typeof SCEN] ?? SCEN.lab;
    const F = () => gravForce(num(p, 'm1') * sc().mScale, num(p, 'm2') * sc().mScale, num(p, 'r') * sc().rScale);

    function draw() {
      const r = num(p, 'r');
      const d = 2.5 + (r / 10) * 7; // visual separation grows with r (not to scale)
      const s1 = 0.3 + 0.9 * Math.cbrt(num(p, 'm1') / 1000);
      const s2 = 0.3 + 0.9 * Math.cbrt(num(p, 'm2') / 1000);
      b1.scale.setScalar(s1); b1.position.set(-d / 2, 0, 0);
      b2.scale.setScalar(s2); b2.position.set(d / 2, 0, 0);
      const Fv = F();
      const Fref = gravForce(1000 * sc().mScale, 1000 * sc().mScale, 0.2 * sc().rScale);
      const len = 0.4 + 2.2 * Math.max(0, 1 + Math.log10(Math.max(Fv / Fref, 1e-12)) / 6);
      f1.set([-d / 2 + s1, 0, 0], [len, 0, 0], `F = ${n(Fv)} N`);
      f2.set([d / 2 - s2, 0, 0], [-len, 0, 0], `F = ${n(Fv)} N`);
      dist.setPoints([[-d / 2, -1.3, 0], [d / 2, -1.3, 0]]);
      rLabel.at([0, -1.6, 0]).setText(`r = ${n(r)} ${sc().r}`);
      l1.at([-d / 2, s1 + 0.4, 0]).setText(`m₁ = ${n(num(p, 'm1'))} ${sc().m1}`);
      l2.at([d / 2, s2 + 0.4, 0]).setText(`m₂ = ${n(num(p, 'm2'))} ${sc().m2}`);
      const G = graphs.get('Fr');
      G.plot(0, 0.2, 10, (rr) => gravForce(num(p, 'm1') * sc().mScale, num(p, 'm2') * sc().mScale, rr * sc().rScale), 200);
      G.setMarkers([{ x: r, y: Fv, color: C.force }]);
    }
    draw();

    return {
      setParams(np) { p = np; draw(); },
      reset() { draw(); },
      step() {},
      readouts(): Readout[] {
        const m2kg = num(p, 'm2') * sc().mScale;
        return [
          { label: 'Gravitational force F', value: F(), unit: 'N', tone: 'accent' },
          { label: 'Acceleration of m₁', value: F() / (num(p, 'm1') * sc().mScale), unit: 'm/s²' },
          { label: 'Acceleration of m₂', value: F() / m2kg, unit: 'm/s²' },
          { label: 'Weight of m₂ on Earth', value: m2kg * 9.81, unit: 'N' },
          { label: 'F / weight of m₂', value: F() / (m2kg * 9.81) },
        ];
      },
      equations(): Equation[] {
        const s = sc();
        return [
          { expr: 'F = G m₁ m₂ / r²', sub: `F = 6.674×10⁻¹¹ × ${n(num(p, 'm1') * s.mScale)} × ${n(num(p, 'm2') * s.mScale)} / (${n(num(p, 'r') * s.rScale)})² = ${n(F())} N` },
          { expr: 'G = 6.674 × 10⁻¹¹ N·m²/kg²' },
          { expr: 'F ∝ 1/r²', note: 'Distances in the 3D view are not to scale.' },
        ];
      },
    };
  },
};

export default sim;
