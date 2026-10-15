import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { CompareItem, ComparisonProfile } from '@/compare/types';
import { MadfuBusinessLockup, MadfuWordmark, TabbyMark, TamaraMark } from '@/lab/BrandMarks';
import { StatusBadge } from '@/lab/StatusBadge';
import { tabbyComparison } from '@/experiences/tabby/comparison';
import { tamaraComparison } from '@/experiences/tamara/comparison';
import { madfuCurrentComparison } from '@/experiences/madfu-current/comparison';
import { proposedComparison } from '@/experiences/proposed/comparison';
import '@/styles/compare.css';

interface Column {
  profile: ComparisonProfile;
  mark: ReactNode;
  kind: string;
  to: string;
}

const COLUMNS: Record<string, Column> = {
  tabby: { profile: tabbyComparison, mark: <TabbyMark size={20} />, kind: 'Benchmark', to: '/tabby' },
  tamara: { profile: tamaraComparison, mark: <TamaraMark size={22} />, kind: 'Benchmark', to: '/tamara' },
  current: { profile: madfuCurrentComparison, mark: <MadfuWordmark height={20} />, kind: 'Current', to: '/madfu/current' },
  proposed: { profile: proposedComparison, mark: <MadfuBusinessLockup height={18} />, kind: 'Future', to: '/madfu/proposed' }
};

const SECTIONS: Array<{ key: keyof Omit<ComparisonProfile, 'experienceId' | 'name'>; title: string; help: string }> = [
  { key: 'stages', title: 'Stages', help: 'The journey in order, as represented in the Lab.' },
  { key: 'inputs', title: 'Merchant inputs', help: 'What the merchant types, picks or confirms.' },
  { key: 'uploads', title: 'Document uploads', help: 'Files the merchant must upload in the standard path.' },
  { key: 'automation', title: 'Automation', help: 'What the platform retrieves or decides without merchant input.' },
  { key: 'branches', title: 'Major branches', help: 'Where the journey splits.' },
  { key: 'verification', title: 'Verification points', help: 'Where something is proven rather than declared.' }
];

export default function ComparePage() {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'all' ? 'all' : 'madfu';
  const cols = view === 'all' ? [COLUMNS.tabby, COLUMNS.tamara, COLUMNS.current, COLUMNS.proposed] : [COLUMNS.current, COLUMNS.proposed];

  return (
    <main className="cmp" id="main">
      <header className="cmp-head">
        <div>
          <p className="home-eyebrow">Comparison mode</p>
          <h1 className="cmp-title">Compare experiences</h1>
          <p className="cmp-lede">Facts side by side: stages, inputs, uploads, automation, branches and verification. No scores and no ranking. Every item carries its evidence status.</p>
        </div>
        <div className="cmp-toggle" role="group" aria-label="Comparison view">
          <button type="button" aria-pressed={view === 'madfu'} className={view === 'madfu' ? 'is-on' : ''} onClick={() => setParams({ view: 'madfu' })}>
            Madfu Current ↔ Proposed
          </button>
          <button type="button" aria-pressed={view === 'all'} className={view === 'all' ? 'is-on' : ''} onClick={() => setParams({ view: 'all' })}>
            All four experiences
          </button>
        </div>
      </header>

      <div className="cmp-legend" aria-label="Status legend">
        <StatusBadge status="OBSERVED" /> <StatusBadge status="DOCUMENTED" /> <StatusBadge status="INFERRED" /> <StatusBadge status="UNKNOWN" /> <StatusBadge status="PROPOSED" />
      </div>

      <div className="cmp-scroll">
        <div className={`cmp-grid cols-${cols.length}`}>
          <div className="cmp-row cmp-row-head">
            <div className="cmp-rowlabel" />
            {cols.map((c) => (
              <div key={c.profile.experienceId} className={`cmp-colhead is-${c.profile.experienceId}`}>
                <div className="cmp-colmark">{c.mark}</div>
                <p className="cmp-colkind">{c.kind}</p>
                <Link to={c.to} className="cmp-open">Open experience</Link>
              </div>
            ))}
          </div>
          {SECTIONS.map((s) => (
            <section key={s.key} className="cmp-row" aria-label={s.title}>
              <div className="cmp-rowlabel">
                <h2>{s.title}</h2>
                <p>{s.help}</p>
              </div>
              {cols.map((c) => {
                const items = c.profile[s.key] as CompareItem[];
                const L = s.key === 'stages' ? 'ol' : 'ul';
                return (
                  <div key={c.profile.experienceId} className={`cmp-cell is-${c.profile.experienceId}`}>
                    <p className="cmp-count">{items.length} item{items.length === 1 ? '' : 's'}</p>
                    <L className={`cmp-list ${s.key === 'stages' ? 'is-ordered' : ''}`}>
                      {items.map((it, i) => (
                        <li key={i}>
                          <span className="cmp-item-label">{it.label}</span>
                          <span className="cmp-item-meta">
                            {it.appliesTo && it.appliesTo !== 'All' && <span className={`cmp-applies ${it.appliesTo === 'Freelancer' ? 'is-fl' : 'is-cr'}`}>{it.appliesTo === 'Freelancer' ? 'Freelancer' : 'CR'}</span>}
                            {it.status !== 'OBSERVED' && it.status !== 'PROPOSED' && <StatusBadge status={it.status} size="xs" />}
                          </span>
                          {it.note && <span className="cmp-item-note">{it.note}</span>}
                        </li>
                      ))}
                    </L>
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      </div>
      <p className="cmp-foot">Observed items carry no badge; every other status is marked. Current experiences follow private research evidence; Madfu Proposed is a product-design concept.</p>
    </main>
  );
}
