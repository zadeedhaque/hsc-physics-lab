import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num } from '../types';
import { rad, deg } from '../../lib/num';
import { C } from '../../engine/colors';
import { n } from '../shared';

const RE = 2.2; // scene radius of the Earth
const B0 = 31e-6; // equatorial surface field (T), dipole approximation

const sim: SimDefinition = {
  camera: { position: [0, 3, 11], target: [0, 0, 0], aspect: 1.4 },
  timeless: true,
  hint: 'Schematic dipole model. At the magnetic equator the field is horizontal (dip 0°); at the magnetic poles it is vertical (dip 90°).',
  params: [
    { kind: 'slider', key: 'lat', label: 'Magnetic latitude of the observer', unit: '°', min: -90, max: 90, step: 1, default: 24 },
    { kind: 'slider', key: 'dec', label: 'Declination (angle between geographic and magnetic north)', unit: '°', min: -20, max: 20, step: 0.5, default: 0 },
    { kind: 'slider', key: 'tilt', label: 'Tilt of magnetic axis', unit: '°', min: 0, max: 20, step: 0.5, default: 11 },
  ],
  presets: [
    { label: 'Dhaka (≈ 24°)', values: { lat: 24 } },
    { label: 'Magnetic equator', values: { lat: 0 } },
    { label: 'Near a magnetic pole', values: { lat: 80 } },
    { label: 'Southern hemisphere', values: { lat: -35 } },
  ],
  graphs: [
    { id: 'dip', title: 'Angle of dip vs magnetic latitude', x: 'latitude (°)', y: 'dip (°)', kind: 'curve', xRange: [-90, 90], series: [{ label: 'tan δ = 2 tan λ', color: C.magnetic }] },
  ],
  learn: {
    concept: 'The Earth behaves roughly like a giant bar magnet whose south magnetic pole is near the geographic North Pole. At any place the field has three elements: declination (angle between magnetic and geographic north), dip or inclination δ (angle of the field below the horizontal) and the horizontal component B_H = B cos δ. For a dipole, tan δ = 2 tan λ.',
    variables: [['δ', 'angle of dip'], ['λ', 'magnetic latitude'], ['B_H', 'horizontal component B cos δ'], ['B_V', 'vertical component B sin δ'], ['θ_dec', 'declination']],
    observe: [
      'A compass needle free to rotate vertically (dip needle) points steeply downward near the poles.',
      'The horizontal component — what an ordinary compass uses — is largest at the equator.',
      'In the southern hemisphere the dip is upward (negative).',
    ],
    challenge: 'At a place where the dip is 45°, what is the magnetic latitude? What is B_H/B_V?',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    const earth = kit.sphere(RE, '#1d4ed8', { roughness: 0.8, opacity: 0.85 }, 48);
    const axis = kit.line('#e2e8f0', [[0, -RE - 1, 0], [0, RE + 1, 0]], { dashed: true, width: 1.2 });
    void axis;
    kit.label('Geographic N', [0, RE + 1.3, 0], { small: true });
    const magAxis = kit.line(C.magnetic, [], { width: 2 });
    const lines = kit.segments(C.magnetic, { width: 1.2, opacity: 0.7 });
    const obs = kit.sphere(0.12, C.weight, { emissive: 0.5 });
    const bArrow = kit.arrow(C.magnetic, { label: 'B', radius: 0.045 });
    const bh = kit.arrow(C.normal, { label: 'B_H', radius: 0.03 });
    const bv = kit.arrow(C.acceleration, { label: 'B_V', radius: 0.03 });
    const magN = kit.label('', [0, 0, 0], { color: C.negative, small: true });
    void earth;

    const dip = (latDeg: number) => Math.atan(2 * Math.tan(rad(latDeg)));
    const Btot = (latDeg: number) => B0 * Math.sqrt(1 + 3 * Math.sin(rad(latDeg)) ** 2);

    function draw() {
      const tilt = rad(num(p, 'tilt'));
      const ax = new THREE.Vector3(Math.sin(tilt), Math.cos(tilt), 0);
      magAxis.setPoints([ax.clone().multiplyScalar(-(RE + 0.8)), ax.clone().multiplyScalar(RE + 0.8)]);
      magN.at(ax.clone().multiplyScalar(RE + 1.1)).setText('magnetic S pole (near geographic N)');
      // dipole field lines r = L cos²λ in the plane of the magnetic axis
      const flat: number[] = [];
      const perp = new THREE.Vector3(Math.cos(tilt), -Math.sin(tilt), 0);
      for (const Lsh of [1.3, 1.8, 2.6, 3.8]) for (const side of [1, -1]) {
        let prev: THREE.Vector3 | null = null;
        for (let i = 0; i <= 80; i++) {
          const lam = -Math.PI / 2 + (i / 80) * Math.PI;
          const r = Lsh * RE * Math.cos(lam) ** 2;
          if (r < RE * 0.999) { prev = null; continue; }
          const pt = perp.clone().multiplyScalar(side * r * Math.cos(lam)).addScaledVector(ax, r * Math.sin(lam));
          if (prev) flat.push(prev.x, prev.y, prev.z, pt.x, pt.y, pt.z);
          prev = pt;
        }
      }
      lines.setSegments(flat);
      // observer on the surface at magnetic latitude λ
      const lam = rad(num(p, 'lat'));
      const pos = perp.clone().multiplyScalar(RE * Math.cos(lam)).addScaledVector(ax, RE * Math.sin(lam));
      obs.position.copy(pos);
      const up = pos.clone().normalize();
      const north = ax.clone().sub(up.clone().multiplyScalar(ax.dot(up))).normalize();
      const d = dip(num(p, 'lat'));
      // field points toward magnetic north horizontally and downward in the northern hemisphere
      const bdir = north.clone().multiplyScalar(Math.cos(d)).addScaledVector(up, -Math.sin(d));
      bArrow.set(pos, bdir.multiplyScalar(1.4), `B = ${n(Btot(num(p, 'lat')) * 1e6)} µT`);
      bh.set(pos, north.clone().multiplyScalar(1.4 * Math.cos(d)), 'B_H');
      bv.set(pos, up.clone().multiplyScalar(-1.4 * Math.sin(d)), 'B_V');
      graphs.get('dip').plot(0, -89, 89, (l) => deg(dip(l)), 180);
      graphs.get('dip').setMarkers([{ x: num(p, 'lat'), y: deg(d), color: C.magnetic }]);
    }
    draw();

    return {
      setParams(np) { p = np; draw(); },
      reset() { draw(); },
      step() {},
      readouts(): Readout[] {
        const d = dip(num(p, 'lat'));
        const B = Btot(num(p, 'lat'));
        return [
          { label: 'Angle of dip δ', value: deg(d), unit: '°', tone: 'accent' },
          { label: 'Total field B', value: B * 1e6, unit: 'µT' },
          { label: 'Horizontal component B_H', value: B * Math.cos(d) * 1e6, unit: 'µT', tone: 'accent' },
          { label: 'Vertical component B_V', value: B * Math.sin(d) * 1e6, unit: 'µT' },
          { label: 'Declination', value: num(p, 'dec'), unit: '°' },
          { label: 'Compass points', value: `${Math.abs(num(p, 'dec'))}° ${num(p, 'dec') >= 0 ? 'east' : 'west'} of true north` },
        ];
      },
      equations(): Equation[] {
        const d = dip(num(p, 'lat'));
        return [
          { expr: 'B_H = B cos δ ,  B_V = B sin δ ,  tan δ = B_V / B_H' },
          { expr: 'Dipole: tan δ = 2 tan λ', sub: `δ = tan⁻¹(2 tan ${num(p, 'lat')}°) = ${n(deg(d))}°` },
          { expr: 'B = B₀ √(1 + 3 sin²λ)', note: 'B₀ ≈ 31 µT at the magnetic equator.' },
        ];
      },
    };
  },
};

export default sim;
