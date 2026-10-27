import { OUTCOME_COPY, REASON_USER_COPY, SIGNER_DONE_COPY } from '../model/copy';
import { useProposed, useStepFocus } from '../store';
import { IconAlert, IconCheck, IconInfo } from '../ui/icons';

/**
 * End pages: one message, one short sentence. An internally Not Eligible application (RECEIVED) gets
 * exactly the normal submitted page — no reason, no "not eligible". Only a paused CR (a controlled
 * state the merchant can fix) carries its own message. No activation claim.
 */
export function OutcomeStep() {
  const { state } = useProposed();
  const titleRef = useStepFocus<HTMLHeadingElement>();
  const { app } = state;
  const kind = app.outcome ?? 'SUBMITTED_MANUAL';
  const signer = app.actor === 'signer' && kind === 'SUBMITTED';
  const copy = signer ? { ...SIGNER_DONE_COPY, tone: 'success' as const } : OUTCOME_COPY[kind];
  const reason = kind === 'PAUSED_CR' && app.outcomeReason ? REASON_USER_COPY[app.outcomeReason] : undefined;
  const title = reason?.title ?? copy.title;
  const body = reason?.text ?? copy.body;

  return (
    <section className="mb-card mb-card-narrow mb-end" aria-labelledby="mb-step-title">
      <div className={`mb-end-mark is-${copy.tone}`} aria-hidden="true">
        {copy.tone === 'success' ? <IconCheck size={26} /> : copy.tone === 'warning' ? <IconAlert size={26} /> : <IconInfo size={26} />}
      </div>
      <h1 className="mb-title" ref={titleRef} tabIndex={-1}>{title}</h1>
      <p className="mb-description">{body}</p>
      {app.id && <p className="mb-small mb-muted mb-ref-line">Application reference <span className="mb-mono">{app.id}</span></p>}
    </section>
  );
}
