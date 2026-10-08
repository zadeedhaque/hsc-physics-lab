import { useEffect, useState, type ReactNode } from 'react';
import type { Equation, Learn, Readout } from '../../sims/types';
import { fmt } from '../../lib/num';
import { plainNotation } from '../../lib/notation';
import { t } from '../../content/strings';
import { IconChevronDown } from '../icons';
import { MathText, Notation } from './MathText';
import { actions, useApp } from '../../state/store';
import { cachedLearnBn, loadLearnBn } from '../../content/learnBn/load';
import type { LearnBn } from '../../content/learnBn/types';

export function Section({ title, icon, children, defaultOpen = true, right, highlight = false }: { title: string; icon?: ReactNode; children: ReactNode; defaultOpen?: boolean; right?: ReactNode; highlight?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={highlight ? 'param-card m-3 rounded-2xl px-4 pb-4 pt-3.5' : 'border-b border-line px-4 py-3.5 last:border-b-0'}>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
          className="group flex flex-1 items-center gap-2 text-left text-[14px] font-bold tracking-[-0.005em] text-fg">
          <span className={`grid h-6 w-6 place-items-center rounded-md ${highlight ? 'bg-accent text-accent-fg' : 'bg-panel-3 text-fg-2 group-hover:text-fg'}`}>{icon}</span>
          {title}
          <IconChevronDown size={15} className={`ml-auto text-fg-3 transition-transform group-hover:text-fg ${open ? '' : '-rotate-90'}`} />
        </button>
        {right}
      </div>
      {open && <div className="mt-3.5">{children}</div>}
    </section>
  );
}

export function formatReadout(r: Readout) {
  return typeof r.value === 'number' ? fmt(r.value, r.digits ?? 3) : r.value;
}

const toneClass: Record<string, string> = { accent: 'text-accent', good: 'text-good', warn: 'text-warn', bad: 'text-bad', default: 'text-fg' };

export function ResultsGrid({ readouts }: { readouts: Readout[] }) {
  return (
    <dl className="grid grid-cols-2 gap-2" aria-live="off">
      {readouts.map((r) => (
        <div key={r.label} className="rounded-lg border border-line bg-panel-2 px-3 py-2">
          <dt className="truncate text-[11.5px] font-medium text-fg-3" title={plainNotation(r.label)}><Notation text={r.label} /></dt>
          <dd className={`mt-1 flex items-baseline gap-1 font-mono text-[15px] font-medium leading-tight ${toneClass[r.tone ?? 'default']}`}>
            <span className="break-all"><Notation text={formatReadout(r)} /></span>
            {r.unit && <span className="shrink-0 text-[11px] font-normal text-fg-3"><Notation text={r.unit} /></span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function EquationList({ equations }: { equations: Equation[] }) {
  return (
    <ul className="space-y-2">
      {equations.map((eq, i) => (
        <li key={i} className="rounded-lg border border-line bg-panel-2 px-3 py-2">
          <p className="math font-mono text-[14px] text-fg"><MathText text={eq.expr} /></p>
          {eq.sub && <p className="math mt-0.5 break-words border-t border-dashed border-line pt-0.5 font-mono text-[12.5px] text-accent"><MathText text={eq.sub} /></p>}
          {eq.note && <p className="mt-0.5 text-[11.5px] text-fg-3"><Notation text={eq.note} /></p>}
        </li>
      ))}
    </ul>
  );
}

const LEARN_LABELS = {
  en: { concept: t('concept'), variables: t('variables'), observe: t('observe'), challenge: t('challenge') },
  bn: { concept: 'ধারণা', variables: 'রাশিসমূহ', observe: 'যা লক্ষ করবে', challenge: 'পরীক্ষণের চ্যালেঞ্জ' },
};

interface LearnView { concept: string; variables: [string, string][]; observe: string[]; challenge: string }

function LearnBody({ view, lang }: { view: LearnView; lang: 'en' | 'bn' }) {
  const L = LEARN_LABELS[lang];
  return (
    <div className="space-y-5 text-[14px]" lang={lang}>
      <div>
        <h4 className="mb-1.5 text-[12.5px] font-bold text-fg">{L.concept}</h4>
        <p className="leading-relaxed text-fg-2"><Notation text={view.concept} /></p>
      </div>
      {view.variables.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-[12.5px] font-bold text-fg">{L.variables}</h4>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 rounded-lg border border-line bg-panel-2 px-3 py-2.5">
            {view.variables.map(([sym, meaning]) => (
              <div key={sym} className="contents">
                <dt className="font-mono text-[13px] font-medium text-accent" lang="en"><Notation text={sym} /></dt>
                <dd className="text-fg-2"><Notation text={meaning} /></dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      <div>
        <h4 className="mb-1.5 text-[12.5px] font-bold text-fg">{L.observe}</h4>
        <ul className="space-y-1.5 text-fg-2">
          {view.observe.map((o) => (
            <li key={o} className="relative pl-4 leading-relaxed before:absolute before:left-0.5 before:top-[0.6em] before:h-1.5 before:w-1.5 before:rounded-full before:bg-accent/60"><Notation text={o} /></li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl border border-accent/25 bg-accent-soft px-3.5 py-3">
        <h4 className="mb-1 text-[12.5px] font-bold text-accent">{L.challenge}</h4>
        <p className="leading-relaxed text-fg"><Notation text={view.challenge} /></p>
      </div>
    </div>
  );
}

/** Learn panel with English | বাংলা tabs. `bnKey` is the simulation module id used to find the Bangla text. */
export function LearnPanel({ learn, bnKey }: { learn: Learn; bnKey: string }) {
  const lang = useApp((s) => s.learnLang);
  const [bn, setBn] = useState<LearnBn | null | undefined>(() => cachedLearnBn()?.[bnKey]);
  useEffect(() => {
    if (lang !== 'bn') return;
    let alive = true;
    loadLearnBn().then((m) => { if (alive) setBn(m[bnKey] ?? null); }).catch(() => { if (alive) setBn(null); });
    return () => { alive = false; };
  }, [lang, bnKey]);

  const english: LearnView = learn;
  const bangla: LearnView | null = bn
    ? { concept: bn.concept, variables: learn.variables.map(([sym], i) => [sym, bn.variables[i] ?? '']), observe: bn.observe, challenge: bn.challenge }
    : null;

  const tab = (value: 'en' | 'bn', label: string) => (
    <button type="button" role="tab" aria-selected={lang === value} onClick={() => actions.setLearnLang(value)} lang={value}
      className={`press rounded-md px-3 py-1 text-xs font-bold transition ${lang === value ? 'bg-panel text-fg shadow-sm' : 'text-fg-3 hover:text-fg'}`}>
      {label}
    </button>
  );

  return (
    <div>
      <div role="tablist" aria-label="Language" className="mb-3 inline-flex gap-1 rounded-lg bg-panel-3 p-1">
        {tab('en', 'English')}
        {tab('bn', 'বাংলা')}
      </div>
      {lang === 'en' && <LearnBody view={english} lang="en" />}
      {lang === 'bn' && bangla && <LearnBody view={bangla} lang="bn" />}
      {lang === 'bn' && bn === undefined && <p className="text-sm text-fg-3" lang="bn">লোড হচ্ছে…</p>}
      {lang === 'bn' && bn === null && (
        <>
          <p className="mb-3 rounded-lg border border-line px-3 py-2 text-xs text-fg-2" lang="bn">এই সিমুলেশনের বাংলা অনুবাদ এখনও নেই — ইংরেজি দেখানো হচ্ছে।</p>
          <LearnBody view={english} lang="en" />
        </>
      )}
    </div>
  );
}
