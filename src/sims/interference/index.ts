import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { bool, num } from '../types';
import { C } from '../../engine/colors';
import { n } from '../shared';

const W = 12, H = 8; // tank size (cm, 1 scene unit = 1 cm)

const sim: SimDefinition = {
  camera: { position: [0, 11, 7], target: [0, 0, 0], aspect: 1.5 },
  hint: 'Bright lines (antinodes) are where the path difference is a whole number of wavelengths; calm lines (nodes) where it is an odd number of half-wavelengths.',
  params: [
    { kind: 'slider', key: 'lambda', label: 'Wavelength λ', unit: 'cm', min: 0.4, max: 3, step: 0.05, default: 1.2 },
    { kind: 'slider', key: 'd', label: 'Source separation d', unit: 'cm', min: 0.5, max: 6, step: 0.1, default: 3 },
    { kind: 'slider', key: 'phi', label: 'Phase difference between sources', unit: '°', min: 0, max: 360, step: 15, default: 0 },
    { kind: 'slider', key: 'px', label: 'Probe x', unit: 'cm', min: -5.5, max: 5.5, step: 0.1, default: 2 },
    { kind: 'slider', key: 'pz', label: 'Probe distance from sources', unit: 'cm', min: 0.5, max: 7.5, step: 0.1, default: 5 },
    { kind: 'toggle', key: 'lines', label: 'Show nodal lines', default: true },
  ],
  presets: [
    { label: 'In phase', values: { phi: 0, d: 3, lambda: 1.2 } },
    { label: 'Antiphase', values: { phi: 180 } },
    { label: 'Close sources', values: { d: 1 } },
    { label: 'Short waves', values: { lambda: 0.6 } },
  ],
  graphs: [
    { id: 'A', title: 'Resultant amplitude along a line 7 cm from the sources', x: 'x (cm)', y: 'amplitude', kind: 'curve', xRange: [-6, 6], yRange: [0, 2.1], series: [{ label: '|A₁ + A₂|', color: C.accent }] },
  ],
  learn: {
    concept: 'Two coherent sources produce waves that overlap and interfere. At a point where the path difference Δ = |r₁ − r₂| is a whole number of wavelengths the waves arrive in phase (constructive); where it is (n + ½)λ they cancel (destructive). The result is a fixed pattern of antinodal and nodal lines — the basis of Young’s experiment.',
    variables: [['r₁, r₂', 'distances from the two sources'], ['Δ', 'path difference r₁ − r₂'], ['λ', 'wavelength'], ['φ', 'phase difference between the sources']],
    observe: [
      'The centre line is bright when the sources are in phase and dark when they are in antiphase.',
      'Moving the sources further apart packs the lines closer together.',
      'Longer wavelength → fewer, more widely spaced lines.',
    ],
    challenge: 'Place the probe on the first dark line beside the centre. Check that the path difference there is λ/2.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0;
    const mat = new THREE.ShaderMaterial({
      transparent: true, side: THREE.DoubleSide,
      uniforms: { uT: { value: 0 }, uK: { value: 5 }, uD: { value: 3 }, uPhi: { value: 0 }, uW: { value: W }, uH: { value: H } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        varying vec2 vUv; uniform float uT, uK, uD, uPhi, uW, uH;
        void main(){
          float x = (vUv.x - 0.5) * uW; float z = (1.0 - vUv.y) * uH;
          float r1 = length(vec2(x + uD * 0.5, z)); float r2 = length(vec2(x - uD * 0.5, z));
          float w = cos(uK * r1 - uT * 5.0) + cos(uK * r2 - uT * 5.0 + uPhi);
          float a = w * 0.5;
          vec3 base = vec3(0.05, 0.25, 0.55);
          gl_FragColor = vec4(base + vec3(0.35, 0.6, 0.9) * (0.5 + 0.5 * a), 0.92);
        }`,
    });
    const tank = kit.add(new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat));
    tank.rotation.x = -Math.PI / 2;
    const s1 = kit.sphere(0.2, C.positive, { emissive: 0.5 });
    const s2 = kit.sphere(0.2, C.positive, { emissive: 0.5 });
    const probe = kit.sphere(0.18, C.weight, { emissive: 0.6 });
    const r1l = kit.line('#e2e8f0', [], { width: 1.2, dashed: true });
    const r2l = kit.line('#e2e8f0', [], { width: 1.2, dashed: true });
    const nodal = kit.segments('#0f172a', { width: 1.5, opacity: 0.7 });
    const plabel = kit.label('', [0, 0, 0], { color: C.weight, small: true });
    // tank plane spans x ∈ [−6, 6], z ∈ [−4, 4]; sources at the back edge (z = −4)
    const Z0 = -H / 2;

    function build() {
      mat.uniforms.uK.value = (2 * Math.PI) / num(p, 'lambda');
      mat.uniforms.uD.value = num(p, 'd');
      mat.uniforms.uPhi.value = (num(p, 'phi') * Math.PI) / 180;
      s1.position.set(-num(p, 'd') / 2, 0.2, Z0);
      s2.position.set(num(p, 'd') / 2, 0.2, Z0);
      // nodal lines: points where r₁ − r₂ = (m + ½)λ + φλ/2π (hyperbolae)
      const flat: number[] = [];
      if (bool(p, 'lines')) {
        const lam = num(p, 'lambda'), d = num(p, 'd'), shift = (num(p, 'phi') / 360) * lam;
        for (let m = -10; m <= 10; m++) {
          const delta = (m + 0.5) * lam + shift; // k(r₁ − r₂) − φ = (2m + 1)π
          if (Math.abs(delta) >= d) continue;
          let prev: THREE.Vector3 | null = null;
          for (let z = 0.05; z <= H; z += 0.1) {
            // solve r1 − r2 = delta for x by bisection
            let lo = -W, hi = W;
            const fx = (x: number) => Math.hypot(x + d / 2, z) - Math.hypot(x - d / 2, z) - delta;
            if (fx(lo) * fx(hi) > 0) { prev = null; continue; }
            for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (fx(lo) * fx(mid) <= 0) hi = mid; else lo = mid; }
            const x = (lo + hi) / 2;
            if (Math.abs(x) > W / 2) { prev = null; continue; }
            const pt = new THREE.Vector3(x, 0.03, Z0 + z);
            if (prev) flat.push(prev.x, prev.y, prev.z, pt.x, pt.y, pt.z);
            prev = pt;
          }
        }
      }
      if (flat.length) nodal.setSegments(flat); else nodal.visible = false;
      graphs.get('A').plot(0, -6, 6, (x) => amp(x, 7), 400);
    }
    const amp = (x: number, z: number) => {
      const k = (2 * Math.PI) / num(p, 'lambda'), d = num(p, 'd');
      const ph = k * (Math.hypot(x + d / 2, z) - Math.hypot(x - d / 2, z)) - (num(p, 'phi') * Math.PI) / 180;
      return Math.abs(2 * Math.cos(ph / 2));
    };
    build();

    return {
      setParams(np) { p = np; build(); },
      reset() { t = 0; },
      step(dt) { t += dt; },
      render() {
        mat.uniforms.uT.value = t;
        const P = new THREE.Vector3(num(p, 'px'), 0.2, Z0 + num(p, 'pz'));
        probe.position.copy(P);
        r1l.setPoints([s1.position, P]); r2l.setPoints([s2.position, P]);
        const d = num(p, 'd');
        const r1 = Math.hypot(num(p, 'px') + d / 2, num(p, 'pz')), r2 = Math.hypot(num(p, 'px') - d / 2, num(p, 'pz'));
        plabel.at(P.clone().add(new THREE.Vector3(0, 0.6, 0))).setText(`Δ = ${n(Math.abs(r1 - r2) / num(p, 'lambda'))} λ`);
      },
      time: () => t,
      readouts(): Readout[] {
        const d = num(p, 'd'), lam = num(p, 'lambda');
        const r1 = Math.hypot(num(p, 'px') + d / 2, num(p, 'pz')), r2 = Math.hypot(num(p, 'px') - d / 2, num(p, 'pz'));
        const A = amp(num(p, 'px'), num(p, 'pz'));
        return [
          { label: 'Distance r₁', value: r1, unit: 'cm' },
          { label: 'Distance r₂', value: r2, unit: 'cm' },
          { label: 'Path difference Δ', value: Math.abs(r1 - r2), unit: 'cm', tone: 'accent' },
          { label: 'Δ in wavelengths', value: Math.abs(r1 - r2) / lam, tone: 'accent' },
          { label: 'Resultant amplitude (max 2)', value: A },
          { label: 'At the probe', value: A > 1.8 ? 'Constructive (antinode)' : A < 0.2 ? 'Destructive (node)' : 'Partial' },
        ];
      },
      equations(): Equation[] {
        return [
          { expr: 'Constructive: Δ = nλ ,  Destructive: Δ = (n + ½)λ', note: 'For sources in phase.' },
          { expr: 'Phase difference = 2πΔ/λ + φ' },
          { expr: 'A = 2a |cos(δ/2)|' },
        ];
      },
    };
  },
};

export default sim;
