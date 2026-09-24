import { useEffect, useId, useState } from 'react';
import type { ParamSpec, Params, ParamValue, SliderParam } from '../../sims/types';

export function ParamControls({ specs, params, onChange }: { specs: ParamSpec[]; params: Params; onChange: (k: string, v: ParamValue) => void }) {
  return (
    <div className="space-y-4">
      {specs.filter((s) => !s.showIf || s.showIf(params)).map((spec) => {
        const v = params[spec.key];
        switch (spec.kind) {
          case 'slider': return <Slider key={spec.key} spec={spec} value={typeof v === 'number' ? v : spec.default} onChange={(x) => onChange(spec.key, x)} />;
          case 'toggle': return <Toggle key={spec.key} label={spec.label} hint={spec.hint} value={v === true} onChange={(x) => onChange(spec.key, x)} />;
          case 'select': return <Select key={spec.key} label={spec.label} hint={spec.hint} value={String(v)} options={spec.options} onChange={(x) => onChange(spec.key, x)} />;
          case 'text': return <TextField key={spec.key} label={spec.label} hint={spec.hint} value={String(v ?? '')} placeholder={spec.placeholder} inputMode={spec.inputMode} onChange={(x) => onChange(spec.key, x)} />;
        }
      })}
    </div>
  );
}

function decimalsFor(spec: SliderParam) {
  if (spec.decimals !== undefined) return spec.decimals;
  const s = String(spec.step);
  return s.includes('.') ? s.split('.')[1].length : 0;
}

function Slider({ spec, value, onChange }: { spec: SliderParam; value: number; onChange: (v: number) => void }) {
  const id = useId();
  const dec = decimalsFor(spec);
  const [draft, setDraft] = useState(value.toFixed(dec));
  useEffect(() => setDraft(value.toFixed(dec)), [value, dec]);
  const fill = ((value - spec.min) / (spec.max - spec.min)) * 100;

  const commit = () => {
    const n = parseFloat(draft);
    if (Number.isFinite(n)) onChange(n);
    else setDraft(value.toFixed(dec));
  };

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[13px] font-medium text-fg-2">{spec.label}</label>
        <span className="flex items-baseline gap-1">
          <input
            aria-label={`${spec.label} value`}
            type="number"
            inputMode="decimal"
            className="w-[4.75rem] rounded-md border border-transparent bg-transparent px-1 py-0.5 text-right font-mono text-[13px] text-fg hover:border-line focus:border-accent/60 focus:bg-panel-2 focus:outline-none"
            value={draft}
            min={spec.min}
            max={spec.max}
            step={spec.step}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') { commit(); (e.target as HTMLInputElement).blur(); } }}
          />
          {spec.unit && <span className="min-w-[1.5rem] font-mono text-xs text-fg-3">{spec.unit}</span>}
        </span>
      </div>
      <input
        id={id}
        type="range"
        className="slider"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={value}
        style={{ ['--fill' as string]: `${fill}%` }}
        aria-valuetext={`${value.toFixed(dec)} ${spec.unit ?? ''}`}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      {spec.hint && <p className="mt-0.5 text-[11px] text-fg-3">{spec.hint}</p>}
    </div>
  );
}

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <label htmlFor={id} className="text-[13px] font-medium text-fg-2">{label}</label>
        {hint && <p className="text-[11px] text-fg-3">{hint}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition ${value ? 'bg-accent' : 'bg-line-2'}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${value ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

function Select({ label, hint, value, options, onChange }: { label: string; hint?: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  const id = useId();
  // Segmented control for ≤ 4 short options, dropdown otherwise.
  const segmented = options.length <= 4 && options.every((o) => o.label.length <= 12);
  return (
    <div>
      <label htmlFor={segmented ? undefined : id} id={`${id}-l`} className="mb-1.5 block text-[13px] font-medium text-fg-2">{label}</label>
      {segmented ? (
        <div role="radiogroup" aria-labelledby={`${id}-l`} className="grid gap-1 rounded-lg bg-panel-3 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={o.value === value}
              onClick={() => onChange(o.value)}
              className={`truncate rounded-md px-2 py-1 text-xs font-medium transition ${o.value === value ? 'bg-panel text-fg shadow-sm' : 'text-fg-3 hover:text-fg'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      ) : (
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 text-sm text-fg focus:border-accent/60 focus:outline-none">
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
      {hint && <p className="mt-1 text-[11px] text-fg-3">{hint}</p>}
    </div>
  );
}

function TextField({ label, hint, value, placeholder, inputMode, onChange }: { label: string; hint?: string; value: string; placeholder?: string; inputMode?: 'decimal' | 'text'; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[13px] font-medium text-fg-2">{label}</label>
      <input
        id={id}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 font-mono text-sm text-fg focus:border-accent/60 focus:outline-none"
      />
      {hint && <p className="mt-1 text-[11px] text-fg-3">{hint}</p>}
    </div>
  );
}
