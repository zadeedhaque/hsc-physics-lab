import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { carnotEfficiency } from '../../physics/thermo';
import { R } from '../../physics/constants';
import { C } from '../../engine/colors';
import { n } from '../shared';

const GAMMA = 1.4;
const STAGES = ['1 → 2  Isothermal expansion at T₁ (absorbs Q₁)', '2 → 3  Adiabatic expansion (cools to T₂)', '3 → 4  Isothermal compression at T₂ (rejects Q₂)', '4 → 1  Adiabatic compression (heats to T₁)'];

const sim: SimDefinition = {
  camera: { position: [0, 3, 11], target: [0, 1.6, 0], aspect: 1.6 },
  hint: 'Arrow widths are proportional to energy per cycle: Q₁ in from the hot reservoir = W out + Q₂ to the cold reservoir.',
  params: [
    { kind: 'select', key: 'engine', label: 'Engine', default: 'carnot', options: [{ value: 'carnot', label: 'Ideal Carnot' }, { value: 'real', label: 'Real engine' }] },
    { kind: 'slider', key: 'Th', label: 'Source temperature T₁', unit: 'K', min: 300, max: 1500, step: 10, default: 600 },
    { kind: 'slider', key: 'Tc', label: 'Sink temperature T₂', unit: 'K', min: 200, max: 500, step: 5, default: 300 },
    { kind: 'slider', key: 'ratio', label: 'Isothermal expansion ratio V₂/V₁', min: 1.2, max: 4, step: 0.1, default: 2 },
    { kind: 'slider', key: 'frac', label: 'Real efficiency as % of Carnot', unit: '%', min: 10, max: 95, step: 1, default: 60, showIf: (p) => p.engine === 'real' },
  ],
  presets: [
    { label: 'Steam engine', values: { Th: 450, Tc: 300 } },
    { label: 'Car engine', values: { Th: 900, Tc: 350, engine: 'real', frac: 55 } },
    { label: 'Power station', values: { Th: 820, Tc: 300, engine: 'real', frac: 70 } },
    { label: 'Small ΔT', values: { Th: 330, Tc: 300 } },
  ],
  graphs: [
    { id: 'PV', title: 'Carnot cycle on a P–V diagram (1 mol)', x: 'V (L)', y: 'P (kPa)', kind: 'curve', zeroY: true, series: [{ label: 'cycle', color: C.accent }] },
    { id: 'eta', title: 'Maximum efficiency vs source temperature', x: 'T₁ (K)', y: 'η (%)', kind: 'curve', xRange: [300, 1500], zeroY: true, series: [{ label: 'η = 1 − T₂/T₁', color: C.normal }] },
  ],
  learn: {
    concept: 'A heat engine takes heat Q₁ from a hot source, converts part of it into work W, and rejects the rest Q₂ to a cold sink. The Carnot cycle — two isothermals and two adiabatics — is the most efficient possible engine between two temperatures: η = 1 − T₂/T₁. No real engine can reach it (second law).',
    variables: [['T₁, T₂', 'source and sink temperatures (K)'], ['Q₁, Q₂', 'heat absorbed and rejected per cycle (J)'], ['W', 'work per cycle = Q₁ − Q₂ (J)'], ['η', 'efficiency W/Q₁']],
    observe: [
      'The enclosed area on the P–V diagram is the work done per cycle.',
      'Efficiency depends only on the temperatures, not on the working gas.',
      'Even an ideal engine must reject heat unless T₂ = 0 K.',
      'Real engines reach only a fraction of the Carnot limit.',
    ],
    challenge: 'A power station boils water at 820 K and cools it with a river at 300 K. What is the best possible efficiency? If it produces 500 MW of work, how much heat reaches the river?',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0;
    const hot = kit.box(3, 0.8, 2, C.hot, { emissive: 0.5 });
    hot.position.set(0, 4.2, 0);
    const cold = kit.box(3, 0.8, 2, C.cold, { emissive: 0.4 });
    cold.position.set(0, -0.6, 0);
    const engine = kit.cylinder(0.9, 0.9, 1.6, '#64748b', { metalness: 0.5 });
    engine.position.set(0, 1.8, 0);
    const wheel = kit.torus(0.6, 0.08, '#94a3b8');
    wheel.position.set(2.6, 1.8, 0);
    const q1 = kit.arrow(C.hot, { label: 'Q₁' });
    const q2 = kit.arrow(C.cold, { label: 'Q₂' });
    const w = kit.arrow(C.force, { label: 'W' });
    const stage = kit.label('', [0, 5.2, 0]);
    kit.label('Source T₁', [-2.4, 4.2, 0], { color: C.hot, small: true });
    kit.label('Sink T₂', [-2.4, -0.6, 0], { color: C.cold, small: true });
    const piston = kit.cylinder(0.85, 0.85, 0.1, '#e2e8f0');

    const Th = () => Math.max(num(p, 'Th'), num(p, 'Tc') + 1);
    const eta = () => carnotEfficiency(Th(), num(p, 'Tc')) * (str(p, 'engine') === 'real' ? num(p, 'frac') / 100 : 1);
    const Q1 = () => R * Th() * Math.log(num(p, 'ratio')); // J per cycle for 1 mol
    function corners() {
      const V1 = 0.01, V2 = V1 * num(p, 'ratio');
      const k = (Th() / num(p, 'Tc')) ** (1 / (GAMMA - 1));
      return { V1, V2, V3: V2 * k, V4: V1 * k };
    }
    function cycleCurve() {
      const c = corners();
      const pts: [number, number][] = [];
      const iso = (T: number, a: number, b: number) => { for (let i = 0; i <= 40; i++) { const V = a + ((b - a) * i) / 40; pts.push([V, (R * T) / V]); } };
      const adi = (a: number, b: number, P0: number) => { for (let i = 0; i <= 40; i++) { const V = a + ((b - a) * i) / 40; pts.push([V, P0 * (a / V) ** GAMMA]); } };
      iso(Th(), c.V1, c.V2);
      adi(c.V2, c.V3, (R * Th()) / c.V2);
      iso(num(p, 'Tc'), c.V3, c.V4);
      adi(c.V4, c.V1, (R * num(p, 'Tc')) / c.V4);
      return pts;
    }
    function build() {
      const pts = cycleCurve();
      graphs.get('PV').setSeries(0, pts.map(([V]) => V * 1000), pts.map(([, P]) => P / 1000));
      graphs.get('eta').plot(0, 300, 1500, (T) => carnotEfficiency(T, num(p, 'Tc')) * 100, 200);
      graphs.get('eta').setMarkers([{ x: Th(), y: eta() * 100, label: str(p, 'engine') === 'real' ? 'real' : 'Carnot', color: C.normal }]);
    }
    build();

    return {
      setParams(np) { p = np; build(); },
      reset() { t = 0; },
      step(dt) { t += dt; },
      render() {
        const q1v = Q1(), W = eta() * q1v, q2v = q1v - W;
        const sc = 1.2 / q1v;
        q1.set([0, 3.8, 0], [0, -q1v * sc, 0], `Q₁ = ${n(q1v)} J`);
        q2.set([0, 1.0, 0], [0, -Math.max(q2v * sc, 0.05), 0], `Q₂ = ${n(q2v)} J`);
        w.set([0.9, 1.8, 0], [Math.max(W * sc * 1.5, 0.05), 0, 0], `W = ${n(W)} J`);
        const phase = (t / 4) % 1;
        const st = Math.floor(phase * 4);
        stage.setText(STAGES[st]);
        const c = corners();
        const Vs = [c.V1, c.V2, c.V3, c.V4, c.V1];
        const f = phase * 4 - st;
        const V = Vs[st] + (Vs[st + 1] - Vs[st]) * f;
        piston.position.set(0, 1.0 + 1.5 * ((V - c.V1) / (c.V3 - c.V1)), 0);
        wheel.rotation.z = -t * 2;
        const pts = cycleCurve();
        const idx = Math.min(pts.length - 1, Math.floor(phase * pts.length));
        graphs.get('PV').setMarkers([{ x: pts[idx][0] * 1000, y: pts[idx][1] / 1000, color: C.weight }]);
      },
      time: () => t,
      readouts(): Readout[] {
        const q1v = Q1(), W = eta() * q1v;
        return [
          { label: 'Carnot efficiency 1 − T₂/T₁', value: carnotEfficiency(Th(), num(p, 'Tc')) * 100, unit: '%', tone: 'accent' },
          { label: 'Actual efficiency', value: eta() * 100, unit: '%', tone: 'accent' },
          { label: 'Heat absorbed Q₁ per cycle', value: q1v, unit: 'J' },
          { label: 'Work W per cycle', value: W, unit: 'J' },
          { label: 'Heat rejected Q₂', value: q1v - W, unit: 'J' },
          { label: 'Q₂ / Q₁', value: (q1v - W) / q1v },
        ];
      },
      equations(): Equation[] {
        return [
          { expr: 'η = W / Q₁ = 1 − Q₂ / Q₁' },
          { expr: 'Carnot: η = 1 − T₂ / T₁', sub: `= 1 − ${n(num(p, 'Tc'))} / ${n(Th())} = ${n(carnotEfficiency(Th(), num(p, 'Tc')) * 100)} %` },
          { expr: 'Q₁ = nRT₁ ln(V₂/V₁)', sub: `= 8.314 × ${n(Th())} × ln ${n(num(p, 'ratio'))} = ${n(Q1())} J` },
          { expr: 'Q₂ / Q₁ = T₂ / T₁  (reversible cycle)' },
        ];
      },
    };
  },
};

export default sim;
