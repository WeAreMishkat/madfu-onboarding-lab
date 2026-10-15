import { useState } from 'react';
import { LIMITS } from '../model/config';
import { confirmCertificate, isFlCertificateNumber, loadCertificates, selectCertificate, submitManualCertificate } from '../model/state';
import type { Certificate } from '../model/types';
import { useProposed, useStepFocus } from '../store';
import { Alert, Button, Field, Spinner, StepHeader, TextInput, VerifyBadge } from '../ui/components';
import { IconCheck, IconDoc, IconRefresh } from '../ui/icons';
import { StepNav } from './StepNav';
import { useAutoRun } from './useAutoRun';

const unavailableReason = (c: Certificate) =>
  c.status === 'expired' ? 'Expired' : c.issue === 'duplicate' ? 'Already linked to another Madfu account' : null;

/** Certificates are retrieved after a successful Nafath, never typed or invented. Single selection. */
export function CertificatesStep() {
  const { state, apply } = useProposed();
  const titleRef = useStepFocus<HTMLHeadingElement>();
  const { certs } = state.app;
  const [running, retry] = useAutoRun(certs.status === 'idle', loadCertificates, 1100);
  const canRetry = certs.tries <= LIMITS.providerRetries;
  const toManual = () => apply((s) => ({ ...s, app: { ...s.app, step: 'manual-certificate', certs: { ...s.app.certs, status: s.app.certs.status === 'loaded' ? s.app.certs.status : 'none' } } }));

  return (
    <section className="mb-card" aria-labelledby="mb-step-title">
      <StepHeader eyebrow="Step 3 of 6" title="Choose your freelance certificate"
        description="These certificates are linked to your verified National ID. Choose the one this application is for." titleRef={titleRef} />

      <div aria-live="polite" className="mb-stack">
        {(running || certs.status === 'idle') && <div className="mb-progress-line"><Spinner size={16} /> Retrieving your freelance certificates…</div>}

        {!running && certs.status === 'loaded' && (
          <fieldset className="mb-field mb-choice-group">
            <legend className="mb-label">Your certificates</legend>
            <div className="mb-person-list" role="radiogroup">
              {certs.list.map((c) => {
                const reason = unavailableReason(c);
                const checked = certs.selectedId === c.id;
                return (
                  <label key={c.id} className={`mb-person-option mb-cert ${checked ? 'is-checked' : ''} ${reason ? 'is-disabled' : ''}`}>
                    <input type="radio" name="certificate" value={c.id} checked={checked} disabled={!!reason} onChange={() => apply((s) => selectCertificate(s, c.id))} />
                    <span className="mb-cert-icon" aria-hidden="true"><IconDoc /></span>
                    <span className="mb-person-text">
                      <span className="mb-person-name mb-mono">{c.number}</span>
                      <span className="mb-person-id">{c.category} · {c.subcategory}</span>
                    </span>
                    {reason ? <VerifyBadge state="neutral">{reason}</VerifyBadge> : c.issue === 'inconsistent' ? <VerifyBadge state="attention">Details to confirm</VerifyBadge> : <VerifyBadge state="verified">Active</VerifyBadge>}
                    <span className="mb-choice-radio" aria-hidden="true">{checked && <IconCheck size={14} />}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        {!running && certs.status === 'none' && (
          <Alert tone="info" title="No active freelance certificate was found"
            action={<Button variant="secondary" size="sm" onClick={toManual}>Enter certificate number</Button>}>
            Enter your certificate number and our team will verify it.
          </Alert>
        )}

        {!running && certs.status === 'unavailable' && (
          <Alert tone="warning" title="We couldn't retrieve your certificates"
            action={<div className="mb-btn-row">
              {canRetry && <Button variant="secondary" size="sm" iconLeft={<IconRefresh size={16} />} onClick={retry}>Try again</Button>}
              <Button variant="ghost" size="sm" onClick={toManual}>Enter the number instead</Button>
            </div>}>
            Your progress is saved.
          </Alert>
        )}
      </div>

      <StepNav onNext={() => apply(confirmCertificate)} nextDisabled={running || certs.status !== 'loaded' || !certs.selectedId} />
    </section>
  );
}

export function ManualCertificateStep() {
  const { state, apply } = useProposed();
  const titleRef = useStepFocus<HTMLHeadingElement>();
  const [value, setValue] = useState(state.app.certs.manualNumber);
  const [error, setError] = useState<string | null>(null);
  const nafathFailed = state.app.nafath.status === 'exhausted';

  const next = () => {
    if (!isFlCertificateNumber(value)) { setError(value ? 'Enter the 9 digits after FL-.' : 'Enter your freelance certificate number.'); return; }
    apply((s) => submitManualCertificate({ ...s, app: { ...s.app, certs: { ...s.app.certs, manualNumber: value } } }));
  };

  return (
    <section className="mb-card" aria-labelledby="mb-step-title">
      <StepHeader eyebrow="Step 3 of 6" title="Freelance certificate number"
        description={nafathFailed
          ? 'Your identity will be verified manually, so enter the certificate this application is for.'
          : 'Enter the certificate this application is for. Our team will verify it.'} titleRef={titleRef} />
      <form className="mb-form" noValidate onSubmit={(e) => { e.preventDefault(); next(); }}>
        <Field label="Freelance Certificate Number" error={error} hint="The 9 digits on your certificate.">
          {({ id, describedBy, invalid }) => (
            <TextInput id={id} prefix="FL-" inputMode="numeric" maxLength={9} value={value} placeholder="9 digits" aria-describedby={describedBy} invalid={invalid}
              onChange={(e) => { setError(null); setValue(e.target.value.replace(/\D/g, '')); }} />
          )}
        </Field>
        <StepNav onNext={next} />
      </form>
    </section>
  );
}
