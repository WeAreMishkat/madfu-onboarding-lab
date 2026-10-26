import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { MadfuBusinessLockup } from '@/lab/BrandMarks';
import { DecisionTable } from '@/experiences/proposed/DecisionTables';
import { BoardLegend, BoardSvg, OpenItemsList } from '@/experiences/proposed/MasterBoards';
import { DETAILED_BOARD, REUSE_NOTE, SIMPLE_BOARD, splitMap, type JourneyMap } from '@/experiences/proposed/model/boards';
import { STAGES, UX_HANDOVER_NOTE } from '@/experiences/proposed/model/config';
import { ASSUMPTIONS, CONFIRMED_DECISIONS, DECISION_TABLES, OTHER_OPEN_POINTS } from '@/experiences/proposed/model/decisions';
import { SCENARIOS } from '@/experiences/proposed/model/scenarios';
import { SNAPSHOTS, type Snapshot, type SnapshotSection } from '@/experiences/proposed/print/snapshots';
import { ProposedFrame } from '@/experiences/proposed/ProposedPage';
import { ProposedProvider } from '@/experiences/proposed/store';
import '@/experiences/proposed/proposed.css';
import '@/styles/print.css';

/**
 * Print-only routes. Every screen is rendered by the same step components as the prototype; every
 * board and table from the same model.
 *   /print/wireframes      Madfu_Merchant_Onboarding_Wireframes.pdf     1600 × 1300 px pages
 *   /print/board-simple    Madfu_Proposed_Simple_Master_Board.pdf      2200 × 1150 px
 *   /print/board-detailed  Madfu_Proposed_Detailed_Master_Board.pdf    2000 × 1250 px pages
 */
const SPEC_VERSION = 'Agreed product decisions, 27 Oct 2026 (supersede the 23 Oct KYB-first journey and the 15 Oct wireframe specification where they differ)';

function usePrintReady(title: string) {
  useEffect(() => {
    document.title = title;
    let live = true;
    void document.fonts.ready.then(() => setTimeout(() => { if (live) document.body.dataset.printReady = '1'; }, 300));
    return () => { live = false; };
  }, [title]);
}

function Page({ section, title, caption, children, n, w = 1600, h = 1300, footer = 'Madfu Merchant Onboarding · Wireframes' }: { section: string; title: string; caption?: string; children: ReactNode; n: number; w?: number; h?: number; footer?: string }) {
  return (
    <section className="pw-page" style={{ width: w, height: h }}>
      <header className="pw-head">
        <div>
          <p className="pw-section">{section}</p>
          <h2 className="pw-title">{title}</h2>
          {caption && <p className="pw-caption">{caption}</p>}
        </div>
        <span className="pw-badge">Proposed / Product Design</span>
      </header>
      <div className="pw-body">{children}</div>
      <footer className="pw-foot"><span>{footer}</span><span>{n}</span></footer>
    </section>
  );
}

/** Renders a screen at desktop width (1440) and scales it down only if it does not fit. */
function Fit({ children, maxH }: { children: ReactNode; maxH: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const h = ref.current?.scrollHeight ?? 0;
    setScale(h > maxH ? maxH / h : 1);
  }, [maxH]);
  return (
    <div className="pw-fit" style={{ height: maxH }}>
      <div ref={ref} className="pw-screen" style={{ transform: `scale(${scale})`, width: 1440 }}>{children}</div>
    </div>
  );
}

function ScreenPage({ snap, n, section }: { snap: Snapshot; n: number; section: string }) {
  return (
    <Page section={section} title={snap.title} caption={snap.caption} n={n}>
      <Fit maxH={1300 - 210}>
        <ProposedProvider initial={snap.state()} isStatic previewErrors={snap.errors}>
          <div className="mb-root pw-root"><ProposedFrame /></div>
        </ProposedProvider>
      </Fit>
    </Page>
  );
}

const SECTION_LABEL: Record<SnapshotSection, string> = {
  kyb: `Stage 1 · ${STAGES[0].label}`,
  identify: `Stage 2 · ${STAGES[1].label}, existing records and routing`,
  cr: `Stage 3 · ${STAGES[2].label}: registered business`,
  fl: `Stage 3 · ${STAGES[2].label}: Freelancer`,
  details: `Stage 4 · ${STAGES[3].label}`,
  commercial: `Stage 5 · ${STAGES[4].label}`,
  review: `Stage 6 · ${STAGES[5].label}`,
  contract: `Stages 7–8 · ${STAGES[6].label} and ${STAGES[7].label}`,
  validation: 'Validation and error examples'
};

function MapBlock({ map, splitAt }: { map: JourneyMap; splitAt?: number }) {
  const parts = (splitAt !== undefined ? splitMap(map, splitAt) : null) ?? [map];
  return <>{parts.map((p) => <div key={p.title} className="pw-map"><p className="pw-map-part">{parts.length > 1 ? p.title : ''}</p><BoardSvg map={p} /></div>)}</>;
}

export default function PrintWireframes() {
  usePrintReady('Madfu_Merchant_Onboarding_Wireframes');
  let n = 0;
  const next = () => ++n;
  const pages: ReactNode[] = [];
  pages.push(
    <section key="cover" className="pw-page pw-cover" style={{ width: 1600, height: 1300 }}>
      <MadfuBusinessLockup height={40} />
      <h1>Madfu Merchant Onboarding</h1>
      <p className="pw-cover-sub">Wireframes · Proposed / Product Design</p>
      <dl className="pw-cover-meta">
        <div><dt>Source of truth</dt><dd>{SPEC_VERSION}</dd></div>
        <div><dt>Prototype</dt><dd>Merchant Onboarding Lab · Madfu Proposed ({SCENARIOS.length} scenarios)</dd></div>
        <div><dt>Data</dt><dd>Synthetic. Integrations are simulated. Not production behaviour.</dd></div>
      </dl>
      <span className="pw-hidden">{next()}</span>
    </section>
  );
  pages.push(
    <Page key="principles" section="Introduction" title="Principles" n={next()}>
      <ol className="pw-principles">
        <li><strong>Ask cheaply first, verify expensively later.</strong> Five Page-1 answers decide eligibility before any identity, OTP or paid check; an internal existence check runs before the code.</li>
        <li><strong>Access belongs to the registered mobile.</strong> Merchant entity, application and user are separate: an existing application or account opens only with a code to its registered mobile.</li>
        <li><strong>Lifecycle first.</strong> A returning applicant is routed by status: draft → resume, submitted → Application Progress, live → login.</li>
        <li><strong>Never repeat a paid verification unnecessarily.</strong> Successful checks are reused; the Freelancer certificate is checked before Nafath; resume normally costs one OTP.</li>
        <li><strong>Government data is authoritative.</strong> After retrieval, the CR / certificate activity decides the category and the price; verified sections are locked.</li>
        <li><strong>Hard rules and risk are separate.</strong> A hard block stops with a personalised reason; CR age and other factors only score risk in the backend.</li>
        <li><strong>Simple commercial step.</strong> The standard offer → Continue; plans are configured later; a better-rate review is optional and never blocks.</li>
      </ol>
    </Page>
  );
  pages.push(
    <Page key="simple" section="Journey overview" title={SIMPLE_BOARD.title} caption={REUSE_NOTE} n={next()}>
      <BoardLegend />
      <MapBlock map={SIMPLE_BOARD} />
    </Page>
  );
  const snaps = (s: SnapshotSection) => SNAPSHOTS.filter((x) => x.section === s);
  const panel = (id: string) => DETAILED_BOARD.find((m) => m.id === id)!;
  const order: Array<[SnapshotSection, string[]]> = [
    ['kyb', ['kyb']], ['identify', ['identify']], ['cr', ['cr', 'nafath']], ['fl', ['fl']], ['details', ['details']], ['commercial', ['commercial']], ['review', ['review']], ['contract', ['contract', 'reuse']], ['validation', []]
  ];
  pages.push(
    <Page key="confirmed" section="Introduction" title="Confirmed product decisions" caption="27 Oct 2026" n={next()}>
      <ol className="pw-list pw-compact">{CONFIRMED_DECISIONS.map((d) => <li key={d}>{d}</li>)}</ol>
    </Page>
  );
  for (const [section, panels] of order) {
    for (const id of panels) {
      const m = panel(id);
      pages.push(<Page key={`map-${id}`} section={SECTION_LABEL[section]} title={m.title} caption={m.caption} n={next()}><BoardLegend /><MapBlock map={m} /></Page>);
    }
    snaps(section).forEach((s) => pages.push(<ScreenPage key={s.id} snap={s} n={next()} section={SECTION_LABEL[section]} />));
  }
  DECISION_TABLES.forEach((t) => pages.push(
    <Page key={`dt-${t.id}`} section="Rules and decision tables" title={t.title} n={next()}><div className="pw-table"><DecisionTable table={{ ...t, title: '' }} /></div></Page>
  ));
  pages.push(
    <Page key="open" section="Open decisions" title="Open product and compliance decisions" caption="Not confirmed rules. Implemented configurably with synthetic values." n={next()}>
      <div className="pw-open"><OpenItemsList /></div>
      <h3 className="pw-sub">Other open points</h3>
      <ul className="pw-list">{OTHER_OPEN_POINTS.map((a) => <li key={a}>{a}</li>)}</ul>
    </Page>
  );
  pages.push(
    <Page key="ux" section="UX handover" title="Global UX handover note" n={next()}>
      <blockquote className="pw-note">{UX_HANDOVER_NOTE}</blockquote>
      <p className="pw-text">These wireframes show structure, content and behaviour. Visual design, motion, Arabic / RTL and accessibility are for the UX/UI team to complete.</p>
      <h3 className="pw-sub">Assumptions in the prototype</h3>
      <ul className="pw-list">{ASSUMPTIONS.map((a) => <li key={a}>{a}</li>)}</ul>
    </Page>
  );
  return <div className="pw">{pages}</div>;
}

/* ------------------------------------------------------------------ master board PDFs */

export function PrintSimpleBoard() {
  usePrintReady('Madfu_Proposed_Simple_Master_Board');
  return (
    <div className="pw">
      <style>{'@page { size: 2200px 1150px; margin: 0; }'}</style>
      <Page section="Madfu Proposed · Merchant onboarding" title={SIMPLE_BOARD.title} caption={SIMPLE_BOARD.caption} n={1} w={2200} h={1150} footer="Madfu Proposed · Master Board · generated from the Lab model">
        <BoardLegend />
        <div className="pw-map pw-board pw-board-simple"><BoardSvg map={SIMPLE_BOARD} /></div>
        <div className="pw-board-open"><h3 className="pw-sub">Open decisions (not confirmed rules)</h3><OpenItemsList compact /></div>
      </Page>
    </div>
  );
}

export function PrintDetailedBoard() {
  usePrintReady('Madfu_Proposed_Detailed_Master_Board');
  const W = 2000;
  const H = 1250;
  const foot = 'Madfu Proposed · Detailed Logic Board · generated from the Lab model';
  return (
    <div className="pw">
      <style>{`@page { size: ${W}px ${H}px; margin: 0; }`}</style>
      <Page section="Madfu Proposed · Merchant onboarding" title="Detailed Logic Board" caption="Merchant-facing steps, backend / internal steps, external provider calls, decisions, reused results, outcomes and open decisions. One panel per area." n={1} w={W} h={H} footer={foot}>
        <BoardLegend />
        <ol className="pw-panels">{DETAILED_BOARD.map((m) => <li key={m.id}><strong>{m.title}</strong> — {m.caption}</li>)}</ol>
        <p className="pw-board-note">{REUSE_NOTE}</p>
      </Page>
      {DETAILED_BOARD.map((m, i) => (
        <Page key={m.id} section="Detailed Logic Board" title={m.title} caption={m.caption} n={i + 2} w={W} h={H} footer={foot}>
          <BoardLegend />
          <div className="pw-map pw-board"><BoardSvg map={m} /></div>
          {m.notes?.map((t) => <p key={t} className="pw-board-note">{t}</p>)}
        </Page>
      ))}
      <Page section="Detailed Logic Board" title="Open product and compliance decisions" caption="Product tasks and decisions. Not confirmed rules." n={DETAILED_BOARD.length + 2} w={W} h={H} footer={foot}>
        <div className="pw-open"><OpenItemsList /></div>
      </Page>
    </div>
  );
}
