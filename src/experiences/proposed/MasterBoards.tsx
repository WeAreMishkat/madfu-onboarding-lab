import { useState } from 'react';
import { DETAILED_BOARD, NODE_KIND_LABEL, REUSE_NOTE, SIMPLE_BOARD, routeEdge, type JourneyMap, type MapNode, type NodeKind } from './model/boards';
import { NOT_IMPLEMENTED, OPEN_ITEMS } from './model/decisions';

/** Node geometry: normal for the Simple board, large (room for field lists) for the Detailed panels. */
const geo = (large?: boolean) => (large ? { COL: 262, ROW: 150, W: 214, H: 104, PAD: 28 } : { COL: 228, ROW: 132, W: 188, H: 84, PAD: 28 });

function NodeShape({ kind, W, H }: { kind: NodeKind; W: number; H: number }) {
  switch (kind) {
    case 'decision':
      return <polygon points={`${W / 2},0 ${W},${H / 2} ${W / 2},${H} 0,${H / 2}`} className="jm-shape jm-decision" />;
    case 'outcome':
      return <rect width={W} height={H} rx={H / 2} className="jm-shape jm-outcome" />;
    case 'external':
      return <><rect width={W} height={H} rx={6} className="jm-shape jm-external" /><rect x={4} y={4} width={W - 8} height={H - 8} rx={4} className="jm-shape-inner" /></>;
    case 'cached':
      return <><rect width={W} height={H} rx={6} className="jm-shape jm-cached" /><circle cx={W - 14} cy={14} r={8} className="jm-cached-dot" /><path d={`M${W - 18},14 a4,4 0 1,0 4,-4`} className="jm-cached-arc" /></>;
    case 'backend':
      return <rect width={W} height={H} rx={6} className="jm-shape jm-backend" />;
    case 'open':
      return <><rect width={W} height={H} rx={6} className="jm-shape jm-open" /><rect width={W} height={8} className="jm-open-bar" /></>;
    case 'note':
      return <rect width={W} height={H} rx={6} className="jm-note" />;
    case 'connector':
      return <rect width={W} height={H} rx={H / 2} className="jm-shape jm-connector" />;
    case 'manual':
      return <><rect width={W} height={H} rx={6} className="jm-shape jm-manual" /><rect width={8} height={H} className="jm-manual-bar" /></>;
    default:
      return <rect width={W} height={H} rx={6} className="jm-shape jm-screen" />;
  }
}

export function BoardSvg({ map }: { map: JourneyMap }) {
  const { COL, ROW, W, H, PAD } = geo(map.large);
  const center = (n: MapNode) => ({ x: PAD + n.col * COL + W / 2, y: PAD + n.row * ROW + H / 2 });
  const cols = Math.max(...map.nodes.map((n) => n.col)) + 1;
  const rows = Math.max(...map.nodes.map((n) => n.row)) + 1;
  // A note spans several columns.
  const noteSpan = (n: MapNode) => (n.kind === 'note' ? 3 : 1);
  const width = PAD * 2 + (cols - 1) * COL + W;
  const height = PAD * 2 + (rows - 1) * ROW + H;
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  const marker = `arrow-${map.id}`;

  const edges = map.edges.map((e) => {
    const a = byId.get(e.from)!;
    const b = byId.get(e.to)!;
    const ca = center(a);
    const cb = center(b);
    if (a.row === b.row) {
      const forward = b.col > a.col;
      const x1 = ca.x + (forward ? W / 2 : -W / 2);
      const x2 = cb.x + (forward ? -W / 2 : W / 2);
      return { e, d: `M${x1},${ca.y} L${x2},${cb.y}`, lx: (x1 + x2) / 2, ly: ca.y - 8, anchor: 'middle' as const };
    }
    if (a.col === b.col) {
      const down = b.row > a.row;
      const y1 = ca.y + (down ? H / 2 : -H / 2);
      const y2 = cb.y + (down ? -H / 2 : H / 2);
      // Near the start of the line: several edges may leave the same node downwards.
      return { e, d: `M${ca.x},${y1} L${cb.x},${y2}`, lx: ca.x + 6, ly: y1 + (down ? 14 : -6), anchor: 'start' as const };
    }
    if (routeEdge(map, e).route === 'vertical-first') {
      const down = b.row > a.row;
      const y1 = ca.y + (down ? H / 2 : -H / 2);
      const x2 = cb.x + (b.col > a.col ? -W / 2 : W / 2);
      // On the horizontal leg: two elbows leaving the same node never share a label spot.
      return { e, d: `M${ca.x},${y1} L${ca.x},${cb.y} L${x2},${cb.y}`, lx: (ca.x + x2) / 2, ly: cb.y - 8, anchor: 'middle' as const };
    }
    const right = b.col > a.col;
    const x1 = ca.x + (right ? W / 2 : -W / 2);
    const y2 = cb.y + (b.row > a.row ? -H / 2 : H / 2);
    return { e, d: `M${x1},${ca.y} L${cb.x},${ca.y} L${cb.x},${y2}`, lx: (x1 + cb.x) / 2, ly: ca.y - 8, anchor: 'middle' as const };
  });

  return (
    <svg className="jm-svg" viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={`${map.title}`}>
      <defs>
        <marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" className="jm-arrow" />
        </marker>
      </defs>
      {edges.map((g, i) => <path key={i} d={g.d} className={`jm-edge ${g.e.dashed ? 'is-dashed' : ''}`} markerEnd={`url(#${marker})`} />)}
      {map.nodes.map((n) => {
        const w = n.kind === 'note' ? W + (noteSpan(n) - 1) * COL : W;
        return (
          <g key={n.id} transform={`translate(${PAD + n.col * COL},${PAD + n.row * ROW})`} data-node={n.id} data-kind={n.kind}>
            <NodeShape kind={n.kind} W={w} H={H} />
            <foreignObject x={n.kind === 'decision' ? 26 : 12} y={n.kind === 'open' ? 10 : 6} width={n.kind === 'decision' ? w - 52 : w - 24} height={H - (n.kind === 'open' ? 14 : 12)}>
              <div className={`jm-label jm-label-${n.kind}`}>
                <span className="jm-label-main">{n.label}</span>
                {n.detail && <span className="jm-label-detail">{n.detail}</span>}
              </div>
            </foreignObject>
          </g>
        );
      })}
      {/* Labels last, so a short gap between two nodes never hides them. */}
      {edges.map((g, i) => g.e.label && <text key={i} x={g.lx} y={g.ly} className="jm-edge-label" textAnchor={g.anchor}>{g.e.label}</text>)}
    </svg>
  );
}

export function BoardLegend() {
  const kinds = Object.keys(NODE_KIND_LABEL) as Array<keyof typeof NODE_KIND_LABEL>;
  return (
    <ul className="jm-legend" aria-label="Legend">
      {kinds.map((k) => (
        <li key={k}>
          <svg width="40" height="22" viewBox="0 0 188 84" aria-hidden="true"><NodeShape kind={k} W={188} H={84} /></svg>
          {NODE_KIND_LABEL[k]}
        </li>
      ))}
      <li><svg width="34" height="10" aria-hidden="true"><path d="M0,5 L34,5" className="jm-edge is-dashed" /></svg>Fallback / reuse / loop</li>
    </ul>
  );
}

export function OpenItemsList({ compact }: { compact?: boolean }) {
  return (
    <ol className={`jm-open-list ${compact ? 'is-compact' : ''}`}>
      {OPEN_ITEMS.map((o) => (
        <li key={o.id}>
          <span className="jm-open-type">{o.type}</span> <strong>{o.title}</strong>
          {o.notImplemented && <> <span className="jm-open-type is-ni">{NOT_IMPLEMENTED}</span></>}
          {!compact && <> — {o.detail}</>}
          {!compact && o.clarify && <ul className="jm-open-clarify">{o.clarify.map((c) => <li key={c}>{c}</li>)}</ul>}
        </li>
      ))}
    </ol>
  );
}

type Tab = 'simple' | 'detailed';

/** In-app view: the same boards the PDFs print. */
export function MasterBoards() {
  const [tab, setTab] = useState<Tab>('simple');
  return (
    <div className="jm">
      <div className="jm-tabs" role="tablist" aria-label="Master boards">
        <button role="tab" aria-selected={tab === 'simple'} className={tab === 'simple' ? 'is-active' : ''} onClick={() => setTab('simple')}>Simple Master Board</button>
        <button role="tab" aria-selected={tab === 'detailed'} className={tab === 'detailed' ? 'is-active' : ''} onClick={() => setTab('detailed')}>Detailed Master Board</button>
      </div>
      <BoardLegend />
      {tab === 'simple' ? (
        <>
          <p className="jm-caption">{SIMPLE_BOARD.caption}</p>
          <div className="jm-canvas" tabIndex={0} aria-label="Simple Master Board, scroll horizontally"><BoardSvg map={SIMPLE_BOARD} /></div>
          <p className="jm-reuse-note">{REUSE_NOTE}</p>
        </>
      ) : (
        DETAILED_BOARD.map((m) => (
          <section key={m.id} className="jm-panel" aria-label={m.title}>
            <h2 className="jm-panel-title">{m.title}</h2>
            <p className="jm-caption">{m.caption}</p>
            <div className="jm-canvas" tabIndex={0} aria-label={`${m.title}, scroll horizontally`}><BoardSvg map={m} /></div>
          </section>
        ))
      )}
      <section className="jm-panel" aria-label="Open product and compliance decisions">
        <h2 className="jm-panel-title">Open product and compliance decisions</h2>
        <p className="jm-caption">Not confirmed rules. The prototype implements them configurably with synthetic values.</p>
        <OpenItemsList />
      </section>
    </div>
  );
}
