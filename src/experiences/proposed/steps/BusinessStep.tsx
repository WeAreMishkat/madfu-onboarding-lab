import { useEffect, useState } from 'react';
import { wait } from '@/lib/timing';
import { LIMITS, formatIban, isIbanFormat, isUrl, isVatNumber, normaliseIban } from '../model/config';
import { finishIbanCheck, ibanCheckApplies, ibanSettled, setIban, startIbanCheck, submitBusiness } from '../model/state';
import { useProposed, useStepFocus } from '../store';
import { Alert, Button, ChoiceGroup, Divider, Field, Spinner, StepHeader, TextInput, VerifyBadge } from '../ui/components';
import { IconBank, IconBoth, IconGlobe, IconRefresh, IconStore } from '../ui/icons';
import { StepNav } from './StepNav';

type Errors = Partial<Record<'iban' | 'vat' | 'vatNumber' | 'channel' | 'websiteUrl' | 'mapsUrl' | 'branches', string>>;

/**
 * Shared business details. The only bank input is the IBAN: bank name is derived, and SWIFT,
 * beneficiary and IBAN certificate are never asked. No Source of Revenue / Income, no documents.
 */
export function BusinessStep() {
  const { state, apply, isStatic } = useProposed();
  const titleRef = useStepFocus<HTMLHeadingElement>();
  const { app } = state;
  const b = app.business;
  const fl = app.entry.type === 'FL';
  const checkApplies = ibanCheckApplies(app);
  const { previewErrors } = useProposed();
  const [errors, setErrors] = useState<Errors>(previewErrors as Errors);
  const setB = (patch: Partial<typeof b>) => apply((s) => ({ ...s, app: { ...s.app, business: { ...s.app.business, ...patch } } }));
  const clear = (...keys: Array<keyof Errors>) => setErrors((e) => { const n = { ...e }; keys.forEach((k) => delete n[k]); return n; });

  const verify = async () => {
    if (!isIbanFormat(b.iban)) { setErrors((e) => ({ ...e, iban: b.iban ? 'Enter a Saudi IBAN: SA followed by 22 digits.' : 'Enter your IBAN.' })); return; }
    clear('iban');
    apply(startIbanCheck);
    if (!checkApplies) return;
    await wait(1400);
    apply(finishIbanCheck);
  };

  // CR VAT is retrieved, not typed.
  useEffect(() => {
    if (isStatic || fl || b.vat !== 'yes' || b.vatLookup !== 'checking') return;
    let live = true;
    void wait(1000).then(() => { if (live) apply((s) => ({ ...s, app: { ...s.app, business: { ...s.app.business, vatLookup: 'found' } } })); });
    return () => { live = false; };
  }, [fl, b.vat, b.vatLookup, apply, isStatic]);

  const needsWeb = b.channel === 'online' || b.channel === 'both';
  const needsMap = b.channel === 'offline' || b.channel === 'both';

  const next = () => {
    const e: Errors = {};
    if (!b.iban) e.iban = 'Enter your IBAN.';
    else if (!ibanSettled(app)) e.iban = checkApplies ? 'Verify the IBAN to continue.' : 'Save the IBAN to continue.';
    if (!b.vat) e.vat = 'Tell us whether you are VAT registered.';
    if (b.vat === 'yes' && fl && !isVatNumber(b.vatNumber)) e.vatNumber = b.vatNumber ? 'Enter 15 digits, starting with 3 and ending with 03.' : 'Enter your VAT number.';
    if (!b.channel) e.channel = 'Choose how you sell.';
    if (needsWeb && !isUrl(b.websiteUrl)) e.websiteUrl = b.websiteUrl ? 'Enter a full link, for example https://yourstore.com.' : 'Enter your website link.';
    if (needsMap && !isUrl(b.mapsUrl)) e.mapsUrl = b.mapsUrl ? 'Enter a full Google Maps or location link.' : 'Enter your store location link.';
    if (b.branches && !/^\d{1,4}$/.test(b.branches)) e.branches = 'Enter a number.';
    setErrors(e);
    if (Object.keys(e).length) return;
    apply(submitBusiness);
  };

  const left = LIMITS.ibanAttempts - b.ibanFailures;

  return (
    <section className="mb-card" aria-labelledby="mb-step-title">
      <StepHeader eyebrow="Step 4 of 6" title="Business details" description="Your settlement account, tax status and how you sell." titleRef={titleRef} />
      <form className="mb-form" noValidate onSubmit={(ev) => { ev.preventDefault(); next(); }}>
        <h2 className="mb-section-title"><IconBank size={18} /> Settlement account</h2>
        <Field label="IBAN" error={errors.iban}
          hint={!checkApplies ? 'Our team will verify this account during review.' : fl ? 'Must be held in your name. Bank details are filled in for you.' : 'Must be held by the business. Bank details are filled in for you.'}>
          {({ id, describedBy, invalid }) => (
            <div className="mb-inline">
              <TextInput id={id} className="mb-mono" placeholder="SA00 0000 0000 0000 0000 0000" autoComplete="off" spellCheck={false}
                value={formatIban(b.iban)} maxLength={29} aria-describedby={describedBy} invalid={invalid} readOnly={b.ibanStatus === 'verifying'}
                onChange={(e) => { clear('iban'); apply((s) => setIban(s, normaliseIban(e.target.value).slice(0, 24))); }}
                suffix={b.ibanStatus === 'verified' ? <VerifyBadge state="verified">Verified</VerifyBadge> : undefined} />
              {(b.ibanStatus === 'idle' || b.ibanStatus === 'verifying') && (
                <Button variant="secondary" onClick={() => void verify()} loading={b.ibanStatus === 'verifying'} loadingLabel="Verifying">
                  {checkApplies ? 'Verify' : 'Save'}
                </Button>
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
                <div className="mb-kv-row"><dt>Account holder</dt><dd>{fl ? 'Matches the verified individual' : 'Matches the registered business'}</dd></div>
              </dl>
            </div>
          )}
          {b.ibanStatus === 'failed' && (
            <Alert tone="error" title={b.ibanLast === 'technical' ? 'We could not verify this account right now' : 'This account could not be matched'}
              action={<Button variant="secondary" size="sm" iconLeft={<IconRefresh size={16} />} onClick={() => void verify()}>Try again</Button>}>
              {b.ibanLast === 'technical' ? 'The bank check did not respond.' : fl ? 'The account holder does not match your verified identity.' : 'The account holder does not match the business.'} Check the IBAN or try again. {left} attempt{left === 1 ? '' : 's'} left.
            </Alert>
          )}
          {b.ibanStatus === 'unverified' && (
            <Alert tone="info" title="You can continue">We could not verify this account automatically. Our team will review it.</Alert>
          )}
          {b.ibanStatus === 'not_checked' && (
            <div className="mb-verified-panel is-attention"><VerifyBadge state="pending">Saved for review</VerifyBadge><p className="mb-small">{b.bankName}. Our team will verify this account.</p></div>
          )}
        </div>

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

        <Divider />
        <h2 className="mb-section-title">Sales channel</h2>
        <ChoiceGroup<'online' | 'offline' | 'both'>
          legend="How do you sell?"
          name="channel"
          value={b.channel}
          columns={3}
          stacked
          options={[
            { value: 'online', label: 'Online', description: 'Website or app', icon: <IconGlobe /> },
            { value: 'offline', label: 'Offline', description: 'Physical store', icon: <IconStore /> },
            { value: 'both', label: 'Both', description: 'Online and in store', icon: <IconBoth /> }
          ]}
          onChange={(v) => { clear('channel'); setB({ channel: v }); }}
          error={errors.channel}
        />
        {needsWeb && (
          <Field label="Website URL" error={errors.websiteUrl}>
            {({ id, describedBy, invalid }) => <TextInput id={id} type="url" placeholder="https://yourstore.com" value={b.websiteUrl} aria-describedby={describedBy} invalid={invalid} onChange={(e) => { clear('websiteUrl'); setB({ websiteUrl: e.target.value }); }} />}
          </Field>
        )}
        {needsMap && (
          <div className="mb-row">
            <Field label="Store location (Google Maps link)" error={errors.mapsUrl}>
              {({ id, describedBy, invalid }) => <TextInput id={id} type="url" placeholder="https://maps.google.com/…" value={b.mapsUrl} aria-describedby={describedBy} invalid={invalid} onChange={(e) => { clear('mapsUrl'); setB({ mapsUrl: e.target.value }); }} />}
            </Field>
            <Field label="Number of branches" optional error={errors.branches}>
              {({ id, describedBy, invalid }) => <TextInput id={id} inputMode="numeric" placeholder="e.g. 2" value={b.branches} aria-describedby={describedBy} invalid={invalid} onChange={(e) => { clear('branches'); setB({ branches: e.target.value.replace(/\D/g, '').slice(0, 4) }); }} />}
            </Field>
          </div>
        )}

        <StepNav onNext={next} nextDisabled={b.ibanStatus === 'verifying' || b.vatLookup === 'checking'} />
      </form>
    </section>
  );
}
