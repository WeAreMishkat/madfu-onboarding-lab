import { useState } from 'react';
import { wait } from '@/lib/timing';
import { pct } from '../model/pricing';
import { agreeAndSubmit } from '../model/state';
import { useProposed, useStepFocus } from '../store';
import { Actions, Button, StepHeader } from '../ui/components';
import { IconArrowLeft } from '../ui/icons';
import { stageEyebrow } from './shared';

/**
 * Stage 7 — Contract ONLY. Title, scrollable contract, short disclaimer, Back to review and ONE
 * primary action (there is no Decline): Agree & Submit (preparer) or Agree & Sign (CR signer) records
 * the (simulated) acceptance AND submits the application, then the success page opens. No checkbox,
 * no second Submit, no plan selection. The (frozen) standard commission appears as contract content.
 * Acceptance mechanism is generic (provider not approved); Nafath is not the contract provider.
 */
export function ContractStep() {
  const { state, apply } = useProposed();
  const titleRef = useStepFocus<HTMLHeadingElement>();
  const offer = state.app.commercial.agreed;
  const signer = state.app.actor === 'signer';
  const action = signer ? 'Agree & Sign' : 'Agree & Submit';
  const [busy, setBusy] = useState(false);

  const agree = async () => { setBusy(true); await wait(1000); setBusy(false); apply(agreeAndSubmit); };

  return (
    <section className="mb-card mb-card-wide" aria-labelledby="mb-step-title">
      <StepHeader eyebrow={stageEyebrow('contract', state.app)} title="Merchant agreement" description={signer ? 'Please read the agreement. Signing authorizes and submits the application on behalf of the business.' : 'Please read the agreement. Agreeing submits your application.'} titleRef={titleRef} />

      <div className="mb-contract-viewer">
        <div className="mb-contract-bar">
          <strong>Madfu Merchant Agreement</strong>
          <span className="mb-small mb-muted">Sample text · not a legal document</span>
        </div>
        <div className="mb-doc" tabIndex={0} aria-label="Contract text">
          <p className="mb-doc-banner">Prototype sample. Placeholder text for demonstration; not Madfu’s agreement.</p>
          <h3>1. Parties</h3><p>This agreement is between Madfu and the applicant identified in this application.</p>
          <h3>2. Services</h3><p>Madfu provides buy-now-pay-later payment services to the merchant’s customers, subject to Madfu’s approval of each customer.</p>
          <h3>3. Settlement</h3><p>Madfu settles approved transactions to the merchant’s settlement account on the agreed schedule.</p>
          <h3>4. Commercial terms (Schedule 1)</h3>
          <p>As confirmed in the Commercial Offer (synthetic prototype values):</p>
          <table className="mb-doc-table" aria-label="Schedule 1">
            <thead><tr><th>Term</th><th>Value</th></tr></thead>
            <tbody>
              <tr><td>Standard commission</td><td>{offer ? pct(offer.standardRate) : '—'}</td></tr>
              <tr><td>Payment plans</td><td>Configured by the merchant in the Merchant Portal</td></tr>
            </tbody>
          </table>
          <h3>5. Merchant obligations</h3><p>The merchant keeps its business details current, adds its payout bank account before receiving payouts, and tells Madfu about material changes.</p>
          <h3>6. Review and activation</h3><p>Submission does not activate the merchant. The merchant account is set up only after Madfu approves the application.</p>
          <h3>7. General</h3><p>This sample text exists only to demonstrate the contract step in the prototype.</p>
        </div>
      </div>

      <p className="mb-contract-disclaimer">
        By clicking <strong>{action}</strong>, you confirm your acceptance of this agreement and the applicable terms, including the Privacy Policy, and submit {signer ? 'the application on behalf of the business' : 'your application'}.
        <br /><span className="mb-small">Prototype copy — final wording subject to Legal review.</span>
      </p>

      <Actions split>
        <Button variant="ghost" iconLeft={<IconArrowLeft size={18} />} onClick={() => apply((s) => ({ ...s, app: { ...s.app, step: 'review' } }))}>Back to review</Button>
        <Button size="lg" loading={busy} loadingLabel="Submitting…" onClick={() => void agree()}>{action}</Button>
      </Actions>
    </section>
  );
}
