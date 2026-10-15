import { useState } from 'react';
import { MAPS, NODE_KIND_LABEL, type JourneyMap, type MapNode, type NodeKind } from './model/flowmap';

const COL = 214;
const ROW = 128;
const W = 156;
const H = 78;
const PAD = 24;

const center = (n: MapNode) => ({ x: PAD + n.col * COL + W / 2, y: PAD + n.row * ROW + H / 2 });

function NodeShape({ kind }: { kind: NodeKind }) {
  switch (kind) {
    case 'decision':
      return <polygon points={`${W / 2},0 ${W},${H / 2} ${W / 2},${H} 0,${H / 2}`} className="jm-shape jm-decision" />;
    case 'outcome':
      return <rect width={W} height={H} rx={H / 2} className="jm-shape jm-outcome" />;
    case 'external':
      return <><rect width={W} height={H} rx={6} className="jm-shape jm-external" /><rect x={4} y={4} width={W - 8} height={H - 8} rx={4} className="jm-shape-inner" /></>;
    case 'backend':
      return <rect width={W} height={H} rx={6} className="jm-shape jm-backend" />;
    case 'connector':
      return <rect width={W} height={H} rx={H / 2} className="jm-shape jm-connector" />;
    case 'manual':
      return <><rect width={W} height={H} rx={6} className="jm-shape jm-manual" /><rect width={8} height={H} className="jm-manual-bar" /></>;
    default:
      return <rect width={W} height={H} rx={6} className="jm-shape jm-screen" />;
  }
}

export function JourneyMapSvg({ map }: { map: JourneyMap }) {
  const cols = Math.max(...map.nodes.map((n) => n.col)) + 1;
  const rows = Math.max(...map.nodes.map((n) => n.row)) + 1;
  const width = PAD * 2 + (cols - 1) * COL + W;
  const height = PAD * 2 + (rows - 1) * ROW + H;
  const byId = new Map(map.nodes.map((n) => [n.id, n]));

  return (
    <svg className="jm-svg" viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={`${map.title} journey map`}>
      <defs>
        <marker id={`arrow-${map.id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" className="jm-arrow" />
        </marker>
      </defs>
      {map.edges.map((e, i) => {
        const a = byId.get(e.from)!;
        const b = byId.get(e.to)!;
        const ca = center(a);
        const cb = center(b);
        let d: string;
        let lx: number;
        let ly: number;
        if (a.row === b.row) {
          const forward = b.col > a.col;
          const x1 = ca.x + (forward ? W / 2 : -W / 2);
          const x2 = cb.x + (forward ? -W / 2 : W / 2);
          d = `M${x1},${ca.y} L${x2},${cb.y}`;
          lx = (x1 + x2) / 2; ly = ca.y - 8;
        } else if (a.col === b.col) {
          const down = b.row > a.row;
          const y1 = ca.y + (down ? H / 2 : -H / 2);
          const y2 = cb.y + (down ? -H / 2 : H / 2);
          d = `M${ca.x},${y1} L${cb.x},${y2}`;
          lx = ca.x + 6; ly = (y1 + y2) / 2;
        } else {
          const down = b.row > a.row;
          const y1 = ca.y + (down ? H / 2 : -H / 2);
          const x2 = cb.x + (b.col > a.col ? -W / 2 : W / 2);
          d = `M${ca.x},${y1} L${ca.x},${cb.y} L${x2},${cb.y}`;
          lx = ca.x + 6; ly = (y1 + cb.y) / 2;
        }
        return (
          <g key={i}>
            <path d={d} className={`jm-edge ${e.dashed ? 'is-dashed' : ''}`} markerEnd={`url(#arrow-${map.id})`} />
            {e.label && <text x={lx} y={ly} className="jm-edge-label" textAnchor={a.row === b.row ? 'middle' : 'start'}>{e.label}</text>}
          </g>
        );
      })}
      {map.nodes.map((n) => (
        <g key={n.id} transform={`translate(${PAD + n.col * COL},${PAD + n.row * ROW})`}>
          <NodeShape kind={n.kind} />
          <foreignObject x={n.kind === 'decision' ? 22 : 12} y={6} width={n.kind === 'decision' ? W - 44 : W - 20} height={H - 12}>
            <div className={`jm-label jm-label-${n.kind}`}>{n.label}</div>
          </foreignObject>
        </g>
      ))}
    </svg>
  );
}

export function MapLegend() {
  return (
    <ul className="jm-legend" aria-label="Legend">
      {(Object.keys(NODE_KIND_LABEL) as NodeKind[]).filter((k) => k !== 'connector').map((k) => (
        <li key={k}>
          <svg width="34" height="22" viewBox={`0 0 ${W} ${H}`} aria-hidden="true"><NodeShape kind={k} /></svg>
          {NODE_KIND_LABEL[k]}
        </li>
      ))}
      <li><svg width="34" height="10" aria-hidden="true"><path d="M0,5 L34,5" className="jm-edge is-dashed" /></svg>Fallback / loop</li>
    </ul>
  );
}

export function JourneyMaps() {
  const [id, setId] = useState<JourneyMap['id']>('overview');
  const map = MAPS.find((m) => m.id === id)!;
  return (
    <div className="jm">
      <div className="jm-tabs" role="tablist" aria-label="Journey maps">
        {MAPS.map((m) => (
          <button key={m.id} role="tab" aria-selected={m.id === id} className={m.id === id ? 'is-active' : ''} onClick={() => setId(m.id)}>{m.title}</button>
        ))}
      </div>
      <p className="jm-caption">{map.caption}</p>
      <MapLegend />
      <div className="jm-canvas" tabIndex={0} aria-label={`${map.title} map, scroll horizontally`}>
        <JourneyMapSvg map={map} />
      </div>
    </div>
  );
}
