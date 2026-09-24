import { useSyncExternalStore } from 'react';

/** Tiny persisted store (favorites, recents, theme, experiment mode, recorded trials). */
export interface Trial { values: Record<string, number | string> }
export interface TrialTable { columns: string[]; rows: Trial[] }

interface AppState {
  favorites: string[];
  recents: string[];
  theme: 'dark' | 'light';
  experiment: boolean;
  trials: Record<string, TrialTable>;
}

const KEY = 'physics-lab:v1';

function load(): AppState {
  const prefersLight = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches;
  const base: AppState = { favorites: [], recents: [], theme: prefersLight ? 'light' : 'dark', experiment: false, trials: {} };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites.filter((x) => typeof x === 'string') : [],
      recents: Array.isArray(parsed.recents) ? parsed.recents.filter((x) => typeof x === 'string') : [],
      theme: parsed.theme === 'light' || parsed.theme === 'dark' ? parsed.theme : base.theme,
      experiment: parsed.experiment === true,
      trials: parsed.trials && typeof parsed.trials === 'object' ? parsed.trials : {},
    };
  } catch {
    return base;
  }
}

let state: AppState = load();
const listeners = new Set<() => void>();

function set(patch: Partial<AppState>) {
  state = { ...state, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable: keep in memory */ }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export function useApp<T>(select: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => select(state), () => select(state));
}

export const actions = {
  toggleFavorite(id: string) {
    const f = state.favorites.includes(id) ? state.favorites.filter((x) => x !== id) : [id, ...state.favorites];
    set({ favorites: f });
  },
  visit(id: string) {
    set({ recents: [id, ...state.recents.filter((x) => x !== id)].slice(0, 8) });
  },
  setTheme(theme: 'dark' | 'light') { set({ theme }); },
  toggleTheme() { set({ theme: state.theme === 'dark' ? 'light' : 'dark' }); },
  setExperiment(on: boolean) { set({ experiment: on }); },
  addTrial(simId: string, values: Record<string, number | string>) {
    const prev = state.trials[simId] ?? { columns: [], rows: [] };
    const columns = [...prev.columns];
    for (const k of Object.keys(values)) if (!columns.includes(k)) columns.push(k);
    set({ trials: { ...state.trials, [simId]: { columns, rows: [...prev.rows, { values }] } } });
  },
  deleteTrial(simId: string, index: number) {
    const prev = state.trials[simId];
    if (!prev) return;
    set({ trials: { ...state.trials, [simId]: { ...prev, rows: prev.rows.filter((_, i) => i !== index) } } });
  },
  clearTrials(simId: string) {
    const rest = { ...state.trials };
    delete rest[simId];
    set({ trials: rest });
  },
};

export const getState = () => state;
