import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { bool, num, str } from '../types';
import { C } from '../../engine/colors';
import { n, sampler } from '../shared';

const SP = 1.2; // lattice spacing (scene)
const NX = 11, NY = 7;
const XH = ((NX - 1) / 2) * SP, YH = ((NY - 1) / 2) * SP;
const DOPANT_SITES: [number, number][] = [[-4, 2], [2, -1], [-1, 1], [4, 2], [0, -2], [-3, -2], [3, 1], [-2, -1]];
const EG = 1.12; // eV, silicon
const KB_EV = 8.617e-5;
const PER_DOPANT = 1e15; // cm⁻³ represented by each drawn dopant atom

/** Intrinsic carrier concentration of Si (cm⁻³). */
const ni = (T: number) => Math.sqrt(2.8e19 * 1.04e19) * Math.pow(T / 300, 1.5) * Math.exp(-EG / (2 * KB_EV * T));
/** Equilibrium n, p for donor (ND) or acceptor (NA) doping, with n·p = nᵢ². */
function carriers(T: number, ND: number, NA: number) {
  const i = ni(T), net = ND - NA;
  const maj = Math.abs(net) / 2 + Math.sqrt((net * net) / 4 + i * i);
  const min = (i * i) / maj;
  return net >= 0 ? { n: maj, p: min, ni: i } : { n: min, p: maj, ni: i };
}

interface Carrier { pos: THREE.Vector3; vel: THREE.Vector3; mesh: THREE.Object3D; dead: boolean }

const sim: SimDefinition = {
  camera: { position: [0, -2, 13], target: [0, 0, 0], aspect: 1.5 },
  hint: 'Each silicon atom shares 4 electrons. A phosphorus atom brings a 5th (free electron); a boron atom brings only 3, leaving a hole.',
  params: [
    { kind: 'select', key: 'type', label: 'Material', default: 'n', options: [{ value: 'intrinsic', label: 'Pure (intrinsic) silicon' }, { value: 'n', label: 'n-type (phosphorus donors)' }, { value: 'p', label: 'p-type (boron acceptors)' }] },
    { kind: 'slider', key: 'dop', label: 'Dopant atoms shown (each ≈ 10¹⁵ cm⁻³)', min: 1, max: 8, step: 1, default: 5, showIf: (p) => p.type !== 'intrinsic' },
    { kind: 'slider', key: 'T', label: 'Temperature', unit: 'K', min: 150, max: 700, step: 5, default: 300 },
    { kind: 'toggle', key: 'E', label: 'Apply a voltage (field → right)', default: false },
  ],
  presets: [
    { label: 'Pure Si at room temperature', values: { type: 'intrinsic', T: 300 } },
    { label: 'Hot pure Si (600 K)', values: { type: 'intrinsic', T: 600 } },
    { label: 'n-type', values: { type: 'n', dop: 6, T: 300 } },
    { label: 'p-type with field', values: { type: 'p', dop: 6, T: 300, E: true } },
  ],
  graphs: [
    { id: 'C', title: 'Carrier concentration vs temperature (log₁₀ cm⁻³)', x: 'T (K)', y: 'log₁₀(n, p)', kind: 'curve', xRange: [150, 700], series: [{ label: 'electrons n', color: C.negative }, { label: 'holes p', color: '#f59e0b' }] },
    { id: 'N', title: 'Carriers in view', x: 't (s)', y: 'count', window: 20, zeroY: true, series: [{ label: 'free electrons', color: C.negative }, { label: 'holes', color: '#f59e0b' }] },
  ],
  learn: {
    concept: 'In pure (intrinsic) silicon a few covalent bonds are broken by heat, making equal numbers of free electrons and holes (n = p = nᵢ). Doping with a group-V element (P, As) adds donor electrons: n-type, electrons are the majority carriers. Doping with a group-III element (B, Al) creates holes: p-type. In every case n·p = nᵢ², so adding majority carriers suppresses the minority carriers. nᵢ rises very steeply with temperature.',
    variables: [['nᵢ', 'intrinsic carrier concentration (1.0 × 10¹⁰ cm⁻³ at 300 K)'], ['N_D, N_A', 'donor / acceptor concentration'], ['n, p', 'electron / hole concentration'], ['E_g', 'band gap of Si (1.12 eV)']],
    observe: [
      'Heating pure silicon creates more electron–hole pairs (dots appear in pairs).',
      'In n-type material the holes are rare minority carriers, and vice-versa.',
      'In a field, electrons drift against the field and holes with it — both give current in the same direction.',
      'Dopant ions (P⁺, B⁻) are fixed in the lattice; only the carriers move.',
    ],
    challenge: 'An n-type sample has N_D = 10¹⁶ cm⁻³ at 300 K. Find the hole concentration.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0, genAcc = 0, flowE = 0, flowH = 0;
    let electrons: Carrier[] = [];
    let holes: Carrier[] = [];
    const sample = sampler(1 / 5);
    const siGeo = new THREE.SphereGeometry(0.22, 14, 10);
    const siMat = kit.mat('#94a3b8');
    const bonds: number[] = [];
    for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) {
      const x = -XH + i * SP, y = -YH + j * SP;
      if (i < NX - 1) bonds.push(x + 0.25, y, 0, x + SP - 0.25, y, 0);
      if (j < NY - 1) bonds.push(x, y + 0.25, 0, x, y + SP - 0.25, 0);
    }
    kit.segments('#64748b', { width: 2.5, opacity: 0.7 }).setSegments(bonds);
    const atoms = new THREE.InstancedMesh(siGeo, siMat, NX * NY);
    kit.add(atoms);
    const dopants = DOPANT_SITES.map(([i, j]) => {
      const m = kit.sphere(0.27, '#a78bfa', { emissive: 0.3 });
      m.position.set(i * SP, j * SP, 0);
      const l = kit.label('', [i * SP + 0.35, j * SP + 0.35, 0], { small: true });
      return { m, l, i, j };
    });
    const eGeo = new THREE.SphereGeometry(0.1, 10, 8), eMat = kit.mat(C.negative, { emissive: 0.8 });
    const hGeo = new THREE.TorusGeometry(0.11, 0.035, 8, 16), hMat = kit.mat('#f59e0b', { emissive: 0.6 });
    const fieldArrow = kit.arrow('#e2e8f0', { radius: 0.05 });
    const fieldLabel = kit.label('', [0, YH + 1.1, 0], { small: true });

    const T = () => num(p, 'T');
    const type = () => str(p, 'type');
    const nd = () => (type() === 'intrinsic' ? 0 : num(p, 'dop'));
    const conc = () => carriers(T(), type() === 'n' ? nd() * PER_DOPANT : 0, type() === 'p' ? nd() * PER_DOPANT : 0);
    /** Thermal pairs in view, on a log scale of nᵢ (≈1 at 300 K, ≈9 at 700 K). */
    const pairTarget = () => Math.max(0, 1.1 * (Math.log10(ni(T())) - 9.2));
    const speed = () => 0.9 * Math.sqrt(T() / 300);

    function add(list: Carrier[], geo: THREE.BufferGeometry, mat: THREE.Material, at?: THREE.Vector3) {
      const mesh = new THREE.Mesh(geo, mat);
      kit.add(mesh);
      const a = Math.random() * Math.PI * 2;
      const pos = at ?? new THREE.Vector3((Math.random() * 2 - 1) * XH, (Math.random() * 2 - 1) * YH, 0);
      list.push({ pos: pos.clone().add(new THREE.Vector3(0, 0, 0.3)), vel: new THREE.Vector3(Math.cos(a), Math.sin(a), 0).multiplyScalar(speed()), mesh, dead: false });
    }
    function build() {
      const m4 = new THREE.Matrix4();
      let k = 0;
      for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) {
        const x = -XH + i * SP, y = -YH + j * SP;
        const isDop = DOPANT_SITES.slice(0, nd()).some(([a, b]) => Math.abs(a * SP - x) < 1e-6 && Math.abs(b * SP - y) < 1e-6);
        m4.makeScale(isDop ? 0 : 1, isDop ? 0 : 1, isDop ? 0 : 1).setPosition(x, y, 0);
        atoms.setMatrixAt(k++, m4);
      }
      atoms.instanceMatrix.needsUpdate = true;
      dopants.forEach((d, i) => {
        const on = i < nd();
        d.m.visible = on;
        (d.m.material as THREE.MeshStandardMaterial).color.set(type() === 'n' ? '#a78bfa' : '#fb923c');
        d.l.setText(on ? (type() === 'n' ? 'P⁺' : 'B⁻') : '');
      });
      fieldArrow.visible = bool(p, 'E');
      fieldArrow.set([-2, YH + 0.6, 0], [4, 0, 0]);
      fieldLabel.setText(bool(p, 'E') ? 'electric field E' : '');
      const G = graphs.get('C');
      const ND = type() === 'n' ? nd() * PER_DOPANT : 0, NA = type() === 'p' ? nd() * PER_DOPANT : 0;
      G.plot(0, 150, 700, (x) => Math.log10(carriers(x, ND, NA).n), 200);
      G.plot(1, 150, 700, (x) => Math.log10(carriers(x, ND, NA).p), 200);
      G.setMarkers([{ x: T(), y: Math.log10(conc().n), color: C.negative }, { x: T(), y: Math.log10(conc().p), color: '#f59e0b' }]);
    }
    function clearAll() {
      [...electrons, ...holes].forEach((c) => c.mesh.removeFromParent());
      electrons = []; holes = [];
    }
    function populate() {
      clearAll();
      // each ionised dopant gives one majority carrier
      for (let i = 0; i < nd(); i++) {
        const [a, b] = DOPANT_SITES[i];
        if (type() === 'n') add(electrons, eGeo, eMat, new THREE.Vector3(a * SP, b * SP, 0));
        else if (type() === 'p') add(holes, hGeo, hMat, new THREE.Vector3(a * SP, b * SP, 0));
      }
      for (let i = 0; i < Math.round(pairTarget()); i++) { const at = new THREE.Vector3((Math.random() * 2 - 1) * XH, (Math.random() * 2 - 1) * YH, 0); add(electrons, eGeo, eMat, at); add(holes, hGeo, hMat, at); }
    }
    function reset() { t = 0; genAcc = 0; flowE = 0; flowH = 0; sample.reset(); build(); populate(); }
    reset();

    function move(c: Carrier, dt: number, drift: number, mobility: number) {
      // random thermal motion with frequent scattering + drift along x
      if (Math.random() < dt * 3) { const a = Math.random() * Math.PI * 2; c.vel.set(Math.cos(a), Math.sin(a), 0).multiplyScalar(speed() * mobility); }
      c.pos.x += (c.vel.x + drift) * dt; c.pos.y += c.vel.y * dt;
      if (c.pos.y > YH) { c.pos.y = YH; c.vel.y *= -1; } else if (c.pos.y < -YH) { c.pos.y = -YH; c.vel.y *= -1; }
      if (c.pos.x > XH + 0.5) { c.pos.x -= 2 * XH + 1; return 1; }
      if (c.pos.x < -XH - 0.5) { c.pos.x += 2 * XH + 1; return -1; }
      return 0;
    }

    return {
      setParams(np) {
        const repop = str(np, 'type') !== str(p, 'type') || num(np, 'dop') !== num(p, 'dop');
        p = np; build();
        if (repop) populate();
      },
      reset,
      step(dt) {
        t += dt;
        const E = bool(p, 'E') ? 1 : 0;
        for (const e of electrons) flowE += move(e, dt, -1.2 * E, 1);
        for (const h of holes) flowH += move(h, dt, 0.45 * E, 0.55); // holes are less mobile
        // thermal generation of electron–hole pairs (rate chosen so the pair count settles near the log-scale target)
        const pairsNow = Math.min(electrons.length - (type() === 'n' ? nd() : 0), holes.length - (type() === 'p' ? nd() : 0));
        genAcc += dt * 0.8 * Math.max(0, pairTarget() - Math.max(0, pairsNow) + 0.3);
        while (genAcc >= 1) {
          genAcc -= 1;
          const at = new THREE.Vector3((Math.random() * 2 - 1) * XH, (Math.random() * 2 - 1) * YH, 0);
          add(electrons, eGeo, eMat, at); add(holes, hGeo, hMat, at.clone().add(new THREE.Vector3(0.5, 0, 0)));
        }
        // recombination when an electron meets a hole
        for (const h of holes) {
          if (h.dead) continue;
          for (const e of electrons) {
            if (e.dead || e.pos.distanceToSquared(h.pos) > 0.3 * 0.3) continue;
            e.dead = true; h.dead = true; break;
          }
        }
        // dopant ions keep supplying majority carriers (always ionised at these temperatures)
        const majE = type() === 'n' ? nd() : 0, majH = type() === 'p' ? nd() : 0;
        const kill = (l: Carrier[]) => l.filter((c) => { if (c.dead) c.mesh.removeFromParent(); return !c.dead; });
        electrons = kill(electrons); holes = kill(holes);
        while (electrons.length < majE) { const [a, b] = DOPANT_SITES[electrons.length % DOPANT_SITES.length]; add(electrons, eGeo, eMat, new THREE.Vector3(a * SP, b * SP, 0)); }
        while (holes.length < majH) { const [a, b] = DOPANT_SITES[holes.length % DOPANT_SITES.length]; add(holes, hGeo, hMat, new THREE.Vector3(a * SP, b * SP, 0)); }
        if (sample.due(t)) graphs.get('N').push(t, electrons.length, holes.length);
      },
      render() {
        for (const e of electrons) e.mesh.position.copy(e.pos);
        for (const h of holes) h.mesh.position.copy(h.pos);
      },
      time: () => t,
      readouts(): Readout[] {
        const c = conc();
        const s = Math.pow(T() / 300, -1.5);
        const sigma = 1.602e-19 * (c.n * 1350 * s + c.p * 480 * s); // S/cm
        return [
          { label: 'Intrinsic concentration nᵢ', value: c.ni, unit: 'cm⁻³' },
          { label: 'Electron concentration n', value: c.n, unit: 'cm⁻³', tone: 'accent' },
          { label: 'Hole concentration p', value: c.p, unit: 'cm⁻³', tone: 'accent' },
          { label: 'Majority carriers', value: c.n > c.p * 1.01 ? 'Electrons' : c.p > c.n * 1.01 ? 'Holes' : 'Equal (intrinsic)' },
          { label: 'n · p / nᵢ²', value: (c.n * c.p) / (c.ni * c.ni) },
          { label: 'Resistivity', value: 1 / sigma, unit: 'Ω·cm' },
          { label: 'Net charge carried across (view)', value: flowH - flowE },
        ];
      },
      equations(): Equation[] {
        const c = conc();
        return [
          { expr: 'n · p = nᵢ²', sub: `${n(c.n)} × ${n(c.p)} = ${n(c.ni * c.ni)}` },
          { expr: 'nᵢ ∝ T^{3/2} e^(−E_g / 2kT)', sub: `= ${n(c.ni)} cm⁻³ at ${n(T())} K` },
          { expr: 'σ = e (n μₙ + p μₚ)' },
        ];
      },
      dispose() { siGeo.dispose(); eGeo.dispose(); hGeo.dispose(); },
    };
  },
};

export default sim;
