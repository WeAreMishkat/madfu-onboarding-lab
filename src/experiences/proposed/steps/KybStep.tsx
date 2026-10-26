import { useState } from 'react';
import { wait } from '@/lib/timing';
import { KIND_OPTIONS, REVENUE_OPTIONS } from '../model/config';
import { CATEGORIES } from '../model/eligibility';
import { setKyb, submitKyb } from '../model/state';
import type { ApplicantKind, Channel, Kyb, Revenue } from '../model/types';
import { useProposed, useStepFocus } from '../store';
import { ChoiceGroup, Field, Select, StepHeader } from '../ui/components';
import { IconBoth, IconGlobe, IconStore } from '../ui/icons';
import { stageEyebrow } from './shared';
import { StepNav } from './StepNav';

type Errors = Partial<Record<'kind' | 'group' | 'sub' | 'revenue' | 'channel', string>>;

/**
 * Page 1 — Know Your Business. Five quick answers only: no identity, mobile, OTP or URL. Preliminary
 * eligibility is evaluated internally before anything is verified.
 */
export function KybStep() {
  const { state, apply, previewErrors } = useProposed();
  const k = state.app.kyb;
  const [errors, setErrors] = useState<Errors>(previewErrors as Errors);
  const [checking, setChecking] = useState(false);
  const titleRef = useStepFocus<HTMLHeadingElement>();
  const group = CATEGORIES.find((g) => g.id === k.group);

  const set = (patch: Partial<Kyb>) => {
    apply((s) => setKyb(s, patch));
    setErrors((e) => {
      const n = { ...e };
      Object.keys(patch).forEach((key) => delete n[key as keyof Errors]);
      return n;
    });
  };

  const validate = (): Errors => {
    const e: Errors = {};
    if (!k.kind) e.kind = 'Choose who is applying.';
    if (!k.group) e.group = 'Choose a business category.';
    if (!k.sub) e.sub = 'Choose a subcategory.';
    if (!k.revenue) e.revenue = 'Select your annual revenue.';
    if (!k.channel) e.channel = 'Choose how you sell.';
    return e;
  };

  const next = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setChecking(true);
    await wait(600);
    setChecking(false);
    apply(submitKyb);
  };

  return (
    <section className="mb-card" aria-labelledby="mb-step-title">
      <StepHeader
        eyebrow={stageEyebrow('kyb')}
        title="Tell us about your business"
        description="Five quick questions to check that Madfu fits your business. We ask for your Commercial Registration or National ID only if you can continue."
        titleRef={titleRef}
      />
      <form className="mb-form" noValidate onSubmit={(ev) => { ev.preventDefault(); void next(); }}>
        <Field label="Who is applying?" error={errors.kind}>
          {({ id, describedBy, invalid }) => (
            <Select id={id} placeholder="Select the applicant type" value={k.kind ?? ''} aria-describedby={describedBy} invalid={invalid}
              options={KIND_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              onChange={(ev) => set({ kind: ev.target.value as ApplicantKind })} />
          )}
        </Field>

        <div className="mb-row">
          <Field label="Business category" error={errors.group}>
            {({ id, describedBy, invalid }) => (
              <Select id={id} placeholder="Select a category" value={k.group} aria-describedby={describedBy} invalid={invalid}
                options={CATEGORIES.map((g) => ({ value: g.id, label: g.label }))}
                onChange={(ev) => set({ group: ev.target.value, sub: '' })} />
            )}
          </Field>
          <Field label="Business subcategory" error={errors.sub}>
            {({ id, describedBy, invalid }) => (
              <Select id={id} placeholder={group ? 'Select a subcategory' : 'Choose a category first'} value={k.sub} disabled={!group}
                aria-describedby={describedBy} invalid={invalid}
                options={(group?.subs ?? []).map((s) => ({ value: s.id, label: s.label }))}
                onChange={(ev) => set({ sub: ev.target.value })} />
            )}
          </Field>
        </div>

        <ChoiceGroup<Revenue>
          legend="Annual revenue"
          name="revenue"
          value={k.revenue}
          columns={3}
          compact
          options={REVENUE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          onChange={(v) => set({ revenue: v })}
          error={errors.revenue}
        />

        <ChoiceGroup<Channel>
          legend="How do you sell?"
          name="channel"
          value={k.channel}
          columns={3}
          stacked
          options={[
            { value: 'online', label: 'Online', description: 'Website or app', icon: <IconGlobe /> },
            { value: 'offline', label: 'Offline', description: 'Physical store', icon: <IconStore /> },
            { value: 'both', label: 'Both', description: 'Online and in store', icon: <IconBoth /> }
          ]}
          onChange={(v) => set({ channel: v })}
          error={errors.channel}
        />

        <StepNav onNext={() => void next()} loading={checking} loadingLabel="Checking…" nextLabel="Check eligibility" />
      </form>
    </section>
  );
}
