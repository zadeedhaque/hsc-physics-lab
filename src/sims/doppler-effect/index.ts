import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num } from '../types';
import { doppler } from '../../physics/waves';
import { C } from '../../engine/colors';
import { n } from '../shared';

/*
 * Scaled "ripple tank" for sound: wavefronts spread at the speed of sound; the source emits a
 * crest every 1/f′ of display time. Speeds are shown as fractions of the sound speed so the
 * geometry (bunching, Mach cone) is exact while the display stays slow enough to watch.
 */
const V_DISPLAY = 3; // scene units per display-second for the sound speed

const sim: SimDefinition = {
  camera: { position: [0, 15, 7], target: [0, 0, 0], aspect: 1.5 },
  hint: 'Crests bunch up in front of a moving source (higher pitch) and spread out behind it (lower pitch).',
  params: [
    { kind: 'slider', key: 'f', label: 'Source frequency', unit: 'Hz', min: 100, max: 1000, step: 10, default: 500 },
    { kind: 'slider', key: 'v', label: 'Speed of sound', unit: 'm/s', min: 300, max: 360, step: 1, default: 340 },
    { kind: 'slider', key: 'vs', label: 'Source speed (→ toward observer)', unit: 'm/s', min: -300, max: 500, step: 5, default: 100 },
    { kind: 'slider', key: 'vo', label: 'Observer speed (← toward source)', unit: 'm/s', min: -200, max: 200, step: 5, default: 0 },
  ],
  presets: [
    { label: 'Ambulance approaching', values: { vs: 30, vo: 0, f: 700 } },
    { label: 'Source moving away', values: { vs: -80, vo: 0 } },
    { label: 'Observer running toward', values: { vs: 0, vo: 60 } },
    { label: 'Sound barrier (Mach 1)', values: { vs: 340, v: 340, vo: 0 } },
    { label: 'Supersonic (Mach 1.4)', values: { vs: 476, v: 340, vo: 0 } },
  ],
  graphs: [
    { id: 'f', title: 'Heard frequency vs source speed', x: 'v_s (m/s)', y: 'f′ (Hz)', kind: 'curve', xRange: [-300, 320], zeroY: true, series: [{ label: 'approaching (+)/receding (−)', color: C.accent }] },
  ],
  learn: {
    concept: 'When a source of sound moves toward an observer, successive crests are emitted closer together, so the observer hears a higher frequency; moving away gives a lower frequency. An observer moving toward the source meets crests more often. f′ = f (v + v_o)/(v − v_s).',
    variables: [['f', 'source frequency (Hz)'], ['f′', 'observed frequency (Hz)'], ['v', 'speed of sound (m/s)'], ['v_s', 'source speed toward observer'], ['v_o', 'observer speed toward source']],
    observe: [
      'Wavefronts are circles centred where each crest was emitted.',
      'In front of the source the wavelength is shorter; behind it longer.',
      'At v_s = v the crests pile up into a shock front (sonic boom).',
      'Above the speed of sound the wavefronts form a Mach cone.',
    ],
    challenge: 'A 700 Hz siren approaches at 30 m/s. What frequency do you hear? What do you hear after it passes?',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0, lastEmit = 0;
    let fronts: { x: number; t0: number; mesh: THREE.Mesh }[] = [];
    const source = kit.sphere(0.25, C.acceleration, { emissive: 0.4 });
    const observer = kit.box(0.4, 0.8, 0.4, C.normal);
    const ring = new THREE.RingGeometry(0.97, 1, 96);
    const group = kit.add(new THREE.Group());
    const vsArrow = kit.arrow(C.velocity, { label: 'v_s' });
    const ear = kit.label('', [0, 0, 0], { color: C.normal });
    const cone = kit.line(C.friction, [], { width: 2, dashed: true });
    kit.grid(30, 30, 'xz', -0.3);

    const mach = () => num(p, 'vs') / num(p, 'v');
    const srcX = () => -8 + mach() * V_DISPLAY * t;
    const obsX = () => 8 - (num(p, 'vo') / num(p, 'v')) * V_DISPLAY * t;
    // display emission rate: 3 crests per display-second (the real f sets the numbers)
    const EMIT = 3;

    function reset() {
      t = 0; lastEmit = -1;
      fronts.forEach((f) => { group.remove(f.mesh); (f.mesh.material as THREE.Material).dispose(); });
      fronts = [];
      graphs.get('f').plot(0, -300, Math.min(320, num(p, 'v') - 10), (vs) => doppler(num(p, 'f'), num(p, 'v'), num(p, 'vo'), vs), 200);
      graphs.get('f').setMarkers(num(p, 'vs') < num(p, 'v') ? [{ x: num(p, 'vs'), y: doppler(num(p, 'f'), num(p, 'v'), num(p, 'vo'), num(p, 'vs')), color: C.accent }] : []);
    }
    reset();

    return {
      setParams(np) { p = np; reset(); },
      reset,
      step(dt) {
        t += dt;
        if (t - lastEmit >= 1 / EMIT) {
          lastEmit = t;
          const mesh = new THREE.Mesh(ring, new THREE.MeshBasicMaterial({ color: C.accent, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
          mesh.rotation.x = -Math.PI / 2;
          group.add(mesh);
          fronts.push({ x: srcX(), t0: t, mesh });
        }
        const keep: typeof fronts = [];
        for (const f of fronts) {
          const r = (t - f.t0) * V_DISPLAY;
          if (r > 22) { group.remove(f.mesh); (f.mesh.material as THREE.Material).dispose(); continue; }
          keep.push(f);
        }
        fronts = keep;
        if (srcX() > 14 || srcX() < -14) reset();
      },
      render() {
        for (const f of fronts) {
          const r = Math.max(0.01, (t - f.t0) * V_DISPLAY);
          f.mesh.position.set(f.x, 0, 0);
          f.mesh.scale.setScalar(r);
          (f.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0.1, 0.9 - r / 25);
        }
        source.position.set(srcX(), 0, 0);
        observer.position.set(obsX(), 0.4, 0);
        vsArrow.set([srcX(), 0.6, 0], [mach() * 1.5, 0, 0], `v_s = ${n(num(p, 'vs'))} m/s`);
        const heard = doppler(num(p, 'f'), num(p, 'v'), num(p, 'vo'), num(p, 'vs'));
        ear.at([obsX(), 1.4, 0]).setText(Number.isFinite(heard) && num(p, 'vs') < num(p, 'v') ? `hears ${n(heard)} Hz` : 'shock wave');
        if (mach() > 1) {
          const half = Math.asin(1 / mach());
          const L = 12;
          cone.setPoints([[srcX() - L * Math.cos(half), 0.02, L * Math.sin(half)], [srcX(), 0.02, 0], [srcX() - L * Math.cos(half), 0.02, -L * Math.sin(half)]]);
        } else cone.visible = false;
      },
      dispose() { fronts.forEach((f) => (f.mesh.material as THREE.Material).dispose()); ring.dispose(); },
      time: () => t,
      readouts(): Readout[] {
        const f = num(p, 'f'), v = num(p, 'v'), vs = num(p, 'vs'), vo = num(p, 'vo');
        const sub = vs < v;
        const heard = doppler(f, v, vo, vs);
        return [
          { label: 'Frequency heard f′', value: sub ? heard : 'shock wave (v_s ≥ v)', unit: sub ? 'Hz' : undefined, tone: 'accent' },
          { label: 'Wavelength in front', value: sub ? (v - vs) / f : 0, unit: 'm' },
          { label: 'Wavelength behind', value: (v + vs) / f, unit: 'm' },
          (() => { const after = doppler(f, v, -vo, -vs); return Number.isFinite(after) ? { label: 'Frequency heard after passing', value: after, unit: 'Hz' } : { label: 'Frequency heard after passing', value: 'shock wave' }; })(),
          { label: 'Mach number v_s/v', value: vs / v },
          { label: 'Mach cone half-angle', value: vs > v ? (Math.asin(v / vs) * 180) / Math.PI : 'no cone', unit: vs > v ? '°' : undefined },
        ];
      },
      equations(): Equation[] {
        const f = num(p, 'f'), v = num(p, 'v'), vs = num(p, 'vs'), vo = num(p, 'vo');
        return [
          { expr: 'f′ = f (v + v_o) / (v − v_s)', sub: vs < v ? `= ${n(f)} × (${n(v)} + ${n(vo)}) / (${n(v)} − ${n(vs)}) = ${n(doppler(f, v, vo, vs))} Hz` : 'no steady tone for v_s ≥ v (shock wave)' },
          { expr: 'λ_front = (v − v_s) / f' },
          { expr: 'sin θ = v / v_s  (Mach cone)' },
        ];
      },
    };
  },
};

export default sim;
