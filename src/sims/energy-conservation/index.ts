import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { C } from '../../engine/colors';
import { Bar3D, n, sampler } from '../shared';

const L = 6; // half-width of the track (m)
const KE_C = '#34d399', PE_C = '#fbbf24', TH_C = '#f87171';

const sim: SimDefinition = {
  camera: { position: [0, 3.5, 13], target: [0.8, 2.3, 0], aspect: 1.6 },
  hint: 'Without friction the ball always returns to its starting height: KE + PE never changes.',
  params: [
    { kind: 'select', key: 'track', label: 'Track', default: 'valley', options: [{ value: 'valley', label: 'Valley' }, { value: 'hump', label: 'Roller-coaster' }] },
    { kind: 'slider', key: 'H', label: 'Release height', unit: 'm', min: 0.5, max: 5, step: 0.1, default: 4 },
    { kind: 'slider', key: 'm', label: 'Mass', unit: 'kg', min: 0.1, max: 10, step: 0.1, default: 1 },
    { kind: 'slider', key: 'g', label: 'Gravity', unit: 'm/s²', min: 1, max: 25, step: 0.01, default: 9.81 },
    { kind: 'slider', key: 'loss', label: 'Friction (energy loss)', min: 0, max: 0.5, step: 0.01, default: 0 },
    { kind: 'select', key: 'view', label: 'Emphasise', default: 'both', options: [{ value: 'both', label: 'KE + PE' }, { value: 'ke', label: 'Kinetic' }, { value: 'pe', label: 'Potential' }] },
  ],
  presets: [
    { label: 'Frictionless valley', values: { track: 'valley', loss: 0, H: 4 } },
    { label: 'Roller-coaster', values: { track: 'hump', loss: 0, H: 4.5 } },
    { label: 'Not enough energy', values: { track: 'hump', loss: 0, H: 2.4 } },
    { label: 'With friction', values: { track: 'valley', loss: 0.15, H: 4 } },
  ],
  graphs: [
    { id: 'E', title: 'Energy vs time', x: 't (s)', y: 'J', window: 12, zeroY: true, series: [{ label: 'KE', color: KE_C }, { label: 'PE', color: PE_C }, { label: 'KE + PE', color: '#e2e8f0' }, { label: 'heat', color: TH_C, dashed: true }] },
  ],
  learn: {
    concept: 'Mechanical energy is the sum of kinetic energy ½mv² and gravitational potential energy mgh. If only gravity does work, this sum is conserved: energy changes form but the total stays the same. Friction converts mechanical energy into heat, so the total mechanical energy falls.',
    variables: [['KE', 'kinetic energy ½mv² (J)'], ['PE', 'potential energy mgh (J)'], ['h', 'height above the lowest point (m)'], ['v', 'speed (m/s)']],
    observe: [
      'At the lowest point PE is smallest and KE largest.',
      'The speed at the bottom √(2gH) does not depend on the mass or the shape of the track.',
      'With friction, the white total line slopes down and heat grows by the same amount.',
      'On the roller-coaster the ball can only cross the hump if it starts higher than the hump.',
    ],
    challenge: 'From what release height does the ball reach 7 m/s at the bottom? Use ½mv² = mgh, then check.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0, x = -L, u = 0, heat = 0;
    const sample = sampler(1 / 30);
    const trackLine = kit.line('#94a3b8', [], { width: 5 });
    const ball = kit.sphere(0.25, C.bodyAlt, { emissive: 0.2 });
    const vArrow = kit.arrow(C.velocity, { label: 'v' });
    const hLine = kit.line(PE_C, [], { dashed: true, width: 1.5 });
    const hLabel = kit.label('', [0, 0, 0], { color: PE_C, small: true });
    kit.box(2 * L + 6, 0.2, 3, '#1e293b').position.set(0, -0.1, 0);
    const bars = kit.add(new THREE.Group());
    bars.position.set(L + 1.8, 0, 0);
    const bKE = new Bar3D(kit, KE_C, 'KE', 4, 0.4);
    const bPE = new Bar3D(kit, PE_C, 'PE', 4, 0.4); bPE.position.x = 0.55;
    const bT = new Bar3D(kit, '#e2e8f0', 'Total', 4, 0.4); bT.position.x = 1.1;
    const bH = new Bar3D(kit, TH_C, 'Heat', 4, 0.4); bH.position.x = 1.65;
    bars.add(bKE, bPE, bT, bH);

    const hump = () => (str(p, 'track') === 'hump' ? 2.8 : 0);
    // height profile y(x) and derivatives
    const y = (xx: number) => 5 * (xx / L) ** 2 + hump() * Math.exp(-((xx / 1.4) ** 2));
    const dy = (xx: number) => (10 * xx) / (L * L) - hump() * (2 * xx / 1.96) * Math.exp(-((xx / 1.4) ** 2));
    const d2y = (xx: number) => 10 / (L * L) - hump() * (2 / 1.96) * Math.exp(-((xx / 1.4) ** 2)) * (1 - (2 * xx * xx) / 1.96);
    /** start x on the left branch where y = H */
    function startX() {
      let lo = -L, hi = 0;
      const H = Math.min(num(p, 'H'), y(-L));
      for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (y(mid) > H) lo = mid; else hi = mid; }
      return lo;
    }
    const speed = () => Math.abs(u) * Math.sqrt(1 + dy(x) ** 2);

    function drawTrack() {
      const pts: [number, number, number][] = [];
      for (let i = 0; i <= 200; i++) { const xx = -L + (2 * L * i) / 200; pts.push([xx, y(xx), 0]); }
      trackLine.setPoints(pts);
    }
    const reset = () => { t = 0; x = startX(); u = 0; heat = 0; sample.reset(); drawTrack(); };
    reset();

    /** Bead on a wire: ẍ = −(g y′ + y′y″ẋ²)/(1 + y′²) − loss·ẋ */
    const accel = (xx: number, uu: number) => {
      const s = dy(xx);
      return -(num(p, 'g') * s + s * d2y(xx) * uu * uu) / (1 + s * s) - num(p, 'loss') * uu;
    };

    return {
      setParams(np) { const r = np.track !== p.track || np.H !== p.H; p = np; if (r) { graphs.clearLive(); reset(); } },
      reset,
      step(dt) {
        const E0 = num(p, 'm') * num(p, 'g') * y(x) + 0.5 * num(p, 'm') * speed() ** 2;
        // RK4
        const k1x = u, k1u = accel(x, u);
        const k2x = u + (k1u * dt) / 2, k2u = accel(x + (k1x * dt) / 2, u + (k1u * dt) / 2);
        const k3x = u + (k2u * dt) / 2, k3u = accel(x + (k2x * dt) / 2, u + (k2u * dt) / 2);
        const k4x = u + k3u * dt, k4u = accel(x + k3x * dt, u + k3u * dt);
        x += (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
        u += (dt / 6) * (k1u + 2 * k2u + 2 * k3u + k4u);
        if (x < -L) { x = -L; u = 0; }
        if (x > L) { x = L; u = 0; }
        const E1 = num(p, 'm') * num(p, 'g') * y(x) + 0.5 * num(p, 'm') * speed() ** 2;
        if (num(p, 'loss') > 0) heat += Math.max(0, E0 - E1);
        t += dt;
        if (sample.due(t)) {
          const KE = 0.5 * num(p, 'm') * speed() ** 2, PE = num(p, 'm') * num(p, 'g') * y(x);
          graphs.get('E').push(t, KE, PE, KE + PE, heat);
        }
      },
      render() {
        const s = dy(x);
        const nrm = new THREE.Vector3(-s, 1, 0).normalize();
        const pos = new THREE.Vector3(x, y(x), 0).addScaledVector(nrm, 0.25);
        ball.position.copy(pos);
        const tan = new THREE.Vector3(1, s, 0).normalize();
        vArrow.set(pos, tan.multiplyScalar(Math.sign(u) * speed() * 0.25), `v = ${n(speed())} m/s`);
        hLine.setPoints([[x, 0, 0.3], [x, y(x), 0.3]]);
        hLabel.at([x + 0.5, y(x) / 2, 0.3]).setText(`h = ${n(y(x))} m`);
        const Emax = num(p, 'm') * num(p, 'g') * num(p, 'H') || 1;
        const KE = 0.5 * num(p, 'm') * speed() ** 2, PE = num(p, 'm') * num(p, 'g') * y(x);
        const view = str(p, 'view');
        bKE.set(KE / Emax); bPE.set(PE / Emax); bT.set((KE + PE) / Emax); bH.set(heat / Emax);
        bKE.visible = view !== 'pe'; bPE.visible = view !== 'ke';
      },
      time: () => t,
      readouts(): Readout[] {
        const m = num(p, 'm'), g = num(p, 'g');
        const KE = 0.5 * m * speed() ** 2, PE = m * g * y(x);
        const view = str(p, 'view');
        return [
          { label: 'Height h', value: y(x), unit: 'm' },
          { label: 'Speed v', value: speed(), unit: 'm/s' },
          { label: 'Kinetic energy', value: KE, unit: 'J', tone: view === 'pe' ? 'default' : 'accent' },
          { label: 'Potential energy', value: PE, unit: 'J', tone: view === 'ke' ? 'default' : 'accent' },
          { label: 'KE + PE', value: KE + PE, unit: 'J' },
          { label: 'Heat produced', value: heat, unit: 'J' },
          { label: 'Speed at bottom (ideal) √(2gH)', value: Math.sqrt(2 * g * num(p, 'H')), unit: 'm/s' },
        ];
      },
      equations(): Equation[] {
        const m = num(p, 'm'), g = num(p, 'g');
        return [
          { expr: 'KE = ½ m v²', sub: `= ½ × ${n(m)} × ${n(speed())}² = ${n(0.5 * m * speed() ** 2)} J` },
          { expr: 'PE = m g h', sub: `= ${n(m)} × ${n(g)} × ${n(y(x))} = ${n(m * g * y(x))} J` },
          { expr: 'KE + PE = constant (no friction)', sub: `= m g H = ${n(m * g * num(p, 'H'))} J` },
          { expr: 'v_bottom = √(2 g H)', sub: `= ${n(Math.sqrt(2 * g * num(p, 'H')))} m/s` },
        ];
      },
    };
  },
};

export default sim;
