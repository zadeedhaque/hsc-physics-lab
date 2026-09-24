import * as THREE from 'three';
import type { SceneKit } from '../engine/kit';
import { Label } from '../engine/kit';
import { fmt } from '../lib/num';

/** Short number formatter for substituted equations. */
export const n = (v: number, digits = 3) => fmt(v, digits);
/** Degrees → formatted string with ° */
export const degs = (radians: number, d = 1) => `${((radians * 180) / Math.PI).toFixed(d)}°`;

export function niceStep(span: number, target = 6) {
  if (!(span > 0)) return 1;
  const raw = span / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const r = raw / mag;
  return (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag;
}

/**
 * Measurement ruler along +x or +y with ticks labelled in physical units.
 * Rebuild by calling it again with the same group (old children are disposed).
 */
export function ruler(kit: SceneKit, group: THREE.Group, opts: {
  axis: 'x' | 'y';
  origin: [number, number, number];
  length: number; // physical length (e.g. metres)
  scale: number; // scene units per physical unit
  unit: string;
  target?: number; // desired tick count
  color?: string;
}) {
  kit.clearGroup(group);
  const { axis, origin, scale, unit } = opts;
  const length = Math.max(opts.length, 1e-6);
  const step = niceStep(length, opts.target ?? 6);
  const dir = axis === 'x' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const perp = axis === 'x' ? new THREE.Vector3(0, -1, 0) : new THREE.Vector3(-1, 0, 0);
  const o = new THREE.Vector3(...origin);
  const color = opts.color ?? '#64748b';
  const main = kit.line(color, [o, o.clone().addScaledVector(dir, length * scale)], { width: 1.5, opacity: 0.8 });
  group.add(main);
  for (let i = 0; i <= 200 && i * step <= length * (1 + 1e-9); i++) {
    const v = i * step;
    const p = o.clone().addScaledVector(dir, v * scale);
    const tick = kit.line(color, [p, p.clone().addScaledVector(perp, 0.15)], { width: 1.5, opacity: 0.8 });
    group.add(tick);
    const l = new Label(`${+v.toPrecision(6)}${v === 0 ? '' : ''}`, { small: true });
    l.position.copy(p.clone().addScaledVector(perp, 0.45));
    group.add(l);
  }
  const unitLabel = new Label(unit, { small: true, className: 'plain' });
  unitLabel.position.copy(o.clone().addScaledVector(dir, length * scale + 0.5).addScaledVector(perp, 0.45));
  group.add(unitLabel);
  return step;
}

/** A large matte ground slab with a subtle grid (top surface at y = 0). */
export function ground(kit: SceneKit, width = 60, depth = 20, color = '#1e293b', x = 0) {
  const slab = kit.box(width, 0.2, depth, color, { roughness: 0.95, metalness: 0 });
  slab.position.set(x, -0.1, 0);
  const g = kit.grid(Math.max(width, depth), Math.max(width, depth), 'xz', 0.001);
  g.position.x = x;
  return slab;
}

/**
 * Long straight floor along x with a tick every metre and a label every `labelEvery` metres,
 * so motion stays readable while the camera follows a moving body. Ticks are one draw call.
 */
export function distanceTrack(kit: SceneKit, x0 = -10, x1 = 300, opts: { depth?: number; labelEvery?: number; scale?: number; color?: string } = {}) {
  const depth = opts.depth ?? 3;
  const s = opts.scale ?? 1; // scene units per metre
  const every = opts.labelEvery ?? 5;
  const floor = kit.box((x1 - x0) * s + 4, 0.3, depth, opts.color ?? '#334155', { roughness: 0.95 });
  floor.position.set(((x0 + x1) / 2) * s, -0.15, 0);
  const flat: number[] = [];
  for (let m = Math.ceil(x0); m <= x1; m++) {
    const len = m % every === 0 ? 0.7 : 0.3;
    flat.push(m * s, 0.01, depth / 2 - 0.1, m * s, 0.01, depth / 2 - 0.1 - len);
    if (m % every === 0 && m >= 0) kit.label(`${m} m`, [m * s, 0, depth / 2 + 0.4], { small: true });
  }
  kit.segments('#64748b', { width: 1.5 }).setSegments(flat);
  return floor;
}

/** A simple cart (body + four wheels). Origin at the bottom centre of the wheels. */
export function cart(kit: SceneKit, color: string, w = 1.4, h = 0.5, d = 0.8) {
  const g = kit.add(new THREE.Group());
  const body = kit.box(w, h, d, color, { roughness: 0.5 });
  body.position.y = 0.18 + h / 2;
  g.add(body);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const wheel = kit.cylinder(0.16, 0.16, 0.1, '#1f2937', undefined, 20);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(sx * (w / 2 - 0.22), 0.16, sz * (d / 2 + 0.02));
    g.add(wheel);
  }
  return { group: g, body, height: 0.18 + h };
}

/** Throttled sampler: call tick(t) every step; returns true when a new graph sample should be pushed. */
export function sampler(interval = 1 / 30) {
  let next = 0;
  return {
    due(t: number) { if (t + 1e-9 >= next) { next = t + interval; return true; } return false; },
    reset() { next = 0; },
  };
}

/** Horizontal bar used as an energy / quantity meter in the scene. */
export class Bar3D extends THREE.Group {
  private fill: THREE.Mesh;
  private frame: THREE.Mesh;
  readonly label: Label;
  private maxH: number;
  constructor(kit: SceneKit, color: string, name: string, maxH = 4, width = 0.5) {
    super();
    this.maxH = maxH;
    this.frame = new THREE.Mesh(new THREE.BoxGeometry(width, maxH, width), kit.mat('#64748b', { opacity: 0.15 }));
    this.frame.position.y = maxH / 2;
    this.fill = new THREE.Mesh(new THREE.BoxGeometry(width * 0.9, 1, width * 0.9), kit.mat(color, { emissive: 0.3 }));
    this.add(this.frame, this.fill);
    this.label = new Label(name, { color, small: true });
    this.label.position.set(0, -0.35, 0);
    this.add(this.label);
    this.set(0);
  }
  /** fraction in [0, 1] */
  set(fraction: number) {
    const f = Math.max(0.0001, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
    this.fill.scale.y = f * this.maxH;
    this.fill.position.y = (f * this.maxH) / 2;
  }
}
