import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num } from '../types';
import { G, Mearth, Rearth } from '../../physics/constants';
import { C } from '../../engine/colors';
import { n } from '../shared';

const SR = 1.2; // scene radius of the planet
const DEPTH = 5; // scene depth of the well at the surface

const sim: SimDefinition = {
  camera: { position: [0, 7, 12], target: [0, -1.5, 0], aspect: 1.4 },
  timeless: true,
  hint: 'The funnel’s depth is the potential V = −GM/r. Lifting a mass means climbing out of the well.',
  params: [
    { kind: 'slider', key: 'M', label: 'Planet mass', unit: 'M⊕', min: 0.1, max: 5, step: 0.01, default: 1 },
    { kind: 'slider', key: 'R', label: 'Planet radius', unit: 'R⊕', min: 0.3, max: 2, step: 0.01, default: 1 },
    { kind: 'slider', key: 'r', label: 'Probe distance from centre', unit: 'R', min: 1, max: 6, step: 0.05, default: 2 },
    { kind: 'slider', key: 'm', label: 'Test mass', unit: 'kg', min: 1, max: 1000, step: 1, default: 100 },
  ],
  presets: [
    { label: 'Earth surface', values: { M: 1, R: 1, r: 1 } },
    { label: 'Far away (6 R)', values: { M: 1, R: 1, r: 6 } },
    { label: 'Dense planet', values: { M: 4, R: 0.8 } },
  ],
  graphs: [
    { id: 'V', title: 'Potential vs distance', x: 'r / R', y: 'V (MJ/kg)', kind: 'curve', xRange: [0, 6], series: [{ label: 'V(r)', color: C.accent }] },
  ],
  learn: {
    concept: 'Gravitational potential V at a point is the work done per unit mass to bring a mass from infinity to that point. Because gravity attracts, the work is negative: V = −GM/r outside the planet. The potential energy of a mass m is U = mV, and moving it outward always increases U.',
    variables: [['V', 'gravitational potential (J/kg)'], ['U', 'potential energy mV (J)'], ['r', 'distance from the centre (m)'], ['M', 'planet mass (kg)']],
    observe: [
      'V is always negative and approaches zero far away.',
      'The well is steepest near the surface — g is the slope of V.',
      'Energy needed to escape from the surface equals m·|V_surface|.',
    ],
    challenge: 'How much energy does it take to lift 100 kg from Earth’s surface to r = 2R? Compare with mgh using h = R — why do they differ?',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    const well = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: '#1d4ed8', wireframe: false, roughness: 0.7, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    kit.add(well);
    const wire = kit.segments('#93c5fd', { width: 1, opacity: 0.6 });
    const planet = kit.sphere(SR * 0.7, '#2563eb', { emissive: 0.1 });
    const probe = kit.sphere(0.18, C.weight, { emissive: 0.4 });
    const drop = kit.line(C.weight, [], { dashed: true, width: 1.5 });
    const lab = kit.label('', [0, 0, 0], { color: C.weight, small: true });

    const V = (rMetres: number) => {
      const M = num(p, 'M') * Mearth, R = num(p, 'R') * Rearth;
      return rMetres >= R ? (-G * M) / rMetres : (-G * M * (3 * R * R - rMetres * rMetres)) / (2 * R ** 3);
    };
    const Vs = () => V(num(p, 'R') * Rearth);
    /** Scene height of the surface at radius x (scene units, x = SR is the planet surface). */
    const height = (x: number) => (V((x / SR) * num(p, 'R') * Rearth) / Math.abs(Vs())) * DEPTH * Math.min(1.6, Math.max(0.25, Math.abs(Vs()) / 6.26e7)); // deeper well for a stronger planet

    function build() {
      const rings = 60, seg = 72, rMax = 6 * SR;
      const pos: number[] = [], idx: number[] = [];
      for (let i = 0; i <= rings; i++) {
        const x = (i / rings) * rMax;
        const y = height(Math.max(x, 0.001));
        for (let j = 0; j <= seg; j++) { const a = (j / seg) * Math.PI * 2; pos.push(x * Math.cos(a), y, x * Math.sin(a)); }
      }
      for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) { const a = i * (seg + 1) + j, b = a + seg + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
      well.geometry.dispose();
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      well.geometry = g;
      // equipotential rings every R
      const flat: number[] = [];
      for (let k = 1; k <= 6; k++) {
        const x = k * SR, y = height(x) + 0.02;
        for (let j = 0; j < 72; j++) { const a0 = (j / 72) * Math.PI * 2, a1 = ((j + 1) / 72) * Math.PI * 2; flat.push(x * Math.cos(a0), y, x * Math.sin(a0), x * Math.cos(a1), y, x * Math.sin(a1)); }
      }
      wire.setSegments(flat);
      planet.position.y = height(0.001) + 0.3;
      graphs.get('V').plot(0, 0, 6, (x) => V(x * num(p, 'R') * Rearth) / 1e6, 200);
      graphs.get('V').setMarkers([{ x: num(p, 'r'), y: V(num(p, 'r') * num(p, 'R') * Rearth) / 1e6, color: C.weight }]);
    }
    build();

    return {
      setParams(np) { p = np; build(); },
      reset() { build(); },
      step() {},
      render() {
        const x = num(p, 'r') * SR;
        const y = height(x);
        probe.position.set(x, y + 0.18, 0);
        drop.setPoints([[x, 0.3, 0], [x, y, 0]]);
        lab.at([x + 0.4, y + 0.8, 0]).setText(`V = ${n(V(num(p, 'r') * num(p, 'R') * Rearth))} J/kg`);
      },
      readouts(): Readout[] {
        const R = num(p, 'R') * Rearth;
        const Vp = V(num(p, 'r') * R);
        return [
          { label: 'Potential at probe V', value: Vp, unit: 'J/kg', tone: 'accent' },
          { label: 'Potential at surface', value: Vs(), unit: 'J/kg' },
          { label: 'PE of test mass U = mV', value: num(p, 'm') * Vp, unit: 'J' },
          { label: 'Energy to lift from surface to probe', value: num(p, 'm') * (Vp - Vs()), unit: 'J', tone: 'accent' },
          { label: 'Energy to escape from surface', value: num(p, 'm') * Math.abs(Vs()), unit: 'J' },
        ];
      },
      equations(): Equation[] {
        const R = num(p, 'R') * Rearth;
        return [
          { expr: 'V = − G M / r   (r ≥ R)', sub: `V = −6.674×10⁻¹¹ × ${n(num(p, 'M') * Mearth)} / ${n(num(p, 'r') * R)} = ${n(V(num(p, 'r') * R))} J/kg` },
          { expr: 'U = m V ,  ΔU = m (V₂ − V₁)' },
          { expr: 'g = − dV/dr', note: 'The field is the slope of the potential.' },
        ];
      },
    };
  },
};

export default sim;
