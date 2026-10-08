import { useMemo, type ReactNode } from 'react';
import { hasNotation, notation, parseRichMath, type RichNode } from '../../lib/notation';

function render(nodes: RichNode[]): ReactNode[] {
  return nodes.map((node, i) => {
    if (typeof node === 'string') return <span key={i}>{node}</span>;
    if (node.kind === 'frac') {
      return (
        <span key={i} className="frac" role="math" aria-label={node.source}>
          <span className="frac-num" aria-hidden="true">{render(node.num)}</span>
          <span className="frac-den" aria-hidden="true">{render(node.den)}</span>
        </span>
      );
    }
    const Tag = node.kind === 'sub' ? 'sub' : 'sup';
    return <Tag key={i} className={node.kind === 'sub' ? 'mt-sub' : 'mt-sup'}>{render(node.children)}</Tag>;
  });
}

/** A plain-text formula with every division drawn as a stacked fraction and real sub/superscripts. */
export function MathText({ text }: { text: string }) {
  const nodes = useMemo(() => parseRichMath(text), [text]);
  return <>{render(nodes)}</>;
}

/** Inline text with physics notation (V_d, e^{−λt}) rendered as sub/superscripts — no fractions. */
export function Notation({ text }: { text: string }) {
  if (!hasNotation(text)) return <>{text}</>;
  // One wrapper so the pieces never become separate flex/grid items in the parent.
  return <span>{render(notation(text))}</span>;
}
