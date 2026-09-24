import { useEffect, useRef } from 'react';
import type { GraphBuffer } from '../../engine/graph';
import { SERIES } from '../../engine/colors';
import { fmt } from '../../lib/num';

/** "Nice" tick step for an axis span. */
function niceStep(span: number, target = 5) {
  const raw = span / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
}

function tickLabel(v: number, step: number) {
  if (Math.abs(v) < step * 1e-6) return '0';
  const a = Math.abs(v);
  if (a >= 1e4 || a < 1e-2) return fmt(v, 2);
  const dec = Math.max(0, -Math.floor(Math.log10(step)));
  return v.toFixed(Math.min(dec, 4));
}

/**
 * Canvas line graph that redraws only when its buffer's version changes.
 * Colours come from CSS variables so it follows the theme.
 */
export function Graph({ buffer, height = 170 }: { buffer: GraphBuffer; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const spec = buffer.spec;

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
      const theme = document.documentElement.dataset.theme ?? '';
      if (buffer.version === drawn && w === lastW && theme === lastTheme) return;
      drawn = buffer.version;
      lastW = w;
      lastTheme = theme;
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

      const padL = 46, padR = 10, padT = 8, padB = 30;
      const pw = w - padL - padR, ph = h - padT - padB;

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

      const X = (x: number) => padL + ((x - x0) / (x1 - x0)) * pw;
      const Y = (y: number) => padT + ph - ((y - y0) / (y1 - y0)) * ph;

      // Grid + ticks
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.lineWidth = 1;
      const xs = niceStep(x1 - x0, Math.max(3, Math.floor(pw / 70)));
      const ys = niceStep(y1 - y0, 4);
      ctx.fillStyle = cText;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (let x = Math.ceil(x0 / xs) * xs; x <= x1 + xs * 1e-6; x += xs) {
        ctx.strokeStyle = cGrid;
        ctx.beginPath(); ctx.moveTo(X(x) + 0.5, padT); ctx.lineTo(X(x) + 0.5, padT + ph); ctx.stroke();
        ctx.fillText(tickLabel(x, xs), X(x), padT + ph + 4);
      }
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let y = Math.ceil(y0 / ys) * ys; y <= y1 + ys * 1e-6; y += ys) {
        ctx.strokeStyle = cGrid;
        ctx.beginPath(); ctx.moveTo(padL, Y(y) + 0.5); ctx.lineTo(padL + pw, Y(y) + 0.5); ctx.stroke();
        ctx.fillText(tickLabel(y, ys), padL - 5, Y(y));
      }
      // Zero axis
      if (y0 < 0 && y1 > 0) {
        ctx.strokeStyle = cLine; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(padL, Y(0) + 0.5); ctx.lineTo(padL + pw, Y(0) + 0.5); ctx.stroke();
      }
      ctx.strokeStyle = cLine; ctx.lineWidth = 1;
      ctx.strokeRect(padL + 0.5, padT + 0.5, pw, ph);

      // Axis titles
      ctx.fillStyle = cText;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.font = '11px Inter, sans-serif';
      ctx.fillText(spec.x, padL + pw, h - 1);
      ctx.save();
      ctx.translate(11, padT + ph / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(spec.y, 0, 0);
      ctx.restore();

      // Series
      ctx.save();
      ctx.beginPath(); ctx.rect(padL, padT, pw, ph); ctx.clip();
      buffer.xs.forEach((xArr, i) => {
        const yArr = buffer.ys[i];
        if (xArr.length < 1) return;
        const s = spec.series[i];
        ctx.strokeStyle = s?.color ?? SERIES[i % SERIES.length];
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
        if (v.label) { ctx.fillStyle = cText; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = '10px Inter, sans-serif'; ctx.fillText(v.label, X(v.x) + 3, padT + 2); }
      }
      for (const m of buffer.markers) {
        ctx.fillStyle = m.color ?? cFg;
        ctx.beginPath(); ctx.arc(X(m.x), Y(m.y), 4, 0, Math.PI * 2); ctx.fill();
        if (m.label) { ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.font = '10px Inter, sans-serif'; ctx.fillText(m.label, X(m.x) + 6, Y(m.y) - 3); }
      }
      ctx.restore();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [buffer, height, spec]);

  return (
    <figure className="rounded-xl border border-line bg-panel p-3">
      <figcaption className="mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="text-[13px] font-semibold text-fg">{spec.title}</span>
        <span className="flex flex-wrap gap-3">
          {spec.series.map((s, i) => (
            <span key={s.label} className="flex items-center gap-1.5 text-[11px] text-fg-2">
              <span className="h-0.5 w-3.5 rounded" style={{ background: s.color ?? SERIES[i % SERIES.length] }} />{s.label}
            </span>
          ))}
        </span>
      </figcaption>
      <canvas ref={ref} style={{ width: '100%', height }} role="img" aria-label={`${spec.title}: ${spec.y} against ${spec.x}`} />
    </figure>
  );
}
