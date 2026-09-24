import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { R, atm } from '../../physics/constants';
import { ParticleBox } from '../particles';
import { C } from '../../engine/colors';
import { n } from '../shared';

type Law = 'boyle' | 'charles' | 'pressure';
const RAD = 1.2; // cylinder radius (scene)
const VMAX = 50; // litres at the full cylinder height
const HMAX = 5; // scene height for VMAX

const sim: SimDefinition = {
  camera: { position: [0, 3.5, 9], target: [0, 2.3, 0], aspect: 1.3 },
  hint: 'Molecules speed up with temperature; the piston and gauge respond according to the chosen law.',
  params: [
    { kind: 'select', key: 'law', label: 'Law', default: 'boyle', options: [{ value: 'boyle', label: 'Boyle (T fixed)' }, { value: 'charles', label: 'Charles (P fixed)' }, { value: 'pressure', label: 'Pressure (V fixed)' }] },
    { kind: 'slider', key: 'nmol', label: 'Amount of gas', unit: 'mol', min: 0.2, max: 2, step: 0.05, default: 1 },
    { kind: 'slider', key: 'V', label: 'Volume', unit: 'L', min: 5, max: 50, step: 0.5, default: 22.4, showIf: (p) => p.law !== 'charles' },
    { kind: 'slider', key: 'T', label: 'Temperature', unit: 'K', min: 100, max: 600, step: 1, default: 273, showIf: (p) => p.law !== 'boyle' },
    { kind: 'slider', key: 'Tb', label: 'Fixed temperature', unit: 'K', min: 100, max: 600, step: 1, default: 273, showIf: (p) => p.law === 'boyle' },
    { kind: 'slider', key: 'P', label: 'Fixed pressure', unit: 'atm', min: 0.5, max: 3, step: 0.05, default: 1, showIf: (p) => p.law === 'charles' },
  ],
  presets: [
    { label: 'STP (1 mol)', values: { law: 'boyle', V: 22.4, Tb: 273, nmol: 1 } },
    { label: 'Boyle: squeeze to half', values: { law: 'boyle', V: 11.2 } },
    { label: 'Charles: heat to 546 K', values: { law: 'charles', T: 546, P: 1 } },
    { label: 'Pressure law: cool to 150 K', values: { law: 'pressure', T: 150, V: 22.4 } },
  ],
  graphs: [
    { id: 'law', title: 'Gas law graph', x: 'x', y: 'y', kind: 'curve', zeroY: true, series: [{ label: 'isotherm / isobar / isochore', color: C.accent }] },
  ],
  learn: {
    concept: 'For a fixed mass of ideal gas: Boyle’s law — at constant temperature, PV is constant; Charles’s law — at constant pressure, V ∝ T; pressure law — at constant volume, P ∝ T. All three are summed up in PV = nRT, with T in kelvin.',
    variables: [['P', 'pressure (Pa)'], ['V', 'volume (m³)'], ['T', 'absolute temperature (K)'], ['n', 'amount of gas (mol)'], ['R', '8.314 J/(mol·K)']],
    observe: [
      'Boyle: halving V doubles P; the P–V graph is a hyperbola.',
      'Charles: V–T is a straight line that extrapolates to zero at 0 K (−273 °C).',
      'Pressure law: P–T is also a straight line through the origin.',
    ],
    challenge: 'Using the pressure law, find the temperature at which 1 mol in 22.4 L exerts exactly 2 atm.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0;
    const cyl = kit.cylinder(RAD, RAD, HMAX + 0.4, '#e2e8f0', { opacity: 0.12 }, 48);
    cyl.position.y = (HMAX + 0.4) / 2;
    kit.cylinder(RAD + 0.1, RAD + 0.1, 0.15, '#475569').position.y = -0.07;
    const piston = kit.cylinder(RAD * 0.98, RAD * 0.98, 0.2, '#94a3b8', { metalness: 0.5 });
    const rod = kit.cylinder(0.08, 0.08, 3, '#94a3b8');
    const box = new ParticleBox(kit, 150, 0.06);
    const gauge = kit.label('', [RAD + 1.3, 3.8, 0], { color: C.accent });
    const thermo = kit.label('', [RAD + 1.3, 2.9, 0], { color: C.hot });
    const vol = kit.label('', [RAD + 1.3, 2.0, 0], { color: C.normal });
    const flame = kit.cone(C.hot, 0.35, 0.6);
    flame.position.set(0, -0.5, 0);

    const law = () => str(p, 'law') as Law;
    function state() {
      const nm = num(p, 'nmol');
      if (law() === 'boyle') { const T = num(p, 'Tb'), V = num(p, 'V') / 1000; return { T, V, P: (nm * R * T) / V }; }
      if (law() === 'charles') { const T = num(p, 'T'), P = num(p, 'P') * atm; return { T, V: (nm * R * T) / P, P }; }
      const T = num(p, 'T'), V = num(p, 'V') / 1000; return { T, V, P: (nm * R * T) / V };
    }
    const hOf = (V: number) => Math.min(HMAX, (V * 1000 / VMAX) * HMAX);

    function build() {
      const s = state();
      const G = graphs.get('law');
      const nm = num(p, 'nmol');
      const spec = G.spec as { x: string; y: string; title: string };
      if (law() === 'boyle') {
        spec.title = 'Boyle’s law: P vs V (isotherm)'; spec.x = 'V (L)'; spec.y = 'P (atm)';
        G.plot(0, 5, 50, (VL) => (nm * R * s.T) / (VL / 1000) / atm, 150);
        G.setMarkers([{ x: s.V * 1000, y: s.P / atm, label: `PV = ${n((s.P * s.V))} J`, color: C.accent }]);
      } else if (law() === 'charles') {
        spec.title = 'Charles’s law: V vs T (isobar)'; spec.x = 'T (K)'; spec.y = 'V (L)';
        G.plot(0, 0, 600, (T) => ((nm * R * T) / s.P) * 1000, 2);
        G.setMarkers([{ x: s.T, y: s.V * 1000, label: `V/T = ${n((s.V * 1000) / s.T)} L/K`, color: C.accent }]);
      } else {
        spec.title = 'Pressure law: P vs T (isochore)'; spec.x = 'T (K)'; spec.y = 'P (atm)';
        G.plot(0, 0, 600, (T) => (nm * R * T) / s.V / atm, 2);
        G.setMarkers([{ x: s.T, y: s.P / atm, label: `P/T = ${n(s.P / atm / s.T)} atm/K`, color: C.accent }]);
      }
      const count = Math.round(40 + 60 * (nm / 2));
      if (box.count !== count) { box.seed(5); box.fill(count, 1); }
    }
    build();

    return {
      setParams(np) { p = np; build(); },
      reset() { t = 0; },
      step(dt) {
        t += dt;
        const s = state();
        const h = hOf(s.V);
        box.setHalf(RAD * 0.8, h / 2 - 0.08, RAD * 0.55);
        // molecular speed ∝ √T (display units)
        const target = Math.sqrt(s.T / 300) * 1.6;
        const cur = Math.sqrt(box.meanSquareSpeed() / 3) || 1;
        box.scaleSpeeds(1 + (target / cur - 1) * 0.1);
        box.step(dt);
      },
      render() {
        const s = state();
        const h = hOf(s.V);
        piston.position.y = h + 0.1;
        rod.position.y = h + 1.6;
        box.mesh.position.y = h / 2;
        box.render(1, 1.6);
        gauge.setText(`P = ${n(s.P / atm)} atm`);
        thermo.setText(`T = ${n(s.T)} K (${n(s.T - 273.15)} °C)`);
        vol.setText(`V = ${n(s.V * 1000)} L`);
        flame.scale.setScalar(Math.max(0.2, (s.T - 100) / 400));
      },
      time: () => t,
      readouts(): Readout[] {
        const s = state();
        return [
          { label: 'Pressure P', value: s.P / atm, unit: 'atm', tone: law() !== 'charles' ? 'accent' : 'default' },
          { label: 'Volume V', value: s.V * 1000, unit: 'L', tone: law() === 'charles' ? 'accent' : 'default' },
          { label: 'Temperature T', value: s.T, unit: 'K' },
          { label: 'PV', value: s.P * s.V, unit: 'J' },
          { label: 'V / T', value: (s.V * 1000) / s.T, unit: 'L/K' },
          { label: 'P / T', value: s.P / s.T, unit: 'Pa/K' },
          { label: 'PV / nT (= R)', value: (s.P * s.V) / (num(p, 'nmol') * s.T), unit: 'J/(mol·K)' },
        ];
      },
      equations(): Equation[] {
        const s = state();
        const eq: Record<Law, Equation> = {
          boyle: { expr: 'P₁V₁ = P₂V₂  (T constant)', sub: `PV = ${n(s.P * s.V)} J` },
          charles: { expr: 'V₁/T₁ = V₂/T₂  (P constant)', sub: `V/T = ${n((s.V * 1000) / s.T)} L/K` },
          pressure: { expr: 'P₁/T₁ = P₂/T₂  (V constant)', sub: `P/T = ${n(s.P / s.T)} Pa/K` },
        };
        return [eq[law()], { expr: 'PV = nRT', sub: `${n(s.P)} × ${n(s.V)} = ${n(num(p, 'nmol'))} × 8.314 × ${n(s.T)}` }, { expr: 'T(K) = θ(°C) + 273.15' }];
      },
    };
  },
};

export default sim;
