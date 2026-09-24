import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { bool, num, str } from '../types';
import { mu0 } from '../../physics/constants';
import { C } from '../../engine/colors';
import { trace, type Vec2 } from '../fieldlines';

const CM = 0.01;

const sim: SimDefinition = {
  camera: { position: [0, 2, 13], target: [0, 0, 0], aspect: 1.5 },
  timeless: true,
  hint: 'Field lines leave the N pole and enter the S pole. A small current loop produces exactly the same pattern far away.',
  params: [
    { kind: 'select', key: 'src', label: 'Source', default: 'bar', options: [{ value: 'bar', label: 'Bar magnet' }, { value: 'loop', label: 'Current loop' }] },
    { kind: 'slider', key: 'm', label: 'Magnetic moment', unit: 'A·m²', min: 0.1, max: 10, step: 0.1, default: 2 },
    { kind: 'slider', key: 'L', label: 'Magnet length', unit: 'cm', min: 2, max: 8, step: 0.1, default: 5, showIf: (p) => p.src === 'bar' },
    { kind: 'slider', key: 'px', label: 'Compass x', unit: 'cm', min: -8, max: 8, step: 0.1, default: 5 },
    { kind: 'slider', key: 'py', label: 'Compass y', unit: 'cm', min: -6, max: 6, step: 0.1, default: 3 },
    { kind: 'toggle', key: 'many', label: 'Show many compasses', default: true },
  ],
  presets: [
    { label: 'Bar magnet', values: { src: 'bar', m: 2 } },
    { label: 'Current loop', values: { src: 'loop', m: 2 } },
    { label: 'Axial point', values: { px: 6, py: 0 } },
    { label: 'Equatorial point', values: { px: 0, py: 5 } },
  ],
  graphs: [
    { id: 'B', title: 'Field along the axis and the equator', x: 'r (cm)', y: 'B (µT)', kind: 'curve', xRange: [2, 10], zeroY: true, series: [{ label: 'axial 2km/r³', color: C.magnetic }, { label: 'equatorial km/r³', color: C.acceleration }] },
  ],
  learn: {
    concept: 'A bar magnet and a small current loop are both magnetic dipoles with moment m. Far away their fields are identical: on the axis B = μ₀·2m/(4πr³), on the equator B = μ₀m/(4πr³). A compass needle aligns with the local field direction.',
    variables: [['m', 'magnetic dipole moment (A·m²) = NIA for a loop'], ['r', 'distance from the centre (m)'], ['B', 'magnetic flux density (T)']],
    observe: [
      'The field on the axis is twice the equatorial field at the same distance.',
      'Doubling the distance makes the field eight times weaker (1/r³).',
      'Outside the magnet, lines run from N to S; inside, from S to N — they form closed loops.',
    ],
    challenge: 'At what distance on the axis is the field of a 2 A·m² magnet equal to 40 µT (Earth’s field)?',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    const lines = kit.segments(C.magnetic, { width: 1.4, opacity: 0.85 });
    const magnetG = kit.add(new THREE.Group());
    const compasses = kit.add(new THREE.Group());
    const probe = kit.add(new THREE.Group());

    /** Dipole field (2D, in the x–y plane) of two poles ±L/2 (bar) or a point dipole (loop). */
    function field(x: number, y: number): Vec2 {
      const mom = num(p, 'm');
      if (str(p, 'src') === 'bar') {
        const h = (num(p, 'L') / 2) * CM;
        const qm = mom / (2 * h);
        let bx = 0, by = 0;
        for (const [sx, s] of [[h, 1], [-h, -1]] as [number, number][]) {
          const dx = x * CM - sx, dy = y * CM;
          const r3 = Math.pow(dx * dx + dy * dy + 1e-8, 1.5);
          bx += ((mu0 / (4 * Math.PI)) * s * qm * dx) / r3;
          by += ((mu0 / (4 * Math.PI)) * s * qm * dy) / r3;
        }
        return [bx, by];
      }
      const X = x * CM, Y = y * CM;
      const r2 = X * X + Y * Y + 1e-8, r = Math.sqrt(r2);
      const k = (mu0 / (4 * Math.PI)) * mom / (r2 * r2 * r);
      return [k * (3 * X * X - r2), k * 3 * X * Y];
    }

    function needle(x: number, y: number) {
      const g = new THREE.Group();
      const north = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.35, 8), kit.mat(C.positive, { emissive: 0.3 }));
      north.position.y = 0.17;
      const south = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.35, 8), kit.mat('#e2e8f0'));
      south.position.y = -0.17; south.rotation.z = Math.PI;
      g.add(north, south);
      const [bx, by] = field(x, y);
      g.rotation.z = Math.atan2(by, bx) - Math.PI / 2;
      g.position.set(x, y, 0.2);
      return g;
    }

    function draw() {
      kit.clearGroup(magnetG); kit.clearGroup(compasses); kit.clearGroup(probe);
      if (str(p, 'src') === 'bar') {
        const L = num(p, 'L');
        const nPole = kit.box(L / 2, 0.8, 0.8, C.positive); nPole.position.x = L / 4;
        const sPole = kit.box(L / 2, 0.8, 0.8, C.negative); sPole.position.x = -L / 4;
        magnetG.add(nPole, sPole, kit.label('N', [L / 4, 0, 0.5], { className: 'plain' }), kit.label('S', [-L / 4, 0, 0.5], { className: 'plain' }));
      } else {
        const loop = kit.torus(0.6, 0.06, '#d97706');
        loop.rotation.y = Math.PI / 2;
        magnetG.add(loop, kit.label('I', [0, 0.9, 0], { color: C.current, small: true }));
      }
      // field lines seeded around the N end
      const polys: THREE.Vector3[][] = [];
      const seedX = str(p, 'src') === 'bar' ? num(p, 'L') / 2 : 0.05;
      for (let i = 0; i < 16; i++) {
        const a = -Math.PI / 2 + ((i + 0.5) / 16) * Math.PI;
        const start: Vec2 = [seedX + 0.25 * Math.cos(a), 0.25 * Math.sin(a) * 2];
        const pts = trace(field, start, { step: 0.06, maxSteps: 900, bounds: 12, stop: (x, y) => Math.hypot(x + seedX, y) < 0.2 });
        polys.push(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)));
      }
      lines.setPolylines(polys);
      if (bool(p, 'many')) for (let x = -8; x <= 8; x += 2) for (let y = -6; y <= 6; y += 2) {
        if (Math.abs(x) < num(p, 'L') / 2 + 0.8 && Math.abs(y) < 1.2) continue;
        compasses.add(needle(x, y));
      }
      const pc = needle(num(p, 'px'), num(p, 'py'));
      pc.scale.setScalar(1.8);
      probe.add(pc);
      const G = graphs.get('B');
      const mm = num(p, 'm');
      G.plot(0, 2, 10, (r) => ((mu0 / (4 * Math.PI)) * 2 * mm) / (r * CM) ** 3 * 1e6, 100);
      G.plot(1, 2, 10, (r) => ((mu0 / (4 * Math.PI)) * mm) / (r * CM) ** 3 * 1e6, 100);
    }
    draw();

    return {
      setParams(np) { p = np; draw(); },
      reset() { draw(); },
      step() {},
      readouts(): Readout[] {
        const [bx, by] = field(num(p, 'px'), num(p, 'py'));
        const r = Math.hypot(num(p, 'px'), num(p, 'py')) * CM;
        return [
          { label: 'B at the compass', value: Math.hypot(bx, by) * 1e6, unit: 'µT', tone: 'accent' },
          { label: 'Field direction', value: (Math.atan2(by, bx) * 180) / Math.PI, unit: '°' },
          { label: 'Axial field at this distance', value: r > 0 ? ((mu0 / (4 * Math.PI)) * 2 * num(p, 'm')) / r ** 3 * 1e6 : 0, unit: 'µT' },
          { label: 'Equatorial field at this distance', value: r > 0 ? ((mu0 / (4 * Math.PI)) * num(p, 'm')) / r ** 3 * 1e6 : 0, unit: 'µT' },
          { label: 'Loop equivalent (N = 100, A = 1 cm²)', value: num(p, 'm') / (100 * 1e-4), unit: 'A' },
        ];
      },
      equations(): Equation[] {
        return [
          { expr: 'Axial: B = (μ₀ / 4π) · 2m / r³' },
          { expr: 'Equatorial: B = (μ₀ / 4π) · m / r³' },
          { expr: 'Current loop: m = N I A' },
        ];
      },
    };
  },
};

export default sim;
