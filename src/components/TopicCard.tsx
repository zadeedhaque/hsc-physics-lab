import { Link } from 'react-router-dom';
import { topicPath, type Topic } from '../content/catalog';
import { getChapter } from '../content/syllabus';
import { isReady } from '../sims/registry';
import { t } from '../content/strings';
import { Glyph } from './Glyph';
import { Notation } from './sim/MathText';
import { IconArrowRight } from './icons';

/**
 * A topic tile. Full cards stack the preview above the text from `sm` up and sit side by side on
 * phones; compact cards (recents, favourites) are always side by side.
 */
export function TopicCard({ topic, showChapter = false, compact = false }: { topic: Topic; showChapter?: boolean; compact?: boolean }) {
  const ready = isReady(topic);
  const ch = getChapter(topic.paper, topic.chapter);
  const stacked = !compact;
  return (
    <Link
      to={topicPath(topic)}
      className={`group flex overflow-hidden rounded-xl border border-line bg-panel transition duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lift ${stacked ? 'sm:flex-col' : ''} ${ready ? '' : 'opacity-75'}`}
    >
      <div className={`grid-paper relative grid shrink-0 place-items-center bg-panel-2 ${stacked ? 'w-28 border-r border-line sm:h-28 sm:w-auto sm:border-b sm:border-r-0' : 'w-24 border-r border-line'}`}>
        <Glyph name={topic.glyph} className={`transition-transform duration-300 group-hover:scale-[1.06] ${compact ? 'h-12' : 'h-14 sm:h-[76px]'}`} />
        {!ready && (
          <span className="absolute right-2 top-2 rounded-md border border-line bg-panel px-1.5 py-0.5 text-[10px] font-semibold text-fg-3">{t('inDevelopment')}</span>
        )}
      </div>
      <div className={`flex min-w-0 flex-1 flex-col gap-1 ${compact ? 'px-3.5 py-3' : 'p-3.5 sm:p-4'}`}>
        {showChapter && (
          <span className="truncate text-[11.5px] font-semibold text-fg-3">
            {topic.paper === 1 ? '1st' : '2nd'} Paper · Ch {topic.chapter} · {ch?.title}
          </span>
        )}
        <h3 className="text-[15px] font-bold leading-snug text-fg">{topic.title}</h3>
        {!compact && <p className="line-clamp-2 text-[13.5px] leading-relaxed text-fg-2"><Notation text={topic.summary} /></p>}
        <span className={`mt-auto flex items-center gap-1.5 pt-1.5 text-[13px] font-bold ${ready ? 'text-accent' : 'text-fg-3'}`}>
          {ready ? t('openSimulation') : t('inDevelopment')}
          {ready && <IconArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-1" />}
        </span>
      </div>
    </Link>
  );
}
