import { useState } from 'react';
import { wait } from '@/lib/timing';
import { HANDOFF_RULES, formatMobile, isSaudiMobile } from '../model/config';
import { eligiblePersons } from '../model/mock';
import { authorizeSelf, canStartHandoff, chooseAuthMode, createHandoff, openDelegation, selectPerson } from '../model/state';
import { useProposed, useStepFocus } from '../store';
import { Alert, Button, ChoiceGroup, Field, StepHeader, TextInput } from '../ui/components';
import { IconCheck, IconPerson, IconShield } from '../ui/icons';
import { PersonRow } from './CrStep';
import { stageEyebrow } from './shared';
import { StepNav } from './StepNav';

/**
 * Registered business, after Review: who authorizes and signs. A. the preparer (an owner / manager on
 * the CR) continues to Nafath and the contract; B. "Send to another signer" — one owner / manager on the
 * CR and their primary Nafath mobile. Sending freezes the application and the offer.
 * The preparer is never asked to pick an owner / manager earlier in the journey.
 */
export function AuthorizeStep() {
  const { state, apply } = useProposed();
  const titleRef = useStepFocus<HTMLHeadingElement>();
  const { app } = state;
  const { mode, limitReached, versions } = app.authorization;
  const owners = eligiblePersons(app.persons.list);
  const [mobile, setMobile] = useState('');
  const [errors, setErrors] = useState<{ person?: string; mobile?: string }>({});
  const [busy, setBusy] = useState(false);
  const handoffAllowed = canStartHandoff(app);
  const selected = app.persons.selectedId;

  const send = async () => {
    const e: typeof errors = {};
    if (!selected) e.person = 'Choose the owner or manager who will sign.';
    if (!mobile) e.mobile = 'Enter the signer’s mobile number.';
    else if (!isSaudiMobile(mobile)) e.mobile = 'Enter a Saudi mobile number: 9 digits starting with 5.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    await wait(700);
    setBusy(false);
    apply((s) => createHandoff(s, selected!, mobile));
  };

  const people = (
    <div className="mb-person-list" role="radiogroup" aria-label="Owners and managers on the CR">
      {owners.map((p) => {
        const checked = selected === p.id;
        return (
          <label key={p.id} className={`mb-person-option ${checked ? 'is-checked' : ''}`}>
            <input type="radio" name="authorizing-person" value={p.id} checked={checked} onChange={() => { setErrors((x) => ({ ...x, person: undefined })); apply((s) => selectPerson(s, p.id)); }} />
            <PersonRow person={p} />
            <span className="mb-choice-radio" aria-hidden="true">{checked && <IconCheck size={14} />}</span>
          </label>
        );
      })}
    </div>
  );

  return (
    <section className="mb-card" aria-labelledby="mb-step-title">
      <StepHeader eyebrow={stageEyebrow('authorize', app)} title="Who will authorize and sign this application?"
        description="The application must be authorized by an owner or manager registered on the CR, with Nafath." titleRef={titleRef} />

      {versions.length > 0 && <Alert tone="info" title="Your application is saved and locked">Choose how the new authorization will happen. The application details and offer stay as they were.</Alert>}

      <ChoiceGroup<'self' | 'signer'>
        legend="Authorization"
        name="auth-mode"
        value={mode}
        columns={2}
        options={[
          { value: 'self', label: 'I can complete the authorization myself', description: 'I am an owner or manager on the CR', icon: <IconShield size={20} /> },
          { value: 'signer', label: 'Send to another signer', description: 'An owner or manager on the CR signs', icon: <IconPerson size={20} /> }
        ]}
        onChange={(v) => apply((s) => chooseAuthMode(s, v))}
      />

      {mode === 'self' && (
        <fieldset className="mb-field mb-choice-group">
          <legend className="mb-label">Select yourself</legend>
          {people}
          <p className="mb-small mb-muted">Next you confirm your identity with Nafath, then sign the contract.</p>
        </fieldset>
      )}

      {mode === 'signer' && !handoffAllowed && (
        <Alert tone="warning" title="A new authorization can’t be sent right now">
          {limitReached || versions.length ? `This application already had ${HANDOFF_RULES.maxVersions} authorization requests in the last ${HANDOFF_RULES.windowDays} days. Please contact Madfu Business support — our team can help you continue.` : 'An authorization request is already in progress.'}
        </Alert>
      )}

      {mode === 'signer' && handoffAllowed && (
        <div className="mb-panel mb-stack">
          <fieldset className={`mb-field mb-choice-group ${errors.person ? 'has-error' : ''}`}>
            <legend className="mb-label">Owner or manager who will sign</legend>
            {people}
            {errors.person && <p className="mb-error" role="alert">{errors.person}</p>}
          </fieldset>
          <Field label="Signer’s mobile number" hint="Their primary mobile registered with Nafath. We send them a secure link by SMS." error={errors.mobile}>
            {({ id, describedBy, invalid }) => (
              <TextInput id={id} prefix="+966" inputMode="numeric" autoComplete="off" placeholder="5X XXX XXXX" value={formatMobile(mobile)}
                aria-describedby={describedBy} invalid={invalid} onChange={(e) => { setErrors((x) => ({ ...x, mobile: undefined })); setMobile(e.target.value.replace(/\D/g, '').slice(0, 9)); }} />
            )}
          </Field>
          <p className="mb-small mb-muted">Once sent, the application and the offer are locked so the signer reviews exactly this version. The link is valid for {HANDOFF_RULES.expiryDays} days.</p>
        </div>
      )}

      <p className="mb-small mb-muted mb-delegation-link">
        Signing under an official delegation? <Button variant="link" size="sm" onClick={() => apply(openDelegation)}>Delegated signatory</Button> <span className="mb-phase-tag">Phase 2 · demo</span>
      </p>

      <StepNav
        onNext={mode === 'self' ? () => apply(authorizeSelf) : mode === 'signer' && handoffAllowed ? () => void send() : undefined}
        nextLabel={mode === 'self' ? 'Continue to Nafath' : 'Send Authorization'}
        nextDisabled={mode === 'self' && !selected}
        loading={busy}
        loadingLabel="Sending…"
      />
    </section>
  );
}
