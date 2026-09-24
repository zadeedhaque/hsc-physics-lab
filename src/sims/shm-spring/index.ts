import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { bool, num } from '../types';
import { springSHM } from '../../physics/shm';
import { rad } from '../../lib/num';
import { springPoints } from '../../engine/kit';
import { C } from '../../engine/colors';
import { Bar3D, n, sampler } from '../shared';

const SERIES_KE = '#34d399';
const SERIES_PE = '#fbbf24';
const S = 8; // scene units per metre (amplitudes are ≤ 0.3 m)
const EQ = 1.6; // equilibrium position of the block (scene x)

const sim: SimDefinition = {
  camera: { position: [0.6, 3, 9], target: [0.6, 0.9, 0], aspect: 1.6 },
  hint: 'The reference circle (right) turns at ω: its shadow on the x-axis is exactly the block’s motion.',
  params: [
    { kind: 'slider', key: 'm', label: 'Mass', unit: 'kg', min: 0.1, max: 5, step: 0.05, default: 1 },
    { kind: 'slider', key: 'k', label: 'Spring constant', unit: 'N/m', min: 5, max: 200, step: 1, default: 40 },
    { kind: 'slider', key: 'A', label: 'Amplitude', unit: 'm', min: 0.02, max: 0.3, step: 0.01, default: 0.2 },
    { kind: 'slider', key: 'phi', label: 'Initial phase φ', unit: '°', min: 0, max: 360, step: 5, default: 0 },
    { kind: 'slider', key: 'b', label: 'Damping constant b', unit: 'kg/s', min: 0, max: 3, step: 0.05, default: 0, hint: '0 = ideal SHM' },
    { kind: 'toggle', key: 'circle', label: 'Show reference circle', default: true },
    { kind: 'toggle', key: 'bars', label: 'Show energy bars', default: true },
  ],
  presets: [
    { label: 'Standard', values: { m: 1, k: 40, A: 0.2, phi: 0, b: 0 } },
    { label: 'Heavy & slow', values: { m: 4, k: 20, A: 0.2, phi: 0, b: 0 } },
    { label: 'Stiff & fast', values: { m: 0.5, k: 180, A: 0.15, phi: 0, b: 0 } },
    { label: 'Start at centre', values: { phi: 90, b: 0 } },
    { label: 'Damped', values: { m: 1, k: 40, A: 0.25, phi: 0, b: 0.6 } },
  ],
  graphs: [
    { id: 'xva', title: 'x, v, a vs time', x: 't (s)', y: 'normalised', window: 8, yRange: [-1.15, 1.15], series: [{ label: 'x / A', color: C.x }, { label: 'v / Aω', color: C.velocity }, { label: 'a / Aω²', color: C.acceleration }] },
    { id: 'E', title: 'Energy vs time', x: 't (s)', y: 'J', window: 8, zeroY: true, series: [{ label: 'KE', color: SERIES_KE }, { label: 'PE', color: SERIES_PE }, { label: 'Total', color: '#e2e8f0' }] },
  ],
  learn: {
    concept: 'Simple harmonic motion happens when the restoring force is proportional to displacement and opposite to it: F = −kx. The motion is sinusoidal with angular frequency ω = √(k/m), independent of the amplitude.',
    variables: [['x', 'displacement from equilibrium (m)'], ['A', 'amplitude (m)'], ['ω', 'angular frequency (rad/s)'], ['φ', 'initial phase'], ['T', 'period (s)'], ['k', 'spring constant (N/m)']],
    observe: [
      'Velocity is greatest at the centre; acceleration is greatest at the ends.',
      'v leads x by 90° and a is always opposite to x (180°).',
      'Changing the amplitude does not change the period.',
      'KE and PE swap back and forth twice per cycle while the total stays constant (without damping).',
    ],
    challenge: 'Choose m and k so the period is exactly 1.0 s. Hint: T = 2π√(m/k).',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0;
    const sample = sampler(1 / 40);

    const floor = kit.box(9, 0.2, 2.2, '#334155', { roughness: 0.95 });
    floor.position.set(0, -0.1, 0);
    const wall = kit.box(0.3, 2.2, 2.2, '#475569');
    wall.position.set(-2.3, 1.0, 0);
    const spring = kit.line('#cbd5e1', [], { width: 2.5 });
    const block = kit.box(0.8, 0.8, 0.8, C.bodyAlt);
    const eqLine = kit.line('#94a3b8', [[EQ, 0.01, -1], [EQ, 0.01, 1]], { dashed: true, width: 1.5 });
    kit.label('x = 0', [EQ, 0, 1.3], { small: true });
    const ampL = kit.line(C.x, [], { dashed: true, width: 1.2, opacity: 0.6 });
    const ampR = kit.line(C.x, [], { dashed: true, width: 1.2, opacity: 0.6 });
    const vArrow = kit.arrow(C.velocity, { label: 'v' });
    const aArrow = kit.arrow(C.acceleration, { label: 'a' });
    const fArrow = kit.arrow(C.force, { label: 'F = −kx' });
    void eqLine;

    // Reference circle
    const circleG = kit.add(new THREE.Group());
    circleG.position.set(EQ, 3.1, 0);
    const ring = kit.line('#64748b', [], { width: 1.5 });
    circleG.add(ring);
    const dot = kit.sphere(0.09, C.x);
    circleG.add(dot);
    const radius = kit.line(C.x, [], { width: 1.5 });
    circleG.add(radius);
    const drop = kit.line(C.x, [], { dashed: true, width: 1, opacity: 0.5 });

    const bars = kit.add(new THREE.Group());
    bars.position.set(4.1, 0, 0);
    const keBar = new Bar3D(kit, SERIES_KE, 'KE', 2.4, 0.35); keBar.position.x = 0;
    const peBar = new Bar3D(kit, SERIES_PE, 'PE', 2.4, 0.35); peBar.position.x = 0.55;
    const eBar = new Bar3D(kit, '#e2e8f0', 'E', 2.4, 0.35); eBar.position.x = 1.1;
    bars.add(keBar, peBar, eBar);

    const omega0 = () => springSHM(num(p, 'm'), num(p, 'k')).omega;
    const gamma = () => num(p, 'b') / (2 * num(p, 'm'));
    const omegaD = () => Math.sqrt(Math.max(omega0() ** 2 - gamma() ** 2, 0));

    /** Exact solution of m x'' + b x' + k x = 0 for all damping regimes. */
    function state(time: number) {
      const A = num(p, 'A'), phi = rad(num(p, 'phi'));
      const g = gamma(), w0 = omega0();
      let x: number, v: number;
      if (g < w0 - 1e-9) {
        const w = omegaD();
        const env = Math.exp(-g * time);
        const th = w * time + phi;
        x = A * env * Math.cos(th);
        v = A * env * (-g * Math.cos(th) - w * Math.sin(th));
      } else {
        const x0 = A * Math.cos(phi), v0 = -A * w0 * Math.sin(phi);
        if (Math.abs(g - w0) <= 1e-9) {
          const e = Math.exp(-g * time);
          const c = v0 + g * x0;
          x = (x0 + c * time) * e;
          v = (c - g * (x0 + c * time)) * e;
        } else {
          const d = Math.sqrt(g * g - w0 * w0);
          const r1 = -g + d, r2 = -g - d;
          const c1 = (v0 - r2 * x0) / (r1 - r2), c2 = x0 - c1;
          x = c1 * Math.exp(r1 * time) + c2 * Math.exp(r2 * time);
          v = c1 * r1 * Math.exp(r1 * time) + c2 * r2 * Math.exp(r2 * time);
        }
      }
      const a = -(w0 * w0) * x - 2 * g * v;
      return { x, v, a };
    }

    function drawRing() {
      const R = num(p, 'A') * S;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 64; i++) { const a = (i / 64) * Math.PI * 2; pts.push(new THREE.Vector3(R * Math.cos(a), R * Math.sin(a), 0)); }
      ring.setPoints(pts);
      ampL.setPoints([[EQ - R, 0.01, -0.9], [EQ - R, 0.01, 0.9]]);
      ampR.setPoints([[EQ + R, 0.01, -0.9], [EQ + R, 0.01, 0.9]]);
    }
    drawRing();

    const energies = (s: { x: number; v: number }) => {
      const KE = 0.5 * num(p, 'm') * s.v * s.v;
      const PE = 0.5 * num(p, 'k') * s.x * s.x;
      return { KE, PE, E: KE + PE };
    };

    return {
      setParams(np) { p = np; drawRing(); },
      reset() { t = 0; sample.reset(); },
      step(dt) {
        t += dt;
        if (sample.due(t)) {
          const s = state(t);
          const A = num(p, 'A'), w = omega0();
          graphs.get('xva').push(t, s.x / A, s.v / (A * w), s.a / (A * w * w));
          const en = energies(s);
          graphs.get('E').push(t, en.KE, en.PE, en.E);
        }
      },
      render() {
        const s = state(t);
        const bx = EQ + s.x * S;
        block.position.set(bx, 0.4, 0);
        spring.setPoints(springPoints([-2.15, 0.4, 0], [bx - 0.4, 0.4, 0], 14, 0.16));
        const A = num(p, 'A'), w = omega0();
        vArrow.set([bx, 1.05, 0], [(s.v / (A * w || 1)) * 1.2, 0, 0]);
        aArrow.set([bx, 1.5, 0], [(s.a / (A * w * w || 1)) * 1.2, 0, 0]);
        fArrow.set([bx, 0.4, 0.45], [(-num(p, 'k') * s.x / (num(p, 'k') * A || 1)) * 1.2, 0, 0]);
        const showC = bool(p, 'circle');
        circleG.visible = showC;
        drop.visible = showC;
        if (showC) {
          const th = omegaD() * t + rad(num(p, 'phi'));
          const R = A * S * Math.exp(-gamma() * t);
          dot.position.set(R * Math.cos(th), R * Math.sin(th), 0);
          radius.setPoints([[0, 0, 0], dot.position.clone()]);
          drop.setPoints([[EQ + dot.position.x, 3.1 + dot.position.y, 0], [bx, 0.8, 0]]);
        }
        bars.visible = bool(p, 'bars');
        const en = energies(s);
        const Emax = 0.5 * num(p, 'k') * A * A || 1;
        keBar.set(en.KE / Emax); peBar.set(en.PE / Emax); eBar.set(en.E / Emax);
      },
      time: () => t,
      readouts(): Readout[] {
        const s = state(t);
        const sh = springSHM(num(p, 'm'), num(p, 'k'));
        const en = energies(s);
        return [
          { label: 'Period T', value: sh.period, unit: 's', tone: 'accent' },
          { label: 'Frequency f', value: sh.frequency, unit: 'Hz', tone: 'accent' },
          { label: 'Angular frequency ω', value: sh.omega, unit: 'rad/s' },
          { label: 'Displacement x', value: s.x, unit: 'm' },
          { label: 'Velocity v', value: s.v, unit: 'm/s' },
          { label: 'Acceleration a', value: s.a, unit: 'm/s²' },
          { label: 'Kinetic energy', value: en.KE, unit: 'J' },
          { label: 'Potential energy', value: en.PE, unit: 'J' },
          { label: 'Total energy', value: en.E, unit: 'J' },
          { label: 'Max speed Aω', value: num(p, 'A') * sh.omega, unit: 'm/s' },
        ];
      },
      equations(): Equation[] {
        const sh = springSHM(num(p, 'm'), num(p, 'k'));
        const A = num(p, 'A');
        const out: Equation[] = [
          { expr: 'T = 2π √(m / k)', sub: `T = 2π √(${n(num(p, 'm'))} / ${n(num(p, 'k'))}) = ${n(sh.period)} s` },
          { expr: 'x = A cos(ωt + φ)', sub: `x = ${n(A)} cos(${n(sh.omega)} t + ${num(p, 'phi')}°)` },
          { expr: 'v = −Aω sin(ωt + φ) ,  v_max = Aω', sub: `v_max = ${n(A * sh.omega)} m/s` },
          { expr: 'a = −ω² x', sub: `a_max = ω²A = ${n(sh.omega ** 2 * A)} m/s²` },
          { expr: 'E = ½ k A²', sub: `E = ½ × ${n(num(p, 'k'))} × ${n(A)}² = ${n(0.5 * num(p, 'k') * A * A)} J` },
        ];
        if (num(p, 'b') > 0) out.push({ expr: 'x = A e^(−bt/2m) cos(ω′t + φ)', sub: `ω′ = ${n(omegaD())} rad/s`, note: 'With damping the amplitude decays exponentially.' });
        return out;
      },
    };
  },
};

export default sim;
