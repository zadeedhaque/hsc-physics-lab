import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { bool, num } from '../types';
import { fromPolar, mag } from '../../physics/vectors';
import { rad, deg } from '../../lib/num';
import { C } from '../../engine/colors';
import { n } from '../shared';

const S = 0.4;

const sim: SimDefinition = {
  camera: { position: [6, 4.5, 8], target: [1.2, 1.2, 0.8], aspect: 1.5 },
  timeless: true,
  hint: 'The dashed box has the three components as its edges; F is its diagonal.',
  params: [
    { kind: 'slider', key: 'F', label: 'Magnitude |F|', unit: 'N', min: 0, max: 12, step: 0.1, default: 8 },
    { kind: 'slider', key: 'theta', label: 'Direction θ in x–y plane', unit: '°', min: 0, max: 360, step: 1, default: 35 },
    { kind: 'slider', key: 'phi', label: 'Elevation φ toward z', unit: '°', min: -90, max: 90, step: 1, default: 25 },
    { kind: 'toggle', key: 'box', label: 'Show component box', default: true },
    { kind: 'toggle', key: 'cos', label: 'Show direction angles', default: true },
  ],
  presets: [
    { label: '2D: 30°', values: { F: 10, theta: 30, phi: 0 } },
    { label: '2D: 60°', values: { F: 10, theta: 60, phi: 0 } },
    { label: 'Along an axis', values: { F: 8, theta: 90, phi: 0 } },
    { label: 'Equal components', values: { F: 10, theta: 45, phi: 35.26 } },
  ],
  learn: {
    concept: 'Any vector can be replaced by perpendicular components along the axes. In 3D, F = Fₓî + F_yĵ + F_zk̂ and |F| = √(Fₓ² + F_y² + F_z²). The angles α, β, γ that F makes with the axes satisfy cos²α + cos²β + cos²γ = 1.',
    variables: [['Fₓ, F_y, F_z', 'components (N)'], ['θ', 'angle in the x–y plane from +x'], ['φ', 'angle above the x–y plane'], ['α, β, γ', 'angles with x, y, z axes'], ['F̂', 'unit vector F/|F|']],
    observe: [
      'In 2D (φ = 0), Fₓ = F cos θ and F_y = F sin θ.',
      'A component can be negative — it points along the negative axis.',
      'The sum of the squared direction cosines is always 1.',
    ],
    challenge: 'Find θ and φ such that all three components are equal. What angle does F then make with each axis?',
  },

  create({ kit, params }) {
    let p: Params = params;
    kit.grid(12, 12, 'xy', 0).position.z = -0.001;
    kit.axes(5, [0, 0, 0], ['x', 'y', 'z']);
    const aF = kit.arrow(C.resultant, { label: 'F', radius: 0.06 });
    const ax = kit.arrow(C.x, { label: 'Fₓ', radius: 0.04 });
    const ay = kit.arrow(C.y, { label: 'F_y', radius: 0.04 });
    const az = kit.arrow(C.z, { label: 'F_z', radius: 0.04 });
    const box = kit.segments('#94a3b8', { width: 1.2, dashed: true, opacity: 0.8 });
    const arcs = kit.segments('#e2e8f0', { width: 1.2, opacity: 0.8 });
    const arcLabels = kit.add(new THREE.Group());

    const vec = () => fromPolar(num(p, 'F'), rad(num(p, 'theta')), rad(num(p, 'phi')));

    function draw() {
      const F = vec();
      const V = new THREE.Vector3(F[0] * S, F[1] * S, F[2] * S);
      aF.set([0, 0, 0], V, `F = ${n(num(p, 'F'))} N`);
      ax.set([0, 0, 0], [V.x, 0, 0], `Fₓ = ${n(F[0])}`);
      ay.set([0, 0, 0], [0, V.y, 0], `F_y = ${n(F[1])}`);
      az.set([0, 0, 0], [0, 0, V.z], `F_z = ${n(F[2])}`);
      if (bool(p, 'box')) {
        const c = (x: number, y: number, z: number) => [x * V.x, y * V.y, z * V.z];
        const e: number[][] = [];
        const corners = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 0], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
        const edges: [number[], number[]][] = [
          [corners[0], corners[3]], [corners[1], corners[3]], [corners[0], corners[4]], [corners[2], corners[4]],
          [corners[1], corners[5]], [corners[2], corners[5]], [corners[3], corners[6]], [corners[4], corners[6]], [corners[5], corners[6]],
        ];
        edges.forEach(([a, b]) => e.push([...c(a[0], a[1], a[2]), ...c(b[0], b[1], b[2])]));
        box.setSegments(e.flat());
      } else box.visible = false;
      kit.clearGroup(arcLabels);
      const m = mag(F);
      if (bool(p, 'cos') && m > 0) {
        const u = V.clone().normalize();
        const flat: number[] = [];
        const axesDir = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
        ['α', 'β', 'γ'].forEach((name, i) => {
          const a = axesDir[i];
          const ang = a.angleTo(u);
          if (ang < 1e-3 || ang > Math.PI - 1e-3) return;
          const r = 0.7 + i * 0.25;
          let prev = a.clone().multiplyScalar(r);
          for (let k = 1; k <= 20; k++) {
            const q = a.clone().lerp(u, k / 20).normalize().multiplyScalar(r);
            flat.push(prev.x, prev.y, prev.z, q.x, q.y, q.z);
            prev = q;
          }
          const mid = a.clone().lerp(u, 0.5).normalize().multiplyScalar(r + 0.35);
          arcLabels.add(kit.label(`${name} = ${deg(ang).toFixed(1)}°`, mid, { small: true }));
        });
        arcs.setSegments(flat);
      } else arcs.visible = false;
    }
    draw();

    return {
      setParams(np) { p = np; draw(); },
      reset() { draw(); },
      step() {},
      readouts(): Readout[] {
        const F = vec();
        const m = mag(F) || 1;
        return [
          { label: 'Fₓ', value: F[0], unit: 'N', tone: 'accent' },
          { label: 'F_y', value: F[1], unit: 'N', tone: 'accent' },
          { label: 'F_z', value: F[2], unit: 'N', tone: 'accent' },
          { label: '|F| from components', value: mag(F), unit: 'N' },
          { label: 'cos α', value: F[0] / m },
          { label: 'cos β', value: F[1] / m },
          { label: 'cos γ', value: F[2] / m },
          { label: 'cos²α + cos²β + cos²γ', value: mag(F) > 0 ? (F[0] ** 2 + F[1] ** 2 + F[2] ** 2) / m ** 2 : 0 },
          { label: 'Unit vector F̂', value: mag(F) > 0 ? `${n(F[0] / m)}î + ${n(F[1] / m)}ĵ + ${n(F[2] / m)}k̂` : 'not defined for F = 0' },
        ];
      },
      equations(): Equation[] {
        const F = vec(), Fm = num(p, 'F'), th = num(p, 'theta'), ph = num(p, 'phi');
        return [
          { expr: 'Fₓ = F cos φ cos θ', sub: `= ${n(Fm)} × cos ${ph}° × cos ${th}° = ${n(F[0])} N` },
          { expr: 'F_y = F cos φ sin θ', sub: `= ${n(Fm)} × cos ${ph}° × sin ${th}° = ${n(F[1])} N` },
          { expr: 'F_z = F sin φ', sub: `= ${n(Fm)} × sin ${ph}° = ${n(F[2])} N` },
          { expr: '|F| = √(Fₓ² + F_y² + F_z²)', sub: `= ${n(mag(F))} N` },
          { expr: 'cos²α + cos²β + cos²γ = 1' },
        ];
      },
    };
  },
};

export default sim;
