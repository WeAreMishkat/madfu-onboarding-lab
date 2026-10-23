import { useState } from 'react';
import { wait } from '@/lib/timing';
import { formatMobile, isSaudiMobile, isStructuralCr, isStructuralNationalId } from '../model/config';
import { setIdentity, submitIdentify } from '../model/state';
import { useProposed, useStepFocus } from '../store';
import { Alert, Field, StepHeader, TextInput, VerifyBadge } from '../ui/components';
import { stageEyebrow } from './shared';
import { StepNav } from './StepNav';

type Errors = Partial<Record<'identifier' | 'mobile', string>>;

/**
 * Stage 2 — Identify & Verify. Only applicants who passed Stage 1 reach this page. Validation here is
 * structural; duplicate / existing checks run in the backend and their result shows after the code.
 */
export function IdentifyStep() {
  const { state, apply, previewErrors } = useProposed();
  const { identity, kyb, returnTo, id, identityCheck } = state.app;
  const cr = kyb.kind === 'CR';
  const editing = !!id && !!returnTo;
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
    setErrors(e);
    if (Object.keys(e).length) return;
    setChecking(true);
    await wait(700);
    setChecking(false);
    apply(submitIdentify);
  };

  return (
    <section className="mb-card mb-card-narrow" aria-labelledby="mb-step-title">
      <StepHeader
        eyebrow={editing ? 'Edit' : stageEyebrow('identify')}
        title={editing ? 'Identification' : 'Good news: you can apply online'}
        description={cr ? 'Enter your Commercial Registration and the mobile number we should verify.' : 'Enter your National ID and the mobile number we should verify.'}
        titleRef={titleRef}
      />
      {!editing && state.app.eligibility && <div className="mb-eligible-chip"><VerifyBadge state="verified">Eligible for online onboarding</VerifyBadge></div>}
      <form className="mb-form" noValidate onSubmit={(ev) => { ev.preventDefault(); void next(); }}>
        <Field label={cr ? 'Commercial Registration (Unified Number)' : 'National ID Number'} hint={cr ? '10 digits, starts with 7.' : '10 digits, starts with 1.'} error={errors.identifier}>
          {({ id: fid, describedBy, invalid }) => (
            <TextInput id={fid} inputMode="numeric" autoComplete="off" placeholder={cr ? '7XXXXXXXXX' : '1XXXXXXXXX'} value={identity.identifier} maxLength={10}
              aria-describedby={describedBy} invalid={invalid} onChange={(e) => set({ identifier: e.target.value.replace(/\D/g, '') })} />
          )}
        </Field>
        <Field label="Mobile number" hint="We send a verification code to this number." error={errors.mobile}>
          {({ id: fid, describedBy, invalid }) => (
            <TextInput id={fid} prefix="+966" inputMode="numeric" autoComplete="tel-national" placeholder="5X XXX XXXX" value={formatMobile(identity.mobile)}
              aria-describedby={describedBy} invalid={invalid} onChange={(e) => set({ mobile: e.target.value.replace(/\D/g, '').slice(0, 9) })} />
          )}
        </Field>
        {editing && identityCheck && identityCheck !== 'new' && (
          <Alert tone="error" title="This number can’t be used">It already belongs to another Madfu application or account.</Alert>
        )}
        {editing && <p className="mb-small mb-muted">Changing the {cr ? 'CR' : 'National ID'} repeats the checks that depend on it. Changing the mobile needs a new code.</p>}
        <StepNav onNext={() => void next()} loading={checking} loadingLabel="Checking…" nextLabel="Send code" />
      </form>
    </section>
  );
}
