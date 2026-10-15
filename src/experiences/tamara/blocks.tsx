import { useId, type ReactNode } from 'react';
import { StatusBadge } from '@/lab/StatusBadge';
import type { BadgeStatus } from '@/lab/evidence';
import type { FlowCtx, Values } from '@/engine/types';
import {
  DEMO_BENEFICIARY,
  DEMO_NAFATH_NUMBER,
  MISMATCH_IBAN_SUFFIX,
  REJECTED_FL_SUFFIX,
  demoIban,
  ibanValid
} from './demo';

/* Custom blocks for behaviour the declarative engine does not express on its own
 * (per-field verify buttons with attempt counters, the Nafath number match, Lean "Verify account",
 * and reviewer-reopen editing rules). All checks are simulated and deterministic. */

export const REOPEN_REASON = 'G-maps link has no images';
export const BANK_MISMATCH = 'The bank details provided do not match the business number.';
export const CR_CANCELLED = 'Your commercial registration has been cancelled.';
export const CR_INVALID = 'Invalid CR number';
export const MAX_ATTEMPTS = 3;

/** Small, clearly-labelled box listing the demo values that trigger each branch. */
export function DemoHint({ items }: { items: string[] }) {
  return (
    <aside className="tm-demo" aria-label="Demo values">
      <p className="tm-demo-title">Demo values</p>
      <ul>{items.map((t) => <li key={t}>{t}</li>)}</ul>
    </aside>
  );
}

/** Lab-only note inside the product card (not product UI). */
export function LabNote({ status, title, children }: { status: BadgeStatus; title: string; children: ReactNode }) {
  return (
    <aside className="tm-labnote" aria-label={`Lab note: ${title}`}>
      <p className="tm-labnote-head">
        <span className="tm-labnote-kicker">Lab note</span>
        <strong>{title}</strong>
        <StatusBadge status={status} size="xs" />
      </p>
      <div className="tm-labnote-body">{children}</div>
    </aside>
  );
}

/** Shown on every screen a Freelancer reaches after Step 1: nothing past Step 1 was walked for a Freelancer. */
export function FreelancerNotWalked() {
  return (
    <LabNote status="UNKNOWN" title="Freelancer: not walked past Step 1">
      <p>
        A new Freelancer application was never walked: only Step 1 with Freelancer selected was seen. This screen is the Registered Business version, observed on a
        new CR application; whether a Freelancer sees the same screen is not established.
      </p>
    </LabNote>
  );
}

/** The CR core model: which party each verification binds, and which provider answers. */
export function CoreModel() {
  const rows: Array<{ k: string; v: string; s: BadgeStatus }> = [
    { k: 'Yearly sales', v: 'Asked on the contact step (Below / Above SAR 20 million). Above routes to a sales call and skips every verification below', s: 'OBSERVED' },
    { k: 'Business', v: 'Unified National Number checked on Verify (Lean), 3 attempts; cancelled registrations refused', s: 'OBSERVED' },
    { k: 'Person', v: 'Legal signatory picked from the registry associates -> SMS code to the application mobile -> Nafath push to the selected associate', s: 'OBSERVED' },
    { k: 'Bank', v: 'IBAN -> "Verify account" by Lean; beneficiary fetched and locked. Seen on the resumed application only', s: 'OBSERVED' }
  ];
  return (
    <LabNote status="OBSERVED" title="CR core model">
      <dl className="tm-model">
        {rows.map((r) => (
          <div key={r.k} className="tm-model-row">
            <dt>{r.k}</dt>
            <dd>{r.v} <StatusBadge status={r.s} size="xs" /></dd>
          </div>
        ))}
      </dl>
    </LabNote>
  );
}

/**
 * Freelancer "Verify" with 3 attempts. The fields come from the session transcript only and Verify was
 * never run, so the outcome is simulated.
 */
export function FreelancerVerify({ ctx }: { ctx: FlowCtx }) {
  const v = ctx.values;
  const attempts = Number(v.flAttempts ?? 0);
  const verified = !!v.flVerified;
  const fl = String(v.flNumber ?? '');
  const exhausted = attempts >= MAX_ATTEMPTS && !verified;
  const counter = Math.min(attempts + 1, MAX_ATTEMPTS);
  return (
    <div className="tm-verify">
      <div className="tm-verify-row">
        <button
          type="button"
          className="fx-btn fx-btn-secondary"
          disabled={ctx.busy || verified || exhausted || fl.length === 0}
          onClick={() =>
            ctx.run({
              label: 'Verify',
              loading: { ms: 900, label: 'Verifying…' },
              set: (x) => {
                const n = Number(x.flAttempts ?? 0) + 1;
                const ok = !String(x.flNumber ?? '').endsWith(REJECTED_FL_SUFFIX);
                return { flAttempts: n, flVerified: ok, flError: ok ? '' : 'fail' };
              }
            })
          }
        >
          {verified ? 'Verified' : `Verify ${counter} / ${MAX_ATTEMPTS}`}
        </button>
        <StatusBadge status="UNKNOWN" size="xs" note="Verify was never run: what it checks, which system answers and what follows are not established." />
      </div>
      {verified && <p className="tm-ok" role="status">Freelancer certificate verified (simulated).</p>}
      {v.flError === 'fail' && !verified && !exhausted && (
        <p className="fx-error" role="alert">Verification failed (simulated). The real failure message was not observed.</p>
      )}
      {exhausted && (
        <p className="fx-error" role="alert">
          No verification attempts left (simulated). What the applicant sees after the third attempt was not observed.
        </p>
      )}
    </div>
  );
}

export const crLocked = (v: Values) => !!v.crVerified && v.crVerifiedFor === v.unn;
export const crAttempts = (v: Values) => Number(v.crAttempts ?? 0);

/** Result of the registry check for the number currently typed. */
export function CrResult({ ctx }: { ctx: FlowCtx }) {
  const v = ctx.values;
  if (crLocked(v)) {
    return <p className="tm-ok" role="status">Verified</p>;
  }
  const failedHere = !!v.crFailedFor && v.crFailedFor === v.unn;
  if (crAttempts(v) >= MAX_ATTEMPTS) {
    return (
      <p className="fx-error" role="alert">
        No verification attempts left (simulated). What the applicant sees after the third failed attempt was not observed.
      </p>
    );
  }
  if (failedHere && v.crError === 'cancelled') {
    return <p className="fx-error" role="alert">{CR_CANCELLED}</p>;
  }
  if (failedHere && v.crError === 'invalid') {
    return <p className="fx-error" role="alert">{CR_INVALID}</p>;
  }
  return null;
}

/**
 * Verify with Nafath: number matching. The screen is observed (2026-10-14); the push went to the
 * selected associate, who did not approve it. Approval was never observed on a new application, so both
 * outcomes are simulated here and labelled as such.
 */
export function NafathWait({ ctx }: { ctx: FlowCtx }) {
  const attempts = Number(ctx.values.nafathAttempts ?? 1);
  return (
    <section className="tm-nafath" aria-label="Nafath verification">
      <p className="fx-muted">Open the Nafath app and choose this number:</p>
      <p className="tm-nafath-number" aria-label={`Nafath number ${DEMO_NAFATH_NUMBER}`}>{DEMO_NAFATH_NUMBER}</p>
      <ol className="fx-list">
        <li>Open the Nafath app.</li>
        <li>Accept the request.</li>
        <li>Choose the number shown here.</li>
        <li>Come back to this page. It can take up to a minute.</li>
      </ol>
      <div className="tm-sim-actions">
        <button type="button" className="fx-btn fx-btn-secondary" disabled title="Opens the Nafath app on a phone; not available in the Lab">
          Open Nafath App
        </button>
      </div>
      <LabNote status="UNKNOWN" title={`Simulate the signatory's answer (attempt ${Math.min(attempts, MAX_ATTEMPTS)} / ${MAX_ATTEMPTS})`}>
        <p>
          Observed: the Nafath push goes to the selected associate, not to the applicant. In the walk it was not approved and the step ended in "Nafath verification has
          rejected". An approval, and the screen after it, were never captured on a new application.
        </p>
        <div className="tm-sim-actions">
          <button
            type="button"
            className="fx-btn fx-btn-secondary"
            disabled={ctx.busy}
            onClick={() => ctx.run({ label: 'Not approved', loading: { ms: 900, label: 'Checking…' }, set: () => ({ nafathStatus: 'rejected' }), to: 'nafath-rejected' })}
          >
            Simulate: not approved (observed)
          </button>
          <button
            type="button"
            className="fx-btn fx-btn-secondary"
            disabled={ctx.busy}
            onClick={() =>
              ctx.run({ label: 'Approve', loading: { ms: 900, label: 'Confirming…' }, set: () => ({ nafathStatus: 'approved', nafathSimulated: true }), to: 'bank' })
            }
          >
            Simulate: approved (not captured)
          </button>
        </div>
      </LabNote>
    </section>
  );
}

/** Lean "Verify account": fetch the beneficiary from the bank and lock it, or report a mismatch. */
export function VerifyAccount({ ctx }: { ctx: FlowCtx }) {
  const v = ctx.values;
  const iban = String(v.iban ?? '').replace(/\s/g, '').toUpperCase();
  const verified = !!v.bankVerifiedIban && v.bankVerifiedIban === iban;
  const failed = v.bankFailedIban === iban && !!iban;
  if (verified) {
    return <p className="tm-ok" role="status">Account verified. Beneficiary name fetched from the bank.</p>;
  }
  return (
    <div className="tm-verify">
      <div className="tm-verify-row">
        <button
          type="button"
          className="fx-btn fx-btn-secondary"
          disabled={ctx.busy || !ibanValid(iban)}
          onClick={() =>
            ctx.run({
              label: 'Verify account',
              loading: { ms: 1100, label: 'Verifying…' },
              set: (x) => {
                const i = String(x.iban ?? '').replace(/\s/g, '').toUpperCase();
                if (i.endsWith(MISMATCH_IBAN_SUFFIX)) return { bankFailedIban: i, bankVerifiedIban: '', beneficiary: '' };
                return { bankVerifiedIban: i, bankFailedIban: '', beneficiary: DEMO_BENEFICIARY };
              }
            })
          }
        >
          Verify account
        </button>
      </div>
      {failed && <p className="fx-error" role="alert">{BANK_MISMATCH}</p>}
    </div>
  );
}

export const bankVerified = (v: Values) => {
  const iban = String(v.iban ?? '').replace(/\s/g, '').toUpperCase();
  return !!v.bankVerifiedIban && v.bankVerifiedIban === iban;
};

/* ---------- Reviewer reopen (TAM-RULE-000053 / 000057) ---------- */

function ReopenInput({ ctx, name, label, flagged, readOnlyValue }: { ctx: FlowCtx; name: string; label: string; flagged: boolean; readOnlyValue?: string }) {
  const id = useId();
  const v = ctx.values;
  const value = readOnlyValue ?? String(v[name] ?? '');
  return (
    <div className={`fx-field fx-text ${flagged ? 'tm-flagged' : 'fx-readonly'}`}>
      <label htmlFor={id}><span className="fx-label-row"><span className="fx-label-text">{label}</span></span></label>
      <div className="fx-input-wrap">
        <input
          id={id}
          value={value}
          readOnly={!flagged}
          aria-readonly={!flagged || undefined}
          aria-describedby={flagged ? `${id}-reason` : undefined}
          onChange={(e) => ctx.set({ [name]: e.target.value, [`edited_${name}`]: true })}
        />
      </div>
      {flagged && (
        <p className="tm-reason" id={`${id}-reason`}>
          <span className="tm-reason-kicker">Reviewer note:</span> {REOPEN_REASON}
        </p>
      )}
    </div>
  );
}

/** Reopened business verification: only the flagged field is editable; category and type locked. */
export function ReopenedBusiness({ ctx }: { ctx: FlowCtx }) {
  return (
    <div className="tm-reopen">
      <ReopenInput ctx={ctx} name="reopenType" label="Business type" flagged={false} readOnlyValue="Registered Business" />
      <ReopenInput ctx={ctx} name="reopenUnn" label="Unified National Number" flagged />
      <ReopenInput ctx={ctx} name="reopenCategory" label="Category" flagged={false} readOnlyValue="Personal & Professional Services" />
      {!ctx.values.edited_reopenUnn && (
        <p className="fx-muted">Continue stays disabled until every flagged field is edited. Retyping the same value is enough.</p>
      )}
    </div>
  );
}

/**
 * Reopened bank step deadlock, as observed: editing the IBAN replaces beneficiary + certificate with
 * "Verify account"; after verification the form reloads with the IBAN flag back and the certificate
 * cleared, so Continue never enables.
 */
export function ReopenedBank({ ctx }: { ctx: FlowCtx }) {
  const v = ctx.values;
  const phase = (v.reopenBankPhase as string) ?? 'flagged';
  const id = useId();
  const ibanFlagged = phase !== 'edited';
  return (
    <div className="tm-reopen">
      <div className={`fx-field fx-text ${ibanFlagged ? 'tm-flagged' : ''}`}>
        <label htmlFor={id}><span className="fx-label-row"><span className="fx-label-text">IBAN</span></span></label>
        <div className="fx-input-wrap">
          <input
            id={id}
            value={String(v.reopenIban ?? demoIban('4321'))}
            aria-describedby={ibanFlagged ? `${id}-reason` : undefined}
            onChange={(e) => ctx.set({ reopenIban: e.target.value, reopenBankPhase: 'edited' })}
          />
        </div>
        {ibanFlagged && (
          <p className="tm-reason" id={`${id}-reason`}><span className="tm-reason-kicker">Reviewer note:</span> {REOPEN_REASON}</p>
        )}
      </div>

      {phase === 'edited' ? (
        <div className="tm-verify-row">
          <button
            type="button"
            className="fx-btn fx-btn-secondary"
            disabled={ctx.busy}
            onClick={() => ctx.run({ label: 'Verify account', loading: { ms: 1100, label: 'Verifying…' }, set: () => ({ reopenBankPhase: 'reloaded' }) })}
          >
            Verify account
          </button>
        </div>
      ) : (
        <>
          <div className={`fx-field fx-text fx-readonly ${phase === 'flagged' ? 'tm-flagged' : ''}`}>
            <span className="fx-label-row"><span className="fx-label-text">Beneficiary name</span></span>
            <div className="fx-input-wrap"><input aria-label="Beneficiary name" value={DEMO_BENEFICIARY} readOnly /></div>
            {phase === 'flagged' && <p className="tm-reason"><span className="tm-reason-kicker">Reviewer note:</span> {REOPEN_REASON}</p>}
            {phase === 'reloaded' && <p className="fx-hint">Fetched from the bank and locked.</p>}
          </div>
          <div className={`fx-field ${phase === 'flagged' ? 'tm-flagged' : ''}`}>
            <span className="fx-upload-label">Upload IBAN Certificate *</span>
            <div className={`fx-dropzone ${phase === 'flagged' ? 'has-file' : ''}`}>
              {phase === 'flagged' ? <span className="fx-file-name">iban-certificate.pdf</span> : <span className="fx-muted">Certificate cleared: required again.</span>}
            </div>
            {phase === 'flagged' && <p className="tm-reason"><span className="tm-reason-kicker">Reviewer note:</span> {REOPEN_REASON}</p>}
          </div>
        </>
      )}

      {phase === 'reloaded' && (
        <div className="fx-notice fx-notice-error" role="alert">
          <p className="fx-notice-title">The IBAN flag is back</p>
          <p>After verification the form reloaded with the reviewer flag on the IBAN and the certificate cleared. Editing the IBAN again restarts verification. Continue never enables: this is the deadlock that ended the walk.</p>
        </div>
      )}
    </div>
  );
}
