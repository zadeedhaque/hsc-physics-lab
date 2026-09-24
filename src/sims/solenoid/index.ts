import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { bool, num } from '../types';
import { solenoidField } from '../../physics/magnetism';
import { mu0 } from '../../physics/constants';
import { coilPoints } from '../../engine/kit';
import { C } from '../../engine/colors';
import { n } from '../shared';

const LEN = 8; // scene length of the coil
const RC = 1; // scene radius

/** On-axis field of a finite solenoid (exact): B = ½μ₀nI [cos β₁ − cos β₂]. */
function axialField(N: number, L: number, R: number, I: number, x: number) {
  const nTurns = N / L;
  const a = (x + L / 2) / Math.hypot(x + L / 2, R);
  const b = (x - L / 2) / Math.hypot(x - L / 2, R);
  return 0.5 * mu0 * nTurns * I * (a - b);
}

const sim: SimDefinition = {
  camera: { position: [2, 4, 10], target: [0, 0, 0], aspect: 1.6 },
  hint: 'Inside a long solenoid the field is strong and uniform; outside it is weak — like a bar magnet with N and S poles at the ends.',
  params: [
    { kind: 'slider', key: 'I', label: 'Current', unit: 'A', min: -10, max: 10, step: 0.1, default: 3 },
    { kind: 'slider', key: 'N', label: 'Number of turns', min: 10, max: 2000, step: 10, default: 500 },
    { kind: 'slider', key: 'L', label: 'Length', unit: 'cm', min: 5, max: 100, step: 1, default: 40 },
    { kind: 'slider', key: 'R', label: 'Coil radius', unit: 'cm', min: 1, max: 10, step: 0.5, default: 3 },
    { kind: 'toggle', key: 'core', label: 'Soft-iron core (μᵣ = 1000)', default: false },
  ],
  presets: [
    { label: 'Long coil', values: { N: 500, L: 50, R: 2 } },
    { label: 'Short, fat coil', values: { N: 100, L: 6, R: 8 } },
    { label: 'Reverse current', values: { I: -3 } },
    { label: 'Electromagnet', values: { core: true, I: 1, N: 300 } },
  ],
  graphs: [
    { id: 'B', title: 'Field along the axis', x: 'x (cm)', y: 'B (mT)', kind: 'curve', zeroY: true, series: [{ label: 'exact finite solenoid', color: C.magnetic }, { label: 'μ₀nI (long-solenoid formula)', color: '#94a3b8', dashed: true }] },
  ],
  learn: {
    concept: 'A solenoid is a long coil of wire. The fields of all the turns add up inside to a nearly uniform field B = μ₀nI, where n = N/L is the number of turns per metre. At the ends the field falls to about half. A soft-iron core multiplies B by its relative permeability, making an electromagnet.',
    variables: [['B', 'magnetic flux density (T)'], ['n', 'turns per metre N/L'], ['I', 'current (A)'], ['μ₀', '4π × 10⁻⁷ T·m/A'], ['μᵣ', 'relative permeability of the core']],
    observe: [
      'Doubling the turns or the current doubles B.',
      'Stretching the same coil to twice the length halves B.',
      'At each end the field is about half its central value.',
      'Reversing the current swaps the N and S poles.',
    ],
    challenge: 'Design a 30 cm air-cored solenoid that gives 5 mT at its centre with 2 A. How many turns do you need?',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0;
    const coil = kit.line('#d97706', [], { width: 2.5 });
    const core = kit.cylinder(RC * 0.8, RC * 0.8, LEN, '#64748b', { metalness: 0.6, opacity: 0.6 });
    core.rotation.z = Math.PI / 2;
    const lines = kit.segments(C.magnetic, { width: 1.6, opacity: 0.85 });
    const cones = kit.add(new THREE.Group());
    const nLabel = kit.label('N', [0, 0, 0], { color: C.positive });
    const sLabel = kit.label('S', [0, 0, 0], { color: C.negative });
    const bArrow = kit.arrow(C.magnetic, { label: 'B', radius: 0.06 });
    const charges: THREE.Mesh[] = [];
    for (let i = 0; i < 30; i++) charges.push(kit.sphere(0.05, C.current, { emissive: 0.6 }, 8));

    const Lm = () => num(p, 'L') / 100;
    const mur = () => (bool(p, 'core') ? 1000 : 1);
    const Bc = () => solenoidField(num(p, 'N'), Lm(), num(p, 'I')) * mur();

    function build() {
      const turnsShown = Math.max(6, Math.min(40, Math.round(num(p, 'N') / 20)));
      coil.setPoints(coilPoints(turnsShown, RC, LEN, 24));
      core.visible = bool(p, 'core');
      const dir = Math.sign(num(p, 'I')) || 1;
      // field lines: through the inside and closing around the outside
      const flat: number[] = [];
      kit.clearGroup(cones);
      [0.25, 0.55, 0.8].forEach((f) => {
        const r = RC * f;
        for (const s of [1, -1]) {
          const pts: THREE.Vector3[] = [];
          const R2 = RC * (1.6 + f * 1.4);
          for (let i = 0; i <= 60; i++) { const x = -LEN / 2 - 0.6 + (i / 60) * (LEN + 1.2); pts.push(new THREE.Vector3(x, s * r, 0)); }
          for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI; pts.push(new THREE.Vector3(LEN / 2 + 0.6 + Math.sin(a) * 1.8, s * (r + (R2 - r) * (1 - Math.cos(a)) / 2), 0)); }
          for (let i = 0; i <= 60; i++) { const x = LEN / 2 + 0.6 - (i / 60) * (LEN + 1.2); pts.push(new THREE.Vector3(x, s * R2, 0)); }
          for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI; pts.push(new THREE.Vector3(-LEN / 2 - 0.6 - Math.sin(a) * 1.8, s * (R2 - (R2 - r) * (1 - Math.cos(a)) / 2), 0)); }
          for (let i = 0; i < pts.length - 1; i++) flat.push(pts[i].x, pts[i].y, pts[i].z, pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
          [30, 130].forEach((k) => {
            const a = pts[k], b = pts[k + 1];
            const d = b.clone().sub(a).normalize().multiplyScalar(dir);
            const c = kit.cone(C.magnetic, 0.08, 0.22);
            c.position.copy(a);
            c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
            cones.add(c);
          });
        }
      });
      lines.setSegments(flat);
      nLabel.at([dir * (LEN / 2 + 0.5), RC + 0.6, 0]);
      sLabel.at([-dir * (LEN / 2 + 0.5), RC + 0.6, 0]);
      bArrow.set([-1, 0, 0], [dir * 2, 0, 0], `B = ${n(Math.abs(Bc()) * 1000)} mT`);
      const G = graphs.get('B');
      const L = Lm(), R = num(p, 'R') / 100;
      G.plot(0, -L * 100, L * 100, (xc) => axialField(num(p, 'N'), L, R, num(p, 'I'), xc / 100) * mur() * 1000, 200);
      G.plot(1, -L * 50, L * 50, () => Bc() * 1000, 2);
    }
    build();

    return {
      setParams(np) { p = np; build(); },
      reset() { t = 0; },
      step(dt) { t += dt; },
      render() {
        const turnsShown = Math.max(6, Math.min(40, Math.round(num(p, 'N') / 20)));
        charges.forEach((c, i) => {
          const u = (((i / charges.length) + t * num(p, 'I') * 0.01) % 1 + 1) % 1;
          const a = u * turnsShown * Math.PI * 2;
          c.position.set(-LEN / 2 + u * LEN, RC * Math.cos(a), RC * Math.sin(a));
        });
      },
      time: () => t,
      readouts(): Readout[] {
        const R = num(p, 'R') / 100;
        return [
          { label: 'Turns per metre n = N/L', value: num(p, 'N') / Lm(), unit: 'm⁻¹' },
          { label: 'Field at centre (long-coil formula)', value: Math.abs(Bc()) * 1000, unit: 'mT', tone: 'accent' },
          { label: 'Field at centre (exact)', value: Math.abs(axialField(num(p, 'N'), Lm(), R, num(p, 'I'), 0)) * mur() * 1000, unit: 'mT' },
          { label: 'Field at an end (exact)', value: Math.abs(axialField(num(p, 'N'), Lm(), R, num(p, 'I'), Lm() / 2)) * mur() * 1000, unit: 'mT' },
          { label: 'Length / radius', value: Lm() / R },
          { label: 'Magnetic flux through one turn', value: Math.abs(Bc()) * Math.PI * R * R, unit: 'Wb' },
        ];
      },
      equations(): Equation[] {
        return [
          { expr: 'B = μ₀ μᵣ n I ,  n = N / L', sub: `= 4π×10⁻⁷ × ${mur()} × ${n(num(p, 'N') / Lm())} × ${n(num(p, 'I'))} = ${n(Bc())} T` },
          { expr: 'B_end ≈ ½ μ₀ n I', note: 'for a long solenoid' },
        ];
      },
    };
  },
};

export default sim;
