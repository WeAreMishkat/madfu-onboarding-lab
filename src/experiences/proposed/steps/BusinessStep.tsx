import { useEffect, useState } from 'react';
import { wait } from '@/lib/timing';
import { LIMITS, formatIban, isFreelancer, isIbanFormat, isVatNumber, normaliseIban } from '../model/config';
import { bankingComplete, finishIbanCheck, setBankLinked, setBusiness, setIban, startIbanCheck, submitBusiness } from '../model/state';
import { useProposed, useStepFocus } from '../store';
import { Alert, Button, ChoiceGroup, Divider, Field, Spinner, StepHeader, TextInput, VerifyBadge } from '../ui/components';
import { IconBank, IconRefresh } from '../ui/icons';
import { KybSummary, stageEyebrow } from './shared';
import { StepNav } from './StepNav';

type Errors = Partial<Record<'bankLinked' | 'iban' | 'vat' | 'vatNumber' | 'branches', string>>;

/**
 * Stage 4 — only what is still missing. Category, revenue, channel, website and Maps link come from
 * Know Your Business and are shown, not asked again. The only bank input is the IBAN; bank name is
 * derived; no documents, no SWIFT, no beneficiary, no Source of Revenue / Income.
 */
export function BusinessStep() {
  const { state, apply, isStatic, previewErrors } = useProposed();
  const titleRef = useStepFocus<HTMLHeadingElement>();
  const { app } = state;
  const b = app.business;
  const fl = isFreelancer(app.kyb.kind);
  const [errors, setErrors] = useState<Errors>(previewErrors as Errors);
  const setB = (patch: Partial<typeof b>) => apply((s) => setBusiness(s, patch));
  const clear = (...keys: Array<keyof Errors>) => setErrors((e) => { const n = { ...e }; keys.forEach((k) => delete n[k]); return n; });
  const showIban = !fl || b.bankLinked === 'yes';
  const needsBranches = app.kyb.channel === 'offline' || app.kyb.channel === 'both';

  const verify = async () => {
    if (!isIbanFormat(b.iban)) { setErrors((e) => ({ ...e, iban: b.iban ? 'Enter a Saudi IBAN: SA followed by 22 digits.' : 'Enter your IBAN.' })); return; }
    clear('iban');
    apply(startIbanCheck);
    await wait(1400);
    apply((s) => (s.app.business.ibanStatus === 'verifying' ? finishIbanCheck(s) : s));
  };

  // A registered business's VAT details are retrieved, not typed.
  useEffect(() => {
    if (isStatic || fl || b.vat !== 'yes' || b.vatLookup !== 'checking') return;
    let live = true;
    void wait(1000).then(() => { if (live) apply((s) => setBusiness(s, { vatLookup: 'found' })); });
    return () => { live = false; };
  }, [fl, b.vat, b.vatLookup, apply, isStatic]);

  const next = () => {
    const e: Errors = {};
    if (fl && !b.bankLinked) e.bankLinked = 'Tell us whether your bank account is linked to your certificate.';
    if (showIban) {
      if (!b.iban) e.iban = 'Enter your IBAN.';
      else if (!['verified', 'unverified'].includes(b.ibanStatus)) e.iban = 'Verify the IBAN to continue.';
    }
    if (!b.vat) e.vat = 'Tell us whether you are VAT registered.';
    if (b.vat === 'yes' && fl && !isVatNumber(b.vatNumber)) e.vatNumber = b.vatNumber ? 'Enter 15 digits, starting with 3 and ending with 03.' : 'Enter your VAT number.';
    if (b.branches && !/^\d{1,4}$/.test(b.branches)) e.branches = 'Enter a number.';
    setErrors(e);
    if (Object.keys(e).length || !bankingComplete(app)) return;
    apply(submitBusiness);
  };

  const left = LIMITS.ibanAttempts - b.ibanFailures;

  return (
    <section className="mb-card" aria-labelledby="mb-step-title">
      <StepHeader eyebrow={app.returnTo ? 'Edit' : stageEyebrow('business')} title="Business & banking details" description="Only what we couldn’t retrieve: your settlement account and tax status." titleRef={titleRef} />
      <form className="mb-form" noValidate onSubmit={(ev) => { ev.preventDefault(); next(); }}>
        <KybSummary app={app} returnTo="business" compact />

        <h2 className="mb-section-title"><IconBank size={18} /> Settlement account</h2>
        {fl && (
          <ChoiceGroup<'yes' | 'no'>
            legend="Is your bank account linked to your Freelancer Certificate?"
            name="bank-linked"
            value={b.bankLinked}
            columns={2}
            compact
            options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No / not yet' }]}
            onChange={(v) => { clear('bankLinked', 'iban'); apply((s) => setBankLinked(s, v)); }}
            error={errors.bankLinked}
          />
        )}
        {fl && b.bankLinked === 'no' && (
          <Alert tone="info" title="You can continue">No IBAN is needed now. After we validate your other details, our team will contact you to set up a bank account linked to your certificate.</Alert>
        )}

        {showIban && (
          <>
            <Field label="IBAN" error={errors.iban}
              hint={fl ? 'The account linked to your Freelancer Certificate, in your name. Bank details are filled in for you.' : 'Must be held by the business. Bank details are filled in for you.'}>
              {({ id, describedBy, invalid }) => (
                <div className="mb-inline">
                  <TextInput id={id} className="mb-mono" placeholder="SA00 0000 0000 0000 0000 0000" autoComplete="off" spellCheck={false}
                    value={formatIban(b.iban)} maxLength={29} aria-describedby={describedBy} invalid={invalid} readOnly={b.ibanStatus === 'verifying'}
                    onChange={(e) => { clear('iban'); apply((s) => setIban(s, normaliseIban(e.target.value).slice(0, 24))); }}
                    suffix={b.ibanStatus === 'verified' ? <VerifyBadge state="verified">Verified</VerifyBadge> : undefined} />
                  {(b.ibanStatus === 'idle' || b.ibanStatus === 'verifying') && (
                    <Button variant="secondary" onClick={() => void verify()} loading={b.ibanStatus === 'verifying'} loadingLabel="Verifying">Verify</Button>
                  )}
                </div>
              )}
            </Field>
            <div aria-live="polite">
              {b.ibanStatus === 'verifying' && <div className="mb-progress-line"><Spinner size={16} /> Verifying account ownership…</div>}
              {b.ibanStatus === 'verified' && (
                <div className="mb-verified-panel">
                  <VerifyBadge state="verified">Account verified</VerifyBadge>
                  <dl className="mb-kv is-tight">
                    <div className="mb-kv-row"><dt>Bank</dt><dd>{b.bankName}</dd></div>
                    <div className="mb-kv-row"><dt>Account holder</dt><dd>{fl ? 'Matches the verified individual and certificate' : 'Matches the registered business'}</dd></div>
                  </dl>
                </div>
              )}
              {b.ibanStatus === 'failed' && (
                <Alert tone="error" title={b.ibanLast === 'technical' ? 'We could not verify this account right now' : 'This account could not be matched'}
                  action={<Button variant="secondary" size="sm" iconLeft={<IconRefresh size={16} />} onClick={() => void verify()}>Try again</Button>}>
                  {b.ibanLast === 'technical' ? 'The bank check did not respond.' : fl ? 'The account holder does not match your verified identity.' : 'The account holder does not match the business.'} Check the IBAN or try again. {left} attempt{left === 1 ? '' : 's'} left.
                </Alert>
              )}
              {b.ibanStatus === 'unverified' && <Alert tone="info" title="You can continue">We could not verify this account automatically. Our team will review it.</Alert>}
            </div>
          </>
        )}

        <Divider />
        <h2 className="mb-section-title">Tax</h2>
        <ChoiceGroup<'yes' | 'no'>
          legend="VAT registered?"
          name="vat"
          value={b.vat}
          columns={2}
          compact
          options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]}
          onChange={(v) => { clear('vat', 'vatNumber'); setB({ vat: v, vatLookup: v === 'yes' && !fl ? (b.vatLookup === 'found' ? 'found' : 'checking') : 'idle', vatNumber: v === 'no' ? '' : b.vatNumber }); }}
          error={errors.vat}
        />
        {b.vat === 'yes' && !fl && (
          <div aria-live="polite">
            {b.vatLookup === 'checking'
              ? <div className="mb-progress-line"><Spinner size={16} /> Retrieving your VAT registration…</div>
              : b.vatLookup === 'found' && <div className="mb-verified-panel"><VerifyBadge state="verified">VAT details retrieved</VerifyBadge><p className="mb-small">VAT number 3•••••••••••003. Nothing to enter.</p></div>}
          </div>
        )}
        {b.vat === 'yes' && fl && (
          <Field label="VAT number" error={errors.vatNumber} hint="15 digits, starts with 3 and ends with 03.">
            {({ id, describedBy, invalid }) => (
              <TextInput id={id} className="mb-mono" inputMode="numeric" maxLength={15} placeholder="3XXXXXXXXXXXX03" value={b.vatNumber}
                aria-describedby={describedBy} invalid={invalid} onChange={(e) => { clear('vatNumber'); setB({ vatNumber: e.target.value.replace(/\D/g, '') }); }} />
            )}
          </Field>
        )}

        {needsBranches && (
          <>
            <Divider />
            <Field label="Number of branches" optional error={errors.branches}>
              {({ id, describedBy, invalid }) => <TextInput id={id} inputMode="numeric" placeholder="e.g. 2" value={b.branches} aria-describedby={describedBy} invalid={invalid} onChange={(e) => { clear('branches'); setB({ branches: e.target.value.replace(/\D/g, '').slice(0, 4) }); }} />}
            </Field>
          </>
        )}

        <StepNav onNext={next} nextDisabled={b.ibanStatus === 'verifying' || b.vatLookup === 'checking'} />
      </form>
    </section>
  );
}
