import type * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { C } from '../../engine/colors';
import { n } from '../shared';
import { CurrentPath, battery, diode, glow, lightUp, meter, resistor, wire } from '../circuitKit';

const RZ = 5; // zener dynamic resistance (Ω)
const PMAX = 0.5; // zener power rating (W)

/** Regulator with a real (sloped) zener: V_out = V_z + r_z I_z once in breakdown. */
function solve(Vin: number, Rs: number, RL: number, Vz: number) {
  const Vopen = (Vin * RL) / (Rs + RL);
  if (Vopen <= Vz) return { Vout: Vopen, Iz: 0, Is: Vin / (Rs + RL), IL: Vopen / RL, reg: false };
  const Vout = (Vz + (RZ * Vin) / Rs) / (1 + RZ / Rs + RZ / RL);
  const Is = (Vin - Vout) / Rs, IL = Vout / RL;
  return { Vout, Iz: Is - IL, Is, IL, reg: true };
}

const sim: SimDefinition = {
  camera: { position: [0, 0, 12], target: [0, 0, 0], aspect: 1.4 },
  hint: 'Once the input exceeds the Zener voltage, the Zener takes whatever current is needed to hold the output almost constant.',
  params: [
    { kind: 'slider', key: 'Vin', label: 'Input voltage', unit: 'V', min: 0, max: 25, step: 0.1, default: 12 },
    { kind: 'slider', key: 'Rs', label: 'Series resistor Rₛ', unit: 'Ω', min: 50, max: 1000, step: 10, default: 220 },
    { kind: 'select', key: 'Vz', label: 'Zener voltage', default: '5.1', options: ['3.3', '5.1', '6.2', '9.1', '12'].map((v) => ({ value: v, label: `${v} V` })) },
    { kind: 'slider', key: 'RL', label: 'Load resistance R_L', unit: 'Ω', min: 50, max: 5000, step: 10, default: 1000 },
  ],
  presets: [
    { label: 'Regulating', values: { Vin: 12, RL: 1000 } },
    { label: 'Input too low', values: { Vin: 4 } },
    { label: 'Heavy load (drops out)', values: { Vin: 9, RL: 100 } },
    { label: 'Zener overheating', values: { Vin: 25, Rs: 50, RL: 5000 } },
  ],
  graphs: [
    { id: 'T', title: 'Output voltage vs input voltage', x: 'V_in (V)', y: 'V_out (V)', kind: 'curve', xRange: [0, 25], zeroY: true, series: [{ label: 'V_out', color: C.accent }] },
    { id: 'Z', title: 'Zener reverse characteristic', x: 'reverse voltage (V)', y: 'I_z (mA)', kind: 'curve', xRange: [0, 14], zeroY: true, series: [{ label: 'I_z', color: C.current }] },
  ],
  learn: {
    concept: 'A Zener diode is designed to conduct in reverse once the voltage reaches its breakdown (Zener) voltage V_z, and the voltage across it then stays almost constant. In a regulator, a series resistor Rₛ takes up the difference between the input and V_z. The current through Rₛ splits between the Zener and the load: Iₛ = I_z + I_L. As long as I_z stays positive (and below its maximum rating), the output stays at V_z even when the input or the load changes.',
    variables: [['V_z', 'Zener (breakdown) voltage'], ['Iₛ', '(V_in − V_z)/Rₛ'], ['I_L', 'V_z / R_L'], ['I_z', 'Iₛ − I_L'], ['P_z', 'V_z I_z (must stay below the rating)']],
    observe: [
      'The output follows the input until V_z, then flattens.',
      'Lowering R_L steals current from the Zener; if I_z reaches 0, regulation is lost.',
      'At high input with a light load the Zener dissipates a lot of power.',
    ],
    challenge: 'Choose Rₛ so a 5.1 V Zener regulates a 12 V input into a 250 Ω load with I_z ≈ 10 mA.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0;
    wire(kit, [[-5, -2], [-5, 2], [4, 2], [4, -2], [-5, -2]]);
    wire(kit, [[0, 2], [0, -2]]);
    const cell = battery(kit, [-5, 0], 'y', '');
    const rs = resistor(kit, [-2.5, 2], 'x', '');
    const z = diode(kit, [0, 0], 'y+', 'Zener', '#e2e8f0');
    // bent ends on the cathode bar mark a Zener
    kit.line('#e2e8f0', [[-0.36, 0.27, 0.05], [-0.46, 0.4, 0.05]], { width: 2.5 });
    kit.line('#e2e8f0', [[0.36, 0.27, 0.05], [0.46, 0.14, 0.05]], { width: 2.5 });
    const rl = resistor(kit, [4, 0], 'y', '');
    const vm = meter(kit, [5.6, 0], 'V', [0, 0.75]);
    kit.line('#94a3b8', [[4, 1.2, 0], [5.6, 1.2, 0], [5.6, 0.34, 0]], { width: 1.5, dashed: true });
    kit.line('#94a3b8', [[4, -1.2, 0], [5.6, -1.2, 0], [5.6, -0.34, 0]], { width: 1.5, dashed: true });
    const zPath = new CurrentPath(kit, [[-5, -2], [-5, 2], [0, 2], [0, -2], [-5, -2]], C.current);
    const lPath = new CurrentPath(kit, [[-5, -2], [-5, 2], [4, 2], [4, -2], [-5, -2]], '#fbbf24', 0.6, 0.16);
    const iz = kit.label('', [-1.3, -0.9, 0], { color: C.current, small: true });
    const il = kit.label('', [2.6, -0.9, 0], { color: '#fbbf24', small: true });

    const Vz = () => Number(str(p, 'Vz')) || 5.1;
    const s = () => solve(num(p, 'Vin'), num(p, 'Rs'), num(p, 'RL'), Vz());
    function build() {
      cell.label.setText(`${n(num(p, 'Vin'))} V`);
      rs.label.setText(`Rₛ ${n(num(p, 'Rs'))} Ω`);
      rl.label.setText(`R_L ${n(num(p, 'RL'))} Ω`);
      graphs.get('T').plot(0, 0, 25, (v) => solve(v, num(p, 'Rs'), num(p, 'RL'), Vz()).Vout, 300);
      graphs.get('T').setMarkers([{ x: num(p, 'Vin'), y: s().Vout, color: C.accent }]);
      graphs.get('Z').plot(0, 0, 14, (v) => (v <= Vz() ? 0 : ((v - Vz()) / RZ) * 1000), 400);
      graphs.get('Z').setMarkers([{ x: s().reg ? Vz() + RZ * s().Iz : s().Vout, y: s().Iz * 1000, color: C.current }]);
      const r = s();
      lightUp(z.mat as THREE.MeshStandardMaterial, (r.Iz * r.Vout) / PMAX, r.Iz * r.Vout > PMAX ? '#ef4444' : '#fde68a');
      glow(rs.mat as THREE.MeshStandardMaterial, r.Is * r.Is * num(p, 'Rs'), 1);
    }
    build();

    return {
      setParams(np) { p = np; build(); },
      reset() { t = 0; },
      step(dt) {
        t += dt;
        const r = s();
        zPath.advance(Math.min(5, r.Iz * 150) * dt);
        lPath.advance(Math.min(5, r.IL * 150) * dt);
      },
      render() {
        const r = s();
        vm.setText(`${n(r.Vout)} V`);
        iz.setText(`I_z ${n(r.Iz * 1000)} mA`);
        il.setText(`I_L ${n(r.IL * 1000)} mA`);
      },
      time: () => t,
      readouts(): Readout[] {
        const r = s();
        const Pz = r.Iz * r.Vout;
        return [
          { label: 'Output voltage', value: r.Vout, unit: 'V', tone: 'accent' },
          { label: 'Regulating?', value: r.reg ? 'Yes' : 'No — below V_z', tone: r.reg ? 'good' : 'bad' },
          { label: 'Series current Iₛ', value: r.Is * 1000, unit: 'mA' },
          { label: 'Zener current I_z', value: r.Iz * 1000, unit: 'mA', tone: 'accent' },
          { label: 'Load current I_L', value: r.IL * 1000, unit: 'mA' },
          { label: 'Zener power', value: Pz * 1000, unit: 'mW', tone: Pz > PMAX ? 'bad' : undefined },
          { label: 'Zener rating', value: Pz > PMAX ? 'EXCEEDED (0.5 W)' : 'OK (< 0.5 W)', tone: Pz > PMAX ? 'bad' : 'good' },
          { label: 'Power in Rₛ', value: r.Is * r.Is * num(p, 'Rs') * 1000, unit: 'mW' },
        ];
      },
      equations(): Equation[] {
        const r = s();
        return [
          { expr: 'Iₛ = (V_in − V_out) / Rₛ', sub: `= (${n(num(p, 'Vin'))} − ${n(r.Vout)}) / ${n(num(p, 'Rs'))} = ${n(r.Is * 1000)} mA` },
          { expr: 'I_L = V_out / R_L', sub: `= ${n(r.IL * 1000)} mA` },
          { expr: 'I_z = Iₛ − I_L', sub: `= ${n(r.Iz * 1000)} mA` },
        ];
      },
    };
  },
};

export default sim;
