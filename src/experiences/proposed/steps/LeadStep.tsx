import { useState } from 'react';
import { wait } from '@/lib/timing';
import { formatMobile, isSaudiMobile } from '../model/config';
import { setLead, submitLead } from '../model/state';
import { useProposed, useStepFocus } from '../store';
import { Alert, Field, StepHeader, TextInput } from '../ui/components';
import { StepNav } from './StepNav';

/**
 * Lead capture for applicants who should not self-onboard (registered business outside the revenue
 * band, Freelancer without a certificate). Their Stage-1 answers are kept; no verification screens.
 */
export function LeadStep() {
  const { state, apply, previewErrors } = useProposed();
  const { lead, eligibility } = state.app;
  const titleRef = useStepFocus<HTMLHeadingElement>();
  const [errors, setErrors] = useState<{ name?: string; mobile?: string }>(previewErrors);
  const [sending, setSending] = useState(false);
  const noCert = eligibility?.reason === 'FL_CERT_REQUIRED';

  const next = async () => {
    const e: typeof errors = {};
    if (!lead.name.trim()) e.name = 'Enter your name.';
    if (!lead.mobile) e.mobile = 'Enter your mobile number.';
    else if (!isSaudiMobile(lead.mobile)) e.mobile = 'Enter a Saudi mobile number: 9 digits starting with 5.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setSending(true);
    await wait(600);
    setSending(false);
    apply(submitLead);
  };

  return (
    <section className="mb-card mb-card-narrow" aria-labelledby="mb-step-title">
      <StepHeader
        eyebrow="Know Your Business"
        title={noCert ? 'A Freelancer Certificate is needed to apply online' : 'Our team will help you get started'}
        description={noCert
          ? 'Online self-onboarding needs an active Freelancer Certificate. Leave your details and our team may contact you about the next steps.'
          : 'For your business size, our team handles onboarding with you. Leave your details and we will contact you.'}
        titleRef={titleRef}
      />
      <form className="mb-form" noValidate onSubmit={(ev) => { ev.preventDefault(); void next(); }}>
        <Field label="Your name" error={errors.name}>
          {({ id, describedBy, invalid }) => (
            <TextInput id={id} autoComplete="name" value={lead.name} aria-describedby={describedBy} invalid={invalid}
              onChange={(e) => { setErrors((x) => ({ ...x, name: undefined })); apply((s) => setLead(s, { name: e.target.value })); }} />
          )}
        </Field>
        <Field label="Mobile number" hint="We send a verification code to this number." error={errors.mobile}>
          {({ id, describedBy, invalid }) => (
            <TextInput id={id} prefix="+966" inputMode="numeric" autoComplete="tel-national" placeholder="5X XXX XXXX" value={formatMobile(lead.mobile)}
              aria-describedby={describedBy} invalid={invalid}
              onChange={(e) => { setErrors((x) => ({ ...x, mobile: undefined })); apply((s) => setLead(s, { mobile: e.target.value.replace(/\D/g, '').slice(0, 9) })); }} />
          )}
        </Field>
        <Alert tone="info">Your answers about your business are saved with your details. You don’t need to enter them again.</Alert>
        <StepNav onNext={() => void next()} loading={sending} loadingLabel="Sending code…" nextLabel="Send code" />
      </form>
    </section>
  );
}
