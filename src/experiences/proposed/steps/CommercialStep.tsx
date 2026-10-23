import { useState } from 'react';
import { wait } from '@/lib/timing';
import { BASE_PLANS, OPTIONAL_PLANS, PRICING_EVIDENCE, pct, priceFor, rateFor } from '../model/pricing';
import { addEvidence, confirmOffer, removeEvidence, toggleOptionalPlan } from '../model/state';
import type { Tenure } from '../model/types';
import { useProposed, useStepFocus } from '../store';
import { Alert, Button, Divider, StepHeader, VerifyBadge } from '../ui/components';
import { IconCheck, IconDoc, IconPercent, IconUpload, IconX } from '../ui/icons';
import { stageEyebrow } from './shared';
import { StepNav } from './StepNav';

/**
 * Stage 5 — Commercial Offer. ALL commercial configuration lives here (not in the Contract):
 * standard commission, optional better-rate evidence (never blocking), payment plans (3 and 4 months
 * always included; 6 / 9 / 12 optional) and the summary the merchant confirms.
 */
export function CommercialStep() {
  const { state, apply } = useProposed();
  const titleRef = useStepFocus<HTMLHeadingElement>();
  const { app } = state;
  const c = app.commercial;
  const sub = app.kyb.sub;
  const price = priceFor(sub);
  const [uploading, setUploading] = useState<string | null>(null);
  const chosen = OPTIONAL_PLANS.filter((t) => c.optional.includes(t));

  const upload = async (id: string) => {
    setUploading(id);
    await wait(700);
    setUploading(null);
    apply((s) => addEvidence(s, id));
  };

  return (
    <section className="mb-card mb-card-wide" aria-labelledby="mb-step-title">
      <StepHeader eyebrow={app.returnTo ? 'Edit' : stageEyebrow('commercial')} title="Your commercial offer" description="Your commission and the payment plans your customers can use. Values in this prototype are synthetic." titleRef={titleRef} />

      <div className="mb-offer-hero">
        <span className="mb-offer-icon" aria-hidden="true"><IconPercent size={22} /></span>
        <div>
          <p className="mb-offer-label">Your standard commission</p>
          <p className="mb-offer-rate">{pct(price.standard)}</p>
          <p className="mb-small mb-muted">You can continue now with the standard commission.</p>
        </div>
      </div>

      <h2 className="mb-section-title">Payment plans</h2>
      <div className="mb-plans" role="group" aria-label="Payment plans">
        {BASE_PLANS.map((t) => (
          <div key={t} className="mb-plan is-included">
            <span className="mb-plan-check is-locked" aria-hidden="true"><IconCheck size={14} /></span>
            <span className="mb-plan-name">{t} months</span>
            <VerifyBadge state="verified">Included</VerifyBadge>
            <span className="mb-plan-rate">{pct(price.standard)}</span>
          </div>
        ))}
        {OPTIONAL_PLANS.map((t) => {
          const on = c.optional.includes(t);
          return (
            <label key={t} className={`mb-plan ${on ? 'is-on' : ''}`}>
              <input type="checkbox" checked={on} onChange={() => apply((s) => toggleOptionalPlan(s, t as Tenure))} aria-label={`${t} months, optional, ${pct(rateFor(sub, t))} commission`} />
              <span className="mb-plan-check" aria-hidden="true">{on && <IconCheck size={14} />}</span>
              <span className="mb-plan-name">{t} months</span>
              <span className="mb-plan-tag">Optional</span>
              <span className="mb-plan-rate">{pct(rateFor(sub, t))}</span>
            </label>
          );
        })}
      </div>
      <p className="mb-small mb-muted">3 and 4 months are always included. Longer plans carry a higher commission.</p>

      <Divider />
      <h2 className="mb-section-title">You may qualify for a better commercial rate</h2>
      <p className="mb-small">Optional. Upload supporting documents and our Commercial team will review your rate. You continue now with the standard commission; nothing waits for this review.</p>
      <ul className="mb-evidence">
        {PRICING_EVIDENCE.map((d) => {
          const added = c.evidence.includes(d.id);
          return (
            <li key={d.id} className={`mb-evidence-row ${added ? 'is-added' : ''}`}>
              <span className="mb-cert-icon" aria-hidden="true"><IconDoc /></span>
              <span className="mb-person-text"><span className="mb-person-name">{d.label}</span><span className="mb-person-id">{added ? `${d.id}.pdf · uploaded (demo)` : d.hint}</span></span>
              {added
                ? <Button variant="ghost" size="sm" iconLeft={<IconX size={14} />} onClick={() => apply((s) => removeEvidence(s, d.id))} aria-label={`Remove ${d.label}`}>Remove</Button>
                : <Button variant="secondary" size="sm" iconLeft={<IconUpload size={14} />} loading={uploading === d.id} loadingLabel="Uploading" onClick={() => void upload(d.id)}>Add file</Button>}
            </li>
          );
        })}
      </ul>

      <Divider />
      <h2 className="mb-section-title">Summary</h2>
      <dl className="mb-kv">
        <div className="mb-kv-row"><dt>Standard commission</dt><dd>{pct(price.standard)}</dd></div>
        <div className="mb-kv-row"><dt>Included plans</dt><dd>{BASE_PLANS.map((t) => `${t} months`).join(' · ')}</dd></div>
        <div className="mb-kv-row"><dt>Optional plans</dt><dd>{chosen.length ? chosen.map((t) => `${t} months (${pct(rateFor(sub, t))})`).join(' · ') : 'None selected'}</dd></div>
        <div className="mb-kv-row"><dt>Better-rate review</dt><dd>{c.evidence.length ? <VerifyBadge state="pending">Requested · continue with standard rate</VerifyBadge> : 'Not requested'}</dd></div>
      </dl>
      {c.evidence.length > 0 && <Alert tone="info">Your application continues with the standard commission while our Commercial team reviews your documents.</Alert>}

      <StepNav onNext={() => apply(confirmOffer)} nextLabel="Confirm offer and continue" />
    </section>
  );
}
