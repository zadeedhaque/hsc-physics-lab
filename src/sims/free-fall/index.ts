import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { bool, num } from '../types';
import { C } from '../../engine/colors';
import { n, ruler, sampler } from '../shared';

const H_SCENE = 9; // scene height used for the drop

interface Body { y: number; v: number; landed: boolean; tLand: number }

const sim: SimDefinition = {
  camera: { position: [0, 4.8, 15], target: [0, 4.6, 0], aspect: 1.2 },
  hint: 'Ghost images every 0.2 s: without air the two bodies stay side by side whatever their mass.',
  params: [
    { kind: 'slider', key: 'h', label: 'Drop height', unit: 'm', min: 1, max: 100, step: 0.5, default: 20 },
    { kind: 'slider', key: 'g', label: 'Gravity', unit: 'm/s²', min: 1, max: 25, step: 0.01, default: 9.81 },
    { kind: 'slider', key: 'm1', label: 'Mass of ball A', unit: 'kg', min: 0.01, max: 10, step: 0.01, default: 5 },
    { kind: 'slider', key: 'm2', label: 'Mass of ball B', unit: 'kg', min: 0.01, max: 10, step: 0.01, default: 0.05 },
    { kind: 'toggle', key: 'air', label: 'Air resistance', default: false, hint: 'Same size & shape: F = b v² with b = 0.002 kg/m' },
  ],
  presets: [
    { label: 'Vacuum (Galileo)', values: { air: false, m1: 5, m2: 0.05, h: 20 } },
    { label: 'In air', values: { air: true, m1: 5, m2: 0.05, h: 40 } },
    { label: 'Moon', values: { air: false, g: 1.62, h: 20 } },
    { label: 'Tall tower', values: { air: true, h: 100, m1: 5, m2: 0.2 } },
  ],
  graphs: [
    { id: 'y', title: 'Height vs time', x: 't (s)', y: 'y (m)', zeroY: true, series: [{ label: 'A', color: C.force }, { label: 'B', color: C.acceleration }] },
    { id: 'v', title: 'Speed vs time', x: 't (s)', y: 'v (m/s)', zeroY: true, series: [{ label: 'A', color: C.force }, { label: 'B', color: C.acceleration }] },
  ],
  learn: {
    concept: 'Near a planet’s surface every body falls with the same acceleration g if air resistance is negligible, whatever its mass. With air resistance, the drag force depends on speed and size but not on mass, so a lighter body of the same shape reaches a lower terminal velocity and lands later.',
    variables: [['h', 'height fallen (m)'], ['g', 'acceleration due to gravity (m/s²)'], ['t', 'time (s)'], ['v', 'speed (m/s)'], ['b', 'drag constant (kg/m)']],
    observe: [
      'In vacuum the ghost images of A and B match exactly.',
      'The gaps between ghost images grow: the body covers more distance each 0.2 s.',
      'With air on, B’s speed levels off at its terminal velocity — the curve flattens.',
      'On the Moon everything falls more slowly, but still together.',
    ],
    challenge: 'Without air, from what height does a ball take exactly 3 s to fall on Earth? Use h = ½gt², then set it.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0;
    let A: Body = { y: 0, v: 0, landed: false, tLand: 0 }, B: Body = { ...A };
    let nextGhost = 0.2;
    const sample = sampler(1 / 30);
    const B_DRAG = 0.002;

    kit.box(8, 0.2, 4, '#334155').position.set(0, -0.1, 0);
    const tower = kit.box(0.8, H_SCENE, 0.8, '#475569');
    tower.position.set(-3.2, H_SCENE / 2, 0);
    const ledge = kit.box(4.4, 0.15, 1.2, '#64748b');
    ledge.position.set(-1.2, H_SCENE + 0.07, 0);
    const ballA = kit.sphere(0.3, C.force, { emissive: 0.2 });
    const ballB = kit.sphere(0.3, C.acceleration, { emissive: 0.2 });
    kit.label('A', [-1, H_SCENE + 0.7, 0], { color: C.force, small: true });
    kit.label('B', [1, H_SCENE + 0.7, 0], { color: C.acceleration, small: true });
    const ghosts = kit.add(new THREE.Group());
    const rul = kit.add(new THREE.Group());
    const vA = kit.arrow(C.velocity, { label: 'v_A', radius: 0.03 });
    const vB = kit.arrow(C.velocity, { label: 'v_B', radius: 0.03 });

    const scale = () => H_SCENE / num(p, 'h');
    const k = (m: number) => (bool(p, 'air') ? B_DRAG / m : 0);

    function stepBody(b: Body, m: number, dt: number) {
      if (b.landed) return;
      const g = num(p, 'g');
      const acc = g - k(m) * b.v * Math.abs(b.v);
      b.v += acc * dt;
      b.y -= b.v * dt;
      if (b.y <= 0) { b.y = 0; b.landed = true; b.tLand = t; }
    }

    function reset() {
      const h = num(p, 'h');
      A = { y: h, v: 0, landed: false, tLand: 0 };
      B = { y: h, v: 0, landed: false, tLand: 0 };
      t = 0; nextGhost = 0.2; sample.reset();
      kit.clearGroup(ghosts);
      ruler(kit, rul, { axis: 'y', origin: [2.6, 0, 0], length: h, scale: scale(), unit: 'm', target: 5 });
      graphs.get('y').push(0, h, h);
      graphs.get('v').push(0, 0, 0);
    }
    reset();

    return {
      setParams(np) { p = np; graphs.clearLive(); reset(); },
      reset,
      step(dt) {
        if (A.landed && B.landed) return;
        t += dt;
        stepBody(A, num(p, 'm1'), dt);
        stepBody(B, num(p, 'm2'), dt);
        if (t >= nextGhost) {
          nextGhost += 0.2;
          for (const [b, x, c] of [[A, -1, C.force], [B, 1, C.acceleration]] as [Body, number, string][]) {
            if (b.landed) continue;
            const gm = kit.sphere(0.3, c, { opacity: 0.18 }, 16);
            gm.position.set(x, b.y * scale() + 0.3, -0.3);
            ghosts.add(gm);
          }
        }
        if (sample.due(t)) { graphs.get('y').push(t, A.y, B.y); graphs.get('v').push(t, A.v, B.v); }
      },
      render() {
        ballA.position.set(-1, A.y * scale() + 0.3, 0);
        ballB.position.set(1, B.y * scale() + 0.3, 0);
        const vs = 1.5 / Math.max(Math.sqrt(2 * num(p, 'g') * num(p, 'h')), 1);
        vA.set([-1.6, A.y * scale() + 0.3, 0], [0, -A.v * vs, 0], `${n(A.v)} m/s`);
        vB.set([1.6, B.y * scale() + 0.3, 0], [0, -B.v * vs, 0], `${n(B.v)} m/s`);
      },
      done: () => A.landed && B.landed,
      time: () => t,
      readouts(): Readout[] {
        const h = num(p, 'h'), g = num(p, 'g');
        const out: Readout[] = [
          { label: 'Fall time (no air) √(2h/g)', value: Math.sqrt((2 * h) / g), unit: 's', tone: 'accent' },
          { label: 'Impact speed (no air) √(2gh)', value: Math.sqrt(2 * g * h), unit: 'm/s', tone: 'accent' },
          { label: 'Speed of A', value: A.v, unit: 'm/s' },
          { label: 'Speed of B', value: B.v, unit: 'm/s' },
          { label: 'A landed at', value: A.landed ? `${n(A.tLand)} s` : 'falling…' },
          { label: 'B landed at', value: B.landed ? `${n(B.tLand)} s` : 'falling…' },
        ];
        if (bool(p, 'air')) {
          out.push({ label: 'Terminal speed of A', value: Math.sqrt((g * num(p, 'm1')) / B_DRAG), unit: 'm/s' }, { label: 'Terminal speed of B', value: Math.sqrt((g * num(p, 'm2')) / B_DRAG), unit: 'm/s' });
        }
        return out;
      },
      equations(): Equation[] {
        const h = num(p, 'h'), g = num(p, 'g');
        const out: Equation[] = [
          { expr: 'h = ½ g t²', sub: `t = √(2 × ${n(h)} / ${n(g)}) = ${n(Math.sqrt((2 * h) / g))} s` },
          { expr: 'v = g t ,  v² = 2 g h', sub: `v = √(2 × ${n(g)} × ${n(h)}) = ${n(Math.sqrt(2 * g * h))} m/s` },
        ];
        if (bool(p, 'air')) out.push({ expr: 'm dv/dt = m g − b v²', note: 'Terminal speed when mg = bv² → v_t = √(mg/b): heavier bodies of the same shape fall faster in air.' });
        return out;
      },
    };
  },
};

export default sim;
