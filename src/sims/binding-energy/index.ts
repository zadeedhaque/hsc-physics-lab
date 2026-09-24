import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { bindingEnergy, semiEmpiricalBE, stableZ, massU } from '../../physics/nuclear';
import { MeVperU } from '../../physics/constants';
import { C } from '../../engine/colors';
import { n } from '../shared';

/** Measured atomic masses (u). */
const NUCLIDES: Record<string, { name: string; Z: number; A: number; m: number }> = {
  h2: { name: 'Deuterium ²H', Z: 1, A: 2, m: 2.014_102 },
  he4: { name: 'Helium-4', Z: 2, A: 4, m: 4.002_602 },
  li7: { name: 'Lithium-7', Z: 3, A: 7, m: 7.016_003 },
  c12: { name: 'Carbon-12', Z: 6, A: 12, m: 12 },
  o16: { name: 'Oxygen-16', Z: 8, A: 16, m: 15.994_915 },
  fe56: { name: 'Iron-56', Z: 26, A: 56, m: 55.934_936 },
  kr92: { name: 'Krypton-92', Z: 36, A: 92, m: 91.926_156 },
  ba141: { name: 'Barium-141', Z: 56, A: 141, m: 140.914_411 },
  pb208: { name: 'Lead-208', Z: 82, A: 208, m: 207.976_652 },
  u235: { name: 'Uranium-235', Z: 92, A: 235, m: 235.043_930 },
  u238: { name: 'Uranium-238', Z: 92, A: 238, m: 238.050_788 },
};
const MAXA = 250;
const RN = 0.22; // nucleon sphere radius (scene)

const sim: SimDefinition = {
  camera: { position: [0, 2, 12], target: [0, 0.5, 0], aspect: 1.4 },
  timeless: true,
  hint: 'Pull the nucleus apart: the energy you must supply is the binding energy — exactly the mass defect × c².',
  params: [
    { kind: 'select', key: 'nuc', label: 'Nucleus', default: 'fe56', options: [...Object.entries(NUCLIDES).map(([value, x]) => ({ value, label: x.name })), { value: 'custom', label: 'Custom (semi-empirical formula)' }] },
    { kind: 'slider', key: 'A', label: 'Mass number A', min: 2, max: MAXA, step: 1, default: 100, showIf: (p) => p.nuc === 'custom' },
    { kind: 'slider', key: 'Z', label: 'Proton number Z', min: 1, max: 100, step: 1, default: 44, showIf: (p) => p.nuc === 'custom' },
    { kind: 'slider', key: 'sep', label: 'Pull the nucleons apart', unit: '%', min: 0, max: 100, step: 1, default: 0 },
  ],
  presets: [
    { label: 'Most stable: iron-56', values: { nuc: 'fe56', sep: 0 } },
    { label: 'Helium-4 (very tightly bound)', values: { nuc: 'he4' } },
    { label: 'Uranium-235', values: { nuc: 'u235' } },
    { label: 'Take apart deuterium', values: { nuc: 'h2', sep: 100 } },
  ],
  graphs: [
    { id: 'B', title: 'Binding energy per nucleon', x: 'mass number A', y: 'BE/A (MeV)', kind: 'curve', xRange: [1, 250], yRange: [0, 9.5], series: [{ label: 'semi-empirical (stable Z)', color: C.accent }] },
  ],
  learn: {
    concept: 'A nucleus weighs less than the protons and neutrons that make it. The difference, the mass defect Δm = Zm_H + Nm_n − M, is the binding energy BE = Δm c² (1 u = 931.5 MeV) — the energy needed to pull the nucleus completely apart. Binding energy per nucleon rises steeply for light nuclei, peaks near iron-56 (~8.8 MeV) and falls slowly for heavy ones. So energy is released by fusing light nuclei or by splitting heavy ones — both move toward the peak.',
    variables: [['Z, N, A', 'protons, neutrons, nucleons'], ['m_H', 'hydrogen atom mass 1.007825 u'], ['m_n', 'neutron mass 1.008665 u'], ['M', 'measured atomic mass'], ['BE/A', 'binding energy per nucleon']],
    observe: [
      'Helium-4 lies well above its neighbours — it is unusually stable.',
      'Iron and nickel sit at the top of the curve.',
      'Splitting U-235 into Ba + Kr raises BE/A by about 0.9 MeV per nucleon → ~200 MeV per fission.',
    ],
    challenge: 'Using the curve, estimate the energy released when two deuterium nuclei fuse into helium-4.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    const pGeo = new THREE.SphereGeometry(RN, 14, 10);
    const protons = new THREE.InstancedMesh(pGeo, kit.mat(C.positive, { emissive: 0.2 }), MAXA);
    const neutrons = new THREE.InstancedMesh(pGeo, kit.mat('#94a3b8'), MAXA);
    kit.add(protons); kit.add(neutrons);
    const title = kit.label('', [0, 4.2, 0], { color: C.accent });
    const energyLabel = kit.label('', [0, -3.6, 0], { small: true });
    const bar = kit.line(C.hot, [], { width: 4 });
    const barBg = kit.line('#334155', [[-4, -3, 0], [4, -3, 0]], { width: 4 });
    void barBg;

    const custom = () => str(p, 'nuc') === 'custom';
    const nuc = () => NUCLIDES[str(p, 'nuc')] ?? NUCLIDES.fe56;
    const A = () => (custom() ? num(p, 'A') : nuc().A);
    const Z = () => (custom() ? Math.min(num(p, 'Z'), A()) : nuc().Z);
    const BE = () => {
      if (!custom()) return bindingEnergy(Z(), A(), nuc().m);
      const be = semiEmpiricalBE(Z(), A());
      const mass = Z() * (massU.p + massU.e) + (A() - Z()) * massU.n - be / MeVperU;
      return { defect: be / MeVperU, BE: be, perNucleon: be / A(), mass };
    };
    const atomicMass = () => (custom() ? Z() * (massU.p + massU.e) + (A() - Z()) * massU.n - BE().defect : nuc().m);

    graphs.get('B').plot(0, 2, 250, (a) => Math.max(0, semiEmpiricalBE(stableZ(a), Math.round(a)) / Math.round(a)), 249);

    function draw() {
      const a = A(), z = Z();
      const R = RN * 1.25 * Math.cbrt(a);
      const sep = num(p, 'sep') / 100;
      const m4 = new THREE.Matrix4();
      let ip = 0, iN = 0;
      // shuffle protons among positions with a fixed interleave
      for (let i = 0; i < a; i++) {
        const r = a === 1 ? 0 : R * Math.cbrt((i + 0.5) / a);
        const y = 1 - (2 * (i + 0.5)) / a;
        const th = i * 2.399963; // golden angle
        const s = Math.sqrt(Math.max(0, 1 - y * y));
        const dir = new THREE.Vector3(s * Math.cos(th), y, s * Math.sin(th));
        const pos = dir.multiplyScalar(r * (1 + sep * 2.2) + sep * 1.2).add(new THREE.Vector3(0, 0.5, 0));
        m4.makeTranslation(pos.x, pos.y, pos.z);
        const isP = Math.floor(((i + 1) * z) / a) > Math.floor((i * z) / a);
        if (isP) protons.setMatrixAt(ip++, m4); else neutrons.setMatrixAt(iN++, m4);
      }
      protons.count = ip; neutrons.count = iN;
      protons.instanceMatrix.needsUpdate = true; neutrons.instanceMatrix.needsUpdate = true;
      const b = BE();
      title.setText(`${custom() ? `Z = ${z}, A = ${a}` : nuc().name}`);
      bar.setPoints([[-4, -3, 0.01], [-4 + 8 * sep, -3, 0.01]]);
      bar.visible = sep > 0;
      energyLabel.setText(`energy supplied: ${n(b.BE * sep)} of ${n(b.BE)} MeV`);
      graphs.get('B').setMarkers([{ x: a, y: b.perNucleon, color: C.hot }, ...(!custom() ? Object.values(NUCLIDES).map((q) => ({ x: q.A, y: bindingEnergy(q.Z, q.A, q.m).perNucleon, color: '#94a3b8' })) : [])]);
    }
    draw();

    return {
      setParams(np) { p = np; draw(); },
      reset() { draw(); },
      step() {},
      readouts(): Readout[] {
        const b = BE();
        return [
          { label: 'Protons Z', value: Z() },
          { label: 'Neutrons N', value: A() - Z() },
          { label: 'Mass of separate parts', value: Z() * (massU.p + massU.e) + (A() - Z()) * massU.n, unit: 'u', digits: 6 },
          { label: custom() ? 'Mass (from formula)' : 'Measured atomic mass', value: atomicMass(), unit: 'u', digits: 6 },
          { label: 'Mass defect Δm', value: b.defect, unit: 'u', digits: 5, tone: 'accent' },
          { label: 'Binding energy', value: b.BE, unit: 'MeV', tone: 'accent' },
          { label: 'BE per nucleon', value: b.perNucleon, unit: 'MeV', tone: 'accent' },
          { label: 'Bound?', value: b.BE > 0 ? 'Yes' : 'No — would fly apart', tone: b.BE > 0 ? 'good' : 'bad' },
        ];
      },
      equations(): Equation[] {
        const b = BE();
        return [
          { expr: 'Δm = Z m_H + N m_n − M', sub: `= ${Z()}×1.007825 + ${A() - Z()}×1.008665 − ${n(atomicMass())} = ${n(b.defect)} u` },
          { expr: 'BE = Δm × 931.5 MeV', sub: `= ${n(b.BE)} MeV` },
          { expr: 'BE / A', sub: `= ${n(b.BE)} / ${A()} = ${n(b.perNucleon)} MeV per nucleon` },
        ];
      },
      dispose() { pGeo.dispose(); },
    };
  },
};

export default sim;
