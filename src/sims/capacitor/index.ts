import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { bool, num } from '../types';
import { parallelPlate } from '../../physics/electricity';
import { C } from '../../engine/colors';
import { n, sampler } from '../shared';

const sim: SimDefinition = {
  camera: { position: [5, 3.5, 8], target: [0, 0.5, 0], aspect: 1.5 },
  hint: 'Field lines between the plates are uniform. Inserting a dielectric raises C, so more charge is stored at the same voltage.',
  params: [
    { kind: 'slider', key: 'A', label: 'Plate area', unit: 'cm²', min: 10, max: 400, step: 5, default: 100 },
    { kind: 'slider', key: 'd', label: 'Plate separation', unit: 'mm', min: 0.5, max: 10, step: 0.1, default: 2 },
    { kind: 'slider', key: 'k', label: 'Dielectric constant κ', min: 1, max: 10, step: 0.1, default: 1 },
    { kind: 'slider', key: 'V', label: 'Battery voltage', unit: 'V', min: 0, max: 100, step: 1, default: 12 },
    { kind: 'slider', key: 'R', label: 'Charging resistance', unit: 'kΩ', min: 1, max: 1000, step: 1, default: 100 },
    { kind: 'toggle', key: 'connected', label: 'Battery connected', default: true },
  ],
  presets: [
    { label: 'Air capacitor', values: { k: 1, A: 100, d: 2 } },
    { label: 'Add dielectric (κ = 5)', values: { k: 5 } },
    { label: 'Close plates', values: { d: 0.5 } },
    { label: 'Big plates', values: { A: 400 } },
  ],
  graphs: [
    { id: 'q', title: 'Charging: charge and current vs time', x: 't (ms)', y: '', zeroY: true, series: [{ label: 'Q (nC)', color: C.accent }, { label: 'I (µA)', color: C.current }] },
  ],
  learn: {
    concept: 'A capacitor stores charge on two conductors separated by an insulator. For parallel plates C = κε₀A/d. Connected to a battery it charges to Q = CV through the circuit resistance with time constant τ = RC. The stored energy is ½CV², held in the uniform field E = V/d between the plates.',
    variables: [['C', 'capacitance (F)'], ['A', 'plate area (m²)'], ['d', 'separation (m)'], ['κ', 'dielectric constant'], ['Q', 'charge = CV (C)'], ['U', 'energy ½CV² (J)'], ['τ', 'time constant RC (s)']],
    observe: [
      'Doubling the area doubles C; doubling the gap halves it.',
      'A dielectric multiplies C by κ.',
      'Charging is fast at first and slows down: after one τ the charge is 63 %.',
      'Disconnect the battery: the charge stays on the plates.',
    ],
    challenge: 'What plate area gives 1 nF with a 1 mm air gap? Set it and check.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0, q = 0;
    const sample = sampler(1 / 30);
    const top = kit.box(1, 0.08, 1, '#cbd5e1', { metalness: 0.6 });
    const bottom = kit.box(1, 0.08, 1, '#cbd5e1', { metalness: 0.6 });
    const dielectric = kit.box(1, 1, 1, '#a78bfa', { opacity: 0.35 });
    const lines = kit.segments(C.field, { width: 1.4, opacity: 0.8 });
    const plusDots: THREE.Mesh[] = [], minusDots: THREE.Mesh[] = [];
    for (let i = 0; i < 12; i++) { plusDots.push(kit.sphere(0.05, C.positive, { emissive: 0.6 }, 8)); minusDots.push(kit.sphere(0.05, C.negative, { emissive: 0.6 }, 8)); }
    const topLabel = kit.label('', [0, 0, 0], { color: C.positive, small: true });
    const botLabel = kit.label('', [0, 0, 0], { color: C.negative, small: true });
    const wire = kit.line('#94a3b8', [], { width: 3 });
    const battery = kit.cylinder(0.25, 0.25, 0.8, '#1f2937');
    battery.position.set(-3, 0.6, 0);
    kit.label('+', [-2.7, 1.1, 0], { color: C.positive, small: true });

    const cap = () => parallelPlate(num(p, 'A') * 1e-4, num(p, 'd') * 1e-3, num(p, 'k'), num(p, 'V'));
    const tau = () => num(p, 'R') * 1e3 * cap().C;
    const side = () => Math.sqrt(num(p, 'A')) * 0.15;
    const gap = () => 0.3 + num(p, 'd') * 0.25;

    function reset() { t = 0; q = 0; sample.reset(); }

    return {
      setParams(np) { p = np; },
      reset,
      step(dt) {
        const c = cap();
        const T = Math.max(tau(), 1e-9);
        // show charging on a timescale of a few seconds: display time is scaled so 5τ ≈ 4 s
        const scale = (5 * T) / 4;
        const h = dt * scale;
        if (bool(p, 'connected')) q = c.Q + (q - c.Q) * Math.exp(-h / T);
        t += h;
        if (sample.due(t / scale)) {
          const I = bool(p, 'connected') ? (num(p, 'V') - q / c.C) / (num(p, 'R') * 1e3) : 0;
          graphs.get('q').push(t * 1000, q * 1e9, I * 1e6);
        }
      },
      render() {
        const s = side(), g = gap();
        top.scale.set(s, 1, s); bottom.scale.set(s, 1, s);
        top.position.set(0, 0.5 + g, 0); bottom.position.set(0, 0.5, 0);
        dielectric.visible = num(p, 'k') > 1.01;
        dielectric.scale.set(s * 0.98, g - 0.1, s * 0.98);
        dielectric.position.set(0, 0.5 + g / 2, 0);
        const c = cap();
        const frac = c.Q > 0 ? Math.max(0, Math.min(1, q / c.Q)) : 0;
        const nLines = Math.round(3 + 9 * frac);
        const flat: number[] = [];
        for (let i = 0; i < nLines; i++) for (let j = 0; j < 3; j++) {
          const x = -s / 2 + ((i + 0.5) / nLines) * s, z = -s / 2 + ((j + 0.5) / 3) * s;
          flat.push(x, 0.55 + g - 0.02, z, x, 0.55, z);
        }
        if (frac > 0.01) lines.setSegments(flat); else lines.visible = false;
        const cN = Math.round(12 * frac);
        plusDots.forEach((a, i) => {
          const b = minusDots[i];
          a.visible = b.visible = i < cN;
          const x = -s / 2 + ((i + 0.5) / 12) * s;
          a.position.set(x, 0.58 + g, s / 2 - 0.05);
          b.position.set(x, 0.46, s / 2 - 0.05);
        });
        topLabel.at([s / 2 + 0.6, 0.6 + g, 0]).setText(`+${n(q * 1e9)} nC`);
        botLabel.at([s / 2 + 0.6, 0.45, 0]).setText(`−${n(q * 1e9)} nC`);
        wire.visible = bool(p, 'connected');
        wire.setPoints([[-3, 1.0, 0], [-3, 0.5 + g + 0.4, 0], [0, 0.5 + g + 0.4, 0], [0, 0.5 + g, 0], [0, 0.5 + g + 0.4, 0], [-3, 0.5 + g + 0.4, 0], [-3, 1.0, 0]]);
      },
      time: () => t,
      readouts(): Readout[] {
        const c = cap();
        const Vnow = q / c.C;
        return [
          { label: 'Capacitance C', value: c.C * 1e12, unit: 'pF', tone: 'accent' },
          { label: 'Final charge Q = CV', value: c.Q * 1e9, unit: 'nC' },
          { label: 'Charge now', value: q * 1e9, unit: 'nC', tone: 'accent' },
          { label: 'Voltage across plates', value: Vnow, unit: 'V' },
          { label: 'Field between plates E = V/d', value: Vnow / (num(p, 'd') * 1e-3), unit: 'V/m' },
          { label: 'Stored energy ½CV²', value: 0.5 * c.C * Vnow * Vnow * 1e9, unit: 'nJ' },
          { label: 'Time constant τ = RC', value: tau() * 1e6, unit: 'µs' },
          { label: 'Surface charge density σ', value: q / (num(p, 'A') * 1e-4), unit: 'C/m²' },
        ];
      },
      equations(): Equation[] {
        const c = cap();
        return [
          { expr: 'C = κ ε₀ A / d', sub: `= ${n(num(p, 'k'))} × 8.85×10⁻¹² × ${n(num(p, 'A') * 1e-4)} / ${n(num(p, 'd') * 1e-3)} = ${n(c.C)} F` },
          { expr: 'Q = C V ,  U = ½ C V² = Q² / 2C', sub: `U_final = ${n(c.U)} J` },
          { expr: 'q(t) = Q (1 − e^(−t/RC))', sub: `τ = ${n(tau())} s` },
          { expr: 'E = V / d = σ / ε' },
        ];
      },
    };
  },
};

export default sim;
