import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { cyclotronMotion } from '../../physics/magnetism';
import { e as eC, me, mp } from '../../physics/constants';
import { rad } from '../../lib/num';
import { C } from '../../engine/colors';
import { n } from '../shared';

const PARTICLES: Record<string, { name: string; q: number; m: number; color: string }> = {
  electron: { name: 'Electron', q: -eC, m: me, color: C.negative },
  proton: { name: 'Proton', q: eC, m: mp, color: C.positive },
  alpha: { name: 'Alpha particle', q: 2 * eC, m: 4 * 1.6605e-27, color: '#f472b6' },
  custom: { name: 'Custom', q: eC, m: mp, color: '#fbbf24' },
};

const sim: SimDefinition = {
  camera: { position: [7, 5, 8], target: [0, 0, 0], aspect: 1.4 },
  hint: 'The magnetic force is always perpendicular to the velocity, so it changes direction but not speed. Tilt the velocity to get a helix.',
  params: [
    { kind: 'select', key: 'type', label: 'Particle', default: 'proton', options: Object.entries(PARTICLES).map(([value, p]) => ({ value, label: p.name })) },
    { kind: 'select', key: 'qc', label: 'Charge', default: '1', options: [{ value: '-2', label: '−2e' }, { value: '-1', label: '−e' }, { value: '1', label: '+e' }, { value: '2', label: '+2e' }], showIf: (p) => p.type === 'custom' },
    { kind: 'slider', key: 'mu', label: 'Mass (× proton mass)', min: 0.01, max: 10, step: 0.01, default: 1, showIf: (p) => p.type === 'custom' },
    { kind: 'slider', key: 'v', label: 'Speed', unit: '×10⁶ m/s', min: 0.1, max: 5, step: 0.1, default: 2 },
    { kind: 'slider', key: 'B', label: 'Magnetic field B (along +y)', unit: 'T', min: 0.01, max: 1, step: 0.01, default: 0.2 },
    { kind: 'slider', key: 'pitch', label: 'Angle between v and B', unit: '°', min: 1, max: 179, step: 1, default: 90 },
  ],
  presets: [
    { label: 'Proton circle', values: { type: 'proton', pitch: 90 } },
    { label: 'Electron circle', values: { type: 'electron', v: 2, B: 0.01, pitch: 90 } },
    { label: 'Helix', values: { type: 'proton', pitch: 60 } },
    { label: 'Alpha particle', values: { type: 'alpha', pitch: 90 } },
  ],
  graphs: [
    { id: 'r', title: 'Radius vs speed', x: 'v (×10⁶ m/s)', y: 'r (cm)', kind: 'curve', xRange: [0, 5], zeroY: true, series: [{ label: 'r = mv⊥/qB', color: C.accent }] },
  ],
  learn: {
    concept: 'A charge moving through a magnetic field feels the Lorentz force F = qv × B, perpendicular to both v and B. It does no work, so the speed stays constant and the particle moves in a circle of radius r = mv/qB with period T = 2πm/qB — independent of speed. A velocity component along B makes the path a helix.',
    variables: [['r', 'radius mv⊥/|q|B (m)'], ['T', 'period 2πm/|q|B (s)'], ['f', 'cyclotron frequency qB/2πm'], ['p', 'pitch of the helix v∥T']],
    observe: [
      'Positive and negative charges circle in opposite directions.',
      'Doubling the speed doubles the radius but leaves the period unchanged.',
      'Electrons circle in tiny, fast orbits compared with protons.',
    ],
    challenge: 'At what field does a proton moving at 2 × 10⁶ m/s circle with radius 10 cm?',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0;
    const particle = kit.sphere(0.15, C.positive, { emissive: 0.6 });
    const trail = kit.trail(C.weight, 1500, { width: 2 });
    const vArrow = kit.arrow(C.velocity, { label: 'v' });
    const fArrow = kit.arrow(C.force, { label: 'F' });
    const field = kit.segments(C.magnetic, { width: 1, opacity: 0.35 });
    const flat: number[] = [];
    for (let x = -4; x <= 4; x += 1.6) for (let z = -4; z <= 4; z += 1.6) flat.push(x, -3, z, x, 5, z);
    field.setSegments(flat);
    kit.label('B ↑', [-4.4, 5.2, -4], { color: C.magnetic });

    function prt() {
      const b = PARTICLES[str(p, 'type')] ?? PARTICLES.proton;
      if (str(p, 'type') === 'custom') return { ...b, q: Number(str(p, 'qc')) * eC, m: num(p, 'mu') * mp };
      return b;
    }
    const motion = () => { const b = prt(); return cyclotronMotion(b.q, b.m, num(p, 'v') * 1e6, num(p, 'B'), rad(num(p, 'pitch'))); };
    /** scene units per metre chosen so the circle radius is ~2.5 units */
    const scale = () => { const m = motion(); return Number.isFinite(m.r) && m.r > 0 ? 2.5 / m.r : 1; };

    function reset() {
      t = 0; trail.clearPoints();
      const b = prt();
      (particle.material as THREE.MeshStandardMaterial).color.set(b.color);
      const G = graphs.get('r');
      G.plot(0, 0, 5, (v) => cyclotronMotion(b.q, b.m, v * 1e6, num(p, 'B'), rad(num(p, 'pitch'))).r * 100, 100);
      G.setMarkers([{ x: num(p, 'v'), y: motion().r * 100, color: C.accent }]);
    }
    reset();

    function position(time: number) {
      const m = motion();
      if (!Number.isFinite(m.r) || m.omega === 0) return { pos: new THREE.Vector3(), vel: new THREE.Vector3(1, 0, 0) };
      const sgn = Math.sign(prt().q) || 1;
      const ph = sgn * m.omega * time; // sense of rotation set by the sign of q (F = qv × B points to the centre)
      const s = scale();
      const r = m.r * s;
      const pos = new THREE.Vector3(r * Math.cos(ph) - r, m.vPar * time * s, r * Math.sin(ph));
      const vel = new THREE.Vector3(-Math.sin(ph) * sgn, 0, Math.cos(ph) * sgn).multiplyScalar(m.vPerp).add(new THREE.Vector3(0, m.vPar, 0));
      return { pos, vel };
    }
    const T = () => motion().T;

    return {
      setParams(np) { p = np; reset(); },
      reset,
      step(dt) {
        // display: one full orbit every 3 s regardless of the real (tiny) period
        t += dt * (T() / 3);
        const { pos } = position(t);
        trail.push(pos);
        if (pos.y > 5.5) { t = 0; trail.clearPoints(); }
      },
      render() {
        const { pos, vel } = position(t);
        particle.position.copy(pos);
        trail.flush();
        const v = vel.clone().normalize();
        vArrow.set(pos, v.clone().multiplyScalar(1.2), '');
        const F = new THREE.Vector3().crossVectors(vel, new THREE.Vector3(0, num(p, 'B'), 0)).multiplyScalar(Math.sign(prt().q) || 1);
        fArrow.set(pos, F.lengthSq() > 0 ? F.normalize().multiplyScalar(1) : [0, 0, 0], '');
      },
      time: () => t,
      readouts(): Readout[] {
        const m = motion();
        return [
          { label: 'Radius r', value: m.r * 100, unit: 'cm', tone: 'accent' },
          { label: 'Period T', value: m.T * 1e9, unit: 'ns', tone: 'accent' },
          { label: 'Cyclotron frequency', value: m.f / 1e6, unit: 'MHz' },
          { label: 'Pitch of helix', value: m.pitch * 100, unit: 'cm' },
          { label: 'Magnetic force', value: m.F, unit: 'N' },
          { label: 'Speed (constant)', value: num(p, 'v') * 1e6, unit: 'm/s' },
        ];
      },
      equations(): Equation[] {
        const b = prt(), m = motion();
        return [
          { expr: 'F = q v B sin θ', sub: `= ${n(m.F)} N` },
          { expr: 'q v⊥ B = m v⊥² / r  ⇒  r = m v⊥ / (q B)', sub: `= ${n(b.m)} × ${n(m.vPerp)} / (${n(Math.abs(b.q))} × ${n(num(p, 'B'))}) = ${n(m.r)} m` },
          { expr: 'T = 2π m / (q B)', sub: `= ${n(m.T)} s` },
          { expr: 'pitch = v∥ T' },
        ];
      },
    };
  },
};

export default sim;
