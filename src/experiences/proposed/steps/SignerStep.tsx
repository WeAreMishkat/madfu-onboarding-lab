import { useState } from 'react';
import { wait } from '@/lib/timing';
import { maskMobile } from '../model/config';
import { activeVersion, signerStartNafath } from '../model/state';
import { useProposed, useStepFocus } from '../store';
import { Actions, Alert, Button, StepHeader } from '../ui/components';
import { IconShield } from '../ui/icons';
import { stageEyebrow } from './shared';

const ENDED_COPY = {
  expired: { title: 'This authorization link has expired.', body: 'The application is saved. The applicant can contact Madfu Business to send a new request.' },
  ended: { title: 'This authorization can’t be continued online.', body: 'The application is saved. Madfu Business will contact the applicant.' },
  completed: { title: 'This application has already been signed.', body: 'Nothing else is needed from you.' },
  invalid: { title: 'This link is not valid.', body: 'Please use the latest link you received by SMS.' }
} as const;

/**
 * The signer's first page from the secure SMS link. No OTP in Phase 1 — and the link alone authorizes
 * nothing: only the minimum, masked context is shown (business name, signer's first and last name,
 * masked National ID and mobile). The full application is shown only after Nafath.
 */
export function SignerStep() {
  const { state, apply } = useProposed();
  const titleRef = useStepFocus<HTMLHeadingElement>();
  const { app } = state;
  const [busy, setBusy] = useState(false);
  const link = app.signerSession?.link ?? 'invalid';
  const v = activeVersion(app);

  if (link !== 'active' || !v) {
    const c = ENDED_COPY[link === 'active' ? 'invalid' : link];
    return (
      <section className="mb-card mb-card-narrow" aria-labelledby="mb-step-title">
        <StepHeader eyebrow="Madfu Business · Authorization request" title={c.title} description={c.body} titleRef={titleRef} />
      </section>
    );
  }

  const start = async () => { setBusy(true); await wait(700); setBusy(false); apply(signerStartNafath); };

  return (
    <section className="mb-card mb-card-narrow" aria-labelledby="mb-step-title">
      <StepHeader eyebrow={stageEyebrow('signer', app)} title="You’ve been asked to authorize a Madfu merchant application"
        description="Confirm your identity with Nafath. You will then see the full application and the contract before you sign." titleRef={titleRef} />
      <dl className="mb-kv is-tight" aria-label="Authorization request">
        <div className="mb-kv-row"><dt>Business</dt><dd>{app.cr.record?.legalName ?? 'Registered business'}</dd></div>
        <div className="mb-kv-row"><dt>Requested signer</dt><dd>{v.signerName}</dd></div>
        <div className="mb-kv-row"><dt>National ID</dt><dd className="mb-mono">{v.signerIdMasked}</dd></div>
        <div className="mb-kv-row"><dt>Mobile</dt><dd className="mb-mono">{maskMobile(v.signerMobile)}</dd></div>
      </dl>
      <Alert tone="info">If you are not {v.signerName}, do not continue. Madfu never asks for a password or code by SMS.</Alert>
      <Actions><Button size="lg" block iconLeft={<IconShield size={18} />} loading={busy} loadingLabel="Checking your mobile…" onClick={() => void start()}>Start Nafath Verification</Button></Actions>
    </section>
  );
}
