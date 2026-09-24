import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { C } from './colors';

export type V3 = THREE.Vector3 | [number, number, number];
export const v3 = (p: V3) => (Array.isArray(p) ? new THREE.Vector3(p[0], p[1], p[2]) : p);

const UP = new THREE.Vector3(0, 1, 0);

/* ───────────────────────────── Arrow ───────────────────────────── */

export interface ArrowOpts { radius?: number; head?: number; label?: string; opacity?: number }

/** Solid 3D vector arrow whose base, direction and length can be updated every frame. */
export class Arrow extends THREE.Group {
  private shaft: THREE.Mesh;
  private headMesh: THREE.Mesh;
  private headLen: number;
  readonly label?: Label;

  constructor(color: string, opts: ArrowOpts = {}) {
    super();
    const r = opts.radius ?? 0.035;
    this.headLen = opts.head ?? r * 6;
    const mat = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 0.35, roughness: 0.45, metalness: 0.1,
      transparent: (opts.opacity ?? 1) < 1, opacity: opts.opacity ?? 1,
    });
    this.shaft = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 12), mat);
    this.headMesh = new THREE.Mesh(new THREE.ConeGeometry(r * 2.6, this.headLen, 18), mat);
    this.add(this.shaft, this.headMesh);
    if (opts.label !== undefined) {
      this.label = new Label(opts.label, { color });
      this.add(this.label);
    }
  }

  /** Place the arrow from `origin` along `vec` (world units). Hidden when |vec| ≈ 0. */
  set(origin: V3, vec: V3, labelText?: string) {
    const o = v3(origin);
    const v = v3(vec);
    const len = v.length();
    if (!Number.isFinite(len) || len < 1e-4) { this.visible = false; return this; }
    this.visible = true;
    this.position.copy(o);
    this.quaternion.setFromUnitVectors(UP, v.clone().divideScalar(len));
    const hl = Math.min(this.headLen, len * 0.45);
    const sl = Math.max(len - hl, 1e-4);
    this.shaft.scale.set(1, sl, 1);
    this.shaft.position.y = sl / 2;
    this.headMesh.scale.setScalar(hl / this.headLen);
    this.headMesh.position.y = len - hl / 2;
    if (this.label) {
      this.label.position.set(0, len + 0.18, 0);
      if (labelText !== undefined) this.label.setText(labelText);
    }
    return this;
  }
}

/* ───────────────────────────── Label ───────────────────────────── */

export interface LabelOpts { color?: string; className?: string; small?: boolean }

/** HTML label pinned to a 3D point (crisp text, themed by CSS). */
export class Label extends CSS2DObject {
  private text = '';
  constructor(text: string, opts: LabelOpts = {}) {
    const el = document.createElement('div');
    el.className = `sim-label ${opts.small ? 'sim-label-sm' : ''} ${opts.className ?? ''}`;
    if (opts.color) el.style.setProperty('--label-color', opts.color);
    super(el);
    this.setText(text);
  }
  setText(t: string) {
    if (t !== this.text) { this.text = t; this.element.textContent = t; }
    return this;
  }
  setColor(color: string) { this.element.style.setProperty('--label-color', color); return this; }
  at(p: V3) { this.position.copy(v3(p)); return this; }
}

/* ───────────────────────────── Fat lines ───────────────────────────── */

export interface LineOpts { width?: number; dashed?: boolean; opacity?: number; dashSize?: number; gapSize?: number }

/** Screen-space-width polyline (WebGL's native lines are always 1 px). */
export class FatLine extends Line2 {
  constructor(color: string, opts: LineOpts = {}) {
    const mat = new LineMaterial({
      color: new THREE.Color(color).getHex(), linewidth: opts.width ?? 2.5, worldUnits: false,
      dashed: opts.dashed ?? false, dashSize: opts.dashSize ?? 0.15, gapSize: opts.gapSize ?? 0.1,
      transparent: (opts.opacity ?? 1) < 1, opacity: opts.opacity ?? 1,
    });
    super(new LineGeometry(), mat);
    this.frustumCulled = false;
  }
  setPoints(pts: ArrayLike<number> | V3[]) {
    let flat: number[];
    if (pts.length && (Array.isArray(pts[0]) || pts[0] instanceof THREE.Vector3)) {
      flat = [];
      for (const p of pts as V3[]) { const q = v3(p); flat.push(q.x, q.y, q.z); }
    } else flat = Array.from(pts as ArrayLike<number>);
    if (flat.length < 6 || flat.some((n) => !Number.isFinite(n))) { this.visible = false; return this; }
    this.visible = true;
    this.geometry.dispose();
    this.geometry = new LineGeometry();
    this.geometry.setPositions(flat);
    if ((this.material as LineMaterial).dashed) this.computeLineDistances();
    return this;
  }
  setColor(color: string) { (this.material as LineMaterial).color.set(color); return this; }
}

/** Many disconnected fat segments in one draw call (contours, field-line sets, ticks). */
export class FatSegments extends LineSegments2 {
  constructor(color: string, opts: LineOpts = {}) {
    const mat = new LineMaterial({
      color: new THREE.Color(color).getHex(), linewidth: opts.width ?? 1.5, worldUnits: false,
      dashed: opts.dashed ?? false, dashSize: opts.dashSize ?? 0.15, gapSize: opts.gapSize ?? 0.1,
      transparent: (opts.opacity ?? 1) < 1, opacity: opts.opacity ?? 1,
    });
    super(new LineSegmentsGeometry(), mat);
    this.frustumCulled = false;
  }
  /** flat = [x1,y1,z1, x2,y2,z2, ...] — pairs of endpoints. */
  setSegments(flat: number[]) {
    if (flat.length < 6 || flat.some((v) => !Number.isFinite(v))) { this.visible = false; return this; }
    this.visible = true;
    this.geometry.dispose();
    this.geometry = new LineSegmentsGeometry();
    this.geometry.setPositions(flat);
    if ((this.material as LineMaterial).dashed) this.computeLineDistances();
    return this;
  }
  /** Convert polylines to segment pairs. */
  setPolylines(lines: V3[][]) {
    const flat: number[] = [];
    for (const l of lines) for (let i = 0; i < l.length - 1; i++) { const a = v3(l[i]), b = v3(l[i + 1]); flat.push(a.x, a.y, a.z, b.x, b.y, b.z); }
    return this.setSegments(flat);
  }
  setColor(color: string) { (this.material as LineMaterial).color.set(color); return this; }
}

/** Rolling trail of recent positions. */
export class Trail extends FatLine {
  private pts: number[] = [];
  private max: number;
  private dirty = false;
  constructor(color: string, max = 600, opts: LineOpts = {}) {
    super(color, { width: 2, opacity: 0.85, ...opts });
    this.max = max;
    this.visible = false;
  }
  push(p: V3) {
    const q = v3(p);
    const n = this.pts.length;
    if (n >= 3) {
      const dx = q.x - this.pts[n - 3], dy = q.y - this.pts[n - 2], dz = q.z - this.pts[n - 1];
      if (dx * dx + dy * dy + dz * dz < 1e-6) return;
    }
    this.pts.push(q.x, q.y, q.z);
    if (this.pts.length > this.max * 3) this.pts.splice(0, this.pts.length - this.max * 3);
    this.dirty = true;
  }
  /** Rebuild geometry once per frame at most. */
  flush() { if (this.dirty) { this.setPoints(this.pts); this.dirty = false; } }
  clearPoints() { this.pts = []; this.visible = false; this.dirty = false; }
}

/* ───────────────────────────── SceneKit ───────────────────────────── */

export type MatOpts = { opacity?: number; emissive?: number; metalness?: number; roughness?: number; wireframe?: boolean; side?: THREE.Side };

/**
 * Helper façade handed to every simulation. Everything created through it is
 * parented under `root` and disposed automatically when the simulation unmounts.
 */
export class SceneKit {
  readonly root = new THREE.Group();
  readonly camera: THREE.PerspectiveCamera;
  /** Set by the Engine. */
  controls: OrbitControls | null = null;
  private pickables = new Map<THREE.Object3D, () => void>();
  private tickers = new Set<(dt: number) => void>();

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  add<T extends THREE.Object3D>(obj: T, parent: THREE.Object3D = this.root): T {
    parent.add(obj);
    return obj;
  }

  mat(color: string, o: MatOpts = {}) {
    return new THREE.MeshStandardMaterial({
      color, roughness: o.roughness ?? 0.55, metalness: o.metalness ?? 0.1,
      emissive: color, emissiveIntensity: o.emissive ?? 0.06,
      transparent: (o.opacity ?? 1) < 1, opacity: o.opacity ?? 1, wireframe: o.wireframe ?? false,
      side: o.side ?? THREE.FrontSide, depthWrite: (o.opacity ?? 1) >= 0.6,
    });
  }

  box(w: number, h: number, d: number, color: string, o?: MatOpts) {
    return this.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.mat(color, o)));
  }
  sphere(r: number, color: string, o?: MatOpts, seg = 32) {
    return this.add(new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)), this.mat(color, o)));
  }
  cylinder(rTop: number, rBottom: number, h: number, color: string, o?: MatOpts, seg = 32) {
    return this.add(new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), this.mat(color, o)));
  }
  torus(r: number, tube: number, color: string, o?: MatOpts) {
    return this.add(new THREE.Mesh(new THREE.TorusGeometry(r, tube, 16, 64), this.mat(color, o)));
  }
  plane(w: number, h: number, color: string, o?: MatOpts) {
    return this.add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.mat(color, { side: THREE.DoubleSide, ...o })));
  }

  arrow(color: string, opts?: ArrowOpts) { return this.add(new Arrow(color, opts)); }
  label(text: string, pos: V3 = [0, 0, 0], opts?: LabelOpts) { return this.add(new Label(text, opts)).at(pos); }
  line(color: string, pts: V3[] = [], opts?: LineOpts) {
    const l = this.add(new FatLine(color, opts));
    if (pts.length > 1) l.setPoints(pts);
    else l.visible = false;
    return l;
  }
  trail(color: string, max?: number, opts?: LineOpts) { return this.add(new Trail(color, max, opts)); }
  segments(color: string, opts?: LineOpts) { const s = this.add(new FatSegments(color, opts)); s.visible = false; return s; }

  /** Small cone used as a direction marker on field lines. */
  cone(color: string, r = 0.07, h = 0.2) {
    return this.add(new THREE.Mesh(new THREE.ConeGeometry(r, h, 12), this.mat(color, { emissive: 0.3 })));
  }

  /** Floor grid. plane 'xz' (floor) or 'xy' (back wall). */
  grid(size = 20, divisions = 20, plane: 'xz' | 'xy' = 'xz', y = 0) {
    const g = new THREE.GridHelper(size, divisions, 0x64748b, 0x64748b);
    const m = g.material as THREE.LineBasicMaterial;
    m.transparent = true;
    m.opacity = 0.22;
    m.depthWrite = false;
    if (plane === 'xy') g.rotation.x = Math.PI / 2;
    g.position.y = y;
    return this.add(g);
  }

  /** Labelled coordinate axes. */
  axes(len = 2, origin: V3 = [0, 0, 0], names: [string, string, string] | null = ['x', 'y', 'z'], dims: 2 | 3 = 3) {
    const g = this.add(new THREE.Group());
    g.position.copy(v3(origin));
    const dirs: [V3, string][] = [[[len, 0, 0], C.x], [[0, len, 0], C.y], [[0, 0, len], C.z]];
    dirs.slice(0, dims).forEach(([d, col], i) => {
      const a = new Arrow(col, { radius: 0.012 });
      a.set([0, 0, 0], d);
      g.add(a);
      if (names) {
        const l = new Label(names[i], { color: col, small: true });
        l.position.copy(v3(d).multiplyScalar(1.08));
        g.add(l);
      }
    });
    return g;
  }

  /** Pan camera + orbit target so world x = `x` stays centred (used to follow moving bodies). */
  followX(x: number, lerpFactor = 0.12) {
    if (!this.controls) return;
    const dx = (x - this.controls.target.x) * lerpFactor;
    if (Math.abs(dx) < 1e-5) return;
    this.controls.target.x += dx;
    this.camera.position.x += dx;
  }

  /** Register a mesh as clickable (used for toggles inside the scene). */
  pickable(obj: THREE.Object3D, onPick: () => void) { this.pickables.set(obj, onPick); }
  /** @internal */
  getPickables() { return this.pickables; }

  /** Purely visual per-frame animation (runs even when the physics is paused). */
  onFrame(fn: (dt: number) => void) { this.tickers.add(fn); }
  /** @internal */
  tick(dt: number) { this.tickers.forEach((f) => f(dt)); }

  /** Remove every child of `group` and free its GPU resources. */
  clearGroup(group: THREE.Object3D) {
    for (const child of [...group.children]) {
      group.remove(child);
      disposeTree(child);
    }
  }

  dispose() {
    disposeTree(this.root);
    this.pickables.clear();
    this.tickers.clear();
  }
}

export function disposeTree(obj: THREE.Object3D) {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else if (mat) {
      const tex = (mat as THREE.MeshBasicMaterial).map;
      if (tex) tex.dispose();
      mat.dispose();
    }
    if (o instanceof CSS2DObject) o.element.remove();
  });
  obj.removeFromParent();
}

/** Canvas-backed texture for things like interference patterns or spectra. */
export function canvasTexture(w: number, h: number) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { canvas, ctx, tex };
}

/** Helix / coil points along +x. */
export function coilPoints(turns: number, radius: number, length: number, segPerTurn = 32): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const n = Math.max(1, Math.round(turns * segPerTurn));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = t * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(-length / 2 + t * length, radius * Math.cos(a), radius * Math.sin(a)));
  }
  return pts;
}

/** Zig-zag spring from a to b (along any direction). */
export function springPoints(a: V3, b: V3, coils = 12, radius = 0.12): THREE.Vector3[] {
  const A = v3(a), B = v3(b);
  const axis = B.clone().sub(A);
  const len = axis.length();
  const dir = len > 1e-9 ? axis.clone().divideScalar(len) : new THREE.Vector3(1, 0, 0);
  const tmp = Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const n1 = new THREE.Vector3().crossVectors(dir, tmp).normalize();
  const n2 = new THREE.Vector3().crossVectors(dir, n1).normalize();
  const pts: THREE.Vector3[] = [A.clone()];
  const lead = 0.08;
  const n = coils * 24;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const ang = t * coils * Math.PI * 2;
    const along = lead + t * (1 - 2 * lead);
    pts.push(A.clone().addScaledVector(dir, along * len).addScaledVector(n1, Math.cos(ang) * radius).addScaledVector(n2, Math.sin(ang) * radius));
  }
  pts.push(B.clone());
  return pts;
}
