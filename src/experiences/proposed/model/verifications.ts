/**
 * Reusable-verification model.
 *
 * Rule: previously successful external checks are reused until their dependent data changes or an
 * explicit freshness policy invalidates them. An ordinary resume therefore costs one OTP and nothing
 * else. Every external call, reuse and invalidation is written to the application's ledger so the
 * Prototype Controls can show what a resume would cost.
 */
import type { Application, LedgerEntry, VerificationRecord, VerificationType } from './types';

export const VERIFICATION_LABEL: Record<VerificationType | 'OTP', string> = {
  CR_DATA: 'CR data (registry, activities, National Address)',
  PERSONS: 'Associated people',
  NAFATH: 'Nafath',
  FL_CERTS: 'Freelancer Certificate retrieval',
  IBAN: 'IBAN ownership',
  OTP: 'SMS OTP'
};

export const VERIFICATION_SOURCE: Record<VerificationType, string> = {
  CR_DATA: 'Government CR registry (simulated)',
  PERSONS: 'Government associated parties (simulated)',
  NAFATH: 'Nafath (simulated)',
  FL_CERTS: 'Freelance platform (simulated)',
  IBAN: 'Bank ownership provider (simulated)'
};

/** What each result depends on (shown in docs and the Internal View). */
export const DEPENDS_ON: Record<VerificationType, string> = {
  CR_DATA: 'CR identity',
  PERSONS: 'CR identity',
  NAFATH: 'Application + selected verified person / National ID',
  FL_CERTS: 'Verified National ID',
  IBAN: 'IBAN + ownership target (business CR, or National ID + certificate)'
};

/**
 * Freshness policy per verification, in days. null = no policy defined: "Reusable until invalidated".
 * PRODUCT/ENGINEERING DECISION: freshness / expiry policy is not defined, so every value is null.
 */
export const FRESHNESS_DAYS: Record<VerificationType, number | null> = {
  CR_DATA: null,
  PERSONS: null,
  NAFATH: null,
  FL_CERTS: null,
  IBAN: null
};

/** Edits and what they invalidate. Anything not listed is NOT invalidated. */
export const INVALIDATION_RULES: Array<{ change: string; invalidates: VerificationType[]; internal: string; extra?: string }> = [
  { change: 'Website or Google Maps URL', invalidates: [], internal: 'Re-validate the URL format only' },
  { change: 'Sales channel', invalidates: [], internal: 'Re-run eligibility (channel rules)' },
  { change: 'Category / subcategory', invalidates: [], internal: 'Re-run eligibility and category ↔ activity reconciliation on the stored activity; re-derive pricing', extra: 'No external call: the stored CR / certificate activity is reused' },
  { change: 'Annual revenue', invalidates: [], internal: 'Re-run eligibility (revenue routing)' },
  { change: 'IBAN', invalidates: ['IBAN'], internal: 'IBAN verification only' },
  { change: 'Bank linked to certificate (Freelancer)', invalidates: ['IBAN'], internal: 'IBAN verification only' },
  { change: 'Selected authorised person (before Nafath success)', invalidates: [], internal: 'New Nafath context for the new person; attempt counter not reset' },
  { change: 'Selected authorised person (after Nafath success)', invalidates: ['NAFATH'], internal: 'Nafath must be repeated for the new person' },
  { change: 'Selected freelance certificate', invalidates: ['IBAN'], internal: 'Re-run reconciliation on the certificate activity', extra: 'IBAN ownership target includes the certificate' },
  { change: 'CR number', invalidates: ['CR_DATA', 'PERSONS', 'NAFATH', 'IBAN'], internal: 'Duplicate check, CR retrieval, people, activity reconciliation, authority (Nafath), IBAN ownership target' },
  { change: 'National ID (Freelancer)', invalidates: ['NAFATH', 'FL_CERTS', 'IBAN'], internal: 'Duplicate check, Nafath, certificate retrieval, IBAN ownership target' },
  { change: 'Mobile number', invalidates: [], internal: 'New SMS OTP for the new mobile' }
];

export const addDays = (iso: string, days: number) => new Date(new Date(iso).getTime() + days * 86_400_000).toISOString();

export function makeRecord(type: VerificationType, fingerprint: string, result: string, at: string, providerRef: string, ruleset: string | null = null): VerificationRecord {
  const days = FRESHNESS_DAYS[type];
  return {
    type, fingerprint, dependsOn: DEPENDS_ON[type], result, at, source: VERIFICATION_SOURCE[type], providerRef, ruleset,
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

/** External calls (and OTPs) logged since a ledger position: used by tests and the Internal View. */
export const callsSince = (app: Application, from: number) => app.ledger.slice(from).filter((e) => e.kind === 'call' || e.kind === 'otp');

export type CheckView = { type: VerificationType; label: string; state: 'not-run' | 'reused' | 'verified' | 'invalidated' | 'failed'; text: string };

/** One line per check for the Internal View. */
export function checkViews(app: Application): CheckView[] {
  const types: VerificationType[] = ['CR_DATA', 'PERSONS', 'NAFATH', 'FL_CERTS', 'IBAN'];
  return types.map((type) => {
    const r = app.verifications[type];
    const lastReuse = [...app.ledger].reverse().find((e) => e.check === type && (e.kind === 'reuse' || e.kind === 'call'));
    if (!r) return { type, label: VERIFICATION_LABEL[type], state: 'not-run', text: 'Not run — no provider call yet' };
    if (r.status === 'invalidated') return { type, label: VERIFICATION_LABEL[type], state: 'invalidated', text: `Invalidated: ${r.invalidatedReason}` };
    if (lastReuse?.kind === 'reuse') return { type, label: VERIFICATION_LABEL[type], state: 'reused', text: 'Verified previously — reused, no new provider call' };
    return { type, label: VERIFICATION_LABEL[type], state: 'verified', text: `Verified ${r.expiresAt ? `until ${r.expiresAt.slice(0, 10)}` : '— reusable until invalidated'}` };
  });
}
