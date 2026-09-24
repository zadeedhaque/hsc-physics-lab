import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { bool, num } from '../types';
import { doubleSlitIntensity, fringeWidth, singleSlitIntensity, wavelengthToRGB } from '../../physics/optics';
import { canvasTexture } from '../../engine/kit';
import { n } from '../shared';

/*
 * Layout: light travels along +x. The two slits are separated along z, so the ripple-tank plane is the
 * horizontal x–z plane and the fringes run along z on the screen (a vertical plane facing −x).
 */
const BARRIER_X = -3;
const SCREEN_X = 6;
const HALF_Z = 3; // screen half-width in scene units

export const colourName = (nm: number) => (nm < 450 ? 'Violet' : nm < 495 ? 'Blue' : nm < 570 ? 'Green' : nm < 590 ? 'Yellow' : nm < 620 ? 'Orange' : 'Red');

const sim: SimDefinition = {
  camera: { position: [-7, 6.5, 8], target: [2, 0, 0], aspect: 1.6 },
  hint: 'The ripple region uses an exaggerated wavelength so you can see it — the screen pattern and graph use the true λ, d, D.',
  params: [
    { kind: 'slider', key: 'lambda', label: 'Wavelength λ', unit: 'nm', min: 380, max: 750, step: 1, default: 550 },
    { kind: 'slider', key: 'd', label: 'Slit separation d', unit: 'mm', min: 0.05, max: 1, step: 0.01, default: 0.25 },
    { kind: 'slider', key: 'D', label: 'Screen distance D', unit: 'm', min: 0.3, max: 3, step: 0.05, default: 1.5 },
    { kind: 'slider', key: 'a', label: 'Slit width a', unit: 'mm', min: 0.01, max: 0.1, step: 0.005, default: 0.04, decimals: 3 },
    { kind: 'toggle', key: 'block', label: 'Cover one slit', default: false },
    { kind: 'toggle', key: 'waves', label: 'Show wavefronts', default: true },
  ],
  presets: [
    { label: 'Green light', values: { lambda: 550, d: 0.25, D: 1.5, a: 0.04, block: false } },
    { label: 'Red light', values: { lambda: 680, block: false } },
    { label: 'Blue light', values: { lambda: 440, block: false } },
    { label: 'Slits far apart', values: { d: 0.8, block: false } },
    { label: 'One slit only', values: { block: true } },
  ],
  graphs: [
    { id: 'I', title: 'Intensity on the screen', x: 'y (mm)', y: 'I / I₀', kind: 'curve', yRange: [0, 1.05], series: [{ label: 'I(y)', color: '#facc15' }, { label: 'single-slit envelope', color: '#94a3b8', dashed: true }] },
  ],
  learn: {
    concept: 'Light from two narrow, coherent slits overlaps and interferes. Where the path difference is a whole number of wavelengths the waves arrive in step (bright fringe); where it is an odd number of half-wavelengths they cancel (dark fringe). Bright fringes are equally spaced by β = λD/d.',
    variables: [['λ', 'wavelength of light (m)'], ['d', 'distance between slit centres (m)'], ['D', 'slit-to-screen distance (m)'], ['β', 'fringe width (m)'], ['a', 'width of each slit (m)']],
    observe: [
      'Red light (long λ) gives wider fringes than blue light.',
      'Moving the slits closer together (smaller d) spreads the fringes out.',
      'The fringe brightness is modulated by the single-slit diffraction envelope.',
      'Covering one slit destroys the fringes, leaving only the broad single-slit pattern.',
    ],
    challenge: 'With λ = 600 nm and D = 1.2 m, set d so that the fringe width is exactly 2.4 mm.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0;

    const laser = kit.box(1.4, 0.6, 0.6, '#334155', { metalness: 0.4 });
    laser.position.set(-7, 0, 0);
    kit.label('Laser', [-7, 0.7, 0], { small: true });
    const beam = kit.box(3.3, 0.06, 0.06, '#facc15', { emissive: 1 });
    beam.position.set(-4.65, 0, 0);
    const wallTop = kit.box(0.15, 2, 1, '#475569');
    const wallMid = kit.box(0.15, 2, 1, '#475569');
    const wallBot = kit.box(0.15, 2, 1, '#475569');
    const cover = kit.box(0.2, 2.1, 0.5, '#0f172a');
    kit.label('Double slit', [BARRIER_X, 1.4, 0], { small: true });

    const { canvas, ctx, tex } = canvasTexture(512, 8);
    const screen = kit.add(new THREE.Mesh(new THREE.PlaneGeometry(2 * HALF_Z, 2.4), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })));
    screen.position.set(SCREEN_X, 0, 0);
    screen.rotation.y = -Math.PI / 2; // local +x → world +z, faces −x
    const frame = kit.box(0.08, 2.6, 2 * HALF_Z + 0.2, '#1e293b');
    frame.position.set(SCREEN_X + 0.06, 0, 0);
    kit.label('Screen', [SCREEN_X, 1.55, 0], { small: true });
    const fringeTicks = kit.segments('#e2e8f0', { width: 1.2, opacity: 0.8 });
    const dLabel = kit.label('', [BARRIER_X - 0.2, -1.3, 0], { small: true });
    kit.line('#64748b', [[BARRIER_X, -1.1, HALF_Z + 0.4], [SCREEN_X, -1.1, HALF_Z + 0.4]], { width: 1.2, dashed: true });
    const DLabel = kit.label('', [(BARRIER_X + SCREEN_X) / 2, -1.1, HALF_Z + 0.8], { small: true });
    const yLabel = kit.label('', [SCREEN_X, -1.5, HALF_Z], { small: true });

    const waveMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uK: { value: 12 }, uS1: { value: 0.35 }, uS2: { value: -0.35 }, uColor: { value: new THREE.Color('#facc15') }, uBlock: { value: 0 }, uLen: { value: SCREEN_X - BARRIER_X }, uHalf: { value: HALF_Z } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        varying vec2 vUv; uniform float uTime, uK, uS1, uS2, uBlock, uLen, uHalf; uniform vec3 uColor;
        void main(){
          float x = vUv.x * uLen;
          float z = -(vUv.y - 0.5) * 2.0 * uHalf;
          float r1 = length(vec2(x, z - uS1));
          float r2 = length(vec2(x, z - uS2));
          float w = cos(uK * r1 - uTime * 6.0) / sqrt(r1 + 0.3) + (1.0 - uBlock) * cos(uK * r2 - uTime * 6.0) / sqrt(r2 + 0.3);
          float a = clamp(w * 0.55, -1.0, 1.0);
          float alpha = smoothstep(0.0, 0.2, x) * 0.8 * abs(a);
          gl_FragColor = vec4(uColor * (0.55 + 0.45 * a), alpha);
        }`,
    });
    const waves = kit.add(new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_X - BARRIER_X, 2 * HALF_Z), waveMat));
    waves.rotation.x = -Math.PI / 2; // local +y → world −z (the shader flips it back)
    waves.position.set((BARRIER_X + SCREEN_X) / 2, -0.02, 0);

    const lam = () => num(p, 'lambda') * 1e-9;
    const d = () => num(p, 'd') * 1e-3;
    const a = () => num(p, 'a') * 1e-3;
    const D = () => num(p, 'D');
    const beta = () => fringeWidth(lam(), D(), d());
    /** Half-width (m) of the screen region displayed. */
    const yWin = () => (bool(p, 'block') ? 1.6 * (lam() * D()) / a() : Math.max(5 * beta(), 1.1 * (lam() * D()) / a()));
    const intensity = (y: number) => (bool(p, 'block') ? singleSlitIntensity(y, lam(), D(), a()) : doubleSlitIntensity(y, lam(), D(), d(), a()));

    function build() {
      const [r, g, b] = wavelengthToRGB(num(p, 'lambda'));
      const col = new THREE.Color(r, g, b);
      const bm = beam.material as THREE.MeshStandardMaterial;
      bm.color.copy(col); bm.emissive.copy(col);
      waveMat.uniforms.uColor.value.copy(col);
      waveMat.uniforms.uBlock.value = bool(p, 'block') ? 1 : 0;
      waveMat.uniforms.uK.value = 14 * (550 / num(p, 'lambda'));
      const sep = 0.3 + num(p, 'd') * 1.2; // visual separation grows with d
      waveMat.uniforms.uS1.value = sep / 2;
      waveMat.uniforms.uS2.value = -sep / 2;
      waves.visible = bool(p, 'waves');

      const slit = 0.12;
      const outer = HALF_Z - (sep / 2 + slit / 2);
      wallTop.scale.z = outer; wallTop.position.set(BARRIER_X, 0, sep / 2 + slit / 2 + outer / 2);
      wallBot.scale.z = outer; wallBot.position.set(BARRIER_X, 0, -(sep / 2 + slit / 2 + outer / 2));
      wallMid.scale.z = Math.max(0.01, sep - slit); wallMid.position.set(BARRIER_X, 0, 0);
      cover.visible = bool(p, 'block');
      cover.position.set(BARRIER_X - 0.14, 0, -sep / 2);
      dLabel.setText(`d = ${num(p, 'd')} mm, a = ${num(p, 'a')} mm`);
      DLabel.setText(`D = ${num(p, 'D')} m`);

      const Y = yWin();
      yLabel.setText(`screen shows ±${n(Y * 1e3)} mm`);
      const img = ctx.createImageData(canvas.width, canvas.height);
      for (let i = 0; i < canvas.width; i++) {
        const y = (-1 + (2 * i) / (canvas.width - 1)) * Y;
        const v = Math.pow(intensity(y), 0.8);
        for (let j = 0; j < canvas.height; j++) {
          const k = (j * canvas.width + i) * 4;
          img.data[k] = 255 * r * v + 6; img.data[k + 1] = 255 * g * v + 6; img.data[k + 2] = 255 * b * v + 8; img.data[k + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      tex.needsUpdate = true;

      const flat: number[] = [];
      if (!bool(p, 'block')) for (let m = -15; m <= 15; m++) {
        const z = ((m * beta()) / Y) * HALF_Z;
        if (Math.abs(z) > HALF_Z) continue;
        flat.push(SCREEN_X - 0.05, 1.22, z, SCREEN_X - 0.05, 1.45, z);
      }
      fringeTicks.setSegments(flat);

      const G = graphs.get('I');
      G.plot(0, -Y * 1e3, Y * 1e3, (ymm) => intensity(ymm * 1e-3), 700);
      G.plot(1, -Y * 1e3, Y * 1e3, (ymm) => singleSlitIntensity(ymm * 1e-3, lam(), D(), a()), 300);
      G.setVLines(bool(p, 'block') ? [] : [{ x: beta() * 1e3, label: 'β' }, { x: -beta() * 1e3 }]);
    }
    build();

    return {
      setParams(np) { p = np; build(); },
      reset() { t = 0; },
      step(dt) { t += dt; },
      render() { waveMat.uniforms.uTime.value = t; },
      time: () => t,
      readouts(): Readout[] {
        const b = beta();
        return [
          { label: 'Fringe width β = λD/d', value: b * 1e3, unit: 'mm', tone: 'accent' },
          { label: 'Angular fringe width λ/d', value: (lam() / d()) * 1e3, unit: 'mrad' },
          { label: 'Central envelope width 2λD/a', value: ((2 * lam() * D()) / a()) * 1e3, unit: 'mm' },
          { label: 'Bright fringes in envelope', value: 2 * Math.ceil(d() / a() - 1) + 1 },
          { label: '1st dark fringe at', value: (b / 2) * 1e3, unit: 'mm' },
          { label: 'Colour', value: colourName(num(p, 'lambda')) },
        ];
      },
      equations(): Equation[] {
        return [
          { expr: 'β = λ D / d', sub: `β = (${n(num(p, 'lambda'))}×10⁻⁹ × ${n(D())}) / (${n(num(p, 'd'))}×10⁻³) = ${n(beta() * 1e3)} mm` },
          { expr: 'Bright: d sin θ = mλ ,  Dark: d sin θ = (m + ½)λ' },
          { expr: 'yₘ = m λ D / d', sub: `y₁ = ${n(beta() * 1e3)} mm, y₂ = ${n(2 * beta() * 1e3)} mm` },
          { expr: 'I = I₀ cos²(πd sinθ/λ) · [sin β′ / β′]² ,  β′ = πa sinθ/λ', note: 'Two-slit interference modulated by single-slit diffraction.' },
        ];
      },
    };
  },
};

export default sim;
