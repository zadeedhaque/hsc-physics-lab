import * as THREE from 'three';
import type { SceneKit } from '../engine/kit';
import { Label } from '../engine/kit';
import { C } from '../engine/colors';

/**
 * Schematic 3D circuit parts laid out on the x–y plane.
 * Wires are thick lines; charge carriers are dots whose speed is proportional to the branch current.
 */
export type P2 = [number, number];

export class CurrentPath {
  private pts: THREE.Vector3[];
  private cum: number[] = [0];
  private dots: THREE.InstancedMesh;
  private offset = 0;
  readonly length: number;
  private tmp = new THREE.Object3D();

  constructor(kit: SceneKit, path: P2[], color: string = C.current, spacing = 0.55, z = 0.12) {
    this.pts = path.map(([x, y]) => new THREE.Vector3(x, y, z));
    for (let i = 1; i < this.pts.length; i++) this.cum.push(this.cum[i - 1] + this.pts[i].distanceTo(this.pts[i - 1]));
    this.length = this.cum[this.cum.length - 1];
    const count = Math.max(1, Math.floor(this.length / spacing));
    this.dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 10, 8), kit.mat(color, { emissive: 0.6 }), count);
    kit.add(this.dots);
    this.advance(0);
  }

  private at(s: number, out: THREE.Vector3) {
    const L = this.length;
    s = ((s % L) + L) % L;
    let i = 1;
    while (i < this.cum.length - 1 && this.cum[i] < s) i++;
    const t = (s - this.cum[i - 1]) / Math.max(1e-9, this.cum[i] - this.cum[i - 1]);
    return out.copy(this.pts[i - 1]).lerp(this.pts[i], t);
  }

  /** Move dots by `speed` scene-units/s (sign = direction along the path). */
  advance(ds: number) {
    this.offset += ds;
    const n = this.dots.count;
    const step = this.length / n;
    for (let i = 0; i < n; i++) {
      this.at(i * step + this.offset, this.tmp.position);
      this.tmp.updateMatrix();
      this.dots.setMatrixAt(i, this.tmp.matrix);
    }
    this.dots.instanceMatrix.needsUpdate = true;
  }

  set visible(v: boolean) { this.dots.visible = v; }
}

/** Visual speed for a current (A) — proportional, clamped for readability. */
export const dotSpeed = (I: number) => Math.sign(I) * Math.min(5, Math.abs(I) * 2.5);

export function wire(kit: SceneKit, path: P2[], color = '#94a3b8') {
  return kit.line(color, path.map(([x, y]) => [x, y, 0] as [number, number, number]), { width: 4 });
}

/** Cell/battery centred at `at`, lying along the direction of `dir` ('x' or 'y'); + terminal toward +dir. */
export function battery(kit: SceneKit, at: P2, dir: 'x' | 'y', label = '') {
  const g = kit.add(new THREE.Group());
  g.position.set(at[0], at[1], 0);
  if (dir === 'x') g.rotation.z = -Math.PI / 2;
  const body = kit.cylinder(0.32, 0.32, 1.2, '#1f2937', { metalness: 0.3 });
  g.add(body);
  const band = kit.cylinder(0.33, 0.33, 0.35, '#f59e0b', { metalness: 0.3 });
  band.position.y = 0.42;
  g.add(band);
  const cap = kit.cylinder(0.12, 0.12, 0.14, '#d4d4d8', { metalness: 0.7 });
  cap.position.y = 0.66;
  g.add(cap);
  const plus = new Label('+', { color: C.positive, small: true });
  plus.position.set(0.45, 0.55, 0);
  g.add(plus);
  const minus = new Label('−', { color: C.negative, small: true });
  minus.position.set(0.45, -0.55, 0);
  g.add(minus);
  const l = new Label(label, { small: true });
  l.position.set(dir === 'x' ? 0 : -1.0, 0, 0);
  if (dir === 'x') l.position.set(-0.8, 0, 0);
  g.add(l);
  return { group: g, label: l };
}

/** Resistor with colour bands. Returns the body mesh so callers can make it glow with power. */
export function resistor(kit: SceneKit, at: P2, dir: 'x' | 'y', text = '') {
  const g = kit.add(new THREE.Group());
  g.position.set(at[0], at[1], 0);
  if (dir === 'x') g.rotation.z = -Math.PI / 2;
  const mat = kit.mat('#d6b98c', { roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.8, 6, 16), mat);
  g.add(body);
  ['#7c2d12', '#111827', '#dc2626', '#eab308'].forEach((c, i) => {
    const b = kit.cylinder(0.235, 0.235, 0.07, c);
    b.position.y = -0.3 + i * 0.18;
    g.add(b);
  });
  const label = new Label(text, { small: true });
  label.position.set(dir === 'x' ? 0.9 : 1.2, 0, 0);
  if (dir === 'x') label.position.set(-0.85, 0, 0);
  g.add(label);
  return { group: g, mat, label };
}

/** Small round meter (A or V or G) with a live reading. */
export function meter(kit: SceneKit, at: P2, symbol: string, offset: P2 = [0, 0.75]) {
  const disc = kit.cylinder(0.34, 0.34, 0.12, '#0f172a');
  disc.rotation.x = Math.PI / 2;
  disc.position.set(at[0], at[1], 0.05);
  const ring = kit.torus(0.34, 0.035, symbol === 'A' ? C.current : symbol === 'V' ? C.normal : C.acceleration);
  ring.position.set(at[0], at[1], 0.1);
  kit.label(symbol, [at[0], at[1], 0.2], { small: true, className: 'plain' });
  const reading = kit.label('', [at[0] + offset[0], at[1] + offset[1], 0.2], { color: symbol === 'A' ? C.current : symbol === 'V' ? C.normal : C.acceleration });
  return reading;
}

/** Map resistor power (W) to an emissive glow. */
export function glow(mat: THREE.MeshStandardMaterial, P: number, Pmax: number) {
  const f = Pmax > 0 ? Math.min(1, P / Pmax) : 0;
  mat.emissive.set('#f97316');
  mat.emissiveIntensity = 0.05 + 0.9 * f;
}

/**
 * Diode symbol (triangle + bar) centred at `at`. `dir` is the direction of conventional current
 * (anode → cathode). Returns the materials so callers can light it when it conducts.
 */
export function diode(kit: SceneKit, at: P2, dir: 'x+' | 'x-' | 'y+' | 'y-' | number, text = '', color = '#e2e8f0') {
  const g = kit.add(new THREE.Group());
  g.position.set(at[0], at[1], 0);
  // a number is the conduction direction as an angle from +x
  g.rotation.z = typeof dir === 'number' ? dir - Math.PI / 2 : { 'y+': 0, 'x-': Math.PI / 2, 'y-': Math.PI, 'x+': -Math.PI / 2 }[dir];
  const mat = kit.mat(color, { emissive: 0.1 });
  const tri = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.5, 3), mat);
  tri.rotation.y = Math.PI / 6;
  g.add(tri);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.08, 0.12), mat);
  bar.position.y = 0.27;
  g.add(bar);
  const label = new Label(text, { small: true });
  label.position.set(0.75, 0, 0);
  g.add(label);
  return { group: g, mat, label };
}

/** Light a diode (or LED) body: `on` in 0…1. */
export function lightUp(mat: THREE.MeshStandardMaterial, on: number, color = '#facc15') {
  mat.emissive.set(color);
  mat.emissiveIntensity = 0.08 + 0.9 * Math.max(0, Math.min(1, on));
}
