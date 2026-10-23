import { useState } from 'react';
import { wait } from '@/lib/timing';
import { KIND_OPTIONS, REVENUE_OPTIONS } from '../model/config';
import { CATEGORIES } from '../model/eligibility';
import { setKyb, submitKyb } from '../model/state';
import type { ApplicantKind, Channel, Kyb, Revenue } from '../model/types';
import { URL_ERROR_COPY, validateMapsUrl, validateWebsite } from '../model/urls';
import { useProposed, useStepFocus } from '../store';
import { ChoiceGroup, Field, Select, StepHeader, TextInput } from '../ui/components';
import { IconBoth, IconGlobe, IconStore } from '../ui/icons';
import { stageEyebrow } from './shared';
import { StepNav } from './StepNav';

type Errors = Partial<Record<'kind' | 'group' | 'sub' | 'revenue' | 'channel' | 'websiteUrl' | 'mapsUrl', string>>;

/**
 * Stage 1 — Know Your Business. The first page: low-cost eligibility questions only. No CR, National
 * ID, mobile or OTP here. Eligibility is evaluated internally before anything is verified.
 */
export function KybStep() {
  const { state, apply, previewErrors } = useProposed();
  const k = state.app.kyb;
  const editing = !!state.app.id && !!state.app.returnTo;
  const [errors, setErrors] = useState<Errors>(previewErrors as Errors);
  const [checking, setChecking] = useState(false);
  const titleRef = useStepFocus<HTMLHeadingElement>();
  const group = CATEGORIES.find((g) => g.id === k.group);
  const needsWeb = k.channel === 'online' || k.channel === 'both';
  const needsMap = k.channel === 'offline' || k.channel === 'both';

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
    if (needsWeb) { const w = validateWebsite(k.websiteUrl); if (w) e.websiteUrl = w === 'empty' ? 'Enter your website link.' : URL_ERROR_COPY[w]; }
    if (needsMap) { const m = validateMapsUrl(k.mapsUrl); if (m) e.mapsUrl = m === 'empty' ? 'Enter the Google Maps link to your location.' : URL_ERROR_COPY[m]; }
    return e;
  };

  const next = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setChecking(true);
    await wait(700);
    setChecking(false);
    apply(submitKyb);
  };

  return (
    <section className="mb-card" aria-labelledby="mb-step-title">
      <StepHeader
        eyebrow={editing ? 'Edit' : stageEyebrow('kyb')}
        title="Tell us about your business"
        description="A few quick questions to check that Madfu fits your business. We ask for your Commercial Registration or National ID only if you can continue."
        titleRef={titleRef}
      />
      <form className="mb-form" noValidate onSubmit={(ev) => { ev.preventDefault(); void next(); }}>
        <Field label="Who is applying?" error={errors.kind} hint={editing ? 'To change the applicant type, start a new application.' : undefined}>
          {({ id, describedBy, invalid }) => (
            <Select id={id} placeholder="Select the applicant type" value={k.kind ?? ''} aria-describedby={describedBy} invalid={invalid} disabled={editing}
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

        {needsWeb && (
          <Field label="Business website URL" error={errors.websiteUrl} hint="Your own website. Social-media pages and WhatsApp links are not accepted.">
            {({ id, describedBy, invalid }) => (
              <TextInput id={id} type="url" placeholder="https://yourstore.com" value={k.websiteUrl} aria-describedby={describedBy} invalid={invalid}
                onChange={(e) => set({ websiteUrl: e.target.value })} />
            )}
          </Field>
        )}
        {needsMap && (
          <Field label="Google Maps URL" error={errors.mapsUrl} hint="The Google Maps link to your store location.">
            {({ id, describedBy, invalid }) => (
              <TextInput id={id} type="url" placeholder="https://maps.google.com/…" value={k.mapsUrl} aria-describedby={describedBy} invalid={invalid}
                onChange={(e) => set({ mapsUrl: e.target.value })} />
            )}
          </Field>
        )}

        <StepNav onNext={() => void next()} loading={checking} loadingLabel="Checking…" nextLabel="Check eligibility" />
      </form>
    </section>
  );
}
