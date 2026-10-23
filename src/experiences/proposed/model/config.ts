/**
 * Configurable rules for Madfu Proposed that are not tables of their own (eligibility, government,
 * activity mapping, pricing and verification reuse live in their own modules). Anything a product or
 * compliance decision may still change lives in configuration, never in a screen component.
 */
import type { ApplicantKind, Revenue } from './types';

/* ------------------------------------------------------------------ stages (one list for app, boards, docs) */

export const STAGES = [
  { id: 'kyb', n: 1, label: 'Know Your Business', short: 'Business', steps: ['kyb', 'lead'] },
  { id: 'identify', n: 2, label: 'Identify & Verify', short: 'Identify', steps: ['identify', 'otp'] },
  { id: 'verification', n: 3, label: 'Business Verification', short: 'Verify', steps: ['cr-verify', 'persons', 'nafath', 'certificates'] },
  { id: 'banking', n: 4, label: 'Business & Banking Details', short: 'Details', steps: ['business'] },
  { id: 'commercial', n: 5, label: 'Commercial Offer', short: 'Offer', steps: ['commercial'] },
  { id: 'review', n: 6, label: 'Review', short: 'Review', steps: ['review'] },
  { id: 'contract', n: 7, label: 'Contract', short: 'Contract', steps: ['contract'] },
  { id: 'outcome', n: 8, label: 'Submit / Outcome', short: 'Submit', steps: ['outcome'] }
] as const;

export const stageOf = (step: string) => STAGES.find((s) => (s.steps as readonly string[]).includes(step)) ?? STAGES[0];

/* ------------------------------------------------------------------ revenue */

/**
 * PROVISIONAL: the exact treatment of SAR 100,000 and SAR 20,000,000 is a policy boundary to confirm.
 * The prototype uses non-overlapping bands: below 100,000 / 100,000 to 20,000,000 / above 20,000,000.
 */
export const REVENUE_RULE = { selfServiceFromSar: 100_000, selfServiceToSar: 20_000_000, provisional: true };

const sar = (n: number) => `SAR ${n.toLocaleString('en-US')}`;

export const REVENUE_OPTIONS: Array<{ value: Revenue; label: string }> = [
  { value: 'BELOW_100K', label: `Below ${sar(REVENUE_RULE.selfServiceFromSar)}` },
  { value: 'SELF_SERVICE_BAND', label: `${sar(REVENUE_RULE.selfServiceFromSar)}–${REVENUE_RULE.selfServiceToSar.toLocaleString('en-US')}` },
  { value: 'ABOVE_20M', label: `Above ${sar(REVENUE_RULE.selfServiceToSar)}` }
];
export const revenueLabel = (r: Revenue | null) => REVENUE_OPTIONS.find((o) => o.value === r)?.label ?? '';

export const KIND_OPTIONS: Array<{ value: ApplicantKind; label: string; description: string }> = [
  { value: 'CR', label: 'Registered business with a Commercial Registration (CR)', description: 'Company or establishment' },
  { value: 'FL_CERT', label: 'Freelancer with a Freelancer Certificate', description: 'Individual with an active certificate' },
  { value: 'FL_NO_CERT', label: 'Freelancer without a Freelancer Certificate', description: 'Individual, no certificate yet' }
];
export const kindLabel = (k: ApplicantKind | null) => KIND_OPTIONS.find((o) => o.value === k)?.label ?? '';
export const isFreelancer = (k: ApplicantKind | null) => k === 'FL_CERT' || k === 'FL_NO_CERT';

/* ------------------------------------------------------------------ attempts */

export const LIMITS = {
  otpAttempts: 3,
  otpResendSeconds: 30,
  otpValidityMinutes: 5,
  /** Per APPLICATION, shared across selected people. */
  nafathAttempts: 2,
  ibanAttempts: 2,
  /** Bounded retries for an unavailable provider before "come back later". */
  providerRetries: 2
};

/* ------------------------------------------------------------------ open decisions as rule flags */

export const RULE_FLAGS = {
  /**
   * COMPLIANCE DECISION REQUIRED: can a Freelancer sign the contract before the IBAN is linked to the
   * Freelancer Certificate? false = least disruptive (contract allowed, banking follow-up after
   * submission). true = no contract until the bank account is linked. Provisional.
   */
  flLinkedIbanRequiredBeforeContract: false,
  /** PRODUCT DECISION: does a Nafath technical failure use an attempt? Prototype: no. */
  nafathTechnicalFailureCounts: false
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
/** 15 digits, starts with 3, ends with 03. */
export const isVatNumber = (v: string) => /^3\d{12}03$/.test(v);

export function formatMobile(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 9);
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 9)].filter(Boolean).join(' ');
}
export const maskMobile = (v: string) => (v.length === 9 ? `+966 ${v.slice(0, 2)} ••• ••${v.slice(7)}` : '+966');
export const maskIdentifier = (v: string) => (v.length < 6 ? v : `${v.slice(0, 3)}••••${v.slice(-3)}`);

/* ------------------------------------------------------------------ global UX handover note (spec) */

export const UX_HANDOVER_NOTE =
  'All screens require complete UX/UI validation, error-state, empty-state, loading-state, retry, and edge-case designs. The absence of a specific state from the wireframes does not mean it is excluded from the final product requirements. The UX/UI team is responsible for designing comprehensive error and validation experiences for every field, step, and integration.';
