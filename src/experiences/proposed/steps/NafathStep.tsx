import { useEffect, useState } from 'react';
import { demoMs } from '@/lib/timing';
import { LIMITS, maskIdentifier } from '../model/config';
import { eligiblePersons } from '../model/mock';
import { continueAfterNafath, nafathRemaining, nafathResult, nextNafathAnswer, startNafath } from '../model/state';
import { useProposed, useStepFocus } from '../store';
import { Actions, Alert, Button, Spinner, StepHeader, VerifyBadge } from '../ui/components';
import { IconShield } from '../ui/icons';
import { PersonRow } from './PersonsStep';
import { StepNav } from './StepNav';

const WINDOW = 120;
export const NAFATH_RESPONSE_MS = 3200;

const FAIL_COPY = {
  rejected: { title: 'The request was rejected in Nafath', body: 'The request was declined in the Nafath app.' },
  timeout: { title: 'The request expired', body: 'It was not approved in time.' },
  technical: { title: 'Nafath could not be reached', body: 'This did not use one of your attempts.' }
} as const;

/**
 * Nafath verifies identity and authority. It is NOT the contract. Two attempts per application;
 * for a registered business the counter is shared across the people on the registration.
 */
export function NafathStep() {
  const { state, apply, isStatic } = useProposed();
  const titleRef = useStepFocus<HTMLHeadingElement>();
  const { app } = state;
  const { nafath } = app;
  const fl = app.entry.type === 'FL';
  const person = eligiblePersons(app.persons.list).find((p) => p.id === app.persons.selectedId);
  const remaining = nafathRemaining(app);
  const [seconds, setSeconds] = useState(WINDOW);

  // Simulated response from the Nafath app; the Prototype Controls can also answer.
  useEffect(() => {
    if (isStatic || nafath.status !== 'waiting') return;
    setSeconds(WINDOW);
    const tick = setInterval(() => setSeconds((x) => Math.max(0, x - 1)), 1000);
    const t = setTimeout(() => apply((s) => (s.app.nafath.status === 'waiting' ? nafathResult(s, nextNafathAnswer(s)) : s)), demoMs(NAFATH_RESPONSE_MS));
    return () => { clearInterval(tick); clearTimeout(t); };
  }, [nafath.status, nafath.requests, isStatic, apply]);

  const identity = fl
    ? <span className="mb-person"><span className="mb-avatar" aria-hidden="true">ID</span><span className="mb-person-text"><span className="mb-person-name">National ID {maskIdentifier('FL', app.entry.identifier)}</span><span className="mb-person-id">From your application</span></span></span>
    : person ? <PersonRow person={person} /> : null;

  return (
    <section className="mb-card" aria-labelledby="mb-step-title">
      <StepHeader eyebrow="Step 3 of 6" title="Verify with Nafath"
        description={fl ? 'Confirm your identity in the Nafath app.' : 'The selected person confirms their identity and authority in the Nafath app.'} titleRef={titleRef} />

      <div className="mb-nafath-identity">
        {identity}
        {nafath.status === 'verified' && <VerifyBadge state="verified">Verified with Nafath</VerifyBadge>}
        {nafath.status !== 'verified' && nafath.status !== 'waiting' && nafath.status !== 'exhausted' && (
          <span className="mb-small mb-muted">{remaining} of {LIMITS.nafathAttempts} attempts left</span>
        )}
      </div>

      {nafath.status === 'idle' && (
        <>
          <ol className="mb-steps-list">
            <li>Open Nafath.</li>
            <li>Approve the Madfu request.</li>
            <li>Select the matching number.</li>
            <li>Complete verification.</li>
          </ol>
          <Actions><Button size="lg" block iconLeft={<IconShield size={18} />} onClick={() => apply(startNafath)}>Send Nafath request</Button></Actions>
        </>
      )}

      {nafath.status === 'waiting' && (
        <div className="mb-nafath-wait" aria-live="polite">
          <div className="mb-nafath-number">
            <span className="mb-nafath-number-label">Select this number in Nafath</span>
            <span className="mb-nafath-number-value" aria-label={`Nafath number ${nafath.number}`}>{nafath.number}</span>
          </div>
          <ol className="mb-steps-list">
            <li>Open Nafath.</li>
            <li>Approve the Madfu request.</li>
            <li>Select <strong>{nafath.number}</strong>.</li>
            <li>Complete verification.</li>
          </ol>
          <div className="mb-waiting"><Spinner size={18} /><span>Waiting for approval · {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span></div>
        </div>
      )}

      {nafath.status === 'verified' && (
        <Alert tone="success" title="Identity verified">{fl ? 'Next, choose your freelance certificate.' : 'Next, your business details.'}</Alert>
      )}

      {nafath.status === 'failed' && nafath.lastResult && nafath.lastResult !== 'verified' && (
        <>
          <Alert tone={nafath.lastResult === 'technical' ? 'warning' : 'error'} title={FAIL_COPY[nafath.lastResult].title}>
            {FAIL_COPY[nafath.lastResult].body} {remaining} attempt{remaining === 1 ? '' : 's'} left.
          </Alert>
          <Actions split={!fl}>
            {!fl && <Button variant="secondary" onClick={() => apply((s) => ({ ...s, app: { ...s.app, step: 'persons', nafath: { ...s.app.nafath, status: 'idle' } } }))}>Choose another person</Button>}
            <Button block={fl} iconLeft={<IconShield size={18} />} onClick={() => apply(startNafath)}>{fl || !person ? 'Try again' : `Try again with ${person.name[0]}`}</Button>
          </Actions>
        </>
      )}

      {nafath.status === 'exhausted' && (
        <Alert tone="warning" title="Nafath verification was not completed">
          {fl
            ? 'We will verify your identity manually. Next, enter your freelance certificate number. The agreement will not be available in this application.'
            : 'We will verify the authorised person manually. You can still complete your business details. The agreement will not be available in this application.'}
        </Alert>
      )}

      <StepNav
        onNext={nafath.status === 'verified' || nafath.status === 'exhausted' ? () => apply(continueAfterNafath) : undefined}
        nextLabel="Continue"
      />
    </section>
  );
}
