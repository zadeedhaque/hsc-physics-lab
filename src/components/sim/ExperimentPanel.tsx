import { actions, useApp } from '../../state/store';
import { t } from '../../content/strings';
import { IconDownload, IconFlask, IconRecord, IconTrash } from '../icons';
import { Notation } from './MathText';

function toCsv(columns: string[], rows: { values: Record<string, number | string> }[]) {
  const esc = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [[t('trial'), ...columns].map(esc).join(','), ...rows.map((r, i) => [i + 1, ...columns.map((c) => r.values[c] ?? '')].map(esc).join(','))].join('\n');
}

export function ExperimentPanel({ simId, title, onRecord }: { simId: string; title: string; onRecord: () => void }) {
  const table = useApp((s) => s.trials[simId]);
  const rows = table?.rows ?? [];
  const columns = table?.columns ?? [];

  const exportCsv = () => {
    const blob = new Blob([toCsv(columns, rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${simId}-measurements.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <section className="overflow-hidden rounded-xl border border-accent/35 bg-panel shadow-panel" aria-labelledby="exp-title">
      <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <h2 id="exp-title" className="flex items-center gap-2 text-sm font-bold text-fg"><IconFlask size={15} className="text-accent" /> {t('experiment')} · {title}</h2>
        <span className="rounded-md bg-panel-3 px-1.5 py-0.5 font-mono text-[11px] text-fg-2">{rows.length} trial{rows.length === 1 ? '' : 's'}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={onRecord} className="press flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-accent-fg hover:bg-accent-2">
            <IconRecord size={14} /> {t('record')}
          </button>
          <button type="button" disabled={!rows.length} onClick={exportCsv} className="press flex items-center gap-1.5 rounded-lg border border-line-2 px-3 py-1.5 text-xs font-semibold text-fg-2 hover:bg-panel-2 hover:text-fg disabled:pointer-events-none disabled:opacity-40">
            <IconDownload size={14} /> {t('exportCsv')}
          </button>
          <button type="button" disabled={!rows.length} onClick={() => actions.clearTrials(simId)} className="press flex items-center gap-1.5 rounded-lg border border-line-2 px-3 py-1.5 text-xs font-semibold text-fg-2 hover:bg-panel-2 hover:text-bad disabled:pointer-events-none disabled:opacity-40">
            <IconTrash size={14} /> {t('clearTable')}
          </button>
        </div>
      </header>
      {rows.length === 0 ? (
        <p className="px-4 py-5 text-sm text-fg-3">{t('noTrials')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line bg-panel-2 text-fg-3">
                <th scope="col" className="px-3 py-2 font-semibold">{t('trial')}</th>
                {columns.map((c) => <th key={c} scope="col" className="whitespace-nowrap px-3 py-2 font-semibold"><Notation text={c} /></th>)}
                <th scope="col"><span className="sr-only">Delete</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-line last:border-b-0 hover:bg-panel-2">
                  <td className="px-3 py-1.5 font-mono text-fg-3">{i + 1}</td>
                  {columns.map((c) => <td key={c} className="whitespace-nowrap px-3 py-1.5 font-mono text-fg">{r.values[c] ?? '—'}</td>)}
                  <td className="px-2 text-right">
                    <button type="button" aria-label={`Delete trial ${i + 1}`} onClick={() => actions.deleteTrial(simId, i)} className="rounded p-1 text-fg-3 hover:bg-panel-3 hover:text-bad">
                      <IconTrash size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
