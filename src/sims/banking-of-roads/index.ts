import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num } from '../types';
import { rad } from '../../lib/num';
import { C } from '../../engine/colors';
import { cart, n } from '../shared';

const SC = 0.12; // scene units per metre of radius

function banking(v: number, r: number, th: number, mu: number, g: number, m: number) {
  const N = m * (g * Math.cos(th) + (v * v / r) * Math.sin(th));
  const f = m * ((v * v / r) * Math.cos(th) - g * Math.sin(th)); // + = down the slope (toward centre)
  const fmax = mu * N;
  const v0 = Math.sqrt(r * g * Math.tan(th));
  const vmaxDen = Math.cos(th) - mu * Math.sin(th);
  const vmax = vmaxDen > 0 ? Math.sqrt((r * g * (Math.sin(th) + mu * Math.cos(th))) / vmaxDen) : Infinity;
  const vminSq = (r * g * (Math.sin(th) - mu * Math.cos(th))) / (Math.cos(th) + mu * Math.sin(th));
  const vmin = vminSq > 0 ? Math.sqrt(vminSq) : 0;
  const state = Math.abs(f) <= fmax + 1e-9 ? 'safe' : f > 0 ? 'out' : 'in';
  return { N, f, fmax, v0, vmax, vmin, state };
}

const sim: SimDefinition = {
  camera: { position: [0, 9, 13], target: [0, 0.5, 0], aspect: 1.4 },
  hint: 'At the design speed v₀ no friction is needed — the horizontal part of N alone provides the centripetal force.',
  params: [
    { kind: 'slider', key: 'theta', label: 'Banking angle θ', unit: '°', min: 0, max: 45, step: 0.5, default: 15 },
    { kind: 'slider', key: 'r', label: 'Radius of the curve', unit: 'm', min: 20, max: 60, step: 1, default: 50 },
    { kind: 'slider', key: 'v', label: 'Car speed', unit: 'm/s', min: 1, max: 40, step: 0.5, default: 11.5 },
    { kind: 'slider', key: 'mu', label: 'Tyre friction μ', min: 0, max: 1, step: 0.01, default: 0.3 },
    { kind: 'slider', key: 'm', label: 'Car mass', unit: 'kg', min: 500, max: 3000, step: 50, default: 1200 },
  ],
  presets: [
    { label: 'Design speed', values: { theta: 15, r: 50, v: 11.46, mu: 0.3 } },
    { label: 'Too fast', values: { theta: 15, r: 50, v: 30, mu: 0.3 } },
    { label: 'Icy, too slow', values: { theta: 30, r: 40, v: 5, mu: 0.05 } },
    { label: 'Flat road', values: { theta: 0, r: 50, v: 12, mu: 0.3 } },
  ],
  graphs: [
    { id: 'f', title: 'Friction needed vs speed', x: 'v (m/s)', y: 'f (N)', kind: 'curve', xRange: [0, 40], series: [{ label: 'friction needed (+ inward)', color: C.friction }, { label: '+μN limit', color: '#94a3b8', dashed: true }, { label: '−μN limit', color: '#94a3b8', dashed: true }] },
  ],
  learn: {
    concept: 'A car turning a curve needs a centripetal force mv²/r. On a banked road the normal reaction tilts toward the centre, so part of it supplies this force. At the design speed v₀ = √(rg tan θ) no friction is needed; faster cars need friction down the slope, slower cars need friction up the slope.',
    variables: [['θ', 'banking angle'], ['r', 'radius of the curve (m)'], ['v₀', 'ideal speed √(rg tan θ)'], ['μ', 'coefficient of friction'], ['N', 'normal reaction (N)']],
    observe: [
      'At v₀ the friction arrow disappears.',
      'Above v_max the car skids outward; on a steep icy bank a slow car slides inward.',
      'The design speed does not depend on the car’s mass.',
    ],
    challenge: 'Design a curve of radius 60 m so that 20 m/s needs no friction. What banking angle do you need?',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0, phi = 0, drift = 0;
    const track = kit.add(new THREE.Group());
    const car = cart(kit, C.bodyAlt, 0.9, 0.35, 0.55);
    const Narrow = kit.arrow(C.normal, { label: 'N', radius: 0.04 });
    const Warrow = kit.arrow(C.weight, { label: 'mg', radius: 0.04 });
    const Farrow = kit.arrow(C.friction, { label: 'f', radius: 0.04 });
    const Carrow = kit.arrow(C.force, { label: 'needed: mv²/r', radius: 0.03, opacity: 0.8 });
    const status = kit.label('', [0, 3.5, 0]);

    const phys = () => banking(num(p, 'v'), num(p, 'r'), rad(num(p, 'theta')), num(p, 'mu'), 9.81, num(p, 'm'));

    function buildTrack() {
      kit.clearGroup(track);
      const R = num(p, 'r') * SC, th = rad(num(p, 'theta')), w = 2;
      const seg = 96;
      const pos: number[] = [], idx: number[] = [];
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        const inner = R - w / 2, outer = R + w / 2;
        pos.push(inner * Math.cos(a), -(w / 2) * Math.tan(th), inner * Math.sin(a), outer * Math.cos(a), (w / 2) * Math.tan(th), outer * Math.sin(a));
        if (i < seg) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      track.add(new THREE.Mesh(g, kit.mat('#475569', { side: THREE.DoubleSide, roughness: 0.9 })));
      track.position.y = (w / 2) * Math.tan(th) + 0.3;
      curve();
    }
    function curve() {
      const th = rad(num(p, 'theta')), r = num(p, 'r'), mu = num(p, 'mu'), m = num(p, 'm');
      const G = graphs.get('f');
      G.plot(0, 0, 40, (v) => banking(v, r, th, mu, 9.81, m).f, 120);
      G.plot(1, 0, 40, (v) => banking(v, r, th, mu, 9.81, m).fmax, 60);
      G.plot(2, 0, 40, (v) => -banking(v, r, th, mu, 9.81, m).fmax, 60);
      G.setMarkers([{ x: num(p, 'v'), y: phys().f, color: C.friction }]);
      G.setVLines([{ x: phys().v0, label: 'v₀' }]);
    }
    buildTrack();

    return {
      setParams(np) { const rebuild = np.theta !== p.theta || np.r !== p.r; p = np; if (rebuild) buildTrack(); else curve(); drift = 0; },
      reset() { t = 0; phi = 0; drift = 0; },
      step(dt) {
        t += dt;
        const R = num(p, 'r') + drift;
        phi += (num(p, 'v') / R) * dt;
        const s = phys().state;
        if (s === 'out') drift = Math.min(drift + 4 * dt, 8);
        else if (s === 'in') drift = Math.max(drift - 4 * dt, -8);
      },
      render() {
        const th = rad(num(p, 'theta'));
        const R = (num(p, 'r') + drift) * SC;
        const off = drift * SC;
        const y = track.position.y + off * Math.tan(th);
        const pos = new THREE.Vector3(R * Math.cos(phi), y, -R * Math.sin(phi));
        car.group.position.copy(pos);
        const inward = new THREE.Vector3(-Math.cos(phi), 0, Math.sin(phi));
        // face along the direction of travel, then lean into the bank
        car.group.rotation.set(0, phi + Math.PI / 2, 0);
        car.group.rotateOnWorldAxis(new THREE.Vector3(-Math.sin(phi), 0, -Math.cos(phi)), -th);
        const r = phys();
        const up = new THREE.Vector3(0, 1, 0);
        const nrm = up.clone().multiplyScalar(Math.cos(th)).addScaledVector(inward, Math.sin(th));
        const downSlope = inward.clone().multiplyScalar(Math.cos(th)).addScaledVector(up, -Math.sin(th));
        const W = num(p, 'm') * 9.81, sc = 1.6 / W;
        const c = pos.clone().add(new THREE.Vector3(0, 0.3, 0));
        Narrow.set(c, nrm.clone().multiplyScalar(r.N * sc), `N = ${n(r.N)} N`);
        Warrow.set(c, [0, -W * sc, 0], `mg = ${n(W)} N`);
        const fAct = Math.max(-r.fmax, Math.min(r.fmax, r.f));
        Farrow.set(pos.clone().add(new THREE.Vector3(0, 0.05, 0)), downSlope.clone().multiplyScalar(fAct * sc), `f = ${n(Math.abs(fAct))} N`);
        Farrow.visible = Math.abs(fAct) > W * 0.005;
        Carrow.set(c.clone().add(new THREE.Vector3(0, 0.6, 0)), inward.clone().multiplyScalar(((num(p, 'm') * num(p, 'v') ** 2) / num(p, 'r')) * sc), '');
        status.at([0, 3.2, 0]).setText(r.state === 'safe' ? 'Holding the curve' : r.state === 'out' ? 'Skidding outward — too fast' : 'Sliding inward — too slow');
        status.setColor(r.state === 'safe' ? C.normal : C.friction);
      },
      time: () => t,
      readouts(): Readout[] {
        const r = phys();
        return [
          { label: 'Design speed v₀ = √(rg tan θ)', value: r.v0, unit: 'm/s', tone: 'accent' },
          { label: 'Maximum safe speed', value: Number.isFinite(r.vmax) ? r.vmax : 'no limit', unit: Number.isFinite(r.vmax) ? 'm/s' : undefined },
          { label: 'Minimum speed', value: r.vmin, unit: 'm/s' },
          { label: 'Normal reaction N', value: r.N, unit: 'N' },
          { label: 'Friction needed (+ inward)', value: r.f, unit: 'N' },
          { label: 'Friction available μN', value: r.fmax, unit: 'N' },
          { label: 'Result', value: r.state === 'safe' ? 'Safe' : r.state === 'out' ? 'Skids outward' : 'Slides inward', tone: r.state === 'safe' ? 'good' : 'bad' },
        ];
      },
      equations(): Equation[] {
        const r = phys();
        return [
          { expr: 'tan θ = v₀² / r g', sub: `v₀ = √(${n(num(p, 'r'))} × 9.81 × tan ${num(p, 'theta')}°) = ${n(r.v0)} m/s` },
          { expr: 'N sin θ + f cos θ = m v² / r' },
          { expr: 'N cos θ − f sin θ = m g' },
          { expr: 'v_max = √[ r g (sin θ + μ cos θ) / (cos θ − μ sin θ) ]', sub: Number.isFinite(r.vmax) ? `= ${n(r.vmax)} m/s` : 'no upper limit (μ ≥ cot θ)' },
        ];
      },
    };
  },
};

export default sim;
