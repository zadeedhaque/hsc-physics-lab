import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { SimController, type ControllerState } from '../../sims/controller';
import type { Equation, Readout, SimAction, SimDefinition } from '../../sims/types';
import type { Topic } from '../../content/catalog';
import { actions as store, useApp } from '../../state/store';
import { t } from '../../content/strings';
import { fmt } from '../../lib/num';
import { ParamControls } from './ParamControls';
import { Graph } from './Graph';
import { EquationList, LearnPanel, ResultsGrid, Section, formatReadout } from './Panels';
import { ExperimentPanel } from './ExperimentPanel';
import { IconBook, IconCamera, IconFunction, IconGauge, IconPause, IconPlay, IconRecord, IconReset, IconRestart, IconSliders, IconStep } from '../icons';

interface Live { readouts: Readout[]; equations: Equation[]; time: number | null; actions: SimAction[] }
const EMPTY: Live = { readouts: [], equations: [], time: null, actions: [] };
const SPEEDS = [0.1, 0.25, 0.5, 1, 2];
const noopSubscribe = () => () => {};
const noState = (): ControllerState | null => null;

export function SimWorkspace({ topic, def }: { topic: Topic; def: SimDefinition }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ctrl, setCtrl] = useState<SimController | null>(null);
  const [live, setLive] = useState<Live>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const experiment = useApp((s) => s.experiment);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let c: SimController | null = null;
    try {
      c = new SimController(def, hostRef.current!, topic.initial ?? {});
      setCtrl(c);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : String(e));
    }
    return () => { c?.dispose(); setCtrl(null); };
  }, [def, topic]);

  const state = useSyncExternalStore(ctrl?.subscribe ?? noopSubscribe, ctrl?.getState ?? noState);

  // Poll live values ~12×/s — cheap, and keeps React out of the 60 fps loop.
  useEffect(() => {
    if (!ctrl) return;
    let prev = '';
    const read = () => {
      const rt = ctrl.runtime;
      const next: Live = { readouts: rt.readouts(), equations: rt.equations(), time: rt.time?.() ?? null, actions: rt.actions?.() ?? [] };
      const key = JSON.stringify([next.readouts, next.equations, next.time, next.actions.map((a) => a.label)]);
      if (key !== prev) { prev = key; setLive(next); }
    };
    read();
    const id = setInterval(read, 80);
    return () => clearInterval(id);
  }, [ctrl]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!ctrl || def.timeless) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === ' ' && !(el instanceof HTMLButtonElement)) { e.preventDefault(); ctrl.toggle(); }
      else if (e.key === 'r' || e.key === 'R') ctrl.reset();
      else if (e.key === 'ArrowRight' && !(el instanceof HTMLInputElement)) ctrl.stepOnce();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ctrl, def.timeless]);

  const record = useCallback(() => {
    if (!ctrl) return;
    const p = ctrl.getState().params;
    const values: Record<string, number | string> = {};
    for (const spec of def.params) {
      if (spec.showIf && !spec.showIf(p)) continue;
      const v = p[spec.key];
      if (spec.kind === 'slider') values[`${spec.label}${spec.unit ? ` (${spec.unit})` : ''}`] = Number((v as number).toPrecision(5));
      else if (spec.kind === 'toggle') values[spec.label] = v ? 'on' : 'off';
      else if (spec.kind === 'select') values[spec.label] = spec.options.find((o) => o.value === v)?.label ?? String(v);
      else values[spec.label] = String(v);
    }
    for (const r of ctrl.runtime.readouts()) values[`${r.label}${r.unit ? ` (${r.unit})` : ''}`] = formatReadout(r);
    store.addTrial(topic.id, values);
    setFlash(true);
    setTimeout(() => setFlash(false), 400);
  }, [ctrl, def.params, topic.id]);

  const graphs = ctrl ? [...ctrl.graphs.buffers.values()] : [];

  return (
    <div className="flex flex-col xl:h-full xl:flex-row">
      <div className="min-w-0 flex-1 space-y-4 p-3 md:p-4 xl:overflow-y-auto">
        {/* Viewport */}
        <div className="viewport-bg relative h-[52vh] min-h-[320px] overflow-hidden rounded-2xl border border-line xl:h-[calc(100vh-25rem)] xl:min-h-[400px]">
          <div ref={hostRef} className="absolute inset-0" />
          {error && (
            <div role="alert" className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-bad">
              Could not start the 3D view ({error}). Your browser may not support WebGL.
            </div>
          )}
          <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap items-center gap-2">
            {live.time !== null && (
              <span className="rounded-md border border-line bg-panel/80 px-2 py-1 font-mono text-xs text-fg backdrop-blur" aria-label={`Simulated time ${live.time.toFixed(2)} seconds`}>
                t = {fmt(live.time, 3)} s
              </span>
            )}
            {state && !def.timeless && !state.playing && (
              <span className="rounded-md border border-line bg-panel/80 px-2 py-1 text-xs text-fg-2 backdrop-blur">Paused</span>
            )}
            {state && state.speed !== 1 && !def.timeless && (
              <span className="rounded-md border border-warn/40 bg-panel/80 px-2 py-1 font-mono text-xs text-warn backdrop-blur">{state.speed}×</span>
            )}
          </div>
          <button type="button" onClick={() => ctrl?.engine.resetView()} title={t('resetView')} aria-label={t('resetView')} className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg border border-line bg-panel/80 text-fg-2 backdrop-blur hover:text-fg">
            <IconCamera size={15} />
          </button>
          {def.hint && <p className="pointer-events-none absolute bottom-16 left-3 right-3 text-center text-[11px] text-fg-3 sm:bottom-[4.25rem]">{def.hint}</p>}

          {/* Playback bar */}
          {state && !def.timeless && (
            <div className="absolute bottom-3 left-1/2 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-xl border border-line bg-panel/90 p-1 shadow-panel backdrop-blur">
              <BarButton label={state.playing ? t('pause') : t('play')} onClick={() => ctrl?.toggle()} primary>
                {state.playing ? <IconPause size={15} /> : <IconPlay size={15} />}
              </BarButton>
              <BarButton label={t('step')} onClick={() => ctrl?.stepOnce()}><IconStep size={15} /></BarButton>
              <BarButton label={t('reset')} onClick={() => ctrl?.reset()}><IconReset size={15} /></BarButton>
              <BarButton label={t('restart')} onClick={() => ctrl?.restart()}><IconRestart size={15} /></BarButton>
              <span className="mx-1 h-5 w-px bg-line-2" aria-hidden="true" />
              <div role="radiogroup" aria-label={t('speed')} className="flex items-center">
                {SPEEDS.map((s) => (
                  <button key={s} type="button" role="radio" aria-checked={state.speed === s} onClick={() => ctrl?.setSpeed(s)}
                    title={s < 1 ? 'Slow motion' : undefined}
                    className={`rounded-md px-1.5 py-1 font-mono text-[11px] ${state.speed === s ? 'bg-accent-soft text-accent' : 'text-fg-3 hover:text-fg'}`}>
                    {s}×
                  </button>
                ))}
              </div>
              {experiment && (
                <>
                  <span className="mx-1 h-5 w-px bg-line-2" aria-hidden="true" />
                  <BarButton label={t('record')} onClick={record}><IconRecord size={15} className={flash ? 'text-bad' : ''} /></BarButton>
                </>
              )}
            </div>
          )}
          {state && def.timeless && experiment && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-xl border border-line bg-panel/90 p-1 backdrop-blur">
              <BarButton label={t('record')} onClick={record}><IconRecord size={15} className={flash ? 'text-bad' : ''} /></BarButton>
            </div>
          )}
        </div>

        {graphs.length > 0 && (
          <div className={`grid gap-3 ${graphs.length > 1 ? 'lg:grid-cols-2' : ''}`}>
            {graphs.map((b) => <Graph key={b.spec.id} buffer={b} />)}
          </div>
        )}

        {experiment && <ExperimentPanel simId={topic.id} title={topic.title} onRecord={record} />}
        {!def.timeless && <p className="hidden text-center text-[11px] text-fg-3 md:block">{t('keyboardHint')}</p>}
      </div>

      {/* Right panel */}
      <aside className="border-t border-line bg-panel xl:w-[370px] xl:shrink-0 xl:overflow-y-auto xl:border-l xl:border-t-0" aria-label="Simulation controls">
        {state && (
          <>
            <Section title={t('parameters')} icon={<IconSliders size={14} />} highlight>
              {def.presets && def.presets.length > 0 && (
                <div className="mb-4">
                  <p className="mb-1.5 text-[11px] font-medium text-fg-3">{t('presets')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {def.presets.map((p) => {
                      const active = Object.entries(p.values).every(([k, v]) => state.params[k] === v);
                      return (
                        <button key={p.label} type="button" onClick={() => ctrl?.applyValues(p.values)} aria-pressed={active}
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${active ? 'border-accent/50 bg-accent-soft text-accent' : 'border-line text-fg-2 hover:border-line-2 hover:text-fg'}`}>
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <ParamControls specs={def.params} params={state.params} onChange={(k, v) => ctrl?.setParam(k, v)} />
            </Section>

            {live.actions.length > 0 && (
              <Section title={t('simulation')} icon={<IconPlay size={12} />}>
                <div className="flex flex-wrap gap-2">
                  {live.actions.map((a) => (
                    <button key={a.id} type="button" onClick={() => { a.run(); if (!def.timeless) ctrl?.play(); }}
                      className={`rounded-lg px-3.5 py-2 text-sm font-semibold ${a.primary ? 'bg-accent text-accent-fg hover:bg-accent-2' : 'border border-line text-fg hover:bg-panel-2'}`}>
                      {a.label}
                    </button>
                  ))}
                </div>
              </Section>
            )}

            <Section title={t('results')} icon={<IconGauge size={13} />}>
              <ResultsGrid readouts={live.readouts} />
            </Section>
            <Section title={t('equations')} icon={<IconFunction size={13} />}>
              <EquationList equations={live.equations} />
            </Section>
            <Section title={t('learn')} icon={<IconBook size={13} />} defaultOpen>
              <LearnPanel learn={def.learn} />
            </Section>
          </>
        )}
      </aside>
    </div>
  );
}

function BarButton({ label, onClick, children, primary }: { label: string; onClick: () => void; children: React.ReactNode; primary?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition ${primary ? 'bg-accent text-accent-fg hover:bg-accent-2' : 'text-fg-2 hover:bg-panel-3 hover:text-fg'}`}>
      {children}
    </button>
  );
}
