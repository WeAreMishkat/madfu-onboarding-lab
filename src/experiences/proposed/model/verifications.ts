/**
 * Reusable-verification model.
 *
 * Rule: previously successful external checks are reused until their dependent data changes or an
 * explicit freshness policy invalidates them. An ordinary resume therefore costs one OTP and nothing
 * else. Negative and technical results follow their OWN policy per result type (NEGATIVE_POLICY):
 * there is no universal expiry. Every external call, reuse and invalidation is written to the
 * application's ledger so the Internal view can show what a resume would cost.
 */
import { COST_ASSUMPTIONS_SAR } from './config';
import type { Application, LedgerEntry, VerificationRecord, VerificationType } from './types';

export const VERIFICATION_LABEL: Record<VerificationType | 'OTP', string> = {
  CR_DATA: 'CR data (status, age, activities, National Address, entity)',
  PERSONS: 'Owners / managers on the CR',
  MOBILE_MATCH: 'Mobile ↔ National ID ownership',
  NAFATH: 'Nafath',
  FL_CERTS: 'Freelancer Certificate (existence + details)',
  IBAN: 'Freelancer IBAN ↔ certificate linkage',
  OTP: 'SMS OTP'
};

export const VERIFICATION_SOURCE: Record<VerificationType, string> = {
  CR_DATA: 'Government CR registry (simulated)',
  PERSONS: 'Government associated parties (simulated)',
  MOBILE_MATCH: 'Mobile ownership service (simulated; provider open)',
  NAFATH: 'Nafath (simulated)',
  FL_CERTS: 'Freelance platform (simulated)',
  IBAN: 'Bank / certificate linkage provider (simulated)'
};

/** What each result depends on (shown in docs and the Internal view). */
export const DEPENDS_ON: Record<VerificationType, string> = {
  CR_DATA: 'CR identity',
  PERSONS: 'CR identity',
  MOBILE_MATCH: 'Mobile + National ID of the verifying person',
  NAFATH: 'Application + verifying person (National ID)',
  FL_CERTS: 'National ID',
  IBAN: 'IBAN + National ID + selected certificate'
};

/** Order of paid calls per applicant type (backend). */
export const CALL_ORDER = {
  CR: ['OTP', 'CR_DATA', 'PERSONS', 'MOBILE_MATCH', 'NAFATH'] as const,
  FL_CERT: ['OTP', 'FL_CERTS', 'MOBILE_MATCH', 'NAFATH', 'IBAN'] as const
};

export const costOf = (t: VerificationType | 'OTP') => COST_ASSUMPTIONS_SAR[t] ?? null;

/**
 * Freshness policy for SUCCESSFUL results, in days. null = no policy defined: "Reusable until
 * invalidated". PRODUCT/ENGINEERING DECISION: the policy per verification is open.
 */
export const FRESHNESS_DAYS: Record<VerificationType, number | null> = {
  CR_DATA: null,
  PERSONS: null,
  MOBILE_MATCH: null,
  NAFATH: null,
  FL_CERTS: null,
  IBAN: null
};

/** Negative / technical results: one policy per result type. Configuration, not code paths in screens. */
export const NEGATIVE_POLICY: Array<{ result: string; policy: string; merchantSees: string; repeatCall: string }> = [
  { result: 'Provider unavailable (CR, people, certificate, IBAN)', policy: 'Retry later. Retries are counted per session and reset on resume; nothing is cached as a result.', merchantSees: 'Try again / Save & exit', repeatCall: 'Yes, on retry or resume' },
  { result: 'Nafath technical failure', policy: `Does not use an attempt; bounded per session, reset on resume.`, merchantSees: 'Try again later', repeatCall: 'Yes, bounded' },
  { result: 'CR expired / suspended', policy: 'Application saved as PAUSED_CR and handed to Sales. The CR is re-checked only in the controlled Sales recovery after correction.', merchantSees: 'Update your CR; Sales will help you continue (no Refresh button)', repeatCall: 'Only in the controlled recovery' },
  { result: 'CR age', policy: 'Not a negative result: a risk attribute, recalculated whenever the CR is retrieved again.', merchantSees: 'Nothing', repeatCall: 'No' },
  { result: 'Mobile ↔ National ID mismatch', policy: 'A corrected mobile needs a new OTP and a new match check; after the configured checks the verification step pauses.', merchantSees: 'Use another mobile number', repeatCall: 'One new check per corrected mobile' },
  { result: 'Nafath rejected / timed out', policy: 'Uses one of the application’s attempts; after the last one, details are still collected and the application goes to manual verification without a contract.', merchantSees: 'Retry while attempts remain', repeatCall: 'Bounded' },
  { result: 'Certificate changed', policy: 'Invalidates the checks that depend on it (IBAN linkage, category).', merchantSees: 'Re-verify the IBAN', repeatCall: 'IBAN only' },
  { result: 'IBAN changed', policy: 'Invalidates the IBAN check only; a different IBAN starts with fresh attempts.', merchantSees: 'Verify the new IBAN', repeatCall: 'IBAN only' },
  { result: 'IBAN ownership mismatch', policy: `Two mismatches for the same IBAN; then a different IBAN is required. Technical errors do not count.`, merchantSees: 'Enter another IBAN', repeatCall: 'Only for a different IBAN' },
  { result: 'Nafath / certificate / CR success', policy: 'Reusable until a dependency changes or a freshness policy (open) says otherwise.', merchantSees: 'Nothing', repeatCall: 'No' }
];

/**
 * Edits after verification. Sensitive, verified sections are LOCKED (no edit path); only the
 * sections below can be edited, transactionally (draft → Save applies, Cancel restores everything).
 */
export const EDIT_POLICY: Array<{ section: string; editable: boolean; invalidates: VerificationType[]; note: string }> = [
  { section: 'Applicant type, CR / National ID', editable: false, invalidates: [], note: 'Locked: start a new application for another business' },
  { section: 'Declared category (Page 1)', editable: false, invalidates: [], note: 'Locked once the application exists; the verified government category is authoritative' },
  { section: 'Verified government data, activities, verified category', editable: false, invalidates: [], note: 'Locked: retrieved, never typed' },
  { section: 'Selected owner / manager, verified mobile', editable: false, invalidates: [], note: 'Locked after Nafath' },
  { section: 'Freelancer Certificate', editable: false, invalidates: [], note: 'Locked after selection is confirmed' },
  { section: 'Freelancer IBAN (verified)', editable: false, invalidates: [], note: 'Locked once verified; before that it is edited on Business Details (IBAN check only)' },
  { section: 'Store presence (website / Google Maps)', editable: true, invalidates: [], note: 'Re-validates the URL format only' },
  { section: 'Commercial rate review request', editable: true, invalidates: [], note: 'Standard offer unchanged; internal flag only' }
];

export const addDays = (iso: string, days: number) => new Date(new Date(iso).getTime() + days * 86_400_000).toISOString();

export function makeRecord(type: VerificationType, fingerprint: string, result: string, at: string, providerRef: string): VerificationRecord {
  const days = FRESHNESS_DAYS[type];
  return {
    type, fingerprint, dependsOn: DEPENDS_ON[type], result, at, source: VERIFICATION_SOURCE[type], providerRef,
    status: 'valid', invalidatedReason: null, expiresAt: days === null ? null : addDays(at, days)
  };
}

/** A stored result is reusable when it is valid, obtained for the same inputs and not expired. */
export function reusable(app: Application, type: VerificationType, fingerprint: string, now = new Date().toISOString()): VerificationRecord | null {
  const r = app.verifications[type];
  if (!r || r.status !== 'valid' || r.fingerprint !== fingerprint) return null;
  if (r.expiresAt && r.expiresAt <= now) return null;
  return r;
}

export const log = (app: Application, entry: Omit<LedgerEntry, 'at'>, at = new Date().toISOString()): Application => ({ ...app, ledger: [...app.ledger, { ...entry, at }] });

export function store(app: Application, rec: VerificationRecord): Application {
  return { ...app, verifications: { ...app.verifications, [rec.type]: rec } };
}

export function invalidate(app: Application, types: VerificationType[], reason: string): Application {
  let next = app;
  for (const t of types) {
    const r = next.verifications[t];
    if (!r || r.status !== 'valid') continue;
    next = store(next, { ...r, status: 'invalidated', invalidatedReason: reason });
    next = log(next, { kind: 'invalidate', check: t, note: reason });
  }
  return next;
}

/** On resume: every valid stored result is reused, nothing is called again. */
export function reuseOnResume(app: Application): Application {
  let next = app;
  for (const r of Object.values(app.verifications)) {
    if (r && r.status === 'valid') next = log(next, { kind: 'reuse', check: r.type, note: 'Verified previously — reused on resume, no new provider call' });
  }
  return next;
}

/** External calls (and OTPs) logged since a ledger position: used by tests and the Internal view. */
export const callsSince = (app: Application, from: number) => app.ledger.slice(from).filter((e) => e.kind === 'call' || e.kind === 'otp');

/** Sum of the product cost assumptions for the paid calls in the ledger (unknown costs excluded). */
export function knownCost(app: Application): { sar: number; unknown: number } {
  let sar = 0;
  let unknown = 0;
  for (const e of app.ledger) {
    if (e.kind !== 'call' && e.kind !== 'otp') continue;
    const c = costOf(e.check as VerificationType | 'OTP');
    if (c === null) unknown += 1; else sar += c;
  }
  return { sar, unknown };
}

export type CheckView = { type: VerificationType; label: string; state: 'not-run' | 'reused' | 'verified' | 'invalidated' | 'failed'; text: string };

/** One line per check for the Internal view. */
export function checkViews(app: Application): CheckView[] {
  const types: VerificationType[] = ['CR_DATA', 'PERSONS', 'FL_CERTS', 'MOBILE_MATCH', 'NAFATH', 'IBAN'];
  return types.map((type) => {
    const r = app.verifications[type];
    const lastReuse = [...app.ledger].reverse().find((e) => e.check === type && (e.kind === 'reuse' || e.kind === 'call'));
    if (!r) return { type, label: VERIFICATION_LABEL[type], state: 'not-run', text: 'Not run — no provider call yet' };
    if (r.status === 'invalidated') return { type, label: VERIFICATION_LABEL[type], state: 'invalidated', text: `Invalidated: ${r.invalidatedReason}` };
    if (lastReuse?.kind === 'reuse') return { type, label: VERIFICATION_LABEL[type], state: 'reused', text: 'Verified previously — reused, no new provider call' };
    return { type, label: VERIFICATION_LABEL[type], state: 'verified', text: `${r.result} ${r.expiresAt ? `· valid until ${r.expiresAt.slice(0, 10)}` : '· reusable until invalidated'}` };
  });
}
