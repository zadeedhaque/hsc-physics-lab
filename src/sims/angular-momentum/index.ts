import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num } from '../types';
import { C } from '../../engine/colors';
import { n, sampler } from '../shared';

const R0 = 0.9; // arms fully out (m)
const I_BODY = 1.2; // kg·m² for the body about its axis

const sim: SimDefinition = {
  camera: { position: [0, 3.5, 7], target: [0, 1.3, 0], aspect: 1.4 },
  hint: 'Drag the “Arm radius” slider while it spins: angular momentum is conserved, so ω changes instantly.',
  params: [
    { kind: 'slider', key: 'w0', label: 'Spin with arms out ω₀', unit: 'rad/s', min: 0.5, max: 8, step: 0.1, default: 3 },
    { kind: 'slider', key: 'r', label: 'Arm radius r (pull in / push out)', unit: 'm', min: 0.15, max: 0.9, step: 0.01, default: 0.9 },
    { kind: 'slider', key: 'm', label: 'Mass in each hand', unit: 'kg', min: 0.5, max: 10, step: 0.5, default: 4 },
  ],
  presets: [
    { label: 'Arms out', values: { r: 0.9 } },
    { label: 'Arms half in', values: { r: 0.5 } },
    { label: 'Arms tucked', values: { r: 0.15 } },
    { label: 'Heavy dumbbells', values: { m: 10, r: 0.9 } },
  ],
  graphs: [
    { id: 'wr', title: 'Angular velocity vs arm radius (L constant)', x: 'r (m)', y: 'ω (rad/s)', kind: 'curve', xRange: [0.15, 0.9], zeroY: true, series: [{ label: 'ω = L / I(r)', color: C.velocity }] },
    { id: 'wt', title: 'ω and L vs time', x: 't (s)', y: '', window: 10, zeroY: true, series: [{ label: 'ω (rad/s)', color: C.velocity }, { label: 'L (kg·m²/s)', color: C.momentum }] },
  ],
  learn: {
    concept: 'Angular momentum L = Iω is conserved when no external torque acts. Pulling mass closer to the axis reduces the moment of inertia I, so the angular velocity ω must increase to keep L constant — exactly what a spinning skater or diver does.',
    variables: [['L', 'angular momentum (kg·m²/s)'], ['I', 'moment of inertia (kg·m²)'], ['ω', 'angular velocity (rad/s)'], ['r', 'distance of the hand masses from the axis (m)']],
    observe: [
      'Pull the arms in: ω rises, L stays exactly the same.',
      'Rotational KE = ½Iω² increases when the arms come in — the skater’s muscles do work.',
      'Heavier hand masses make the effect stronger.',
    ],
    challenge: 'With 4 kg in each hand, by what factor does ω increase when r goes from 0.9 m to 0.3 m? Compute I at both radii first.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0, angle = 0;
    const sample = sampler(1 / 20);
    kit.cylinder(2.5, 2.5, 0.1, '#bae6fd', { opacity: 0.6 }).position.y = -0.05;
    const spinner = kit.add(new THREE.Group());
    const body = kit.cylinder(0.25, 0.3, 1.8, C.acceleration);
    body.position.y = 1;
    const head = kit.sphere(0.22, '#fde68a');
    head.position.y = 2.1;
    const armL = kit.cylinder(0.05, 0.05, 1, '#fde68a');
    const armR = kit.cylinder(0.05, 0.05, 1, '#fde68a');
    const handL = kit.sphere(0.14, C.weight);
    const handR = kit.sphere(0.14, C.weight);
    [body, head, armL, armR, handL, handR].forEach((o) => spinner.add(o));
    const Larrow = kit.arrow(C.momentum, { label: 'L', radius: 0.05 });
    const vHand = kit.arrow(C.velocity, { label: 'v' });

    const I = (r = num(p, 'r')) => I_BODY + 2 * num(p, 'm') * r * r;
    const L = () => I(R0) * num(p, 'w0');
    const w = () => L() / I();

    function curve() {
      graphs.get('wr').plot(0, 0.15, 0.9, (r) => L() / I(r), 100);
      graphs.get('wr').setMarkers([{ x: num(p, 'r'), y: w(), color: C.velocity }]);
    }
    curve();

    return {
      setParams(np) { p = np; curve(); },
      reset() { t = 0; angle = 0; sample.reset(); },
      step(dt) {
        angle += w() * dt;
        t += dt;
        if (sample.due(t)) graphs.get('wt').push(t, w(), L());
      },
      render() {
        const r = num(p, 'r');
        spinner.rotation.y = angle;
        for (const [arm, hand, s] of [[armL, handL, -1], [armR, handR, 1]] as const) {
          arm.scale.y = r;
          arm.rotation.z = Math.PI / 2;
          arm.position.set((s * r) / 2, 1.5, 0);
          hand.position.set(s * r, 1.5, 0);
          hand.scale.setScalar(0.7 + 0.1 * num(p, 'm'));
        }
        Larrow.set([0, 2.4, 0], [0, 0.4 + L() * 0.03, 0], `L = ${n(L())} kg·m²/s`);
        const hx = r * Math.cos(angle), hz = -r * Math.sin(angle);
        vHand.set([hx, 1.5, hz], [-Math.sin(angle) * w() * r * 0.3, 0, -Math.cos(angle) * w() * r * 0.3], `v = ${n(w() * r)} m/s`);
      },
      time: () => t,
      readouts(): Readout[] {
        const KE0 = 0.5 * I(R0) * num(p, 'w0') ** 2;
        const KE = 0.5 * I() * w() ** 2;
        return [
          { label: 'Moment of inertia I', value: I(), unit: 'kg·m²' },
          { label: 'Angular velocity ω', value: w(), unit: 'rad/s', tone: 'accent' },
          { label: 'Revolutions per second', value: w() / (2 * Math.PI), unit: 'rev/s' },
          { label: 'Angular momentum L = Iω', value: L(), unit: 'kg·m²/s', tone: 'accent' },
          { label: 'Rotational KE', value: KE, unit: 'J' },
          { label: 'Work done pulling arms in', value: KE - KE0, unit: 'J' },
        ];
      },
      equations(): Equation[] {
        return [
          { expr: 'L = I ω = constant', sub: `${n(I(R0))} × ${n(num(p, 'w0'))} = ${n(I())} × ω  ⇒  ω = ${n(w())} rad/s` },
          { expr: 'I = I_body + 2 m r²', sub: `= ${n(I_BODY)} + 2 × ${n(num(p, 'm'))} × ${n(num(p, 'r'))}² = ${n(I())} kg·m²` },
          { expr: 'I₁ω₁ = I₂ω₂' },
          { expr: 'KE_rot = ½ I ω² = L² / 2I' },
        ];
      },
    };
  },
};

export default sim;
