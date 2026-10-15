import { LIMITS, maskIdentifier } from '../model/config';
import { crCanContinue, runCrVerification } from '../model/state';
import { useProposed, useStepFocus } from '../store';
import { Alert, Button, KeyValue, Spinner, StepHeader, VerifyBadge } from '../ui/components';
import { IconBuilding, IconRefresh } from '../ui/icons';
import { StepNav } from './StepNav';
import { useAutoRun } from './useAutoRun';

/** CR enrichment / verification through a mock provider adapter. No real provider is called. */
export function CrVerifyStep() {
  const { state, apply } = useProposed();
  const titleRef = useStepFocus<HTMLHeadingElement>();
  const { cr, entry } = state.app;
  const [running, retry] = useAutoRun(cr.status === 'idle', runCrVerification, 1300);
  const canRetry = cr.tries <= LIMITS.providerRetries;
  const failed = cr.status === 'unavailable' || cr.status === 'error';

  return (
    <section className="mb-card" aria-labelledby="mb-step-title">
      <StepHeader eyebrow="Step 3 of 6" title="Business verification" description="We retrieve your registration details. You don't need to type them." titleRef={titleRef} />

      <div aria-live="polite" className="mb-stack">
        {(running || cr.status === 'idle') && (
          <div className="mb-progress-line"><Spinner size={16} /> Checking Commercial Registration {maskIdentifier('CR', entry.identifier)}…</div>
        )}

        {!running && cr.record && crCanContinue(state.app) && (
          <div className="mb-panel">
            <div className="mb-panel-head">
              <span className="mb-panel-icon" aria-hidden="true"><IconBuilding /></span>
              <div className="mb-panel-title">
                <strong>{cr.record.legalName}</strong>
                <span className="mb-muted mb-small">CR {entry.identifier}</span>
              </div>
              <VerifyBadge state={cr.status === 'valid' ? 'verified' : 'attention'}>{cr.status === 'valid' ? 'Registration verified' : 'Registration expired'}</VerifyBadge>
            </div>
            <KeyValue rows={[['Status', cr.record.status], ['Expiry date', cr.record.expiry], ['City', cr.record.city]]} />
          </div>
        )}

        {!running && cr.status === 'expired' && (
          <Alert tone="info" title="You can continue">Your registration shows as expired. Our team will review it with your application.</Alert>
        )}

        {!running && cr.status === 'not_found' && (
          <Alert tone="error" title="We couldn't find this Commercial Registration"
            action={<Button variant="secondary" size="sm" onClick={() => apply((s) => ({ ...s, app: { ...s.app, step: 'entry' } }))}>Edit CR number</Button>}>
            Check the number and try again. You can't continue with this number.
          </Alert>
        )}

        {!running && failed && (
          <Alert tone="warning"
            title={cr.status === 'unavailable' ? 'The registration service is not responding' : 'Something went wrong while checking your registration'}
            action={canRetry
              ? <Button variant="secondary" size="sm" iconLeft={<IconRefresh size={16} />} onClick={retry}>Try again</Button>
              : undefined}>
            {canRetry
              ? 'Your progress is saved. Try again in a moment.'
              : 'Your application is saved. Come back later and continue with your mobile number; nothing will be lost.'}
          </Alert>
        )}
      </div>

      <StepNav
        onNext={() => apply((s) => ({ ...s, app: { ...s.app, step: 'persons' } }))}
        nextDisabled={running || !crCanContinue(state.app)}
      />
    </section>
  );
}
