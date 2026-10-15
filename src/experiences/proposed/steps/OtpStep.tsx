import { useEffect, useState } from 'react';
import { wait } from '@/lib/timing';
import { LIMITS, maskMobile } from '../model/config';
import { resendOtp, verifyOtp } from '../model/state';
import { useProposed, useStepFocus } from '../store';
import { Actions, Alert, Button, StepHeader } from '../ui/components';
import { CodeInput } from '../ui/CodeInput';
import { IconArrowLeft, IconPhone } from '../ui/icons';

export function OtpStep() {
  const { state, apply, isStatic } = useProposed();
  const { otp, entry } = state.app;
  const [code, setCode] = useState(otp.code);
  const [verifying, setVerifying] = useState(false);
  const [now, setNow] = useState(Date.now());
  const titleRef = useStepFocus<HTMLHeadingElement>();

  useEffect(() => {
    if (isStatic) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isStatic]);
  useEffect(() => { setCode(otp.code); }, [otp.code]);

  const blocked = otp.status === 'expired' || otp.status === 'exhausted';
  const seconds = Math.max(0, Math.ceil((otp.resendAt - now) / 1000));

  const verify = async (value = code) => {
    if (value.length !== 6 || verifying || blocked) return;
    setVerifying(true);
    await wait(600);
    setVerifying(false);
    apply((s) => verifyOtp(s, value));
  };

  const error =
    otp.status === 'incorrect' ? `Incorrect code. ${otp.attemptsLeft} attempt${otp.attemptsLeft === 1 ? '' : 's'} left.`
      : otp.status === 'expired' ? 'This code has expired. Request a new code.'
        : otp.status === 'exhausted' ? `Too many incorrect attempts (${LIMITS.otpAttempts}). Request a new code to continue.`
          : null;

  return (
    <section className="mb-card mb-card-narrow" aria-labelledby="mb-step-title">
      <div className="mb-icon-tile" aria-hidden="true"><IconPhone size={22} /></div>
      <StepHeader
        title="Verify your mobile number"
        description={<>Enter the 6-digit code sent to <strong className="mb-nowrap">{maskMobile(entry.mobile)}</strong>. The code is valid for {LIMITS.otpValidityMinutes} minutes.</>}
        titleRef={titleRef}
      />
      <form className="mb-form" noValidate onSubmit={(e) => { e.preventDefault(); void verify(); }}>
        <CodeInput
          label="Verification code"
          value={code}
          invalid={!!error}
          disabled={verifying || blocked}
          describedBy={error ? 'otp-error' : undefined}
          onChange={(v) => { setCode(v); if (otp.status === 'incorrect') apply((s) => ({ ...s, app: { ...s.app, otp: { ...s.app.otp, status: 'sent' } } })); }}
          onComplete={(v) => void verify(v)}
        />
        {error && <div id="otp-error"><Alert tone={blocked ? 'warning' : 'error'}>{error}</Alert></div>}
        <Actions>
          <Button type="submit" size="lg" block loading={verifying} loadingLabel="Verifying…" disabled={code.length !== 6 || blocked}>Verify</Button>
        </Actions>
        <div className="mb-otp-links">
          {seconds > 0 && !blocked ? (
            <span className="mb-muted">Resend code in 0:{String(seconds).padStart(2, '0')}</span>
          ) : (
            <Button variant="link" onClick={() => { setCode(''); apply(resendOtp); }}>Resend code</Button>
          )}
          <Button variant="link" iconLeft={<IconArrowLeft size={16} />} onClick={() => apply((s) => ({ ...s, app: { ...s.app, step: 'entry' } }))}>
            Edit mobile number
          </Button>
        </div>
      </form>
    </section>
  );
}
