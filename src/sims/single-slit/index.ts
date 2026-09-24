import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num } from '../types';
import { singleSlitIntensity, wavelengthToRGB } from '../../physics/optics';
import { canvasTexture } from '../../engine/kit';
import { n } from '../shared';

const SCREEN_X = 5;
const HALF = 3;

const sim: SimDefinition = {
  camera: { position: [-5, 5, 8], target: [1.5, 0, 0], aspect: 1.6 },
  timeless: true,
  hint: 'The central bright band is twice as wide as the others. Narrowing the slit makes the pattern spread out.',
  params: [
    { kind: 'slider', key: 'lambda', label: 'Wavelength λ', unit: 'nm', min: 380, max: 750, step: 1, default: 600 },
    { kind: 'slider', key: 'a', label: 'Slit width a', unit: 'mm', min: 0.02, max: 0.5, step: 0.005, default: 0.1, decimals: 3 },
    { kind: 'slider', key: 'D', label: 'Screen distance D', unit: 'm', min: 0.3, max: 3, step: 0.05, default: 1.5 },
  ],
  presets: [
    { label: 'Red, narrow slit', values: { lambda: 680, a: 0.05 } },
    { label: 'Blue, narrow slit', values: { lambda: 450, a: 0.05 } },
    { label: 'Wide slit', values: { a: 0.4 } },
  ],
  graphs: [
    { id: 'I', title: 'Intensity on the screen', x: 'y (mm)', y: 'I / I₀', kind: 'curve', yRange: [0, 1.05], series: [{ label: 'I(y)', color: '#facc15' }] },
  ],
  learn: {
    concept: 'Light passing through a single narrow slit spreads out (diffraction). Waves from different parts of the slit interfere: dark fringes appear where a sin θ = nλ. The central maximum has width 2λD/a, twice the width of the secondary maxima, and is much brighter.',
    variables: [['a', 'slit width (m)'], ['λ', 'wavelength (m)'], ['D', 'distance to screen (m)'], ['θ', 'angle of a minimum: sin θ = nλ/a']],
    observe: [
      'Halving the slit width doubles the width of the central maximum.',
      'Longer wavelengths diffract more.',
      'Secondary maxima are far fainter than the central one (about 4.5 % for the first).',
    ],
    challenge: 'For 600 nm light and a 0.1 mm slit, predict the width of the central maximum on a screen 1.5 m away.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    const wallA = kit.box(0.15, 2, 1, '#475569');
    const wallB = kit.box(0.15, 2, 1, '#475569');
    const { canvas, ctx, tex } = canvasTexture(512, 8);
    const screen = kit.add(new THREE.Mesh(new THREE.PlaneGeometry(2 * HALF, 2.4), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })));
    screen.position.set(SCREEN_X, 0, 0);
    screen.rotation.y = -Math.PI / 2;
    const beam = kit.box(4, 0.06, 0.06, '#facc15', { emissive: 1 });
    beam.position.set(-5, 0, 0);
    const fan = kit.segments('#facc15', { width: 1.2, opacity: 0.35 });
    const widthLabel = kit.label('', [SCREEN_X, 1.6, 0], { small: true });

    const lam = () => num(p, 'lambda') * 1e-9;
    const a = () => num(p, 'a') * 1e-3;
    const Y = () => 2.5 * (lam() * num(p, 'D')) / a(); // half-window: 2.5 × first minimum

    function draw() {
      const slit = 0.1 + num(p, 'a') * 1.2;
      const outer = HALF - slit / 2;
      wallA.scale.z = outer; wallA.position.set(-3, 0, slit / 2 + outer / 2);
      wallB.scale.z = outer; wallB.position.set(-3, 0, -(slit / 2 + outer / 2));
      const [r, g, b] = wavelengthToRGB(num(p, 'lambda'));
      const bm = beam.material as THREE.MeshStandardMaterial;
      bm.color.setRGB(r, g, b); bm.emissive.setRGB(r, g, b);
      const img = ctx.createImageData(canvas.width, canvas.height);
      for (let i = 0; i < canvas.width; i++) {
        const y = (-1 + (2 * i) / (canvas.width - 1)) * Y();
        const v = Math.pow(singleSlitIntensity(y, lam(), num(p, 'D'), a()), 0.6);
        for (let j = 0; j < canvas.height; j++) { const k = (j * canvas.width + i) * 4; img.data[k] = 255 * r * v + 6; img.data[k + 1] = 255 * g * v + 6; img.data[k + 2] = 255 * b * v + 8; img.data[k + 3] = 255; }
      }
      ctx.putImageData(img, 0, 0);
      tex.needsUpdate = true;
      const spread = Math.min(HALF, (HALF * (lam() * num(p, 'D')) / a()) / Y());
      fan.setSegments([-3, 0, 0, SCREEN_X, 0, spread, -3, 0, 0, SCREEN_X, 0, -spread, -3, 0, 0, SCREEN_X, 0, 0]);
      widthLabel.setText(`central max = ${n(((2 * lam() * num(p, 'D')) / a()) * 1000)} mm`);
      graphs.get('I').plot(0, -Y() * 1000, Y() * 1000, (ymm) => singleSlitIntensity(ymm / 1000, lam(), num(p, 'D'), a()), 600);
      const ymin = ((lam() * num(p, 'D')) / a()) * 1000;
      graphs.get('I').setVLines([{ x: ymin, label: '1st min' }, { x: -ymin }]);
    }
    draw();

    return {
      setParams(np) { p = np; draw(); },
      reset() { draw(); },
      step() {},
      readouts(): Readout[] {
        const w = (2 * lam() * num(p, 'D')) / a();
        return [
          { label: 'Width of central maximum 2λD/a', value: w * 1000, unit: 'mm', tone: 'accent' },
          { label: 'Angle of first minimum', value: (Math.asin(Math.min(1, lam() / a())) * 180) / Math.PI, unit: '°' },
          { label: 'First minimum on screen', value: (w / 2) * 1000, unit: 'mm' },
          { label: 'Width of a secondary maximum', value: (w / 2) * 1000, unit: 'mm' },
          { label: 'Intensity of first secondary max', value: 4.5, unit: '% of central' },
        ];
      },
      equations(): Equation[] {
        return [
          { expr: 'Minima: a sin θ = nλ  (n = 1, 2, 3 …)' },
          { expr: 'Central width = 2λD / a', sub: `= 2 × ${n(lam())} × ${n(num(p, 'D'))} / ${n(a())} = ${n((2 * lam() * num(p, 'D')) / a())} m` },
          { expr: 'I = I₀ [sin β / β]² ,  β = πa sinθ / λ' },
        ];
      },
    };
  },
};

export default sim;
