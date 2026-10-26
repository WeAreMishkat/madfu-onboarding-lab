import { useEffect, useState } from 'react';
import { wait } from '@/lib/timing';
import { LIMITS, maskLast3, maskMobile } from '../model/config';
import { editMobileFromOtp, initialApplication, resendOtp, verifyOtp } from '../model/state';
import { useProposed, useStepFocus } from '../store';
import { Actions, Alert, Button, StepHeader } from '../ui/components';
import { CodeInput } from '../ui/CodeInput';
import { IconArrowLeft, IconLock, IconPhone } from '../ui/icons';

const EXISTING_TITLE = {
  incomplete: 'An application is already in progress for this business.',
  submitted: 'An application has already been submitted for this business.',
  live: 'This business already has a Madfu account.',
  paused: 'An application is already saved for this business.'
} as const;

/**
 * SMS code for every purpose. New application → the entered mobile. Existing application or account
 * (Page 2 or Continue link) → the REGISTERED mobile, last three digits only; nothing about the
 * application is shown before the code. Mobile correction → the new mobile.
 */
export function OtpStep() {
  const { state, apply, isStatic } = useProposed();
  const { otp, existence } = state.app;
  const [code, setCode] = useState(otp.code);
  const [verifying, setVerifying] = useState(false);
  const [now, setNow] = useState(Date.now());
  const titleRef = useStepFocus<HTMLHeadingElement>();
  const registered = otp.purpose === 'registered' || otp.purpose === 'resume';

  useEffect(() => {
    if (isStatic) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isStatic]);
  useEffect(() => { setCode(otp.code); }, [otp.code]);

  const blocked = otp.status === 'expired' || otp.status === 'exhausted' || otp.status === 'locked';
  const seconds = Math.max(0, Math.ceil((otp.resendAt - now) / 1000));

  const verify = async (value = code) => {
    if (value.length !== 6 || verifying || blocked) return;
    setVerifying(true);
    await wait(500);
    setVerifying(false);
    apply((s) => verifyOtp(s, value));
  };

  const error =
    otp.status === 'incorrect' ? `Incorrect code. ${otp.attemptsLeft} attempt${otp.attemptsLeft === 1 ? '' : 's'} left.`
      : otp.status === 'invalid' ? 'Enter the 6-digit code from the SMS.'
        : otp.status === 'expired' ? 'This code has expired. Request a new code.'
          : otp.status === 'exhausted' ? `Too many incorrect attempts (${LIMITS.otpAttempts}). Request a new code to continue.`
            : otp.status === 'locked' ? (registered ? 'For your security, this application can only be opened with the code sent to its registered mobile. Please try again later or contact Madfu support.' : 'Too many attempts. For your security, please try again later.')
              : null;

  const title = otp.purpose === 'resume' ? 'Continue your application'
    : otp.purpose === 'registered' && existence && existence !== 'new' ? EXISTING_TITLE[existence]
      : otp.purpose === 'mobile-change' ? 'Verify your new mobile number' : 'Verify your mobile number';
  const sentTo = registered
    ? <>We sent a verification code to the registered mobile ending in <strong className="mb-nowrap">{maskLast3(otp.to)}</strong>.</>
    : <>Enter the 6-digit code sent to <strong className="mb-nowrap">{maskMobile(otp.to)}</strong>.</>;

  return (
    <section className="mb-card mb-card-narrow" aria-labelledby="mb-step-title">
      <div className="mb-icon-tile" aria-hidden="true">{registered ? <IconLock size={22} /> : <IconPhone size={22} />}</div>
      <StepHeader title={title} description={<>{sentTo} The code is valid for {LIMITS.otpValidityMinutes} minutes.</>} titleRef={titleRef} />
      <form className="mb-form" noValidate onSubmit={(e) => { e.preventDefault(); void verify(); }}>
        <CodeInput
          label="Verification code"
          value={code}
          invalid={!!error}
          disabled={verifying || blocked}
          describedBy={error ? 'otp-error' : undefined}
          onChange={(v) => { setCode(v); if (otp.status === 'incorrect' || otp.status === 'invalid') apply((s) => ({ ...s, app: { ...s.app, otp: { ...s.app.otp, status: 'sent' } } })); }}
          onComplete={(v) => void verify(v)}
        />
        {error && <div id="otp-error"><Alert tone={blocked ? 'warning' : 'error'}>{error}</Alert></div>}
        <Actions>
          <Button type="submit" size="lg" block loading={verifying} loadingLabel="Verifying…" disabled={code.length !== 6 || blocked}>{registered ? 'Verify and continue' : 'Verify'}</Button>
        </Actions>
        <div className="mb-otp-links">
          {otp.status === 'locked' || otp.resendsLeft <= 0 ? (
            <span className="mb-muted">No more codes can be sent now.</span>
          ) : seconds > 0 && !blocked ? (
            <span className="mb-muted">Resend code in 0:{String(seconds).padStart(2, '0')}</span>
          ) : (
            <Button variant="link" onClick={() => { setCode(''); apply(resendOtp); }}>Resend code</Button>
          )}
          {otp.purpose === 'application' || otp.purpose === 'mobile-change' ? (
            <Button variant="link" iconLeft={<IconArrowLeft size={16} />} onClick={() => apply(editMobileFromOtp)}>Edit mobile number</Button>
          ) : (
            <Button variant="link" onClick={() => apply((s) => ({ ...s, app: initialApplication() }))}>Not your number? Start again</Button>
          )}
        </div>
      </form>
    </section>
  );
}
