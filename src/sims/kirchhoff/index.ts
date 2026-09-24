import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num } from '../types';
import { solveCircuit, type Element } from '../../physics/electricity';
import { C } from '../../engine/colors';
import { n } from '../shared';
import { CurrentPath, battery, dotSpeed, glow, meter, resistor, wire } from '../circuitKit';

/*
 * Two-loop network:   E1 (left, with R1)   R3 (middle branch)   E2 (right, with R2)
 * Nodes: 0 = bottom rail, 1 = top-middle junction, 2 = E1 + terminal, 3 = E2 + terminal.
 */
const sim: SimDefinition = {
  camera: { position: [0, -1, 13], target: [0, 0, 0], aspect: 1.5 },
  hint: 'Yellow dots move in the real (conventional) current directions. At the top junction: current in = current out (KCL). Around each loop: ΣE = ΣIR (KVL).',
  params: [
    { kind: 'slider', key: 'E1', label: 'EMF E₁', unit: 'V', min: 0, max: 24, step: 0.5, default: 12 },
    { kind: 'slider', key: 'E2', label: 'EMF E₂', unit: 'V', min: 0, max: 24, step: 0.5, default: 6 },
    { kind: 'slider', key: 'R1', label: 'R₁ (left branch)', unit: 'Ω', min: 1, max: 50, step: 0.5, default: 4 },
    { kind: 'slider', key: 'R2', label: 'R₂ (right branch)', unit: 'Ω', min: 1, max: 50, step: 0.5, default: 2 },
    { kind: 'slider', key: 'R3', label: 'R₃ (middle branch)', unit: 'Ω', min: 1, max: 50, step: 0.5, default: 6 },
  ],
  presets: [
    { label: 'Textbook example', values: { E1: 12, E2: 6, R1: 4, R2: 2, R3: 6 } },
    { label: 'Equal batteries', values: { E1: 9, E2: 9, R1: 3, R2: 3, R3: 3 } },
    { label: 'Charging E₂', values: { E1: 20, E2: 6, R1: 1, R2: 2, R3: 20 } },
  ],
  graphs: [
    { id: 'I', title: 'Branch currents vs E₁ (other values fixed)', x: 'E₁ (V)', y: 'I (A)', kind: 'curve', xRange: [0, 24], series: [{ label: 'I₁ (left)', color: C.accent }, { label: 'I₂ (right)', color: C.acceleration }, { label: 'I₃ (middle)', color: C.weight }] },
  ],
  learn: {
    concept: 'Kirchhoff’s current law (junction rule): the total current entering a junction equals the total leaving it — charge is conserved. Kirchhoff’s voltage law (loop rule): around any closed loop the sum of EMFs equals the sum of the IR drops — energy is conserved. Together they solve any network.',
    variables: [['I₁, I₂, I₃', 'branch currents (A)'], ['E₁, E₂', 'EMFs (V)'], ['R', 'resistances (Ω)'], ['ΣI = 0', 'junction rule'], ['ΣE = ΣIR', 'loop rule']],
    observe: [
      'I₃ = I₁ + I₂ at every setting (junction rule).',
      'If one battery is much stronger it can drive current backwards through the weaker one — charging it.',
      'The loop equations always balance to zero in the Results.',
    ],
    challenge: 'Set E₁ = 12 V, E₂ = 6 V, R₁ = 4 Ω, R₂ = 2 Ω, R₃ = 6 Ω and solve for the three currents by hand before looking.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0;
    const board = kit.box(12.6, 7.4, 0.2, '#0b1220');
    board.position.z = -0.25;
    wire(kit, [[-5, 0.7], [-5, 2.5], [5, 2.5], [5, 0.7]]);
    wire(kit, [[-5, -0.7], [-5, -2.5], [5, -2.5], [5, -0.7]]);
    wire(kit, [[0, 2.5], [0, -2.5]]);
    const b1 = battery(kit, [-5, 0], 'y');
    const b2 = battery(kit, [5, 0], 'y');
    const r1 = resistor(kit, [-2.5, 2.5], 'x');
    const r2 = resistor(kit, [2.5, 2.5], 'x');
    const r3 = resistor(kit, [0, 0], 'y');
    const pathL = new CurrentPath(kit, [[-5, -2.5], [-5, 2.5], [0, 2.5]]);
    const pathR = new CurrentPath(kit, [[5, -2.5], [5, 2.5], [0, 2.5]]);
    const pathM = new CurrentPath(kit, [[0, 2.5], [0, -2.5]]);
    const pathB1 = new CurrentPath(kit, [[0, -2.5], [-5, -2.5]]);
    const pathB2 = new CurrentPath(kit, [[0, -2.5], [5, -2.5]]);
    const aM = meter(kit, [0, -1.6], 'A', [1.2, 0]);
    kit.label('junction', [0.6, 2.9, 0], { small: true });

    function solve(E1 = num(p, 'E1')) {
      const els: Element[] = [
        { kind: 'V', id: 'E1', neg: 0, pos: 2, V: E1 },
        { kind: 'R', id: 'R1', a: 2, b: 1, R: num(p, 'R1') },
        { kind: 'V', id: 'E2', neg: 0, pos: 3, V: num(p, 'E2') },
        { kind: 'R', id: 'R2', a: 3, b: 1, R: num(p, 'R2') },
        { kind: 'R', id: 'R3', a: 1, b: 0, R: num(p, 'R3') },
      ];
      const s = solveCircuit(4, els);
      return { I1: s.current.R1, I2: s.current.R2, I3: s.current.R3, V1: s.V[1] };
    }
    function update() {
      const s = solve();
      const Pm = Math.max(s.I1 ** 2 * num(p, 'R1'), s.I2 ** 2 * num(p, 'R2'), s.I3 ** 2 * num(p, 'R3'), 1);
      glow(r1.mat, s.I1 ** 2 * num(p, 'R1'), Pm); glow(r2.mat, s.I2 ** 2 * num(p, 'R2'), Pm); glow(r3.mat, s.I3 ** 2 * num(p, 'R3'), Pm);
      r1.label.setText(`R₁ = ${num(p, 'R1')} Ω · I₁ = ${n(s.I1)} A`);
      r2.label.setText(`R₂ = ${num(p, 'R2')} Ω · I₂ = ${n(s.I2)} A`);
      r3.label.setText(`R₃ = ${num(p, 'R3')} Ω · I₃ = ${n(s.I3)} A`);
      b1.label.setText(`E₁ = ${n(num(p, 'E1'))} V`);
      b2.label.setText(`E₂ = ${n(num(p, 'E2'))} V`);
      aM.setText(`I₃ = ${n(s.I3)} A`);
      const G = graphs.get('I');
      G.plot(0, 0, 24, (e) => solve(e).I1, 60);
      G.plot(1, 0, 24, (e) => solve(e).I2, 60);
      G.plot(2, 0, 24, (e) => solve(e).I3, 60);
      G.setMarkers([{ x: num(p, 'E1'), y: s.I3, color: C.weight }]);
    }
    update();

    return {
      setParams(np) { p = np; update(); },
      reset() { t = 0; },
      step(dt) {
        t += dt;
        const s = solve();
        pathL.advance(dotSpeed(s.I1) * dt);
        pathR.advance(dotSpeed(s.I2) * dt);
        pathM.advance(dotSpeed(s.I3) * dt);
        pathB1.advance(dotSpeed(s.I1) * dt);
        pathB2.advance(dotSpeed(s.I2) * dt);
      },
      time: () => t,
      readouts(): Readout[] {
        const s = solve();
        const loop1 = num(p, 'E1') - s.I1 * num(p, 'R1') - s.I3 * num(p, 'R3');
        const loop2 = num(p, 'E2') - s.I2 * num(p, 'R2') - s.I3 * num(p, 'R3');
        return [
          { label: 'I₁ (through E₁ and R₁)', value: s.I1, unit: 'A', tone: 'accent' },
          { label: 'I₂ (through E₂ and R₂)', value: s.I2, unit: 'A', tone: 'accent' },
          { label: 'I₃ (middle branch)', value: s.I3, unit: 'A', tone: 'accent' },
          { label: 'Junction: I₁ + I₂ − I₃', value: s.I1 + s.I2 - s.I3, unit: 'A' },
          { label: 'Loop 1: E₁ − I₁R₁ − I₃R₃', value: loop1, unit: 'V' },
          { label: 'Loop 2: E₂ − I₂R₂ − I₃R₃', value: loop2, unit: 'V' },
          { label: 'Junction potential', value: s.V1, unit: 'V' },
          { label: 'E₂ is', value: s.I2 < 0 ? 'being charged (current enters its + terminal)' : 'supplying current' },
        ];
      },
      equations(): Equation[] {
        const s = solve();
        return [
          { expr: 'Junction: I₁ + I₂ = I₃', sub: `${n(s.I1)} + ${n(s.I2)} = ${n(s.I3)}` },
          { expr: 'Loop 1: E₁ = I₁R₁ + I₃R₃', sub: `${n(num(p, 'E1'))} = ${n(s.I1 * num(p, 'R1'))} + ${n(s.I3 * num(p, 'R3'))}` },
          { expr: 'Loop 2: E₂ = I₂R₂ + I₃R₃', sub: `${n(num(p, 'E2'))} = ${n(s.I2 * num(p, 'R2'))} + ${n(s.I3 * num(p, 'R3'))}` },
        ];
      },
    };
  },
};

export default sim;
