import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { bool, num, str } from '../types';
import { solveCircuit, type Element } from '../../physics/electricity';
import { C } from '../../engine/colors';
import { n, sampler } from '../shared';
import { CurrentPath, battery, dotSpeed, glow, meter, resistor, wire, type P2 } from '../circuitKit';

type Topology = 'single' | 'series' | 'parallel' | 'mixed';

interface Layout {
  nodes: number;
  elements: (E: number, R: number[]) => Element[];
  wires: P2[][];
  /** current paths with a function picking the current (A) flowing along the path direction */
  paths: { path: P2[]; I: (cur: Record<string, number>) => number }[];
  resistors: { id: string; at: P2; dir: 'x' | 'y' }[];
  battery: { at: P2; dir: 'x' | 'y' };
  ammeter: P2;
  used: number; // number of resistors used
}

const LAYOUTS: Record<Topology, Layout> = {
  single: {
    nodes: 2, used: 1,
    elements: (E, R) => [{ kind: 'V', id: 'E', neg: 0, pos: 1, V: E }, { kind: 'R', id: 'R1', a: 1, b: 0, R: R[0] }],
    wires: [[[-5, 0.7], [-5, 2.5], [5, 2.5], [5, -2.5], [-5, -2.5], [-5, -0.7]]],
    paths: [{ path: [[-5, -2.5], [-5, 2.5], [5, 2.5], [5, -2.5], [-5, -2.5]], I: (c) => c.E }],
    resistors: [{ id: 'R1', at: [5, 0], dir: 'y' }],
    battery: { at: [-5, 0], dir: 'y' }, ammeter: [-2, 2.5],
  },
  series: {
    nodes: 4, used: 3,
    elements: (E, R) => [
      { kind: 'V', id: 'E', neg: 0, pos: 1, V: E }, { kind: 'R', id: 'R1', a: 1, b: 2, R: R[0] },
      { kind: 'R', id: 'R2', a: 2, b: 3, R: R[1] }, { kind: 'R', id: 'R3', a: 3, b: 0, R: R[2] },
    ],
    wires: [[[-5, 0.7], [-5, 2.5], [5, 2.5], [5, -2.5], [-5, -2.5], [-5, -0.7]]],
    paths: [{ path: [[-5, -2.5], [-5, 2.5], [5, 2.5], [5, -2.5], [-5, -2.5]], I: (c) => c.E }],
    resistors: [{ id: 'R1', at: [0.5, 2.5], dir: 'x' }, { id: 'R2', at: [5, 0], dir: 'y' }, { id: 'R3', at: [0.5, -2.5], dir: 'x' }],
    battery: { at: [-5, 0], dir: 'y' }, ammeter: [-2.5, 2.5],
  },
  parallel: {
    nodes: 2, used: 3,
    elements: (E, R) => [
      { kind: 'V', id: 'E', neg: 0, pos: 1, V: E }, { kind: 'R', id: 'R1', a: 1, b: 0, R: R[0] },
      { kind: 'R', id: 'R2', a: 1, b: 0, R: R[1] }, { kind: 'R', id: 'R3', a: 1, b: 0, R: R[2] },
    ],
    wires: [[[-5, 0.7], [-5, 2.5], [5, 2.5], [5, -2.5], [-5, -2.5], [-5, -0.7]], [[0, 2.5], [0, -2.5]], [[2.5, 2.5], [2.5, -2.5]]],
    paths: [
      { path: [[0, -2.5], [-5, -2.5], [-5, 2.5], [0, 2.5]], I: (c) => c.E },
      { path: [[0, 2.5], [2.5, 2.5]], I: (c) => c.R2 + c.R3 }, { path: [[2.5, -2.5], [0, -2.5]], I: (c) => c.R2 + c.R3 },
      { path: [[2.5, 2.5], [5, 2.5]], I: (c) => c.R3 }, { path: [[5, -2.5], [2.5, -2.5]], I: (c) => c.R3 },
      { path: [[0, 2.5], [0, -2.5]], I: (c) => c.R1 }, { path: [[2.5, 2.5], [2.5, -2.5]], I: (c) => c.R2 }, { path: [[5, 2.5], [5, -2.5]], I: (c) => c.R3 },
    ],
    resistors: [{ id: 'R1', at: [0, 0], dir: 'y' }, { id: 'R2', at: [2.5, 0], dir: 'y' }, { id: 'R3', at: [5, 0], dir: 'y' }],
    battery: { at: [-5, 0], dir: 'y' }, ammeter: [-2.5, 2.5],
  },
  mixed: {
    nodes: 3, used: 3,
    elements: (E, R) => [
      { kind: 'V', id: 'E', neg: 0, pos: 1, V: E }, { kind: 'R', id: 'R1', a: 1, b: 2, R: R[0] },
      { kind: 'R', id: 'R2', a: 2, b: 0, R: R[1] }, { kind: 'R', id: 'R3', a: 2, b: 0, R: R[2] },
    ],
    wires: [[[-5, 0.7], [-5, 2.5], [5, 2.5], [5, -2.5], [-5, -2.5], [-5, -0.7]], [[1.5, 2.5], [1.5, -2.5]]],
    paths: [
      { path: [[1.5, -2.5], [-5, -2.5], [-5, 2.5], [1.5, 2.5]], I: (c) => c.E },
      { path: [[1.5, 2.5], [5, 2.5], [5, -2.5], [1.5, -2.5]], I: (c) => c.R3 },
      { path: [[1.5, 2.5], [1.5, -2.5]], I: (c) => c.R2 },
    ],
    resistors: [{ id: 'R1', at: [-2, 2.5], dir: 'x' }, { id: 'R2', at: [1.5, 0], dir: 'y' }, { id: 'R3', at: [5, 0], dir: 'y' }],
    battery: { at: [-5, 0], dir: 'y' }, ammeter: [-3.5, -2.5],
  },
};

const sub = (i: number) => '₁₂₃'[i];

const sim: SimDefinition = {
  camera: { position: [0, -1.5, 13.5], target: [0, 0, 0], aspect: 1.5 },
  hint: 'Yellow dots show conventional current (+ to −); their speed is proportional to the current, and resistors glow with power.',
  params: [
    { kind: 'select', key: 'topology', label: 'Circuit', default: 'series', options: [
      { value: 'single', label: 'Single R' }, { value: 'series', label: 'Series' }, { value: 'parallel', label: 'Parallel' }, { value: 'mixed', label: 'Mixed' },
    ] },
    { kind: 'slider', key: 'E', label: 'Battery EMF', unit: 'V', min: 0, max: 24, step: 0.5, default: 12 },
    { kind: 'slider', key: 'R1', label: 'Resistance R₁', unit: 'Ω', min: 1, max: 100, step: 1, default: 10 },
    { kind: 'slider', key: 'R2', label: 'Resistance R₂', unit: 'Ω', min: 1, max: 100, step: 1, default: 20, showIf: (p) => p.topology !== 'single' },
    { kind: 'slider', key: 'R3', label: 'Resistance R₃', unit: 'Ω', min: 1, max: 100, step: 1, default: 30, showIf: (p) => p.topology !== 'single' },
    { kind: 'toggle', key: 'power', label: 'Show power on labels', default: false },
  ],
  presets: [
    { label: 'Series', values: { topology: 'series', E: 12, R1: 10, R2: 20, R3: 30 } },
    { label: 'Parallel', values: { topology: 'parallel', E: 12, R1: 10, R2: 20, R3: 30 } },
    { label: 'Mixed', values: { topology: 'mixed', E: 12, R1: 10, R2: 20, R3: 30 } },
    { label: 'Equal parallel', values: { topology: 'parallel', E: 6, R1: 30, R2: 30, R3: 30 } },
  ],
  graphs: [
    { id: 'iv', title: 'I–V characteristic of the whole circuit', x: 'V (V)', y: 'I (A)', kind: 'curve', xRange: [0, 24], series: [{ label: 'I = V / R_eq', color: C.current }] },
    { id: 'energy', title: 'Electrical energy supplied vs time', x: 't (s)', y: 'W (J)', zeroY: true, series: [{ label: 'W = VIt', color: C.hot }] },
  ],
  learn: {
    concept: 'Current is the rate of flow of charge. Ohm’s law says the current through a conductor is proportional to the potential difference across it, V = IR. In series the same current flows through every resistor and voltages add; in parallel every branch has the same voltage and currents add.',
    variables: [['V', 'potential difference (V)'], ['I', 'current (A)'], ['R', 'resistance (Ω)'], ['R_eq', 'equivalent resistance (Ω)'], ['P', 'power = VI = I²R (W)'], ['W', 'energy = VIt (J)']],
    observe: [
      'In series, the dots move at the same speed everywhere — the current is the same.',
      'In parallel, the smallest resistor carries the largest current and glows brightest.',
      'Adding a parallel branch lowers R_eq and increases the battery current.',
      'The energy graph is a straight line: constant power means energy grows linearly with time.',
    ],
    challenge: 'Using the series circuit with E = 12 V, choose R₁, R₂, R₃ so that exactly 6 V appears across R₂.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0, energy = 0;
    const sample = sampler(1 / 10);
    const board = kit.box(12.4, 7.4, 0.2, '#0b1220', { roughness: 0.95 });
    board.position.z = -0.25;
    const g = kit.add(new THREE.Group());
    let paths: { cp: CurrentPath; I: (c: Record<string, number>) => number }[] = [];
    let res: { id: string; mat: THREE.MeshStandardMaterial; label: ReturnType<typeof resistor>['label'] }[] = [];
    let ammeterReading: ReturnType<typeof meter> | null = null;
    let batteryLabel: ReturnType<typeof battery>['label'] | null = null;

    const layout = () => LAYOUTS[str(p, 'topology') as Topology] ?? LAYOUTS.series;
    const Rs = () => [num(p, 'R1'), num(p, 'R2'), num(p, 'R3')];
    const solve = () => {
      const L = layout();
      return solveCircuit(L.nodes, L.elements(num(p, 'E'), Rs()));
    };
    const Req = () => {
      const r = Rs();
      switch (str(p, 'topology') as Topology) {
        case 'single': return r[0];
        case 'series': return r[0] + r[1] + r[2];
        case 'parallel': return 1 / (1 / r[0] + 1 / r[1] + 1 / r[2]);
        case 'mixed': return r[0] + 1 / (1 / r[1] + 1 / r[2]);
      }
      return r[0];
    };

    function build() {
      // Rebuild the scene graph for the chosen topology.
      kit.clearGroup(g);
      const before = new Set(kit.root.children);
      const L = layout();
      L.wires.forEach((w) => wire(kit, w));
      paths = L.paths.map((pp) => ({ cp: new CurrentPath(kit, pp.path), I: pp.I }));
      const b = battery(kit, L.battery.at, L.battery.dir);
      batteryLabel = b.label;
      res = L.resistors.map((r) => { const x = resistor(kit, r.at, r.dir); return { id: r.id, mat: x.mat, label: x.label }; });
      ammeterReading = meter(kit, L.ammeter, 'A');
      // Move everything created during build into the group so the next build disposes it.
      kit.root.children.filter((c) => !before.has(c)).forEach((c) => g.add(c));
      update();
    }

    function update() {
      const sol = solve();
      const cur = sol.current;
      const powers = res.map((r) => (cur[r.id] ?? 0) ** 2 * num(p, r.id));
      const Pmax = Math.max(...powers, 1e-9);
      res.forEach((r, i) => {
        const I = cur[r.id] ?? 0;
        const V = I * num(p, r.id);
        glow(r.mat, powers[i], Math.max(Pmax, 2));
        r.label.setText(`R${sub(Number(r.id[1]) - 1)} = ${num(p, r.id)} Ω · ${n(Math.abs(I))} A · ${n(Math.abs(V))} V${bool(p, 'power') ? ` · ${n(powers[i])} W` : ''}`);
      });
      ammeterReading?.setText(`I = ${n(cur.E ?? 0)} A`);
      batteryLabel?.setText(`${n(num(p, 'E'))} V`);
      const G = graphs.get('iv');
      G.plot(0, 0, 24, (v) => v / Req(), 2);
      G.setMarkers([{ x: num(p, 'E'), y: cur.E ?? 0, label: `${n(cur.E ?? 0)} A`, color: C.current }]);
    }
    build();

    return {
      setParams(np) {
        const topo = np.topology !== p.topology;
        p = np;
        if (topo) build(); else update();
      },
      reset() { t = 0; energy = 0; sample.reset(); },
      step(dt) {
        const sol = solve();
        const P = num(p, 'E') * (sol.current.E ?? 0);
        energy += P * dt;
        t += dt;
        paths.forEach((x) => x.cp.advance(dotSpeed(x.I(sol.current)) * dt));
        if (sample.due(t)) graphs.get('energy').push(t, energy);
      },
      time: () => t,
      readouts(): Readout[] {
        const sol = solve();
        const I = sol.current.E ?? 0;
        const out: Readout[] = [
          { label: 'Equivalent resistance R_eq', value: Req(), unit: 'Ω', tone: 'accent' },
          { label: 'Total current I', value: I, unit: 'A', tone: 'accent' },
          { label: 'Total power P = EI', value: num(p, 'E') * I, unit: 'W' },
          { label: 'Energy supplied so far', value: energy, unit: 'J' },
        ];
        layout().resistors.forEach((r, i) => {
          const Ir = sol.current[r.id] ?? 0;
          out.push({ label: `I${sub(i)} through R${sub(i)}`, value: Math.abs(Ir), unit: 'A' }, { label: `V${sub(i)} across R${sub(i)}`, value: Math.abs(Ir * num(p, r.id)), unit: 'V' });
        });
        return out;
      },
      equations(): Equation[] {
        const r = Rs();
        const E = num(p, 'E');
        const I = E / Req();
        const topo = str(p, 'topology') as Topology;
        const out: Equation[] = [{ expr: 'V = I R', sub: `I = ${n(E)} / ${n(Req())} = ${n(I)} A` }];
        if (topo === 'series') out.push({ expr: 'R_eq = R₁ + R₂ + R₃', sub: `R_eq = ${r[0]} + ${r[1]} + ${r[2]} = ${n(Req())} Ω` }, { expr: 'V = V₁ + V₂ + V₃', note: 'Same current in every resistor.' });
        if (topo === 'parallel') out.push({ expr: '1/R_eq = 1/R₁ + 1/R₂ + 1/R₃', sub: `R_eq = ${n(Req())} Ω` }, { expr: 'I = I₁ + I₂ + I₃', note: 'Same voltage across every branch.' });
        if (topo === 'mixed') out.push({ expr: 'R_eq = R₁ + (R₂R₃)/(R₂ + R₃)', sub: `R_eq = ${r[0]} + ${n((r[1] * r[2]) / (r[1] + r[2]))} = ${n(Req())} Ω` });
        out.push({ expr: 'P = VI = I²R = V²/R', sub: `P = ${n(E)} × ${n(I)} = ${n(E * I)} W` }, { expr: 'W = VIt', sub: `W = ${n(energy)} J after ${n(t)} s  (1 kWh = 3.6 × 10⁶ J)` });
        return out;
      },
    };
  },
};

export default sim;
