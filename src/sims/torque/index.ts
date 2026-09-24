import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num } from '../types';
import { rad } from '../../lib/num';
import { C } from '../../engine/colors';
import { n, sampler } from '../shared';

const L = 3; // half-length of the plank (m)
const PLANK_M = 4; // kg
const LIMIT = rad(18);

const sim: SimDefinition = {
  camera: { position: [0, 3, 10], target: [0, 1.4, 0], aspect: 1.6 },
  hint: 'Only the component of the force perpendicular to the lever turns it — the dashed line is the moment arm.',
  params: [
    { kind: 'slider', key: 'F', label: 'Applied force F (right side)', unit: 'N', min: 0, max: 200, step: 1, default: 60 },
    { kind: 'slider', key: 'r', label: 'Distance of F from pivot r', unit: 'm', min: 0.2, max: 3, step: 0.05, default: 2 },
    { kind: 'slider', key: 'ang', label: 'Angle between F and lever', unit: '°', min: 0, max: 180, step: 1, default: 90 },
    { kind: 'slider', key: 'm', label: 'Load mass (left side)', unit: 'kg', min: 0, max: 20, step: 0.5, default: 5 },
    { kind: 'slider', key: 'd', label: 'Distance of load from pivot', unit: 'm', min: 0.2, max: 3, step: 0.05, default: 2.4 },
  ],
  presets: [
    { label: 'Balanced', values: { F: 58.86, r: 2, ang: 90, m: 5, d: 2.4 } },
    { label: 'Long lever', values: { F: 30, r: 3, ang: 90, m: 10, d: 0.8 } },
    { label: 'Slanted force', values: { F: 100, r: 2, ang: 30, m: 5, d: 2 } },
    { label: 'Force along lever', values: { F: 150, r: 2, ang: 0, m: 2, d: 2 } },
  ],
  graphs: [
    { id: 'tau', title: 'Torque of F vs angle', x: 'angle (°)', y: 'τ (N·m)', kind: 'curve', xRange: [0, 180], zeroY: true, series: [{ label: 'τ = rF sin θ', color: C.force }, { label: 'load torque', color: C.weight, dashed: true }] },
  ],
  learn: {
    concept: 'Torque (moment of a force) measures the turning effect of a force about a pivot: τ = rF sin θ, where r is the distance from the pivot and θ the angle between the force and the lever. A body is in rotational equilibrium when the clockwise and anticlockwise moments are equal (principle of moments).',
    variables: [['τ', 'torque (N·m)'], ['r', 'distance from pivot (m)'], ['F', 'force (N)'], ['θ', 'angle between F and the lever'], ['α', 'angular acceleration = τ_net / I']],
    observe: [
      'Pushing at 90° gives the largest torque; pushing along the lever gives none.',
      'Doubling r doubles the torque — why door handles are far from the hinges.',
      'When the two torques match the plank stays level.',
    ],
    challenge: 'A 10 kg load sits 0.8 m from the pivot. What is the smallest force at r = 3 m that balances it? Check with the principle of moments.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let th = 0, w = 0, t = 0; // plank angle (rad, + = anticlockwise, right side up)
    const sample = sampler(1 / 20);
    kit.box(10, 0.2, 3, '#1e293b').position.y = -0.1;
    const pivot = kit.cylinder(0.05, 0.6, 1.2, '#64748b', undefined, 3);
    pivot.position.y = 0.6;
    const plankG = kit.add(new THREE.Group());
    plankG.position.set(0, 1.25, 0);
    const plank = kit.box(2 * L, 0.12, 0.8, '#d6b98c');
    plankG.add(plank);
    const load = kit.box(0.5, 0.5, 0.5, C.weight);
    plankG.add(load);
    const Farrow = kit.arrow(C.force, { label: 'F', radius: 0.05 });
    const Warrow = kit.arrow(C.weight, { label: 'W', radius: 0.05 });
    const arm = kit.line('#94a3b8', [], { dashed: true, width: 1.5 });
    const armLabel = kit.label('', [0, 0, 0], { small: true });
    const status = kit.label('', [0, 3.6, 0]);

    const tauF = () => num(p, 'r') * num(p, 'F') * Math.sin(rad(num(p, 'ang')));
    const tauW = () => num(p, 'm') * 9.81 * num(p, 'd');
    const I = () => PLANK_M * (2 * L) ** 2 / 12 + num(p, 'm') * num(p, 'd') ** 2;
    // F pushes downward on the right when ang = 90 (clockwise, negative); load on left gives anticlockwise? define:
    // Right side force pointing "down-ish" makes clockwise torque (−). Left load makes anticlockwise torque (+).
    const net = () => tauW() - tauF();

    function curve() {
      graphs.get('tau').plot(0, 0, 180, (a) => num(p, 'r') * num(p, 'F') * Math.sin(rad(a)), 180);
      graphs.get('tau').plot(1, 0, 180, () => tauW(), 2);
      graphs.get('tau').setMarkers([{ x: num(p, 'ang'), y: tauF(), color: C.force }]);
    }
    const reset = () => { th = 0; w = 0; t = 0; sample.reset(); curve(); };
    reset();

    return {
      setParams(np) { p = np; curve(); },
      reset,
      step(dt) {
        t += dt;
        const alpha = net() / I();
        w += alpha * dt;
        th += w * dt;
        if (th > LIMIT) { th = LIMIT; w = 0; }
        if (th < -LIMIT) { th = -LIMIT; w = 0; }
        void sample;
      },
      render() {
        plankG.rotation.z = th;
        load.position.set(-num(p, 'd'), 0.31, 0);
        const c = Math.cos(th), s = Math.sin(th);
        const P = new THREE.Vector3(num(p, 'r') * c, 1.25 + num(p, 'r') * s, 0);
        // F direction: angle measured from the lever's +x direction, pointing downward side
        const a = rad(num(p, 'ang'));
        const dir = new THREE.Vector3(Math.cos(th - a), Math.sin(th - a), 0);
        const len = 0.3 + (num(p, 'F') / 200) * 2;
        Farrow.set(P.clone().addScaledVector(dir, -len), dir.clone().multiplyScalar(len), `F = ${n(num(p, 'F'))} N`);
        const Lp = new THREE.Vector3(-num(p, 'd') * c, 1.25 - num(p, 'd') * s, 0);
        Warrow.set(Lp, [0, -(0.3 + (tauW() / Math.max(num(p, 'd'), 0.2) / 200) * 2), 0], `W = ${n(num(p, 'm') * 9.81)} N`);
        Warrow.visible = num(p, 'm') > 0;
        // Moment arm: perpendicular from pivot to the line of action of F
        const O = new THREE.Vector3(0, 1.25, 0);
        const foot = P.clone().addScaledVector(dir, O.clone().sub(P).dot(dir));
        arm.setPoints([O, foot]);
        armLabel.at(O.clone().lerp(foot, 0.5).add(new THREE.Vector3(0, 0.25, 0))).setText(`r sin θ = ${n(Math.abs(num(p, 'r') * Math.sin(a)))} m`);
        const nt = net();
        status.setText(Math.abs(nt) < 0.5 ? 'Balanced (principle of moments)' : nt > 0 ? 'Turns anticlockwise' : 'Turns clockwise');
        status.setColor(Math.abs(nt) < 0.5 ? C.normal : C.resultant);
      },
      time: () => t,
      readouts(): Readout[] {
        return [
          { label: 'Torque of F (clockwise)', value: tauF(), unit: 'N·m', tone: 'accent' },
          { label: 'Torque of load (anticlockwise)', value: tauW(), unit: 'N·m', tone: 'accent' },
          { label: 'Net torque', value: net(), unit: 'N·m' },
          { label: 'Moment of inertia (plank + load)', value: I(), unit: 'kg·m²' },
          { label: 'Angular acceleration', value: net() / I(), unit: 'rad/s²' },
          { label: 'Force needed to balance (at 90°)', value: tauW() / num(p, 'r'), unit: 'N' },
        ];
      },
      equations(): Equation[] {
        return [
          { expr: 'τ = r F sin θ', sub: `τ_F = ${n(num(p, 'r'))} × ${n(num(p, 'F'))} × sin ${num(p, 'ang')}° = ${n(tauF())} N·m` },
          { expr: 'τ_load = m g d', sub: `= ${n(num(p, 'm'))} × 9.81 × ${n(num(p, 'd'))} = ${n(tauW())} N·m` },
          { expr: 'Equilibrium: Σ clockwise moments = Σ anticlockwise moments' },
          { expr: 'τ_net = I α', sub: `α = ${n(net())} / ${n(I())} = ${n(net() / I())} rad/s²` },
        ];
      },
    };
  },
};

export default sim;
