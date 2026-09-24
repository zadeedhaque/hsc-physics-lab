import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { c } from '../../physics/constants';
import { lorentz } from '../../physics/modern';
import { C } from '../../engine/colors';
import { Bar3D, n } from '../shared';
import * as THREE from 'three';

const EXAMPLES: Record<string, { name: string; m: number }> = {
  custom: { name: 'Custom mass', m: 0 },
  electron: { name: 'Electron (9.11 × 10⁻³¹ kg)', m: 9.109e-31 },
  proton: { name: 'Proton', m: 1.6726e-27 },
  u235: { name: 'Mass lost in one U-235 fission (≈ 0.2 u)', m: 0.2 * 1.6605e-27 },
  gram: { name: '1 gram', m: 1e-3 },
  kg: { name: '1 kilogram', m: 1 },
};

const sim: SimDefinition = {
  camera: { position: [0, 2.5, 9], target: [0, 1.5, 0], aspect: 1.6 },
  timeless: true,
  hint: 'A tiny mass stores an enormous energy: c² is 9 × 10¹⁶ m²/s².',
  params: [
    { kind: 'select', key: 'ex', label: 'Example', default: 'gram', options: Object.entries(EXAMPLES).map(([value, e]) => ({ value, label: e.name })) },
    { kind: 'slider', key: 'mg', label: 'Custom mass', unit: 'mg', min: 0.001, max: 1000, step: 0.001, default: 1, decimals: 3, showIf: (p) => p.ex === 'custom' },
    { kind: 'slider', key: 'beta', label: 'Speed of the body v / c', min: 0, max: 0.99, step: 0.01, default: 0 },
  ],
  presets: [
    { label: 'Electron rest energy', values: { ex: 'electron', beta: 0 } },
    { label: 'One fission', values: { ex: 'u235' } },
    { label: '1 gram', values: { ex: 'gram' } },
    { label: 'Fast electron (0.9 c)', values: { ex: 'electron', beta: 0.9 } },
  ],
  graphs: [
    { id: 'E', title: 'Total energy vs speed (in units of m₀c²)', x: 'v / c', y: 'E / m₀c²', kind: 'curve', xRange: [0, 1], yRange: [0, 8], series: [{ label: 'relativistic γ', color: C.accent }, { label: 'Newtonian 1 + ½v²/c²', color: '#94a3b8', dashed: true }] },
  ],
  learn: {
    concept: 'Einstein showed that mass itself is a form of energy: E = mc². A body at rest has rest energy m₀c²; moving, its total energy is γm₀c², so its kinetic energy is (γ − 1)m₀c². In nuclear reactions a small loss of mass (the mass defect) appears as a huge release of energy.',
    variables: [['E', 'energy (J)'], ['m', 'mass (kg)'], ['c', 'speed of light 3 × 10⁸ m/s'], ['γ', 'Lorentz factor'], ['1 u', '931.5 MeV']],
    observe: [
      '1 g of mass is equivalent to about 9 × 10¹³ J — the energy of a large power station for a day.',
      'At low speeds the relativistic and Newtonian energies agree.',
      'The kinetic energy grows without limit as v → c.',
    ],
    challenge: 'How much mass is converted into energy each second by a 1000 MW power station?',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    const cube = kit.box(1, 1, 1, '#a78bfa', { emissive: 0.3 });
    cube.position.set(-2.5, 0.8, 0);
    const bars = kit.add(new THREE.Group());
    bars.position.set(1, 0, 0);
    const bRest = new Bar3D(kit, C.accent, 'rest', 3, 0.5);
    const bKE = new Bar3D(kit, C.weight, 'kinetic', 3, 0.5); bKE.position.x = 0.8;
    bars.add(bRest, bKE);
    const label = kit.label('', [-2.5, 2.2, 0], { color: '#a78bfa' });
    graphs.get('E').plot(0, 0, 0.99, (b) => lorentz(b * c).gamma, 200);
    graphs.get('E').plot(1, 0, 0.99, (b) => 1 + 0.5 * b * b, 50);

    const m0 = () => (str(p, 'ex') === 'custom' ? num(p, 'mg') * 1e-6 : (EXAMPLES[str(p, 'ex')] ?? EXAMPLES.gram).m);
    function draw() {
      const g = lorentz(num(p, 'beta') * c).gamma;
      bRest.set(1 / Math.max(g, 1) * 0.9);
      bKE.set(((g - 1) / Math.max(g, 1)) * 0.9);
      cube.scale.setScalar(0.5 + Math.min(1.2, Math.log10(1 + m0() * 1e30) / 30));
      label.setText(`m₀ = ${n(m0())} kg`);
      graphs.get('E').setMarkers([{ x: num(p, 'beta'), y: Math.min(8, g), color: C.accent }]);
    }
    draw();

    return {
      setParams(np) { p = np; draw(); },
      reset() { draw(); },
      step() {},
      readouts(): Readout[] {
        const g = lorentz(num(p, 'beta') * c).gamma;
        const E0 = m0() * c * c;
        return [
          { label: 'Rest energy m₀c²', value: E0, unit: 'J', tone: 'accent' },
          { label: 'Rest energy', value: E0 / 1.602176634e-13, unit: 'MeV' },
          { label: 'Total energy γm₀c²', value: g * E0, unit: 'J' },
          { label: 'Kinetic energy', value: (g - 1) * E0, unit: 'J', tone: 'accent' },
          { label: 'Equivalent in kWh', value: E0 / 3.6e6, unit: 'kWh' },
          { label: 'Tonnes of TNT', value: E0 / 4.184e9, unit: 't' },
        ];
      },
      equations(): Equation[] {
        const g = lorentz(num(p, 'beta') * c).gamma;
        return [
          { expr: 'E = m c²', sub: `= ${n(m0())} × (3×10⁸)² = ${n(m0() * c * c)} J` },
          { expr: 'E = γ m₀ c² ,  KE = (γ − 1) m₀ c²', sub: `γ = ${n(g)}` },
          { expr: '1 u × c² = 931.5 MeV' },
        ];
      },
    };
  },
};

export default sim;
