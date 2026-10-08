import { Link } from 'react-router-dom';
import { CHAPTERS, PAPERS, chaptersOf } from '../content/syllabus';
import { TOPICS, topicById } from '../content/catalog';
import { isReady } from '../sims/registry';
import { useApp } from '../state/store';
import { t } from '../content/strings';
import { TopicCard } from '../components/TopicCard';
import { IconArrowRight, IconClock, IconStar } from '../components/icons';

const POPULAR = [
  'projectile-motion', 'newton-second-law', 'friction', 'shm-spring', 'transverse-wave', 'electric-field',
  'series-circuit', 'magnetic-field-wire', 'convex-lens', 'double-slit', 'photoelectric-effect', 'radioactive-decay',
];

export function HomePage() {
  const favorites = useApp((s) => s.favorites);
  const recents = useApp((s) => s.recents);
  const recentTopics = recents.map(topicById).filter((x) => x !== undefined);
  const favTopics = favorites.map(topicById).filter((x) => x !== undefined);
  const popular = POPULAR.map(topicById).filter((x) => x !== undefined);
  const last = recentTopics[0];
  const readyCount = TOPICS.filter(isReady).length;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-6 md:px-8 md:pt-10">
      <section className="relative overflow-hidden rounded-3xl border border-line bg-panel shadow-panel">
        <div className="grid-paper pointer-events-none absolute inset-0 [mask-image:radial-gradient(120%_90%_at_85%_20%,black,transparent_75%)]" aria-hidden="true" />
        <div className="relative grid items-center gap-6 px-6 py-9 md:grid-cols-[1.15fr_1fr] md:px-10 md:py-12 lg:py-14">
          <div>
            <p className="mb-5 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-line bg-panel-2 py-1 pl-1 pr-3 text-[12.5px] font-semibold text-fg-2">
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-accent">HSC Physics</span>
              <span>Class 11–12</span>
              <span className="text-fg-3" aria-hidden="true">·</span>
              <span lang="bn" className="leading-none">১ম ও ২য় পত্র</span>
            </p>
            <h1 className="text-[2.6rem] leading-[1.02] md:text-6xl">{t('appName')}</h1>
            <p className="mt-4 text-lg font-semibold text-fg-2 md:text-[1.35rem]">
              Explore physics. Change the variables. <span className="whitespace-nowrap text-accent">See the laws.</span>
            </p>
            <p className="mt-3 max-w-[34rem] text-[15px] leading-relaxed text-fg-2">{t('appIntro')}</p>
            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              {last ? (
                <Link to={`/physics/${last.paper}/chapter/${last.chapter}/${last.id}`} className="press inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-accent-fg shadow-[0_8px_20px_-10px_var(--accent)] hover:bg-accent-2">
                  {t('continueLearning')}: {last.title} <IconArrowRight size={16} />
                </Link>
              ) : (
                <Link to="/physics/1/chapter/3/projectile-motion" className="press inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-accent-fg shadow-[0_8px_20px_-10px_var(--accent)] hover:bg-accent-2">
                  Start with Projectile Motion <IconArrowRight size={16} />
                </Link>
              )}
              <Link to="/physics/1" className="press inline-flex items-center gap-2 rounded-xl border border-line-2 px-4 py-2.5 text-sm font-bold text-fg hover:border-fg-3 hover:bg-panel-2">Browse the syllabus</Link>
            </div>
            <dl className="mt-8 flex flex-wrap items-baseline gap-x-8 gap-y-3 border-t border-line pt-5">
              <HeroStat value={readyCount} label="simulations" />
              <HeroStat value={CHAPTERS.length} label="chapters" />
              <div><dt className="sr-only">Languages</dt><dd className="text-[13px] font-semibold text-fg-2">English <span className="text-fg-3">·</span> <span lang="bn">বাংলা</span></dd></div>
            </dl>
          </div>
          <HeroPlot />
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2" aria-label="Papers">
        {PAPERS.map((p) => {
          const chapters = chaptersOf(p.id);
          const topics = TOPICS.filter((x) => x.paper === p.id);
          const ready = topics.filter(isReady).length;
          return (
            <Link key={p.id} to={`/physics/${p.id}`} className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-panel p-6 transition duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lift">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl">{p.title}</h2>
                  <p className="mt-0.5 text-[14px] text-fg-3" lang="bn">{p.bn}</p>
                </div>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line text-fg-3 transition group-hover:border-accent group-hover:bg-accent group-hover:text-accent-fg">
                  <IconArrowRight size={16} />
                </span>
              </div>
              <p className="mt-3 text-[14.5px] leading-relaxed text-fg-2">{p.tagline}</p>
              <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Chapters">
                {chapters.slice(0, 5).map((ch) => (
                  <li key={ch.number} className="rounded-md bg-panel-3 px-2 py-0.5 text-[12px] font-medium text-fg-2">{ch.title}</li>
                ))}
                {chapters.length > 5 && <li className="rounded-md px-1 py-0.5 text-[12px] font-semibold text-fg-3">+{chapters.length - 5} more</li>}
              </ul>
              <dl className="mt-auto flex gap-8 pt-5">
                <Stat label={t('chapters')} value={chapters.length} />
                <Stat label="Simulations" value={ready} />
                {ready < topics.length && <Stat label={t('inDevelopment')} value={topics.length - ready} />}
              </dl>
            </Link>
          );
        })}
      </section>

      {recentTopics.length > 0 && (
        <Shelf title={t('recents')} icon={<IconClock size={16} />} compact>
          {recentTopics.slice(0, 4).map((tp) => <TopicCard key={tp.id} topic={tp} showChapter compact />)}
        </Shelf>
      )}

      <Shelf title={t('favorites')} icon={<IconStar size={16} filled className="text-warn" />} compact>
        {favTopics.length ? favTopics.slice(0, 8).map((tp) => <TopicCard key={tp.id} topic={tp} showChapter compact />) : (
          <div className="col-span-full flex items-center gap-3 rounded-xl border border-dashed border-line-2 px-4 py-5 text-sm text-fg-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-panel-3 text-fg-3"><IconStar size={16} /></span>
            <span>{t('noFavorites')}</span>
          </div>
        )}
      </Shelf>

      <Shelf title={t('popular')}>
        {popular.map((tp) => <TopicCard key={tp.id} topic={tp} showChapter />)}
      </Shelf>
    </div>
  );
}

function HeroStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dd className="text-2xl font-extrabold tracking-tight text-fg tabular">{value}</dd>
      <dt className="text-[13px] font-semibold text-fg-3">{label}</dt>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[12px] font-semibold text-fg-3">{label}</dt>
      <dd className="text-[1.65rem] font-extrabold leading-tight tracking-tight text-fg tabular">{value}</dd>
    </div>
  );
}

function Shelf({ title, icon, children, compact = false }: { title: string; icon?: React.ReactNode; children: React.ReactNode; compact?: boolean }) {
  return (
    <section className="mt-12">
      <h2 className="mb-4 flex items-center gap-2 text-lg">{icon}{title}</h2>
      <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 ${compact ? '' : 'xl:grid-cols-4'}`}>{children}</div>
    </section>
  );
}

/** Decorative projectile plot: axes, a trajectory with apex and range marks, and a ball riding the curve. */
function HeroPlot() {
  const path = 'M 40 230 Q 200 -40 360 230';
  return (
    <div className="relative mx-auto hidden w-full max-w-[440px] md:block" aria-hidden="true">
      <svg viewBox="0 0 400 270" className="w-full overflow-visible" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* axes */}
        <path d="M 40 20 V 230 H 385" stroke="var(--fg-3)" strokeWidth="1.5" />
        <path d="M 36 26 L 40 18 L 44 26 M 377 226 L 385 230 L 377 234" stroke="var(--fg-3)" strokeWidth="1.5" />
        {[100, 160, 220, 280, 340].map((x) => <path key={x} d={`M ${x} 230 v 5`} stroke="var(--fg-3)" strokeWidth="1.2" />)}
        {[170, 110, 50].map((y) => <path key={y} d={`M 35 ${y} h 5`} stroke="var(--fg-3)" strokeWidth="1.2" />)}
        <text x="388" y="250" fontSize="12" fill="var(--fg-3)" fontFamily="var(--font-mono)" textAnchor="end">x</text>
        <text x="22" y="24" fontSize="12" fill="var(--fg-3)" fontFamily="var(--font-mono)">y</text>
        {/* apex and range */}
        <path d="M 200 95 V 230" stroke="var(--fg-3)" strokeWidth="1.2" strokeDasharray="3 5" />
        <path d="M 40 252 H 360" stroke="var(--fg-3)" strokeWidth="1" />
        <path d="M 40 247 v 10 M 360 247 v 10" stroke="var(--fg-3)" strokeWidth="1" />
        <rect x="183" y="244" width="34" height="17" rx="4" fill="var(--panel)" />
        <text x="200" y="257" fontSize="12" fill="var(--fg-2)" fontFamily="var(--font-mono)" textAnchor="middle">R</text>
        <text x="208" y="168" fontSize="12" fill="var(--fg-2)" fontFamily="var(--font-mono)">H</text>
        {/* launch angle */}
        <path d="M 80 230 A 40 40 0 0 0 60.4 195.6" stroke="var(--warn)" strokeWidth="1.5" />
        <text x="86" y="214" fontSize="12" fill="var(--warn)" fontFamily="var(--font-mono)">θ</text>
        {/* trajectory: faint full path, bright traced path */}
        <path d={path} stroke="var(--line-2)" strokeWidth="2" strokeDasharray="4 6" />
        <path d={path} stroke="var(--accent)" strokeWidth="2.5" className="hero-trace" pathLength="1" />
        {/* initial velocity and components */}
        <path d="M 40 230 L 88.5 148" stroke="var(--fg)" strokeWidth="2" />
        <path d="M 81.1 153.1 L 88.5 148 L 87.6 157" stroke="var(--fg)" strokeWidth="2" />
        <text x="52" y="168" fontSize="12.5" fill="var(--fg)" fontFamily="var(--font-mono)" fontWeight="600">u</text>
        <circle r="7" fill="var(--accent)" stroke="var(--panel)" strokeWidth="2.5" className="hero-ball" />
      </svg>
      <style>{`
        .hero-trace { stroke-dasharray: 1; stroke-dashoffset: 1; animation: hero-trace 4s cubic-bezier(.45,.05,.55,.95) infinite; }
        .hero-ball { offset-path: path('${path}'); offset-rotate: 0deg; animation: hero-ball 4s cubic-bezier(.45,.05,.55,.95) infinite; }
        @keyframes hero-trace { 0% { stroke-dashoffset: 1; } 70%, 100% { stroke-dashoffset: 0; } }
        @keyframes hero-ball { 0% { offset-distance: 0%; } 70%, 100% { offset-distance: 100%; } }
        @media (prefers-reduced-motion: reduce) {
          .hero-trace { animation: none; stroke-dashoffset: 0; }
          .hero-ball { animation: none; offset-distance: 50%; }
        }
      `}</style>
    </div>
  );
}
