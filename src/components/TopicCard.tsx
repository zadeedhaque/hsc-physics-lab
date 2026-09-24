import { Link } from 'react-router-dom';
import { topicPath, type Topic } from '../content/catalog';
import { getChapter } from '../content/syllabus';
import { isReady } from '../sims/registry';
import { t } from '../content/strings';
import { Glyph } from './Glyph';
import { IconChevronRight } from './icons';

export function TopicCard({ topic, showChapter = false, compact = false }: { topic: Topic; showChapter?: boolean; compact?: boolean }) {
  const ready = isReady(topic);
  const ch = getChapter(topic.paper, topic.chapter);
  return (
    <Link
      to={topicPath(topic)}
      className={`group flex flex-col overflow-hidden rounded-xl border border-line bg-panel transition hover:-translate-y-0.5 hover:border-line-2 hover:shadow-panel ${ready ? '' : 'opacity-70'}`}
    >
      <div className={`relative grid place-items-center border-b border-line bg-panel-2 ${compact ? 'h-20' : 'h-28'}`}>
        <Glyph name={topic.glyph} className={compact ? 'h-14' : 'h-20'} />
        {!ready && (
          <span className="absolute right-2 top-2 rounded-md border border-line bg-panel px-1.5 py-0.5 text-[10px] font-medium text-fg-3">{t('inDevelopment')}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3.5">
        {showChapter && (
          <span className="text-[11px] font-medium uppercase tracking-wider text-fg-3">
            {topic.paper === 1 ? '1st' : '2nd'} · Ch {topic.chapter} · {ch?.title}
          </span>
        )}
        <h3 className="font-semibold leading-snug text-fg">{topic.title}</h3>
        {!compact && <p className="line-clamp-2 text-sm text-fg-2">{topic.summary}</p>}
        <span className={`mt-auto flex items-center gap-1 pt-2 text-sm font-medium ${ready ? 'text-accent' : 'text-fg-3'}`}>
          {ready ? t('openSimulation') : t('inDevelopment')}
          {ready && <IconChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />}
        </span>
      </div>
    </Link>
  );
}
