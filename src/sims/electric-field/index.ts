import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { bool, num, str } from '../types';
import { fieldAt, potentialAt, coulomb, type PointCharge } from '../../physics/electricity';
import { k as kC } from '../../physics/constants';
import { C } from '../../engine/colors';
import { n } from '../shared';
import { trace, contour, type Vec2 } from '../fieldlines';

const CM = 0.01; // scene unit = 1 cm
const BOUND = 7;
const Q_TEST = 1e-9; // test charge (C)
const M_TEST = 1e-3; // test mass (kg)

type Config = 'single+' | 'single-' | 'dipole' | 'like' | 'unequal' | 'quad';

function charges(config: Config, qMicro: number, dCm: number): PointCharge[] {
  const q = qMicro * 1e-6, h = (dCm / 2) * CM;
  switch (config) {
    case 'single+': return [{ q, pos: [0, 0, 0] }];
    case 'single-': return [{ q: -q, pos: [0, 0, 0] }];
    case 'dipole': return [{ q, pos: [-h, 0, 0] }, { q: -q, pos: [h, 0, 0] }];
    case 'like': return [{ q, pos: [-h, 0, 0] }, { q, pos: [h, 0, 0] }];
    case 'unequal': return [{ q: 2 * q, pos: [-h, 0, 0] }, { q: -q, pos: [h, 0, 0] }];
    case 'quad': return [{ q, pos: [-h, -h, 0] }, { q: -q, pos: [h, -h, 0] }, { q, pos: [h, h, 0] }, { q: -q, pos: [-h, h, 0] }];
  }
}

const sim: SimDefinition = {
  camera: { position: [0, -3.5, 15], target: [0, 0, 0], aspect: 1.3 },
  startPaused: true,
  hint: 'Field lines leave + charges and end on − charges. Orbit the view to see the potential landscape in 3D.',
  params: [
    { kind: 'select', key: 'config', label: 'Charge arrangement', default: 'dipole', options: [
      { value: 'single+', label: 'Single positive charge' }, { value: 'single-', label: 'Single negative charge' },
      { value: 'dipole', label: 'Electric dipole (+q, −q)' }, { value: 'like', label: 'Two like charges (+q, +q)' },
      { value: 'unequal', label: 'Unequal (+2q, −q)' }, { value: 'quad', label: 'Quadrupole (4 charges)' },
    ] },
    { kind: 'slider', key: 'q', label: 'Charge magnitude q', unit: 'µC', min: 0.1, max: 10, step: 0.1, default: 2 },
    { kind: 'slider', key: 'd', label: 'Separation d', unit: 'cm', min: 1, max: 9, step: 0.1, default: 5, showIf: (p) => !String(p.config).startsWith('single') },
    { kind: 'select', key: 'view', label: 'Visualisation', default: 'lines', options: [
      { value: 'lines', label: 'Field lines' }, { value: 'potential', label: 'Potential' }, { value: 'vectors', label: 'Vectors' },
    ] },
    { kind: 'toggle', key: 'three', label: 'Field lines in 3D', default: false, showIf: (p) => p.view === 'lines' && p.config !== 'quad' },
    { kind: 'slider', key: 'px', label: 'Probe x', unit: 'cm', min: -6.5, max: 6.5, step: 0.1, default: 0 },
    { kind: 'slider', key: 'py', label: 'Probe y', unit: 'cm', min: -6.5, max: 6.5, step: 0.1, default: 2.5 },
  ],
  presets: [
    { label: 'Point charge', values: { config: 'single+', view: 'lines' } },
    { label: 'Dipole', values: { config: 'dipole', view: 'lines' } },
    { label: 'Like charges', values: { config: 'like', view: 'lines' } },
    { label: 'Equipotentials', values: { config: 'dipole', view: 'potential' } },
    { label: 'Field vectors', values: { config: 'unequal', view: 'vectors' } },
  ],
  graphs: [
    { id: 'V', title: 'Potential along the probe line (y = probe y)', x: 'x (cm)', y: 'V (V)', kind: 'curve', xRange: [-7, 7], series: [{ label: 'V(x)', color: C.accent }] },
  ],
  learn: {
    concept: 'A charge creates an electric field E in the space around it; another charge q placed there feels F = qE. The field points away from positive and toward negative charges, and fields from several charges add as vectors. Electric potential V is the work done per unit charge to bring a test charge from infinity; equipotential lines are always perpendicular to field lines.',
    variables: [['E', 'electric field intensity (N/C)'], ['V', 'electric potential (V)'], ['q', 'source charge (C)'], ['r', 'distance from charge (m)'], ['k', '1/4πε₀ = 8.99×10⁹ N·m²/C²']],
    observe: [
      'Lines are densest where the field is strongest — close to the charges.',
      'Between like charges there is a neutral point where E = 0.',
      'Equipotential lines cross field lines at right angles.',
      'Release the test charge: it accelerates along the field, not necessarily along a field line once it has speed.',
    ],
    challenge: 'For the dipole, move the probe along the perpendicular bisector (x = 0). Is the potential there zero? Is the field zero? Explain the difference.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let test: { x: number; y: number; vx: number; vy: number; active: boolean } = { x: num(params, 'px'), y: num(params, 'py'), vx: 0, vy: 0, active: true };
    let t = 0;

    kit.grid(14, 14, 'xy', 0).position.z = -0.02;
    const chargeGroup = kit.add(new THREE.Group());
    const lines = kit.segments(C.field, { width: 1.6, opacity: 0.9 });
    const conesGroup = kit.add(new THREE.Group());
    const equip = kit.segments('#a78bfa', { width: 1.4, opacity: 0.9 });
    const surfaceGroup = kit.add(new THREE.Group());
    const vecGroup = kit.add(new THREE.Group());
    const probe = kit.sphere(0.12, '#e2e8f0');
    const probeArrow = kit.arrow(C.resultant, { label: 'E', radius: 0.04 });
    const forceArrows: ReturnType<typeof kit.arrow>[] = [];
    const testBall = kit.sphere(0.14, C.weight, { emissive: 0.4 });
    const testTrail = kit.trail(C.weight, 800, { width: 2 });

    const Q = () => charges(str(p, 'config') as Config, num(p, 'q'), num(p, 'd'));
    const Ecm = (qs: PointCharge[]) => (x: number, y: number): Vec2 => {
      const e = fieldAt(qs, [x * CM, y * CM, 0], 1e-10);
      return [e[0], e[1]];
    };

    function build() {
      const qs = Q();
      kit.clearGroup(chargeGroup);
      kit.clearGroup(conesGroup);
      kit.clearGroup(surfaceGroup);
      kit.clearGroup(vecGroup);
      forceArrows.length = 0;
      const qmax = Math.max(...qs.map((c) => Math.abs(c.q)));
      qs.forEach((c) => {
        const r = 0.28 + 0.12 * Math.cbrt(Math.abs(c.q) / 1e-6 / 2);
        const s = kit.sphere(r, c.q > 0 ? C.positive : C.negative, { emissive: 0.35 });
        s.position.set(c.pos[0] / CM, c.pos[1] / CM, 0);
        chargeGroup.add(s);
        const l = kit.label(`${c.q > 0 ? '+' : '−'}${n(Math.abs(c.q) * 1e6, 2)} µC`, [s.position.x, s.position.y - r - 0.45, 0], { color: c.q > 0 ? C.positive : C.negative, small: true });
        chargeGroup.add(l);
        if (qs.length > 1) {
          const fa = kit.arrow(C.force, { radius: 0.035 });
          chargeGroup.add(fa);
          forceArrows.push(fa);
        }
      });
      // Coulomb forces on each charge (scaled for display)
      if (qs.length > 1) {
        const forces = qs.map((c, i) => {
          let fx = 0, fy = 0;
          qs.forEach((o, j) => {
            if (i === j) return;
            const dx = c.pos[0] - o.pos[0], dy = c.pos[1] - o.pos[1];
            const r = Math.hypot(dx, dy);
            const F = coulomb(c.q, o.q, r);
            fx += (F * dx) / r; fy += (F * dy) / r;
          });
          return [fx, fy] as Vec2;
        });
        const fmax = Math.max(...forces.map((f) => Math.hypot(f[0], f[1])), 1e-30);
        forces.forEach((f, i) => forceArrows[i].set([qs[i].pos[0] / CM, qs[i].pos[1] / CM, 0.3], [(f[0] / fmax) * 1.6, (f[1] / fmax) * 1.6, 0]));
      }

      const view = str(p, 'view');
      lines.visible = false; equip.visible = false;
      if (view === 'lines') {
        const field = Ecm(qs);
        const pos = qs.filter((c) => c.q > 0);
        const seeds = pos.length ? pos : qs;
        const backward = pos.length === 0;
        const polys: THREE.Vector3[][] = [];
        const near = (x: number, y: number, sign: number) => qs.some((c) => Math.sign(c.q) === sign && Math.hypot(x - c.pos[0] / CM, y - c.pos[1] / CM) < 0.25);
        seeds.forEach((c) => {
          const count = Math.max(8, Math.round(16 * Math.abs(c.q) / qmax));
          for (let i = 0; i < count; i++) {
            const a = ((i + 0.5) / count) * Math.PI * 2;
            const sx = c.pos[0] / CM + 0.3 * Math.cos(a), sy = c.pos[1] / CM + 0.3 * Math.sin(a);
            const pts = trace(field, [sx, sy], { step: 0.06, maxSteps: 700, bounds: BOUND, backward, stop: (x, y) => near(x, y, backward ? 1 : -1) });
            polys.push(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)));
          }
        });
        const rotations = bool(p, 'three') && str(p, 'config') !== 'quad' ? [0, Math.PI / 3, (2 * Math.PI) / 3, Math.PI / 6, Math.PI / 2, (5 * Math.PI) / 6] : [0];
        const all: THREE.Vector3[][] = [];
        rotations.forEach((ang) => {
          const rot = new THREE.Matrix4().makeRotationX(ang);
          polys.forEach((poly) => all.push(poly.map((v) => v.clone().applyMatrix4(rot))));
        });
        lines.setPolylines(all);
        // Direction cones midway along each line
        all.forEach((poly) => {
          if (poly.length < 12) return;
          const i = Math.floor(poly.length * 0.35);
          const a = poly[i], b = poly[i + 1];
          const cone = kit.cone(C.field, 0.08, 0.24);
          cone.position.copy(a);
          const dir = b.clone().sub(a).normalize();
          if (backward) dir.negate();
          cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
          conesGroup.add(cone);
        });
      } else if (view === 'potential') {
        const N = 97, span = 14, d = span / (N - 1);
        const vals: number[][] = [];
        const V0 = kC * (num(p, 'q') * 1e-6) / (1 * CM); // potential 1 cm from q
        for (let j = 0; j < N; j++) {
          const row: number[] = [];
          for (let i = 0; i < N; i++) row.push(potentialAt(qs, [(-span / 2 + i * d) * CM, (-span / 2 + j * d) * CM, 0], 1e-7));
          vals.push(row);
        }
        // Symmetric-log height surface
        const geo = new THREE.PlaneGeometry(span, span, N - 1, N - 1);
        const pos = geo.attributes.position as THREE.BufferAttribute;
        const colors: number[] = [];
        const col = new THREE.Color();
        for (let idx = 0; idx < pos.count; idx++) {
          const i = idx % N, j = N - 1 - Math.floor(idx / N);
          const V = vals[j][i];
          const s = Math.sign(V) * Math.log10(1 + Math.abs(V) / (V0 * 0.05));
          pos.setZ(idx, Math.max(-3, Math.min(3, s * 0.9)));
          const tt = Math.max(-1, Math.min(1, s / 2.5));
          col.set(tt >= 0 ? C.positive : C.negative).lerp(new THREE.Color('#1e293b'), 1 - Math.abs(tt) * 0.9);
          colors.push(col.r, col.g, col.b);
        }
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geo.computeVertexNormals();
        const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.55, side: THREE.DoubleSide, roughness: 0.8, depthWrite: false }));
        surfaceGroup.add(mesh);
        // Equipotential contours on the plane
        const flat: number[] = [];
        const levels: number[] = [];
        for (let e = -2; e <= 1; e += 0.5) { levels.push(V0 * 10 ** e, -V0 * 10 ** e); }
        levels.push(0);
        levels.forEach((lv) => contour(vals, -span / 2, -span / 2, d, d, lv).forEach(([a, b]) => flat.push(a[0], a[1], 0.01, b[0], b[1], 0.01)));
        equip.setSegments(flat);
      } else {
        const field = Ecm(qs);
        const Eref = kC * (num(p, 'q') * 1e-6) / (6 * CM) ** 2;
        for (let gx = -6; gx <= 6; gx += 1) for (let gy = -6; gy <= 6; gy += 1) {
          if (qs.some((c) => Math.hypot(gx - c.pos[0] / CM, gy - c.pos[1] / CM) < 0.6)) continue;
          const [ex, ey] = field(gx, gy);
          const m = Math.hypot(ex, ey);
          if (!(m > 0)) continue;
          const len = Math.min(0.9, 0.25 + 0.25 * Math.log10(1 + m / Eref));
          const intensity = Math.min(1, Math.log10(1 + m / Eref) / 2.5);
          const color = new THREE.Color('#475569').lerp(new THREE.Color(C.field), 0.3 + 0.7 * intensity).getStyle();
          const a = kit.arrow(color, { radius: 0.025 });
          a.set([gx - (ex / m) * len / 2, gy - (ey / m) * len / 2, 0], [(ex / m) * len, (ey / m) * len, 0]);
          vecGroup.add(a);
        }
      }
      // Potential along the probe line
      const py = num(p, 'py');
      const clampV = kC * (num(p, 'q') * 1e-6) * 2 / (0.4 * CM);
      graphs.get('V').plot(0, -7, 7, (x) => Math.max(-clampV, Math.min(clampV, potentialAt(qs, [x * CM, py * CM, 0], 1e-8))), 280);
      graphs.get('V').setMarkers([{ x: num(p, 'px'), y: potentialAt(qs, [num(p, 'px') * CM, py * CM, 0], 1e-8), label: 'probe', color: C.resultant }]);
    }
    build();

    function probeField() {
      const qs = Q();
      const e = fieldAt(qs, [num(p, 'px') * CM, num(p, 'py') * CM, 0], 1e-10);
      return { E: e, mag: Math.hypot(e[0], e[1]), V: potentialAt(qs, [num(p, 'px') * CM, num(p, 'py') * CM, 0], 1e-10) };
    }

    return {
      setParams(np) {
        const rebuild = ['config', 'q', 'd', 'view', 'three', 'py'].some((k) => np[k] !== p[k]);
        p = np;
        if (rebuild) build();
        else graphs.get('V').setMarkers([{ x: num(p, 'px'), y: potentialAt(Q(), [num(p, 'px') * CM, num(p, 'py') * CM, 0], 1e-8), label: 'probe', color: C.resultant }]);
      },
      reset() { test = { x: num(p, 'px'), y: num(p, 'py'), vx: 0, vy: 0, active: true }; testTrail.clearPoints(); t = 0; },
      step(dt) {
        if (!test.active) return;
        t += dt;
        const qs = Q();
        const e = fieldAt(qs, [test.x * CM, test.y * CM, 0], 1e-10);
        const ax = (Q_TEST * e[0]) / M_TEST, ay = (Q_TEST * e[1]) / M_TEST; // m/s²
        test.vx += (ax / CM) * dt; test.vy += (ay / CM) * dt; // cm/s
        test.x += test.vx * dt; test.y += test.vy * dt;
        testTrail.push([test.x, test.y, 0.02]);
        const hit = qs.some((c) => Math.hypot(test.x - c.pos[0] / CM, test.y - c.pos[1] / CM) < 0.3);
        if (hit || Math.abs(test.x) > 9 || Math.abs(test.y) > 9) test.active = false;
      },
      render() {
        const pr = probeField();
        probe.position.set(num(p, 'px'), num(p, 'py'), 0.05);
        const Eref = kC * (num(p, 'q') * 1e-6) / (5 * CM) ** 2;
        const len = pr.mag > 0 ? Math.min(2.2, 0.4 + 0.6 * Math.log10(1 + pr.mag / Eref)) : 0;
        probeArrow.set(probe.position, [(pr.E[0] / (pr.mag || 1)) * len, (pr.E[1] / (pr.mag || 1)) * len, 0], `E = ${n(pr.mag)} N/C`);
        if (t === 0) { test.x = num(p, 'px'); test.y = num(p, 'py'); }
        testBall.position.set(test.x, test.y, 0.12);
        testTrail.flush();
      },
      done: () => !test.active,
      time: () => t,
      actions: () => [{
        id: 'release', label: t > 0 ? 'Release again from probe' : 'Release test charge (+1 nC, 1 g)', primary: true,
        run: () => { test = { x: num(p, 'px'), y: num(p, 'py'), vx: 0, vy: 0, active: true }; testTrail.clearPoints(); t = 0; },
      }],
      readouts(): Readout[] {
        const qs = Q();
        const pr = probeField();
        const out: Readout[] = [
          { label: '|E| at probe', value: pr.mag, unit: 'N/C', tone: 'accent' },
          { label: 'V at probe', value: pr.V, unit: 'V', tone: 'accent' },
          { label: 'E direction', value: `${n((Math.atan2(pr.E[1], pr.E[0]) * 180) / Math.PI, 3)}°` },
          { label: 'Force on +1 nC at probe', value: pr.mag * Q_TEST, unit: 'N' },
        ];
        if (qs.length === 2) {
          const r = Math.hypot(qs[0].pos[0] - qs[1].pos[0], qs[0].pos[1] - qs[1].pos[1]);
          const F = coulomb(qs[0].q, qs[1].q, r);
          out.push({ label: 'Force between charges', value: Math.abs(F), unit: 'N' }, { label: 'Nature', value: F > 0 ? 'Repulsive' : 'Attractive' });
        }
        if (str(p, 'config') === 'dipole') out.push({ label: 'Dipole moment p = q·d', value: num(p, 'q') * 1e-6 * num(p, 'd') * CM, unit: 'C·m' });
        return out;
      },
      equations(): Equation[] {
        const pr = probeField();
        const q = num(p, 'q');
        const out: Equation[] = [
          { expr: 'E = k q / r²  (each charge)', sub: `k = 8.99 × 10⁹ N·m²/C², q = ${n(q)} µC` },
          { expr: 'E_net = Σ Eᵢ  (vector sum)', sub: `|E| = ${n(pr.mag)} N/C at (${num(p, 'px')}, ${num(p, 'py')}) cm` },
          { expr: 'V = Σ k qᵢ / rᵢ  (scalar sum)', sub: `V = ${n(pr.V)} V` },
          { expr: 'F = qE', sub: `F on 1 nC = ${n(pr.mag * Q_TEST)} N` },
        ];
        if (str(p, 'config') === 'dipole') out.push({ expr: 'E_axial = 2kp / r³ ,  E_equatorial = kp / r³', note: 'Valid far from the dipole (r ≫ d).' });
        return out;
      },
    };
  },
};

export default sim;
