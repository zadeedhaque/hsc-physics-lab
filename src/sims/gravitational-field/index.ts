import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num } from '../types';
import { G, Mearth, Rearth } from '../../physics/constants';
import { C } from '../../engine/colors';
import { n } from '../shared';

const SR = 2; // scene radius of the planet

const sim: SimDefinition = {
  camera: { position: [0, 7, 13], target: [0, 0, 0], aspect: 1.3 },
  timeless: true,
  hint: 'Arrows show g in a slice through the planet’s centre. Inside, g falls linearly to zero at the centre.',
  params: [
    { kind: 'slider', key: 'M', label: 'Planet mass', unit: 'M⊕', min: 0.05, max: 10, step: 0.01, default: 1 },
    { kind: 'slider', key: 'R', label: 'Planet radius', unit: 'R⊕', min: 0.2, max: 3, step: 0.01, default: 1 },
    { kind: 'slider', key: 'h', label: 'Probe height above surface', unit: 'km', min: 0, max: 20000, step: 50, default: 1000 },
    { kind: 'slider', key: 'd', label: 'Probe depth below surface', unit: 'km', min: 0, max: 6371, step: 10, default: 0 },
  ],
  presets: [
    { label: 'Earth', values: { M: 1, R: 1 } },
    { label: 'Moon', values: { M: 0.0123, R: 0.273 } },
    { label: 'Mars', values: { M: 0.107, R: 0.532 } },
    { label: 'ISS altitude', values: { M: 1, R: 1, h: 410, d: 0 } },
    { label: 'Deep mine', values: { M: 1, R: 1, h: 0, d: 3000 } },
  ],
  graphs: [
    { id: 'gr', title: 'g vs distance from the centre', x: 'r / R', y: 'g (m/s²)', kind: 'curve', xRange: [0, 5], zeroY: true, series: [{ label: 'g(r)', color: C.field }] },
  ],
  learn: {
    concept: 'The gravitational field strength at a point is the force per unit mass there: g = GM/r² outside a spherical body. Going up, g falls with the square of the distance from the centre; going down into a uniform planet, g decreases in proportion to the distance from the centre, becoming zero at the centre.',
    variables: [['g', 'field strength (N/kg = m/s²)'], ['M', 'mass of the planet (kg)'], ['R', 'radius of the planet (m)'], ['h', 'height above the surface'], ['d', 'depth below the surface']],
    observe: [
      'g is largest at the surface.',
      'At a height equal to one radius, g is a quarter of its surface value.',
      'Halfway to the centre, g is half its surface value (uniform density).',
    ],
    challenge: 'At what height above Earth is g exactly half its surface value? Predict with g_h = g(R/(R+h))², then find it.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    kit.sphere(SR, '#2563eb', { roughness: 0.8, emissive: 0.08, opacity: 0.55 }, 48);
    const arrows = kit.add(new THREE.Group());
    const probe = kit.sphere(0.12, '#e2e8f0');
    const probeArrow = kit.arrow(C.field, { label: 'g', radius: 0.05 });
    const deep = kit.sphere(0.12, '#e2e8f0');
    const deepArrow = kit.arrow(C.field, { label: 'g', radius: 0.05 });

    const gSurf = () => (G * num(p, 'M') * Mearth) / (num(p, 'R') * Rearth) ** 2;
    /** g at distance r (metres) from the centre. */
    const gAt = (r: number) => {
      const Rm = num(p, 'R') * Rearth;
      return r >= Rm ? (G * num(p, 'M') * Mearth) / (r * r) : gSurf() * (r / Rm);
    };

    function draw() {
      kit.clearGroup(arrows);
      const g0 = gSurf();
      for (let ring = 1.25; ring <= 4.5; ring += 0.8) {
        const count = Math.round(8 + ring * 3);
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2;
          const pos = new THREE.Vector3(ring * SR * Math.cos(a) * 0.7, 0, ring * SR * Math.sin(a) * 0.7);
          const rr = (pos.length() / SR) * num(p, 'R') * Rearth;
          const len = 1.2 * (gAt(rr) / g0);
          const dir = pos.clone().normalize().multiplyScalar(-len);
          const ar = kit.arrow(C.field, { radius: 0.025 });
          ar.set(pos, dir);
          arrows.add(ar);
        }
      }
      const G1 = graphs.get('gr');
      G1.plot(0, 0, 5, (x) => gAt(x * num(p, 'R') * Rearth), 250);
      const Rm = num(p, 'R') * Rearth;
      G1.setMarkers([
        { x: (Rm + num(p, 'h') * 1000) / Rm, y: gAt(Rm + num(p, 'h') * 1000), label: 'height', color: C.field },
        { x: Math.max(0, Rm - num(p, 'd') * 1000) / Rm, y: gAt(Math.max(0, Rm - num(p, 'd') * 1000)), label: 'depth', color: C.resultant },
      ]);
    }
    draw();

    return {
      setParams(np) { p = np; draw(); },
      reset() { draw(); },
      step() {},
      render() {
        const Rm = num(p, 'R') * Rearth;
        const rh = (Rm + num(p, 'h') * 1000) / Rm; // in planet radii
        const ph = new THREE.Vector3(-Math.min(rh, 5) * SR * 0.7071, Math.min(rh, 5) * SR * 0.7071, 0);
        probe.position.copy(ph);
        probeArrow.set(ph, ph.clone().normalize().multiplyScalar(-1.2 * gAt(rh * Rm) / gSurf()), `g = ${n(gAt(rh * Rm))}`);
        const rd = Math.max(0, Rm - num(p, 'd') * 1000) / Rm;
        const pd = new THREE.Vector3(rd * SR * 0.7071, rd * SR * 0.7071, SR * 0.02);
        deep.position.copy(pd);
        deepArrow.set(pd, rd > 0 ? pd.clone().normalize().multiplyScalar(-1.2 * gAt(rd * Rm) / gSurf()) : [0, 0, 0], `g = ${n(gAt(rd * Rm))}`);
      },
      readouts(): Readout[] {
        const Rm = num(p, 'R') * Rearth;
        return [
          { label: 'Surface gravity g₀', value: gSurf(), unit: 'm/s²', tone: 'accent' },
          { label: 'g at the height', value: gAt(Rm + num(p, 'h') * 1000), unit: 'm/s²' },
          { label: 'g at the depth', value: gAt(Math.max(0, Rm - num(p, 'd') * 1000)), unit: 'm/s²' },
          { label: 'Weight of 70 kg at surface', value: 70 * gSurf(), unit: 'N' },
          { label: 'Mean density', value: (num(p, 'M') * Mearth) / ((4 / 3) * Math.PI * Rm ** 3), unit: 'kg/m³' },
        ];
      },
      equations(): Equation[] {
        const Rkm = num(p, 'R') * Rearth / 1000;
        return [
          { expr: 'g = G M / R²', sub: `g₀ = ${n(gSurf())} m/s²` },
          { expr: 'g_h = g₀ R² / (R + h)²', sub: `= ${n(gSurf())} × (${n(Rkm)} / ${n(Rkm + num(p, 'h'))})²` },
          { expr: 'g_d = g₀ (1 − d / R)', sub: `= ${n(gSurf())} × (1 − ${n(num(p, 'd'))} / ${n(Rkm)})` },
        ];
      },
    };
  },
};

export default sim;
