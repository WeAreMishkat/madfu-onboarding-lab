import { OUTCOME_COPY, REASON_USER_COPY } from '../model/copy';
import { reopenContract } from '../model/state';
import { useProposed, useStepFocus } from '../store';
import { Button } from '../ui/components';
import { IconAlert, IconCheck, IconInfo } from '../ui/icons';

/** Stage 8 — external outcome. Internal status, flags and reason codes appear only in the Prototype Controls. */
export function OutcomeStep() {
  const { state, apply } = useProposed();
  const titleRef = useStepFocus<HTMLHeadingElement>();
  const { app } = state;
  const kind = app.outcome ?? 'MANUAL_VERIFICATION';
  const copy = OUTCOME_COPY[kind];
  const reason = (kind === 'NOT_ELIGIBLE' || kind === 'TEMPORARILY_NOT_ELIGIBLE') && app.outcomeReason ? REASON_USER_COPY[app.outcomeReason] : null;
  const submitted = kind === 'SUBMITTED' || kind === 'SUBMITTED_BANKING_PENDING' || kind === 'MANUAL_VERIFICATION';
  const when = app.submittedAt ? new Date(app.submittedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <section className="mb-card mb-card-narrow mb-end" aria-labelledby="mb-step-title">
      <div className={`mb-end-mark is-${copy.tone}`} aria-hidden="true">
        {copy.tone === 'success' ? <IconCheck size={26} /> : copy.tone === 'warning' ? <IconAlert size={26} /> : <IconInfo size={26} />}
      </div>
      <h1 className="mb-title" ref={titleRef} tabIndex={-1}>{copy.title}</h1>
      {reason && <p className="mb-description">{reason}</p>}
      <p className="mb-description">{copy.body}</p>

      {submitted && (
        <>
          <ol className="mb-timeline" aria-label="Application status">
            <li className="is-done"><span className="mb-tl-dot" aria-hidden="true"><IconCheck size={12} /></span><div><strong>Submitted</strong><span>{when}</span></div></li>
            <li className="is-current" aria-current="step"><span className="mb-tl-dot" aria-hidden="true" /><div><strong>{kind === 'SUBMITTED' ? 'Under review' : kind === 'SUBMITTED_BANKING_PENDING' ? 'Banking setup with our team' : 'Verification by our team'}</strong><span>We may contact you</span></div></li>
            <li><span className="mb-tl-dot" aria-hidden="true" /><div><strong>Decision</strong><span>We will let you know</span></div></li>
            <li><span className="mb-tl-dot" aria-hidden="true" /><div><strong>Merchant account set-up</strong><span>Only after approval</span></div></li>
          </ol>
          {app.id && <dl className="mb-kv is-tight mb-ref"><div className="mb-kv-row"><dt>Application</dt><dd className="mb-mono">{app.id}</dd></div></dl>}
        </>
      )}

      {kind === 'CONTRACT_DECLINED' && (
        <div className="mb-end-actions">
          <Button variant="secondary" onClick={() => apply(reopenContract)}>Review the contract again</Button>
        </div>
      )}
    </section>
  );
}
