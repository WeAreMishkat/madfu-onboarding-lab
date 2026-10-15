import { useState } from 'react';
import { wait } from '@/lib/timing';
import { REVENUE_OPTIONS, formatMobile, isSaudiMobile, isStructuralCr, isStructuralNationalId } from '../model/config';
import { submitEntry } from '../model/state';
import type { ApplicantType, Revenue } from '../model/types';
import { useProposed, useStepFocus } from '../store';
import { ChoiceGroup, Field, StepHeader, TextInput } from '../ui/components';
import { IconBuilding, IconPerson } from '../ui/icons';
import { StepNav } from './StepNav';

type Errors = Partial<Record<'type' | 'identifier' | 'revenue' | 'mobile', string>>;

/** One shared entry page for both applicant types. Validation here is structural only. */
export function EntryStep() {
  const { state, apply } = useProposed();
  const { type, identifier, revenue, mobile } = state.app.entry;
  const { previewErrors } = useProposed();
  const [errors, setErrors] = useState<Errors>(previewErrors as Errors);
  const [checking, setChecking] = useState(false);
  const titleRef = useStepFocus<HTMLHeadingElement>();

  const set = (patch: Partial<typeof state.app.entry>) => {
    apply((s) => ({ ...s, app: { ...s.app, entry: { ...s.app.entry, ...patch } } }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k as keyof Errors];
      return next;
    });
  };

  const validate = (): Errors => {
    const e: Errors = {};
    if (!type) e.type = 'Choose an applicant type.';
    if (!identifier) e.identifier = type === 'FL' ? 'Enter your National ID number.' : 'Enter your Commercial Registration number.';
    else if (type === 'CR' && !isStructuralCr(identifier)) e.identifier = 'Enter a 10-digit Commercial Registration number that starts with 7.';
    else if (type === 'FL' && !isStructuralNationalId(identifier)) e.identifier = 'Enter a 10-digit National ID number that starts with 1.';
    if (!revenue) e.revenue = 'Select your annual revenue.';
    if (!mobile) e.mobile = 'Enter your mobile number.';
    else if (!isSaudiMobile(mobile)) e.mobile = 'Enter a Saudi mobile number: 9 digits starting with 5.';
    return e;
  };

  const next = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setChecking(true);
    await wait(800);
    setChecking(false);
    apply(submitEntry);
  };

  return (
    <section className="mb-card" aria-labelledby="mb-step-title">
      <StepHeader
        eyebrow="New application"
        title="Start your Madfu application"
        description="Tell us who is applying. We check where you fit before asking for anything else."
        titleRef={titleRef}
      />
      <form className="mb-form" noValidate onSubmit={(ev) => { ev.preventDefault(); void next(); }}>
        <ChoiceGroup<ApplicantType>
          legend="Applicant type"
          name="applicant-type"
          value={type}
          options={[
            { value: 'CR', label: 'Registered Business', description: 'Company or establishment with a Commercial Registration', icon: <IconBuilding /> },
            { value: 'FL', label: 'Freelancer', description: 'Individual working under a freelance certificate', icon: <IconPerson /> }
          ]}
          onChange={(v) => set({ type: v, identifier: v === type ? identifier : '' })}
          error={errors.type}
        />

        <Field
          label={type === 'FL' ? 'National ID Number' : 'Commercial Registration Number'}
          hint={type === 'FL' ? '10 digits, starts with 1.' : type === 'CR' ? '10 digits, starts with 7.' : 'Choose an applicant type first.'}
          error={errors.identifier}
        >
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              inputMode="numeric"
              autoComplete="off"
              placeholder={type === 'FL' ? '1XXXXXXXXX' : type === 'CR' ? '7XXXXXXXXX' : ''}
              value={identifier}
              disabled={!type}
              maxLength={10}
              aria-describedby={describedBy}
              invalid={invalid}
              onChange={(e) => set({ identifier: e.target.value.replace(/\D/g, '') })}
            />
          )}
        </Field>

        <ChoiceGroup<Revenue>
          legend="Annual revenue"
          name="revenue"
          value={revenue}
          columns={3}
          compact
          options={REVENUE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          onChange={(v) => set({ revenue: v })}
          error={errors.revenue}
        />

        <Field label="Mobile number" hint="We send a verification code to this number." error={errors.mobile}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              prefix="+966"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="5X XXX XXXX"
              value={formatMobile(mobile)}
              aria-describedby={describedBy}
              invalid={invalid}
              onChange={(e) => set({ mobile: e.target.value.replace(/\D/g, '').slice(0, 9) })}
            />
          )}
        </Field>

        <StepNav onNext={() => void next()} loading={checking} loadingLabel="Checking…" />
      </form>
    </section>
  );
}
