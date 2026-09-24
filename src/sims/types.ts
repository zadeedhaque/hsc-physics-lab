import type { SceneKit } from '../engine/kit';
import type { GraphHub, GraphSpec } from '../engine/graph';
import type { CameraSpec } from '../engine/Engine';

export type ParamValue = number | boolean | string;
export type Params = Record<string, ParamValue>;

interface BaseParam {
  key: string;
  label: string;
  hint?: string;
  /** Hide this control unless the predicate holds (e.g. drag coefficient only when drag is on). */
  showIf?: (p: Params) => boolean;
}
export interface SliderParam extends BaseParam {
  kind: 'slider';
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
  /** Decimals shown in the value readout. */
  decimals?: number;
}
export interface ToggleParam extends BaseParam { kind: 'toggle'; default: boolean }
export interface SelectParam extends BaseParam { kind: 'select'; default: string; options: { value: string; label: string }[] }
export interface TextParam extends BaseParam { kind: 'text'; default: string; placeholder?: string; inputMode?: 'decimal' | 'text' }
export type ParamSpec = SliderParam | ToggleParam | SelectParam | TextParam;

export interface Preset { label: string; values: Params }

export type Tone = 'default' | 'accent' | 'good' | 'warn' | 'bad';
export interface Readout { label: string; value: number | string; unit?: string; digits?: number; tone?: Tone }

/** An equation line: symbolic form plus (optionally) the same equation with live numbers substituted. */
export interface Equation { expr: string; sub?: string; note?: string }

export interface Learn {
  concept: string;
  variables: [symbol: string, meaning: string][];
  observe: string[];
  challenge: string;
}

export interface SimAction { id: string; label: string; primary?: boolean; run: () => void }

export interface SimContext {
  kit: SceneKit;
  graphs: GraphHub;
  params: Params;
  /** Ask the host to pause (e.g. projectile has landed). */
  requestPause: () => void;
  /** Change a parameter from inside the scene (e.g. clicking a 3D switch); the panel stays in sync. */
  setParam?: (key: string, value: ParamValue) => void;
}

/** What a simulation module returns when mounted. The host drives it. */
export interface SimRuntime {
  /** Advance the physics by dt seconds of simulated time (called in small sub-steps; keep it cheap). */
  step(dt: number): void;
  /** Sync visuals + graphs to the physics state. Called once per animation frame, also while paused. */
  render?(): void;
  /** Parameters changed — recompute derived quantities / geometry. */
  setParams(p: Params): void;
  /** Return to t = 0 with the current parameters. */
  reset(): void;
  readouts(): Readout[];
  equations(): Equation[];
  /** Extra buttons (e.g. "Launch", "Fire"). */
  actions?: () => SimAction[];
  /** True when the run has finished; pressing Play will reset first. */
  done?(): boolean;
  /** Simulated time (s) — shown in the viewport HUD. */
  time?(): number;
  dispose?(): void;
}

export interface SimDefinition {
  params: ParamSpec[];
  presets?: Preset[];
  graphs?: GraphSpec[];
  learn: Learn;
  camera: CameraSpec;
  /** Static calculators with no time evolution hide the play controls. */
  timeless?: boolean;
  /** Start paused (e.g. wait for "Launch"). */
  startPaused?: boolean;
  /** One-line hint rendered over the viewport. */
  hint?: string;
  create(ctx: SimContext): SimRuntime;
}

/** Helpers to read typed params. */
export const num = (p: Params, k: string) => {
  const v = p[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
};
export const bool = (p: Params, k: string) => p[k] === true;
export const str = (p: Params, k: string) => String(p[k] ?? '');

export function defaults(specs: ParamSpec[]): Params {
  const out: Params = {};
  for (const s of specs) out[s.key] = s.default;
  return out;
}

/** Clamp/validate a raw value against its spec so impossible values never reach the physics. */
export function sanitize(spec: ParamSpec, v: ParamValue): ParamValue {
  switch (spec.kind) {
    case 'slider': {
      const n = typeof v === 'number' ? v : parseFloat(String(v));
      if (!Number.isFinite(n)) return spec.default;
      const clamped = Math.min(spec.max, Math.max(spec.min, n));
      // snap to the slider step (typed values like 3.5 on an integer slider are rounded)
      const snapped = spec.min + Math.round((clamped - spec.min) / spec.step) * spec.step;
      const decimals = (String(spec.step).split('.')[1] ?? '').length + 2;
      return Math.min(spec.max, Math.max(spec.min, Number(snapped.toFixed(decimals))));
    }
    case 'toggle': return v === true || v === 'true';
    case 'select': return spec.options.some((o) => o.value === v) ? String(v) : spec.default;
    case 'text': return String(v).slice(0, 64);
  }
}

export type { GraphSpec };
