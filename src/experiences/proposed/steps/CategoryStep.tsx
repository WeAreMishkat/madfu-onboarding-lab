import { useState } from 'react';
import { wait } from '@/lib/timing';
import { CATEGORIES } from '../model/config';
import { submitCategory } from '../model/state';
import { useProposed, useStepFocus } from '../store';
import { Field, Select, StepHeader } from '../ui/components';
import { StepNav } from './StepNav';

/** Early screening on Madfu's own taxonomy, before any paid verification is called. */
export function CategoryStep() {
  const { state, apply } = useProposed();
  const { group, sub } = state.app.category;
  const [errors, setErrors] = useState<{ group?: string; sub?: string }>({});
  const [saving, setSaving] = useState(false);
  const titleRef = useStepFocus<HTMLHeadingElement>();
  const current = CATEGORIES.find((g) => g.id === group);

  const set = (patch: Partial<typeof state.app.category>) =>
    apply((s) => ({ ...s, app: { ...s.app, category: { ...s.app.category, ...patch } } }));

  const next = async () => {
    const e: typeof errors = {};
    if (!group) e.group = 'Choose a business category.';
    if (!sub) e.sub = 'Choose a subcategory.';
    setErrors(e);
    if (e.group || e.sub) return;
    setSaving(true);
    await wait(500);
    setSaving(false);
    apply(submitCategory);
  };

  return (
    <section className="mb-card" aria-labelledby="mb-step-title">
      <StepHeader
        eyebrow="Step 2 of 6"
        title="What does your business sell?"
        description="Choose from Madfu's business categories. This is Madfu's own list, not your registered activity."
        titleRef={titleRef}
      />
      <form className="mb-form" noValidate onSubmit={(ev) => { ev.preventDefault(); void next(); }}>
        <div className="mb-row">
          <Field label="Business category" error={errors.group}>
            {({ id, describedBy, invalid }) => (
              <Select id={id} placeholder="Select a category" value={group} aria-describedby={describedBy} invalid={invalid}
                options={CATEGORIES.map((g) => ({ value: g.id, label: g.label }))}
                onChange={(ev) => { set({ group: ev.target.value, sub: '' }); setErrors({}); }} />
            )}
          </Field>
          <Field label="Business subcategory" error={errors.sub}>
            {({ id, describedBy, invalid }) => (
              <Select id={id} placeholder={current ? 'Select a subcategory' : 'Choose a category first'} value={sub} disabled={!current}
                aria-describedby={describedBy} invalid={invalid}
                options={(current?.subs ?? []).map((s) => ({ value: s.id, label: s.label }))}
                onChange={(ev) => { set({ sub: ev.target.value }); setErrors((x) => ({ ...x, sub: undefined })); }} />
            )}
          </Field>
        </div>
        <StepNav onNext={() => void next()} loading={saving} loadingLabel="Saving…" />
      </form>
    </section>
  );
}
