import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { e as eC, mp } from '../../physics/constants';
import { C } from '../../engine/colors';
import { n } from '../shared';

const IONS: Record<string, { name: string; q: number; m: number }> = {
  proton: { name: 'Proton', q: eC, m: mp },
  deuteron: { name: 'Deuteron', q: eC, m: 2.0136 * 1.6605e-27 },
  alpha: { name: 'Alpha particle', q: 2 * eC, m: 4.0015 * 1.6605e-27 },
};
const DEE_R = 4; // scene radius of the dees

const sim: SimDefinition = {
  camera: { position: [0, 10, 5], target: [0, 0, 0], aspect: 1.2 },
  startPaused: false,
  hint: 'Each time the ion crosses the gap the alternating voltage has flipped just in time to accelerate it again — the orbit spirals outward.',
  params: [
    { kind: 'select', key: 'ion', label: 'Ion', default: 'proton', options: Object.entries(IONS).map(([value, i]) => ({ value, label: i.name })) },
    { kind: 'slider', key: 'B', label: 'Magnetic field B', unit: 'T', min: 0.2, max: 2, step: 0.05, default: 1 },
    { kind: 'slider', key: 'V', label: 'Gap voltage', unit: 'kV', min: 5, max: 100, step: 5, default: 50 },
    { kind: 'slider', key: 'R', label: 'Dee radius', unit: 'm', min: 0.2, max: 1, step: 0.05, default: 0.5 },
  ],
  presets: [
    { label: 'Proton', values: { ion: 'proton', B: 1, V: 50 } },
    { label: 'Alpha particle', values: { ion: 'alpha', B: 1.5, V: 50 } },
    { label: 'Low voltage (more turns)', values: { V: 10 } },
  ],
  graphs: [
    { id: 'E', title: 'Kinetic energy vs number of gap crossings', x: 'crossings', y: 'KE (MeV)', zeroY: true, series: [{ label: 'KE', color: C.accent }] },
  ],
  learn: {
    concept: 'In a cyclotron, ions move in semicircles inside two hollow D-shaped electrodes (dees) in a uniform magnetic field. Because the time for each semicircle, πm/qB, does not depend on speed, an alternating voltage of frequency f = qB/2πm can accelerate the ion every time it crosses the gap. Its final energy is set by the dee radius: KE = q²B²R²/2m.',
    variables: [['f', 'cyclotron frequency qB/2πm (Hz)'], ['R', 'radius of the dees (m)'], ['KE_max', 'q²B²R²/2m (J)'], ['V', 'gap voltage — each crossing adds qV']],
    observe: [
      'Each orbit is slightly larger than the one before — the spiral grows.',
      'The alternating voltage frequency never changes (non-relativistic).',
      'The final energy depends on B and R, not on the gap voltage — a larger V just needs fewer turns.',
    ],
    challenge: 'What field is needed for a 0.5 m cyclotron to accelerate protons to 10 MeV?',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0, crossings = 0, KE = 0, half = 0, finished = false;
    const pts: THREE.Vector3[] = [];
    const deeMat = (c: string) => kit.mat(c, { opacity: 0.35, side: THREE.DoubleSide });
    const deeGeo = new THREE.CylinderGeometry(DEE_R, DEE_R, 0.5, 48, 1, false, 0, Math.PI);
    const dee1 = kit.add(new THREE.Mesh(deeGeo, deeMat('#94a3b8')));
    dee1.position.x = 0.15;
    const dee2 = kit.add(new THREE.Mesh(deeGeo.clone(), deeMat('#94a3b8')));
    dee2.rotation.y = Math.PI; dee2.position.x = -0.15;
    const ion = kit.sphere(0.12, C.positive, { emissive: 0.7 });
    const path = kit.line(C.weight, [], { width: 2 });
    const gapField = kit.arrow(C.field, { label: 'E (gap)' });
    const polL = kit.label('', [-2, 0.6, 0], { small: true });
    const polR = kit.label('', [2, 0.6, 0], { small: true });
    kit.label('B (into the page)', [0, 0.8, -4.6], { color: C.magnetic, small: true });

    const ionD = () => IONS[str(p, 'ion')] ?? IONS.proton;
    const Rm = () => num(p, 'R');
    const radiusAt = (ke: number) => { const i = ionD(); return Math.sqrt(2 * i.m * ke) / (i.q * num(p, 'B')); };
    const KEmax = () => { const i = ionD(); return (i.q * num(p, 'B') * Rm()) ** 2 / (2 * i.m); };
    const f = () => { const i = ionD(); return (i.q * num(p, 'B')) / (2 * Math.PI * i.m); };

    function reset() {
      t = 0; crossings = 0; KE = ionD().q * num(p, 'V') * 1000 * 0.5; half = 0; finished = false;
      pts.length = 0;
      path.visible = false;
    }
    reset();

    return {
      setParams(np) { p = np; graphs.clearLive(); reset(); },
      reset,
      step(dt) {
        if (finished) return;
        // display: each semicircle lasts 0.25 s
        t += dt / 0.25;
        while (t >= 1) {
          t -= 1; half++;
          KE += ionD().q * num(p, 'V') * 1000; crossings++;
          graphs.get('E').push(crossings, KE / eC / 1e6);
          if (radiusAt(KE) >= Rm()) { finished = true; break; }
          if (crossings > 3000) { finished = true; break; }
        }
      },
      render() {
        const r = Math.min(1, radiusAt(KE) / Rm()) * DEE_R;
        // centres alternate between the two dees so the spiral stays centred
        const sideSign = half % 2 === 0 ? 1 : -1;
        const a = sideSign > 0 ? -Math.PI / 2 + t * Math.PI : Math.PI / 2 + t * Math.PI;
        const cx = sideSign * 0.15;
        const pos = new THREE.Vector3(cx + r * Math.cos(a), 0.3, r * Math.sin(a));
        ion.position.copy(finished ? new THREE.Vector3(DEE_R + 1.2, 0.3, -DEE_R * 0.9) : pos);
        if (!finished && (pts.length === 0 || pts[pts.length - 1].distanceTo(pos) > 0.05)) { pts.push(pos.clone()); if (pts.length > 4000) pts.shift(); }
        if (pts.length > 1) path.setPoints(pts);
        const pol = Math.sign(Math.cos(Math.PI * (half + t)));
        gapField.set([0, 0.3, -0.5], [pol * 0.6, 0, 0], '');
        polL.setText(pol > 0 ? '+' : '−');
        polR.setText(pol > 0 ? '−' : '+');
      },
      done: () => finished,
      time: () => (half + t) / (2 * f()),
      readouts(): Readout[] {
        return [
          { label: 'Cyclotron frequency f = qB/2πm', value: f() / 1e6, unit: 'MHz', tone: 'accent' },
          { label: 'Kinetic energy now', value: KE / eC / 1e6, unit: 'MeV', tone: 'accent' },
          { label: 'Maximum energy q²B²R²/2m', value: KEmax() / eC / 1e6, unit: 'MeV' },
          { label: 'Gap crossings so far', value: crossings },
          { label: 'Crossings needed', value: Math.ceil(KEmax() / (ionD().q * num(p, 'V') * 1000)) },
          { label: 'Final speed', value: Math.sqrt((2 * KEmax()) / ionD().m), unit: 'm/s' },
        ];
      },
      equations(): Equation[] {
        const i = ionD();
        return [
          { expr: 'f = q B / 2π m', sub: `= ${n(i.q)} × ${n(num(p, 'B'))} / (2π × ${n(i.m)}) = ${n(f())} Hz` },
          { expr: 'r = m v / q B  (grows with speed)' },
          { expr: 'KE_max = q² B² R² / 2m', sub: `= ${n(KEmax() / eC / 1e6)} MeV` },
        ];
      },
    };
  },
};

export default sim;
