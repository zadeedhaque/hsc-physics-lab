import * as THREE from 'three';
import type { SceneKit } from '../engine/kit';
import { gauss, rng } from '../lib/num';

/**
 * Ideal-gas particle box: point particles bouncing elastically off the walls of an
 * axis-aligned box. Works in whatever units the caller chooses (positions and speeds
 * just need to be consistent). Tracks the impulse delivered to the walls so pressure can
 * be *measured* from collisions rather than assumed.
 */
export class ParticleBox {
  readonly mesh: THREE.InstancedMesh;
  pos: Float64Array;
  vel: Float64Array;
  count = 0;
  half = new THREE.Vector3(1, 1, 1);
  /** Sum of |Δp| delivered to all walls since the last reset of the counter (units: mass·speed). */
  impulse = 0;
  private rand = rng(1);
  private tmp = new THREE.Object3D();
  private col = new THREE.Color();
  private slow = new THREE.Color('#3b82f6');
  private fast = new THREE.Color('#f97316');

  constructor(kit: SceneKit, readonly max: number, radius = 0.08) {
    this.pos = new Float64Array(max * 3);
    this.vel = new Float64Array(max * 3);
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(radius, 10, 8), new THREE.MeshStandardMaterial({ roughness: 0.4 }), max);
    this.mesh.count = 0;
    kit.add(this.mesh);
  }

  seed(s: number) { this.rand = rng(s); }

  /** Place n particles uniformly in the box with Maxwellian velocities of standard deviation sigma per axis. */
  fill(n: number, sigma: number) {
    this.count = Math.min(n, this.max);
    const r = this.rand;
    for (let i = 0; i < this.count; i++) {
      for (let a = 0; a < 3; a++) {
        const h = this.half.getComponent(a);
        this.pos[i * 3 + a] = (r() * 2 - 1) * h * 0.95;
        this.vel[i * 3 + a] = gauss(r) * sigma;
      }
    }
    this.mesh.count = this.count;
    this.impulse = 0;
  }

  /** Rescale all speeds by a factor (e.g. after a temperature change). */
  scaleSpeeds(f: number) { for (let i = 0; i < this.count * 3; i++) this.vel[i] *= f; }

  setHalf(hx: number, hy: number, hz: number) {
    this.half.set(hx, hy, hz);
    for (let i = 0; i < this.count; i++) for (let a = 0; a < 3; a++) {
      const h = this.half.getComponent(a);
      const k = i * 3 + a;
      if (this.pos[k] > h) this.pos[k] = h;
      if (this.pos[k] < -h) this.pos[k] = -h;
    }
  }

  /** Advance by dt; returns nothing, accumulates wall impulse (per unit particle mass). */
  step(dt: number) {
    for (let i = 0; i < this.count; i++) {
      for (let a = 0; a < 3; a++) {
        const k = i * 3 + a;
        const h = this.half.getComponent(a);
        let x = this.pos[k] + this.vel[k] * dt;
        let v = this.vel[k];
        if (x > h) { x = 2 * h - x; v = -Math.abs(v); this.impulse += 2 * Math.abs(v); }
        else if (x < -h) { x = -2 * h - x; v = Math.abs(v); this.impulse += 2 * Math.abs(v); }
        this.pos[k] = x;
        this.vel[k] = v;
      }
    }
  }

  speed(i: number) { const k = i * 3; return Math.hypot(this.vel[k], this.vel[k + 1], this.vel[k + 2]); }

  meanSquareSpeed() {
    let s = 0;
    for (let i = 0; i < this.count; i++) { const v = this.speed(i); s += v * v; }
    return this.count ? s / this.count : 0;
  }

  /** Update instance matrices; colour by speed relative to vRef (blue slow → orange fast). */
  render(scale: number, vRef: number) {
    for (let i = 0; i < this.count; i++) {
      const k = i * 3;
      this.tmp.position.set(this.pos[k] * scale, this.pos[k + 1] * scale, this.pos[k + 2] * scale);
      this.tmp.updateMatrix();
      this.mesh.setMatrixAt(i, this.tmp.matrix);
      const f = Math.min(1, this.speed(i) / (2 * vRef || 1));
      this.col.copy(this.slow).lerp(this.fast, f);
      this.mesh.setColorAt(i, this.col);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

/** Wireframe box edges for a container of half-extents (hx, hy, hz). */
export function boxEdges(hx: number, hy: number, hz: number): number[] {
  const c = [-1, 1];
  const out: number[] = [];
  for (const y of c) for (const z of c) out.push(-hx, y * hy, z * hz, hx, y * hy, z * hz);
  for (const x of c) for (const z of c) out.push(x * hx, -hy, z * hz, x * hx, hy, z * hz);
  for (const x of c) for (const y of c) out.push(x * hx, y * hy, -hz, x * hx, y * hy, hz);
  return out;
}
