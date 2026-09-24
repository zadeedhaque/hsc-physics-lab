import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { bool, num, str } from '../types';
import { add, sub, dot, cross, mag, angleBetween, fromPolar, type Vec3 } from '../../physics/vectors';
import { rad, deg } from '../../lib/num';
import { C } from '../../engine/colors';
import { n } from '../shared';

const S = 0.45; // scene units per vector unit
const V = (a: Vec3) => new THREE.Vector3(a[0] * S, a[1] * S, a[2] * S);
const fmtV = (a: Vec3) => `(${n(a[0])}, ${n(a[1])}, ${n(a[2])})`;

const sim: SimDefinition = {
  camera: { position: [5.5, 4.5, 9], target: [1.2, 1.2, 0] },
  timeless: true,
  hint: 'Drag to orbit the 3D view. x → right, y ↑ up, z toward you.',
  params: [
    { kind: 'select', key: 'op', label: 'Operation', default: 'add', options: [
      { value: 'add', label: 'A + B' }, { value: 'sub', label: 'A − B' }, { value: 'dot', label: 'A · B' }, { value: 'cross', label: 'A × B' },
    ] },
    { kind: 'slider', key: 'am', label: 'Magnitude |A|', unit: '', min: 0, max: 10, step: 0.1, default: 6 },
    { kind: 'slider', key: 'at', label: 'A direction θ (in x–y plane)', unit: '°', min: 0, max: 360, step: 1, default: 20 },
    { kind: 'slider', key: 'ap', label: 'A elevation φ (toward z)', unit: '°', min: -90, max: 90, step: 1, default: 0 },
    { kind: 'slider', key: 'bm', label: 'Magnitude |B|', unit: '', min: 0, max: 10, step: 0.1, default: 4 },
    { kind: 'slider', key: 'bt', label: 'B direction θ (in x–y plane)', unit: '°', min: 0, max: 360, step: 1, default: 75 },
    { kind: 'slider', key: 'bp', label: 'B elevation φ (toward z)', unit: '°', min: -90, max: 90, step: 1, default: 0 },
    { kind: 'toggle', key: 'comp', label: 'Show x/y/z components', default: false },
    { kind: 'toggle', key: 'para', label: 'Show parallelogram construction', default: true },
  ],
  presets: [
    { label: 'Perpendicular', values: { am: 5, at: 0, ap: 0, bm: 5, bt: 90, bp: 0 } },
    { label: 'Parallel', values: { am: 5, at: 30, ap: 0, bm: 3, bt: 30, bp: 0 } },
    { label: 'Opposite', values: { am: 5, at: 0, ap: 0, bm: 3, bt: 180, bp: 0 } },
    { label: 'Fully 3D', values: { am: 6, at: 30, ap: 35, bm: 5, bt: 120, bp: -20 } },
    { label: '3-4-5', values: { am: 3, at: 0, ap: 0, bm: 4, bt: 90, bp: 0 } },
  ],
  learn: {
    concept: 'A vector has magnitude and direction. Vectors add tip-to-tail (triangle law) or as the diagonal of the parallelogram they span. The dot product measures how much one vector points along another; the cross product gives a vector perpendicular to both.',
    variables: [['A, B', 'input vectors'], ['R', 'resultant'], ['θ', 'angle between A and B'], ['Aₓ, A_y, A_z', 'components']],
    observe: [
      '|A + B| is largest when the vectors are parallel and smallest when opposite.',
      'A · B is zero when the vectors are perpendicular and negative beyond 90°.',
      'A × B flips direction when you swap the order of A and B (use the right-hand rule).',
      'The area of the shaded parallelogram equals |A × B|.',
    ],
    challenge: 'Using the Operation “A + B”, find the angle between two 5-unit vectors that gives a resultant of exactly 5 units. Check with R² = A² + B² + 2AB cos θ.',
  },

  create({ kit, params }) {
    let p: Params = params;
    kit.grid(12, 12, 'xy', 0).position.z = -0.001;
    kit.axes(5, [0, 0, 0], ['x', 'y', 'z']);
    kit.sphere(0.06, '#e2e8f0');

    const aA = kit.arrow(C.force, { label: 'A', radius: 0.045 });
    const aB = kit.arrow(C.acceleration, { label: 'B', radius: 0.045 });
    const aR = kit.arrow(C.resultant, { label: 'R', radius: 0.055 });
    const ghostA = kit.arrow(C.force, { radius: 0.025, opacity: 0.35 });
    const ghostB = kit.arrow(C.acceleration, { radius: 0.025, opacity: 0.35 });
    const proj = kit.arrow(C.normal, { label: 'A cos θ', radius: 0.04 });
    const perpLine = kit.line('#94a3b8', [], { dashed: true, width: 1.5, opacity: 0.8 });
    const arc = kit.line('#e2e8f0', [], { width: 1.5 });
    const arcLabel = kit.label('', [0, 0, 0], { small: true });
    const compLines = [0, 1, 2, 3, 4, 5].map(() => kit.line('#94a3b8', [], { dashed: true, width: 1.2, opacity: 0.7 }));
    const areaGeom = new THREE.BufferGeometry();
    const area = kit.add(new THREE.Mesh(areaGeom, kit.mat(C.resultant, { opacity: 0.18, side: THREE.DoubleSide })));

    const vecs = () => {
      const A = fromPolar(num(p, 'am'), rad(num(p, 'at')), rad(num(p, 'ap')));
      const B = fromPolar(num(p, 'bm'), rad(num(p, 'bt')), rad(num(p, 'bp')));
      const op = str(p, 'op');
      const R = op === 'add' ? add(A, B) : op === 'sub' ? sub(A, B) : op === 'cross' ? cross(A, B) : ([0, 0, 0] as Vec3);
      return { A, B, R, op };
    };

    function draw() {
      const { A, B, R, op } = vecs();
      const O = new THREE.Vector3();
      aA.set(O, V(A));
      aB.set(O, V(B));
      const para = bool(p, 'para');
      ghostA.visible = ghostB.visible = false;
      proj.visible = false;
      perpLine.visible = false;
      area.visible = false;
      aR.visible = op !== 'dot';

      if (op === 'add') {
        aR.set(O, V(R), 'R = A + B');
        if (para) { ghostB.set(V(A), V(B)); ghostA.set(V(B), V(A)); }
      } else if (op === 'sub') {
        aR.set(O, V(R), 'R = A − B');
        if (para) { ghostB.set(V(A), V(B).negate()); }
      } else if (op === 'cross') {
        // Scale the (possibly large) cross product for display.
        const m = mag(R);
        const disp = m > 0 ? V(R).multiplyScalar(Math.min(1, 6 / (m * S)) ) : new THREE.Vector3();
        aR.set(O, disp, 'A × B');
        if (para) {
          const pts = [O, V(A), V(A).add(V(B)), V(B)];
          areaGeom.setAttribute('position', new THREE.Float32BufferAttribute([...pts[0].toArray(), ...pts[1].toArray(), ...pts[2].toArray(), ...pts[0].toArray(), ...pts[2].toArray(), ...pts[3].toArray()], 3));
          areaGeom.computeVertexNormals();
          areaGeom.computeBoundingSphere();
          area.visible = true;
        }
      } else if (op === 'dot') {
        const mb = mag(B);
        if (mb > 0) {
          const along = dot(A, B) / mb;
          const u: Vec3 = [B[0] / mb, B[1] / mb, B[2] / mb];
          const projV: Vec3 = [u[0] * along, u[1] * along, u[2] * along];
          proj.set(O, V(projV));
          perpLine.setPoints([V(A), V(projV)]);
        }
      }

      // Angle arc between A and B
      const th = angleBetween(A, B);
      const ua = V(A).normalize(), ub = V(B).normalize();
      if (mag(A) > 0 && mag(B) > 0 && th > 1e-3 && th < Math.PI - 1e-3) {
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= 32; i++) pts.push(new THREE.Vector3().copy(ua).lerp(ub, i / 32).normalize().multiplyScalar(0.9));
        arc.setPoints(pts);
        arcLabel.at(pts[16].clone().multiplyScalar(1.35)).setText(`θ = ${deg(th).toFixed(1)}°`);
        arcLabel.visible = true;
      } else { arc.visible = false; arcLabel.visible = false; }

      // Components of R (or A for dot)
      const show = bool(p, 'comp');
      const target = op === 'dot' ? A : R;
      const T = V(target);
      const lines: [THREE.Vector3, THREE.Vector3][] = [
        [T, new THREE.Vector3(T.x, 0, T.z)], [new THREE.Vector3(T.x, 0, T.z), new THREE.Vector3(T.x, 0, 0)], [new THREE.Vector3(T.x, 0, T.z), new THREE.Vector3(0, 0, T.z)],
        [T, new THREE.Vector3(0, T.y, 0)], [T, new THREE.Vector3(T.x, T.y, 0)], [new THREE.Vector3(T.x, T.y, 0), new THREE.Vector3(T.x, 0, 0)],
      ];
      compLines.forEach((l, i) => { if (show) l.setPoints(lines[i]); else l.visible = false; });
    }
    draw();

    return {
      setParams(np) { p = np; draw(); },
      reset() { draw(); },
      step() {},
      readouts(): Readout[] {
        const { A, B, R, op } = vecs();
        const th = deg(angleBetween(A, B));
        const out: Readout[] = [
          { label: 'A (x, y, z)', value: fmtV(A) },
          { label: 'B (x, y, z)', value: fmtV(B) },
          { label: 'Angle between A and B', value: th, unit: '°' },
        ];
        if (op === 'dot') {
          out.push({ label: 'A · B', value: dot(A, B), tone: 'accent' }, { label: 'Projection of A on B', value: mag(B) ? dot(A, B) / mag(B) : 0 });
        } else {
          out.push(
            { label: op === 'cross' ? 'A × B components' : 'R (x, y, z)', value: fmtV(R), tone: 'accent' },
            { label: op === 'cross' ? '|A × B| (area)' : '|R|', value: mag(R), tone: 'accent' },
          );
          if (op !== 'cross' && mag(R) > 0) out.push({ label: 'R direction from +x (x–y plane)', value: (deg(Math.atan2(R[1], R[0])) + 360) % 360, unit: '°' });
        }
        return out;
      },
      equations(): Equation[] {
        const { A, B, R, op } = vecs();
        const a = mag(A), b = mag(B), th = angleBetween(A, B);
        if (op === 'add') return [
          { expr: 'R = A + B = (Aₓ+Bₓ) î + (A_y+B_y) ĵ + (A_z+B_z) k̂', sub: `R = ${fmtV(R)}` },
          { expr: 'R² = A² + B² + 2AB cos θ', sub: `R = √(${n(a)}² + ${n(b)}² + 2·${n(a)}·${n(b)}·cos ${deg(th).toFixed(1)}°) = ${n(mag(R))}` },
          { expr: 'tan α = B sin θ / (A + B cos θ)', note: 'α = angle of R measured from A (for coplanar A, B)' },
        ];
        if (op === 'sub') return [
          { expr: 'R = A − B = A + (−B)', sub: `R = ${fmtV(R)}` },
          { expr: 'R² = A² + B² − 2AB cos θ', sub: `|R| = ${n(mag(R))}` },
        ];
        if (op === 'dot') return [
          { expr: 'A · B = AB cos θ', sub: `= ${n(a)} × ${n(b)} × cos ${deg(th).toFixed(1)}° = ${n(dot(A, B))}` },
          { expr: 'A · B = AₓBₓ + A_yB_y + A_zB_z', sub: `= ${n(A[0] * B[0])} + ${n(A[1] * B[1])} + ${n(A[2] * B[2])} = ${n(dot(A, B))}` },
        ];
        return [
          { expr: '|A × B| = AB sin θ', sub: `= ${n(a)} × ${n(b)} × sin ${deg(th).toFixed(1)}° = ${n(mag(R))}` },
          { expr: 'A × B = (A_yB_z − A_zB_y) î + (A_zBₓ − AₓB_z) ĵ + (AₓB_y − A_yBₓ) k̂', sub: `= ${fmtV(R)}` },
          { expr: 'B × A = −(A × B)', note: 'Direction by the right-hand rule: curl fingers from A to B, thumb gives A × B. The arrow is scaled down if very long.' },
        ];
      },
    };
  },
};

export default sim;
