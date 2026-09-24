/**
 * Bangla (বাংলা) version of a simulation's Learn panel. `variables` holds only the meanings,
 * in the same order as the English `learn.variables` — the symbols themselves are shared.
 */
export interface LearnBn {
  concept: string;
  variables: string[];
  observe: string[];
  challenge: string;
}
export type LearnBnMap = Record<string, LearnBn>;
