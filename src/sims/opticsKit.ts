import * as THREE from 'three';
import type { SceneKit } from '../engine/kit';

/**
 * Rotationally symmetric thin-lens mesh with its optical axis along x.
 * Convex lenses are thick in the middle, concave lenses thick at the rim.
 */
export function lensMesh(kit: SceneKit, height: number, convex: boolean, color = '#93c5fd') {
  const h = height / 2;
  const edge = convex ? 0.04 : 0.32;
  const centre = convex ? 0.35 : 0.06;
  const rings = 25, seg = 48;
  const halfWidth = (rho: number) => edge + (centre - edge) * (1 - (rho / h) ** 2);

  const positions: number[] = [];
  const indices: number[] = [];
  for (const side of [1, -1]) {
    const base = positions.length / 3;
    for (let i = 0; i < rings; i++) {
      const rho = (h * i) / (rings - 1);
      const w = halfWidth(rho) * side;
      for (let j = 0; j <= seg; j++) {
        const a = (j / seg) * Math.PI * 2;
        positions.push(w, rho * Math.cos(a), rho * Math.sin(a));
      }
    }
    for (let i = 0; i < rings - 1; i++) for (let j = 0; j < seg; j++) {
      const a = base + i * (seg + 1) + j, b = a + seg + 1;
      if (side > 0) indices.push(a, b, a + 1, b, b + 1, a + 1);
      else indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  // Rim band
  const base = positions.length / 3;
  const w = halfWidth(h);
  for (let j = 0; j <= seg; j++) {
    const a = (j / seg) * Math.PI * 2;
    positions.push(w, h * Math.cos(a), h * Math.sin(a), -w, h * Math.cos(a), h * Math.sin(a));
  }
  for (let j = 0; j < seg; j++) { const a = base + j * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  const mat = new THREE.MeshPhysicalMaterial({ color, transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0, side: THREE.DoubleSide, depthWrite: false });
  return kit.add(new THREE.Mesh(geom, mat));
}
