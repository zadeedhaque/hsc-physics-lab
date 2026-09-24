import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { h, e as eC, me, mp } from '../../physics/constants';
import { deg } from '../../lib/num';
import { C } from '../../engine/colors';
import { n } from '../shared';

const PARTICLES: Record<string, { name: string; m: number; q: number }> = {
  electron: { name: 'Electron', m: me, q: 1 },
  proton: { name: 'Proton', m: mp, q: 1 },
  neutron: { name: 'Neutron (energy in eV)', m: 1.674_927_5e-27, q: 1 },
  alpha: { name: 'Alpha particle', m: 6.644_657e-27, q: 2 },
};
const SP = 0.6; // atom spacing drawn (scene) = d
const R = 5; // detector arm radius

const sim: SimDefinition = {
  camera: { position: [0, 4, 11], target: [0, 2.5, 0], aspect: 1.5 },
  hint: 'Move the detector around the arc to find the diffraction peak (Davisson–Germer: electrons at 54 V give a peak near 50° from nickel).',
  params: [
    { kind: 'select', key: 'particle', label: 'Particle', default: 'electron', options: Object.entries(PARTICLES).map(([value, pt]) => ({ value, label: pt.name })) },
    { kind: 'slider', key: 'V', label: 'Accelerating voltage', unit: 'V', min: 1, max: 1000, step: 1, default: 54 },
    { kind: 'slider', key: 'd', label: 'Crystal row spacing d', unit: 'nm', min: 0.1, max: 0.5, step: 0.005, default: 0.215 },
    { kind: 'slider', key: 'det', label: 'Detector angle', unit: '°', min: -85, max: 85, step: 1, default: 30 },
  ],
  presets: [
    { label: 'Davisson–Germer (54 V, Ni)', values: { particle: 'electron', V: 54, d: 0.215, det: 50 } },
    { label: 'Faster electrons (150 V)', values: { particle: 'electron', V: 150 } },
    { label: 'Protons at 54 V', values: { particle: 'proton', V: 54 } },
    { label: 'Thermal neutrons (0.025 eV → use 1 eV)', values: { particle: 'neutron', V: 1 } },
  ],
  graphs: [
    { id: 'I', title: 'Scattered intensity vs angle', x: 'angle (°)', y: 'intensity', kind: 'curve', xRange: [-90, 90], zeroY: true, series: [{ label: 'd sin θ = nλ peaks', color: C.accent }] },
    { id: 'L', title: 'de Broglie wavelength vs voltage', x: 'V (V)', y: 'λ (nm)', kind: 'curve', xRange: [1, 1000], zeroY: true, series: [{ label: 'λ = h / √(2mqV)', color: C.negative }] },
  ],
  learn: {
    concept: 'de Broglie proposed that every moving particle has a wavelength λ = h/p = h/mv. A particle of charge q accelerated through V has p = √(2mqV), so λ = h/√(2mqV). Davisson and Germer confirmed it: electrons reflected from a nickel crystal showed a diffraction peak, just like X-rays, where d sin θ = nλ.',
    variables: [['λ', 'de Broglie wavelength'], ['p', 'momentum mv'], ['h', 'Planck constant'], ['V', 'accelerating voltage'], ['d', 'spacing of atomic rows']],
    observe: [
      'Higher voltage → shorter wavelength → peak moves toward the centre.',
      'A proton at the same voltage has a wavelength about 43× shorter than an electron.',
      'If λ > d there is no diffraction peak at all.',
    ],
    challenge: 'Calculate the de Broglie wavelength of a 60 kg person walking at 1.5 m/s. Why do we never see people diffract?',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0;
    // crystal surface
    const atoms = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 12, 8), kit.mat('#94a3b8', { metalness: 0.5 }), 11 * 3 * 4);
    const m4 = new THREE.Matrix4();
    let k = 0;
    for (let i = -5; i <= 5; i++) for (let j = 0; j < 3; j++) for (let l = -1; l <= 2; l++) { m4.makeTranslation(i * SP, -j * SP, l * SP); atoms.setMatrixAt(k++, m4); }
    kit.add(atoms);
    kit.label('crystal', [3.8, -0.9, 0], { small: true });
    const gun = kit.cylinder(0.3, 0.3, 1, '#475569', { metalness: 0.5 });
    gun.position.set(0, 6.6, 0);
    const beam = kit.line(C.negative, [[0, 6.1, 0], [0, 0.15, 0]], { width: 2, opacity: 0.5 });
    void beam;
    const fronts = kit.segments(C.negative, { width: 1.5 });
    const lobe = kit.line(C.accent, [], { width: 2.5 });
    const arc = kit.line('#64748b', [], { width: 1, dashed: true });
    const arcPts: [number, number, number][] = [];
    for (let a = -90; a <= 90; a += 3) arcPts.push([R * Math.sin((a * Math.PI) / 180), R * Math.cos((a * Math.PI) / 180), 0]);
    arc.setPoints(arcPts);
    const detector = kit.box(0.5, 0.5, 0.5, C.weight);
    const arm = kit.line(C.weight, [], { width: 1.5, dashed: true });
    const dLabel = kit.label('', [0, 0, 0], { color: C.weight, small: true });
    const lamLabel = kit.label('', [1.6, 4.4, 0], { color: C.negative, small: true });

    const part = () => PARTICLES[str(p, 'particle')] ?? PARTICLES.electron;
    const K = () => part().q * eC * num(p, 'V');
    const mom = () => Math.sqrt(2 * part().m * K());
    const lam = () => h / mom(); // m
    const ratio = () => (lam() * 1e9) / num(p, 'd'); // λ / d
    /** Diffraction peaks at sin θ = nλ/d (normal incidence), plus weak specular n = 0. */
    function intensity(thDeg: number) {
      const s = Math.sin((thDeg * Math.PI) / 180);
      let I = 0.06;
      for (let m = -6; m <= 6; m++) {
        const s0 = m * ratio();
        if (Math.abs(s0) > 1) continue;
        I += (m === 0 ? 0.3 : 1 / (1 + 0.25 * Math.abs(m))) * Math.exp(-(((s - s0) / 0.035) ** 2));
      }
      return I;
    }
    function build() {
      graphs.get('I').plot(0, -90, 90, intensity, 721);
      graphs.get('I').setMarkers([{ x: num(p, 'det'), y: intensity(num(p, 'det')), color: C.weight }]);
      graphs.get('L').plot(0, 1, 1000, (V) => (h / Math.sqrt(2 * part().m * part().q * eC * V)) * 1e9, 400);
      graphs.get('L').setMarkers([{ x: num(p, 'V'), y: lam() * 1e9, color: C.negative }]);
      const pts: [number, number, number][] = [];
      for (let a = -90; a <= 90; a += 0.5) {
        const r = 0.3 + 3.2 * intensity(a);
        pts.push([r * Math.sin((a * Math.PI) / 180), 0.2 + r * Math.cos((a * Math.PI) / 180), 0]);
      }
      lobe.setPoints(pts);
      const a = (num(p, 'det') * Math.PI) / 180;
      const D = new THREE.Vector3(R * Math.sin(a), R * Math.cos(a), 0);
      detector.position.copy(D); detector.rotation.z = -a;
      arm.setPoints([[0, 0.2, 0], D]);
      dLabel.at(D.clone().multiplyScalar(1.12)).setText(`${n(num(p, 'det'))}°`);
      lamLabel.setText(`λ = ${n(lam() * 1e9)} nm`);
    }
    build();

    return {
      setParams(np) { p = np; build(); },
      reset() { t = 0; },
      step(dt) { t += dt; },
      render() {
        // wavefronts in the incident beam, spaced by λ on the same scale as the atoms (d ↔ SP)
        const spacing = SP * ratio();
        const flat: number[] = [];
        if (spacing > 0.03) {
          const off = (t * 1.2) % spacing;
          for (let y = 6 - off; y > 0.3; y -= spacing) flat.push(-0.4, y, 0, 0.4, y, 0);
          fronts.setSegments(flat);
        } else fronts.visible = false;
      },
      time: () => t,
      readouts(): Readout[] {
        const s1 = ratio();
        return [
          { label: 'Kinetic energy', value: K() / eC, unit: 'eV' },
          { label: 'Speed', value: mom() / part().m, unit: 'm/s' },
          { label: 'Momentum p', value: mom(), unit: 'kg·m/s' },
          { label: 'de Broglie wavelength λ', value: lam() * 1e9, unit: 'nm', tone: 'accent' },
          { label: 'λ / d', value: s1 },
          { label: 'First-order peak angle', value: s1 <= 1 ? deg(Math.asin(s1)) : 'none (λ > d)', unit: s1 <= 1 ? '°' : undefined, tone: 'accent' },
          { label: 'Detector reading', value: intensity(num(p, 'det')) },
        ];
      },
      equations(): Equation[] {
        return [
          { expr: 'λ = h / p = h / √(2 m q V)', sub: `= 6.63×10⁻³⁴ / ${n(mom())} = ${n(lam() * 1e9)} nm` },
          { expr: 'Electrons: λ ≈ 1.226 / √V nm', sub: `= 1.226 / √${n(num(p, 'V'))} = ${n(1.226 / Math.sqrt(num(p, 'V')))} nm (electron)` },
          { expr: 'd sin θ = n λ', sub: ratio() <= 1 ? `sin θ₁ = ${n(ratio())} → θ₁ = ${n(deg(Math.asin(ratio())))}°` : 'λ > d: no peak' },
        ];
      },
    };
  },
};

export default sim;
