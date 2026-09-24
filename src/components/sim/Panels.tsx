import { useState, type ReactNode } from 'react';
import type { Equation, Learn, Readout } from '../../sims/types';
import { fmt } from '../../lib/num';
import { t } from '../../content/strings';
import { IconChevronDown } from '../icons';

export function Section({ title, icon, children, defaultOpen = true, right }: { title: string; icon?: ReactNode; children: ReactNode; defaultOpen?: boolean; right?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-line px-4 py-3.5 last:border-b-0">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex flex-1 items-center gap-2 text-left text-[11px] font-semibold uppercase tracking-wider text-fg-3 hover:text-fg">
          {icon}{title}
          <IconChevronDown size={13} className={`ml-auto transition-transform ${open ? '' : '-rotate-90'}`} />
        </button>
        {right}
      </div>
      {open && <div className="mt-3">{children}</div>}
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
        <div key={r.label} className="rounded-lg border border-line bg-panel-2 px-2.5 py-2">
          <dt className="truncate text-[11px] text-fg-3" title={r.label}>{r.label}</dt>
          <dd className={`mt-0.5 flex items-baseline gap-1 font-mono text-[15px] font-medium leading-tight ${toneClass[r.tone ?? 'default']}`}>
            <span className="break-all">{formatReadout(r)}</span>
            {r.unit && <span className="shrink-0 text-[11px] font-normal text-fg-3">{r.unit}</span>}
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
          <p className="font-mono text-[14px] text-fg">{eq.expr}</p>
          {eq.sub && <p className="mt-0.5 break-words font-mono text-[12px] text-accent">{eq.sub}</p>}
          {eq.note && <p className="mt-0.5 text-[11px] text-fg-3">{eq.note}</p>}
        </li>
      ))}
    </ul>
  );
}

export function LearnPanel({ learn }: { learn: Learn }) {
  return (
    <div className="space-y-4 text-sm">
      <div>
        <h4 className="mb-1 text-xs font-semibold text-fg">{t('concept')}</h4>
        <p className="leading-relaxed text-fg-2">{learn.concept}</p>
      </div>
      {learn.variables.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-semibold text-fg">{t('variables')}</h4>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            {learn.variables.map(([sym, meaning]) => (
              <div key={sym} className="contents">
                <dt className="font-mono text-accent">{sym}</dt>
                <dd className="text-fg-2">{meaning}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      <div>
        <h4 className="mb-1 text-xs font-semibold text-fg">{t('observe')}</h4>
        <ul className="list-disc space-y-1 pl-4 text-fg-2 marker:text-fg-3">
          {learn.observe.map((o) => <li key={o}>{o}</li>)}
        </ul>
      </div>
      <div className="rounded-lg border border-accent/30 bg-accent-soft px-3 py-2.5">
        <h4 className="mb-1 text-xs font-semibold text-accent">{t('challenge')}</h4>
        <p className="text-fg">{learn.challenge}</p>
      </div>
    </div>
  );
}
