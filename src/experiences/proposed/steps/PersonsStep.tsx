import { LIMITS, maskIdentifier } from '../model/config';
import { ROLE_LABEL, eligiblePersons, maskedName } from '../model/mock';
import { continueToNafath, runBusinessVerification, selectPerson, stepLocked } from '../model/state';
import type { Person } from '../model/types';
import { useProposed, useStepFocus } from '../store';
import { Alert, Button, Spinner, StepHeader, VerifyBadge } from '../ui/components';
import { IconBuilding, IconCheck, IconRefresh } from '../ui/icons';
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
 * Registered business — Business verification. CR data (status, age, activities, National Address)
 * and the owners / managers are retrieved in the backend; there is no separate CR confirmation page.
 * The merchant acts only here: choose the owner / manager who will verify with Nafath.
 */
export function PersonsStep() {
  const { state, apply } = useProposed();
  const titleRef = useStepFocus<HTMLHeadingElement>();
  const { cr, persons, identity } = state.app;
  const pending = cr.status === 'idle' || (cr.status === 'loaded' && persons.status === 'idle');
  const [running, retry] = useAutoRun(pending, runBusinessVerification, 1300);
  const list = eligiblePersons(persons.list);
  const unavailable = cr.status === 'unavailable' || persons.status === 'unavailable';
  const tries = cr.status === 'unavailable' ? cr.tries : persons.tries;
  const canRetry = tries <= LIMITS.providerRetries;
  const locked = stepLocked(state.app, 'persons');

  return (
    <section className="mb-card" aria-labelledby="mb-step-title">
      <StepHeader eyebrow={stageEyebrow('persons')} title="Who is applying for this business?"
        description="We retrieve your registration from government records — nothing to type. Choose yourself from the owners and managers on the CR; you'll confirm with Nafath next." titleRef={titleRef} />

      <div aria-live="polite" className="mb-stack">
        {(running || pending) && !unavailable && (
          <div className="mb-progress-line"><Spinner size={16} /> Checking Commercial Registration {maskIdentifier(identity.identifier)}…</div>
        )}

        {!running && cr.record && persons.status === 'loaded' && (
          <div className="mb-business-line"><IconBuilding size={18} /> <strong>{cr.record.legalName}</strong> <span className="mb-muted mb-small">CR {maskIdentifier(identity.identifier)}</span> <VerifyBadge state="verified">Registration retrieved</VerifyBadge></div>
        )}

        {!running && persons.status === 'loaded' && (
          <fieldset className="mb-field mb-choice-group">
            <legend className="mb-label">Owners and managers on the registration</legend>
            <div className="mb-person-list" role="radiogroup">
              {list.map((p) => {
                const checked = persons.selectedId === p.id;
                return (
                  <label key={p.id} className={`mb-person-option ${checked ? 'is-checked' : ''} ${locked && !checked ? 'is-disabled' : ''}`}>
                    <input type="radio" name="authorised-person" value={p.id} checked={checked} disabled={locked} onChange={() => apply((s) => selectPerson(s, p.id))} />
                    <PersonRow person={p} />
                    <span className="mb-choice-radio" aria-hidden="true">{checked && <IconCheck size={14} />}</span>
                  </label>
                );
              })}
            </div>
            <p className="mb-small mb-muted">Only owners and managers can apply online. Applying on someone else’s behalf is not available yet.</p>
          </fieldset>
        )}

        {!running && unavailable && (
          <Alert tone="warning" title="We couldn’t reach the government registry"
            action={canRetry ? <Button variant="secondary" size="sm" iconLeft={<IconRefresh size={16} />} onClick={retry}>Try again</Button> : undefined}>
            {canRetry ? 'Your progress is saved. Try again in a moment.' : 'Your application is saved. Use Save & exit: we will send you a link to continue later.'}
          </Alert>
        )}
      </div>

      <StepNav onNext={() => apply(continueToNafath)} nextLabel="Continue to Nafath" nextDisabled={running || persons.status !== 'loaded' || !persons.selectedId} />
    </section>
  );
}
