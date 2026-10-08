/**
 * Physics notation in plain strings → sub/superscripts.
 *
 *   V_d, KE_rot, V_CE      subscript: a digit run, a lowercase run or an uppercase run
 *                          ("A_yB_y" → A_y B_y, "m_Av_A" → m_A v_A, "C_eqV²" → C_eq V²)
 *   v_{boat/water}         braced subscript (anything inside)
 *   e^{V/V_T}, e^(−λt)     braced / bracketed superscript (the brackets are dropped)
 *   PV^γ, a^1.5, A^⅓       a number, a single letter or a vulgar fraction
 *
 * A marker only counts after a symbol character, so prose such as "_" on its own is left alone.
 */
import { flattenMath, parseMath, type MathNode } from './mathText';

export interface Script { kind: 'sub' | 'sup'; children: RichNode[] }
export interface RichFrac { kind: 'frac'; num: RichNode[]; den: RichNode[]; source: string }
export type RichNode = string | Script | RichFrac;

const SYMBOL_BEFORE = /[\p{L}\p{N}\p{M})\]′'⁰¹²³⁴⁵⁶⁷⁸⁹⁻ₓᵢⱼₙₘₛₜₐₑₒₖₗₚᵣᵤᵥ₀₁₂₃₄₅₆₇₈₉½☉]/u;
const isSymbolBefore = (s: string, i: number) => i > 0 && SYMBOL_BEFORE.test(s[i - 1]);

function closing(s: string, open: number): number {
  const o = s[open];
  const c = o === '{' ? '}' : o === '(' ? ')' : ']';
  let depth = 0;
  for (let k = open; k < s.length; k++) {
    if (s[k] === o) depth++;
    else if (s[k] === c && --depth === 0) return k;
  }
  return -1;
}

/** Length of a bare subscript run starting at i (0 if none). */
function subRun(s: string, i: number): number {
  const m = /^(?:[0-9]+|[a-z][a-z0-9]*|[A-Z]+[0-9]*)/.exec(s.slice(i));
  return m ? m[0].length : 0;
}
/** Length of a bare superscript run starting at i (0 if none). */
function supRun(s: string, i: number): number {
  const m = /^(?:[−-]?[0-9]+(?:\.[0-9]+)?|[A-Za-zα-ωΑ-Ω]|[½⅓¼¾⅔])/.exec(s.slice(i));
  return m ? m[0].length : 0;
}

/** Find the next script marker at or after `from`: [start, end, kind, inner]. */
function nextScript(s: string, from: number): [number, number, 'sub' | 'sup', string] | null {
  for (let i = from; i < s.length; i++) {
    const ch = s[i];
    if ((ch !== '_' && ch !== '^') || !isSymbolBefore(s, i)) continue;
    const kind = ch === '_' ? 'sub' : 'sup';
    const nx = s[i + 1];
    if (nx === '{' || (kind === 'sup' && nx === '(')) {
      const end = closing(s, i + 1);
      if (end > i + 2) return [i, end + 1, kind, s.slice(i + 2, end)];
      continue;
    }
    const len = kind === 'sub' ? subRun(s, i + 1) : supRun(s, i + 1);
    if (len > 0) return [i, i + 1 + len, kind, s.slice(i + 1, i + 1 + len)];
  }
  return null;
}

/** Inline notation only (no fractions): for labels, prose, legends. */
export function parseNotation(s: string): RichNode[] {
  const out: RichNode[] = [];
  let from = 0;
  for (;;) {
    const hit = nextScript(s, from);
    if (!hit) break;
    const [start, end, kind, inner] = hit;
    if (start > from) out.push(s.slice(from, start));
    out.push({ kind, children: parseNotation(inner) });
    from = end;
  }
  if (from < s.length) out.push(s.slice(from));
  return out;
}

const PUA = 0xe000;

/**
 * Equations: fractions plus notation. Braced/bracketed script groups are protected first so a
 * division inside "e^{V_d / V_T}" stays inside the exponent instead of splitting the equation.
 */
export function parseRichMath(s: string): RichNode[] {
  const groups: string[] = [];
  let protectedText = '';
  let from = 0;
  for (;;) {
    const hit = nextScript(s, from);
    if (!hit) break;
    const [start, end] = hit;
    const grouped = s[start + 1] === '{' || s[start + 1] === '(';
    protectedText += s.slice(from, grouped ? start : end);
    if (grouped) {
      protectedText += String.fromCharCode(PUA + groups.length);
      groups.push(s.slice(start, end));
    }
    from = end;
  }
  protectedText += s.slice(from);
  if (!groups.length) return fromMath(parseMath(s));
  const restore = (t: string) => t.replace(/[-]/g, (c) => groups[c.charCodeAt(0) - PUA] ?? c);
  const walk = (nodes: MathNode[]): RichNode[] =>
    nodes.flatMap((n): RichNode[] => (typeof n === 'string' ? parseNotation(restore(n)) : [{ kind: 'frac', num: walk(n.num), den: walk(n.den), source: restore(flattenMath([n])) }]));
  return walk(parseMath(protectedText));
}

function fromMath(nodes: MathNode[]): RichNode[] {
  return nodes.flatMap((n): RichNode[] => (typeof n === 'string' ? parseNotation(n) : [{ kind: 'frac', num: fromMath(n.num), den: fromMath(n.den), source: n.source }]));
}

/* ── cached access for hot paths (readouts re-render ~12×/s) ── */
const cache = new Map<string, RichNode[]>();
export function notation(s: string): RichNode[] {
  let v = cache.get(s);
  if (!v) {
    v = parseNotation(s);
    if (cache.size > 4000) cache.clear();
    cache.set(s, v);
  }
  return v;
}
export const hasNotation = (s: string) => /[_^]/.test(s);

/* ── plain-text fallback (aria-labels, <option>, titles) ── */
const SUB: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  a: 'ₐ', e: 'ₑ', h: 'ₕ', i: 'ᵢ', j: 'ⱼ', k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ', o: 'ₒ', p: 'ₚ', r: 'ᵣ', s: 'ₛ', t: 'ₜ', u: 'ᵤ', v: 'ᵥ', x: 'ₓ',
  '+': '₊', '−': '₋', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
};
const SUP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '−': '⁻', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', n: 'ⁿ', i: 'ⁱ',
};
/** Unicode sub/superscripts where every character has one; otherwise keep a readable "x_y" form. */
export function plainNotation(s: string): string {
  if (!hasNotation(s)) return s;
  const text = (nodes: RichNode[]): string => nodes.map((n) => (typeof n === 'string' ? n : n.kind === 'frac' ? n.source : script(n))).join('');
  const script = (n: Script): string => {
    const inner = text(n.children);
    const map = n.kind === 'sub' ? SUB : SUP;
    const chars = [...inner];
    if (chars.every((c) => map[c])) return chars.map((c) => map[c]).join('');
    return n.kind === 'sub' ? `_${inner}` : `^(${inner})`;
  };
  return text(notation(s));
}

/** Fill a DOM element with notation (3D labels, which are plain DOM rather than React). */
export function renderNotationInto(el: HTMLElement, s: string) {
  if (!hasNotation(s)) { el.textContent = s; return; }
  el.textContent = '';
  const append = (parent: HTMLElement, nodes: RichNode[]) => {
    for (const n of nodes) {
      if (typeof n === 'string') parent.appendChild(document.createTextNode(n));
      else if (n.kind === 'frac') parent.appendChild(document.createTextNode(n.source));
      else {
        const span = document.createElement('span');
        span.className = n.kind === 'sub' ? 'mt-sub' : 'mt-sup';
        append(span, n.children);
        parent.appendChild(span);
      }
    }
  };
  append(el, notation(s));
}

/** Flatten to drawable runs for canvas text: level 0 = baseline, −1 = subscript, 1 = superscript. */
export function notationRuns(s: string): { text: string; level: -1 | 0 | 1 }[] {
  const runs: { text: string; level: -1 | 0 | 1 }[] = [];
  const walk = (nodes: RichNode[], level: -1 | 0 | 1) => {
    for (const n of nodes) {
      if (typeof n === 'string') runs.push({ text: n, level });
      else if (n.kind === 'frac') runs.push({ text: n.source, level });
      else walk(n.children, level === 0 ? (n.kind === 'sub' ? -1 : 1) : level);
    }
  };
  walk(notation(s), 0);
  return runs;
}
