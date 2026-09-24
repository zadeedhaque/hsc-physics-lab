import { Link } from 'react-router-dom';
import { PAPERS, chaptersOf } from '../content/syllabus';
import { TOPICS, topicById } from '../content/catalog';
import { isReady } from '../sims/registry';
import { useApp } from '../state/store';
import { t } from '../content/strings';
import { TopicCard } from '../components/TopicCard';
import { IconChevronRight, IconClock, IconStar } from '../components/icons';

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

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 md:px-8 md:pt-12">
      <section className="relative overflow-hidden rounded-2xl border border-line bg-panel px-6 py-10 md:px-10 md:py-14">
        <HeroOrbits />
        <div className="relative max-w-2xl">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-accent">HSC · Class 11–12</p>
          <h1 className="text-4xl font-bold uppercase tracking-tight text-fg md:text-6xl">{t('appName')}</h1>
          <p className="mt-3 text-lg font-medium text-fg md:text-xl">{t('appTagline')}</p>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-fg-2 md:text-base">{t('appIntro')}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {last ? (
              <Link to={`/physics/${last.paper}/chapter/${last.chapter}/${last.id}`} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:bg-accent-2">
                {t('continueLearning')}: {last.title} <IconChevronRight size={15} />
              </Link>
            ) : (
              <Link to="/physics/1/chapter/3/projectile-motion" className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:bg-accent-2">
                Start with Projectile Motion <IconChevronRight size={15} />
              </Link>
            )}
            <Link to="/physics/1" className="inline-flex items-center gap-2 rounded-lg border border-line-2 px-4 py-2 text-sm font-medium text-fg hover:bg-panel-2">Browse the syllabus</Link>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        {PAPERS.map((p) => {
          const topics = TOPICS.filter((x) => x.paper === p.id);
          const ready = topics.filter(isReady).length;
          return (
            <Link key={p.id} to={`/physics/${p.id}`} className="group rounded-2xl border border-line bg-panel p-6 transition hover:border-line-2 hover:shadow-panel">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-fg">{p.title}</h2>
                  <p className="text-sm text-fg-3">{p.bn}</p>
                </div>
                <IconChevronRight size={18} className="mt-1 text-fg-3 transition group-hover:translate-x-0.5 group-hover:text-accent" />
              </div>
              <p className="mt-3 text-sm text-fg-2">{p.tagline}</p>
              <dl className="mt-5 flex gap-6">
                <Stat label={t('chapters')} value={chaptersOf(p.id).length} />
                <Stat label="Topics" value={topics.length} />
                <Stat label="Interactive now" value={ready} accent />
              </dl>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-panel-3" role="progressbar" aria-valuenow={ready} aria-valuemax={topics.length} aria-label={`${ready} of ${topics.length} topics interactive`}>
                <div className="h-full rounded-full bg-accent" style={{ width: `${(ready / topics.length) * 100}%` }} />
              </div>
            </Link>
          );
        })}
      </section>

      {recentTopics.length > 0 && (
        <Shelf title={t('recents')} icon={<IconClock size={15} />}>
          {recentTopics.slice(0, 4).map((tp) => <TopicCard key={tp.id} topic={tp} showChapter compact />)}
        </Shelf>
      )}

      <Shelf title={t('favorites')} icon={<IconStar size={15} filled className="text-warn" />}>
        {favTopics.length ? favTopics.slice(0, 8).map((tp) => <TopicCard key={tp.id} topic={tp} showChapter compact />) : (
          <p className="col-span-full rounded-xl border border-dashed border-line-2 px-4 py-6 text-center text-sm text-fg-3">{t('noFavorites')}</p>
        )}
      </Shelf>

      <Shelf title={t('popular')}>
        {popular.map((tp) => <TopicCard key={tp.id} topic={tp} showChapter />)}
      </Shelf>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-fg-3">{label}</dt>
      <dd className={`font-mono text-2xl font-semibold ${accent ? 'text-accent' : 'text-fg'}`}>{value}</dd>
    </div>
  );
}

function Shelf({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-fg-2">{icon}{title}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>
    </section>
  );
}

/** Decorative orbit lines behind the hero (static; hidden from assistive tech). */
function HeroOrbits() {
  return (
    <svg className="pointer-events-none absolute -right-24 -top-16 h-[420px] w-[620px] opacity-60 md:opacity-90" viewBox="0 0 620 420" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id="hero-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="400" cy="200" r="120" fill="url(#hero-glow)" />
      <circle cx="400" cy="200" r="10" fill="var(--accent)" />
      {[60, 110, 170, 240].map((r, i) => (
        <ellipse key={r} cx="400" cy="200" rx={r * 1.35} ry={r * 0.55} stroke="var(--line-2)" transform={`rotate(${-18 + i * 4} 400 200)`} />
      ))}
      <circle cx="481" cy="186" r="5" fill="#f472b6" />
      <circle cx="265" cy="238" r="4" fill="#fbbf24" />
      <circle cx="590" cy="150" r="3.5" fill="#34d399" />
      <path d="M150 360 Q 300 80 470 330" stroke="var(--accent)" strokeDasharray="4 6" opacity="0.6" />
    </svg>
  );
}
