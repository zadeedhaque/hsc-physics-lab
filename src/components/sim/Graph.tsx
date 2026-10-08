import { useEffect, useRef } from 'react';
import type { GraphBuffer } from '../../engine/graph';
import { SERIES, readableOn } from '../../engine/colors';
import { superscript } from '../../lib/num';
import { notationRuns, plainNotation } from '../../lib/notation';
import { useApp } from '../../state/store';
import { Notation } from './MathText';

/** "Nice" tick step for an axis span. */
function niceStep(span: number, target = 5) {
  const raw = span / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
}

/** Power of ten factored out of an axis whose values are very large or very small (0 = none). */
function axisExponent(a: number, b: number) {
  const m = Math.max(Math.abs(a), Math.abs(b));
  if (!Number.isFinite(m) || m === 0) return 0;
  return m >= 1e4 || m < 1e-2 ? Math.floor(Math.log10(m)) : 0;
}

/** "V (V)" + 10⁵ → "V (×10⁵ V)"; a title without a unit gets "(×10⁵)" appended. */
function withExponent(title: string, e: number) {
  if (!e) return title;
  const factor = `×10${superscript(e)}`;
  const m = /^(.*)\(([^()]*)\)\s*$/.exec(title);
  return m ? `${m[1]}(${factor} ${m[2]})` : `${title} (${factor})`;
}

/** Tick label for an already-scaled value; decimals follow the step, with a true minus sign. */
function tickLabel(v: number, step: number) {
  if (Math.abs(v) < step * 1e-6) return '0';
  const dec = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  return v.toFixed(Math.min(dec, 4)).replace('-', '−');
}

const MONO = '"JetBrains Mono", ui-monospace, monospace';
const SANS = 'Manrope, ui-sans-serif, system-ui, sans-serif';

/** Draw text with V_d-style notation as real sub/superscripts. */
function drawRich(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, align: 'left' | 'center' | 'right', px: number, weight = 500) {
  const runs = notationRuns(text);
  const fontFor = (level: number) => `${weight} ${level ? Math.round(px * 0.72) : px}px ${SANS}`;
  let total = 0;
  const widths = runs.map((r) => { ctx.font = fontFor(r.level); const w = ctx.measureText(r.text).width; total += w; return w; });
  let cx = align === 'left' ? x : align === 'center' ? x - total / 2 : x - total;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  runs.forEach((r, i) => {
    ctx.font = fontFor(r.level);
    ctx.fillText(r.text, cx, y + (r.level < 0 ? px * 0.28 : r.level > 0 ? -px * 0.38 : 0));
    cx += widths[i];
  });
  ctx.textAlign = prevAlign;
}

/**
 * Canvas line graph that redraws only when its buffer's version changes.
 * Colours come from CSS variables so it follows the theme.
 */
export function Graph({ buffer, height = 170 }: { buffer: GraphBuffer; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const theme = useApp((s) => s.theme);
  const spec = buffer.spec;
  const seriesColor = (i: number) => readableOn(spec.series[i]?.color ?? SERIES[i % SERIES.length], theme);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let drawn = -1;
    let lastW = 0;
    let lastTheme = '';

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const w = canvas.clientWidth;
      const th = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
      if (buffer.version === drawn && w === lastW && th === lastTheme) return;
      drawn = buffer.version;
      lastW = w;
      lastTheme = th;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const h = height;
      canvas.width = Math.max(1, w * dpr);
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const css = getComputedStyle(document.documentElement);
      const cLine = css.getPropertyValue('--line-2').trim();
      const cGrid = css.getPropertyValue('--line').trim();
      const cText = css.getPropertyValue('--fg-3').trim();
      const cFg = css.getPropertyValue('--fg').trim();

      // Data extents
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      buffer.xs.forEach((xs, i) => {
        const ys = buffer.ys[i];
        for (let j = 0; j < xs.length; j++) {
          if (xs[j] < x0) x0 = xs[j]; if (xs[j] > x1) x1 = xs[j];
        }
        for (let j = 0; j < ys.length; j++) {
          if (!Number.isFinite(ys[j])) continue;
          if (ys[j] < y0) y0 = ys[j]; if (ys[j] > y1) y1 = ys[j];
        }
      });
      for (const m of buffer.markers) { x0 = Math.min(x0, m.x); x1 = Math.max(x1, m.x); y0 = Math.min(y0, m.y); y1 = Math.max(y1, m.y); }
      const empty = !Number.isFinite(x0);
      if (spec.window && Number.isFinite(x1)) { x0 = Math.max(x0, x1 - spec.window); x1 = Math.max(x1, x0 + spec.window); }
      if (spec.xRange) [x0, x1] = spec.xRange;
      if (spec.yRange) [y0, y1] = spec.yRange;
      if (empty && !spec.xRange) { x0 = 0; x1 = spec.window ?? 1; }
      if (empty && !spec.yRange) { y0 = -1; y1 = 1; }
      if (spec.zeroY && !spec.yRange) { y0 = Math.min(y0, 0); y1 = Math.max(y1, 0); }
      if (x1 - x0 < 1e-12) { x1 = x0 + 1; }
      if (y1 - y0 < 1e-12) { const c = y0; y0 = c - Math.max(1, Math.abs(c) * 0.1); y1 = c + Math.max(1, Math.abs(c) * 0.1); }
      if (!spec.yRange) { const pad = (y1 - y0) * 0.08; y0 -= pad; y1 += pad; }

      // Ticks — computed first so the left margin fits the widest label (nothing gets clipped)
      const xe = axisExponent(x0, x1), ye = axisExponent(y0, y1);
      const xk = 10 ** -xe, yk = 10 ** -ye;
      const yStep = niceStep((y1 - y0) * yk, 4);
      const yTicks: { v: number; label: string }[] = [];
      for (let y = Math.ceil((y0 * yk) / yStep) * yStep; y <= y1 * yk + yStep * 1e-6; y += yStep) yTicks.push({ v: y / yk, label: tickLabel(y, yStep) });
      ctx.font = `10px ${MONO}`;
      const yLabelW = Math.max(0, ...yTicks.map((t) => ctx.measureText(t.label).width));
      const padL = Math.ceil(Math.max(30, yLabelW + 8) + 18), padR = 12, padT = 8, padB = 30;
      const pw = w - padL - padR, ph = h - padT - padB;
      const X = (x: number) => padL + ((x - x0) / (x1 - x0)) * pw;
      const Y = (y: number) => padT + ph - ((y - y0) / (y1 - y0)) * ph;

      // Grid + tick labels
      ctx.lineWidth = 1;
      ctx.fillStyle = cText;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const xStep = niceStep((x1 - x0) * xk, Math.max(3, Math.floor(pw / 70)));
      for (let x = Math.ceil((x0 * xk) / xStep) * xStep; x <= x1 * xk + xStep * 1e-6; x += xStep) {
        const px = X(x / xk);
        ctx.strokeStyle = cGrid;
        ctx.beginPath(); ctx.moveTo(Math.round(px) + 0.5, padT); ctx.lineTo(Math.round(px) + 0.5, padT + ph); ctx.stroke();
        ctx.fillText(tickLabel(x, xStep), px, padT + ph + 5);
      }
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (const t of yTicks) {
        const py = Math.round(Y(t.v)) + 0.5;
        ctx.strokeStyle = cGrid;
        ctx.beginPath(); ctx.moveTo(padL, py); ctx.lineTo(padL + pw, py); ctx.stroke();
        ctx.fillText(t.label, padL - 6, py);
      }
      // Zero axis
      if (y0 < 0 && y1 > 0) {
        ctx.strokeStyle = cLine; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(padL, Math.round(Y(0)) + 0.5); ctx.lineTo(padL + pw, Math.round(Y(0)) + 0.5); ctx.stroke();
      }
      ctx.strokeStyle = cLine; ctx.lineWidth = 1;
      ctx.strokeRect(padL + 0.5, padT + 0.5, pw, ph);

      // Axis titles
      ctx.fillStyle = cText;
      ctx.textBaseline = 'bottom';
      drawRich(ctx, withExponent(spec.x, xe), padL + pw, h - 1, 'right', 11, 600);
      ctx.save();
      ctx.translate(10, padT + ph / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textBaseline = 'middle';
      drawRich(ctx, withExponent(spec.y, ye), 0, 0, 'center', 11, 600);
      ctx.restore();

      // Series
      ctx.save();
      ctx.beginPath(); ctx.rect(padL, padT, pw, ph); ctx.clip();
      ctx.lineJoin = 'round';
      buffer.xs.forEach((xArr, i) => {
        const yArr = buffer.ys[i];
        if (xArr.length < 1) return;
        const s = spec.series[i];
        ctx.strokeStyle = readableOn(s?.color ?? SERIES[i % SERIES.length], th);
        ctx.lineWidth = 2;
        ctx.setLineDash(s?.dashed ? [5, 4] : []);
        ctx.beginPath();
        let started = false;
        for (let j = 0; j < xArr.length; j++) {
          if (xArr[j] < x0 - (x1 - x0) * 0.02) continue;
          if (!Number.isFinite(yArr[j])) { started = false; continue; }
          const px = X(xArr[j]), py = Y(yArr[j]);
          if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
        }
        ctx.stroke();
      });
      ctx.setLineDash([]);
      for (const v of buffer.vlines) {
        ctx.strokeStyle = cText; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(X(v.x), padT); ctx.lineTo(X(v.x), padT + ph); ctx.stroke();
        ctx.setLineDash([]);
        if (v.label) { ctx.fillStyle = cText; ctx.textBaseline = 'top'; drawRich(ctx, v.label, X(v.x) + 3, padT + 2, 'left', 10); }
      }
      for (const m of buffer.markers) {
        ctx.fillStyle = m.color ? readableOn(m.color, th) : cFg;
        ctx.beginPath(); ctx.arc(X(m.x), Y(m.y), 4, 0, Math.PI * 2); ctx.fill();
        if (m.label) { ctx.textBaseline = 'bottom'; drawRich(ctx, m.label, X(m.x) + 6, Y(m.y) - 3, 'left', 10); }
      }
      ctx.restore();
    };
    raf = requestAnimationFrame(draw);
    // Static graphs never bump their version, so redraw once the web fonts have arrived.
    document.fonts?.ready.then(() => { drawn = -1; });
    return () => cancelAnimationFrame(raf);
  }, [buffer, height, spec]);

  return (
    <figure className="rounded-xl border border-line bg-panel p-3 pb-2">
      <figcaption className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-0.5">
        <span className="text-[13px] font-bold text-fg"><Notation text={spec.title} /></span>
        <span className="flex flex-wrap gap-3">
          {spec.series.map((s, i) => (
            <span key={s.label} className="flex items-center gap-1.5 text-[11.5px] font-medium text-fg-2">
              <span className="h-[3px] w-4 rounded-full" style={{ background: seriesColor(i) }} /><Notation text={s.label} />
            </span>
          ))}
        </span>
      </figcaption>
      <canvas ref={ref} style={{ width: '100%', height }} role="img" aria-label={plainNotation(`${spec.title}: ${spec.y} against ${spec.x}`)} />
    </figure>
  );
}
