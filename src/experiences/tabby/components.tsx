import { useEffect, useRef, type ReactNode } from 'react';
import { StatusBadge } from '@/lab/StatusBadge';
import type { BadgeStatus } from '@/lab/evidence';
import type { FlowCtx } from '@/engine/types';
import { wait } from '@/lib/timing';
import {
  DEMO_UN_EXPIRED,
  DEMO_UN_NO_ADDRESS,
  DEMO_UN_VALID,
  MSG_UN_INVALID,
  isEmail,
  isSaIban,
  lookupIban,
  lookupUnifiedNumber,
  normIban,
  unLookedUp,
  unLookupInvalid,
  unLookupValid,
  unValue
} from './data';

/**
 * Custom blocks for the Tabby experience. They only use the public FlowCtx (values, set, errors),
 * so the engine is not modified.
 */

/** A Lab annotation: visually distinct from the product UI, never Tabby copy. */
export function LabNote({ status, title, children }: { status?: BadgeStatus; title?: string; children: ReactNode }) {
  return (
    <aside className="tb-labnote" aria-label={title ? `Lab note: ${title}` : 'Lab note'}>
      <p className="tb-labnote-head">
        <span className="tb-labnote-tag">Lab note</span>
        {title && <span className="tb-labnote-title">{title}</span>}
        {status && <StatusBadge status={status} size="xs" />}
      </p>
      <div className="tb-labnote-body">{children}</div>
    </aside>
  );
}

// ---------------------------------------------------------------- Cloudflare Turnstile (simulated)
/**
 * Appears once a syntactically valid email is typed and auto-passes ("Success!") as it did in the
 * user's real browser (TAB-STATE-000027). Continue stays disabled until it passes.
 */
export function TurnstileCheck({ ctx }: { ctx: FlowCtx }) {
  const email = String(ctx.values.email ?? '').trim();
  const valid = isEmail(email);
  const passed = valid && ctx.values.turnstileFor === email;
  const { set } = ctx;
  useEffect(() => {
    if (!valid || passed) return;
    let alive = true;
    void wait(1200).then(() => {
      if (alive) set({ turnstileFor: email });
    });
    return () => {
      alive = false;
    };
  }, [email, valid, passed, set]);
  if (!valid) return null;
  return (
    <div className={`tb-turnstile ${passed ? 'is-passed' : ''}`} role="status" aria-live="polite">
      {passed ? (
        <svg className="tb-turnstile-icon" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
          <circle cx="11" cy="11" r="10" fill="currentColor" />
          <path d="M6.5 11.2l3 3 6-6.4" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <span className="fx-spinner tb-turnstile-spin" aria-hidden="true" />
      )}
      <span className="tb-turnstile-text">{passed ? 'Success!' : 'Verifying you are human…'}</span>
      <span className="tb-turnstile-brand">Cloudflare · simulated</span>
    </div>
  );
}

/** "Change email" and a disabled "Resend code (02:00)" under the code field. */
export function CodeLinks({ ctx, changeLabel }: { ctx: FlowCtx; changeLabel: string }) {
  return (
    <div className="tb-code-links">
      <button type="button" className="fx-link" onClick={ctx.back} disabled={ctx.busy}>
        {changeLabel}
      </button>
      <button type="button" className="tb-resend" disabled>
        Resend code (02:00)
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- Unified Number lookup
/**
 * Placed directly after the Unified number field. Listens to that input's blur (the trigger
 * observed in TAB-NET-000059) and runs the simulated Tabby backend lookup for any value starting
 * with 7. Values not starting with 7 are stopped by the field's own client validation (no request).
 */
export function UnifiedNumberLookup({ ctx }: { ctx: FlowCtx }) {
  const anchor = useRef<HTMLDivElement>(null);
  const live = useRef(ctx);
  live.current = ctx;

  useEffect(() => {
    const input = anchor.current?.previousElementSibling?.querySelector('input');
    if (!input) return;
    let alive = true;
    const onBlur = async () => {
      const value = input.value.trim();
      if (!value.startsWith('7')) return; // client rule: no request
      const { values, set } = live.current;
      if (values.unChecked === value || values.unPending === value) return; // cached per value
      set({ unPending: value });
      await wait(900);
      if (!alive) return;
      const r = lookupUnifiedNumber(value);
      live.current.set({
        unPending: '',
        unChecked: value,
        unValid: r.is_valid,
        unAddressReturned: r.is_valid && !!r.legal_address,
        // is_valid=false: every prefilled value is cleared (TAB-RULE-000073).
        legalCompanyName: r.is_valid ? r.legal_company_name : '',
        legalAddress: r.is_valid ? r.legal_address : ''
      });
    };
    input.addEventListener('blur', onBlur);
    return () => {
      alive = false;
      input.removeEventListener('blur', onBlur);
    };
  }, []);

  const v = ctx.values;
  const pending = !!v.unPending && v.unPending === unValue(v);
  const showGenericError = unLookupInvalid(v) && !ctx.errors.unifiedNumber;

  return (
    <div ref={anchor} className="tb-un">
      {pending && (
        <p className="tb-inline-status" role="status">
          <span className="fx-spinner" aria-hidden="true" /> Checking unified number…
        </p>
      )}
      {showGenericError && (
        <p className="fx-error tb-un-error" role="alert">
          {MSG_UN_INVALID}
        </p>
      )}
    </div>
  );
}

/** Lab annotation of what the last lookup returned that Tabby does not show. */
export function UnifiedLookupData({ ctx }: { ctx: FlowCtx }) {
  const v = ctx.values;
  if (!unLookedUp(v)) return null;
  return <HiddenLookupData valid={unLookupValid(v)} r={lookupUnifiedNumber(unValue(v))} />;
}

function HiddenLookupData({ valid, r }: { valid: boolean; r: ReturnType<typeof lookupUnifiedNumber> }) {
  if (!valid && r.owners == null) {
    return (
      <LabNote title="Lookup response (simulated)" status="OBSERVED">
        HTTP 200 with <code>is_valid=false</code>, empty strings and <code>company_owners: null</code>. Tabby shows the
        generic error and hides the Legal address field.
      </LabNote>
    );
  }
  return (
    <LabNote title={valid ? 'Returned by the lookup but never displayed' : 'Expired / inactive registration'} status={valid ? 'INFERRED' : 'OBSERVED'}>
      {valid ? (
        <p>
          Stored silently in the draft's <code>legal_info</code>: CR number, licence expiry ({r.license_expire_date}), licence type
          id (meaning unknown) and <strong>{r.owners} company owner{r.owners === 1 ? '' : 's'}</strong> with names, nationalities,
          national ID numbers and shareholder / signatory / UBO flags. The applicant never sees or confirms them.
        </p>
      ) : (
        <p>
          The response still carried the company's data (legal name, CR number, expiry, licence type) and{' '}
          <strong>{r.owners} owners</strong>, with <code>is_active=false</code>, <code>is_expired=true</code> and{' '}
          <code>is_valid=false</code>. Tabby shows only the generic error and clears every prefilled value. The specific
          "business is inactive / has expired / licence expires soon" messages exist in code only for <code>is_valid=true</code>.
        </p>
      )}
    </LabNote>
  );
}

/** Lookup architecture, as far as the evidence reaches. */
export function LookupArchitecture() {
  const nodes: Array<{ label: string; sub: string; status: BadgeStatus }> = [
    { label: 'Unified Number', sub: 'typed, on blur', status: 'OBSERVED' },
    { label: 'Tabby backend', sub: 'GET licence-unified-number', status: 'OBSERVED' },
    { label: 'Registry provider', sub: 'not identifiable', status: 'UNKNOWN' },
    { label: 'Licence + owner data', sub: '29 fields', status: 'OBSERVED' },
    { label: 'is_valid', sub: 'autofill or generic error', status: 'OBSERVED' }
  ];
  return (
    <LabNote title="How the Unified Number lookup works">
      <ol className="tb-chain" aria-label="Lookup chain">
        {nodes.map((n) => (
          <li key={n.label} className={`tb-chain-node ${n.status === 'UNKNOWN' ? 'is-unknown' : ''}`}>
            <span className="tb-chain-label">{n.label}</span>
            <span className="tb-chain-sub">{n.sub}</span>
            <StatusBadge status={n.status} size="xs" />
          </li>
        ))}
      </ol>
      <p className="tb-labnote-small">
        The browser only calls Tabby's own origin (Cloudflare + Envoy). No provider name appears in headers, response,
        bundles or config. Owner and signatory data is returned but never displayed; authority remains the self-declared
        checkbox on the review page.
      </p>
    </LabNote>
  );
}

export function UnifiedDemoValues() {
  return (
    <div className="tb-demo" aria-label="Demo values">
      <span className="tb-demo-tag">Demo values</span>
      <ul>
        <li><code>{DEMO_UN_VALID}</code> valid, name + address returned</li>
        <li><code>{DEMO_UN_NO_ADDRESS}</code> valid, no address returned</li>
        <li><code>{DEMO_UN_EXPIRED}</code> expired / inactive (is_valid=false)</li>
        <li>any other number starting with 7: is_valid=false</li>
        <li>a number not starting with 7: client error, no request</li>
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- IBAN lookup
/**
 * Runs the simulated IBAN lookup once a complete SA IBAN is typed (GET iban/{IBAN}, TAB-NET-000009).
 * Clearing the IBAN does not clear the derived bank name and SWIFT (TAB-RULE-000057).
 */
export function IbanLookup({ ctx }: { ctx: FlowCtx }) {
  const iban = normIban(ctx.values.iban);
  const ready = isSaIban(iban);
  const checked = ctx.values.ibanChecked === iban;
  const { set } = ctx;
  useEffect(() => {
    if (!ready || checked) return;
    let alive = true;
    set({ ibanPending: iban });
    void wait(900).then(() => {
      if (!alive) return;
      set({ ibanPending: '', ibanChecked: iban, ...lookupIban(iban) });
    });
    return () => {
      alive = false;
    };
  }, [iban, ready, checked, set]);
  if (!ready || checked) return null;
  return (
    <p className="tb-inline-status" role="status">
      <span className="fx-spinner" aria-hidden="true" /> Looking up bank…
    </p>
  );
}

// ---------------------------------------------------------------- store map (exactly 1 location)
export function StoreMap({ ctx }: { ctx: FlowCtx }) {
  const pinned = !!String(ctx.values.storeAddress ?? '').trim();
  return (
    <div className="tb-map" role="img" aria-label={pinned ? 'Map with the store pin placed' : 'Map, no pin placed yet'}>
      <div className="tb-map-grid" aria-hidden="true" />
      {pinned && (
        <svg className="tb-map-pin" width="28" height="36" viewBox="0 0 28 36" aria-hidden="true">
          <path d="M14 1C7 1 1.5 6.4 1.5 13.3 1.5 22.5 14 35 14 35s12.5-12.5 12.5-21.7C26.5 6.4 21 1 14 1z" fill="#0d0d0d" />
          <circle cx="14" cy="13" r="4.5" fill="#3effc0" />
        </svg>
      )}
      <span className="tb-map-caption">Map search (simulated). The pin follows the address below.</span>
    </div>
  );
}
