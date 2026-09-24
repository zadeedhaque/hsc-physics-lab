import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { thinLens } from '../../physics/optics';
import { C } from '../../engine/colors';
import { n } from '../shared';
import { lensMesh } from '../opticsKit';

const D = 25; // least distance of distinct vision (cm)

const sim: SimDefinition = {
  camera: { position: [0, 0.5, 18], target: [0, 0, 0], aspect: 1.9 },
  timeless: true,
  hint: 'Microscope: a short-focus objective makes a magnified real image that the eyepiece views like a magnifying glass. Telescope: the objective images a distant object at its focus.',
  params: [
    { kind: 'select', key: 'instrument', label: 'Instrument', default: 'microscope', options: [{ value: 'microscope', label: 'Compound microscope' }, { value: 'telescope', label: 'Astronomical telescope' }] },
    { kind: 'slider', key: 'fo', label: 'Objective focal length f₀', unit: 'cm', min: 0.5, max: 100, step: 0.5, default: 2 },
    { kind: 'slider', key: 'fe', label: 'Eyepiece focal length fₑ', unit: 'cm', min: 1, max: 10, step: 0.5, default: 5 },
    { kind: 'slider', key: 'uo', label: 'Object distance from objective', unit: 'cm', min: 0.6, max: 10, step: 0.05, default: 2.4, showIf: (p) => p.instrument === 'microscope' },
    { kind: 'select', key: 'adj', label: 'Final image at', default: 'normal', options: [{ value: 'normal', label: 'Infinity (relaxed eye)' }, { value: 'near', label: 'Near point (25 cm)' }] },
  ],
  presets: [
    { label: 'School microscope', values: { instrument: 'microscope', fo: 2, fe: 5, uo: 2.4 } },
    { label: 'High-power microscope', values: { instrument: 'microscope', fo: 0.5, fe: 2.5, uo: 0.55 } },
    { label: 'Small telescope', values: { instrument: 'telescope', fo: 60, fe: 5 } },
    { label: 'Large telescope', values: { instrument: 'telescope', fo: 100, fe: 2 } },
  ],
  learn: {
    concept: 'Optical instruments increase the angle an object subtends at the eye. In a compound microscope the objective forms a real, magnified image inside the eyepiece’s focal length; the eyepiece then acts as a simple magnifier. In an astronomical telescope the objective forms a real image of a distant object at its focal plane, and M = f₀/fₑ in normal adjustment.',
    variables: [['f₀, fₑ', 'focal lengths of objective and eyepiece'], ['M', 'magnifying power'], ['D', 'least distance of distinct vision = 25 cm'], ['L', 'tube length (distance between lenses)']],
    observe: [
      'A microscope needs a very short objective focal length for high power.',
      'A telescope needs a long objective and a short eyepiece.',
      'Focusing for the near point gives slightly more magnification than for infinity.',
    ],
    challenge: 'Design a telescope with magnifying power 20 and a tube length of 105 cm in normal adjustment. What are f₀ and fₑ?',
  },

  create({ kit, params }) {
    let p: Params = params;
    kit.line('#64748b', [[-13, 0, 0], [13, 0, 0]], { width: 1.5 });
    const g = kit.add(new THREE.Group());

    function solve() {
      const fo = num(p, 'fo'), fe = num(p, 'fe'), near = str(p, 'adj') === 'near';
      if (str(p, 'instrument') === 'telescope') {
        const M = near ? (fo / fe) * (1 + fe / D) : fo / fe;
        const ue = near ? (fe * D) / (fe + D) : fe;
        return { M, L: fo + ue, vo: fo, uo: Infinity, ue, mo: NaN };
      }
      const uo = Math.max(num(p, 'uo'), fo * 1.02);
      const r = thinLens(uo, fo);
      const vo = r.v;
      const ue = near ? (fe * D) / (fe + D) : fe;
      const mo = vo / uo;
      const M = mo * (near ? 1 + D / fe : D / fe);
      return { M, L: vo + ue, vo, uo, ue, mo };
    }

    function draw() {
      kit.clearGroup(g);
      const s = solve();
      const total = s.L + (Number.isFinite(s.uo) ? s.uo : 0);
      const SC = 20 / Math.max(total, 1);
      const xo = Number.isFinite(s.uo) ? -10 + s.uo * SC : -8;
      const xe = xo + s.L * SC;
      const lo = lensMesh(kit, 3.2, true); lo.position.x = xo; g.add(lo, kit.label('objective', [xo, 2, 0], { small: true }));
      const le = lensMesh(kit, 2.4, true, '#c4b5fd'); le.position.x = xe; g.add(le, kit.label('eyepiece', [xe, 1.7, 0], { small: true }));
      const eye = kit.sphere(0.35, '#f8fafc'); eye.position.x = xe + 1.2; g.add(eye);
      if (Number.isFinite(s.uo)) {
        const ob = kit.arrow(C.weight, { radius: 0.04 }); ob.set([xo - s.uo * SC, 0, 0], [0, 0.4, 0], 'object'); g.add(ob);
      } else {
        for (let i = -1; i <= 1; i++) g.add(kit.line(C.light, [[-13, 0.6 + i * 0.4, 0], [xo, 0.3 + i * 0.4, 0]], { width: 1.5 }));
        g.add(kit.label('light from a distant star', [-11, 1.6, 0], { small: true }));
      }
      const ix = xo + s.vo * SC;
      const ih = Number.isFinite(s.mo) ? -0.4 * s.mo : -0.8;
      const im = kit.arrow(C.acceleration, { radius: 0.04 }); im.set([ix, 0, 0], [0, Math.max(-2.5, Math.min(2.5, ih)), 0], 'intermediate image'); g.add(im);
      g.add(kit.line('#94a3b8', [[xo, 0, 0], [ix, ih, 0]], { width: 1.2, dashed: true }));
      g.add(kit.line(C.light, [[ix, ih, 0], [xe, ih * 0.3, 0], [xe + 1.2, 0, 0]], { width: 1.5 }));
      g.add(kit.label(`L = ${n(s.L)} cm`, [(xo + xe) / 2, -2, 0], { small: true }));
    }
    draw();

    return {
      setParams(np) { p = np; draw(); },
      reset() { draw(); },
      step() {},
      readouts(): Readout[] {
        const s = solve();
        const out: Readout[] = [
          { label: 'Magnifying power M', value: Math.abs(s.M), tone: 'accent' },
          { label: 'Tube length (lens separation)', value: s.L, unit: 'cm' },
          { label: 'Objective image distance', value: s.vo, unit: 'cm' },
          { label: 'Eyepiece object distance', value: s.ue, unit: 'cm' },
        ];
        if (Number.isFinite(s.mo)) out.push({ label: 'Objective magnification', value: s.mo });
        out.push({ label: 'Final image', value: str(p, 'adj') === 'near' ? 'at the near point (25 cm), inverted' : 'at infinity, inverted' });
        return out;
      },
      equations(): Equation[] {
        const s = solve();
        return str(p, 'instrument') === 'telescope'
          ? [
            { expr: 'Normal adjustment: M = f₀ / fₑ ,  L = f₀ + fₑ', sub: `M = ${n(num(p, 'fo'))} / ${n(num(p, 'fe'))} = ${n(num(p, 'fo') / num(p, 'fe'))}` },
            { expr: 'Near point: M = (f₀/fₑ)(1 + fₑ/D)', sub: `M = ${n(Math.abs(s.M))}` },
          ]
          : [
            { expr: 'M = m₀ × mₑ = (v₀/u₀)(D/fₑ)  (image at infinity)' },
            { expr: 'Near point: M = (v₀/u₀)(1 + D/fₑ)', sub: `M = ${n(Math.abs(s.M))}` },
            { expr: 'Approx.: M ≈ (L/f₀)(D/fₑ)' },
          ];
      },
    };
  },
};

export default sim;
