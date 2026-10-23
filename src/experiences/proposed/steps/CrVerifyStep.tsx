import { activityByCode } from '../model/activity';
import { LIMITS, maskIdentifier } from '../model/config';
import { subLabel } from '../model/eligibility';
import { acknowledgeActivity, activityPending, continueFromCr, crCanContinue, runCrVerification, startEdit } from '../model/state';
import { useProposed, useStepFocus } from '../store';
import { Alert, Button, KeyValue, Spinner, StepHeader, VerifyBadge } from '../ui/components';
import { IconBuilding, IconRefresh } from '../ui/icons';
import { stageEyebrow } from './shared';
import { StepNav } from './StepNav';
import { useAutoRun } from './useAutoRun';

/**
 * Stage 3 — CR data (registry, activities, National Address) retrieved once from the simulated
 * provider and reused afterwards. Government rules run in the backend; stop outcomes leave this screen.
 * The declared category is reconciled with the registered activity.
 */
export function CrVerifyStep() {
  const { state, apply } = useProposed();
  const titleRef = useStepFocus<HTMLHeadingElement>();
  const { cr, identity, activity, kyb } = state.app;
  const [running, retry] = useAutoRun(cr.status === 'idle', runCrVerification, 1300);
  const canRetry = cr.tries <= LIMITS.providerRetries;
  const pending = activityPending(state.app);

  return (
    <section className="mb-card" aria-labelledby="mb-step-title">
      <StepHeader eyebrow={stageEyebrow('cr-verify')} title="Business verification" description="We retrieve your registration details from government records. You don’t need to type them." titleRef={titleRef} />

      <div aria-live="polite" className="mb-stack">
        {(running || cr.status === 'idle') && (
          <div className="mb-progress-line"><Spinner size={16} /> Checking Commercial Registration {maskIdentifier(identity.identifier)}…</div>
        )}

        {!running && cr.record && cr.decision === 'continue' && (
          <div className="mb-panel">
            <div className="mb-panel-head">
              <span className="mb-panel-icon" aria-hidden="true"><IconBuilding /></span>
              <div className="mb-panel-title">
                <strong>{cr.record.legalName}</strong>
                <span className="mb-muted mb-small">CR {identity.identifier}</span>
              </div>
              <VerifyBadge state="verified">Registration verified</VerifyBadge>
            </div>
            <KeyValue rows={[
              ['Status', 'Active'],
              ['Legal form', cr.record.legalForm],
              ['Registered activity', activityByCode(cr.record.activity)?.label ?? cr.record.activity],
              ['City', cr.record.city],
              ['Expiry date', cr.record.expiry]
            ]} />
          </div>
        )}

        {!running && cr.decision === 'continue' && activity && pending && (
          <Alert tone="warning" title="Your registered activity doesn’t match the category you chose"
            action={<div className="mb-btn-row">
              <Button variant="secondary" size="sm" onClick={() => apply((s) => startEdit(s, 'kyb', 'cr-verify'))}>Change my category</Button>
              <Button variant="ghost" size="sm" onClick={() => apply(acknowledgeActivity)}>Continue; Madfu will confirm</Button>
            </div>}>
            You chose “{subLabel(kyb.sub)}”. Your registration lists “{activityByCode(activity.activity)?.label ?? activity.activity}”.
          </Alert>
        )}
        {!running && activity?.acknowledged && (
          <Alert tone="info" title="We will confirm your activity">You can continue. Our team will confirm your business activity before your contract is offered.</Alert>
        )}

        {!running && cr.status === 'not_found' && (
          <Alert tone="error" title="We couldn’t find this Commercial Registration"
            action={<Button variant="secondary" size="sm" onClick={() => apply((s) => startEdit(s, 'identification', 'cr-verify'))}>Edit CR number</Button>}>
            Check the number. You can’t continue with this number.
          </Alert>
        )}

        {!running && cr.status === 'unavailable' && (
          <Alert tone="warning" title="The registration service is not responding"
            action={canRetry ? <Button variant="secondary" size="sm" iconLeft={<IconRefresh size={16} />} onClick={retry}>Try again</Button> : undefined}>
            {canRetry
              ? 'Your progress is saved. Try again in a moment.'
              : 'Your application is saved. Use Save & exit: we will send you a link to continue later. Nothing will be lost.'}
          </Alert>
        )}
      </div>

      <StepNav onNext={() => apply(continueFromCr)} nextDisabled={running || !crCanContinue(state.app) || pending} />
    </section>
  );
}
