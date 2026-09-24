import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { SearchBox } from './SearchBox';
import { Sidebar } from './Sidebar';
import { IconAtom, IconFlask, IconMenu, IconMoon, IconSun, IconX } from './icons';
import { actions, useApp } from '../state/store';
import { t } from '../content/strings';

export function AppShell() {
  const theme = useApp((s) => s.theme);
  const experiment = useApp((s) => s.experiment);
  const [drawer, setDrawer] = useState(false);
  const loc = useLocation();

  useEffect(() => setDrawer(false), [loc.pathname]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer]);

  return (
    <div className="flex h-full flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[100] focus:rounded focus:bg-panel focus:px-3 focus:py-2">Skip to content</a>
      <header className="z-40 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-bg/85 px-3 backdrop-blur md:px-4">
        <button type="button" className="rounded-lg p-2 text-fg-2 hover:bg-panel-2 hover:text-fg lg:hidden" aria-label={t('menu')} onClick={() => setDrawer(true)}>
          <IconMenu size={18} />
        </button>
        <Link to="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight text-fg">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent-soft text-accent"><IconAtom size={17} /></span>
          <span className="brand-text hidden font-display text-[15px] font-bold sm:inline">{t('appName')}</span>
          <span className="hidden rounded-md border border-line px-1.5 py-0.5 font-mono text-[10px] font-medium text-fg-3 md:inline">HSC</span>
        </Link>
        <div className="flex min-w-0 flex-1 justify-center px-1">
          <SearchBox />
        </div>
        <button
          type="button"
          onClick={() => actions.setExperiment(!experiment)}
          aria-pressed={experiment}
          title={t('experimentMode')}
          className={`flex h-9 items-center gap-2 rounded-lg border px-2.5 text-sm font-medium transition ${experiment ? 'border-accent/50 bg-accent-soft text-accent' : 'border-line text-fg-2 hover:bg-panel-2 hover:text-fg'}`}
        >
          <IconFlask size={16} />
          <span className="hidden md:inline">{t('experiment')}</span>
        </button>
        <button type="button" onClick={actions.toggleTheme} aria-label={t('theme')} title={t('theme')} className="grid h-9 w-9 place-items-center rounded-lg border border-line text-fg-2 hover:bg-panel-2 hover:text-fg">
          {theme === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />}
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-72 shrink-0 overflow-y-auto border-r border-line bg-bg lg:block" aria-label="Syllabus">
          <Sidebar />
        </aside>

        {drawer && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Syllabus">
            <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDrawer(false)} />
            <div className="fade-in absolute inset-y-0 left-0 flex w-[86%] max-w-80 flex-col border-r border-line bg-bg shadow-panel">
              <div className="flex h-14 items-center justify-between border-b border-line px-4">
                <span className="font-semibold">{t('chapters')}</span>
                <button type="button" className="rounded-lg p-2 text-fg-2 hover:bg-panel-2" aria-label="Close menu" onClick={() => setDrawer(false)}><IconX size={18} /></button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto"><Sidebar /></div>
            </div>
          </div>
        )}

        <main id="main" className="min-w-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
