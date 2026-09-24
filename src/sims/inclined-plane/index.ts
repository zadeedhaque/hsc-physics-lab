import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { bool, num } from '../types';
import { incline } from '../../physics/dynamics';
import { rad, deg } from '../../lib/num';
import { C } from '../../engine/colors';
import { n, sampler } from '../shared';

const LEN = 8; // ramp length in scene units (= metres)

const sim: SimDefinition = {
  camera: { position: [0.5, 3.2, 12], target: [0.5, 1.8, 0], aspect: 1.6 },
  hint: 'The weight is split into mg sinθ (down the slope) and mg cosθ (into the slope). The block slides once tan θ > μs.',
  params: [
    { kind: 'slider', key: 'angle', label: 'Angle of incline θ', unit: '°', min: 0, max: 60, step: 0.5, default: 30 },
    { kind: 'slider', key: 'm', label: 'Mass', unit: 'kg', min: 0.5, max: 20, step: 0.5, default: 5 },
    { kind: 'slider', key: 'muS', label: 'Static friction μs', min: 0, max: 1, step: 0.01, default: 0.4 },
    { kind: 'slider', key: 'muK', label: 'Kinetic friction μk', min: 0, max: 1, step: 0.01, default: 0.25 },
    { kind: 'slider', key: 'g', label: 'Gravity', unit: 'm/s²', min: 1, max: 25, step: 0.01, default: 9.81 },
    { kind: 'toggle', key: 'comp', label: 'Show weight components', default: true },
  ],
  presets: [
    { label: 'Frictionless 30°', values: { angle: 30, muS: 0, muK: 0 } },
    { label: 'Just holding', values: { angle: 21, muS: 0.4, muK: 0.25 } },
    { label: 'Sliding', values: { angle: 35, muS: 0.4, muK: 0.25 } },
    { label: 'Steep & icy', values: { angle: 50, muS: 0.05, muK: 0.03 } },
  ],
  graphs: [
    { id: 'aTheta', title: 'Acceleration vs angle', x: 'θ (°)', y: 'a (m/s²)', kind: 'curve', xRange: [0, 60], zeroY: true, series: [{ label: 'a(θ)', color: C.acceleration }, { label: 'g sin θ (no friction)', color: '#94a3b8', dashed: true }] },
    { id: 'v', title: 'Speed down the slope vs time', x: 't (s)', y: 'v (m/s)', zeroY: true, series: [{ label: 'v', color: C.velocity }] },
  ],
  learn: {
    concept: 'On an incline the weight mg is resolved into mg sin θ along the slope and mg cos θ perpendicular to it. The normal reaction balances mg cos θ, so N = mg cos θ, and friction is at most μN. The block slides when mg sin θ exceeds μs mg cos θ, i.e. when tan θ > μs.',
    variables: [['θ', 'angle of the incline'], ['N', 'normal reaction = mg cos θ'], ['f', 'friction (≤ μsN at rest, μkN when sliding)'], ['a', 'acceleration down the slope'], ['θ_r', 'angle of repose: tan θ_r = μs']],
    observe: [
      'Below the angle of repose the block stays still — friction exactly balances mg sin θ.',
      'Without friction, a = g sin θ and does not depend on the mass.',
      'The kink in the a–θ graph marks where the block starts to slide.',
    ],
    challenge: 'Find the angle of repose when μs = 0.5 (tan⁻¹ 0.5). Then set that angle and nudge it by 0.5° either side.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let s = 0, v = 0, t = 0, finished = false;
    const sample = sampler(1 / 20);
    kit.box(14, 0.2, 4, '#1e293b').position.set(0.5, -0.1, 0);
    const ramp = kit.add(new THREE.Group());
    const rampMesh = new THREE.Mesh(new THREE.BufferGeometry(), kit.mat('#475569', { roughness: 0.9 }));
    ramp.add(rampMesh);
    const block = kit.box(0.9, 0.6, 0.9, C.bodyAlt);
    const W = kit.arrow(C.weight, { label: 'W', radius: 0.045 });
    const Wp = kit.arrow(C.weight, { label: 'mg sinθ', radius: 0.03, opacity: 0.7 });
    const Wn = kit.arrow(C.weight, { label: 'mg cosθ', radius: 0.03, opacity: 0.7 });
    const N = kit.arrow(C.normal, { label: 'N', radius: 0.045 });
    const f = kit.arrow(C.friction, { label: 'f', radius: 0.045 });
    const angleLabel = kit.label('', [0, 0, 0], { small: true });

    const phys = () => incline({ m: num(p, 'm'), angle: rad(num(p, 'angle')), muS: num(p, 'muS'), muK: num(p, 'muK'), g: num(p, 'g'), v });
    const x0 = -3.5;

    function buildRamp() {
      const th = rad(num(p, 'angle'));
      const baseX = x0 + LEN * Math.cos(th), top = LEN * Math.sin(th);
      const d = 1.6;
      const v3 = [x0, 0, d, baseX, 0, d, x0, top, d, x0, 0, -d, baseX, 0, -d, x0, top, -d];
      const idx = [0, 1, 2, 3, 5, 4, 0, 3, 4, 0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 3, 2, 3, 0];
      rampMesh.geometry.dispose();
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(v3, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      rampMesh.geometry = g;
      angleLabel.at([baseX - 1.3, 0.3, d]).setText(`θ = ${num(p, 'angle')}°`);
      const G = graphs.get('aTheta');
      G.plot(0, 0, 60, (dg) => incline({ m: num(p, 'm'), angle: rad(dg), muS: num(p, 'muS'), muK: num(p, 'muK'), g: num(p, 'g'), v: 0 }).a, 240);
      G.plot(1, 0, 60, (dg) => num(p, 'g') * Math.sin(rad(dg)), 60);
      G.setMarkers([{ x: num(p, 'angle'), y: phys().a, color: C.acceleration }]);
      G.setVLines(num(p, 'muS') > 0 ? [{ x: deg(Math.atan(num(p, 'muS'))), label: 'repose' }] : []);
    }

    const reset = () => { s = 0; v = 0; t = 0; finished = false; sample.reset(); buildRamp(); };
    reset();

    return {
      setParams(np) { p = np; graphs.clearLive(); reset(); },
      reset,
      step(dt) {
        if (finished) return;
        const r = phys();
        const vNew = v + r.a * dt;
        v = v > 0 && vNew < 0 ? 0 : Math.max(0, vNew);
        s += v * dt;
        t += dt;
        if (s >= LEN - 0.6) { s = LEN - 0.6; finished = true; }
        if (t > 15) finished = true;
        if (sample.due(t) || finished) graphs.get('v').push(t, v);
      },
      render() {
        const th = rad(num(p, 'angle'));
        const top = new THREE.Vector3(x0, LEN * Math.sin(th), 0);
        const down = new THREE.Vector3(Math.cos(th), -Math.sin(th), 0);
        const normal = new THREE.Vector3(Math.sin(th), Math.cos(th), 0);
        const c = top.clone().addScaledVector(down, 0.6 + s).addScaledVector(normal, 0.3);
        block.position.copy(c);
        block.rotation.z = -th;
        const r = phys();
        const sc = 2.2 / Math.max(r.W, 1);
        W.set(c, [0, -r.W * sc, 0], `W = ${n(r.W)} N`);
        const comps = bool(p, 'comp');
        Wp.visible = Wn.visible = comps;
        if (comps) {
          Wp.set(c, down.clone().multiplyScalar(r.para * sc), `mg sinθ = ${n(r.para)} N`);
          Wn.set(c, normal.clone().multiplyScalar(-r.N * sc), `mg cosθ = ${n(r.N)} N`);
        }
        N.set(c.clone().addScaledVector(normal, 0.3), normal.clone().multiplyScalar(r.N * sc), `N = ${n(r.N)} N`);
        f.set(c.clone().addScaledVector(normal, -0.3).addScaledVector(down, -0.45), down.clone().multiplyScalar(r.friction * sc), `f = ${n(Math.abs(r.friction))} N`);
        f.visible = Math.abs(r.friction) > 1e-6;
      },
      done: () => finished,
      time: () => t,
      readouts(): Readout[] {
        const r = phys();
        return [
          { label: 'Weight W = mg', value: r.W, unit: 'N' },
          { label: 'Component along slope', value: r.para, unit: 'N' },
          { label: 'Normal reaction N', value: r.N, unit: 'N' },
          { label: 'Friction', value: Math.abs(r.friction), unit: 'N' },
          { label: 'State', value: r.sliding ? 'Sliding' : 'At rest (static friction holds)' },
          { label: 'Acceleration', value: r.a, unit: 'm/s²', tone: 'accent' },
          { label: 'Angle of repose', value: deg(Math.atan(num(p, 'muS'))), unit: '°' },
          { label: 'Speed', value: v, unit: 'm/s' },
        ];
      },
      equations(): Equation[] {
        const r = phys();
        const th = num(p, 'angle');
        return [
          { expr: 'N = m g cos θ', sub: `= ${n(num(p, 'm'))} × ${n(num(p, 'g'))} × cos ${th}° = ${n(r.N)} N` },
          { expr: 'Slides if tan θ > μs', sub: `tan ${th}° = ${n(Math.tan(rad(th)))} vs μs = ${n(num(p, 'muS'))}` },
          { expr: 'a = g (sin θ − μk cos θ)', sub: r.sliding ? `a = ${n(r.a)} m/s²` : 'at rest → a = 0' },
          { expr: 'Frictionless: a = g sin θ', sub: `= ${n(num(p, 'g') * Math.sin(rad(th)))} m/s²` },
        ];
      },
    };
  },
};

export default sim;
