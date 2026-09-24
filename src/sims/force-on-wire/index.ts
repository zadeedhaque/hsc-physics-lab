import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num } from '../types';
import { wireForce } from '../../physics/magnetism';
import { rad } from '../../lib/num';
import { C } from '../../engine/colors';
import { n } from '../shared';

const sim: SimDefinition = {
  camera: { position: [5, 5, 8], target: [0, 0.5, 0], aspect: 1.5 },
  hint: 'Fleming’s left-hand rule: First finger = Field, seCond finger = Current, thuMb = Motion (force). F = IL × B.',
  params: [
    { kind: 'slider', key: 'B', label: 'Magnetic field B', unit: 'T', min: 0, max: 1, step: 0.01, default: 0.4 },
    { kind: 'slider', key: 'I', label: 'Current I', unit: 'A', min: -10, max: 10, step: 0.1, default: 5 },
    { kind: 'slider', key: 'L', label: 'Length of wire in the field', unit: 'cm', min: 1, max: 30, step: 0.5, default: 10 },
    { kind: 'slider', key: 'theta', label: 'Angle between wire and field', unit: '°', min: 0, max: 180, step: 1, default: 90 },
  ],
  presets: [
    { label: 'Perpendicular', values: { theta: 90 } },
    { label: 'At 30°', values: { theta: 30 } },
    { label: 'Parallel (no force)', values: { theta: 0 } },
    { label: 'Reverse current', values: { I: -5 } },
  ],
  graphs: [
    { id: 'F', title: 'Force vs angle', x: 'θ (°)', y: 'F (N)', kind: 'curve', xRange: [0, 180], zeroY: true, series: [{ label: 'F = BIL sin θ', color: C.force }] },
  ],
  learn: {
    concept: 'A current-carrying conductor in a magnetic field experiences a force F = BIL sin θ, perpendicular to both the wire and the field. This is the principle of the electric motor. The direction is given by Fleming’s left-hand rule or the vector product F = I L × B.',
    variables: [['F', 'force (N)'], ['B', 'magnetic flux density (T)'], ['I', 'current (A)'], ['L', 'length in the field (m)'], ['θ', 'angle between wire and field']],
    observe: [
      'The force is largest when the wire is perpendicular to the field.',
      'A wire parallel to the field feels no force.',
      'Reversing the current (or the field) reverses the force.',
    ],
    challenge: 'A 10 cm wire carries 5 A across a 0.4 T field. What angle gives a force of exactly 0.1 N?',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    const north = kit.box(0.8, 3, 3, C.positive, { opacity: 0.85 });
    north.position.set(-3, 0.8, 0);
    const south = kit.box(0.8, 3, 3, C.negative, { opacity: 0.85 });
    south.position.set(3, 0.8, 0);
    kit.label('N', [-3, 2.6, 0], { color: C.positive });
    kit.label('S', [3, 2.6, 0], { color: C.negative });
    const field = kit.segments(C.magnetic, { width: 1.2, opacity: 0.6 });
    const flat: number[] = [];
    for (let y = -0.4; y <= 2; y += 0.6) for (let z = -1.2; z <= 1.2; z += 0.6) flat.push(-2.6, y, z, 2.6, y, z);
    field.setSegments(flat);
    const wireG = kit.add(new THREE.Group());
    wireG.position.set(0, 0.8, 0);
    const wireMesh = kit.cylinder(0.06, 0.06, 1, '#d97706', { metalness: 0.6 });
    wireG.add(wireMesh);
    const iArrow = kit.arrow(C.current, { label: 'I', radius: 0.05 });
    const fArrow = kit.arrow(C.force, { label: 'F', radius: 0.07 });
    const bArrow = kit.arrow(C.magnetic, { label: 'B', radius: 0.05 });

    const F = () => wireForce(num(p, 'B'), num(p, 'I'), num(p, 'L') / 100, rad(num(p, 'theta')));

    function draw() {
      const th = rad(num(p, 'theta'));
      // wire lies in the x–z plane at angle θ from the field (+x)
      const dir = new THREE.Vector3(Math.cos(th), 0, -Math.sin(th));
      const Ls = 0.6 + (num(p, 'L') / 30) * 3;
      wireMesh.scale.set(1, Ls, 1);
      wireMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      const Idir = dir.clone().multiplyScalar(Math.sign(num(p, 'I')) || 1);
      iArrow.set(new THREE.Vector3(0, 1.1, 0).addScaledVector(Idir, -0.6), Idir.clone().multiplyScalar(1.2), `I = ${n(Math.abs(num(p, 'I')))} A`);
      const Fvec = new THREE.Vector3().crossVectors(dir.clone().multiplyScalar(num(p, 'I')), new THREE.Vector3(num(p, 'B'), 0, 0));
      const mag = Fvec.length();
      fArrow.set([0, 0.8, 0], mag > 1e-9 ? Fvec.normalize().multiplyScalar(0.4 + Math.min(2.2, F() * 4)) : [0, 0, 0], `F = ${n(F())} N`);
      bArrow.set([-2.4, -0.8, 1.6], [num(p, 'B') > 0 ? 1.4 : 0, 0, 0], `B = ${n(num(p, 'B'))} T`);
      graphs.get('F').plot(0, 0, 180, (a) => wireForce(num(p, 'B'), Math.abs(num(p, 'I')), num(p, 'L') / 100, rad(a)), 180);
      graphs.get('F').setMarkers([{ x: num(p, 'theta'), y: F(), color: C.force }]);
    }
    draw();

    return {
      setParams(np) { p = np; draw(); },
      reset() { draw(); },
      step() {},
      readouts(): Readout[] {
        return [
          { label: 'Force F = BIL sin θ', value: Math.abs(F()), unit: 'N', tone: 'accent' },
          { label: 'Force direction', value: Math.abs(F()) < 1e-9 ? 'none (parallel to B)' : num(p, 'I') > 0 ? 'up (+y)' : 'down (−y)' },
          { label: 'Force per unit length', value: Math.abs(F()) / (num(p, 'L') / 100), unit: 'N/m' },
          { label: 'Max possible (θ = 90°)', value: num(p, 'B') * Math.abs(num(p, 'I')) * num(p, 'L') / 100, unit: 'N' },
        ];
      },
      equations(): Equation[] {
        return [
          { expr: 'F = B I L sin θ', sub: `= ${n(num(p, 'B'))} × ${n(num(p, 'I'))} × ${n(num(p, 'L') / 100)} × sin ${num(p, 'theta')}° = ${n(F())} N` },
          { expr: 'F = I L × B  (vector form)' },
        ];
      },
    };
  },
};

export default sim;
