import { useState } from 'react';
import { wait } from '@/lib/timing';
import { LIMITS, formatIban, isFreelancer, isIbanFormat, normaliseIban } from '../model/config';
import { finishIbanCheck, needsMaps, needsWebsite, setIban, setPresence, startIbanCheck, submitBusiness } from '../model/state';
import { URL_ERROR_COPY, validateMapsUrl, validateWebsite } from '../model/urls';
import { useProposed, useStepFocus } from '../store';
import { Alert, Button, Divider, Field, Spinner, StepHeader, TextInput, VerifyBadge } from '../ui/components';
import { IconBank, IconRefresh, IconStore } from '../ui/icons';
import { CHANNEL_LABEL, stageEyebrow } from './shared';
import { StepNav } from './StepNav';

type Errors = Partial<Record<'websiteUrl' | 'mapsUrl' | 'iban', string>>;

/**
 * Stage 4 — Business Details. Store presence for the channel declared on Page 1 (website and / or the
 * Google Maps link of the selling branch — not the National Address). Freelancers also verify the
 * IBAN linked to their certificate. No IBAN for registered businesses (payout account at activation),
 * no VAT, no branch count.
 */
export function BusinessStep() {
  const { state, apply, previewErrors } = useProposed();
  const titleRef = useStepFocus<HTMLHeadingElement>();
  const { app } = state;
  const b = app.business;
  const fl = isFreelancer(app.kyb.kind);
  const editing = !!app.returnTo;
  const [errors, setErrors] = useState<Errors>(previewErrors as Errors);
  const clear = (...keys: Array<keyof Errors>) => setErrors((e) => { const n = { ...e }; keys.forEach((k) => delete n[k]); return n; });
  const web = needsWebsite(app);
  const maps = needsMaps(app);
  const ibanLocked = b.ibanStatus === 'verified';

  const verify = async () => {
    if (!isIbanFormat(b.iban)) { setErrors((e) => ({ ...e, iban: b.iban ? 'Enter a Saudi IBAN: SA followed by 22 digits.' : 'Enter your IBAN.' })); return; }
    clear('iban');
    apply(startIbanCheck);
    await wait(1200);
    apply((s) => (s.app.business.ibanStatus === 'verifying' ? finishIbanCheck(s) : s));
  };

  const next = () => {
    const e: Errors = {};
    if (web) { const w = validateWebsite(b.websiteUrl); if (w) e.websiteUrl = w === 'empty' ? 'Enter your online store or website link.' : URL_ERROR_COPY[w]; }
    if (maps) { const m = validateMapsUrl(b.mapsUrl); if (m) e.mapsUrl = m === 'empty' ? 'Enter the Google Maps link of your store or branch.' : URL_ERROR_COPY[m]; }
    if (fl && b.ibanStatus !== 'verified') e.iban = b.iban ? 'Verify the IBAN to continue.' : 'Enter your IBAN.';
    setErrors(e);
    if (Object.keys(e).length) return;
    apply(submitBusiness);
  };

  return (
    <section className="mb-card" aria-labelledby="mb-step-title">
      <StepHeader eyebrow={editing ? 'Edit' : stageEyebrow('business')} title="Business details" description={fl ? 'Where you sell, and the bank account linked to your Freelancer Certificate.' : 'Where you sell. Nothing else is needed here.'} titleRef={titleRef} />
      <form className="mb-form" noValidate onSubmit={(ev) => { ev.preventDefault(); next(); }}>
        <h2 className="mb-section-title"><IconStore size={18} /> Store presence</h2>
        <p className="mb-small mb-muted">You sell {app.kyb.channel ? CHANNEL_LABEL[app.kyb.channel].toLowerCase() : ''} (from your first answers).</p>
        {web && (
          <Field label="Online store or business website" error={errors.websiteUrl} hint="Your own store or website, for example yourstore.com. Social-media pages and WhatsApp links are not accepted.">
            {({ id, describedBy, invalid }) => (
              <TextInput id={id} type="url" placeholder="yourstore.com" value={b.websiteUrl} aria-describedby={describedBy} invalid={invalid}
                onChange={(e) => { clear('websiteUrl'); apply((s) => setPresence(s, { websiteUrl: e.target.value })); }} />
            )}
          </Field>
        )}
        {maps && (
          <Field label="Google Maps link of your store or branch" error={errors.mapsUrl} hint="Where customers buy from you. This is not your National Address.">
            {({ id, describedBy, invalid }) => (
              <TextInput id={id} type="url" placeholder="https://maps.app.goo.gl/…" value={b.mapsUrl} aria-describedby={describedBy} invalid={invalid}
                onChange={(e) => { clear('mapsUrl'); apply((s) => setPresence(s, { mapsUrl: e.target.value })); }} />
            )}
          </Field>
        )}

        {fl && (
          <>
            <Divider />
            <h2 className="mb-section-title"><IconBank size={18} /> Bank account</h2>
            <Field label="IBAN" error={errors.iban} hint="The account linked to your Freelancer Certificate, in your name. Bank details are filled in for you.">
              {({ id, describedBy, invalid }) => (
                <div className="mb-inline">
                  <TextInput id={id} className="mb-mono" placeholder="SA00 0000 0000 0000 0000 0000" autoComplete="off" spellCheck={false}
                    value={formatIban(b.iban)} maxLength={29} aria-describedby={describedBy} invalid={invalid} readOnly={b.ibanStatus === 'verifying' || ibanLocked}
                    onChange={(e) => { clear('iban'); apply((s) => setIban(s, normaliseIban(e.target.value).slice(0, 24))); }}
                    suffix={ibanLocked ? <VerifyBadge state="verified">Verified</VerifyBadge> : undefined} />
                  {(b.ibanStatus === 'idle' || b.ibanStatus === 'verifying') && (
                    <Button variant="secondary" onClick={() => void verify()} loading={b.ibanStatus === 'verifying'} loadingLabel="Verifying">Verify</Button>
                  )}
                </div>
              )}
            </Field>
            <div aria-live="polite">
              {b.ibanStatus === 'verifying' && <div className="mb-progress-line"><Spinner size={16} /> Checking the account is linked to your certificate…</div>}
              {b.ibanStatus === 'verified' && (
                <div className="mb-verified-panel">
                  <VerifyBadge state="verified">Account verified</VerifyBadge>
                  <dl className="mb-kv is-tight">
                    <div className="mb-kv-row"><dt>Bank</dt><dd>{b.bankName}</dd></div>
                    <div className="mb-kv-row"><dt>Linked to</dt><dd>Your verified National ID and Freelancer Certificate</dd></div>
                  </dl>
                </div>
              )}
              {b.ibanStatus === 'failed' && (
                <Alert tone="error" title={b.ibanLast === 'technical' ? 'We could not check this account right now' : 'This account is not linked to your certificate'}
                  action={<Button variant="secondary" size="sm" iconLeft={<IconRefresh size={16} />} onClick={() => void verify()}>Try again</Button>}>
                  {b.ibanLast === 'technical' ? 'The bank check did not respond. This did not use an attempt.' : `Check the IBAN, or link the account on the freelance platform. ${LIMITS.ibanAttempts - b.ibanFailures} attempt${LIMITS.ibanAttempts - b.ibanFailures === 1 ? '' : 's'} left for this IBAN.`}
                </Alert>
              )}
              {b.ibanStatus === 'failed_final' && (
                <Alert tone="warning" title="This account could not be confirmed">Enter the IBAN of the account linked to your Freelancer Certificate to continue.</Alert>
              )}
            </div>
          </>
        )}

        <StepNav onNext={next} nextDisabled={b.ibanStatus === 'verifying'} />
      </form>
    </section>
  );
}
