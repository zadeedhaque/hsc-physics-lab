import { useMemo, type ReactNode } from 'react';
import { parseMath, type MathNode } from '../../lib/mathText';

function render(nodes: MathNode[]): ReactNode[] {
  return nodes.map((node, i) =>
    typeof node === 'string' ? (
      <span key={i}>{node}</span>
    ) : (
      <span key={i} className="frac" role="math" aria-label={node.source}>
        <span className="frac-num" aria-hidden="true">{render(node.num)}</span>
        <span className="frac-den" aria-hidden="true">{render(node.den)}</span>
      </span>
    ),
  );
}

/** A plain-text formula with every division drawn as a stacked fraction. */
export function MathText({ text }: { text: string }) {
  const nodes = useMemo(() => parseMath(text), [text]);
  return <>{render(nodes)}</>;
}
