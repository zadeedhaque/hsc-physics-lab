import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num } from '../types';
import { springPoints } from '../../engine/kit';
import { C } from '../../engine/colors';
import { Bar3D, distanceTrack, n, sampler } from '../shared';

const S = 4; // scene units per metre for the spring region
const WALL = -4;
const NAT = 2.4; // natural length of the spring in scene units

const sim: SimDefinition = {
  camera: { position: [0, 2.8, 10], target: [0, 0.8, 0], aspect: 1.7 },
  startPaused: true,
  hint: 'Press Play to release. The spring’s ½kx² turns into the block’s ½mv².',
  params: [
    { kind: 'slider', key: 'k', label: 'Spring constant k', unit: 'N/m', min: 20, max: 1000, step: 10, default: 200 },
    { kind: 'slider', key: 'x', label: 'Compression x', unit: 'm', min: 0.02, max: 0.5, step: 0.01, default: 0.3 },
    { kind: 'slider', key: 'm', label: 'Mass of block', unit: 'kg', min: 0.1, max: 5, step: 0.1, default: 1 },
    { kind: 'slider', key: 'mu', label: 'Friction μ (after launch)', min: 0, max: 0.5, step: 0.01, default: 0.1 },
  ],
  presets: [
    { label: 'Stiff spring', values: { k: 800, x: 0.2 } },
    { label: 'Soft spring', values: { k: 60, x: 0.45 } },
    { label: 'Double compression', values: { k: 200, x: 0.4 } },
    { label: 'Frictionless', values: { mu: 0 } },
  ],
  graphs: [
    { id: 'E', title: 'Energy vs time', x: 't (s)', y: 'J', zeroY: true, series: [{ label: 'spring PE ½kx²', color: C.weight }, { label: 'KE ½mv²', color: C.normal }, { label: 'heat', color: C.friction, dashed: true }] },
    { id: 'Fx', title: 'Spring force vs compression (area = energy)', x: 'x (m)', y: 'F (N)', kind: 'curve', xRange: [0, 0.5], zeroY: true, series: [{ label: 'F = kx', color: C.force }] },
  ],
  learn: {
    concept: 'A stretched or compressed spring stores elastic potential energy ½kx² — the area under its force–extension line F = kx. When released, this energy becomes kinetic energy of the block, so ½kx² = ½mv² if nothing is lost.',
    variables: [['k', 'spring constant (N/m)'], ['x', 'compression (m)'], ['U', 'elastic PE ½kx² (J)'], ['v', 'launch speed x√(k/m)']],
    observe: [
      'Doubling the compression quadruples the stored energy.',
      'The launch speed is proportional to the compression.',
      'After launch, friction converts the KE into heat until the block stops.',
    ],
    challenge: 'Choose k and x so a 2 kg block leaves the spring at exactly 3 m/s.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0, xs = 0, v = 0, heat = 0, launched = false, stopped = false; // xs = displacement from natural length (m, − = compressed)
    const sample = sampler(1 / 60);
    distanceTrack(kit, -6, 60);
    const wall = kit.box(0.3, 2, 2, '#475569');
    wall.position.set(WALL - 0.15, 1, 0);
    const spring = kit.line('#cbd5e1', [], { width: 2.5 });
    const plate = kit.box(0.08, 0.7, 0.7, '#94a3b8');
    const block = kit.box(0.7, 0.7, 0.7, C.bodyAlt);
    const vArrow = kit.arrow(C.velocity, { label: 'v' });
    const bars = kit.add(new THREE.Group());
    const bU = new Bar3D(kit, C.weight, 'U', 2.5, 0.35);
    const bK = new Bar3D(kit, C.normal, 'KE', 2.5, 0.35); bK.position.x = 0.5;
    const bH = new Bar3D(kit, C.friction, 'heat', 2.5, 0.35); bH.position.x = 1;
    bars.add(bU, bK, bH);

    const U0 = () => 0.5 * num(p, 'k') * num(p, 'x') ** 2;
    const reset = () => {
      t = 0; xs = -num(p, 'x'); v = 0; heat = 0; launched = false; stopped = false; sample.reset(); kit.followX(0, 1);
      graphs.get('Fx').plot(0, 0, 0.5, (x) => num(p, 'k') * x, 2);
      graphs.get('Fx').setMarkers([{ x: num(p, 'x'), y: num(p, 'k') * num(p, 'x'), label: `U = ${n(U0())} J`, color: C.force }]);
    };
    reset();

    return {
      setParams(np) { p = np; graphs.clearLive(); reset(); },
      reset,
      step(dt) {
        if (stopped) return;
        const k = num(p, 'k'), m = num(p, 'm');
        if (!launched) {
          // in contact with the spring: a = −k x / m
          const a = (-k * xs) / m;
          v += a * dt; xs += v * dt;
          if (xs >= 0) { launched = true; xs = 0; }
        } else {
          const a = num(p, 'mu') * 9.81;
          const vNew = v - a * dt;
          const vv = vNew <= 0 ? 0 : vNew;
          const dx = ((v + vv) / 2) * dt;
          heat += num(p, 'mu') * m * 9.81 * dx;
          xs += dx; v = vv;
          if (v === 0) stopped = true;
          if (xs > 55) stopped = true;
        }
        t += dt;
        if (sample.due(t) || stopped) {
          const U = launched ? 0 : 0.5 * k * xs * xs;
          graphs.get('E').push(t, U, 0.5 * m * v * v, heat);
        }
      },
      render() {
        const plateX = WALL + NAT + (launched ? 0 : xs) * S;
        spring.setPoints(springPoints([WALL, 0.45, 0], [plateX, 0.45, 0], 10, 0.22));
        plate.position.set(plateX, 0.45, 0);
        // while compressed the spring region is drawn magnified (S units per metre); after launch 1 unit = 1 m
        block.position.set(launched ? WALL + NAT + 0.39 + xs : plateX + 0.39, 0.35, 0);
        vArrow.set([block.position.x, 1.1, 0], [Math.min(3, v * 0.4), 0, 0], `v = ${n(v)} m/s`);
        bars.position.set(block.position.x + 2.5, 0, -1.2);
        const U = launched ? 0 : 0.5 * num(p, 'k') * xs * xs;
        const E = U0() || 1;
        bU.set(U / E); bK.set((0.5 * num(p, 'm') * v * v) / E); bH.set(heat / E);
        kit.followX(Math.max(0, block.position.x));
      },
      done: () => stopped,
      time: () => t,
      readouts(): Readout[] {
        const k = num(p, 'k'), m = num(p, 'm'), x = num(p, 'x');
        const vl = x * Math.sqrt(k / m);
        return [
          { label: 'Stored energy ½kx²', value: U0(), unit: 'J', tone: 'accent' },
          { label: 'Launch speed x√(k/m)', value: vl, unit: 'm/s', tone: 'accent' },
          { label: 'Current speed', value: v, unit: 'm/s' },
          { label: 'Max spring force kx', value: k * x, unit: 'N' },
          { label: 'Sliding distance after launch', value: num(p, 'mu') > 0 ? (vl * vl) / (2 * num(p, 'mu') * 9.81) : 'keeps going', unit: num(p, 'mu') > 0 ? 'm' : undefined },
          { label: 'Heat produced', value: heat, unit: 'J' },
        ];
      },
      equations(): Equation[] {
        const k = num(p, 'k'), m = num(p, 'm'), x = num(p, 'x');
        return [
          { expr: 'U = ½ k x²', sub: `= ½ × ${n(k)} × ${n(x)}² = ${n(U0())} J` },
          { expr: '½ k x² = ½ m v²  ⇒  v = x √(k/m)', sub: `v = ${n(x)} × √(${n(k)}/${n(m)}) = ${n(x * Math.sqrt(k / m))} m/s` },
          { expr: 'F = −k x  (Hooke’s law)', sub: `F_max = ${n(k * x)} N` },
        ];
      },
    };
  },
};

export default sim;
