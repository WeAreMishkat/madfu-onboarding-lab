import { useEffect, useState } from 'react';
import { demoMs, wait } from '@/lib/timing';
import { LIMITS, formatMobile, isFreelancer, isSaudiMobile, maskIdentifier, maskMobile } from '../model/config';
import { eligiblePersons } from '../model/mock';
import {
  cancelMobileChange, continueAfterNafath, nafathRemaining, nafathResult, nextNafathAnswer, precheckPending, runCertificatePrecheck, sendToNafath,
  startMobileChange, submitMobileChange
} from '../model/state';
import { useProposed, useStepFocus } from '../store';
import { Actions, Alert, Button, Field, Spinner, StepHeader, TextInput, VerifyBadge } from '../ui/components';
import { IconPhone, IconShield } from '../ui/icons';
import { PersonRow } from './PersonsStep';
import { stageEyebrow } from './shared';
import { StepNav } from './StepNav';
import { useAutoRun } from './useAutoRun';

const WINDOW = 120;
export const NAFATH_RESPONSE_MS = 3200;

const FAIL_COPY = {
  rejected: { title: 'The request was rejected in Nafath', body: 'The request was declined in the Nafath app.' },
  timeout: { title: 'The request expired', body: 'It was not approved in time.' },
  technical: { title: 'Nafath could not be reached', body: 'This did not use one of your attempts.' }
} as const;

/**
 * Nafath verifies identity; it is NOT the contract. "Send to Nafath" first checks that the verified
 * mobile belongs to the verifying person's National ID. For a Freelancer, the backend has already
 * checked (silently) that a certificate exists, so no Nafath cost is spent without one.
 */
export function NafathStep() {
  const { state, apply, isStatic } = useProposed();
  const titleRef = useStepFocus<HTMLHeadingElement>();
  const { app } = state;
  const { nafath, mobileMatch } = app;
  const fl = isFreelancer(app.kyb.kind);
  const person = eligiblePersons(app.persons.list).find((p) => p.id === app.persons.selectedId);
  const remaining = nafathRemaining(app);
  const [seconds, setSeconds] = useState(WINDOW);
  const [mobile, setMobile] = useState('');
  const [mobileError, setMobileError] = useState('');
  const [sending, setSending] = useState(false);
  const pre = precheckPending(app);
  const [preparing, retryPrecheck] = useAutoRun(pre && app.certs.precheck === 'idle', runCertificatePrecheck, 1000);

  // Simulated response from the Nafath app; the Prototype Controls can also answer.
  useEffect(() => {
    if (isStatic || nafath.status !== 'waiting') return;
    setSeconds(WINDOW);
    const tick = setInterval(() => setSeconds((x) => Math.max(0, x - 1)), 1000);
    const t = setTimeout(() => apply((s) => (s.app.nafath.status === 'waiting' ? nafathResult(s, nextNafathAnswer(s)) : s)), demoMs(NAFATH_RESPONSE_MS));
    return () => { clearInterval(tick); clearTimeout(t); };
  }, [nafath.status, nafath.requests, isStatic, apply]);

  const send = async () => {
    setSending(true);
    await wait(700);
    setSending(false);
    apply(sendToNafath);
  };

  const sendCode = () => {
    if (!isSaudiMobile(mobile)) { setMobileError('Enter a Saudi mobile number: 9 digits starting with 5.'); return; }
    setMobileError('');
    apply((s) => submitMobileChange(s, mobile));
  };

  const identity = fl
    ? <span className="mb-person"><span className="mb-avatar" aria-hidden="true">ID</span><span className="mb-person-text"><span className="mb-person-name">National ID {maskIdentifier(app.identity.identifier)}</span><span className="mb-person-id">Mobile {maskMobile(app.registeredMobile)}</span></span></span>
    : person ? <PersonRow person={person} /> : null;
  const owner = fl ? 'your National ID' : 'the selected owner or manager';

  if (pre) {
    return (
      <section className="mb-card" aria-labelledby="mb-step-title">
        <StepHeader eyebrow={stageEyebrow('nafath')} title="Verify with Nafath" description="Confirm your identity in the Nafath app." titleRef={titleRef} />
        <div aria-live="polite" className="mb-stack">
          {(preparing || app.certs.precheck === 'idle') && <div className="mb-progress-line"><Spinner size={16} /> Preparing your verification…</div>}
          {!preparing && app.certs.precheck === 'unavailable' && (
            <Alert tone="warning" title="We couldn’t prepare your verification right now"
              action={app.certs.tries <= LIMITS.providerRetries ? <Button variant="secondary" size="sm" onClick={retryPrecheck}>Try again</Button> : undefined}>
              {app.certs.tries <= LIMITS.providerRetries ? 'Your progress is saved. Try again in a moment.' : 'Your application is saved. Use Save & exit and continue later from the link we send you.'}
            </Alert>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="mb-card" aria-labelledby="mb-step-title">
      <StepHeader eyebrow={stageEyebrow('nafath')} title="Verify with Nafath"
        description={fl ? 'Confirm your identity in the Nafath app.' : 'The selected owner or manager confirms their identity in the Nafath app.'} titleRef={titleRef} />

      <div className="mb-nafath-identity">
        {identity}
        {nafath.status === 'verified' && <VerifyBadge state="verified">Verified with Nafath</VerifyBadge>}
        {(nafath.status === 'idle' || nafath.status === 'failed') && mobileMatch.status !== 'blocked' && <span className="mb-small mb-muted">{remaining} of {LIMITS.nafathAttempts} attempts left</span>}
      </div>

      {mobileMatch.status === 'mismatch' && (
        <Alert tone="error" title={`The mobile number must belong to ${owner}.`}
          action={<div className="mb-btn-row">
            <Button variant="secondary" size="sm" iconLeft={<IconPhone size={16} />} onClick={() => apply(startMobileChange)}>Use another mobile number</Button>
            {!fl && <Button variant="ghost" size="sm" onClick={() => apply((s) => ({ ...s, app: { ...s.app, step: 'persons' } }))}>Choose another owner or manager</Button>}
          </div>}>
          {maskMobile(app.registeredMobile)} is not registered to {owner}. Your progress is saved.
        </Alert>
      )}

      {mobileMatch.status === 'entering' && (
        <div className="mb-panel">
          <Field label="Mobile number registered to the National ID" hint="We send a verification code to this number, then check it again." error={mobileError}>
            {({ id, describedBy, invalid }) => (
              <TextInput id={id} prefix="+966" inputMode="numeric" autoComplete="tel-national" placeholder="5X XXX XXXX" value={formatMobile(mobile)}
                aria-describedby={describedBy} invalid={invalid} onChange={(e) => { setMobileError(''); setMobile(e.target.value.replace(/\D/g, '').slice(0, 9)); }} />
            )}
          </Field>
          <div className="mb-btn-row">
            <Button onClick={sendCode}>Send code</Button>
            <Button variant="ghost" onClick={() => apply(cancelMobileChange)}>Cancel</Button>
          </div>
        </div>
      )}

      {mobileMatch.status === 'blocked' && (
        <Alert tone="warning" title="We can’t continue the verification online">
          We could not confirm that the mobile number belongs to {owner}. Your application and progress are saved; our team will contact you.
        </Alert>
      )}

      {nafath.status === 'idle' && mobileMatch.status !== 'mismatch' && mobileMatch.status !== 'entering' && mobileMatch.status !== 'blocked' && (
        <>
          <ol className="mb-steps-list">
            <li>Open Nafath.</li>
            <li>Approve the Madfu request.</li>
            <li>Select the matching number.</li>
            <li>Complete verification.</li>
          </ol>
          <Actions><Button size="lg" block iconLeft={<IconShield size={18} />} loading={sending} loadingLabel="Checking your mobile…" onClick={() => void send()}>Send to Nafath</Button></Actions>
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
        <Alert tone="success" title="Identity verified">{fl ? 'Next, choose your Freelancer Certificate.' : 'Next, your business details.'}</Alert>
      )}

      {nafath.status === 'failed' && nafath.lastResult && nafath.lastResult !== 'verified' && (
        <>
          <Alert tone={nafath.lastResult === 'technical' ? 'warning' : 'error'} title={FAIL_COPY[nafath.lastResult].title}>
            {FAIL_COPY[nafath.lastResult].body} {remaining} attempt{remaining === 1 ? '' : 's'} left.
          </Alert>
          <Actions><Button block iconLeft={<IconShield size={18} />} loading={sending} loadingLabel="Sending…" onClick={() => void send()}>Try again</Button></Actions>
        </>
      )}

      {nafath.status === 'unavailable' && (
        <Alert tone="warning" title="Nafath is not responding right now">Your progress is saved. Use Save & exit and try again later; this did not use one of your attempts.</Alert>
      )}

      {nafath.status === 'exhausted' && (
        <Alert tone="warning" title="Nafath verification was not completed">
          {fl
            ? 'We will verify your identity manually. Continue to send your application to our team.'
            : 'We will verify the owner or manager manually. You can still complete your business details. The contract will not be available in this application.'}
        </Alert>
      )}

      <StepNav onNext={nafath.status === 'verified' || nafath.status === 'exhausted' ? () => apply(continueAfterNafath) : undefined} nextLabel="Continue" />
    </section>
  );
}
