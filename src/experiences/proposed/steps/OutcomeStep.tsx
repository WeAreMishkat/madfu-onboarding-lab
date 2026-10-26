import { OUTCOME_COPY, REASON_USER_COPY } from '../model/copy';
import { useProposed, useStepFocus } from '../store';
import { IconAlert, IconCheck, IconInfo } from '../ui/icons';

/**
 * End pages: one message, one short sentence. Blocked and paused outcomes carry the PERSONALISED
 * reason of the rule that applied (never internal scoring). No activation claim.
 */
export function OutcomeStep() {
  const { state } = useProposed();
  const titleRef = useStepFocus<HTMLHeadingElement>();
  const { app } = state;
  const kind = app.outcome ?? 'SUBMITTED_MANUAL';
  const copy = OUTCOME_COPY[kind];
  const reason = app.outcomeReason ? REASON_USER_COPY[app.outcomeReason] : undefined;
  const personal = kind === 'BLOCKED' || kind === 'PAUSED_CR' || kind === 'FL_CERT_REQUIRED';
  const title = kind === 'PAUSED_CR' && reason?.title ? reason.title : copy.title;
  const submitted = kind === 'SUBMITTED' || kind === 'SUBMITTED_MANUAL';

  return (
    <section className="mb-card mb-card-narrow mb-end" aria-labelledby="mb-step-title">
      <div className={`mb-end-mark is-${copy.tone}`} aria-hidden="true">
        {copy.tone === 'success' ? <IconCheck size={26} /> : copy.tone === 'warning' ? <IconAlert size={26} /> : <IconInfo size={26} />}
      </div>
      <h1 className="mb-title" ref={titleRef} tabIndex={-1}>{title}</h1>
      {personal && reason && <p className="mb-description">{reason.text}</p>}
      {!(kind === 'PAUSED_CR' && reason) && <p className="mb-description">{copy.body}</p>}
      {(submitted || kind === 'PAUSED_CR') && app.id && <p className="mb-small mb-muted mb-ref-line">Application reference <span className="mb-mono">{app.id}</span></p>}
    </section>
  );
}
