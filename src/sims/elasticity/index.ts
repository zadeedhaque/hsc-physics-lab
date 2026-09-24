import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { C } from '../../engine/colors';
import { n } from '../shared';

/** Simplified engineering stress–strain model for common wire materials. */
const MATERIALS: Record<string, { name: string; Y: number; yield: number; uts: number; fracture: number; color: string }> = {
  steel: { name: 'Steel', Y: 200e9, yield: 250e6, uts: 400e6, fracture: 0.2, color: '#94a3b8' },
  copper: { name: 'Copper', Y: 117e9, yield: 70e6, uts: 220e6, fracture: 0.35, color: '#d97706' },
  aluminium: { name: 'Aluminium', Y: 69e9, yield: 95e6, uts: 110e6, fracture: 0.12, color: '#cbd5e1' },
  brass: { name: 'Brass', Y: 100e9, yield: 200e6, uts: 350e6, fracture: 0.3, color: '#eab308' },
};

/** Stress (Pa) for a given strain using linear → strain-hardening → necking segments. */
function stressOf(mat: (typeof MATERIALS)[string], strain: number) {
  const ey = mat.yield / mat.Y;
  if (strain <= ey) return mat.Y * strain;
  const eu = mat.fracture * 0.7;
  if (strain <= eu) { const f = (strain - ey) / (eu - ey); return mat.yield + (mat.uts - mat.yield) * Math.sin((f * Math.PI) / 2); }
  const f = (strain - eu) / (mat.fracture - eu);
  return mat.uts * (1 - 0.25 * f * f);
}

/** Invert for a given applied stress on the rising part of the curve. Returns strain or null if the wire breaks. */
function strainFor(mat: (typeof MATERIALS)[string], stress: number) {
  if (stress <= mat.yield) return stress / mat.Y;
  if (stress > mat.uts) return null;
  let lo = mat.yield / mat.Y, hi = mat.fracture * 0.7;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (stressOf(mat, mid) < stress) lo = mid; else hi = mid; }
  return lo;
}

const sim: SimDefinition = {
  camera: { position: [2.5, 0.5, 11], target: [0, -0.5, 0], aspect: 1.4 },
  timeless: true,
  hint: 'The extension is drawn magnified 50× so you can see it. Beyond the yield point the wire stays stretched when unloaded.',
  params: [
    { kind: 'select', key: 'mat', label: 'Material', default: 'steel', options: Object.entries(MATERIALS).map(([value, m]) => ({ value, label: m.name })) },
    { kind: 'slider', key: 'F', label: 'Load (force)', unit: 'N', min: 0, max: 2000, step: 5, default: 400 },
    { kind: 'slider', key: 'A', label: 'Cross-section area', unit: 'mm²', min: 1, max: 10, step: 0.1, default: 2 },
    { kind: 'slider', key: 'L', label: 'Original length', unit: 'm', min: 0.5, max: 3, step: 0.1, default: 2 },
  ],
  presets: [
    { label: 'Elastic region', values: { mat: 'steel', F: 300, A: 2 } },
    { label: 'Past yield', values: { mat: 'copper', F: 300, A: 2 } },
    { label: 'Breaking', values: { mat: 'aluminium', F: 260, A: 2 } },
    { label: 'Thicker wire', values: { mat: 'copper', F: 300, A: 6 } },
  ],
  graphs: [
    { id: 'ss', title: 'Stress–strain curve', x: 'strain', y: 'stress (MPa)', kind: 'curve', zeroY: true, series: [{ label: 'material', color: C.accent }] },
  ],
  learn: {
    concept: 'Stress is force per unit area, strain is the fractional change in length. Up to the proportional limit, stress ∝ strain and the ratio is Young’s modulus Y, a property of the material. Beyond the elastic limit the wire deforms permanently, and at the ultimate tensile stress it begins to neck and then breaks.',
    variables: [['σ', 'stress F/A (Pa)'], ['ε', 'strain ΔL/L (no unit)'], ['Y', 'Young’s modulus σ/ε (Pa)'], ['ΔL', 'extension (m)'], ['A', 'cross-sectional area (m²)']],
    observe: [
      'In the straight part of the graph, doubling the load doubles the extension.',
      'A thicker wire has less stress for the same load — and stretches less.',
      'Steel is stiffer (steeper line) than copper or aluminium.',
      'Young’s modulus stays the same whatever the wire’s length or thickness.',
    ],
    challenge: 'Find the largest load a 2 mm² copper wire can carry without permanent stretching.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    const ceiling = kit.box(3, 0.3, 1.5, '#475569');
    ceiling.position.set(0, 3.2, 0);
    const wire = kit.cylinder(0.04, 0.04, 1, '#94a3b8', { metalness: 0.7 });
    const weight = kit.cylinder(0.45, 0.45, 0.6, '#64748b', { metalness: 0.5 });
    const ref = kit.line('#94a3b8', [], { dashed: true, width: 1 });
    const extLine = kit.line(C.resultant, [], { width: 3 });
    const extLabel = kit.label('', [0, 0, 0], { color: C.resultant, small: true });
    const fArrow = kit.arrow(C.weight, { label: 'F', radius: 0.05 });
    const status = kit.label('', [0, 3.9, 0]);
    const brokenTop = kit.cylinder(0.04, 0.04, 1, '#94a3b8', { metalness: 0.7 });

    const mat = () => MATERIALS[str(p, 'mat')] ?? MATERIALS.steel;
    const stress = () => num(p, 'F') / (num(p, 'A') * 1e-6);
    const strain = () => strainFor(mat(), stress());

    function draw() {
      const m = mat();
      const e = strain();
      const L0 = 4.5 * (num(p, 'L') / 3);
      const top = 3.05;
      const broken = e === null;
      const stretch = broken ? 0 : e * L0 * 50;
      const len = L0 + stretch;
      (wire.material as { color: { set: (c: string) => void } }).color.set(m.color);
      wire.scale.set(Math.sqrt(num(p, 'A') / 2), broken ? 0.45 * L0 : len, Math.sqrt(num(p, 'A') / 2));
      wire.position.set(0, broken ? top - len * 0.9 : top - len / 2, 0);
      brokenTop.visible = broken;
      brokenTop.scale.set(1, L0 * 0.45, 1);
      brokenTop.position.set(0, top - L0 * 0.225, 0);
      weight.position.set(0, broken ? -2.6 : top - len - 0.3, 0);
      ref.setPoints([[0.7, top - L0, 0], [1.4, top - L0, 0]]);
      extLine.setPoints([[1.1, top - L0, 0], [1.1, top - len, 0]]);
      extLabel.at([1.9, top - L0 - stretch / 2, 0]).setText(broken ? '' : `ΔL = ${n(e * num(p, 'L') * 1000)} mm`);
      fArrow.set([0, weight.position.y - 0.3, 0.5], [0, -(0.4 + num(p, 'F') / 1500), 0], `F = ${n(num(p, 'F'))} N`);
      const s = stress();
      status.setText(broken ? 'The wire has broken!' : s <= m.yield ? 'Elastic: returns to its length when unloaded' : 'Plastic: permanently stretched');
      status.setColor(broken ? C.friction : s <= m.yield ? C.normal : C.weight);
      const G = graphs.get('ss');
      G.plot(0, 0, m.fracture, (x) => stressOf(m, x) / 1e6, 300);
      G.setMarkers(broken ? [] : [{ x: e!, y: s / 1e6, label: 'now', color: C.resultant }]);
      G.setVLines([{ x: m.yield / m.Y, label: 'yield' }]);
    }
    draw();

    return {
      setParams(np) { p = np; draw(); },
      reset() { draw(); },
      step() {},
      readouts(): Readout[] {
        const m = mat();
        const e = strain();
        return [
          { label: 'Stress σ = F/A', value: stress() / 1e6, unit: 'MPa', tone: 'accent' },
          { label: 'Strain ε = ΔL/L', value: e ?? 'broken' },
          { label: 'Extension ΔL', value: e === null ? 'broken' : e * num(p, 'L') * 1000, unit: e === null ? undefined : 'mm', tone: 'accent' },
          { label: 'Young’s modulus Y', value: m.Y / 1e9, unit: 'GPa' },
          { label: 'Yield (elastic limit) stress', value: m.yield / 1e6, unit: 'MPa' },
          { label: 'Ultimate tensile stress', value: m.uts / 1e6, unit: 'MPa' },
          { label: 'Max load without permanent set', value: m.yield * num(p, 'A') * 1e-6, unit: 'N' },
          { label: 'Breaking load', value: m.uts * num(p, 'A') * 1e-6, unit: 'N' },
        ];
      },
      equations(): Equation[] {
        const m = mat();
        return [
          { expr: 'σ = F / A', sub: `= ${n(num(p, 'F'))} / (${n(num(p, 'A'))} × 10⁻⁶) = ${n(stress())} Pa` },
          { expr: 'ε = ΔL / L', sub: strain() === null ? 'wire broken' : `= ${n(strain()!)}` },
          { expr: 'Y = σ / ε = F L / (A ΔL)', sub: `Y(${m.name}) = ${n(m.Y)} Pa` },
          { expr: 'Elastic energy = ½ F ΔL', sub: strain() === null || stress() > m.yield ? 'valid only in the elastic region' : `= ${n(0.5 * num(p, 'F') * strain()! * num(p, 'L'))} J` },
        ];
      },
    };
  },
};

export default sim;
