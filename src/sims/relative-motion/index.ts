import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { rad, deg } from '../../lib/num';
import { C } from '../../engine/colors';
import { cart, n, sampler } from '../shared';

const sim: SimDefinition = {
  camera: { position: [0, 9, 12], target: [0, 0, 0], aspect: 1.5 },
  hint: 'Switch the frame of reference: the same motion looks different to each observer.',
  params: [
    { kind: 'select', key: 'scenario', label: 'Scenario', default: 'cars', options: [{ value: 'cars', label: 'Two cars on a road' }, { value: 'river', label: 'Boat crossing a river' }] },
    { kind: 'slider', key: 'vA', label: 'Velocity of car A', unit: 'm/s', min: -15, max: 15, step: 0.5, default: 10, showIf: (p) => p.scenario === 'cars' },
    { kind: 'slider', key: 'vB', label: 'Velocity of car B', unit: 'm/s', min: -15, max: 15, step: 0.5, default: 6, showIf: (p) => p.scenario === 'cars' },
    { kind: 'select', key: 'frame', label: 'Frame of reference', default: 'ground', options: [{ value: 'ground', label: 'Ground' }, { value: 'A', label: 'Car A' }, { value: 'B', label: 'Car B' }], showIf: (p) => p.scenario === 'cars' },
    { kind: 'slider', key: 'vb', label: 'Boat speed in still water', unit: 'm/s', min: 0.5, max: 6, step: 0.1, default: 3, showIf: (p) => p.scenario === 'river' },
    { kind: 'slider', key: 'vr', label: 'River current', unit: 'm/s', min: 0, max: 5, step: 0.1, default: 1.5, showIf: (p) => p.scenario === 'river' },
    { kind: 'slider', key: 'head', label: 'Heading (0° = straight across, + upstream)', unit: '°', min: -60, max: 80, step: 1, default: 0, showIf: (p) => p.scenario === 'river' },
    { kind: 'slider', key: 'W', label: 'River width', unit: 'm', min: 20, max: 200, step: 5, default: 60, showIf: (p) => p.scenario === 'river' },
  ],
  presets: [
    { label: 'Overtaking', values: { scenario: 'cars', vA: 12, vB: 8, frame: 'B' } },
    { label: 'Head-on', values: { scenario: 'cars', vA: 10, vB: -10, frame: 'A' } },
    { label: 'Same speed', values: { scenario: 'cars', vA: 8, vB: 8, frame: 'A' } },
    { label: 'Shortest time', values: { scenario: 'river', head: 0 } },
    { label: 'Shortest path', values: { scenario: 'river', vb: 3, vr: 1.5, head: 30 } },
  ],
  graphs: [
    { id: 'x', title: 'Position vs time (in the chosen frame)', x: 't (s)', y: 'x (m)', zeroY: true, series: [{ label: 'A', color: C.force }, { label: 'B', color: C.acceleration }] },
  ],
  learn: {
    concept: 'Velocity is always measured relative to something. The velocity of A relative to B is v_AB = v_A − v_B. For a boat on a river, the velocity relative to the ground is the vector sum of the boat’s velocity relative to the water and the water’s velocity relative to the ground.',
    variables: [['v_A, v_B', 'velocities relative to the ground'], ['v_AB', 'velocity of A relative to B'], ['v_b', 'boat velocity relative to water'], ['v_r', 'river current'], ['θ', 'heading angle']],
    observe: [
      'Two cars at the same velocity look stationary to each other.',
      'In the frame of car A, car A never moves — the road slides backwards.',
      'Heading straight across gives the quickest crossing but the boat drifts downstream.',
      'Heading upstream at sin θ = v_r/v_b makes the boat land directly opposite.',
    ],
    challenge: 'With v_b = 4 m/s and a 2 m/s current, find the heading that lands the boat straight across. How long does that crossing take for a 60 m river?',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0, xA = -6, xB = -3, bx = 0, by = 0, finished = false;
    const sample = sampler(1 / 20);

    // Cars scene
    const carsG = kit.add(new THREE.Group());
    const road = kit.box(400, 0.2, 5, '#334155');
    road.position.y = -0.1;
    const lane = kit.segments('#e2e8f0', { width: 2, opacity: 0.6 });
    const roadTicks: number[] = [];
    for (let i = -200; i <= 200; i += 4) roadTicks.push(i, 0.01, 0, i + 2, 0.01, 0);
    lane.setSegments(roadTicks);
    const carA = cart(kit, C.force);
    const carB = cart(kit, C.acceleration);
    const arA = kit.arrow(C.velocity, { label: 'v_A' });
    const arB = kit.arrow(C.velocity, { label: 'v_B' });
    const arRel = kit.arrow(C.resultant, { label: 'v_AB' });
    const road2 = kit.add(new THREE.Group());
    road2.add(road, lane);
    [road2, carA.group, carB.group, arA, arB, arRel].forEach((o) => carsG.add(o));

    // River scene
    const riverG = kit.add(new THREE.Group());
    const water = kit.box(40, 0.1, 1, '#1d4ed8', { opacity: 0.55 });
    const bank1 = kit.box(40, 0.4, 2, '#3f6212');
    const bank2 = kit.box(40, 0.4, 2, '#3f6212');
    const boat = kit.box(0.5, 0.35, 1.1, '#f8fafc');
    const path = kit.trail(C.weight, 800, { width: 2.5 });
    const aw = kit.arrow(C.velocity, { label: 'v_boat/water' });
    const ar = kit.arrow('#60a5fa', { label: 'v_river' });
    const ag = kit.arrow(C.resultant, { label: 'v_ground' });
    const flow = kit.segments('#93c5fd', { width: 1.2, opacity: 0.6 });
    [water, bank1, bank2, boat, path, aw, ar, ag, flow].forEach((o) => riverG.add(o));

    const cars = () => str(p, 'scenario') !== 'river';
    const frameV = () => (str(p, 'frame') === 'A' ? num(p, 'vA') : str(p, 'frame') === 'B' ? num(p, 'vB') : 0);
    const S = () => 8 / num(p, 'W'); // river scene units per metre
    const boatVel = () => {
      const th = rad(num(p, 'head'));
      const vb = num(p, 'vb'), vr = num(p, 'vr');
      // x = downstream (+), z = across (−z toward far bank)
      return { vx: vr - vb * Math.sin(th), vz: vb * Math.cos(th) };
    };

    function reset() {
      t = 0; xA = -6; xB = -3; bx = 0; by = 0; finished = false; sample.reset();
      path.clearPoints();
      carsG.visible = cars();
      riverG.visible = !cars();
      const Wsc = 8;
      water.scale.z = Wsc; water.position.set(0, -0.05, -Wsc / 2);
      bank1.position.set(0, 0.1, 1);
      bank2.position.set(0, 0.1, -Wsc - 1);
      const f: number[] = [];
      for (let i = 0; i < 40; i++) { const x = -18 + (i % 10) * 4, z = -0.6 - Math.floor(i / 10) * 2; f.push(x, 0.02, z, x + 1, 0.02, z); }
      flow.setSegments(f);
      kit.followX(0, 1);
    }
    reset();

    return {
      setParams(np) { p = np; graphs.clearLive(); reset(); },
      reset,
      step(dt) {
        if (finished) return;
        t += dt;
        if (cars()) {
          xA += num(p, 'vA') * dt; xB += num(p, 'vB') * dt;
          if (t > 12) finished = true;
          if (sample.due(t)) { const fx = frameV() * t; graphs.get('x').push(t, xA - fx, xB - fx); }
        } else {
          const v = boatVel();
          if (v.vz <= 0) { finished = true; return; }
          bx += v.vx * dt; by += v.vz * dt;
          path.push([bx * S(), 0.15, -by * S()]);
          if (by >= num(p, 'W')) { by = num(p, 'W'); finished = true; }
          if (sample.due(t)) graphs.get('x').push(t, bx, by);
        }
      },
      render() {
        if (cars()) {
          const off = frameV() * t;
          // In a moving frame, the whole world shifts backwards.
          road2.position.x = -(off % 8);
          carA.group.position.set(xA - off, 0, 1.2);
          carB.group.position.set(xB - off, 0, -1.2);
          const vf = frameV();
          arA.set([xA - off, 1.4, 1.2], [(num(p, 'vA') - vf) * 0.25, 0, 0], `v_A = ${n(num(p, 'vA') - vf)} m/s`);
          arB.set([xB - off, 1.4, -1.2], [(num(p, 'vB') - vf) * 0.25, 0, 0], `v_B = ${n(num(p, 'vB') - vf)} m/s`);
          arRel.set([xA - off, 2.3, 1.2], [(num(p, 'vA') - num(p, 'vB')) * 0.25, 0, 0], `v_AB = ${n(num(p, 'vA') - num(p, 'vB'))} m/s`);
          const mid = (xA + xB) / 2 - off;
          kit.followX(str(p, 'frame') === 'ground' ? mid : 0, str(p, 'frame') === 'ground' ? 0.1 : 1);
        } else {
          const v = boatVel();
          const P = new THREE.Vector3(bx * S(), 0.2, -by * S());
          boat.position.copy(P);
          boat.rotation.y = rad(num(p, 'head'));
          path.flush();
          const s = 0.6;
          aw.set(P.clone().add(new THREE.Vector3(0, 0.3, 0)), [-num(p, 'vb') * Math.sin(rad(num(p, 'head'))) * s, 0, -num(p, 'vb') * Math.cos(rad(num(p, 'head'))) * s]);
          ar.set(P.clone().add(new THREE.Vector3(0, 0.35, 0)), [num(p, 'vr') * s, 0, 0]);
          ag.set(P.clone().add(new THREE.Vector3(0, 0.4, 0)), [v.vx * s, 0, -v.vz * s]);
          kit.followX(0, 1);
        }
      },
      done: () => finished,
      time: () => t,
      readouts(): Readout[] {
        if (cars()) {
          const vA = num(p, 'vA'), vB = num(p, 'vB');
          return [
            { label: 'v_A (ground)', value: vA, unit: 'm/s' },
            { label: 'v_B (ground)', value: vB, unit: 'm/s' },
            { label: 'Velocity of A relative to B', value: vA - vB, unit: 'm/s', tone: 'accent' },
            { label: 'Velocity of B relative to A', value: vB - vA, unit: 'm/s', tone: 'accent' },
            { label: 'Separation x_A − x_B', value: xA - xB, unit: 'm' },
          ];
        }
        const v = boatVel();
        const W = num(p, 'W');
        const tc = v.vz > 0 ? W / v.vz : 0;
        return v.vz > 0 ? [
          { label: 'Speed over ground', value: Math.hypot(v.vx, v.vz), unit: 'm/s', tone: 'accent' },
          { label: 'Crossing time', value: tc, unit: 's', tone: 'accent' },
          { label: 'Downstream drift', value: v.vx * tc, unit: 'm' },
          { label: 'Angle of path to bank normal', value: deg(Math.atan2(v.vx, v.vz)), unit: '°' },
          { label: 'Heading for zero drift', value: num(p, 'vr') < num(p, 'vb') ? deg(Math.asin(num(p, 'vr') / num(p, 'vb'))) : 'impossible (current ≥ boat speed)', unit: num(p, 'vr') < num(p, 'vb') ? '°' : undefined },
        ] : [{ label: 'Status', value: 'The boat cannot make progress across at this heading', tone: 'bad' }];
      },
      equations(): Equation[] {
        if (cars()) {
          return [
            { expr: 'v_AB = v_A − v_B', sub: `v_AB = ${n(num(p, 'vA'))} − (${n(num(p, 'vB'))}) = ${n(num(p, 'vA') - num(p, 'vB'))} m/s` },
            { expr: 'x_A(frame) = x_A − v_frame t', note: 'Changing frame subtracts the frame’s velocity from every body.' },
          ];
        }
        const v = boatVel();
        return [
          { expr: 'v_ground = v_boat/water + v_river  (vector sum)', sub: `|v| = ${n(Math.hypot(v.vx, v.vz))} m/s` },
          { expr: 't = W / (v_b cos θ)', sub: v.vz > 0 ? `t = ${n(num(p, 'W'))} / ${n(v.vz)} = ${n(num(p, 'W') / v.vz)} s` : '—' },
          { expr: 'Zero drift: sin θ = v_r / v_b' },
        ];
      },
    };
  },
};

export default sim;
