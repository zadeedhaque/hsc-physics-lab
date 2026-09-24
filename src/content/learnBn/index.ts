import type { LearnBnMap } from './types';

/** All Bangla Learn content, keyed by simulation module id. Loaded on demand (see loadLearnBn). */
const files = import.meta.glob<{ default: LearnBnMap }>('./ch-*.ts', { eager: true });
export const LEARN_BN: LearnBnMap = Object.assign({}, ...Object.values(files).map((m) => m.default));
