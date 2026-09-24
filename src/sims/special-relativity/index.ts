import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num } from '../types';
import { lorentz } from '../../physics/modern';
import { c } from '../../physics/constants';
import { C } from '../../engine/colors';
import { n } from '../shared';

const L0 = 4; // rest length of the ship (scene)

const sim: SimDefinition = {
  camera: { position: [0, 3, 12], target: [0, 0.8, 0], aspect: 1.7 },
  hint: 'Seen from the ground, the moving ship is shorter and its clock runs slow. On board, everything looks perfectly normal.',
  params: [
    { kind: 'slider', key: 'beta', label: 'Speed v / c', min: 0, max: 0.995, step: 0.005, default: 0.8 },
    { kind: 'slider', key: 'L', label: 'Rest length of the ship', unit: 'm', min: 10, max: 200, step: 5, default: 100 },
    { kind: 'slider', key: 'm0', label: 'Rest mass of the ship', unit: 'tonnes', min: 1, max: 1000, step: 1, default: 100 },
  ],
  presets: [
    { label: 'Everyday (0.01 c)', values: { beta: 0.01 } },
    { label: '0.6 c (γ = 1.25)', values: { beta: 0.6 } },
    { label: '0.8 c (γ = 1.67)', values: { beta: 0.8 } },
    { label: '0.99 c', values: { beta: 0.99 } },
  ],
  graphs: [
    { id: 'g', title: 'Lorentz factor vs speed', x: 'v / c', y: 'γ', kind: 'curve', xRange: [0, 1], yRange: [0, 10], series: [{ label: 'γ = 1/√(1 − v²/c²)', color: C.accent }] },
    { id: 'clocks', title: 'Clock readings (ground vs ship)', x: 'ground time (s)', y: 'time (s)', window: 20, zeroY: true, series: [{ label: 'ground clock', color: '#e2e8f0' }, { label: 'ship clock', color: C.acceleration }] },
  ],
  learn: {
    concept: 'Einstein’s special relativity: the laws of physics and the speed of light are the same for all observers in uniform motion. As a result, a moving clock runs slow (time dilation, t = γt₀), a moving object is shortened along its motion (length contraction, L = L₀/γ) and its energy grows as E = γm₀c². The factor γ = 1/√(1 − v²/c²) is close to 1 at everyday speeds.',
    variables: [['γ', 'Lorentz factor'], ['t₀', 'proper time (on the moving clock)'], ['L₀', 'proper (rest) length'], ['m₀', 'rest mass'], ['v', 'relative speed'], ['c', '3 × 10⁸ m/s']],
    observe: [
      'At everyday speeds γ ≈ 1: relativity is invisible.',
      'Near c, γ grows without limit — nothing with mass can reach the speed of light.',
      'The ship shrinks only along its direction of motion.',
    ],
    challenge: 'At what speed does a ship’s clock run at half the rate of the ground clock?',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let tg = 0, ts = 0;
    const ship = kit.add(new THREE.Group());
    const body = kit.cylinder(0.5, 0.5, L0, '#cbd5e1', { metalness: 0.5 });
    body.rotation.z = Math.PI / 2;
    const nose = kit.cone('#cbd5e1', 0.5, 1);
    nose.rotation.z = -Math.PI / 2; nose.position.x = L0 / 2 + 0.5;
    const flame = kit.cone(C.hot, 0.35, 1);
    flame.rotation.z = Math.PI / 2; flame.position.x = -L0 / 2 - 0.5;
    ship.add(body, nose, flame);
    ship.position.y = 1.2;
    const rest = kit.line('#94a3b8', [[-L0 / 2, 0.2, 0], [L0 / 2, 0.2, 0]], { dashed: true, width: 1.5 });
    void rest;
    kit.label('rest length', [0, -0.1, 0], { small: true });
    const measured = kit.line(C.acceleration, [], { width: 2.5 });
    const mLabel = kit.label('', [0, 2.6, 0], { color: C.acceleration, small: true });
    // two clocks
    const clock = (x: number, color: string) => {
      const g = kit.add(new THREE.Group());
      g.position.set(x, -1.8, 0);
      const face = kit.cylinder(0.7, 0.7, 0.1, '#0f172a');
      face.rotation.x = Math.PI / 2;
      const hand = kit.box(0.06, 0.6, 0.04, color);
      hand.position.set(0, 0.3, 0.08);
      const pivot = kit.add(new THREE.Group());
      pivot.position.z = 0.08;
      pivot.add(hand);
      g.add(face, pivot);
      return pivot;
    };
    const gHand = clock(-2, '#e2e8f0');
    const sHand = clock(2, C.acceleration);
    kit.label('ground clock', [-2, -2.8, 0], { small: true });
    kit.label('ship clock', [2, -2.8, 0], { small: true, color: C.acceleration });
    const stars = kit.segments('#e2e8f0', { width: 1, opacity: 0.5 });

    const g = () => lorentz(num(p, 'beta') * c).gamma;
    graphs.get('g').plot(0, 0, 0.999, (b) => lorentz(b * c).gamma, 300);

    return {
      setParams(np) { p = np; graphs.get('g').setMarkers([{ x: num(p, 'beta'), y: Math.min(10, g()), color: C.accent }]); },
      reset() { tg = 0; ts = 0; },
      step(dt) {
        tg += dt; ts += dt / g();
        graphs.get('clocks').push(tg, tg, ts);
      },
      render() {
        const gg = g();
        ship.scale.set(1 / gg, 1, 1);
        measured.setPoints([[-L0 / (2 * gg), 2.2, 0], [L0 / (2 * gg), 2.2, 0]]);
        mLabel.setText(`L = ${n(num(p, 'L') / gg)} m`);
        gHand.rotation.z = -(tg % 60) / 60 * Math.PI * 2;
        sHand.rotation.z = -(ts % 60) / 60 * Math.PI * 2;
        const f: number[] = [];
        for (let i = 0; i < 40; i++) {
          const x = ((i * 3.7 - tg * 6 * num(p, 'beta')) % 26 + 26) % 26 - 13;
          const y = ((i * 1.93) % 6) - 1, z = -3 - (i % 5);
          const len = 0.1 + num(p, 'beta') * 1.2;
          f.push(x, y, z, x + len, y, z);
        }
        stars.setSegments(f);
        graphs.get('g').setMarkers([{ x: num(p, 'beta'), y: Math.min(10, gg), color: C.accent }]);
      },
      time: () => tg,
      readouts(): Readout[] {
        const gg = g();
        const m0 = num(p, 'm0') * 1000;
        return [
          { label: 'Lorentz factor γ', value: gg, tone: 'accent' },
          { label: 'Speed', value: num(p, 'beta') * c, unit: 'm/s' },
          { label: 'Measured length L₀/γ', value: num(p, 'L') / gg, unit: 'm', tone: 'accent' },
          { label: '1 s on the ship lasts (ground)', value: gg, unit: 's' },
          { label: 'Relativistic mass γm₀', value: (gg * m0) / 1000, unit: 'tonnes' },
          { label: 'Kinetic energy (γ − 1)m₀c²', value: (gg - 1) * m0 * c * c, unit: 'J' },
          { label: 'Ship clock now', value: ts, unit: 's' },
        ];
      },
      equations(): Equation[] {
        const gg = g();
        return [
          { expr: 'γ = 1 / √(1 − v²/c²)', sub: `= 1 / √(1 − ${n(num(p, 'beta'))}²) = ${n(gg)}` },
          { expr: 'Time dilation: t = γ t₀' },
          { expr: 'Length contraction: L = L₀ / γ', sub: `= ${n(num(p, 'L'))} / ${n(gg)} = ${n(num(p, 'L') / gg)} m` },
          { expr: 'm = γ m₀ ,  E = γ m₀ c²' },
        ];
      },
    };
  },
};

export default sim;
