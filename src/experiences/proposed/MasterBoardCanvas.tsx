import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MadfuBusinessLockup } from '@/lab/BrandMarks';
import { BOARD_ARROWS, BOARD_BOXES, BOARD_GEOMETRY as G, BOARD_LEGEND, BOARD_SUBTITLE, BOARD_TITLE, type BoardBox, type BoardPill } from './model/masterBoard';
import type { ProposedState } from './model/types';
import { ProposedFrame } from './ProposedPage';
import { ProposedProvider } from './store';

/**
 * The visual Master Board (management view): real Proposed screens connected by simple arrows.
 * Layout, titles and arrows come from model/masterBoard.ts; every screen is rendered by the same
 * step components as the prototype. Used by /print/board-simple (PDF) and the in-app Master boards.
 */

/** A real screen rendered at `screenW` and scaled into the thumbnail window (cropped if still taller). */
function ScreenThumb({ build }: { build: () => ProposedState }) {
  const ref = useRef<HTMLDivElement>(null);
  const initial = useMemo(build, [build]);
  const base = G.thumbW / G.screenW;
  const [scale, setScale] = useState(base);
  useLayoutEffect(() => {
    const h = ref.current?.scrollHeight ?? 0;
    // Shrink a little to show the whole screen; below that floor the bottom is cropped (faded).
    setScale(h * base > G.thumbH ? Math.max(G.thumbH / h, base * 0.8) : base);
  }, [base]);
  return (
    <div className="mbx-thumb" style={{ width: G.thumbW, height: G.thumbH }}>
      <div ref={ref} className="mbx-screen" style={{ width: G.screenW, transform: `scale(${scale})` }}>
        <ProposedProvider initial={initial} isStatic>
          <div className="mb-root pw-root"><ProposedFrame /></div>
        </ProposedProvider>
      </div>
    </div>
  );
}

function Box({ b }: { b: BoardBox }) {
  const style = { left: G.colX(b.col), top: G.rowY[b.row], width: G.boxW, height: G.boxH };
  if (b.tone === 'lane') {
    return (
      <div className="mbx-box mbx-lane" style={style} data-box={b.id}>
        <p className="mbx-lane-eyebrow">New · eligible</p>
        <p className="mbx-lane-title">{b.title}</p>
        <p className="mbx-lane-caption">{b.caption}</p>
      </div>
    );
  }
  return (
    <div className={`mbx-box is-${b.tone}`} style={style} data-box={b.id} data-step={b.step}>
      <p className="mbx-title">{b.title}</p>
      {b.state && <ScreenThumb build={b.state} />}
      {b.caption && <p className="mbx-caption">{b.caption}</p>}
    </div>
  );
}

function Pill({ p }: { p: BoardPill }) {
  return <div className={`mbx-pill is-${p.kind}`} style={{ left: p.at.x, top: p.at.y }}>{p.kind === 'check' && <span aria-hidden="true">✓ </span>}{p.text}</div>;
}

export function MasterBoardCanvas() {
  return (
    <div className="mbx" style={{ width: G.width, height: G.height }} role="img" aria-label={`${BOARD_TITLE} — ${BOARD_SUBTITLE}`}>
      <header className="mbx-head">
        <div>
          <MadfuBusinessLockup height={34} />
          <h1 className="mbx-h1">{BOARD_TITLE}</h1>
          <p className="mbx-sub">{BOARD_SUBTITLE}</p>
        </div>
        <ul className="mbx-legend">
          {BOARD_LEGEND.map((l) => <li key={l}>{l}</li>)}
          <li className="mbx-badge">Proposed / Product Design · synthetic data</li>
        </ul>
      </header>
      {BOARD_BOXES.map((b) => <Box key={b.id} b={b} />)}
      <svg className="mbx-arrows" width={G.width} height={G.height} viewBox={`0 0 ${G.width} ${G.height}`} aria-hidden="true">
        <defs>
          <marker id="mbx-head" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className="mbx-arrowhead" />
          </marker>
        </defs>
        {BOARD_ARROWS.map((a) => (
          <path key={a.id} data-arrow={a.id} d={a.points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ')} className="mbx-line" markerEnd="url(#mbx-head)" />
        ))}
      </svg>
      {BOARD_ARROWS.flatMap((a) => (a.pills ?? []).map((p) => <Pill key={`${a.id}-${p.text}`} p={p} />))}
    </div>
  );
}

/** In-app view: the same board, scaled to fit the page width (the PDF is the full-size version). */
export function MasterBoardPreview({ scale = 0.24 }: { scale?: number }) {
  return (
    <div className="mbx-preview" style={{ width: G.width * scale, height: G.height * scale }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}><MasterBoardCanvas /></div>
    </div>
  );
}
