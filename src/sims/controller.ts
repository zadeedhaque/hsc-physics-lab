import { Engine } from '../engine/Engine';
import { GraphHub } from '../engine/graph';
import { defaults, sanitize, type Params, type ParamValue, type SimDefinition, type SimRuntime } from './types';

export interface ControllerState {
  params: Params;
  playing: boolean;
  speed: number;
}

const MAX_SUBSTEP = 1 / 240;

/**
 * Glue between one SimDefinition, its Three.js Engine and the React UI.
 * UI → controller: setParam / play / pause / reset / step / speed.
 * controller → UI: subscribe() for control state; readouts are polled.
 */
export class SimController {
  readonly def: SimDefinition;
  readonly engine: Engine;
  readonly graphs: GraphHub;
  readonly runtime: SimRuntime;
  private state: ControllerState;
  private listeners = new Set<() => void>();

  constructor(def: SimDefinition, host: HTMLElement, initial: Params = {}) {
    this.def = def;
    const params = { ...defaults(def.params) };
    for (const spec of def.params) if (spec.key in initial) params[spec.key] = sanitize(spec, initial[spec.key]);
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.state = { params, playing: !def.timeless && !def.startPaused && !reduced, speed: 1 };
    this.engine = new Engine(host, def.camera);
    this.graphs = new GraphHub(def.graphs);
    this.runtime = def.create({
      kit: this.engine.kit,
      graphs: this.graphs,
      params,
      requestPause: () => this.pause(),
      setParam: (key, value) => this.setParam(key, value),
    });
    this.engine.onFrame = this.frame;
  }

  private frame = (dtReal: number) => {
    const { playing, speed } = this.state;
    if (playing && !this.def.timeless) {
      this.advance(dtReal * speed);
      if (this.runtime.done?.()) this.pause();
    }
    this.runtime.render?.();
  };

  private advance(dt: number) {
    const n = Math.max(1, Math.ceil(dt / MAX_SUBSTEP));
    const h = dt / n;
    for (let i = 0; i < n; i++) this.runtime.step(h);
  }

  getState = () => this.state;
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private set(patch: Partial<ControllerState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  setParam(key: string, value: ParamValue) {
    const spec = this.def.params.find((p) => p.key === key);
    if (!spec) return;
    const params = { ...this.state.params, [key]: sanitize(spec, value) };
    this.set({ params });
    this.runtime.setParams(params);
  }

  applyValues(values: Params) {
    const params = { ...this.state.params };
    for (const spec of this.def.params) if (spec.key in values) params[spec.key] = sanitize(spec, values[spec.key]);
    this.set({ params });
    this.runtime.setParams(params);
  }

  play() {
    if (this.runtime.done?.()) this.reset();
    this.set({ playing: true });
  }
  pause() { this.set({ playing: false }); }
  toggle() { if (this.state.playing) this.pause(); else this.play(); }
  reset() {
    this.graphs.clearLive();
    this.runtime.reset();
  }
  restart() { this.reset(); this.set({ playing: true }); }
  /** Advance one 1/60 s frame (scaled by speed) while paused. */
  stepOnce() {
    if (this.runtime.done?.()) return;
    this.pause();
    this.advance((1 / 60) * this.state.speed);
  }
  setSpeed(speed: number) { this.set({ speed }); }

  dispose() {
    this.listeners.clear();
    this.runtime.dispose?.();
    this.engine.dispose();
  }
}
