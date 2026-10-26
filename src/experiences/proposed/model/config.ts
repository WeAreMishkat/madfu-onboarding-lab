/**
 * Configurable rules for Madfu Proposed that are not tables of their own (eligibility, government,
 * activity mapping, risk, pricing and verification reuse live in their own modules). Anything a
 * product or compliance decision may still change lives in configuration, never in a screen component.
 */
import type { ApplicantKind, Revenue } from './types';

/* ------------------------------------------------------------------ stages (one list for app, boards, docs) */

export const STAGES = [
  { id: 'kyb', n: 1, label: 'Know Your Business', short: 'Business', steps: ['kyb'] },
  { id: 'identify', n: 2, label: 'Identify & Verify', short: 'Identify', steps: ['identify', 'otp'] },
  { id: 'verification', n: 3, label: 'Business Verification', short: 'Verify', steps: ['persons', 'nafath', 'certificates'] },
  { id: 'details', n: 4, label: 'Business Details', short: 'Details', steps: ['business'] },
  { id: 'commercial', n: 5, label: 'Commercial Offer', short: 'Offer', steps: ['commercial'] },
  { id: 'review', n: 6, label: 'Review', short: 'Review', steps: ['review'] },
  { id: 'contract', n: 7, label: 'Contract', short: 'Contract', steps: ['contract'] },
  { id: 'outcome', n: 8, label: 'Submit / Application Status', short: 'Status', steps: ['outcome', 'status', 'login'] }
] as const;

export const stageOf = (step: string) => STAGES.find((s) => (s.steps as readonly string[]).includes(step)) ?? STAGES[0];

/* ------------------------------------------------------------------ revenue */

/**
 * PROVISIONAL: the exact treatment of SAR 100,000 and SAR 20,000,000 is a policy boundary to confirm.
 * The prototype uses non-overlapping bands: below 100,000 / 100,000 to 20,000,000 / above 20,000,000.
 * The Sales threshold is configuration, never a screen constant.
 */
export const REVENUE_RULE = { selfServiceFromSar: 100_000, salesAboveSar: 20_000_000, provisional: true };

const sar = (n: number) => `SAR ${n.toLocaleString('en-US')}`;

export const REVENUE_OPTIONS: Array<{ value: Revenue; label: string }> = [
  { value: 'BELOW_100K', label: `Below ${sar(REVENUE_RULE.selfServiceFromSar)}` },
  { value: 'SELF_SERVICE_BAND', label: `${sar(REVENUE_RULE.selfServiceFromSar)}–${REVENUE_RULE.salesAboveSar.toLocaleString('en-US')}` },
  { value: 'ABOVE_20M', label: `Above ${sar(REVENUE_RULE.salesAboveSar)}` }
];
export const revenueLabel = (r: Revenue | null) => REVENUE_OPTIONS.find((o) => o.value === r)?.label ?? '';

export const KIND_OPTIONS: Array<{ value: ApplicantKind; label: string; description: string }> = [
  { value: 'CR', label: 'Registered business with a Commercial Registration (CR)', description: 'Company or establishment' },
  { value: 'FL_CERT', label: 'Freelancer with a Freelancer Certificate', description: 'Individual with an active certificate' },
  { value: 'FL_NO_CERT', label: 'Freelancer without a Freelancer Certificate', description: 'Individual, no certificate yet' }
];
export const kindLabel = (k: ApplicantKind | null) => KIND_OPTIONS.find((o) => o.value === k)?.label ?? '';
export const isFreelancer = (k: ApplicantKind | null) => k === 'FL_CERT' || k === 'FL_NO_CERT';

/** Page-2 prerequisite question per applicant type (self-onboarding routes only). */
export const PREREQUISITE_QUESTION: Partial<Record<ApplicantKind, string>> = {
  CR: 'Are you an owner or manager registered on this CR?',
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

/* ------------------------------------------------------------------ open decisions as rule flags */

export const RULE_FLAGS = {
  /**
   * PROVIDER / COMPLIANCE DECISION: may the Freelancer Certificate existence be checked BEFORE Nafath
   * (cost order)? true = backend pre-check first; the applicant still sees Nafath → certificate.
   * false = retrieve the certificates after Nafath (journey unchanged).
   */
  flCertificatePrecheckBeforeNafath: true
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
