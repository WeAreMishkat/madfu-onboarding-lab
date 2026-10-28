import { activityLabel } from '../model/activity';
import { LIMITS } from '../model/config';
import { confirmCertificate, loadCertificates, selectCertificate, stepLocked } from '../model/state';
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
 * Freelancer, right after Review and BEFORE Nafath: the certificates linked to the National ID —
 * retrieved, never uploaded (one call; no certificate → no Nafath cost). The confirmed certificate's
 * activity becomes the verified category (pricing included). Locked once Nafath is verified.
 */
export function CertificatesStep() {
  const { state, apply } = useProposed();
  const titleRef = useStepFocus<HTMLHeadingElement>();
  const { certs } = state.app;
  const [running, retry] = useAutoRun(certs.status === 'idle', loadCertificates, 900);
  const unavailable = certs.status === 'unavailable';
  const canRetry = certs.tries <= LIMITS.providerRetries;
  const locked = stepLocked(state.app, 'certificates');

  return (
    <section className="mb-card" aria-labelledby="mb-step-title">
      <StepHeader eyebrow={stageEyebrow('certificates', state.app)} title="Choose your Freelancer Certificate"
        description="These certificates are linked to your National ID. Nothing to upload: choose the one this application is for. Next, you verify your identity with Nafath." titleRef={titleRef} />

      <div aria-live="polite" className="mb-stack">
        {(running || certs.status === 'idle') && !unavailable && <div className="mb-progress-line"><Spinner size={16} /> Retrieving your Freelancer Certificates…</div>}

        {!running && certs.status === 'loaded' && (
          <fieldset className="mb-field mb-choice-group">
            <legend className="mb-label">Your certificates</legend>
            <div className="mb-person-list" role="radiogroup">
              {certs.list.map((c) => {
                const reason = unavailableReason(c);
                const checked = certs.selectedId === c.id;
                return (
                  <label key={c.id} className={`mb-person-option mb-cert ${checked ? 'is-checked' : ''} ${reason || (locked && !checked) ? 'is-disabled' : ''}`}>
                    <input type="radio" name="certificate" value={c.id} checked={checked} disabled={!!reason || locked} onChange={() => apply((s) => selectCertificate(s, c.id))} />
                    <span className="mb-cert-icon" aria-hidden="true"><IconDoc /></span>
                    <span className="mb-person-text">
                      <span className="mb-person-name mb-mono">{c.number}</span>
                      <span className="mb-person-id">{activityLabel(c.activity)}</span>
                    </span>
                    {reason ? <VerifyBadge state="neutral">{reason}</VerifyBadge> : c.issue === 'inconsistent' ? <VerifyBadge state="attention">Details to confirm</VerifyBadge> : <VerifyBadge state="verified">Active</VerifyBadge>}
                    <span className="mb-choice-radio" aria-hidden="true">{checked && <IconCheck size={14} />}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        {!running && unavailable && (
          <Alert tone="warning" title="We couldn’t retrieve your certificates"
            action={canRetry ? <Button variant="secondary" size="sm" iconLeft={<IconRefresh size={16} />} onClick={retry}>Try again</Button> : undefined}>
            {canRetry ? 'Your progress is saved. Try again in a moment.' : 'Your application is saved. Use Save & exit and continue later from the link we send you.'}
          </Alert>
        )}
      </div>

      <StepNav onNext={() => apply(confirmCertificate)} nextLabel={locked ? 'Next' : 'Continue to Nafath'} nextDisabled={running || certs.status !== 'loaded' || !certs.selectedId} />
    </section>
  );
}
