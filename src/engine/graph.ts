/**
 * Graph data buffers. Simulations write samples here from their real state;
 * the <Graph> component only reads, so graphs can never drift from the physics.
 */
export interface GraphSeriesSpec { label: string; color?: string; dashed?: boolean }

export interface GraphSpec {
  id: string;
  title: string;
  x: string; // axis label incl. unit, e.g. "t (s)"
  y: string;
  series: GraphSeriesSpec[];
  /** live = time-series appended while running; curve = full curve replaced on param change */
  kind?: 'live' | 'curve';
  /** For live graphs: width of the visible x-window. */
  window?: number;
  xRange?: [number, number];
  yRange?: [number, number];
  /** Always include y = 0 in the auto range. */
  zeroY?: boolean;
}

export interface Marker { x: number; y: number; label?: string; color?: string }

export class GraphBuffer {
  readonly spec: GraphSpec;
  xs: number[][];
  ys: number[][];
  markers: Marker[] = [];
  vlines: { x: number; label?: string }[] = [];
  version = 0;
  private max = 4000;

  constructor(spec: GraphSpec) {
    this.spec = spec;
    this.xs = spec.series.map(() => []);
    this.ys = spec.series.map(() => []);
  }

  /** Append one sample to every series (live graphs). Non-finite values are skipped. */
  push(x: number, ...ys: number[]) {
    if (!Number.isFinite(x)) return;
    ys.forEach((y, i) => {
      if (i >= this.ys.length || !Number.isFinite(y)) return;
      this.xs[i].push(x);
      this.ys[i].push(y);
      if (this.xs[i].length > this.max) {
        this.xs[i].splice(0, this.xs[i].length - this.max);
        this.ys[i].splice(0, this.ys[i].length - this.max);
      }
    });
    this.version++;
  }

  /** Replace one series with a full curve. A NaN y-value breaks the line (e.g. at an asymptote). */
  setSeries(i: number, xs: number[], ys: number[]) {
    if (i >= this.xs.length) return;
    const fx: number[] = [], fy: number[] = [];
    for (let j = 0; j < Math.min(xs.length, ys.length); j++) {
      if (Number.isFinite(xs[j]) && Number.isFinite(ys[j])) { fx.push(xs[j]); fy.push(ys[j]); }
      else if (Number.isNaN(ys[j]) && fx.length) { fx.push(fx[fx.length - 1]); fy.push(NaN); }
    }
    this.xs[i] = fx;
    this.ys[i] = fy;
    this.version++;
  }

  /** Sample a function over [x0, x1] into series i. */
  plot(i: number, x0: number, x1: number, f: (x: number) => number, n = 200) {
    const xs: number[] = [], ys: number[] = [];
    for (let j = 0; j <= n; j++) { const x = x0 + ((x1 - x0) * j) / n; xs.push(x); ys.push(f(x)); }
    this.setSeries(i, xs, ys);
  }

  setMarkers(m: Marker[]) { this.markers = m.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)); this.version++; }
  setVLines(v: { x: number; label?: string }[]) { this.vlines = v.filter((p) => Number.isFinite(p.x)); this.version++; }

  clear() {
    this.xs = this.spec.series.map(() => []);
    this.ys = this.spec.series.map(() => []);
    this.markers = [];
    this.vlines = [];
    this.version++;
  }
}

export class GraphHub {
  readonly buffers = new Map<string, GraphBuffer>();
  constructor(specs: GraphSpec[] = []) {
    for (const s of specs) this.buffers.set(s.id, new GraphBuffer(s));
  }
  /** Get a buffer; returns a detached no-op buffer for unknown ids so sims never crash. */
  get(id: string): GraphBuffer {
    return this.buffers.get(id) ?? new GraphBuffer({ id, title: '', x: '', y: '', series: [] });
  }
  clearLive() {
    for (const b of this.buffers.values()) if ((b.spec.kind ?? 'live') === 'live') b.clear();
  }
}
