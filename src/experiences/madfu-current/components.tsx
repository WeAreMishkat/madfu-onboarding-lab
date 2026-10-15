import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { MadfuWordmark } from '@/lab/BrandMarks';
import { StatusBadge } from '@/lab/StatusBadge';
import type { BadgeStatus } from '@/lab/evidence';
import type { FlowCtx, Values } from '@/engine/types';
import { wait } from '@/lib/timing';
import { DEMO_BANK_BENEFICIARY, PASSWORD_RULES, SA_IBAN_RE, ibanVerified, str, verifiedBankFor } from './data';

/* --------------------------------------------------------------------------------------------
 * Product-look pieces (reproduce the current Madfu vendor portal)
 * ------------------------------------------------------------------------------------------ */

export const WIZARD_STEPS = ['Create Account', 'Merchant Information', 'Business Information', 'Contract Sign-off'];

/** The real wizard stepper: dots on a line, labels below (MDF-RULE-000088). */
export function MadfuStepper({ current, steps }: { current: number; steps: string[] }) {
  return (
    <ol
      className="mc-stepper"
      aria-label="Madfu onboarding steps"
      style={{ ['--mc-steps' as string]: steps.length, ['--mc-fill-n' as string]: current / Math.max(steps.length - 1, 1) }}
    >
      {steps.map((s, i) => (
        <li key={s} className={i < current ? 'is-done' : i === current ? 'is-current' : ''} aria-current={i === current ? 'step' : undefined}>
          <span className="mc-step-dot" aria-hidden="true" />
          <span className="mc-step-label">{s}</span>
        </li>
      ))}
    </ol>
  );
}

export function MadfuHeader({ stepper }: { stepper?: { current: number; steps: string[] } }) {
  return (
    <div className="mc-header">
      <div className="mc-logo">
        <MadfuWordmark height={40} />
      </div>
      {stepper && <MadfuStepper current={stepper.current} steps={stepper.steps} />}
    </div>
  );
}

/** Madfu shows server answers as toasts; the Lab pins them at the top of the card. */
export function Toast({ tone, text }: { tone: 'success' | 'error'; text: string }) {
  return (
    <div className={`mc-toast mc-toast-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span className="mc-toast-icon" aria-hidden="true">
        {tone === 'success' ? (
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 4.5v4.2M8 11.2v.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        )}
      </span>
      <span>{text}</span>
    </div>
  );
}

/** Business Type pills. Switching type clears the identifier (MDF-RULE-000026). */
export function BusinessTypePills({ ctx }: { ctx: FlowCtx }) {
  const name = useId();
  const value = ctx.values.businessType === 'fl' ? 'fl' : 'cr';
  const opts = [
    { value: 'fl', label: 'Freelancer' },
    { value: 'cr', label: 'Registered Business' }
  ];
  return (
    <fieldset className="mc-pills">
      <legend>
        Business Type<span className="fx-req" aria-hidden="true"> *</span>
      </legend>
      <div className="mc-pills-row">
        {opts.map((o) => (
          <label key={o.value} className={`mc-pill ${value === o.value ? 'is-checked' : ''}`}>
            <span>{o.label}</span>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => ctx.set({ businessType: o.value, unifiedNumber: '', flNumber: '', leadError: '' })}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** "Didn't receive the Code? Resend the code in 1:59 seconds" (MDF-STATE-000075 / 000081). */
export function ResendTimer({ seconds, lead, action, onResend }: { seconds: number; lead?: string; action: string; onResend?: () => void }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (left <= 0) return;
    const t = window.setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => window.clearTimeout(t);
  }, [left]);
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');
  return (
    <p className="mc-resend">
      {lead && <span>{lead} </span>}
      <button type="button" className="mc-resend-btn" disabled={left > 0} onClick={() => { setLeft(seconds); onResend?.(); }}>
        {action}
      </button>
      {left > 0 && <span className="mc-resend-time"> in {mm}:{ss} seconds</span>}
    </p>
  );
}

export function PasswordChecklist({ values }: { values: Values }) {
  const pw = str(values, 'pw');
  const confirm = str(values, 'pwConfirm');
  return (
    <ul className="mc-checklist" aria-label="Rules the password must meet">
      {PASSWORD_RULES.map((r) => {
        const met = r.test(pw, confirm);
        return (
          <li key={r.label} className={met ? 'is-met' : ''}>
            <span className="mc-check-box" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            {r.label}
            <span className="sr-only">{met ? ' (met)' : ' (not met)'}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Header card above the wizard forms: identifier (and the CR name returned by Wathq). */
export function IdentifierCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="mc-idcard">
      <p>
        <strong>{label}</strong> <span>{value}</span>
      </p>
      {sub && <p className="mc-idcard-sub">{sub}</p>}
    </div>
  );
}

/** Wathq-verified CR card on Merchant Information (MDF-STATE-000097): all values retrieved, read-only. */
export function WathqCard({ unified, legalName, address }: { unified: string; legalName: string; address: string }) {
  return (
    <div className="mc-wathq-card">
      <div className="mc-wathq-rows">
        <p><strong>Unified Number</strong> <span>{unified}</span></p>
        <p><strong>Legal Business Name</strong> <span>{legalName}</span></p>
        <p className="mc-wathq-address">{address}</p>
      </div>
      <VerifiedBadge />
    </div>
  );
}

function VerifiedBadge() {
  return (
    <span className="mc-verified-badge">
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      Verified
    </span>
  );
}

/**
 * Server-side IBAN check (MDF-RULE-000093): VerifyIban is sent with the IBAN and the selected bank
 * only. The result (bank name, SWIFT) follows the IBAN; the IBAN then becomes read-only. Simulated:
 * the bank is derived from the IBAN's bank code and the SWIFT is synthetic.
 */
export function IbanVerification({ ctx }: { ctx: FlowCtx }) {
  const v = ctx.values;
  const iban = str(v, 'iban');
  const bank = str(v, 'bank');
  const verified = ibanVerified(v);
  const pending = !!bank && SA_IBAN_RE.test(iban) && !verified;
  const setRef = useRef(ctx.set);
  setRef.current = ctx.set;
  useEffect(() => {
    if (!pending) return;
    let live = true;
    void wait(1800).then(() => {
      if (!live) return;
      const b = verifiedBankFor(iban, bank);
      setRef.current({ ibanVerifiedFor: iban, verifiedBankName: b.verifiedName, verifiedSwift: b.swift, bankBeneficiary: DEMO_BANK_BENEFICIARY });
    });
    return () => {
      live = false;
    };
  }, [pending, iban, bank]);

  if (pending) {
    return (
      <p className="mc-proto-hint" role="status">
        Lab: waiting for the server-side IBAN check (about 8.5 s on TEST; shortened here).
      </p>
    );
  }
  if (!verified) return null;
  return (
    <div className="mc-iban-strip" role="status" aria-label="IBAN verification result">
      <div>
        <p><strong>Bank Name:</strong> {str(v, 'verifiedBankName')}</p>
        <p><strong>Swift Code:</strong> {str(v, 'verifiedSwift')}</p>
      </div>
      <VerifiedBadge />
    </div>
  );
}

/**
 * Embedded Signit signing (MDF-RULE-000102), simulated. The real frame is Arabic and shows the Madfu
 * merchant agreement; neither the agreement text nor the two required fields' content is reproduced.
 */
export function SignitFrame({ onSigned }: { onSigned: () => void }) {
  const [step, setStep] = useState<'notice' | 'fill' | 'sign'>('notice');
  const [filled, setFilled] = useState<[boolean, boolean]>([false, false]);
  const [signing, setSigning] = useState(false);
  const fill = (i: number) => setFilled((f) => (i === 0 ? [true, f[1]] : [f[0], true]));
  const sign = async () => {
    setSigning(true);
    await wait(1200);
    onSigned();
  };
  return (
    <section className="mc-signit" aria-label="Signit embedded signing (simulated)">
      <div className="mc-signit-bar">
        <span className="mc-signit-brand">Signit</span>
        <span className="mc-signit-sim">Simulated by the Lab · the real frame is in Arabic</span>
      </div>
      {step === 'notice' && (
        <div className="mc-signit-body">
          <p className="mc-signit-h">Signit terms and privacy notice</p>
          <p className="mc-signit-muted">The notice text is not reproduced.</p>
          <div className="mc-signit-nav">
            <button type="button" className="mc-signit-btn" onClick={() => setStep('fill')}>
              <span lang="ar">موافقة واستمرار</span> · Agree &amp; continue
            </button>
          </div>
        </div>
      )}
      {step === 'fill' && (
        <div className="mc-signit-body">
          <p className="mc-signit-h">Review the document and fill the required fields (2)</p>
          <div className="mc-contract-doc" role="img" aria-label="Madfu merchant agreement (content not reproduced)">
            <div className="mc-contract-lines" aria-hidden="true">
              {Array.from({ length: 7 }).map((_, i) => (
                <span key={i} style={{ width: `${92 - ((i * 13) % 30)}%` }} />
              ))}
            </div>
          </div>
          <div className="mc-signit-fields">
            {[0, 1].map((i) => (
              <button key={i} type="button" className={`mc-signit-field ${filled[i] ? 'is-filled' : ''}`} onClick={() => fill(i)} disabled={filled[i]}>
                {filled[i] ? `Required field ${i + 1} filled` : `Fill required field ${i + 1}`}
              </button>
            ))}
          </div>
          <p className="mc-signit-muted">Date fields are pre-filled (Gregorian, Hijri, weekday).</p>
          <div className="mc-signit-nav">
            <button type="button" className="mc-signit-btn mc-signit-btn-ghost" onClick={() => setStep('notice')}>Previous</button>
            <button type="button" className="mc-signit-btn" disabled={!filled[0] || !filled[1]} onClick={() => setStep('sign')}>Next</button>
          </div>
        </div>
      )}
      {step === 'sign' && (
        <div className="mc-signit-body">
          <div className="mc-signit-dialog" role="dialog" aria-label="Signature">
            <p className="mc-signit-h">Signature</p>
            <div className="mc-signit-pad" aria-hidden="true">
              <svg width="160" height="48" viewBox="0 0 160 48"><path d="M6 34c14-22 22-24 26-10s10 14 18-2 14-16 18 0 12 10 22-6 18-10 26 4" fill="none" stroke="#30343d" strokeWidth="2" strokeLinecap="round" /></svg>
            </div>
            <div className="mc-signit-nav">
              <button type="button" className="mc-signit-btn mc-signit-btn-ghost" onClick={() => setStep('fill')} disabled={signing}>Previous</button>
              <button type="button" className="mc-signit-btn" onClick={() => void sign()} disabled={signing}>
                {signing ? 'Signing…' : 'Sign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

const OFFER_CARDS: Array<{ title: string; text: string; icon: ReactNode }> = [
  {
    title: '7% Special Offer',
    text: 'Take advantage of an exclusive offer when activating Madfu',
    icon: <svg width="34" height="34" viewBox="0 0 34 34"><rect x="3" y="3" width="28" height="28" rx="7" fill="#F26B3A" /><path d="M11 23L23 11" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" /><circle cx="12.5" cy="12.5" r="2.4" fill="#fff" /><circle cx="21.5" cy="21.5" r="2.4" fill="#fff" /></svg>
  },
  {
    title: 'Weekly Transfers',
    text: 'Receive your payments weekly and in a clear manner.',
    icon: <svg width="34" height="34" viewBox="0 0 34 34"><rect x="4" y="6" width="26" height="24" rx="5" fill="#E7EEFB" stroke="#3B6BD6" strokeWidth="1.6" /><rect x="4" y="6" width="26" height="7" rx="3" fill="#3B6BD6" /><circle cx="11" cy="20" r="1.6" fill="#3B6BD6" /><circle cx="17" cy="20" r="1.6" fill="#3B6BD6" /><circle cx="23" cy="20" r="1.6" fill="#3B6BD6" /></svg>
  },
  {
    title: 'Instant Processing',
    text: 'Get started with Madfu easily and in no time.',
    icon: <svg width="34" height="34" viewBox="0 0 34 34"><path d="M19 3L8 19h8l-2 12 12-17h-8l1-11z" fill="#F5B82E" /></svg>
  },
  {
    title: 'Marketing Support',
    text: "We enhance your store's visibility via Madfu marketing channels and campaigns.",
    icon: <svg width="34" height="34" viewBox="0 0 34 34"><path d="M6 13h6l12-7v22l-12-7H6z" fill="#6B3BD6" /><rect x="8" y="21" width="4" height="7" rx="1.5" fill="#6B3BD6" /></svg>
  }
];

export function OfferCards() {
  return (
    <ul className="mc-offer-cards">
      {OFFER_CARDS.map((c) => (
        <li key={c.title} className="mc-offer-card">
          <span className="mc-offer-icon" aria-hidden="true">{c.icon}</span>
          <p className="mc-offer-title">{c.title}</p>
          <p className="mc-offer-text">{c.text}</p>
        </li>
      ))}
    </ul>
  );
}

export function DocIllustration() {
  return (
    <div className="mc-illustration" aria-hidden="true">
      <svg width="72" height="80" viewBox="0 0 72 80">
        <rect x="12" y="6" width="44" height="64" rx="6" fill="#F3F5F8" stroke="#C9CFD8" strokeWidth="2" />
        <path d="M22 20h20M22 28h24M22 36h16M22 44h22" stroke="#7B8494" strokeWidth="3" strokeLinecap="round" />
        <path d="M40 58l6 6 12-14" fill="none" stroke="#2BC4B4" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function EnvelopeIllustration() {
  return (
    <div className="mc-illustration" aria-hidden="true">
      <svg width="96" height="72" viewBox="0 0 96 72">
        <rect x="6" y="8" width="84" height="56" rx="8" fill="#EEF1F6" stroke="#C9CFD8" strokeWidth="2" />
        <path d="M8 12l40 28 40-28" fill="none" stroke="#B5BDCA" strokeWidth="2.4" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** Collapsible summary section, like the three blocks on the real Summary (MDF-RULE-000084). */
export function SummarySection({ title, rows, files }: { title: string; rows?: Array<[string, string]>; files?: string[] }) {
  return (
    <details className="mc-collapse">
      <summary>
        <span>{title}</span>
        <svg className="mc-collapse-chev" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </summary>
      {rows && (
        <dl className="mc-collapse-body">
          {rows.map(([k, val]) => (
            <div key={k} className="mc-kv">
              <dt>{k}:</dt>
              <dd>{val || '-'}</dd>
            </div>
          ))}
        </dl>
      )}
      {files && (
        <ul className="mc-collapse-body mc-files">
          {files.map((f) => (
            <li key={f}>
              <span className="mc-pdf" aria-hidden="true">PDF</span>
              {f}
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

export function RatingHint() {
  return <p className="mc-rating-hint">5 means that you are fully satisfied and 1 means that you are extremely unsatisfied</p>;
}

/* --------------------------------------------------------------------------------------------
 * Lab-only pieces (clearly not Madfu product UI)
 * ------------------------------------------------------------------------------------------ */

export function LabNote({ title, children, status }: { title?: string; children: ReactNode; status?: BadgeStatus }) {
  return (
    <aside className="mc-lab-note" aria-label="Lab annotation">
      <p className="mc-lab-tag">
        <span>Lab annotation · not part of Madfu&apos;s UI</span>
        {status && <StatusBadge status={status} size="xs" />}
      </p>
      {title && <p className="mc-lab-title">{title}</p>}
      <div className="mc-lab-body">{children}</div>
    </aside>
  );
}

export function LabButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="mc-lab-btn" onClick={onClick}>
      <span className="mc-lab-chip">Lab</span> {children}
    </button>
  );
}

export function LabChoice({
  legend,
  value,
  options,
  onPick
}: {
  legend: string;
  value: string;
  options: Array<{ value: string; label: string; status?: BadgeStatus }>;
  onPick: (v: string) => void;
}) {
  const name = useId();
  return (
    <fieldset className="mc-lab-choice">
      <legend>
        <span className="mc-lab-chip">Lab</span> {legend}
      </legend>
      <div className="mc-lab-options">
        {options.map((o) => (
          <label key={o.value} className={value === o.value ? 'is-checked' : ''}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onPick(o.value)} />
            <span>{o.label}</span>
            {o.status && <StatusBadge status={o.status} size="xs" />}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
