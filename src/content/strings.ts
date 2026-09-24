/**
 * UI chrome strings. Components read text through t() so a Bengali dictionary
 * can be added later (fill `bn`, then switch `lang`).
 */
const en = {
  appName: 'Physics Lab',
  appTagline: 'Explore Physics. Change the Variables. See the Laws.',
  appIntro: 'An interactive 3D laboratory for Bangladesh HSC Physics. Pick a topic, move the sliders, and watch the physics respond — every number on screen is computed from the real equations.',
  searchPlaceholder: 'Search simulations — “projectile”, “Kirchhoff”, “lens”…',
  searchEmpty: 'No simulations match',
  home: 'Home',
  chapters: 'Chapters',
  chapter: 'Chapter',
  simulations: 'simulations',
  ready: 'ready',
  inDevelopment: 'In development',
  openSimulation: 'Open simulation',
  favorites: 'Favorites',
  recents: 'Recently used',
  continueLearning: 'Continue learning',
  popular: 'Popular simulations',
  noFavorites: 'Star a simulation to pin it here.',
  parameters: 'Parameters',
  presets: 'Presets',
  simulation: 'Simulation',
  results: 'Results',
  equations: 'Equations',
  learn: 'Learn',
  concept: 'Concept',
  variables: 'Variables',
  observe: 'What to observe',
  challenge: 'Experiment challenge',
  play: 'Play',
  pause: 'Pause',
  reset: 'Reset',
  restart: 'Restart',
  step: 'Step',
  speed: 'Speed',
  resetView: 'Reset view',
  experiment: 'Experiment',
  experimentMode: 'Experiment mode',
  record: 'Record measurement',
  clearTable: 'Clear table',
  exportCsv: 'Export CSV',
  trial: 'Trial',
  noTrials: 'No measurements yet. Set up the apparatus, then press “Record measurement”.',
  graphs: 'Graphs',
  theme: 'Toggle theme',
  menu: 'Menu',
  controls: 'Controls',
  loading: 'Loading simulation…',
  notReadyTitle: 'This simulation is in development',
  notReadyBody: 'The topic is part of the syllabus map but its interactive model has not been built yet. Try one of the ready simulations in this chapter.',
  notFound: 'Page not found',
  back: 'Back',
  time: 't',
  keyboardHint: 'Space: play/pause · R: reset · →: step',
};

export type StringKey = keyof typeof en;
const dictionaries: Record<'en' | 'bn', Partial<Record<StringKey, string>>> = { en, bn: {} };
let lang: 'en' | 'bn' = 'en';

export const setLang = (l: 'en' | 'bn') => { lang = l; };
export const t = (key: StringKey): string => dictionaries[lang][key] ?? en[key];
