/**
 * Configurable rules for Madfu Proposed that are not tables of their own (eligibility, government,
 * activity mapping, risk, pricing and verification reuse live in their own modules). Anything a
 * product or compliance decision may still change lives in configuration, never in a screen component.
 */
import type { ApplicantKind, Application, Revenue, StepId } from './types';

/* ------------------------------------------------------------------ stages (one list for app, boards, docs) */

export const STAGES = [
  { id: 'kyb', n: 1, label: 'Know Your Business', short: 'Business', steps: ['kyb'] },
  { id: 'identify', n: 2, label: 'Identify & Verify', short: 'Identify', steps: ['identify', 'otp'] },
  { id: 'verification', n: 3, label: 'Business Verification', short: 'Verify', steps: ['cr', 'certificates', 'nafath'] },
  { id: 'details', n: 4, label: 'Business Details', short: 'Details', steps: ['business'] },
  { id: 'commercial', n: 5, label: 'Commercial Offer', short: 'Offer', steps: ['commercial'] },
  { id: 'review', n: 6, label: 'Review', short: 'Review', steps: ['review'] },
  { id: 'contract', n: 7, label: 'Authorization & Contract', short: 'Sign', steps: ['authorize', 'handoff', 'delegation', 'signer', 'contract'] },
  { id: 'outcome', n: 8, label: 'Submit / Application Status', short: 'Status', steps: ['outcome', 'status', 'login'] }
] as const;

export const stageOf = (step: string) => STAGES.find((s) => (s.steps as readonly string[]).includes(step)) ?? STAGES[0];

/**
 * Stage of a screen for THIS application: both kinds verify with Nafath after Review, in stage 7 — a
 * registered business after the Authorization choice, a Freelancer after the certificate (also stage 7).
 */
export const stageFor = (step: StepId, app?: Pick<Application, 'kyb'>) =>
  (step === 'nafath' && app?.kyb.kind) || step === 'certificates' ? STAGES[6] : stageOf(step);

/** The signer's own short journey (secure link; no OTP in Phase 1). */
export const SIGNER_STAGES = [
  { id: 'confirm', label: 'Authorization request', short: 'Request', steps: ['signer'] },
  { id: 'nafath', label: 'Verify with Nafath', short: 'Nafath', steps: ['nafath'] },
  { id: 'review', label: 'Review', short: 'Review', steps: ['review'] },
  { id: 'contract', label: 'Contract', short: 'Sign', steps: ['contract'] },
  { id: 'done', label: 'Submitted', short: 'Done', steps: ['outcome'] }
] as const;

/* ------------------------------------------------------------------ CR signer handoff (Phase 1) */

/**
 * Signer handoff rules. Configurable, never hard-coded in screens or transitions:
 * - a secure signer link is valid for `expiryDays` (default 7);
 * - at most `maxVersions` handoffs (authorization versions) of the SAME application within any
 *   `windowDays` window (default 2 in 30 days). A further one needs an internal / manual unlock.
 * There is no CR lock: the application stays the same application; versions are tracked separately.
 */
export const HANDOFF_RULES = { expiryDays: 7, maxVersions: 2, windowDays: 30 };
export type HandoffRules = typeof HANDOFF_RULES;
export const DAY_MS = 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------------ revenue */

/**
 * Revenue bands collected on Page 1: below 100,000 / 100,000 to 20,000,000 / above 20,000,000.
 * Revenue NEVER routes (no Sales lead): every band can self-onboard when otherwise eligible. It is
 * stored and used as a backend risk input only. Band boundaries are configuration.
 */
export const REVENUE_RULE = { lowerSar: 100_000, upperSar: 20_000_000, provisional: true };

const sar = (n: number) => `SAR ${n.toLocaleString('en-US')}`;

export const REVENUE_OPTIONS: Array<{ value: Revenue; label: string }> = [
  { value: 'BELOW_100K', label: `Below ${sar(REVENUE_RULE.lowerSar)}` },
  { value: 'MID_BAND', label: `${sar(REVENUE_RULE.lowerSar)}–${REVENUE_RULE.upperSar.toLocaleString('en-US')}` },
  { value: 'ABOVE_20M', label: `Above ${sar(REVENUE_RULE.upperSar)}` }
];
export const revenueLabel = (r: Revenue | null) => REVENUE_OPTIONS.find((o) => o.value === r)?.label ?? '';

export const KIND_OPTIONS: Array<{ value: ApplicantKind; label: string; description: string }> = [
  { value: 'CR', label: 'Registered business with a Commercial Registration (CR)', description: 'Company or establishment' },
  { value: 'FL_CERT', label: 'Freelancer with a Freelancer Certificate', description: 'Individual with an active certificate' },
  { value: 'FL_NO_CERT', label: 'Freelancer without a Freelancer Certificate', description: 'Individual, no certificate yet' }
];
export const kindLabel = (k: ApplicantKind | null) => KIND_OPTIONS.find((o) => o.value === k)?.label ?? '';
export const isFreelancer = (k: ApplicantKind | null) => k === 'FL_CERT' || k === 'FL_NO_CERT';

/**
 * Page-2 prerequisite question per applicant type (eligible applicants only). A registered business has
 * none: the preparer does not have to be an owner or manager — authorization is chosen after Review.
 */
export const PREREQUISITE_QUESTION: Partial<Record<ApplicantKind, string>> = {
  FL_CERT: 'Is your IBAN linked to your Freelancer Certificate?'
};

/* ------------------------------------------------------------------ attempts and abuse limits */

export const LIMITS = {
  /** Wrong codes allowed per SMS code. */
  otpAttempts: 3,
  /** New codes per session after the first one; a resend never restores the budget beyond this. */
  otpResends: 3,
  otpResendSeconds: 30,
  otpValidityMinutes: 5,
  /** Identifier + mobile submissions per session before the identify page is throttled. */
  identifyChecksPerSession: 5,
  /** Mobile ↔ National ID checks per application: the first check + one corrected mobile. */
  mobileMatchChecks: 2,
  /** Rejected / timed-out Nafath requests per application. */
  nafathAttempts: 2,
  /** Nafath technical failures per session before "try again later" (no attempt used). */
  nafathTechnicalRetries: 3,
  /** IBAN ownership mismatches per IBAN. Technical errors do not count. */
  ibanAttempts: 2,
  /** Retries for an unavailable provider in one session; the counter resets on resume. */
  providerRetries: 2
};

/* ------------------------------------------------------------------ cost assumptions (Internal view only) */

/** Product assumptions for the cost view. Never shown to the merchant. null = unknown. */
export const COST_ASSUMPTIONS_SAR: Record<string, number | null> = {
  FL_CERTS: 9,
  NAFATH: 6,
  CR_DATA: null,
  PERSONS: null,
  MOBILE_MATCH: null,
  IBAN: null,
  OTP: null
};

/* ------------------------------------------------------------------ structural validation (not verification) */

/** 10 digits starting with 7 (Unified / national CR). Not a registry check. */
export const isStructuralCr = (v: string) => /^7\d{9}$/.test(v);
/** 10 digits starting with 1 (Saudi National ID). Not a government check. */
export const isStructuralNationalId = (v: string) => /^1\d{9}$/.test(v);
export const isSaudiMobile = (v: string) => /^5\d{8}$/.test(v);
export const normaliseIban = (v: string) => v.replace(/\s+/g, '').toUpperCase();
export const isIbanFormat = (v: string) => /^SA\d{22}$/.test(normaliseIban(v));
export const formatIban = (v: string) => normaliseIban(v).replace(/(.{4})/g, '$1 ').trim();
export const maskIban = (v: string) => {
  const n = normaliseIban(v);
  return n.length < 8 ? n : `SA•• •••• •••• •••• ${n.slice(-4)}`;
};

export function formatMobile(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 9);
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 9)].filter(Boolean).join(' ');
}
export const maskMobile = (v: string) => (v.length === 9 ? `+966 ${v.slice(0, 2)} ••• ••${v.slice(7)}` : '+966');
/** Registered mobile of an existing application or account: last three digits only. */
export const maskLast3 = (v: string) => (v.length >= 3 ? `•••••••${v.slice(-3)}` : '•••');
export const maskIdentifier = (v: string) => (v.length < 6 ? v : `${v.slice(0, 3)}••••${v.slice(-3)}`);

/* ------------------------------------------------------------------ global UX handover note (spec) */

export const UX_HANDOVER_NOTE =
  'All screens require complete UX/UI validation, error-state, empty-state, loading-state, retry, and edge-case designs. The absence of a specific state from the wireframes does not mean it is excluded from the final product requirements. The UX/UI team is responsible for designing comprehensive error and validation experiences for every field, step, and integration.';
