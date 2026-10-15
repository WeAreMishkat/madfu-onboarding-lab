import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { MadfuBusinessLockup } from '@/lab/BrandMarks';
import { DecisionTable } from '@/experiences/proposed/DecisionTables';
import { JourneyMapSvg, MapLegend } from '@/experiences/proposed/JourneyMaps';
import { UX_HANDOVER_NOTE } from '@/experiences/proposed/model/config';
import { ASSUMPTIONS, DECISION_TABLES, PENDING_DECISIONS } from '@/experiences/proposed/model/decisions';
import { MAPS, splitMap } from '@/experiences/proposed/model/flowmap';
import { SCENARIOS } from '@/experiences/proposed/model/scenarios';
import { SNAPSHOTS, type Snapshot } from '@/experiences/proposed/print/snapshots';
import { ProposedFrame } from '@/experiences/proposed/ProposedPage';
import { ProposedProvider } from '@/experiences/proposed/store';
import '@/experiences/proposed/proposed.css';
import '@/styles/print.css';

/**
 * Print-only route for Madfu_Merchant_Onboarding_Wireframes.pdf. Every screen is rendered by the
 * same step components as the prototype, every map and table from the same model.
 * Page size 1600 × 1300 px (scripts/build-pdf.mjs).
 */
const PAGE_W = 1600;
const PAGE_H = 1300;
const SPEC_VERSION = 'Wireframe system specification, 15 Oct 2026';

function Page({ section, title, caption, children, n }: { section: string; title: string; caption?: string; children: ReactNode; n: number }) {
  return (
    <section className="pw-page" style={{ width: PAGE_W, height: PAGE_H }}>
      <header className="pw-head">
        <div>
          <p className="pw-section">{section}</p>
          <h2 className="pw-title">{title}</h2>
          {caption && <p className="pw-caption">{caption}</p>}
        </div>
        <span className="pw-badge">Proposed / Product Design</span>
      </header>
      <div className="pw-body">{children}</div>
      <footer className="pw-foot"><span>Madfu Merchant Onboarding · Wireframes</span><span>{n}</span></footer>
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
      <Fit maxH={PAGE_H - 210}>
        <ProposedProvider initial={snap.state()} isStatic previewErrors={snap.errors}>
          <div className="mb-root pw-root"><ProposedFrame /></div>
        </ProposedProvider>
      </Fit>
    </Page>
  );
}

const SECTION_LABEL: Record<Snapshot['section'], string> = {
  entry: 'Entry and SMS code',
  cr: 'Registered business screens',
  fl: 'Freelancer screens',
  manual: 'Manual routes',
  outcomes: 'Contract and outcomes',
  validation: 'Validation and error examples'
};

export default function PrintWireframes() {
  useEffect(() => {
    document.title = 'Madfu_Merchant_Onboarding_Wireframes';
    let live = true;
    void document.fonts.ready.then(() => setTimeout(() => { if (live) document.body.dataset.printReady = '1'; }, 300));
    return () => { live = false; };
  }, []);

  let n = 0;
  const next = () => ++n;
  const map = (id: string) => MAPS.find((m) => m.id === id)!;
  const snaps = (s: Snapshot['section']) => SNAPSHOTS.filter((x) => x.section === s);
  const required = SCENARIOS.filter((s) => s.required).length;

  const pages: ReactNode[] = [];
  pages.push(
    <section key="cover" className="pw-page pw-cover" style={{ width: PAGE_W, height: PAGE_H }}>
      <MadfuBusinessLockup height={40} />
      <h1>Madfu Merchant Onboarding</h1>
      <p className="pw-cover-sub">Wireframes · Proposed / Product Design</p>
      <dl className="pw-cover-meta">
        <div><dt>Source of truth</dt><dd>{SPEC_VERSION}</dd></div>
        <div><dt>Prototype</dt><dd>Merchant Onboarding Lab · Madfu Proposed ({SCENARIOS.length} scenarios, {required} required)</dd></div>
        <div><dt>Data</dt><dd>Synthetic. Integrations are simulated. Not production behaviour.</dd></div>
      </dl>
      <span className="pw-hidden">{next()}</span>
    </section>
  );
  pages.push(
    <Page key="principles" section="Introduction" title="Principles" n={next()}>
      <ol className="pw-principles">
        <li><strong>Ask only what is needed now.</strong> Retrieve everything else from verified sources.</li>
        <li><strong>Eligibility first.</strong> Revenue routing and category screening happen before any paid verification.</li>
        <li><strong>Application, not account.</strong> Applicants work on an application; the merchant account and password are set up only after approval.</li>
        <li><strong>Identity before mobile.</strong> CR / National ID duplicates are detected first; reusing a mobile never rejects on its own.</li>
        <li><strong>Backend-first verification.</strong> No proof of sales, VAT certificate, ID upload, IBAN certificate, beneficiary or SWIFT.</li>
        <li><strong>Nafath is identity, not signature.</strong> The agreement is a separate step, available only after Nafath verification.</li>
        <li><strong>Freelancers self-onboard at every revenue level.</strong> Registered businesses below SAR 100K or above SAR 20M become Sales leads.</li>
        <li><strong>Clear, recoverable states.</strong> Back, Edit, resume and bounded retries; internal reasons are never shown to applicants.</li>
      </ol>
    </Page>
  );
  const mapPage = (id: string, section: string) => {
    const m = map(id);
    const parts = splitMap(m, 6) ?? [m];
    return (
      <Page key={`map-${id}`} section={section} title={m.title} caption={m.caption} n={next()}>
        <MapLegend />
        {parts.map((p) => <div key={p.title} className="pw-map"><p className="pw-map-part">{parts.length > 1 ? p.title : ''}</p><JourneyMapSvg map={p} /></div>)}
      </Page>
    );
  };
  pages.push(mapPage('overview', 'Journey overview'));
  snaps('entry').forEach((s) => pages.push(<ScreenPage key={s.id} snap={s} n={next()} section={SECTION_LABEL.entry} />));
  pages.push(mapPage('cr', 'Registered business flow'));
  snaps('cr').forEach((s) => pages.push(<ScreenPage key={s.id} snap={s} n={next()} section={SECTION_LABEL.cr} />));
  pages.push(mapPage('fl', 'Freelancer flow'));
  snaps('fl').forEach((s) => pages.push(<ScreenPage key={s.id} snap={s} n={next()} section={SECTION_LABEL.fl} />));
  pages.push(mapPage('manual', 'Manual routes'));
  snaps('manual').forEach((s) => pages.push(<ScreenPage key={s.id} snap={s} n={next()} section={SECTION_LABEL.manual} />));
  snaps('outcomes').forEach((s) => pages.push(<ScreenPage key={s.id} snap={s} n={next()} section={SECTION_LABEL.outcomes} />));
  snaps('validation').forEach((s) => pages.push(<ScreenPage key={s.id} snap={s} n={next()} section={SECTION_LABEL.validation} />));
  DECISION_TABLES.forEach((t) => pages.push(
    <Page key={`dt-${t.id}`} section="Decision tables" title={t.title} n={next()}><div className="pw-table"><DecisionTable table={{ ...t, title: '' }} /></div></Page>
  ));
  pages.push(
    <Page key="ux" section="UX handover" title="Global UX handover note" n={next()}>
      <blockquote className="pw-note">{UX_HANDOVER_NOTE}</blockquote>
      <p className="pw-text">These wireframes show structure, content and behaviour. Visual design, motion, Arabic / RTL and accessibility are for the UX/UI team to complete.</p>
    </Page>
  );
  pages.push(
    <Page key="assumptions" section="Assumptions and pending decisions" title="Assumptions and pending decisions" n={next()}>
      <div className="pw-cols">
        <div><h3>Assumptions in the prototype</h3><ul>{ASSUMPTIONS.map((a) => <li key={a}>{a}</li>)}</ul></div>
        <div><h3>Pending product decisions</h3><ol>{PENDING_DECISIONS.map((a) => <li key={a}>{a}</li>)}</ol></div>
      </div>
    </Page>
  );
  return <div className="pw">{pages}</div>;
}
