import { activityByCode } from '../model/activity';
import { LIMITS } from '../model/config';
import { subLabel } from '../model/eligibility';
import { acknowledgeActivity, activityPending, confirmCertificate, continueFromCertificates, loadCertificates, selectCertificate, startEdit } from '../model/state';
import type { Certificate } from '../model/types';
import { useProposed, useStepFocus } from '../store';
import { Alert, Button, Spinner, StepHeader, VerifyBadge } from '../ui/components';
import { IconCheck, IconDoc, IconRefresh } from '../ui/icons';
import { stageEyebrow } from './shared';
import { StepNav } from './StepNav';
import { useAutoRun } from './useAutoRun';

const unavailableReason = (c: Certificate) =>
  c.status === 'expired' ? 'Expired' : c.issue === 'duplicate' ? 'Already linked to another Madfu account' : null;

/**
 * Certificates are retrieved after a successful Nafath — never uploaded, typed or invented. Zero
 * documents. The certificate activity is reconciled with the declared category.
 */
export function CertificatesStep() {
  const { state, apply } = useProposed();
  const titleRef = useStepFocus<HTMLHeadingElement>();
  const { certs, activity, kyb } = state.app;
  const [running, retry] = useAutoRun(certs.status === 'idle', loadCertificates, 1100);
  const canRetry = certs.tries <= LIMITS.providerRetries;
  const pending = activityPending(state.app);
  const reconciled = !!activity && activity.source === 'CERTIFICATE' && !pending;

  return (
    <section className="mb-card" aria-labelledby="mb-step-title">
      <StepHeader eyebrow={stageEyebrow('certificates')} title="Choose your Freelancer Certificate"
        description="These certificates are linked to your verified National ID. Nothing to upload: choose the one this application is for." titleRef={titleRef} />

      <div aria-live="polite" className="mb-stack">
        {(running || certs.status === 'idle') && <div className="mb-progress-line"><Spinner size={16} /> Retrieving your Freelancer Certificates…</div>}

        {!running && certs.status === 'loaded' && (
          <fieldset className="mb-field mb-choice-group">
            <legend className="mb-label">Your certificates</legend>
            <div className="mb-person-list" role="radiogroup">
              {certs.list.map((c) => {
                const reason = unavailableReason(c);
                const checked = certs.selectedId === c.id;
                return (
                  <label key={c.id} className={`mb-person-option mb-cert ${checked ? 'is-checked' : ''} ${reason ? 'is-disabled' : ''}`}>
                    <input type="radio" name="certificate" value={c.id} checked={checked} disabled={!!reason} onChange={() => apply((s) => selectCertificate(s, c.id))} />
                    <span className="mb-cert-icon" aria-hidden="true"><IconDoc /></span>
                    <span className="mb-person-text">
                      <span className="mb-person-name mb-mono">{c.number}</span>
                      <span className="mb-person-id">{activityByCode(c.activity)?.label ?? c.activityLabel}</span>
                    </span>
                    {reason ? <VerifyBadge state="neutral">{reason}</VerifyBadge> : c.issue === 'inconsistent' ? <VerifyBadge state="attention">Details to confirm</VerifyBadge> : <VerifyBadge state="verified">Active</VerifyBadge>}
                    <span className="mb-choice-radio" aria-hidden="true">{checked && <IconCheck size={14} />}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        {!running && pending && activity && (
          <Alert tone="warning" title="This certificate’s activity doesn’t match the category you chose"
            action={<div className="mb-btn-row">
              <Button variant="secondary" size="sm" onClick={() => apply((s) => startEdit(s, 'kyb', 'certificates'))}>Change my category</Button>
              <Button variant="ghost" size="sm" onClick={() => apply(acknowledgeActivity)}>Continue; Madfu will confirm</Button>
            </div>}>
            You chose “{subLabel(kyb.sub)}”. The certificate is for “{activityByCode(activity.activity)?.label ?? activity.activity}”.
          </Alert>
        )}
        {!running && activity?.acknowledged && activity.source === 'CERTIFICATE' && (
          <Alert tone="info" title="We will confirm your activity">You can continue. Our team will confirm it before your contract is offered.</Alert>
        )}

        {!running && certs.status === 'unavailable' && (
          <Alert tone="warning" title="We couldn’t retrieve your certificates"
            action={canRetry ? <Button variant="secondary" size="sm" iconLeft={<IconRefresh size={16} />} onClick={retry}>Try again</Button> : undefined}>
            {canRetry ? 'Your progress is saved. Try again in a moment.' : 'Your application is saved. Use Save & exit and continue later from the link we send you.'}
          </Alert>
        )}
      </div>

      <StepNav
        onNext={() => apply(reconciled && state.app.certs.selectedId ? continueFromCertificates : confirmCertificate)}
        nextDisabled={running || certs.status !== 'loaded' || !certs.selectedId || pending}
      />
    </section>
  );
}
