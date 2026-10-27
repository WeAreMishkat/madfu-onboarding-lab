import { useState } from 'react';
import { wait } from '@/lib/timing';
import { PREREQUISITE_QUESTION, formatMobile, isSaudiMobile, isStructuralCr, isStructuralNationalId } from '../model/config';
import { asksPrerequisite, capturesNotEligible, setIdentity, submitIdentify } from '../model/state';
import { useProposed, useStepFocus } from '../store';
import { Alert, ChoiceGroup, Field, StepHeader, TextInput, VerifyBadge } from '../ui/components';
import { stageEyebrow } from './shared';
import { StepNav } from './StepNav';

type Errors = Partial<Record<'identifier' | 'mobile' | 'prerequisite', string>>;

/**
 * Page 2 — identifier and mobile (+ the IBAN-linkage question for an eligible Freelancer). Everyone
 * reaches this page; an internally Not Eligible applicant sees a neutral version (no "eligible"
 * message, no question) and is never told the result. A registered business is not asked whether the
 * applicant is an owner or manager: authorization is chosen after Review. Validation is structural. On
 * submit the backend checks its OWN records first (no provider): an existing application or account
 * gets the code on its stored mobile, never on the number typed here.
 */
export function IdentifyStep() {
  const { state, apply, previewErrors } = useProposed();
  const { identity, kyb, throttled } = state.app;
  const cr = kyb.kind === 'CR';
  const asks = asksPrerequisite(state.app);
  const capture = capturesNotEligible(state.app);
  const [errors, setErrors] = useState<Errors>(previewErrors as Errors);
  const [checking, setChecking] = useState(false);
  const titleRef = useStepFocus<HTMLHeadingElement>();

  const set = (patch: Partial<typeof identity>) => {
    apply((s) => setIdentity(s, patch));
    setErrors((e) => { const n = { ...e }; Object.keys(patch).forEach((k) => delete n[k as keyof Errors]); return n; });
  };

  const next = async () => {
    const e: Errors = {};
    if (!identity.identifier) e.identifier = cr ? 'Enter your Commercial Registration (Unified) number.' : 'Enter your National ID number.';
    else if (cr && !isStructuralCr(identity.identifier)) e.identifier = 'Enter a 10-digit Unified Number that starts with 7.';
    else if (!cr && !isStructuralNationalId(identity.identifier)) e.identifier = 'Enter a 10-digit National ID number that starts with 1.';
    if (!identity.mobile) e.mobile = 'Enter your mobile number.';
    else if (!isSaudiMobile(identity.mobile)) e.mobile = 'Enter a Saudi mobile number: 9 digits starting with 5.';
    if (asks && !identity.prerequisite) e.prerequisite = 'Choose Yes or No.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setChecking(true);
    await wait(600);
    setChecking(false);
    apply(submitIdentify);
  };

  const title = capture ? 'Continue your application' : 'Good news: you can apply online';
  const description = capture
    ? `Enter your ${cr ? 'Commercial Registration' : 'National ID'} and mobile number. We verify the number with a code.`
    : cr ? 'Enter your Commercial Registration and your mobile number.' : 'Enter your National ID and your mobile number.';

  return (
    <section className="mb-card mb-card-narrow" aria-labelledby="mb-step-title">
      <StepHeader eyebrow={stageEyebrow('identify', state.app)} title={title} description={description} titleRef={titleRef} />
      {!capture && <div className="mb-eligible-chip"><VerifyBadge state="verified">Eligible for online onboarding</VerifyBadge></div>}
      <form className="mb-form" noValidate onSubmit={(ev) => { ev.preventDefault(); void next(); }}>
        <Field label={cr ? 'Commercial Registration (Unified Number)' : 'National ID Number'} hint={cr ? '10 digits, starts with 7.' : '10 digits, starts with 1.'} error={errors.identifier}>
          {({ id, describedBy, invalid }) => (
            <TextInput id={id} inputMode="numeric" autoComplete="off" placeholder={cr ? '7XXXXXXXXX' : '1XXXXXXXXX'} value={identity.identifier} maxLength={10}
              aria-describedby={describedBy} invalid={invalid} onChange={(e) => set({ identifier: e.target.value.replace(/\D/g, '') })} />
          )}
        </Field>
        <Field label="Mobile number" hint="We send a verification code to this number." error={errors.mobile}>
          {({ id, describedBy, invalid }) => (
            <TextInput id={id} prefix="+966" inputMode="numeric" autoComplete="tel-national" placeholder="5X XXX XXXX" value={formatMobile(identity.mobile)}
              aria-describedby={describedBy} invalid={invalid} onChange={(e) => set({ mobile: e.target.value.replace(/\D/g, '').slice(0, 9) })} />
          )}
        </Field>
        {asks && (
          <ChoiceGroup<'yes' | 'no'>
            legend={PREREQUISITE_QUESTION.FL_CERT!}
            name="prerequisite"
            value={identity.prerequisite}
            columns={2}
            compact
            hint="The bank account used for payouts must be linked to your Freelancer Certificate."
            options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]}
            onChange={(v) => set({ prerequisite: v })}
            error={errors.prerequisite}
          />
        )}
        {throttled && (
          <Alert tone="warning" title="Too many requests">For your security, please wait a few minutes and try again. We may ask you to confirm you are not a robot.</Alert>
        )}
        <StepNav onNext={() => void next()} loading={checking} loadingLabel="Checking…" nextLabel="Send code" nextDisabled={throttled && state.sim.rateLimited} />
      </form>
    </section>
  );
}
