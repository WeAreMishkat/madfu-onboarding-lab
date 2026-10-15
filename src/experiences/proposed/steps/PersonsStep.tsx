import { LIMITS } from '../model/config';
import { eligiblePersons, maskedName } from '../model/mock';
import { continueWithoutPerson, loadPersons, nafathRemaining, selectPerson, startNafath } from '../model/state';
import type { Person } from '../model/types';
import { useProposed, useStepFocus } from '../store';
import { Alert, Button, Spinner, StepHeader } from '../ui/components';
import { IconCheck, IconRefresh } from '../ui/icons';
import { StepNav } from './StepNav';
import { useAutoRun } from './useAutoRun';

export function PersonRow({ person }: { person: Person }) {
  const initials = (person.name[0][0] + person.name[3][0]).toUpperCase();
  return (
    <span className="mb-person">
      <span className="mb-avatar" aria-hidden="true">{initials}</span>
      <span className="mb-person-text">
        <span className="mb-person-name">{maskedName(person)}</span>
        <span className="mb-person-id">National ID {person.idMasked}</span>
      </span>
    </span>
  );
}

/** Only eligible INDIVIDUALS are offered: companies cannot verify with Nafath. Single selection. */
export function PersonsStep() {
  const { state, apply } = useProposed();
  const titleRef = useStepFocus<HTMLHeadingElement>();
  const { persons, nafath } = state.app;
  const [running, retry] = useAutoRun(persons.status === 'idle', loadPersons, 1100);
  const list = eligiblePersons(persons.list);
  const canRetry = persons.tries <= LIMITS.providerRetries;
  const remaining = nafathRemaining(state.app);

  return (
    <section className="mb-card" aria-labelledby="mb-step-title">
      <StepHeader eyebrow="Step 3 of 6" title="Who is authorised for this business?"
        description="Choose yourself from the people on the Commercial Registration. You'll confirm your identity with Nafath next." titleRef={titleRef} />

      <div aria-live="polite" className="mb-stack">
        {(running || persons.status === 'idle') && <div className="mb-progress-line"><Spinner size={16} /> Retrieving the people on the registration…</div>}

        {!running && persons.status === 'loaded' && (
          <fieldset className="mb-field mb-choice-group">
            <legend className="mb-label">People on the registration</legend>
            <div className="mb-person-list" role="radiogroup">
              {list.map((p) => {
                const checked = persons.selectedId === p.id;
                return (
                  <label key={p.id} className={`mb-person-option ${checked ? 'is-checked' : ''}`}>
                    <input type="radio" name="authorised-person" value={p.id} checked={checked} onChange={() => apply((s) => selectPerson(s, p.id))} />
                    <PersonRow person={p} />
                    <span className="mb-choice-radio" aria-hidden="true">{checked && <IconCheck size={14} />}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        {!running && persons.status === 'loaded' && nafath.failures > 0 && remaining > 0 && (
          <p className="mb-small mb-muted">{remaining} Nafath attempt{remaining === 1 ? '' : 's'} left for this application. Changing the person does not reset it.</p>
        )}

        {!running && persons.status === 'none' && (
          <Alert tone="info" title="No eligible person is listed on this registration"
            action={<Button variant="secondary" size="sm" onClick={() => apply(continueWithoutPerson)}>Continue to business details</Button>}>
            Our team will verify who is authorised. You can still complete your business details now.
          </Alert>
        )}

        {!running && persons.status === 'unavailable' && (
          <Alert tone="warning" title="We couldn't retrieve the people on the registration"
            action={canRetry
              ? <Button variant="secondary" size="sm" iconLeft={<IconRefresh size={16} />} onClick={retry}>Try again</Button>
              : <Button variant="secondary" size="sm" onClick={() => apply(continueWithoutPerson)}>Continue; verify later</Button>}>
            {canRetry ? 'Your progress is saved. Try again in a moment.' : 'You can continue; our team will verify who is authorised.'}
          </Alert>
        )}
      </div>

      <StepNav
        onNext={() => apply(startNafath)}
        nextLabel="Continue to Nafath"
        nextDisabled={running || persons.status !== 'loaded' || !persons.selectedId || remaining === 0}
      />
    </section>
  );
}
