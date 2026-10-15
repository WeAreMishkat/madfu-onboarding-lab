import { KIND_LABEL, type EvidenceRef, type EvidenceStatus } from './evidence';
import { StatusBadge } from './StatusBadge';

interface Props {
  title: string;
  status: EvidenceStatus;
  statusNote?: string;
  items: EvidenceRef[];
  onClose: () => void;
}

/** Internal "Evidence" drawer: what backs the screen on view. Never shows live data. */
export function EvidencePanel({ title, status, statusNote, items, onClose }: Props) {
  return (
    <aside className="evidence-panel" aria-label="Evidence for this screen">
      <header className="evidence-head">
        <div>
          <p className="evidence-eyebrow">Evidence · internal</p>
          <h2 className="evidence-title">{title}</h2>
        </div>
        <button type="button" className="lab-icon-btn" onClick={onClose} aria-label="Close evidence panel">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
      </header>
      <div className="evidence-status-row">
        <span className="evidence-label">Screen status</span>
        <StatusBadge status={status} />
      </div>
      {statusNote && <p className="evidence-note">{statusNote}</p>}
      {items.length === 0 ? (
        <p className="evidence-empty">No evidence record is linked to this screen.</p>
      ) : (
        <ul className="evidence-list">
          {items.map((e) => (
            <li key={e.id + e.description} className="evidence-item">
              {(e.kind === 'screenshot' || e.localOnly) && (
                <div className="evidence-placeholder" role="img" aria-label="Screenshot not published">
                  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="4" width="15" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M5 13l3.2-3.5 2.4 2.4L13 9l2 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
                  <span>Research screenshot kept private. The screen above is a reconstruction with synthetic data.</span>
                </div>
              )}
              <div className="evidence-meta">
                <code className="evidence-id">{e.id}</code>
                <span className="evidence-kind">{KIND_LABEL[e.kind]}</span>
                <StatusBadge status={e.status} size="xs" />
              </div>
              {(e.date || e.env) && <p className="evidence-when">{[e.env, e.date].filter(Boolean).join(' · ')}</p>}
              <p className="evidence-desc">{e.description}</p>
            </li>
          ))}
        </ul>
      )}
      <p className="evidence-foot">IDs refer to records in the private research repository. All values shown in this Lab are synthetic.</p>
    </aside>
  );
}
