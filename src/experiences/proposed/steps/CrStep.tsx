import { activityLabel } from '../model/activity';
import { LIMITS, maskIdentifier } from '../model/config';
import { ROLE_LABEL, eligiblePersons, maskedName } from '../model/mock';
import { continueFromCr, crVerified, runBusinessVerification } from '../model/state';
import type { Person } from '../model/types';
import { useProposed, useStepFocus } from '../store';
import { Alert, Button, Spinner, StepHeader, VerifyBadge } from '../ui/components';
import { IconBuilding, IconRefresh } from '../ui/icons';
import { stageEyebrow } from './shared';
import { StepNav } from './StepNav';
import { useAutoRun } from './useAutoRun';

export function PersonRow({ person }: { person: Person }) {
  const initials = (person.name[0][0] + person.name[3][0]).toUpperCase();
  return (
    <span className="mb-person">
      <span className="mb-avatar" aria-hidden="true">{initials}</span>
      <span className="mb-person-text">
        <span className="mb-person-name">{maskedName(person)} <span className="mb-role">{ROLE_LABEL[person.role]}</span></span>
        <span className="mb-person-id">National ID {person.idMasked}</span>
      </span>
    </span>
  );
}

/**
 * Registered business — CR verification. CR data (status, age, activities, National Address) and the
 * owners / managers are retrieved in the backend and feed the risk score. The merchant only sees what
 * was retrieved and continues: who authorizes and signs is chosen after Review, not here.
 */
export function CrStep() {
  const { state, apply } = useProposed();
  const titleRef = useStepFocus<HTMLHeadingElement>();
  const { cr, persons, identity } = state.app;
  const pending = cr.status === 'idle' || (cr.status === 'loaded' && persons.status === 'idle');
  const [running, retry] = useAutoRun(pending, runBusinessVerification, 1300);
  const owners = eligiblePersons(persons.list);
  const unavailable = cr.status === 'unavailable' || persons.status === 'unavailable';
  const tries = cr.status === 'unavailable' ? cr.tries : persons.tries;
  const canRetry = tries <= LIMITS.providerRetries;
  const done = !running && crVerified(state.app) && !!cr.record;

  return (
    <section className="mb-card" aria-labelledby="mb-step-title">
      <StepHeader eyebrow={stageEyebrow('cr', state.app)} title="Your business registration"
        description="We retrieve your Commercial Registration from government records — nothing to type or upload." titleRef={titleRef} />

      <div aria-live="polite" className="mb-stack">
        {(running || pending) && !unavailable && (
          <div className="mb-progress-line"><Spinner size={16} /> Checking Commercial Registration {maskIdentifier(identity.identifier)}…</div>
        )}

        {done && (
          <>
            <div className="mb-business-line"><IconBuilding size={18} /> <strong>{cr.record!.legalName}</strong> <span className="mb-muted mb-small">CR {maskIdentifier(identity.identifier)}</span> <VerifyBadge state="verified">Registration retrieved</VerifyBadge></div>
            <dl className="mb-kv is-tight">
              <div className="mb-kv-row"><dt>Legal form</dt><dd>{cr.record!.legalForm}</dd></div>
              <div className="mb-kv-row"><dt>City</dt><dd>{cr.record!.city}</dd></div>
              <div className="mb-kv-row"><dt>Registered activities</dt><dd>{cr.record!.activities.map((a) => activityLabel(a.code)).join(' · ')}</dd></div>
              <div className="mb-kv-row"><dt>Owners and managers</dt><dd>{owners.map((p) => maskedName(p)).join(' · ')}</dd></div>
            </dl>
            <p className="mb-small mb-muted">You don’t need to be an owner or manager to prepare the application. After the review you choose who authorizes and signs it.</p>
          </>
        )}

        {!running && unavailable && (
          <Alert tone="warning" title="We couldn’t reach the government registry"
            action={canRetry ? <Button variant="secondary" size="sm" iconLeft={<IconRefresh size={16} />} onClick={retry}>Try again</Button> : undefined}>
            {canRetry ? 'Your progress is saved. Try again in a moment.' : 'Your application is saved. Use Save & exit: we will send you a link to continue later.'}
          </Alert>
        )}
      </div>

      <StepNav onNext={() => apply(continueFromCr)} nextLabel="Continue" nextDisabled={running || !done} />
    </section>
  );
}
