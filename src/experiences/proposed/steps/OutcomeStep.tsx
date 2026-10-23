import { OUTCOME_COPY, REASON_USER_COPY } from '../model/copy';
import { reopenContract } from '../model/state';
import { useProposed, useStepFocus } from '../store';
import { Button } from '../ui/components';
import { IconAlert, IconCheck, IconInfo } from '../ui/icons';

/**
 * Stage 8 — minimal outcome page: one message, one short sentence. No forms, no further steps, no
 * activation claim. Internal status, flags and reason codes appear only in the Internal view.
 */
export function OutcomeStep() {
  const { state, apply } = useProposed();
  const titleRef = useStepFocus<HTMLHeadingElement>();
  const { app } = state;
  const kind = app.outcome ?? 'MANUAL_VERIFICATION';
  const copy = OUTCOME_COPY[kind];
  const reason = (kind === 'NOT_ELIGIBLE' || kind === 'TEMPORARILY_NOT_ELIGIBLE') && app.outcomeReason ? REASON_USER_COPY[app.outcomeReason] : null;
  const submitted = kind === 'SUBMITTED' || kind === 'SUBMITTED_BANKING_PENDING' || kind === 'MANUAL_VERIFICATION';

  return (
    <section className="mb-card mb-card-narrow mb-end" aria-labelledby="mb-step-title">
      <div className={`mb-end-mark is-${copy.tone}`} aria-hidden="true">
        {copy.tone === 'success' ? <IconCheck size={26} /> : copy.tone === 'warning' ? <IconAlert size={26} /> : <IconInfo size={26} />}
      </div>
      <h1 className="mb-title" ref={titleRef} tabIndex={-1}>{copy.title}</h1>
      {reason && <p className="mb-description">{reason}</p>}
      <p className="mb-description">{copy.body}</p>
      {submitted && app.id && <p className="mb-small mb-muted mb-ref-line">Application reference <span className="mb-mono">{app.id}</span></p>}

      {kind === 'CONTRACT_DECLINED' && (
        <div className="mb-end-actions">
          <Button variant="secondary" onClick={() => apply(reopenContract)}>Review the agreement again</Button>
        </div>
      )}
    </section>
  );
}
