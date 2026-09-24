/**
 * Turns plain-text formulas ("λ = h / p", "1/f = 1/u + 1/v", "√(k/m)") into a tree of text and
 * fractions so the UI can draw divisions as numerator over denominator.
 *
 * Two forms of division are recognised:
 *  • spaced  "a / b" — operands are whole product chains: "1.44 MeV·fm × 2 × 79 / 5 MeV"
 *  • compact "a/b"   — operands are the adjacent atoms or bracket groups: "v²/c²", "(1 + e)/(1 − e)"
 * Compound units after a value ("9.8 m/s²", "4π×10⁻⁷ T·m/A") and slashes inside subscripts
 * ("v_boat/water") are left as written.
 */

export interface Frac {
  kind: 'frac';
  num: MathNode[];
  den: MathNode[];
  /** Exact source text, so the original string can always be reconstructed. */
  source: string;
}
export type MathNode = string | Frac;

const OPEN = '([{';
const CLOSE = ')]}';
const PAIR: Record<string, string> = { ')': '(', ']': '[', '}': '{', '(': ')', '[': ']', '{': '}' };
/** Tokens that end a product chain (relations, sums, list punctuation). */
const BREAK = new Set(['=', '+', '−', '-', '≈', '≥', '≤', '→', '⇒', ',', ':', ';', '<', '>', '≠', '∝', '±', '&']);
/** Characters that end a compact operand. */
const COMPACT_STOP = new Set([' ', '=', '+', '−', ',', '×', '*', ':', ';', '≈', '≥', '≤', '→', '⇒', '<', '>', '±', '∝', '|', "'", '"']);
const UNITS = new Set([
  'm', 's', 'kg', 'g', 'N', 'J', 'W', 'T', 'A', 'C', 'V', 'K', 'mol', 'Pa', 'kPa', 'MPa', 'Hz', 'kHz', 'MHz', 'eV', 'keV', 'MeV', 'GeV',
  'km', 'cm', 'mm', 'nm', 'µm', 'μm', 'pm', 'fm', 'h', 'min', 'rad', 'sr', 'Ω', 'F', 'H', 'Wb', 'L', 'u', 'kWh', 'atm', 'day', 'yr',
  'lm', 'lx', 'dB', 'kN', 'mA', 'µA', 'μA', 'kV', 'mV', 'ms', 'µs', 'μs', 'ns', 'S', 'cd', 'Bq', 'Gy', 'Sv',
  'kΩ', 'MΩ', 'Å', 'AU', 'ly', 'pc', 'µF', 'μF', 'nF', 'pF', 'mH', 'kW', 'MW', 'mW', 'µT', 'μT', 'mT', '%',
]);
const SUPER = /^[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]*$/;

function matchBack(s: string, close: number) {
  const want = PAIR[s[close]];
  let depth = 0;
  for (let k = close; k >= 0; k--) {
    if (s[k] === s[close]) depth++;
    else if (s[k] === want && --depth === 0) return k;
  }
  return -1;
}
function matchFwd(s: string, open: number) {
  const want = PAIR[s[open]];
  let depth = 0;
  for (let k = open; k < s.length; k++) {
    if (s[k] === s[open]) depth++;
    else if (s[k] === want && --depth === 0) return k;
  }
  return -1;
}

/* ── compact operands ── */
function compactStart(s: string, end: number) {
  let k = end;
  while (k > 0) {
    const c = s[k - 1];
    if (CLOSE.includes(c)) { const o = matchBack(s, k - 1); if (o < 0) break; k = o; continue; }
    if (OPEN.includes(c) || COMPACT_STOP.has(c)) break;
    k--;
  }
  return k;
}
function compactEnd(s: string, start: number) {
  let k = start;
  while (k < s.length) {
    const c = s[k];
    if (OPEN.includes(c)) { const m = matchFwd(s, k); if (m < 0) break; k = m + 1; continue; }
    if (CLOSE.includes(c) || COMPACT_STOP.has(c)) break;
    k++;
  }
  return k;
}

/* ── spaced operands: chains of items joined by spaces, × or · ── */
function itemStart(s: string, end: number) {
  let k = end;
  while (k > 0) {
    const c = s[k - 1];
    if (c === ' ') break;
    if (c === '|' && k === end) { const o = s.lastIndexOf('|', k - 2); if (o < 0) break; k = o; continue; } // |x − y|
    if (CLOSE.includes(c)) { const o = matchBack(s, k - 1); if (o < 0) break; k = o; continue; }
    if (OPEN.includes(c)) break;
    k--;
  }
  return k;
}
function itemEnd(s: string, start: number) {
  let k = start;
  while (k < s.length) {
    const c = s[k];
    if (c === ' ') break;
    if (c === '|' && k === start) { const m = s.indexOf('|', k + 1); if (m < 0) break; k = m + 1; continue; }
    if (OPEN.includes(c)) { const m = matchFwd(s, k); if (m < 0) break; k = m + 1; continue; }
    if (CLOSE.includes(c)) break;
    k++;
  }
  return k;
}
const isBreakItem = (tok: string) => tok.length > 0 && [...tok].every((c) => BREAK.has(c));

function spacedStart(s: string, slash: number) {
  let j = slash - 1; // index of the space before '/'
  let start = j;
  for (;;) {
    const k = itemStart(s, j);
    if (k === j) break;
    const item = s.slice(k, j);
    if (isBreakItem(item) || BREAK.has(item[item.length - 1])) break;
    start = k;
    if (k >= 3 && s[k - 1] === ' ' && (s[k - 2] === '×' || s[k - 2] === '·') && s[k - 3] === ' ') { j = k - 3; continue; }
    if (k >= 2 && s[k - 1] === ' ' && s[k - 2] !== ' ' && !BREAK.has(s[k - 2]) && !OPEN.includes(s[k - 2])) { j = k - 1; continue; }
    break;
  }
  return start;
}
function spacedEnd(s: string, slash: number) {
  let j = slash + 2; // first char after "/ "
  let end = j;
  for (;;) {
    const k = itemEnd(s, j);
    if (k === j) break;
    const item = s.slice(j, k);
    if (isBreakItem(item) || BREAK.has(item[0])) break;
    if (end > slash + 2) {
      // a later bracketed note ("I (forward)") or a unit after a symbol ("n² eV") is not part of the denominator
      if (OPEN.includes(item[0])) break;
      const prev = s.slice(itemStart(s, end), end);
      if (UNITS.has(item) && !/^[−-]?[0-9]/.test(prev)) break;
    }
    if (BREAK.has(item[item.length - 1])) { end = k - 1; break; } // "R_B," — keep the comma outside
    end = k;
    if (s[k] === ' ' && (s[k + 1] === '×' || s[k + 1] === '·') && s[k + 2] === ' ') { j = k + 3; continue; }
    if (s[k] === ' ' && k + 1 < s.length && s[k + 1] !== ' ' && !BREAK.has(s[k + 1]) && !CLOSE.includes(s[k + 1])) { j = k + 1; continue; }
    break;
  }
  return end;
}

/** "m/s", "N·s/m²", "T·m/A" written right after a value are units, not divisions. */
function isUnitAfterValue(s: string, slash: number) {
  let a = slash, b = slash + 1;
  while (a > 0 && !' (['.includes(s[a - 1])) a--;
  while (b < s.length && !' )],;'.includes(s[b])) b++;
  const token = s.slice(a, b);
  const parts = token.split('/');
  const isUnit = parts.length === 2 && parts.every((p) => p.length > 0 && p.split('·').every((f) => {
    const m = /^([^⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+)(.*)$/.exec(f);
    return !!m && UNITS.has(m[1]) && SUPER.test(m[2]);
  }));
  if (!isUnit) return false;
  let p = a - 1;
  while (p >= 0 && s[p] === ' ') p--;
  return p >= 0 && /[0-9⁰¹²³⁴⁵⁶⁷⁸⁹%]/.test(s[p]);
}

function stripParens(t: string) {
  if (t.length >= 2 && OPEN.includes(t[0]) && matchFwd(t, 0) === t.length - 1) return t.slice(1, -1);
  return t;
}

export function parseMath(s: string): MathNode[] {
  // Spaced divisions bind loosest, so split on those first; compact ones end up inside their operands.
  for (const spacedPass of [true, false]) {
    for (let from = 0; ; ) {
      const i = s.indexOf('/', from);
      if (i < 0) break;
      from = i + 1;
      const spaced = s[i - 1] === ' ' && s[i + 1] === ' ';
      if (spaced !== spacedPass) continue;
      let ns: number, de: number;
      if (spaced) { ns = spacedStart(s, i); de = spacedEnd(s, i); if (ns >= i - 1 || de <= i + 2) continue; }
      else {
        if (s[i - 1] === ' ' || s[i + 1] === ' ' || i === 0 || i === s.length - 1) continue;
        if (isUnitAfterValue(s, i)) continue;
        ns = compactStart(s, i); de = compactEnd(s, i + 1);
        if (ns >= i || de <= i + 1) continue;
        if (s.slice(ns, i).includes('_') && !/[)\]}]$/.test(s.slice(ns, i))) continue; // "v_boat/water" is one symbol
      }
      const numText = s.slice(ns, spaced ? i - 1 : i);
      const denText = s.slice(spaced ? i + 2 : i + 1, de);
      const frac: Frac = { kind: 'frac', num: parseMath(stripParens(numText)), den: parseMath(stripParens(denText)), source: s.slice(ns, de) };
      return [...parseMath(s.slice(0, ns)), frac, ...parseMath(s.slice(de))];
    }
  }
  return s ? [s] : [];
}

/** Rebuild the exact source string (used to test that nothing is lost). */
export function flattenMath(nodes: MathNode[]): string {
  return nodes.map((n) => (typeof n === 'string' ? n : n.source)).join('');
}
