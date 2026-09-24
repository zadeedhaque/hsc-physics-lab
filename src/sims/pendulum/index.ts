import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { bool, num } from '../types';
import { pendulumPeriod, stepPendulum } from '../../physics/shm';
import { rad, deg } from '../../lib/num';
import { C } from '../../engine/colors';
import { n, sampler } from '../shared';

const PIVOT = new THREE.Vector3(0, 4.2, 0);

const sim: SimDefinition = {
  camera: { position: [0, 2.6, 9.5], target: [0, 2.2, 0], aspect: 1.3 },
  hint: 'The faint pendulum follows the small-angle formula. At large amplitudes the real pendulum falls behind — its period is longer.',
  params: [
    { kind: 'slider', key: 'L', label: 'Length', unit: 'm', min: 0.1, max: 4, step: 0.01, default: 1 },
    { kind: 'slider', key: 'g', label: 'Gravity', unit: 'm/s²', min: 1, max: 25, step: 0.01, default: 9.81 },
    { kind: 'slider', key: 'amp', label: 'Amplitude', unit: '°', min: 1, max: 170, step: 1, default: 15 },
    { kind: 'slider', key: 'm', label: 'Bob mass', unit: 'kg', min: 0.05, max: 5, step: 0.05, default: 0.5 },
    { kind: 'slider', key: 'b', label: 'Damping', unit: 's⁻¹', min: 0, max: 0.5, step: 0.01, default: 0 },
    { kind: 'toggle', key: 'ghost', label: 'Show small-angle model', default: true },
  ],
  presets: [
    { label: 'Small angle', values: { amp: 5, L: 1, b: 0 } },
    { label: 'Large angle', values: { amp: 80, L: 1, b: 0 } },
    { label: 'Seconds pendulum', values: { L: 0.994, g: 9.81, amp: 5 } },
    { label: 'Slow (Moon)', values: { g: 1.62, L: 1, amp: 10 } },
    { label: 'Fast (short)', values: { L: 0.25, amp: 10 } },
  ],
  graphs: [
    { id: 'th', title: 'Angle vs time', x: 't (s)', y: 'θ (°)', window: 10, series: [{ label: 'real pendulum', color: C.accent }, { label: 'small-angle model', color: '#94a3b8', dashed: true }] },
    { id: 'TA', title: 'Period vs amplitude', x: 'amplitude (°)', y: 'T (s)', kind: 'curve', xRange: [0, 170], series: [{ label: 'exact period', color: C.acceleration }, { label: '2π√(L/g)', color: '#94a3b8', dashed: true }] },
  ],
  learn: {
    concept: 'A simple pendulum oscillates because a component of gravity, mg sin θ, pulls the bob back toward the lowest point. For small angles sin θ ≈ θ, the motion is simple harmonic and T = 2π√(L/g), independent of the mass and amplitude. At large amplitudes the period grows.',
    variables: [['L', 'length from pivot to the bob’s centre (m)'], ['g', 'acceleration due to gravity (m/s²)'], ['θ', 'angular displacement'], ['T', 'period (s)']],
    observe: [
      'Changing the mass does nothing to the period.',
      'Four times the length gives twice the period.',
      'Below about 15° the real and ideal pendulums stay in step.',
      'The period vs amplitude graph rises steeply toward 180°.',
    ],
    challenge: 'Find the length of a pendulum that has a period of exactly 2 s on Earth (the “seconds pendulum”).',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let th = 0, w = 0, t = 0;
    const sample = sampler(1 / 30);
    const support = kit.box(2.4, 0.15, 0.6, '#475569');
    support.position.copy(PIVOT).add(new THREE.Vector3(0, 0.08, 0));
    const string = kit.line('#e2e8f0', [], { width: 2 });
    const bob = kit.sphere(0.22, C.acceleration, { emissive: 0.15 });
    const ghostStr = kit.line('#94a3b8', [], { width: 1, opacity: 0.4 });
    const ghost = kit.sphere(0.22, '#94a3b8', { opacity: 0.3 });
    const vertical = kit.line('#64748b', [], { dashed: true, width: 1 });
    const arc = kit.line('#64748b', [], { dashed: true, width: 1 });
    const gAr = kit.arrow(C.weight, { label: 'mg', radius: 0.035 });
    const rAr = kit.arrow(C.force, { label: 'mg sin θ', radius: 0.035 });
    const trail = kit.trail(C.accent, 120, { width: 1.5, opacity: 0.5 });

    const scale = () => 3.6 / Math.max(num(p, 'L'), 1); // scene units per metre (long pendulums shrink)
    const omega0 = () => Math.sqrt(num(p, 'g') / num(p, 'L'));

    function curve() {
      const G = graphs.get('TA');
      G.plot(0, 1, 170, (a) => pendulumPeriod(num(p, 'L'), num(p, 'g'), rad(a)).exact, 170);
      G.plot(1, 1, 170, () => pendulumPeriod(num(p, 'L'), num(p, 'g'), 0).T0, 2);
      G.setMarkers([{ x: num(p, 'amp'), y: pendulumPeriod(num(p, 'L'), num(p, 'g'), rad(num(p, 'amp'))).exact, color: C.acceleration }]);
      const Ls = num(p, 'L') * scale();
      const pts: [number, number, number][] = [];
      const A = rad(num(p, 'amp'));
      for (let i = 0; i <= 40; i++) { const a = -A + (2 * A * i) / 40; pts.push([Ls * Math.sin(a), PIVOT.y - Ls * Math.cos(a), -0.05]); }
      arc.setPoints(pts);
      vertical.setPoints([PIVOT, [0, PIVOT.y - Ls - 0.4, 0]]);
    }
    const reset = () => { th = rad(num(p, 'amp')); w = 0; t = 0; sample.reset(); trail.clearPoints(); curve(); };
    reset();

    return {
      setParams(np) { const restart = np.amp !== p.amp || np.L !== p.L; p = np; if (restart) { graphs.clearLive(); reset(); } else curve(); },
      reset,
      step(dt) {
        const s = stepPendulum(th, w, dt, num(p, 'g'), num(p, 'L'), num(p, 'b'));
        th = s.theta; w = s.omega; t += dt;
        if (sample.due(t)) {
          const A = rad(num(p, 'amp'));
          const lin = A * Math.exp(-num(p, 'b') * t / 2) * Math.cos(omega0() * t);
          graphs.get('th').push(t, deg(th), deg(lin));
        }
      },
      render() {
        const Ls = num(p, 'L') * scale();
        const pos = new THREE.Vector3(Ls * Math.sin(th), PIVOT.y - Ls * Math.cos(th), 0);
        string.setPoints([PIVOT, pos]);
        bob.position.copy(pos);
        bob.scale.setScalar(0.7 + 0.3 * Math.cbrt(num(p, 'm')));
        trail.push(pos); trail.flush();
        const showG = bool(p, 'ghost');
        ghost.visible = ghostStr.visible = showG;
        if (showG) {
          const lin = rad(num(p, 'amp')) * Math.exp(-num(p, 'b') * t / 2) * Math.cos(omega0() * t);
          const gp = new THREE.Vector3(Ls * Math.sin(lin), PIVOT.y - Ls * Math.cos(lin), -0.3);
          ghost.position.copy(gp);
          ghostStr.setPoints([[PIVOT.x, PIVOT.y, -0.3], gp]);
        }
        gAr.set(pos, [0, -1, 0], '');
        const tang = new THREE.Vector3(-Math.cos(th), -Math.sin(th), 0).multiplyScalar(Math.sin(th));
        rAr.set(pos, tang, `mg sin θ`);
      },
      time: () => t,
      readouts(): Readout[] {
        const pp = pendulumPeriod(num(p, 'L'), num(p, 'g'), rad(num(p, 'amp')));
        return [
          { label: 'Small-angle period T₀', value: pp.T0, unit: 's', tone: 'accent' },
          { label: 'Exact period at this amplitude', value: pp.exact, unit: 's', tone: 'accent' },
          { label: 'Difference', value: ((pp.exact - pp.T0) / pp.T0) * 100, unit: '%' },
          { label: 'Frequency', value: 1 / pp.exact, unit: 'Hz' },
          { label: 'Angle now', value: deg(th), unit: '°' },
          { label: 'Speed of bob', value: Math.abs(w) * num(p, 'L'), unit: 'm/s' },
          { label: 'Max speed √(2gL(1 − cos A))', value: Math.sqrt(2 * num(p, 'g') * num(p, 'L') * (1 - Math.cos(rad(num(p, 'amp'))))), unit: 'm/s' },
        ];
      },
      equations(): Equation[] {
        const pp = pendulumPeriod(num(p, 'L'), num(p, 'g'), rad(num(p, 'amp')));
        return [
          { expr: 'T = 2π √(L / g)', sub: `= 2π √(${n(num(p, 'L'))} / ${n(num(p, 'g'))}) = ${n(pp.T0)} s` },
          { expr: 'θ″ = −(g/L) sin θ', note: 'Exact equation — solved numerically here.' },
          { expr: 'T ≈ T₀ (1 + θ₀²/16 + …)', sub: `exact T = ${n(pp.exact)} s` },
          { expr: 'g = 4π² L / T²', note: 'How g is measured with a pendulum.' },
        ];
      },
    };
  },
};

export default sim;
