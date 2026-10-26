import { useState } from 'react';
import { wait } from '@/lib/timing';
import { PRICING_EVIDENCE, pct, priceFor, pricingSub } from '../model/pricing';
import { addEvidence, confirmOffer, removeEvidence, requestRateReview, withdrawRateReview } from '../model/state';
import { useProposed, useStepFocus } from '../store';
import { Alert, Button, StepHeader } from '../ui/components';
import { IconDoc, IconPercent, IconUpload, IconX } from '../ui/icons';
import { stageEyebrow } from './shared';
import { StepNav } from './StepNav';

/**
 * Stage 5 — Commercial Offer. Your Standard Offer (from the verified category) → Continue. No payment
 * plan selection: plans are configured later in the Merchant Portal. A better-rate review is a small,
 * collapsed, optional link; uploads appear only after "Request rate review" and never block.
 */
export function CommercialStep() {
  const { state, apply } = useProposed();
  const titleRef = useStepFocus<HTMLHeadingElement>();
  const { app } = state;
  const c = app.commercial;
  const rate = priceFor(pricingSub(app)).standard;
  const [uploading, setUploading] = useState<string | null>(null);
  const [open, setOpen] = useState(c.reviewRequested);

  const upload = async (id: string) => {
    setUploading(id);
    await wait(600);
    setUploading(null);
    apply((s) => addEvidence(s, id));
  };

  return (
    <section className="mb-card" aria-labelledby="mb-step-title">
      <StepHeader eyebrow={app.returnTo ? 'Edit' : stageEyebrow('commercial')} title="Your Standard Offer" description="Values in this prototype are synthetic." titleRef={titleRef} />

      <div className="mb-offer-hero is-primary">
        <span className="mb-offer-icon" aria-hidden="true"><IconPercent size={22} /></span>
        <div>
          <p className="mb-offer-label">Standard commission</p>
          <p className="mb-offer-rate">{pct(rate)}</p>
          <p className="mb-small mb-muted">Applied to each Madfu transaction. You set up the payment plans your customers can use later, in your Merchant Portal. Nothing else is needed to continue.</p>
        </div>
      </div>

      <section className="mb-better-lite" aria-label="Better commercial rate (optional)">
        {!open ? (
          <Button variant="link" size="sm" aria-expanded={false} onClick={() => setOpen(true)}>Want us to review a better commercial rate?</Button>
        ) : (
          <div className="mb-better-lite-body">
            <p className="mb-small"><strong>Optional.</strong> Our Commercial team can review whether a better rate applies. Your standard offer stays in place; you can continue now.</p>
            {!c.reviewRequested ? (
              <div className="mb-btn-row">
                <Button variant="secondary" size="sm" onClick={() => apply(requestRateReview)}>Request rate review</Button>
                <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Not now</Button>
              </div>
            ) : (
              <>
                <p className="mb-small mb-ok">Rate review requested. Add supporting information if you have it (optional).</p>
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
                <Button variant="ghost" size="sm" onClick={() => { apply(withdrawRateReview); setOpen(false); }}>Cancel the rate review request</Button>
              </>
            )}
          </div>
        )}
      </section>

      <StepNav onNext={() => apply(confirmOffer)} nextLabel="Continue" />
    </section>
  );
}
