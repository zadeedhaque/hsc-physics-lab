import type { PaperId } from './syllabus';
import type { Params } from '../sims/types';

/**
 * Every syllabus topic. A topic is backed by a simulation module (`module`, defaulting to its id).
 * Several topics can share one module with different starting values (`initial`) — e.g. the
 * horizontal projectile is the projectile simulation launched at 0°.
 */
export type Glyph =
  | 'measure' | 'sigfig' | 'dimension' | 'vector' | 'motion' | 'projectile' | 'circle' | 'force' | 'friction' | 'incline'
  | 'pulley' | 'collision' | 'rotation' | 'energy' | 'spring' | 'orbit' | 'planet' | 'matter' | 'drop' | 'fluid'
  | 'pendulum' | 'oscillation' | 'wave' | 'sound' | 'gas' | 'heat' | 'engine' | 'charge' | 'field' | 'capacitor'
  | 'circuit' | 'magnet' | 'coil' | 'ac' | 'mirror' | 'ray' | 'prism' | 'lens' | 'interference' | 'polarize'
  | 'relativity' | 'photon' | 'atom' | 'nuclear' | 'semiconductor' | 'diode' | 'logic' | 'star' | 'spectrum';

export interface Topic {
  id: string;
  paper: PaperId;
  chapter: number;
  title: string;
  summary: string;
  glyph: Glyph;
  tags: string[];
  module?: string;
  initial?: Params;
}

const T = (paper: PaperId, chapter: number, id: string, title: string, summary: string, glyph: Glyph, tags: string, extra: Partial<Topic> = {}): Topic => ({
  id, paper, chapter, title, summary, glyph, tags: tags.split(',').map((s) => s.trim()).filter(Boolean), ...extra,
});

export const TOPICS: Topic[] = [
  /* ═════════ Physics 1st Paper ═════════ */
  // Ch 1 — Physical World and Measurement
  T(1, 1, 'vernier-caliper', 'Vernier Caliper', 'Read a vernier scale, find the least count and correct zero error.', 'measure', 'measurement, least count, zero error, error', { module: 'instrument', initial: { instrument: 'vernier' } }),
  T(1, 1, 'screw-gauge', 'Screw Gauge', 'Measure a wire’s diameter with pitch, circular scale and zero error.', 'measure', 'micrometer, pitch, least count, measurement', { module: 'instrument', initial: { instrument: 'screw' } }),
  T(1, 1, 'measurement-uncertainty', 'Measurement Uncertainty', 'Repeat a noisy measurement and watch the mean and spread converge.', 'measure', 'error, uncertainty, mean, standard deviation, precision, accuracy'),
  T(1, 1, 'significant-figures', 'Significant Figures', 'Apply significant-figure rules to add, subtract, multiply and divide.', 'sigfig', 'sig fig, rounding, precision, calculation'),
  T(1, 1, 'dimensional-analysis', 'Dimensional Analysis', 'Build dimensional formulas and check whether equations are consistent.', 'dimension', 'dimension, units, homogeneity, MLT'),

  // Ch 2 — Vector
  T(1, 2, 'vector-addition', 'Vector Addition', 'Add vectors in 3D with the triangle and parallelogram laws.', 'vector', 'resultant, parallelogram, triangle law', { module: 'vector-ops', initial: { op: 'add' } }),
  T(1, 2, 'vector-subtraction', 'Vector Subtraction', 'Subtract vectors by adding the negative vector.', 'vector', 'difference, negative vector', { module: 'vector-ops', initial: { op: 'sub' } }),
  T(1, 2, 'dot-product', 'Dot Product', 'Scalar product A·B = AB cos θ and the angle between vectors.', 'vector', 'scalar product, projection, angle', { module: 'vector-ops', initial: { op: 'dot' } }),
  T(1, 2, 'cross-product', 'Cross Product', 'Vector product A×B — perpendicular to both, magnitude AB sin θ.', 'vector', 'vector product, right hand rule, torque', { module: 'vector-ops', initial: { op: 'cross' } }),
  T(1, 2, 'vector-resolution', 'Resolution of a Vector', 'Split a 3D vector into Fx, Fy and Fz components.', 'vector', 'components, unit vector, direction cosines'),

  // Ch 3 — Dynamics
  T(1, 3, 'uniform-motion', 'Uniform Motion', 'Constant velocity: equal displacements in equal times.', 'motion', 'constant velocity, displacement, speed', { module: 'motion-1d', initial: { profile: 'uniform' } }),
  T(1, 3, 'uniform-acceleration', 'Uniformly Accelerated Motion', 'v = u + at, s = ut + ½at² on a live track.', 'motion', 'equations of motion, suvat, acceleration', { module: 'motion-1d', initial: { profile: 'accel' } }),
  T(1, 3, 'motion-graphs', 'Motion Graphs', 'Displacement, velocity and acceleration graphs drawn live from a moving cart.', 'motion', 'position time graph, velocity time graph, acceleration time graph, slope, area', { module: 'motion-1d', initial: { profile: 'trip' } }),
  T(1, 3, 'free-fall', 'Free Fall', 'Objects falling under gravity, with optional air resistance.', 'motion', 'gravity, g, falling body, drag'),
  T(1, 3, 'projectile-motion', 'Projectile Motion', 'Launch at any angle and height; compare with air resistance.', 'projectile', 'range, maximum height, time of flight, oblique projectile, trajectory'),
  T(1, 3, 'horizontal-projectile', 'Horizontal Projectile', 'Launched horizontally from a height — a half-parabola.', 'projectile', 'horizontal launch, cliff, projectile', { module: 'projectile-motion', initial: { angle: 0, h0: 40, u: 15 } }),
  T(1, 3, 'relative-motion', 'Relative Motion', 'Two moving bodies and the velocity of one seen from the other.', 'motion', 'relative velocity, frame of reference, river boat'),
  T(1, 3, 'circular-motion', 'Circular Motion', 'Centripetal acceleration and force in uniform circular motion.', 'circle', 'centripetal, angular velocity, period, frequency'),

  // Ch 4 — Newtonian Mechanics
  T(1, 4, 'newton-first-law', 'Newton’s First Law', 'Inertia: a body keeps its velocity unless a net force acts.', 'force', 'inertia, first law, net force'),
  T(1, 4, 'newton-second-law', 'Newton’s Second Law', 'F = ma — change the force or the mass and watch the acceleration.', 'force', 'F=ma, acceleration, mass, force'),
  T(1, 4, 'newton-third-law', 'Newton’s Third Law', 'Two skaters push apart: equal and opposite forces, unequal accelerations.', 'force', 'action reaction, third law, pair forces'),
  T(1, 4, 'friction', 'Friction', 'Static and kinetic friction on a horizontal surface.', 'friction', 'static friction, kinetic friction, coefficient, normal force'),
  T(1, 4, 'inclined-plane', 'Inclined Plane', 'Weight components, normal reaction and friction on a slope.', 'incline', 'slope, ramp, angle of repose, components'),
  T(1, 4, 'atwood-machine', 'Pulley System (Atwood Machine)', 'Two masses over a pulley: acceleration and rope tension.', 'pulley', 'pulley, tension, atwood'),
  T(1, 4, 'momentum', 'Momentum & Its Conservation', 'p = mv — an explosion/recoil where total momentum stays zero.', 'collision', 'momentum, conservation, recoil, gun'),
  T(1, 4, 'impulse', 'Impulse', 'J = FΔt — the area under a force–time curve changes momentum.', 'collision', 'impulse, force time graph, change in momentum'),
  T(1, 4, 'collision', 'Collisions', 'Elastic, inelastic and perfectly inelastic collisions in 1D.', 'collision', 'elastic, inelastic, restitution, kinetic energy, momentum'),
  T(1, 4, 'torque', 'Torque & Moment of a Force', 'τ = rF sin θ — rotate a lever with forces at different points.', 'rotation', 'torque, moment, lever, rotation, couple'),
  T(1, 4, 'moment-of-inertia', 'Moment of Inertia (Rolling)', 'Ring, disc and sphere race down a ramp — I decides the winner.', 'rotation', 'rotational inertia, rolling, radius of gyration'),
  T(1, 4, 'angular-momentum', 'Conservation of Angular Momentum', 'A spinning skater pulls in their arms: L = Iω stays constant.', 'rotation', 'angular momentum, spin, Iω'),
  T(1, 4, 'banking-of-roads', 'Banking of Roads', 'Why curved roads are tilted: tan θ = v²/rg.', 'circle', 'banking, curve, centripetal, car'),

  // Ch 5 — Work, Energy and Power
  T(1, 5, 'work', 'Work Done by a Force', 'W = Fs cos θ — pull a block at an angle.', 'energy', 'work, force, displacement, angle', { module: 'work-energy', initial: { focus: 'work' } }),
  T(1, 5, 'work-energy-theorem', 'Work–Energy Theorem', 'Net work equals the change in kinetic energy — shown live.', 'energy', 'work energy theorem, kinetic energy', { module: 'work-energy', initial: { focus: 'theorem', mu: 0.2 } }),
  T(1, 5, 'power', 'Power', 'P = W/t = Fv — the rate at which work is done.', 'energy', 'power, watt, rate of work', { module: 'work-energy', initial: { focus: 'power' } }),
  T(1, 5, 'kinetic-energy', 'Kinetic Energy', 'KE = ½mv² along a frictionless track.', 'energy', 'kinetic energy, speed, mass', { module: 'energy-conservation', initial: { view: 'ke' } }),
  T(1, 5, 'potential-energy', 'Gravitational Potential Energy', 'PE = mgh as a ball climbs and falls.', 'energy', 'potential energy, height, mgh', { module: 'energy-conservation', initial: { view: 'pe' } }),
  T(1, 5, 'energy-conservation', 'Conservation of Mechanical Energy', 'A ball on a track: KE and PE trade while the total stays fixed.', 'energy', 'mechanical energy, roller coaster, conservation'),
  T(1, 5, 'spring-energy', 'Elastic Potential Energy', 'Compress a spring (½kx²) and launch a block with it.', 'spring', 'spring, elastic energy, hooke, launcher'),

  // Ch 6 — Gravitation
  T(1, 6, 'newton-gravitation', 'Newton’s Law of Gravitation', 'F = Gm₁m₂/r² between two masses.', 'orbit', 'gravitation, inverse square, G'),
  T(1, 6, 'gravitational-field', 'Gravitational Field & Variation of g', 'Field vectors around a planet; g with height and depth.', 'planet', 'field intensity, g, height, depth'),
  T(1, 6, 'gravitational-potential', 'Gravitational Potential', 'The potential well V = −GM/r around a planet.', 'planet', 'potential, potential energy, well'),
  T(1, 6, 'escape-velocity', 'Escape Velocity', 'Launch speed needed to escape a planet: vₑ = √(2GM/R).', 'planet', 'escape velocity, launch, planet'),
  T(1, 6, 'satellite-orbit', 'Satellite Orbit', 'Orbital speed, period and the shape of the orbit.', 'orbit', 'satellite, orbital velocity, period, geostationary'),
  T(1, 6, 'keplers-laws', 'Kepler’s Laws', 'Elliptical orbits, equal areas in equal times, T² ∝ a³.', 'orbit', 'kepler, ellipse, areal velocity, period'),

  // Ch 7 — Structural Properties of Matter
  T(1, 7, 'elasticity', 'Elasticity: Stress & Strain', 'Stretch a wire and read stress, strain and Young’s modulus.', 'matter', 'stress, strain, young modulus, elastic limit'),
  T(1, 7, 'hookes-law', 'Hooke’s Law', 'Hang loads on a spring: extension ∝ force.', 'spring', 'hooke, spring constant, extension'),
  T(1, 7, 'surface-tension', 'Surface Tension', 'Drops, excess pressure and why small drops are round.', 'drop', 'surface tension, drop, excess pressure'),
  T(1, 7, 'capillarity', 'Capillarity', 'Liquid rise (or fall) in narrow tubes: h = 2T cosθ/ρgr.', 'drop', 'capillary, jurin, contact angle'),
  T(1, 7, 'viscosity', 'Viscosity', 'Layers of fluid sliding past each other: F = ηA dv/dx.', 'fluid', 'viscosity, laminar flow, velocity gradient'),
  T(1, 7, 'stokes-law', 'Stokes’ Law', 'Viscous drag on a sphere: F = 6πηrv.', 'fluid', 'stokes, drag, viscous force', { module: 'terminal-velocity', initial: { fluid: 'castor' } }),
  T(1, 7, 'terminal-velocity', 'Terminal Velocity', 'A sphere falling through a fluid until forces balance.', 'fluid', 'terminal velocity, viscous, falling sphere'),

  // Ch 8 — Periodic Motion
  T(1, 8, 'shm-spring', 'Simple Harmonic Motion', 'A spring–mass oscillator with live x, v and a.', 'oscillation', 'shm, spring, period, frequency, phase'),
  T(1, 8, 'pendulum', 'Simple Pendulum', 'Period vs length, gravity and amplitude (small and large angles).', 'pendulum', 'pendulum, period, length, g'),
  T(1, 8, 'shm-graphs', 'SHM Graphs', 'Displacement, velocity and acceleration against time — phase relations.', 'oscillation', 'shm graph, phase difference, x-t, v-t, a-t', { module: 'shm-spring', initial: { bars: false, circle: true } }),
  T(1, 8, 'shm-energy', 'Energy in SHM', 'Kinetic and potential energy exchange; total stays ½kA².', 'oscillation', 'shm energy, kinetic, potential', { module: 'shm-spring', initial: { bars: true, circle: false } }),

  // Ch 9 — Waves
  T(1, 9, 'transverse-wave', 'Transverse Wave', 'Amplitude, wavelength, frequency and v = fλ.', 'wave', 'wave, wavelength, frequency, speed, transverse'),
  T(1, 9, 'longitudinal-wave', 'Longitudinal Wave', 'Compressions and rarefactions in a line of particles.', 'sound', 'longitudinal, compression, rarefaction'),
  T(1, 9, 'superposition', 'Superposition of Waves', 'Two waves add point by point: constructive and destructive.', 'wave', 'superposition, interference, phase'),
  T(1, 9, 'standing-waves', 'Standing Waves', 'Nodes and antinodes from two opposite travelling waves.', 'wave', 'stationary wave, node, antinode'),
  T(1, 9, 'string-vibration', 'Vibrating String', 'Harmonics of a stretched string: fₙ = (n/2L)√(T/μ).', 'wave', 'string, harmonics, tension, linear density, sonometer'),
  T(1, 9, 'sound-wave', 'Sound Wave', 'Frequency, amplitude, wavelength and the speed of sound.', 'sound', 'sound, pitch, loudness, speed of sound', { module: 'longitudinal-wave', initial: { medium: 'air', f: 340, slow: 800 } }),
  T(1, 9, 'beats', 'Beats', 'Two close frequencies produce a pulsing envelope at |f₁ − f₂|.', 'sound', 'beats, beat frequency'),
  T(1, 9, 'doppler-effect', 'Doppler Effect', 'Moving source and observer shift the heard frequency.', 'sound', 'doppler, frequency shift, siren'),

  // Ch 10 — Ideal Gas and Kinetic Theory
  T(1, 10, 'ideal-gas', 'Ideal Gas', 'A box of molecules: PV = NkT from collisions.', 'gas', 'ideal gas, pv=nrt, pressure, molecules'),
  T(1, 10, 'boyles-law', 'Boyle’s Law', 'P ∝ 1/V at constant temperature.', 'gas', 'boyle, isothermal, pressure volume', { module: 'gas-laws', initial: { law: 'boyle' } }),
  T(1, 10, 'charles-law', 'Charles’ Law', 'V ∝ T at constant pressure.', 'gas', 'charles, volume temperature, isobaric', { module: 'gas-laws', initial: { law: 'charles' } }),
  T(1, 10, 'pressure-law', 'Pressure Law', 'P ∝ T at constant volume.', 'gas', 'gay-lussac, pressure temperature, isochoric', { module: 'gas-laws', initial: { law: 'pressure' } }),
  T(1, 10, 'kinetic-theory', 'Speed Distribution (Maxwell)', 'Histogram of molecular speeds against the Maxwell curve.', 'gas', 'maxwell, distribution, kinetic theory'),
  T(1, 10, 'rms-speed', 'RMS Speed', 'c_rms = √(3RT/M) for different gases.', 'gas', 'rms speed, root mean square', { module: 'kinetic-theory', initial: { focus: 'rms' } }),
  T(1, 10, 'mean-kinetic-energy', 'Mean Kinetic Energy', 'Average KE per molecule = (3/2)kT — independent of mass.', 'gas', 'mean kinetic energy, temperature', { module: 'kinetic-theory', initial: { focus: 'ke' } }),
  T(1, 10, 'degrees-of-freedom', 'Degrees of Freedom', 'Monatomic vs diatomic molecules, equipartition and γ.', 'gas', 'degrees of freedom, equipartition, cp cv, gamma'),
  T(1, 10, 'gas-processes', 'Gas Processes (P–V)', 'Isothermal, isobaric, isochoric and adiabatic changes.', 'gas', 'isothermal, adiabatic, isobaric, isochoric, pv diagram'),

  /* ═════════ Physics 2nd Paper ═════════ */
  // Ch 1 — Thermodynamics
  T(2, 1, 'heat-transfer', 'Heat Transfer', 'Conduction, convection and radiation side by side.', 'heat', 'conduction, convection, radiation, thermal conductivity'),
  T(2, 1, 'thermal-expansion', 'Thermal Expansion', 'Rods, plates and cubes grow with temperature.', 'heat', 'linear expansion, alpha, beta, gamma'),
  T(2, 1, 'first-law', 'First Law of Thermodynamics', 'Q = ΔU + W in a piston–cylinder.', 'engine', 'first law, internal energy, work, heat, piston'),
  T(2, 1, 'thermo-processes', 'Thermodynamic Processes', 'Four processes on a P–V diagram with Q, W and ΔU.', 'engine', 'isothermal, adiabatic, isobaric, isochoric', { module: 'gas-processes' }),
  T(2, 1, 'carnot-engine', 'Carnot Engine', 'An ideal engine cycling between two reservoirs.', 'engine', 'carnot, heat engine, efficiency, cycle'),
  T(2, 1, 'engine-efficiency', 'Heat Engine Efficiency', 'η = W/Q₁ = 1 − Q₂/Q₁ and the Carnot limit.', 'engine', 'efficiency, heat engine', { module: 'carnot-engine', initial: { engine: 'real' } }),
  T(2, 1, 'refrigerator', 'Refrigerator', 'A reversed engine: coefficient of performance.', 'engine', 'refrigerator, cop, heat pump'),

  // Ch 2 — Static Electricity
  T(2, 2, 'coulombs-law', 'Coulomb’s Law', 'F = kq₁q₂/r² between two point charges.', 'charge', 'coulomb, point charge, electric force'),
  T(2, 2, 'point-charges', 'Point Charges (Superposition)', 'Three charges: net force on each from vector superposition.', 'charge', 'superposition, net force, charges', { module: 'coulombs-law', initial: { count: 3 } }),
  T(2, 2, 'electric-field', 'Electric Field Lines', 'Field lines and field vectors of charge arrangements.', 'field', 'electric field, field lines, intensity'),
  T(2, 2, 'electric-potential', 'Electric Potential & Equipotentials', 'Potential surface and equipotential contours.', 'field', 'potential, equipotential, voltage', { module: 'electric-field', initial: { view: 'potential' } }),
  T(2, 2, 'electric-dipole', 'Electric Dipole', 'Field pattern of equal and opposite charges.', 'field', 'dipole, dipole moment', { module: 'electric-field', initial: { config: 'dipole' } }),
  T(2, 2, 'capacitor', 'Parallel-Plate Capacitor', 'C = κε₀A/d, charge, energy and field between plates.', 'capacitor', 'capacitance, dielectric, plates, energy'),
  T(2, 2, 'capacitor-combinations', 'Capacitor Combinations', 'Series and parallel capacitors: charge and voltage sharing.', 'capacitor', 'series capacitor, parallel capacitor, equivalent'),

  // Ch 3 — Current Electricity
  T(2, 3, 'ohms-law', 'Ohm’s Law', 'V = IR in a live circuit with meters.', 'circuit', 'ohm, resistance, current, voltage', { module: 'dc-circuit', initial: { topology: 'single' } }),
  T(2, 3, 'series-circuit', 'Series Circuit', 'Same current, shared voltage.', 'circuit', 'series resistors, voltage divider', { module: 'dc-circuit', initial: { topology: 'series' } }),
  T(2, 3, 'parallel-circuit', 'Parallel Circuit', 'Same voltage, shared current.', 'circuit', 'parallel resistors, current divider', { module: 'dc-circuit', initial: { topology: 'parallel' } }),
  T(2, 3, 'resistor-network', 'Resistor Network', 'A mixed series–parallel network solved node by node.', 'circuit', 'equivalent resistance, mixed network', { module: 'dc-circuit', initial: { topology: 'mixed' } }),
  T(2, 3, 'kirchhoff', 'Kirchhoff’s Laws', 'Two batteries, three branches: junction and loop rules.', 'circuit', 'kirchhoff, junction rule, loop rule, kcl, kvl'),
  T(2, 3, 'electrical-power', 'Electrical Power & Energy', 'P = VI = I²R, and energy used over time (kWh).', 'circuit', 'power, energy, kwh, joule heating', { module: 'dc-circuit', initial: { topology: 'single', power: true } }),
  T(2, 3, 'internal-resistance', 'Internal Resistance', 'Terminal voltage drops as current increases.', 'circuit', 'emf, terminal voltage, internal resistance'),
  T(2, 3, 'wheatstone-bridge', 'Wheatstone Bridge', 'Balance the bridge to find an unknown resistance.', 'circuit', 'wheatstone, bridge, galvanometer, balance'),
  T(2, 3, 'meter-bridge', 'Meter Bridge', 'Slide the jockey along a 1 m wire to find the null point.', 'circuit', 'meter bridge, slide wire, jockey'),
  T(2, 3, 'potentiometer', 'Potentiometer', 'Compare EMFs by finding balancing lengths.', 'circuit', 'potentiometer, emf comparison, balancing length'),

  // Ch 4 — Magnetic Effects of Current and Magnetism
  T(2, 4, 'magnetic-field-wire', 'Magnetic Field Around a Wire', 'Circular field lines, B = μ₀I/2πr and the right-hand rule.', 'magnet', 'magnetic field, straight wire, right hand rule, biot savart'),
  T(2, 4, 'solenoid', 'Solenoid', 'B = μ₀nI inside a long coil.', 'coil', 'solenoid, coil, turns, electromagnet'),
  T(2, 4, 'force-on-wire', 'Force on a Current-Carrying Wire', 'F = BIL sin θ and Fleming’s left-hand rule.', 'magnet', 'lorentz force, fleming left hand, motor'),
  T(2, 4, 'charged-particle-magnetic', 'Charged Particle in a Magnetic Field', 'Circular and helical paths: r = mv/qB.', 'magnet', 'lorentz force, helix, radius, cyclotron frequency'),
  T(2, 4, 'cyclotron', 'Cyclotron', 'Dees, alternating voltage and a spiralling ion.', 'magnet', 'cyclotron, particle accelerator, dees'),
  T(2, 4, 'magnetic-dipole', 'Bar Magnet (Magnetic Dipole)', 'Field lines of a bar magnet and a current loop.', 'magnet', 'bar magnet, dipole, field lines, magnetic moment'),
  T(2, 4, 'earths-magnetic-field', 'Earth’s Magnetic Field', 'Dip, declination and horizontal component (schematic).', 'planet', 'earth magnetism, dip, declination, compass'),

  // Ch 5 — Electromagnetic Induction and AC
  T(2, 5, 'faraday-law', 'Faraday’s Law', 'Move a magnet through a coil: ε = −N dΦ/dt.', 'coil', 'faraday, induced emf, flux'),
  T(2, 5, 'lenz-law', 'Lenz’s Law', 'The induced current opposes the change that causes it.', 'coil', 'lenz, induced current direction', { module: 'faraday-law', initial: { lenz: true } }),
  T(2, 5, 'ac-generator', 'AC Generator', 'Rotate a coil in a field and generate a sine wave.', 'ac', 'generator, dynamo, alternating emf'),
  T(2, 5, 'transformer', 'Transformer', 'Vs/Vp = Ns/Np — step-up and step-down.', 'coil', 'transformer, turns ratio, step up, step down'),
  T(2, 5, 'ac-waveform', 'AC Waveform', 'Peak, frequency, phase — and phasors.', 'ac', 'alternating current, sine wave, phase, phasor'),
  T(2, 5, 'rms-voltage', 'RMS Value', 'Why 220 V mains peaks at 311 V: V_rms = V₀/√2.', 'ac', 'rms, root mean square, peak voltage', { module: 'ac-waveform', initial: { rms: true } }),

  // Ch 6 — Geometrical Optics
  T(2, 6, 'reflection', 'Reflection (Plane Mirror)', 'Angle of incidence equals angle of reflection; virtual image.', 'mirror', 'reflection, plane mirror, image'),
  T(2, 6, 'spherical-mirror', 'Spherical Mirrors', 'Concave and convex mirrors: 1/u + 1/v = 1/f.', 'mirror', 'concave mirror, convex mirror, focal length'),
  T(2, 6, 'refraction', 'Refraction (Snell’s Law)', 'n₁ sin i = n₂ sin r across two media.', 'ray', 'refraction, snell, refractive index'),
  T(2, 6, 'total-internal-reflection', 'Total Internal Reflection', 'Beyond the critical angle all light is reflected.', 'ray', 'critical angle, optical fibre, tir', { module: 'refraction', initial: { n1: 1.5, n2: 1.0, i: 45 } }),
  T(2, 6, 'prism', 'Prism & Dispersion', 'Deviation, minimum deviation and a spectrum of colours.', 'prism', 'prism, dispersion, deviation, minimum deviation'),
  T(2, 6, 'convex-lens', 'Convex Lens', 'Image position, size and nature with ray diagrams.', 'lens', 'convex lens, image, magnification, ray diagram', { module: 'lens' }),
  T(2, 6, 'concave-lens', 'Concave Lens', 'Always a virtual, erect, diminished image.', 'lens', 'concave lens, diverging', { module: 'lens', initial: { type: 'concave' } }),
  T(2, 6, 'lens-combination', 'Lens Combination', 'Two lenses: equivalent focal length and power.', 'lens', 'lens combination, power, dioptre'),
  T(2, 6, 'microscope', 'Compound Microscope', 'Objective and eyepiece magnification.', 'lens', 'microscope, magnifying power, objective, eyepiece', { module: 'optical-instrument', initial: { instrument: 'microscope' } }),
  T(2, 6, 'telescope', 'Astronomical Telescope', 'M = f₀/fₑ in normal adjustment.', 'lens', 'telescope, magnifying power', { module: 'optical-instrument', initial: { instrument: 'telescope' } }),

  // Ch 7 — Physical Optics
  T(2, 7, 'double-slit', 'Young’s Double Slit', 'Interference fringes with β = λD/d.', 'interference', 'young, double slit, fringe width, interference'),
  T(2, 7, 'single-slit', 'Single-Slit Diffraction', 'Central maximum width 2λD/a.', 'interference', 'diffraction, single slit, central maximum'),
  T(2, 7, 'interference', 'Interference of Two Sources', 'Ripple-tank pattern from two coherent sources.', 'interference', 'coherent sources, path difference, ripple tank'),
  T(2, 7, 'polarization', 'Polarization', 'Polariser and analyser; unpolarised vs polarised light.', 'polarize', 'polarization, polaroid, brewster'),
  T(2, 7, 'malus-law', 'Malus’ Law', 'I = I₀ cos²θ through a rotating analyser.', 'polarize', 'malus, intensity, analyser', { module: 'polarization', initial: { theta: 60 } }),

  // Ch 8 — Introduction to Modern Physics
  T(2, 8, 'special-relativity', 'Special Relativity', 'Time dilation and length contraction on a fast spaceship.', 'relativity', 'relativity, time dilation, length contraction, lorentz factor'),
  T(2, 8, 'mass-energy', 'Mass–Energy Equivalence', 'E = mc² and relativistic energy.', 'relativity', 'e=mc2, mass energy, rest energy'),
  T(2, 8, 'photoelectric-effect', 'Photoelectric Effect', 'Frequency, intensity, work function and stopping potential.', 'photon', 'photoelectric, work function, threshold frequency, stopping potential'),
  T(2, 8, 'x-ray', 'X-Ray Production', 'Tube voltage sets the cut-off wavelength λ_min = hc/eV.', 'photon', 'x-ray, bremsstrahlung, cut-off wavelength'),
  T(2, 8, 'de-broglie', 'de Broglie Wavelength', 'λ = h/p — matter waves of electrons, protons and balls.', 'photon', 'de broglie, matter wave, wave particle duality'),
  T(2, 8, 'compton-effect', 'Compton Effect', 'Photon–electron scattering: Δλ = (h/mc)(1 − cos θ).', 'photon', 'compton, scattering, photon momentum'),
  T(2, 8, 'uncertainty', 'Heisenberg Uncertainty', 'Squeezing position spreads momentum: ΔxΔp ≥ ħ/2.', 'photon', 'uncertainty principle, heisenberg, wave packet'),

  // Ch 9 — Atomic Model and Nuclear Physics
  T(2, 9, 'rutherford-scattering', 'Rutherford Scattering', 'Alpha particles deflected by a nucleus.', 'atom', 'rutherford, alpha scattering, nucleus, gold foil'),
  T(2, 9, 'bohr-model', 'Bohr Model', 'Quantised orbits, energy levels and radii.', 'atom', 'bohr, energy level, orbit, hydrogen'),
  T(2, 9, 'hydrogen-spectrum', 'Hydrogen Spectrum', 'Lyman, Balmer and Paschen series from transitions.', 'spectrum', 'spectrum, balmer, lyman, transition', { module: 'bohr-model', initial: { focus: 'spectrum' } }),
  T(2, 9, 'radioactive-decay', 'Radioactive Decay', 'Random decay, half-life and the exponential curve.', 'nuclear', 'half life, decay constant, activity, radioactivity'),
  T(2, 9, 'radiation-penetration', 'Alpha, Beta & Gamma', 'Compare penetration through paper, aluminium and lead.', 'nuclear', 'alpha, beta, gamma, penetration, ionisation'),
  T(2, 9, 'nuclear-fission', 'Nuclear Fission', 'A neutron splits U-235 and starts a chain reaction.', 'nuclear', 'fission, chain reaction, uranium'),
  T(2, 9, 'nuclear-fusion', 'Nuclear Fusion', 'Light nuclei fuse and release energy (conceptual).', 'nuclear', 'fusion, sun, deuterium, tritium'),
  T(2, 9, 'binding-energy', 'Binding Energy', 'Mass defect and the binding-energy-per-nucleon curve.', 'nuclear', 'binding energy, mass defect, nucleon'),

  // Ch 10 — Semiconductor and Electronics
  T(2, 10, 'semiconductor-doping', 'Intrinsic, n-type & p-type', 'Doping silicon with donors and acceptors.', 'semiconductor', 'semiconductor, doping, n type, p type, holes'),
  T(2, 10, 'pn-junction', 'PN Junction', 'Depletion region, barrier potential and bias.', 'semiconductor', 'pn junction, depletion layer, barrier, bias'),
  T(2, 10, 'diode-iv', 'Diode I–V Characteristic', 'Forward and reverse bias curves.', 'diode', 'diode, iv curve, forward bias, reverse bias'),
  T(2, 10, 'rectifier', 'Rectifier', 'Half-wave and full-wave rectification of AC.', 'diode', 'rectifier, half wave, full wave, bridge'),
  T(2, 10, 'zener-diode', 'Zener Diode Regulator', 'Holding output voltage constant.', 'diode', 'zener, voltage regulator, breakdown'),
  T(2, 10, 'led', 'Light-Emitting Diode', 'Recombination energy sets the colour.', 'diode', 'led, recombination, band gap, photon'),
  T(2, 10, 'transistor', 'Transistor (NPN / PNP)', 'I_E = I_B + I_C and current gain β.', 'semiconductor', 'transistor, npn, pnp, current gain, amplifier'),
  T(2, 10, 'logic-gates', 'Logic Gates', 'AND, OR, NOT, NAND, NOR, XOR with truth tables.', 'logic', 'logic gate, boolean, truth table, digital'),

  // Ch 11 — Astronomy
  T(2, 11, 'solar-system', 'Solar System', 'The planets orbiting the Sun with real periods.', 'planet', 'solar system, planets, sun, orbit'),
  T(2, 11, 'planetary-orbits', 'Planetary Orbits', 'Kepler’s laws applied to real planets.', 'orbit', 'orbits, kepler, planets, ellipse', { module: 'keplers-laws', initial: { e: 0.6 } }),
  T(2, 11, 'hr-diagram', 'Stellar Classification (H–R Diagram)', 'Temperature, luminosity and the main sequence.', 'star', 'hr diagram, hertzsprung russell, spectral class, main sequence'),
  T(2, 11, 'astro-escape-velocity', 'Escape Velocity & Black Holes', 'Escape speeds of real bodies — and the Schwarzschild radius.', 'planet', 'escape velocity, black hole, schwarzschild', { module: 'escape-velocity', initial: { body: 'jupiter' } }),
  T(2, 11, 'orbital-mechanics', 'Orbital Mechanics', 'Change launch speed to get circles, ellipses and escapes.', 'orbit', 'orbit, ellipse, hyperbola, energy', { module: 'satellite-orbit', initial: { vfac: 1.2 } }),
  T(2, 11, 'blackbody', 'Blackbody Radiation', 'Planck spectrum, Wien’s law and star colours.', 'spectrum', 'blackbody, planck, wien, stefan boltzmann'),
];

export const topicById = (id: string) => TOPICS.find((t) => t.id === id);
export const topicsOf = (paper: number, chapter: number) => TOPICS.filter((t) => t.paper === paper && t.chapter === chapter);
export const moduleOf = (t: Topic) => t.module ?? t.id;
export const topicPath = (t: Topic) => `/physics/${t.paper}/chapter/${t.chapter}/${t.id}`;
