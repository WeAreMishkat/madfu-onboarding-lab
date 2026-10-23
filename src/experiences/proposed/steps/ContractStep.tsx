import { useEffect, useRef, useState } from 'react';
import { wait } from '@/lib/timing';
import { pct } from '../model/pricing';
import { acceptContract, declineContract, submitApplication } from '../model/state';
import { useProposed, useStepFocus } from '../store';
import { Actions, Alert, Button, StepHeader, VerifyBadge } from '../ui/components';
import { IconArrowLeft, IconPen } from '../ui/icons';
import { stageEyebrow } from './shared';

/**
 * Stage 7 — Contract ONLY. The agreed commission and plans appear as contract content (Schedule 1),
 * never as choices: plan selection lives in the Commercial Offer. Acceptance is a generic simulated
 * mechanism (provider not approved). Nafath is not the contract provider.
 */
export function ContractStep() {
  const { state, apply } = useProposed();
  const titleRef = useStepFocus<HTMLHeadingElement>();
  const { contract, commercial } = state.app;
  const offer = commercial.agreed;
  const [read, setRead] = useState(false);
  const [ack, setAck] = useState(contract.status === 'accepted');
  const [busy, setBusy] = useState<'accept' | 'submit' | null>(null);
  const [confirmDecline, setConfirmDecline] = useState(false);
  const accepted = contract.status === 'accepted';
  const docRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = docRef.current;
    if (el && el.scrollHeight <= el.clientHeight + 8) setRead(true);
  }, []);

  const accept = async () => { setBusy('accept'); await wait(1200); setBusy(null); apply(acceptContract); };
  const submit = async () => { setBusy('submit'); await wait(1000); setBusy(null); apply(submitApplication); };

  return (
    <section className="mb-card mb-card-wide" aria-labelledby="mb-step-title">
      <StepHeader eyebrow={stageEyebrow('contract')} title="Merchant contract" description="Read the contract, then accept it to submit your application." titleRef={titleRef} />

      <div className="mb-contract-viewer">
        <div className="mb-contract-bar">
          <strong>Madfu Merchant Agreement</strong>
          <span className="mb-small mb-muted">Sample text · not a legal document</span>
          {accepted && <VerifyBadge state="verified">Accepted</VerifyBadge>}
        </div>
        <div ref={docRef} className="mb-doc" tabIndex={0} aria-label="Contract text" onScroll={(e) => {
          const el = e.currentTarget;
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setRead(true);
        }}>
          <p className="mb-doc-banner">Prototype sample. Placeholder text for demonstration; not Madfu’s agreement.</p>
          <h3>1. Parties</h3><p>This agreement is between Madfu and the applicant identified in this application.</p>
          <h3>2. Services</h3><p>Madfu provides buy-now-pay-later payment services to the merchant’s customers, subject to Madfu’s approval of each customer.</p>
          <h3>3. Settlement</h3><p>Madfu settles approved transactions to the merchant’s settlement account on the agreed schedule.</p>
          <h3>4. Commercial terms (Schedule 1)</h3>
          <p>As confirmed in the Commercial Offer (synthetic prototype values):</p>
          <table className="mb-doc-table" aria-label="Schedule 1">
            <thead><tr><th>Plan</th><th>Commission</th><th>Basis</th></tr></thead>
            <tbody>
              {offer?.plans.map((p) => <tr key={p.tenure}><td>{p.tenure} months</td><td>{pct(p.rate)}</td><td>{p.included ? 'Included' : 'Selected optional plan'}</td></tr>)}
            </tbody>
          </table>
          <h3>5. Merchant obligations</h3><p>The merchant keeps its business, bank and tax details current and tells Madfu about material changes.</p>
          <h3>6. Review and activation</h3><p>Submission does not activate the merchant. The merchant account is set up only after Madfu approves the application.</p>
          <h3>7. General</h3><p>This sample text exists only to demonstrate reading, scrolling and acceptance in the prototype.</p>
        </div>
      </div>

      {!accepted && (
        <label className={`mb-ack ${!read ? 'is-disabled' : ''}`}>
          <input type="checkbox" checked={ack} disabled={!read} onChange={(e) => setAck(e.target.checked)} />
          <span>I have read the contract and accept it on behalf of the applicant.{!read && <span className="mb-ack-hint"> Scroll to the end to continue.</span>}</span>
        </label>
      )}

      {confirmDecline && !accepted && (
        <Alert tone="warning" title="Decline the contract?" action={
          <div className="mb-btn-row">
            <Button variant="secondary" size="sm" onClick={() => setConfirmDecline(false)}>Keep reviewing</Button>
            <Button variant="danger" size="sm" onClick={() => apply(declineContract)}>Decline</Button>
          </div>}>
          Your application will not be submitted. Your details stay saved.
        </Alert>
      )}

      {accepted && <Alert tone="success" title="Contract accepted">Submit your application to send it for review.</Alert>}

      <Actions split>
        <Button variant="ghost" iconLeft={<IconArrowLeft size={18} />} onClick={() => apply((s) => ({ ...s, app: { ...s.app, step: 'review' } }))}>Back to review</Button>
        <div className="mb-btn-row">
          {!accepted && <Button variant="secondary" onClick={() => setConfirmDecline(true)}>Decline</Button>}
          {!accepted
            ? <Button size="lg" iconLeft={<IconPen size={18} />} disabled={!ack} loading={busy === 'accept'} loadingLabel="Accepting…" onClick={() => void accept()}>Accept contract</Button>
            : <Button size="lg" loading={busy === 'submit'} loadingLabel="Submitting…" onClick={() => void submit()}>Submit application</Button>}
        </div>
      </Actions>
    </section>
  );
}
