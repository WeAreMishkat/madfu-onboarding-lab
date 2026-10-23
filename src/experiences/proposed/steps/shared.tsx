import { STAGES, kindLabel, revenueLabel, stageOf } from '../model/config';
import { subLabel } from '../model/eligibility';
import { startEdit } from '../model/state';
import type { Application, StepId } from '../model/types';
import { useProposed } from '../store';
import { Button } from '../ui/components';
import { IconPen } from '../ui/icons';

/** "Stage 3 of 8 · Business Verification": the same stage list as the boards. */
export const stageEyebrow = (step: StepId) => {
  const s = stageOf(step);
  return `Stage ${s.n} of ${STAGES.length} · ${s.label}`;
};

export const CHANNEL_LABEL = { online: 'Online', offline: 'Offline', both: 'Online and offline' } as const;

/** Stage-1 answers, shown (never asked again) with an Edit link back to Know Your Business. */
export function KybSummary({ app, returnTo, compact }: { app: Application; returnTo: StepId; compact?: boolean }) {
  const { apply } = useProposed();
  const k = app.kyb;
  return (
    <div className={`mb-kyb-summary ${compact ? 'is-compact' : ''}`}>
      <div className="mb-kyb-summary-head">
        <span className="mb-small mb-muted">From your answers in Know Your Business</span>
        <Button variant="link" size="sm" iconLeft={<IconPen size={14} />} onClick={() => apply((s) => startEdit(s, 'kyb', returnTo))} aria-label="Edit Know Your Business">Edit</Button>
      </div>
      <dl className="mb-kv is-tight">
        {!compact && <div className="mb-kv-row"><dt>Applicant type</dt><dd>{kindLabel(k.kind)}</dd></div>}
        <div className="mb-kv-row"><dt>Category</dt><dd>{subLabel(k.sub)}</dd></div>
        {!compact && <div className="mb-kv-row"><dt>Annual revenue</dt><dd>{revenueLabel(k.revenue)}</dd></div>}
        <div className="mb-kv-row"><dt>Sales channel</dt><dd>{k.channel ? CHANNEL_LABEL[k.channel] : ''}</dd></div>
        {(k.channel === 'online' || k.channel === 'both') && <div className="mb-kv-row"><dt>Website</dt><dd className="mb-break">{k.websiteUrl}</dd></div>}
        {(k.channel === 'offline' || k.channel === 'both') && <div className="mb-kv-row"><dt>Google Maps</dt><dd className="mb-break">{k.mapsUrl}</dd></div>}
      </dl>
    </div>
  );
}
