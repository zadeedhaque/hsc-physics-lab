import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num } from '../types';
import { rng, gauss } from '../../lib/num';
import { C } from '../../engine/colors';
import { n } from '../shared';

const BIN_W = 0.35; // scene width of one histogram bin

const sim: SimDefinition = {
  camera: { position: [0, 4.5, 12], target: [0, 2, 0], aspect: 1.6 },
  hint: 'Each trial adds one reading to the histogram. Random error spreads it out; systematic error shifts it away from the true value.',
  params: [
    { kind: 'slider', key: 'true', label: 'True length', unit: 'cm', min: 5, max: 50, step: 0.01, default: 20 },
    { kind: 'slider', key: 'sigma', label: 'Random error (spread σ)', unit: 'cm', min: 0, max: 1, step: 0.01, default: 0.3 },
    { kind: 'slider', key: 'bias', label: 'Systematic error (bias)', unit: 'cm', min: -1, max: 1, step: 0.01, default: 0 },
    { kind: 'select', key: 'lc', label: 'Instrument least count', default: '0.1', options: [{ value: '0.1', label: '0.1 cm (ruler)' }, { value: '0.01', label: '0.01 cm (vernier)' }, { value: '0.001', label: '0.001 cm (screw gauge)' }] },
    { kind: 'slider', key: 'rate', label: 'Trials per second', unit: '/s', min: 1, max: 40, step: 1, default: 8 },
    { kind: 'slider', key: 'seed', label: 'Random seed', min: 1, max: 50, step: 1, default: 3 },
  ],
  presets: [
    { label: 'Accurate & precise', values: { sigma: 0.05, bias: 0 } },
    { label: 'Precise, not accurate', values: { sigma: 0.05, bias: 0.6 } },
    { label: 'Accurate, not precise', values: { sigma: 0.7, bias: 0 } },
    { label: 'Neither', values: { sigma: 0.7, bias: -0.6 } },
  ],
  graphs: [
    { id: 'mean', title: 'Running mean vs number of trials', x: 'trial number', y: 'length (cm)', series: [{ label: 'running mean', color: C.accent }, { label: 'true value', color: '#e2e8f0', dashed: true }] },
    { id: 'hist', title: 'Distribution of readings', x: 'reading (cm)', y: 'count', kind: 'curve', zeroY: true, series: [{ label: 'histogram', color: C.weight }] },
  ],
  learn: {
    concept: 'Every measurement contains error. Random errors scatter readings on both sides of the true value and are reduced by averaging many trials; systematic errors shift every reading the same way and are not reduced by averaging. Precision is about the spread; accuracy is about closeness to the true value.',
    variables: [['x̄', 'mean of n readings'], ['σ', 'standard deviation (spread)'], ['σ/√n', 'standard error of the mean'], ['Δx', 'absolute error = |x̄ − true|'], ['%', 'percentage error = Δx / true × 100']],
    observe: [
      'The running mean settles down as more trials are added.',
      'Adding bias shifts the whole histogram — averaging cannot remove it.',
      'The standard error shrinks like 1/√n: 4× the trials halves it.',
      'A coarse least count makes the histogram lumpy (readings round to the scale).',
    ],
    challenge: 'Set σ = 0.5 cm with no bias. How many trials are needed before the standard error falls below 0.05 cm? Predict with σ/√n, then run it.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let readings: number[] = [];
    let acc = 0, t = 0;
    let rand = rng(1);
    const MAX = 400;

    kit.box(16, 0.2, 3, '#334155').position.set(0, -0.1, 0);
    const bars = kit.add(new THREE.Group());
    const trueLine = kit.line('#e2e8f0', [], { width: 2, dashed: true });
    const meanLine = kit.line(C.accent, [], { width: 3 });
    const trueLabel = kit.label('true', [0, 0, 0], { small: true });
    const meanLabel = kit.label('mean', [0, 0, 0], { color: C.accent, small: true });
    const latest = kit.sphere(0.12, C.weight, { emissive: 0.5 });
    const axis = kit.segments('#64748b', { width: 1.2 });
    const axisLabels = kit.add(new THREE.Group());
    let barMeshes: THREE.Mesh[] = [];

    const lc = () => Number(p.lc);
    const binW = () => Math.max(lc(), (num(p, 'sigma') + 0.02) / 3); // cm per bin
    const X = (v: number) => ((v - num(p, 'true')) / (4 * (num(p, 'sigma') + Math.abs(num(p, 'bias')) + 0.05))) * 7;

    function measure() {
      const raw = num(p, 'true') + num(p, 'bias') + num(p, 'sigma') * gauss(rand);
      return Math.round(raw / lc()) * lc();
    }

    function stats() {
      const k = readings.length;
      if (!k) return { k, mean: num(p, 'true'), sd: 0, se: 0 };
      const mean = readings.reduce((a, b) => a + b, 0) / k;
      const sd = k > 1 ? Math.sqrt(readings.reduce((a, b) => a + (b - mean) ** 2, 0) / (k - 1)) : 0;
      return { k, mean, sd, se: sd / Math.sqrt(k) };
    }

    function drawAxis() {
      const flat: number[] = [];
      kit.clearGroup(axisLabels);
      const span = 4 * (num(p, 'sigma') + Math.abs(num(p, 'bias')) + 0.05);
      const step = span > 2 ? 0.5 : span > 0.8 ? 0.2 : span > 0.3 ? 0.1 : 0.02;
      const t0 = num(p, 'true');
      for (let v = Math.ceil((t0 - span) / step) * step; v <= t0 + span + 1e-9; v += step) {
        const x = X(v);
        if (Math.abs(x) > 7.6) continue;
        flat.push(x, 0.01, 1.2, x, 0.01, 1.45);
        axisLabels.add(kit.label(n(v, 4), [x, 0, 1.8], { small: true }));
      }
      axis.setSegments(flat);
      trueLine.setPoints([[X(t0), 0, 0], [X(t0), 5.4, 0]]);
      trueLabel.at([X(t0), 5.7, 0]).setText(`true = ${n(t0, 4)} cm`);
    }

    function drawBars() {
      kit.clearGroup(bars);
      barMeshes = [];
      const bw = binW();
      const counts = new Map<number, number>();
      for (const r of readings) { const b = Math.round(r / bw); counts.set(b, (counts.get(b) ?? 0) + 1); }
      const maxC = Math.max(1, ...counts.values());
      const h = 5 / Math.max(maxC, 8);
      const xs: number[] = [], ys: number[] = [];
      [...counts.entries()].sort((a, b) => a[0] - b[0]).forEach(([b, c]) => {
        const v = b * bw;
        const w = Math.max(0.06, Math.abs(X(v + bw / 2) - X(v - bw / 2)) * 0.9);
        const m = kit.box(Math.min(w, BIN_W * 2), c * h, 0.6, C.weight, { roughness: 0.6 });
        m.position.set(X(v), (c * h) / 2, 0);
        bars.add(m);
        barMeshes.push(m);
        xs.push(v - bw / 2, v - bw / 2, v + bw / 2, v + bw / 2); ys.push(0, c, c, 0);
      });
      graphs.get('hist').setSeries(0, xs, ys);
      const s = stats();
      meanLine.visible = meanLabel.visible = s.k > 0;
      if (s.k > 0) {
        meanLine.setPoints([[X(s.mean), 0, 0.35], [X(s.mean), 5.2, 0.35]]);
        meanLabel.at([X(s.mean), 6.2, 0.35]).setText(`mean = ${n(s.mean, 5)} cm`);
      }
    }

    function reset() {
      readings = []; acc = 0; t = 0;
      rand = rng(num(p, 'seed') * 104729);
      latest.visible = false;
      graphs.get('mean').clear();
      drawAxis();
      drawBars();
    }
    reset();

    return {
      setParams(np) {
        const restart = ['true', 'sigma', 'bias', 'lc', 'seed'].some((k) => np[k] !== p[k]);
        p = np;
        if (restart) reset();
      },
      reset,
      step(dt) {
        if (readings.length >= MAX) return;
        t += dt;
        acc += dt * num(p, 'rate');
        let added = false;
        while (acc >= 1 && readings.length < MAX) {
          acc -= 1;
          const r = measure();
          readings.push(r);
          const s = stats();
          graphs.get('mean').push(s.k, s.mean, num(p, 'true'));
          latest.position.set(X(r), 5.8, 0.6);
          latest.visible = true;
          added = true;
        }
        if (added) drawBars();
      },
      done: () => readings.length >= MAX,
      time: () => t,
      actions: () => [{ id: 'one', label: 'Take one reading', run: () => { if (readings.length < MAX) { readings.push(measure()); const s = stats(); graphs.get('mean').push(s.k, s.mean, num(p, 'true')); drawBars(); } } }],
      readouts(): Readout[] {
        const s = stats();
        const absErr = Math.abs(s.mean - num(p, 'true'));
        return [
          { label: 'Trials n', value: s.k },
          { label: 'Mean x̄', value: s.mean, unit: 'cm', tone: 'accent', digits: 5 },
          { label: 'Standard deviation σ', value: s.sd, unit: 'cm' },
          { label: 'Standard error σ/√n', value: s.se, unit: 'cm' },
          { label: 'Absolute error |x̄ − true|', value: absErr, unit: 'cm' },
          { label: 'Relative error', value: absErr / num(p, 'true') },
          { label: 'Percentage error', value: (absErr / num(p, 'true')) * 100, unit: '%', tone: 'accent' },
          { label: 'Result', value: s.k > 1 ? `(${n(s.mean, 5)} ± ${n(s.se, 2)}) cm` : 'take more readings' },
        ];
      },
      equations(): Equation[] {
        const s = stats();
        return [
          { expr: 'x̄ = (x₁ + x₂ + … + xₙ) / n', sub: `x̄ = ${n(s.mean, 5)} cm  (n = ${s.k})` },
          { expr: 'σ = √[ Σ(xᵢ − x̄)² / (n − 1) ]', sub: `σ = ${n(s.sd)} cm` },
          { expr: 'Standard error = σ / √n', sub: `= ${n(s.se)} cm` },
          { expr: '% error = (|x̄ − x_true| / x_true) × 100' },
        ];
      },
    };
  },
};

export default sim;
