import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { bool, num, str } from '../types';
import { R } from '../../physics/constants';
import { heatCapacities } from '../../physics/thermo';
import { C } from '../../engine/colors';
import { n } from '../shared';

type Kind = 'mono' | 'di' | 'poly';

const sim: SimDefinition = {
  camera: { position: [0, 2, 8], target: [0, 0, 0], aspect: 1.5 },
  hint: 'Each independent way a molecule can move (translate, rotate, vibrate) is a degree of freedom that shares ½kT of energy.',
  params: [
    { kind: 'select', key: 'kind', label: 'Molecule', default: 'di', options: [{ value: 'mono', label: 'Monatomic (He)' }, { value: 'di', label: 'Diatomic (O₂)' }, { value: 'poly', label: 'Polyatomic (CH₄)' }] },
    { kind: 'toggle', key: 'vib', label: 'Include vibration (high temperature)', default: false, showIf: (p) => p.kind !== 'mono' },
    { kind: 'slider', key: 'T', label: 'Temperature', unit: 'K', min: 50, max: 3000, step: 10, default: 300 },
  ],
  presets: [
    { label: 'Helium', values: { kind: 'mono' } },
    { label: 'Oxygen (room temp.)', values: { kind: 'di', vib: false } },
    { label: 'Oxygen (very hot)', values: { kind: 'di', vib: true, T: 2500 } },
    { label: 'Methane', values: { kind: 'poly', vib: false } },
  ],
  graphs: [
    { id: 'U', title: 'Internal energy per mole vs temperature', x: 'T (K)', y: 'U (kJ/mol)', kind: 'curve', xRange: [0, 3000], zeroY: true, series: [{ label: 'U = (f/2)RT', color: C.accent }] },
  ],
  learn: {
    concept: 'By the law of equipartition of energy, each degree of freedom of a molecule has an average energy of ½kT. A monatomic gas has 3 (translation only); a rigid diatomic molecule adds 2 rotations (f = 5); a non-linear molecule has 3 rotations (f = 6). Vibrations add more at high temperature. Then C_v = (f/2)R, C_p = C_v + R and γ = C_p/C_v.',
    variables: [['f', 'number of degrees of freedom'], ['C_v', 'molar heat capacity at constant volume'], ['C_p', 'molar heat capacity at constant pressure'], ['γ', 'C_p / C_v'], ['U', 'internal energy (f/2)nRT']],
    observe: [
      'Monatomic: γ = 5/3 ≈ 1.67. Diatomic: γ = 7/5 = 1.40.',
      'More degrees of freedom → more energy stored per kelvin → larger heat capacity.',
      'Switching on vibration adds 2 degrees of freedom per vibrational mode.',
    ],
    challenge: 'How much heat is needed to raise 1 mol of oxygen by 10 K at constant volume? At constant pressure?',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0;
    const mol = kit.add(new THREE.Group());
    const trans = kit.arrow(C.velocity, { label: 'translation' });
    const rotArrow = kit.line(C.acceleration, [], { width: 2 });
    const rotLabel = kit.label('rotation', [0, 1.6, 0], { color: C.acceleration, small: true });
    let bondAtoms: THREE.Mesh[] = [];

    const f = () => {
      const k = str(p, 'kind') as Kind;
      if (k === 'mono') return 3;
      if (k === 'di') return 5 + (bool(p, 'vib') ? 2 : 0);
      return 6 + (bool(p, 'vib') ? 6 : 0); // a few vibrational modes for a polyatomic (simplified)
    };

    function build() {
      kit.clearGroup(mol);
      bondAtoms = [];
      const k = str(p, 'kind') as Kind;
      const atom = (x: number, y: number, z: number, c: string, r = 0.4) => { const a = kit.sphere(r, c, { emissive: 0.15 }); a.position.set(x, y, z); mol.add(a); bondAtoms.push(a); return a; };
      if (k === 'mono') atom(0, 0, 0, '#a78bfa', 0.5);
      else if (k === 'di') { atom(-0.55, 0, 0, C.friction); atom(0.55, 0, 0, C.friction); const b = kit.cylinder(0.08, 0.08, 1.1, '#e2e8f0'); b.rotation.z = Math.PI / 2; mol.add(b); }
      else {
        atom(0, 0, 0, '#475569', 0.4);
        const dirs = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
        dirs.forEach(([x, y, z]) => {
          const d = new THREE.Vector3(x, y, z).normalize().multiplyScalar(0.9);
          atom(d.x, d.y, d.z, '#e2e8f0', 0.25);
          const b = kit.cylinder(0.05, 0.05, 0.9, '#94a3b8');
          b.position.copy(d.clone().multiplyScalar(0.5));
          b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
          mol.add(b);
        });
      }
      rotArrow.visible = rotLabel.visible = k !== 'mono';
      const pts: [number, number, number][] = [];
      for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI * 1.6; pts.push([1.3 * Math.cos(a), 1.3, 1.3 * Math.sin(a)]); }
      rotArrow.setPoints(pts);
      graphs.get('U').plot(0, 0, 3000, (T) => (f() / 2) * R * T / 1000, 2);
      graphs.get('U').setMarkers([{ x: num(p, 'T'), y: (f() / 2) * R * num(p, 'T') / 1000, color: C.accent }]);
    }
    build();

    return {
      setParams(np) { p = np; build(); },
      reset() { t = 0; },
      step(dt) { t += dt; },
      render() {
        const s = Math.sqrt(num(p, 'T') / 300);
        mol.position.set(1.5 * Math.sin(t * 0.7 * s), 0.3 * Math.sin(t * 1.3 * s), 0.8 * Math.cos(t * 0.5 * s));
        if (str(p, 'kind') !== 'mono') mol.rotation.set(t * 0.8 * s, t * 1.1 * s, 0);
        if (bool(p, 'vib') && str(p, 'kind') === 'di' && bondAtoms.length === 2) {
          const d = 0.55 + 0.12 * Math.sin(t * 12);
          bondAtoms[0].position.x = -d; bondAtoms[1].position.x = d;
        }
        trans.set(mol.position.clone().add(new THREE.Vector3(0, 0.9, 0)), [Math.cos(t * 0.7 * s) * 0.9, 0, -Math.sin(t * 0.5 * s) * 0.6]);
      },
      time: () => t,
      readouts(): Readout[] {
        const hc = heatCapacities(f());
        return [
          { label: 'Degrees of freedom f', value: f(), tone: 'accent' },
          { label: 'C_v = (f/2)R', value: hc.Cv, unit: 'J/(mol·K)' },
          { label: 'C_p = C_v + R', value: hc.Cp, unit: 'J/(mol·K)' },
          { label: 'γ = C_p / C_v', value: hc.gamma, tone: 'accent' },
          { label: 'Energy per molecule (f/2)kT', value: (f() / 2) * 1.380649e-23 * num(p, 'T'), unit: 'J' },
          { label: 'Internal energy per mole', value: (f() / 2) * R * num(p, 'T'), unit: 'J' },
        ];
      },
      equations(): Equation[] {
        const hc = heatCapacities(f());
        return [
          { expr: 'E per degree of freedom = ½ k T' },
          { expr: 'U = (f/2) n R T', sub: `= (${f()}/2) × 8.314 × ${n(num(p, 'T'))} = ${n((f() / 2) * R * num(p, 'T'))} J/mol` },
          { expr: 'γ = 1 + 2/f', sub: `= 1 + 2/${f()} = ${n(hc.gamma)}` },
        ];
      },
    };
  },
};

export default sim;
