import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { str } from '../types';
import { sigFigs, decimalPlaces } from '../../physics/measurement';
import { C } from '../../engine/colors';

type Op = '+' | '-' | '*' | '/';
const NUM_RE = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

/** Which characters of a numeric string are significant (for colouring). */
export function significantMask(s: string): boolean[] {
  const [mant] = s.toLowerCase().split('e');
  const chars = [...s];
  const mask = chars.map(() => false);
  const hasPoint = mant.includes('.');
  // index range of the mantissa digits
  let firstNonZero = -1, lastSig = -1;
  for (let i = 0; i < mant.length; i++) if (/[1-9]/.test(mant[i])) { if (firstNonZero < 0) firstNonZero = i; }
  if (firstNonZero < 0) return mask;
  for (let i = mant.length - 1; i >= 0; i--) {
    if (!/\d/.test(mant[i])) continue;
    if (hasPoint || mant[i] !== '0') { lastSig = i; break; }
  }
  for (let i = firstNonZero; i <= lastSig; i++) if (/\d/.test(mant[i])) mask[i] = true;
  return mask;
}

function formatSig(v: number, sf: number) {
  if (!Number.isFinite(v)) return '—';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e6 || a < 1e-4) return v.toExponential(Math.max(0, sf - 1));
  return v.toPrecision(Math.max(1, Math.min(21, sf)));
}

const sim: SimDefinition = {
  camera: { position: [0, 0.5, 11], target: [0, 0, 0], aspect: 1.6 },
  timeless: true,
  hint: 'Blue digits are significant; grey digits are placeholders. Type any numbers into the boxes.',
  params: [
    { kind: 'text', key: 'a', label: 'Measurement A', default: '12.36', placeholder: 'e.g. 0.00450', inputMode: 'decimal' },
    { kind: 'select', key: 'op', label: 'Operation', default: '*', options: [{ value: '+', label: 'A + B' }, { value: '-', label: 'A − B' }, { value: '*', label: 'A × B' }, { value: '/', label: 'A ÷ B' }] },
    { kind: 'text', key: 'b', label: 'Measurement B', default: '2.1', placeholder: 'e.g. 3.0e2', inputMode: 'decimal' },
  ],
  presets: [
    { label: 'Multiply (2 s.f.)', values: { a: '12.36', op: '*', b: '2.1' } },
    { label: 'Add (decimals)', values: { a: '12.365', op: '+', b: '4.1' } },
    { label: 'Leading zeros', values: { a: '0.00450', op: '/', b: '1.5' } },
    { label: 'Trailing zeros', values: { a: '1200', op: '*', b: '3.00' } },
    { label: 'Subtract', values: { a: '100.0', op: '-', b: '99.62' } },
  ],
  learn: {
    concept: 'Significant figures are the digits that carry meaning about a measurement’s precision. A calculated result cannot be more precise than the data it came from. For × and ÷ keep the fewest significant figures; for + and − keep the fewest decimal places.',
    variables: [['s.f.', 'significant figures'], ['d.p.', 'decimal places']],
    observe: [
      'All non-zero digits are significant; zeros between them are too.',
      'Leading zeros (0.00…) are never significant — they only place the decimal point.',
      'Trailing zeros count only when there is a decimal point (1200 has 2 s.f., 1200. has 4).',
      'Switch between × and + with the same numbers: the rounding rule changes.',
    ],
    challenge: 'Find two measurements whose product must be reported with exactly 2 significant figures, but whose sum keeps 3 decimal places.',
  },

  create({ kit, params }) {
    let p: Params = params;
    const rows = kit.add(new THREE.Group());

    function evaluate() {
      const a = str(p, 'a').trim(), b = str(p, 'b').trim();
      const op = str(p, 'op') as Op;
      const okA = NUM_RE.test(a), okB = NUM_RE.test(b);
      if (!okA || !okB) return { ok: false as const, okA, okB };
      const va = parseFloat(a), vb = parseFloat(b);
      if (op === '/' && vb === 0) return { ok: false as const, okA, okB: false };
      const raw = op === '+' ? va + vb : op === '-' ? va - vb : op === '*' ? va * vb : va / vb;
      const sfA = sigFigs(a), sfB = sigFigs(b), dpA = decimalPlaces(a), dpB = decimalPlaces(b);
      let rounded: string, rule: string;
      if (op === '+' || op === '-') {
        const dp = Math.min(dpA, dpB);
        rounded = raw.toFixed(Math.min(20, dp));
        rule = `fewest decimal places: ${dp}`;
      } else {
        const sf = Math.min(sfA, sfB);
        rounded = formatSig(raw, sf);
        rule = `fewest significant figures: ${sf}`;
      }
      return { ok: true as const, a, b, va, vb, raw, sfA, sfB, dpA, dpB, rounded, rule, op };
    }

    function digitRow(text: string, y: number, label: string, colorSig: string) {
      const mask = significantMask(text);
      const chars = [...text];
      const w = 0.62;
      const x0 = -((chars.length - 1) * w) / 2;
      rows.add(kit.label(label, [x0 - 1.6, y, 0], { small: true, className: 'plain' }));
      chars.forEach((ch, i) => {
        const isDigit = /\d/.test(ch);
        const sig = mask[i];
        if (isDigit) {
          const cube = kit.box(0.55, 0.7, 0.3, sig ? colorSig : '#334155', { emissive: sig ? 0.25 : 0.02, roughness: 0.5 });
          cube.position.set(x0 + i * w, y, -0.2);
          rows.add(cube);
        }
        rows.add(kit.label(ch, [x0 + i * w, y, 0.1], { className: 'plain' }));
      });
    }

    function build() {
      kit.clearGroup(rows);
      const r = evaluate();
      digitRow(str(p, 'a') || ' ', 2.2, 'A', C.accent);
      digitRow(str(p, 'b') || ' ', 0.8, 'B', C.accent);
      const opSym = { '+': '+', '-': '−', '*': '×', '/': '÷' }[str(p, 'op') as Op] ?? '?';
      rows.add(kit.label(opSym, [-4.6, 1.5, 0]));
      rows.add(kit.line('#64748b', [[-4, 0, 0], [4, 0, 0]], { width: 2 }));
      if (r.ok) {
        digitRow(r.rounded, -0.9, 'Result', C.normal);
        rows.add(kit.label(`calculator shows: ${Number(r.raw.toPrecision(12))}`, [0, -2.1, 0], { small: true }));
      } else rows.add(kit.label('Enter valid numbers (e.g. 0.0450, 3.2e4)', [0, -0.9, 0], { color: C.friction }));
    }
    build();

    return {
      setParams(np) { p = np; build(); },
      reset() { build(); },
      step() {},
      readouts(): Readout[] {
        const r = evaluate();
        if (!r.ok) return [{ label: 'Status', value: !r.okA ? 'A is not a valid number' : 'B is not a valid number', tone: 'bad' }];
        return [
          { label: 'Significant figures in A', value: r.sfA },
          { label: 'Significant figures in B', value: r.sfB },
          { label: 'Decimal places in A', value: r.dpA },
          { label: 'Decimal places in B', value: r.dpB },
          { label: 'Calculator answer', value: String(Number(r.raw.toPrecision(12))) },
          { label: 'Correctly rounded answer', value: r.rounded, tone: 'accent' },
          { label: 'Rule applied', value: r.rule },
          { label: 'Sig figs in answer', value: sigFigs(r.rounded.replace(/e.*$/i, '') || '0') },
        ];
      },
      equations(): Equation[] {
        return [
          { expr: '× and ÷ : answer has the fewest significant figures', note: 'e.g. 12.36 × 2.1 = 25.956 → 26' },
          { expr: '+ and − : answer has the fewest decimal places', note: 'e.g. 12.365 + 4.1 = 16.465 → 16.5' },
          { expr: 'Rounding: look at the first dropped digit — 5 or more rounds up' },
        ];
      },
    };
  },
};

export default sim;
