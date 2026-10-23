import { useState } from 'react';
import { wait } from '@/lib/timing';
import { BASE_PLANS, OPTIONAL_PLANS, PRICING_EVIDENCE, pct, priceFor, rateFor } from '../model/pricing';
import { addEvidence, confirmOffer, removeEvidence, setBetterInterest, toggleOptionalPlan } from '../model/state';
import type { Tenure } from '../model/types';
import { useProposed, useStepFocus } from '../store';
import { Alert, Button, Divider, StepHeader, VerifyBadge } from '../ui/components';
import { IconCheck, IconDoc, IconPercent, IconUpload, IconX } from '../ui/icons';
import { stageEyebrow } from './shared';
import { StepNav } from './StepNav';

/**
 * Stage 5 — Commercial Offer. The primary path is: standard offer → Continue. Order: standard offer,
 * included plans, optional plans (multi-select), a collapsed optional better-offer question, summary.
 * Supporting documents appear only after the merchant says they are interested, are always optional
 * and never block onboarding; the standard offer stays the contractual offer.
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
  const expanded = c.interest === 'yes';

  const upload = async (id: string) => {
    setUploading(id);
    await wait(700);
    setUploading(null);
    apply((s) => addEvidence(s, id));
  };

  return (
    <section className="mb-card mb-card-wide" aria-labelledby="mb-step-title">
      <StepHeader eyebrow={app.returnTo ? 'Edit' : stageEyebrow('commercial')} title="Your commercial offer" description="Your standard offer is ready. Choose the payment plans your customers can use, then continue. Values in this prototype are synthetic." titleRef={titleRef} />

      <div className="mb-offer-hero is-primary">
        <span className="mb-offer-icon" aria-hidden="true"><IconPercent size={22} /></span>
        <div>
          <p className="mb-offer-label">Your standard offer</p>
          <p className="mb-offer-rate">{pct(price.standard)} <span className="mb-small mb-muted">commission</span></p>
          <p className="mb-small mb-muted">Available now. Nothing else is needed to continue.</p>
        </div>
      </div>

      <h2 className="mb-section-title">Included payment plans</h2>
      <div className="mb-plans" role="group" aria-label="Included payment plans">
        {BASE_PLANS.map((t) => (
          <div key={t} className="mb-plan is-included">
            <span className="mb-plan-check is-locked" aria-hidden="true"><IconCheck size={14} /></span>
            <span className="mb-plan-name">{t} months</span>
            <VerifyBadge state="verified">Included</VerifyBadge>
            <span className="mb-plan-rate">{pct(price.standard)}</span>
          </div>
        ))}
      </div>

      <h2 className="mb-section-title">Optional payment plans</h2>
      <div className="mb-plans" role="group" aria-label="Optional payment plans">
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
      <p className="mb-small mb-muted">Longer plans carry a higher commission. Select any combination.</p>

      <section className="mb-better" aria-label="Better commercial offer">
        <div className="mb-better-head">
          <div>
            <p className="mb-better-title">Interested in a better commercial offer?</p>
            <p className="mb-small mb-muted">Share more information and our team can review whether you qualify for a better rate. You can continue with the standard offer either way.</p>
          </div>
          <span className="mb-better-tag">Optional</span>
        </div>
        {!expanded && (
          <div className="mb-better-actions">
            <Button variant="secondary" size="sm" aria-expanded={false} onClick={() => apply((s) => setBetterInterest(s, 'yes'))}>Yes, tell me more</Button>
            <Button variant="ghost" size="sm" aria-pressed={c.interest === 'no'} onClick={() => apply((s) => setBetterInterest(s, 'no'))}>Not now</Button>
          </div>
        )}
        {expanded && (
          <div className="mb-better-body" aria-label="Optional supporting information">
            <p className="mb-small"><strong>Optional</strong> — your onboarding continues with the standard offer without these documents.</p>
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
            {c.uploadError && <Alert tone="warning" title="The file could not be uploaded">Try again, or continue with the standard offer.</Alert>}
            <div className="mb-better-actions">
              <Button variant="ghost" size="sm" onClick={() => apply((s) => setBetterInterest(s, 'no'))}>Not now</Button>
            </div>
          </div>
        )}
      </section>

      <Divider />
      <h2 className="mb-section-title">Summary</h2>
      <dl className="mb-kv">
        <div className="mb-kv-row"><dt>Standard commission</dt><dd>{pct(price.standard)}</dd></div>
        <div className="mb-kv-row"><dt>Included plans</dt><dd>{BASE_PLANS.map((t) => `${t} months`).join(' · ')}</dd></div>
        <div className="mb-kv-row"><dt>Optional plans</dt><dd>{chosen.length ? chosen.map((t) => `${t} months (${pct(rateFor(sub, t))})`).join(' · ') : 'None selected'}</dd></div>
        {c.evidence.length > 0 && <div className="mb-kv-row"><dt>Better offer</dt><dd><VerifyBadge state="pending">Review requested · standard offer applies</VerifyBadge></dd></div>}
      </dl>

      <StepNav onNext={() => apply(confirmOffer)} nextLabel="Continue with this offer" />
    </section>
  );
}
