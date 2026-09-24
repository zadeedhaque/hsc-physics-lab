import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { bool, str } from '../types';
import { gate, type Gate } from '../../physics/electronics';
import { sampler } from '../shared';

const HIGH = '#4ade80', LOW = '#475569';
type V3 = [number, number, number];

const INFO: Record<Gate, { expr: string; words: string; ic: string }> = {
  AND: { expr: 'Y = A · B', words: 'Output is 1 only when both inputs are 1.', ic: '7408' },
  OR: { expr: 'Y = A + B', words: 'Output is 1 when at least one input is 1.', ic: '7432' },
  NOT: { expr: 'Y = Ā', words: 'Output is the opposite of the input.', ic: '7404' },
  NAND: { expr: 'Y = (A · B)‾', words: 'NOT-AND: 0 only when both inputs are 1. A universal gate.', ic: '7400' },
  NOR: { expr: 'Y = (A + B)‾', words: 'NOT-OR: 1 only when both inputs are 0. A universal gate.', ic: '7402' },
  XOR: { expr: 'Y = A ⊕ B = A·B̄ + Ā·B', words: 'Exclusive OR: 1 when the inputs differ.', ic: '7486' },
  XNOR: { expr: 'Y = (A ⊕ B)‾', words: 'Equality gate: 1 when the inputs are the same.', ic: '74266' },
};

/** Outline of each gate symbol in the x–y plane (body spans x ∈ [−1.2, 1.2]). */
function outline(g: Gate): { body: V3[][]; bubble: boolean } {
  const arc = (cx: number, cy: number, r: number, a0: number, a1: number, k = 24): V3[] => Array.from({ length: k + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / k; return [cx + r * Math.cos(a), cy + r * Math.sin(a), 0]; });
  const bez = (p0: number[], c: number[], p1: number[], k = 24): V3[] => Array.from({ length: k + 1 }, (_, i) => { const t = i / k, u = 1 - t; return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1], 0]; });
  const and: V3[] = [[-1.2, -1, 0], [-1.2, 1, 0], [0, 1, 0], ...arc(0, 0, 1, Math.PI / 2, -Math.PI / 2), [-1.2, -1, 0]];
  const orBack = bez([-1.2, 1], [-0.6, 0], [-1.2, -1]);
  const or: V3[] = [...bez([-1.2, 1], [0.4, 1], [1.2, 0]), ...bez([1.2, 0], [0.4, -1], [-1.2, -1]), ...orBack.slice().reverse()];
  const xorExtra = bez([-1.5, 1], [-0.9, 0], [-1.5, -1]);
  const not: V3[] = [[-1.2, -1, 0], [-1.2, 1, 0], [0.9, 0, 0], [-1.2, -1, 0]];
  switch (g) {
    case 'AND': return { body: [and], bubble: false };
    case 'NAND': return { body: [and], bubble: true };
    case 'OR': return { body: [or], bubble: false };
    case 'NOR': return { body: [or], bubble: true };
    case 'XOR': return { body: [or, xorExtra], bubble: false };
    case 'XNOR': return { body: [or, xorExtra], bubble: true };
    case 'NOT': return { body: [not], bubble: true };
  }
}

const sim: SimDefinition = {
  camera: { position: [0, 0.5, 11], target: [0, 0, 0], aspect: 1.6 },
  hint: 'Click the input switches in the scene (or use the panel). Green = logic 1 (high), grey = logic 0 (low).',
  params: [
    { kind: 'select', key: 'gate', label: 'Gate', default: 'AND', options: (Object.keys(INFO) as Gate[]).map((g) => ({ value: g, label: g })) },
    { kind: 'toggle', key: 'A', label: 'Input A', default: true },
    { kind: 'toggle', key: 'B', label: 'Input B', default: false, showIf: (p) => p.gate !== 'NOT' },
    { kind: 'toggle', key: 'auto', label: 'Clock the inputs automatically (timing diagram)', default: false },
  ],
  presets: [
    { label: 'AND, both high', values: { gate: 'AND', A: true, B: true, auto: false } },
    { label: 'NAND timing diagram', values: { gate: 'NAND', auto: true } },
    { label: 'XOR timing diagram', values: { gate: 'XOR', auto: true } },
    { label: 'NOT gate', values: { gate: 'NOT', A: false, auto: false } },
  ],
  graphs: [
    { id: 'T', title: 'Timing diagram', x: 't (s)', y: 'Y (0–1)   B (2–3)   A (4–5)', window: 12, yRange: [-0.3, 5.3], series: [{ label: 'A', color: '#60a5fa' }, { label: 'B', color: '#f472b6' }, { label: 'Y', color: HIGH }] },
  ],
  learn: {
    concept: 'Digital circuits use two voltage levels: high (1) and low (0). A logic gate produces an output that is a Boolean function of its inputs. AND gives 1 only if all inputs are 1; OR gives 1 if any input is 1; NOT inverts. NAND and NOR are “universal”: any other gate can be built from them alone. A truth table lists the output for every combination of inputs.',
    variables: [['A, B', 'inputs (0 or 1)'], ['Y', 'output'], ['·', 'AND'], ['+', 'OR'], ['‾', 'NOT (complement)'], ['⊕', 'XOR']],
    observe: [
      'NAND is AND followed by NOT: its truth-table column is the exact opposite of AND’s.',
      'XOR is 1 when the inputs differ — this is how computers add binary digits.',
      'With the clock on, A switches twice as fast as B, so all four input combinations appear.',
    ],
    challenge: 'Show how to make a NOT gate from a single NAND gate. What must you do with its two inputs?',
  },

  create({ kit, graphs, params, setParam }) {
    let p: Params = params;
    let t = 0;
    const sample = sampler(1 / 20);
    const board = kit.box(12, 6.5, 0.2, '#0f172a');
    board.position.z = -0.2;
    const gateLines = kit.add(new THREE.Group());
    const bubble = kit.torus(0.16, 0.04, '#e2e8f0');
    const gateLabel = kit.label('', [0, -1.6, 0], { small: true });
    const wA = kit.line(LOW, [], { width: 5 }), wB = kit.line(LOW, [], { width: 5 }), wY = kit.line(LOW, [], { width: 5 });

    function lever(y: number, name: string) {
      const g = kit.add(new THREE.Group());
      g.position.set(-4.6, y, 0);
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.4), kit.mat('#334155'));
      const stick = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.8, 0.14), kit.mat('#e2e8f0'));
      stick.geometry.translate(0, 0.4, 0);
      stick.position.z = 0.2;
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshStandardMaterial({ color: LOW, emissive: LOW, emissiveIntensity: 0.2 }));
      led.position.set(0.8, 0, 0.1);
      g.add(base, stick, led);
      kit.label(name, [-5.5, y, 0]);
      const state = kit.label('', [-4.6, y - 0.8, 0], { small: true });
      return { g, stick, led, state };
    }
    const swA = lever(1.2, 'A');
    const swB = lever(-1.2, 'B');
    const outLed = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 16), new THREE.MeshStandardMaterial({ color: LOW, emissive: LOW, emissiveIntensity: 0.2, transparent: true, opacity: 0.9 }));
    outLed.position.set(4.7, 0, 0.1);
    kit.add(outLed);
    kit.label('Y', [5.6, 0, 0]);
    const yState = kit.label('', [4.7, -0.9, 0], { small: true });
    // clicking a switch flips the input it is currently showing (and stops the clock)
    kit.pickable(swA.g, () => { const a = inA(), b = inB(); setParam?.('auto', false); setParam?.('B', b); setParam?.('A', !a); });
    kit.pickable(swB.g, () => { if (g() === 'NOT') return; const a = inA(), b = inB(); setParam?.('auto', false); setParam?.('A', a); setParam?.('B', !b); });

    const g = () => (str(p, 'gate') as Gate) in INFO ? (str(p, 'gate') as Gate) : 'AND';
    const inA = () => (bool(p, 'auto') ? Math.floor(t) % 2 === 1 : bool(p, 'A'));
    const inB = () => (bool(p, 'auto') ? Math.floor(t / 2) % 2 === 1 : bool(p, 'B'));
    const out = () => gate(g(), inA(), inB());

    function build() {
      kit.clearGroup(gateLines);
      const o = outline(g());
      for (const line of o.body) gateLines.add(kit.line('#e2e8f0', line, { width: 3 }));
      const tipX = g() === 'NOT' ? 0.9 : 1.2;
      bubble.visible = o.bubble;
      bubble.position.set(tipX + 0.16, 0, 0);
      const back = g() === 'OR' || g() === 'NOR' ? -0.97 : g() === 'XOR' || g() === 'XNOR' ? -1.27 : -1.2; // where y = ±0.5 meets the back edge
      const not = g() === 'NOT';
      wA.setPoints([[-3.8, 1.2, 0], [-2.2, 1.2, 0], [-2.2, not ? 0 : 0.5, 0], [back, not ? 0 : 0.5, 0]]);
      wB.setPoints([[-3.8, -1.2, 0], [-2.2, -1.2, 0], [-2.2, -0.5, 0], [back, -0.5, 0]]);
      wB.visible = !not; swB.g.visible = !not;
      wY.setPoints([[tipX + (o.bubble ? 0.32 : 0), 0, 0], [4.25, 0, 0]]);
      gateLabel.setText(`${g()} gate (IC ${INFO[g()].ic})`);
    }
    build();

    const paint = (m: THREE.Mesh, on: boolean) => {
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.color.set(on ? HIGH : LOW); mat.emissive.set(on ? HIGH : LOW); mat.emissiveIntensity = on ? 1.2 : 0.15;
    };

    return {
      setParams(np) { p = np; build(); },
      reset() { t = 0; sample.reset(); },
      step(dt) {
        t += dt;
        if (sample.due(t)) graphs.get('T').push(t, (inA() ? 1 : 0) + 4, g() === 'NOT' ? NaN : (inB() ? 1 : 0) + 2, out() ? 1 : 0);
      },
      render() {
        const a = inA(), b = inB(), y = out();
        swA.stick.rotation.z = a ? -0.5 : 0.5; swB.stick.rotation.z = b ? -0.5 : 0.5;
        paint(swA.led, a); paint(swB.led, b); paint(outLed, y);
        wA.setColor(a ? HIGH : LOW); wB.setColor(b ? HIGH : LOW); wY.setColor(y ? HIGH : LOW);
        swA.state.setText(a ? '1 (high)' : '0 (low)');
        swB.state.setText(g() === 'NOT' ? '' : b ? '1 (high)' : '0 (low)');
        yState.setText(y ? '1 — LED on' : '0 — LED off');
      },
      time: () => t,
      readouts(): Readout[] {
        const a = inA(), b = inB();
        const rows: Readout[] = g() === 'NOT'
          ? [false, true].map((x) => ({ label: `A = ${x ? 1 : 0}`, value: `Y = ${gate('NOT', x, false) ? 1 : 0}`, tone: x === a ? 'accent' : undefined }))
          : [[false, false], [false, true], [true, false], [true, true]].map(([x, z]) => ({ label: `A = ${x ? 1 : 0}, B = ${z ? 1 : 0}`, value: `Y = ${gate(g(), x, z) ? 1 : 0}`, tone: x === a && z === b ? 'accent' : undefined }));
        return [
          { label: 'Output Y', value: out() ? '1 (high)' : '0 (low)', tone: out() ? 'good' : undefined },
          ...rows,
        ];
      },
      equations(): Equation[] {
        const a = inA() ? 1 : 0, b = inB() ? 1 : 0;
        return [
          { expr: INFO[g()].expr, sub: g() === 'NOT' ? `A = ${a} → Y = ${out() ? 1 : 0}` : `A = ${a}, B = ${b} → Y = ${out() ? 1 : 0}`, note: INFO[g()].words },
        ];
      },
    };
  },
};

export default sim;
