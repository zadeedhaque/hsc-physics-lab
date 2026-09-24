import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { vernierReading, screwGaugeReading, errors } from '../../physics/measurement';
import { C } from '../../engine/colors';
import { n } from '../shared';

const MM = 0.2; // scene units per mm (vernier)

const sim: SimDefinition = {
  camera: { position: [0, 0.2, 14.5], target: [0, -0.4, 0], aspect: 1.9 },
  timeless: true,
  hint: 'Vernier: the green line is the coinciding division. Screw gauge: the thimble edge gives the linear reading; the division on the reference line gives the CSR.',
  params: [
    { kind: 'select', key: 'instrument', label: 'Instrument', default: 'vernier', options: [{ value: 'vernier', label: 'Vernier caliper' }, { value: 'screw', label: 'Screw gauge' }] },
    { kind: 'slider', key: 'L', label: 'True size of the object', unit: 'mm', min: 1, max: 60, step: 0.001, default: 23.47, decimals: 3, showIf: (p) => p.instrument === 'vernier' },
    { kind: 'select', key: 'nv', label: 'Vernier divisions (10 VSD = 9 MSD …)', default: '10', options: [{ value: '10', label: '10 → LC 0.1 mm' }, { value: '20', label: '20 → LC 0.05 mm' }, { value: '50', label: '50 → LC 0.02 mm' }], showIf: (p) => p.instrument === 'vernier' },
    { kind: 'slider', key: 'zeV', label: 'Zero error', unit: 'mm', min: -0.5, max: 0.5, step: 0.02, default: 0, showIf: (p) => p.instrument === 'vernier', hint: '+ if the zero of the vernier lies right of the main-scale zero' },
    { kind: 'slider', key: 'D', label: 'True diameter of the wire', unit: 'mm', min: 0.2, max: 10, step: 0.001, default: 2.735, decimals: 3, showIf: (p) => p.instrument === 'screw' },
    { kind: 'select', key: 'pitch', label: 'Pitch', default: '0.5', options: [{ value: '0.5', label: '0.5 mm' }, { value: '1', label: '1 mm' }], showIf: (p) => p.instrument === 'screw' },
    { kind: 'select', key: 'cd', label: 'Circular scale divisions', default: '50', options: [{ value: '50', label: '50' }, { value: '100', label: '100' }], showIf: (p) => p.instrument === 'screw' },
    { kind: 'slider', key: 'zeS', label: 'Zero error', unit: 'mm', min: -0.05, max: 0.05, step: 0.01, default: 0, showIf: (p) => p.instrument === 'screw' },
  ],
  presets: [
    { label: 'Vernier, no zero error', values: { instrument: 'vernier', L: 23.47, nv: '10', zeV: 0 } },
    { label: 'Vernier, + zero error', values: { instrument: 'vernier', L: 18.23, nv: '20', zeV: 0.2 } },
    { label: 'Vernier, − zero error', values: { instrument: 'vernier', L: 31.6, nv: '10', zeV: -0.3 } },
    { label: 'Screw gauge wire', values: { instrument: 'screw', D: 2.735, pitch: '0.5', cd: '50', zeS: 0 } },
    { label: 'Screw gauge + zero error', values: { instrument: 'screw', D: 1.284, pitch: '1', cd: '100', zeS: 0.03 } },
  ],
  learn: {
    concept: 'A vernier caliper and a screw gauge both extend a main scale with a finer secondary scale. The smallest length they can resolve is the least count (LC). A reading is main-scale reading + (coinciding division × LC); any zero error must be subtracted to get the corrected reading.',
    variables: [['MSR / LSR', 'main (linear) scale reading'], ['VSC / CSR', 'vernier / circular scale division that coincides'], ['LC', 'least count = 1 MSD − 1 VSD, or pitch ÷ divisions'], ['e', 'zero error (subtract it)']],
    observe: [
      'The reading can only be a whole number of least counts — the rest is measurement uncertainty.',
      'More vernier divisions give a smaller least count and a smaller absolute error.',
      'A positive zero error makes every raw reading too large.',
      'One full turn of the screw gauge thimble moves the spindle by one pitch.',
    ],
    challenge: 'Set a zero error of +0.2 mm. Work out the corrected reading by hand from the scales shown, then check it against the Results.',
  },

  create({ kit, params }) {
    let p: Params = params;
    const vernierG = kit.add(new THREE.Group());
    const screwG = kit.add(new THREE.Group());

    // ── Vernier caliper parts (rebuilt when the scale changes) ──
    const beam = kit.box(80 * MM + 2, 0.5, 0.12, '#cbd5e1', { metalness: 0.6, roughness: 0.3 });
    beam.position.set(-8 + 40 * MM, 0.25, 0);
    const fixedJaw = kit.box(0.4, 2.2, 0.12, '#cbd5e1', { metalness: 0.6, roughness: 0.3 });
    const slider = kit.add(new THREE.Group());
    const slideBody = kit.box(3.2, 0.9, 0.16, '#94a3b8', { metalness: 0.5, roughness: 0.35 });
    const movingJaw = kit.box(0.4, 2.2, 0.16, '#94a3b8', { metalness: 0.5, roughness: 0.35 });
    const object = kit.box(1, 1, 0.9, C.weight, { roughness: 0.4 });
    const mainTicks = kit.segments('#020617', { width: 1.8 });
    const vTicks = kit.segments('#0f172a', { width: 1.4 });
    const vHit = kit.segments(C.normal, { width: 3 });
    const mainLabels = kit.add(new THREE.Group());
    const vLabels = kit.add(new THREE.Group());
    [beam, fixedJaw, slider, object, mainTicks, vTicks, vHit, mainLabels, vLabels].forEach((o) => vernierG.add(o));
    slider.add(slideBody, movingJaw);
    const X0 = -8; // scene x of main-scale zero

    // ── Screw gauge parts (x = spindle axis, 0.5 scene units per mm) ──
    const SG = 0.5;
    const XA = -7; // anvil face
    const S0 = -1; // zero of the sleeve scale (thimble edge when the gap is zero)
    const frameMat = '#475569';
    const frameBottom = kit.box(S0 - XA + 1.6, 0.35, 0.4, frameMat);
    frameBottom.position.set((XA + S0) / 2 - 0.3, -2.2, 0);
    const frameLeft = kit.box(0.45, 2.3, 0.4, frameMat);
    frameLeft.position.set(XA - 1, -1.1, 0);
    const frameRight = kit.box(0.45, 2.3, 0.4, frameMat);
    frameRight.position.set(S0 - 0.6, -1.1, 0);
    const anvil = kit.cylinder(0.25, 0.25, 0.8, '#cbd5e1', { metalness: 0.7 });
    anvil.rotation.z = Math.PI / 2;
    anvil.position.set(XA - 0.4, 0, 0);
    const sleeve = kit.cylinder(0.42, 0.42, 7.2, '#e2e8f0', { metalness: 0.4 });
    sleeve.rotation.z = Math.PI / 2;
    sleeve.position.set(S0 - 0.8 + 3.6, 0, 0);
    const spindle = kit.cylinder(0.25, 0.25, 8, '#cbd5e1', { metalness: 0.7 });
    spindle.rotation.z = Math.PI / 2;
    const thimble = kit.add(new THREE.Group());
    const thimbleBody = kit.cylinder(0.6, 0.6, 3, '#94a3b8', { metalness: 0.5 });
    thimbleBody.rotation.z = Math.PI / 2;
    thimbleBody.position.x = 1.5;
    thimble.add(thimbleBody);
    const circTicks = kit.segments('#020617', { width: 1.5 });
    thimble.add(circTicks);
    const wire = kit.cylinder(1, 1, 2.4, C.hot, { roughness: 0.4 });
    wire.rotation.x = Math.PI / 2;
    const linTicks = kit.segments('#020617', { width: 1.6 });
    const refLine = kit.line('#020617', [], { width: 1.6 });
    const circLabels = kit.add(new THREE.Group());
    [frameBottom, frameLeft, frameRight, anvil, sleeve, spindle, thimble, wire, linTicks, refLine, circLabels].forEach((o) => screwG.add(o));

    const vern = () => vernierReading(num(p, 'L'), 1, Number(str(p, 'nv')), num(p, 'zeV'));
    const screw = () => screwGaugeReading(num(p, 'D'), Number(str(p, 'pitch')), Number(str(p, 'cd')), num(p, 'zeS'));

    function buildVernier() {
      const r = vern();
      const nv = Number(str(p, 'nv'));
      const observed = r.raw; // jaw position the scale indicates
      const L = num(p, 'L');
      // main scale: 0..80 mm
      const flat: number[] = [];
      kit.clearGroup(mainLabels);
      for (let mm = 0; mm <= 80; mm++) {
        const x = X0 + mm * MM;
        const len = mm % 10 === 0 ? 0.35 : mm % 5 === 0 ? 0.25 : 0.16;
        flat.push(x, 0.5, 0.1, x, 0.5 - len, 0.1);
        if (mm % 10 === 0) mainLabels.add(kit.label(`${mm / 10}`, [x, 0.72, 0.07], { small: true }));
      }
      mainTicks.setSegments(flat);
      mainLabels.add(kit.label('cm', [X0 + 81 * MM, 0.72, 0.07], { small: true, className: 'plain' }));
      // slider + vernier plate at the indicated position
      const xj = X0 + observed * MM;
      fixedJaw.position.set(X0 - 0.2, -0.6, 0);
      slider.position.set(xj, 0, 0);
      slideBody.position.set(1.2, 0.05, 0.02);
      movingJaw.position.set(0.2, -0.6, 0);
      // object between the jaws (its real size; jaws close on it up to zero error)
      object.scale.set(L * MM, 1, 1);
      object.position.set(X0 + (L * MM) / 2, -1.2, 0);
      // vernier ticks: nv divisions spanning (nv − 1) mm
      const vsd = (nv - 1) / nv;
      const vf: number[] = [];
      kit.clearGroup(vLabels);
      for (let i = 0; i <= nv; i++) {
        const x = xj + i * vsd * MM;
        const len = i % 5 === 0 ? 0.3 : 0.18;
        vf.push(x, 0.05, 0.12, x, 0.05 + len, 0.12);
        if (i % (nv / 2) === 0) vLabels.add(kit.label(`${Math.round((i / nv) * 10)}`, [x, -0.28, 0.12], { small: true }));
      }
      vTicks.setSegments(vf);
      const xc = xj + r.vsc * vsd * MM;
      vHit.setSegments([xc, 0.05, 0.13, xc, 0.5, 0.13]);
      kit.followX(0, 1);
    }

    function buildScrew() {
      const r = screw();
      const pitch = Number(str(p, 'pitch'));
      const cd = Number(str(p, 'cd'));
      const D = num(p, 'D');
      // wire held between anvil and spindle
      wire.scale.set((D * SG) / 2, 1, (D * SG) / 2);
      wire.position.set(XA + (D * SG) / 2, 0, 0);
      spindle.position.set(XA + D * SG + 4, 0, 0);
      // sleeve (linear) scale on the side facing the viewer: mm marks above the line, half-mm below
      const z = 0.43;
      const lf: number[] = [];
      for (let k = 0; k * 0.5 <= 12 + 1e-9; k++) {
        const mm = k * 0.5;
        const x = S0 + mm * SG;
        const whole = k % 2 === 0;
        if (whole) lf.push(x, 0, z, x, mm % 5 === 0 ? 0.3 : 0.2, z);
        else if (pitch === 0.5) lf.push(x, 0, z, x, -0.2, z);
      }
      linTicks.setSegments(lf);
      // the thimble edge sits at the raw reading on the sleeve scale
      const edge = S0 + r.raw * SG;
      thimble.position.set(edge, 0, 0);
      refLine.setPoints([[S0 - 0.3, 0, z], [edge, 0, z]]);
      const cf: number[] = [];
      for (let i = 0; i < cd; i++) {
        const a = (i / cd) * Math.PI * 2;
        const len = i % 10 === 0 ? 0.35 : i % 5 === 0 ? 0.25 : 0.15;
        cf.push(0.01, 0.61 * Math.cos(a), 0.61 * Math.sin(a), len, 0.61 * Math.cos(a), 0.61 * Math.sin(a));
      }
      circTicks.setSegments(cf);
      // rotate so that division CSR lines up with the reference line (which faces the viewer, +z)
      thimble.rotation.x = Math.PI / 2 - (r.csr / cd) * Math.PI * 2;
      kit.clearGroup(circLabels);
      circLabels.add(kit.label(`CSR = ${r.csr}`, [edge + 0.9, 0.95, 0.5], { small: true }));
      circLabels.add(kit.label(`LSR = ${n(r.lsr)} mm`, [edge - 1.2, 0.8, 0.5], { small: true }));
      for (let mm = 0; mm <= 12; mm += 5) circLabels.add(kit.label(`${mm}`, [S0 + mm * SG, 0.55, z], { small: true }));
      circLabels.add(kit.label(`wire  D = ${n(D, 4)} mm`, [XA + (D * SG) / 2, -1.5, 0.6], { color: C.hot, small: true }));
      kit.followX(0, 1);
    }

    function build() {
      const v = str(p, 'instrument') === 'vernier';
      vernierG.visible = v;
      screwG.visible = !v;
      if (v) buildVernier(); else buildScrew();
    }
    build();

    const current = () => {
      if (str(p, 'instrument') === 'vernier') {
        const r = vern();
        return { r, trueV: num(p, 'L'), ze: num(p, 'zeV'), main: r.msr, fine: r.vsc };
      }
      const r = screw();
      return { r, trueV: num(p, 'D'), ze: num(p, 'zeS'), main: r.lsr, fine: r.csr };
    };

    return {
      setParams(np) { p = np; build(); },
      reset() { build(); },
      step() {},
      readouts(): Readout[] {
        const { r, trueV, ze, main, fine } = current();
        const err = errors(r.corrected, trueV);
        const v = str(p, 'instrument') === 'vernier';
        return [
          { label: 'Least count', value: r.lc, unit: 'mm', tone: 'accent' },
          { label: v ? 'Main scale reading' : 'Linear scale reading', value: main, unit: 'mm' },
          { label: v ? 'Vernier coincidence (VSC)' : 'Circular scale reading (CSR)', value: fine },
          { label: 'Raw reading', value: r.raw, unit: 'mm' },
          { label: 'Zero error', value: ze, unit: 'mm' },
          { label: 'Corrected (measured) value', value: r.corrected, unit: 'mm', tone: 'accent' },
          { label: 'True value', value: trueV, unit: 'mm' },
          { label: 'Absolute error', value: err.abs, unit: 'mm' },
          { label: 'Relative error', value: err.rel },
          { label: 'Percentage error', value: err.percent, unit: '%' },
        ];
      },
      equations(): Equation[] {
        const { r, ze } = current();
        if (str(p, 'instrument') === 'vernier') {
          const nv = Number(str(p, 'nv'));
          const r = vern();
          return [
            { expr: 'LC = 1 MSD − 1 VSD = s / n', sub: `LC = 1 mm / ${nv} = ${n(r.lc)} mm` },
            { expr: 'Reading = MSR + VSC × LC', sub: `= ${n(r.msr)} + ${r.vsc} × ${n(r.lc)} = ${n(r.raw)} mm` },
            { expr: 'Corrected = Reading − zero error', sub: `= ${n(r.raw)} − (${n(ze)}) = ${n(r.corrected)} mm` },
          ];
        }
        const sr = r as ReturnType<typeof screwGaugeReading>;
        return [
          { expr: 'LC = pitch / number of circular divisions', sub: `LC = ${str(p, 'pitch')} / ${str(p, 'cd')} = ${n(sr.lc)} mm` },
          { expr: 'Reading = LSR + CSR × LC', sub: `= ${n(sr.lsr)} + ${sr.csr} × ${n(sr.lc)} = ${n(sr.raw)} mm` },
          { expr: 'Corrected = Reading − zero error', sub: `= ${n(sr.raw)} − (${n(ze)}) = ${n(sr.corrected)} mm` },
          { expr: '% error = |measured − true| / true × 100' },
        ];
      },
    };
  },
};

export default sim;
