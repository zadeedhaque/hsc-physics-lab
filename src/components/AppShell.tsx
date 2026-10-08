import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { SearchBox } from './SearchBox';
import { Sidebar } from './Sidebar';
import { IconAtom, IconFlask, IconHome, IconMenu, IconMoon, IconSidebar, IconSun, IconX } from './icons';
import { actions, useApp } from '../state/store';
import { t } from '../content/strings';

export function AppShell() {
  const theme = useApp((s) => s.theme);
  const experiment = useApp((s) => s.experiment);
  const sidebar = useApp((s) => s.sidebar);
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
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[100] focus:rounded-lg focus:bg-panel focus:px-3 focus:py-2 focus:font-semibold focus:shadow-panel">Skip to content</a>
      <header className="z-40 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-bg/85 px-3 backdrop-blur-md sm:gap-3 md:px-4">
        <button type="button" className="press rounded-lg p-2 text-fg-2 hover:bg-panel-2 hover:text-fg lg:hidden" aria-label={t('menu')} onClick={() => setDrawer(true)}>
          <IconMenu size={18} />
        </button>
        <button type="button" onClick={actions.toggleSidebar} aria-expanded={sidebar} aria-controls="syllabus-sidebar"
          aria-label={sidebar ? t('hideSidebar') : t('showSidebar')} title={sidebar ? t('hideSidebar') : t('showSidebar')}
          className={`press hidden h-9 w-9 place-items-center rounded-lg border lg:grid ${sidebar ? 'border-line text-fg-2 hover:bg-panel-2 hover:text-fg' : 'border-accent/40 bg-accent-soft text-accent'}`}>
          <IconSidebar size={17} />
        </button>
        <Link to="/" className="group flex shrink-0 items-center gap-2.5 rounded-lg text-fg" aria-label={`${t('appName')} — ${t('home')}`}>
          <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-accent text-accent-fg shadow-[0_6px_16px_-8px_var(--accent)] transition-transform group-hover:rotate-[30deg]"><IconAtom size={18} /></span>
          <span className="brand-text hidden text-[16.5px] sm:inline">{t('appName')}</span>
          <span className="hidden rounded-md bg-panel-3 px-1.5 py-0.5 text-[10px] font-bold tracking-[0.06em] text-fg-2 md:inline">HSC</span>
        </Link>
        {!sidebar && (
          <nav aria-label="Main" className="hidden lg:block">
            <Link to="/" aria-current={loc.pathname === '/' ? 'page' : undefined}
              className={`press flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold ${loc.pathname === '/' ? 'bg-accent-soft text-accent' : 'text-fg-2 hover:bg-panel-2 hover:text-fg'}`}>
              <IconHome size={16} /> {t('home')}
            </Link>
          </nav>
        )}
        <div className="flex min-w-0 flex-1 justify-center px-1">
          <SearchBox />
        </div>
        <button
          type="button"
          onClick={() => actions.setExperiment(!experiment)}
          aria-pressed={experiment}
          title={t('experimentMode')}
          className={`press flex h-9 items-center gap-2 rounded-lg border px-2.5 text-sm font-semibold ${experiment ? 'border-accent/50 bg-accent-soft text-accent' : 'border-line text-fg-2 hover:bg-panel-2 hover:text-fg'}`}
        >
          <IconFlask size={16} />
          <span className="hidden md:inline">{t('experiment')}</span>
        </button>
        <button type="button" onClick={actions.toggleTheme} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} title={theme === 'dark' ? 'Light theme' : 'Dark theme'} className="press grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line text-fg-2 hover:bg-panel-2 hover:text-fg">
          {theme === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />}
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside id="syllabus-sidebar" aria-label="Syllabus" inert={!sidebar}
          className={`hidden shrink-0 overflow-x-hidden bg-bg-2 transition-[width] duration-200 ease-out lg:block ${sidebar ? 'w-[296px] overflow-y-auto border-r border-line' : 'w-0 overflow-y-hidden'}`}>
          <div className="w-[296px]">
            <Sidebar />
          </div>
        </aside>

        {drawer && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Syllabus">
            <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDrawer(false)} />
            <div className="fade-in absolute inset-y-0 left-0 flex w-[88%] max-w-80 flex-col border-r border-line bg-bg-2 shadow-lift">
              <div className="flex h-14 items-center justify-between border-b border-line px-4">
                <span className="text-[15px] font-bold">Syllabus</span>
                <button type="button" className="press rounded-lg p-2 text-fg-2 hover:bg-panel-2 hover:text-fg" aria-label="Close menu" onClick={() => setDrawer(false)}><IconX size={18} /></button>
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
