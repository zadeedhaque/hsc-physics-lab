import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { bool, num, str } from '../types';
import { wireField } from '../../physics/magnetism';
import { mu0 } from '../../physics/constants';
import { C } from '../../engine/colors';
import { n } from '../shared';

const CM = 0.01; // 1 scene unit = 1 cm
const RADII = [0.8, 1.5, 2.3, 3.2, 4.2];
const HEIGHTS = [-1.8, 0, 1.8];

const sim: SimDefinition = {
  camera: { position: [7, 6, 9], target: [0, 0, 0], aspect: 1.3 },
  hint: 'Right-hand grip rule: thumb along the current, fingers curl the way B circles.',
  params: [
    { kind: 'slider', key: 'I', label: 'Current I₁', unit: 'A', min: -20, max: 20, step: 0.5, default: 10, hint: 'Negative = current flows downward' },
    { kind: 'slider', key: 'r', label: 'Probe distance r', unit: 'cm', min: 0.5, max: 5, step: 0.1, default: 2 },
    { kind: 'select', key: 'mode', label: 'Setup', default: 'single', options: [{ value: 'single', label: 'One wire' }, { value: 'two', label: 'Two parallel wires' }] },
    { kind: 'slider', key: 'I2', label: 'Current I₂', unit: 'A', min: -20, max: 20, step: 0.5, default: 10, showIf: (p) => p.mode === 'two' },
    { kind: 'slider', key: 'd', label: 'Wire separation d', unit: 'cm', min: 2, max: 8, step: 0.1, default: 5, showIf: (p) => p.mode === 'two' },
    { kind: 'toggle', key: 'compass', label: 'Show compass needles', default: true },
  ],
  presets: [
    { label: '10 A up', values: { I: 10, mode: 'single' } },
    { label: '10 A down', values: { I: -10, mode: 'single' } },
    { label: 'Parallel currents attract', values: { mode: 'two', I: 10, I2: 10, d: 5 } },
    { label: 'Opposite currents repel', values: { mode: 'two', I: 10, I2: -10, d: 5 } },
  ],
  graphs: [
    { id: 'Br', title: 'Magnetic field vs distance from wire 1', x: 'r (cm)', y: 'B (µT)', kind: 'curve', xRange: [0.3, 6], zeroY: true, series: [{ label: 'B = μ₀I / 2πr', color: C.magnetic }] },
  ],
  learn: {
    concept: 'A current-carrying conductor is surrounded by a magnetic field. For a long straight wire the field lines are circles centred on the wire and B falls off as 1/r. Two parallel wires exert forces on each other: like currents attract, opposite currents repel.',
    variables: [['B', 'magnetic flux density (T)'], ['I', 'current (A)'], ['r', 'perpendicular distance (m)'], ['μ₀', '4π × 10⁻⁷ T·m/A'], ['F/L', 'force per unit length between wires (N/m)']],
    observe: [
      'Reverse the current: every compass needle flips round.',
      'Doubling r halves B — the circles further out are fainter.',
      'With two wires the field between them adds or cancels depending on the current directions.',
    ],
    challenge: 'Find the distance at which a 10 A wire produces a field equal to the Earth’s horizontal field in Bangladesh (≈ 40 µT).',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0;
    kit.grid(14, 14, 'xz', -2.6);
    const wireMesh = kit.cylinder(0.12, 0.12, 6, '#d97706', { metalness: 0.6, roughness: 0.3 });
    const wire2 = kit.cylinder(0.12, 0.12, 6, '#d97706', { metalness: 0.6, roughness: 0.3 });
    const iArrow = kit.arrow(C.current, { label: 'I₁', radius: 0.05 });
    const iArrow2 = kit.arrow(C.current, { label: 'I₂', radius: 0.05 });
    const fieldGroup = kit.add(new THREE.Group());
    const needles = kit.add(new THREE.Group());
    const probe = kit.sphere(0.1, '#e2e8f0');
    const bArrow = kit.arrow(C.magnetic, { label: 'B', radius: 0.045 });
    const fArrow1 = kit.arrow(C.force, { label: 'F', radius: 0.05 });
    const fArrow2 = kit.arrow(C.force, { label: 'F', radius: 0.05 });
    const charges: THREE.Mesh[] = [];
    for (let i = 0; i < 16; i++) charges.push(kit.sphere(0.06, C.current, { emissive: 0.6 }, 8));
    const charges2: THREE.Mesh[] = [];
    for (let i = 0; i < 16; i++) charges2.push(kit.sphere(0.06, C.current, { emissive: 0.6 }, 8));

    const two = () => str(p, 'mode') === 'two';
    const w1x = () => (two() ? -num(p, 'd') / 2 : 0);
    const w2x = () => num(p, 'd') / 2;

    /** Net B (tesla) at a point in the horizontal plane (x, z in cm). Field circles anticlockwise seen from above for upward current. */
    function B(x: number, z: number): [number, number] {
      let bx = 0, bz = 0;
      const add = (wx: number, I: number) => {
        const dx = x - wx, dz = z;
        const r = Math.hypot(dx, dz);
        if (r < 1e-6) return;
        const mag = wireField(I, r * CM);
        // direction: ŷ × r̂  (current up) → (dz, -dx)/r … use right-hand rule
        bx += (mag * -dz) / r * -1;
        bz += (mag * dx) / r * -1;
      };
      add(w1x(), num(p, 'I'));
      if (two()) add(w2x(), num(p, 'I2'));
      return [bx, bz];
    }

    function build() {
      kit.clearGroup(fieldGroup);
      kit.clearGroup(needles);
      const I1 = num(p, 'I');
      const Bref = wireField(20, RADII[0] * CM);
      const addCircles = (cx: number, I: number) => {
        if (I === 0) return;
        RADII.forEach((r) => {
          const strength = wireField(Math.abs(I), r * CM) / Bref;
          HEIGHTS.forEach((h) => {
            const pts: THREE.Vector3[] = [];
            for (let i = 0; i <= 64; i++) { const a = (i / 64) * Math.PI * 2; pts.push(new THREE.Vector3(cx + r * Math.cos(a), h, r * Math.sin(a))); }
            const l = kit.line(C.magnetic, pts, { width: 1 + 2.5 * strength, opacity: 0.25 + 0.75 * Math.min(1, strength * 1.5) });
            fieldGroup.add(l);
            // direction cones (4 per circle)
            for (let q = 0; q < 4; q++) {
              const a = (q / 4) * Math.PI * 2 + 0.4;
              const pos = new THREE.Vector3(cx + r * Math.cos(a), h, r * Math.sin(a));
              // tangent for anticlockwise (seen from +y) when I > 0: d/da (cos a, sin a) → (-sin a, cos a) in x-z → but +z toward viewer…
              const tangent = new THREE.Vector3(Math.sin(a), 0, -Math.cos(a)).multiplyScalar(Math.sign(I));
              const cone = kit.cone(C.magnetic, 0.07, 0.2);
              cone.position.copy(pos);
              cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
              fieldGroup.add(cone);
            }
          });
        });
      };
      addCircles(w1x(), I1);
      if (two()) addCircles(w2x(), num(p, 'I2'));

      if (bool(p, 'compass')) {
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          const x = w1x() + 2.8 * Math.cos(a), z = 2.8 * Math.sin(a);
          const [bx, bz] = B(x, z);
          const needle = new THREE.Group();
          const north = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.4, 8), kit.mat(C.positive, { emissive: 0.3 }));
          north.position.y = 0.2;
          const south = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.4, 8), kit.mat('#e2e8f0'));
          south.position.y = -0.2; south.rotation.z = Math.PI;
          needle.add(north, south);
          needle.position.set(x, -2.4, z);
          const dir = new THREE.Vector3(bx, 0, bz);
          if (dir.lengthSq() > 0) needle.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
          needles.add(needle);
        }
      }
      graphs.get('Br').plot(0, 0.3, 6, (r) => wireField(Math.abs(I1), r * CM) * 1e6, 200);
      graphs.get('Br').setMarkers([{ x: num(p, 'r'), y: wireField(Math.abs(I1), num(p, 'r') * CM) * 1e6, label: 'probe', color: C.magnetic }]);
    }
    build();

    return {
      setParams(np) { p = np; build(); },
      reset() { t = 0; },
      step(dt) { t += dt; },
      render() {
        const I1 = num(p, 'I'), I2 = num(p, 'I2');
        wireMesh.position.set(w1x(), 0, 0);
        wire2.visible = two();
        wire2.position.set(w2x(), 0, 0);
        iArrow.set([w1x(), 3.2, 0], [0, Math.sign(I1) * 0.9, 0], `I₁ = ${n(Math.abs(I1))} A`);
        iArrow.visible = I1 !== 0;
        iArrow2.visible = two() && I2 !== 0;
        if (two()) iArrow2.set([w2x(), 3.2, 0], [0, Math.sign(I2) * 0.9, 0], `I₂ = ${n(Math.abs(I2))} A`);
        // moving charges (conventional current) — speed ∝ current
        charges.forEach((c, i) => {
          const y = ((((i / charges.length) * 6 + t * I1 * 0.15) % 6) + 6) % 6 - 3;
          c.position.set(w1x(), y, 0.13);
          c.visible = I1 !== 0;
        });
        charges2.forEach((c, i) => {
          const y = ((((i / charges2.length) * 6 + t * I2 * 0.15) % 6) + 6) % 6 - 3;
          c.position.set(w2x(), y, 0.13);
          c.visible = two() && I2 !== 0;
        });
        // probe along +z from wire 1 at y = 0
        const pr = new THREE.Vector3(w1x(), 0, num(p, 'r'));
        probe.position.copy(pr);
        const [bx, bz] = B(pr.x, pr.z);
        const bm = Math.hypot(bx, bz);
        const Bref = wireField(20, 1 * CM);
        const len = bm > 0 ? 0.4 + 1.6 * Math.min(1, bm / Bref) : 0;
        bArrow.set(pr, [(bx / (bm || 1)) * len, 0, (bz / (bm || 1)) * len], `B = ${n(bm * 1e6)} µT`);
        // forces between wires
        fArrow1.visible = fArrow2.visible = two() && I1 !== 0 && I2 !== 0;
        if (two()) {
          const attract = I1 * I2 > 0;
          const s = attract ? 1 : -1;
          fArrow1.set([w1x(), 1, 0], [s * 1.1, 0, 0], attract ? 'attract' : 'repel');
          fArrow2.set([w2x(), 1, 0], [-s * 1.1, 0, 0], '');
        }
      },
      time: () => t,
      readouts(): Readout[] {
        const I1 = num(p, 'I');
        const [bx, bz] = B(w1x(), num(p, 'r'));
        const out: Readout[] = [
          { label: 'B from wire 1 at probe', value: wireField(Math.abs(I1), num(p, 'r') * CM) * 1e6, unit: 'µT', tone: 'accent' },
          { label: 'Net B at probe', value: Math.hypot(bx, bz) * 1e6, unit: 'µT', tone: 'accent' },
          { label: 'Current direction', value: I1 > 0 ? 'Up (+y)' : I1 < 0 ? 'Down (−y)' : 'No current' },
          { label: 'Field sense (from above)', value: I1 > 0 ? 'Anticlockwise' : I1 < 0 ? 'Clockwise' : '—' },
        ];
        if (two()) {
          const F = (mu0 * Math.abs(I1 * num(p, 'I2'))) / (2 * Math.PI * num(p, 'd') * CM);
          out.push({ label: 'Force per metre between wires', value: F, unit: 'N/m' }, { label: 'Interaction', value: I1 * num(p, 'I2') > 0 ? 'Attractive' : I1 * num(p, 'I2') < 0 ? 'Repulsive' : 'None' });
        }
        return out;
      },
      equations(): Equation[] {
        const I = Math.abs(num(p, 'I')), r = num(p, 'r');
        const out: Equation[] = [
          { expr: 'B = μ₀ I / 2π r', sub: `B = (4π×10⁻⁷ × ${n(I)}) / (2π × ${n(r * CM)}) = ${n(wireField(I, r * CM))} T` },
          { expr: 'μ₀ = 4π × 10⁻⁷ T·m/A' },
        ];
        if (two()) out.push({ expr: 'F / L = μ₀ I₁ I₂ / 2π d', sub: `F/L = ${n((mu0 * Math.abs(num(p, 'I') * num(p, 'I2'))) / (2 * Math.PI * num(p, 'd') * CM))} N/m` });
        return out;
      },
    };
  },
};

export default sim;
