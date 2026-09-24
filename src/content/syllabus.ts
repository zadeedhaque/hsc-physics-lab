/**
 * Bangladesh HSC Physics (NCTB) syllabus structure.
 * Chapter titles follow the NCTB English-version textbook naming; `bn` holds the Bengali title
 * so the UI can switch language later without touching components.
 */
export type PaperId = 1 | 2;

export interface Chapter {
  paper: PaperId;
  number: number;
  title: string;
  bn: string;
  description: string;
}

export interface Paper {
  id: PaperId;
  title: string;
  bn: string;
  tagline: string;
}

export const PAPERS: Paper[] = [
  { id: 1, title: 'Physics 1st Paper', bn: 'পদার্থবিজ্ঞান ১ম পত্র', tagline: 'Mechanics, gravitation, matter, oscillations, waves and gases.' },
  { id: 2, title: 'Physics 2nd Paper', bn: 'পদার্থবিজ্ঞান ২য় পত্র', tagline: 'Thermodynamics, electricity, magnetism, optics, modern physics and astronomy.' },
];

export const CHAPTERS: Chapter[] = [
  { paper: 1, number: 1, title: 'Physical World and Measurement', bn: 'ভৌতজগৎ ও পরিমাপ', description: 'Instruments, least count, errors, significant figures and dimensions.' },
  { paper: 1, number: 2, title: 'Vector', bn: 'ভেক্টর', description: 'Add, subtract, resolve and multiply vectors in three dimensions.' },
  { paper: 1, number: 3, title: 'Dynamics', bn: 'গতিবিদ্যা', description: 'Describe motion: displacement, velocity, acceleration, projectiles and circular motion.' },
  { paper: 1, number: 4, title: 'Newtonian Mechanics', bn: 'নিউটনিয়ান বলবিদ্যা', description: 'Explore forces, momentum, friction, collisions and Newton’s laws.' },
  { paper: 1, number: 5, title: 'Work, Energy and Power', bn: 'কাজ, শক্তি ও ক্ষমতা', description: 'How forces transfer energy, and how fast they do it.' },
  { paper: 1, number: 6, title: 'Gravitation', bn: 'মহাকর্ষ ও অভিকর্ষ', description: 'Universal gravitation, fields, potential, escape velocity and orbits.' },
  { paper: 1, number: 7, title: 'Structural Properties of Matter', bn: 'পদার্থের গাঠনিক ধর্ম', description: 'Elasticity, surface tension, capillarity and viscosity.' },
  { paper: 1, number: 8, title: 'Periodic Motion', bn: 'পর্যাবৃত্ত গতি', description: 'Simple harmonic motion, springs, pendulums and energy exchange.' },
  { paper: 1, number: 9, title: 'Waves', bn: 'তরঙ্গ', description: 'Transverse and longitudinal waves, superposition, standing waves, sound and Doppler.' },
  { paper: 1, number: 10, title: 'Ideal Gas and Kinetic Theory of Gases', bn: 'আদর্শ গ্যাস ও গ্যাসের গতিতত্ত্ব', description: 'Gas laws from molecular motion: pressure, temperature and speed distributions.' },
  { paper: 2, number: 1, title: 'Thermodynamics', bn: 'তাপগতিবিদ্যা', description: 'Heat, work and internal energy; engines, refrigerators and entropy.' },
  { paper: 2, number: 2, title: 'Static Electricity', bn: 'স্থির তড়িৎ', description: 'Charges, Coulomb’s law, fields, potential and capacitors.' },
  { paper: 2, number: 3, title: 'Current Electricity', bn: 'চল তড়িৎ', description: 'Ohm’s law, networks, Kirchhoff’s laws, power and bridge circuits.' },
  { paper: 2, number: 4, title: 'Magnetic Effects of Current and Magnetism', bn: 'তড়িৎ প্রবাহের চৌম্বক ক্রিয়া ও চুম্বকত্ব', description: 'Fields of currents, forces on moving charges, and magnetism.' },
  { paper: 2, number: 5, title: 'Electromagnetic Induction and AC', bn: 'তাড়িতচৌম্বক আবেশ ও পরিবর্তী প্রবাহ', description: 'Faraday and Lenz, generators, transformers and alternating current.' },
  { paper: 2, number: 6, title: 'Geometrical Optics', bn: 'জ্যামিতিক আলোকবিজ্ঞান', description: 'Reflection, refraction, prisms, lenses and optical instruments.' },
  { paper: 2, number: 7, title: 'Physical Optics', bn: 'ভৌত আলোকবিজ্ঞান', description: 'Light as a wave: interference, diffraction and polarization.' },
  { paper: 2, number: 8, title: 'Introduction to Modern Physics', bn: 'আধুনিক পদার্থবিজ্ঞানের সূচনা', description: 'Relativity, photons, matter waves and the uncertainty principle.' },
  { paper: 2, number: 9, title: 'Atomic Model and Nuclear Physics', bn: 'পরমাণুর মডেল ও নিউক্লীয় পদার্থবিজ্ঞান', description: 'Rutherford and Bohr, spectra, radioactivity, fission and fusion.' },
  { paper: 2, number: 10, title: 'Semiconductor and Electronics', bn: 'সেমিকন্ডাক্টর ও ইলেকট্রনিক্স', description: 'Doping, junctions, diodes, transistors and logic gates.' },
  { paper: 2, number: 11, title: 'Astronomy', bn: 'জ্যোতির্বিজ্ঞান', description: 'The solar system, orbits, stars and blackbody radiation.' },
];

export const chaptersOf = (paper: PaperId) => CHAPTERS.filter((c) => c.paper === paper);
export const getChapter = (paper: number, n: number) => CHAPTERS.find((c) => c.paper === paper && c.number === n);
export const getPaper = (paper: number) => PAPERS.find((p) => p.id === paper);
