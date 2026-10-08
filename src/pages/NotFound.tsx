import { Link } from 'react-router-dom';
import { PAPERS } from '../content/syllabus';
import { t } from '../content/strings';
import { IconArrowRight } from '../components/icons';

export function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-6 py-20 text-center md:py-28">
      <p className="font-mono text-sm font-medium text-accent">404 · Δx = undefined</p>
      <h1 className="mt-3 text-3xl md:text-4xl">{t('notFound')}</h1>
      <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-fg-2">
        This address doesn’t match any page in the lab. Pick a paper below, or press <kbd className="rounded-md border border-line-2 bg-panel px-1.5 font-mono text-[12px]">/</kbd> to search every simulation.
      </p>
      <div className="mt-8 grid gap-2.5 text-left sm:grid-cols-2">
        {PAPERS.map((p) => (
          <Link key={p.id} to={`/physics/${p.id}`} className="press group flex items-center justify-between rounded-xl border border-line bg-panel px-4 py-3 hover:border-accent/40">
            <span>
              <span className="block text-[15px] font-bold text-fg">{p.title}</span>
              <span className="block text-[13px] text-fg-3" lang="bn">{p.bn}</span>
            </span>
            <IconArrowRight size={16} className="text-fg-3 transition-transform group-hover:translate-x-1 group-hover:text-accent" />
          </Link>
        ))}
      </div>
      <Link to="/" className="mt-6 inline-block text-sm font-bold text-accent hover:underline">Back to {t('home').toLowerCase()}</Link>
    </div>
  );
}
