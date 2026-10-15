/**
 * Configurable rules for Madfu Proposed. Everything a product decision may still change lives here.
 */
import type { ApplicantType, Classification, Revenue } from './types';

/* ------------------------------------------------------------------ revenue routing */

/**
 * PROVISIONAL: the exact SAR 100,000 boundary is still a product decision. Exactly SAR 100,000 is
 * treated as self-onboarding (it sits in the middle band), so the three labels have no gap and no
 * overlap. Change `selfServiceFromSar` / `selfServiceToSar` and the labels follow.
 */
export const REVENUE_RULE = {
  selfServiceFromSar: 100_000,
  selfServiceToSar: 20_000_000,
  provisional: true
};

const sar = (n: number) => `SAR ${n.toLocaleString('en-US')}`;

export const REVENUE_OPTIONS: Array<{ value: Revenue; label: string }> = [
  { value: 'BELOW_100K', label: `Below ${sar(REVENUE_RULE.selfServiceFromSar)}` },
  { value: 'SELF_SERVICE_BAND', label: `${sar(REVENUE_RULE.selfServiceFromSar)}–${REVENUE_RULE.selfServiceToSar.toLocaleString('en-US')}` },
  { value: 'ABOVE_20M', label: `Above ${sar(REVENUE_RULE.selfServiceToSar)}` }
];
export const revenueLabel = (r: Revenue | null) => REVENUE_OPTIONS.find((o) => o.value === r)?.label ?? '';

/** CR outside the self-service band becomes a Sales lead; Freelancers self-onboard at every level. */
export function isSelfService(type: ApplicantType, revenue: Revenue): boolean {
  return type === 'FL' || revenue === 'SELF_SERVICE_BAND';
}

/* ------------------------------------------------------------------ attempts */

export const LIMITS = {
  otpAttempts: 3,
  otpResendSeconds: 30,
  otpValidityMinutes: 5,
  /** Per APPLICATION, shared across selected people. */
  nafathAttempts: 2,
  ibanAttempts: 2,
  /** Bounded retries for an unavailable provider before the manual route is offered. */
  providerRetries: 2
};

/* ------------------------------------------------------------------ validation (structural only) */

/** Structural check only: 10 digits starting with 7 (Unified / national CR). Not a registry check. */
export const isStructuralCr = (v: string) => /^7\d{9}$/.test(v);
/** Structural check only: 10 digits starting with 1 (Saudi National ID). Not a government check. */
export const isStructuralNationalId = (v: string) => /^1\d{9}$/.test(v);
export const isSaudiMobile = (v: string) => /^5\d{8}$/.test(v);
export const isUrl = (v: string) => /^https?:\/\/[^\s.]+\.[^\s]{2,}$/i.test(v.trim());
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
export const maskIdentifier = (type: ApplicantType | null, v: string) =>
  v.length < 6 ? v : type === 'CR' ? `${v.slice(0, 3)}••••${v.slice(-3)}` : `${v.slice(0, 3)}••••${v.slice(-3)}`;

/* ------------------------------------------------------------------ Madfu category fixture */

/**
 * FIXTURE. Madfu's own commercial taxonomy (not the government CR activity list). The final
 * catalogue and its restrictions are not available, so classifications here are demo-only and the
 * restricted examples are deliberately named as examples rather than real restrictions.
 */
export interface Subcategory { id: string; label: string; classification: Classification }
export interface CategoryGroup { id: string; label: string; subs: Subcategory[] }

export const CATEGORIES: CategoryGroup[] = [
  {
    id: 'retail', label: 'Retail & e-commerce', subs: [
      { id: 'retail-fashion', label: 'Fashion & accessories', classification: 'ALLOWED' },
      { id: 'retail-electronics', label: 'Electronics', classification: 'ALLOWED' },
      { id: 'retail-home', label: 'Home & furniture', classification: 'ALLOWED' }
    ]
  },
  {
    id: 'food', label: 'Food & beverage', subs: [
      { id: 'food-cafe', label: 'Cafés & coffee', classification: 'ALLOWED' },
      { id: 'food-restaurant', label: 'Restaurants', classification: 'ALLOWED' }
    ]
  },
  {
    id: 'services', label: 'Services', subs: [
      { id: 'services-design', label: 'Design & creative services', classification: 'ALLOWED' },
      { id: 'services-photo', label: 'Photography', classification: 'ALLOWED' },
      { id: 'services-training', label: 'Training & courses', classification: 'ALLOWED' }
    ]
  },
  {
    id: 'fixture', label: 'Fixture examples (demo classifications)', subs: [
      { id: 'fixture-cr-only', label: 'Example: CR-only subcategory', classification: 'CR_ONLY' },
      { id: 'fixture-manual', label: 'Example: manual business review', classification: 'MANUAL_REVIEW' },
      { id: 'fixture-blocked', label: 'Example: restricted subcategory', classification: 'BLOCKED' }
    ]
  }
];

export function findSub(subId: string): { group: CategoryGroup; sub: Subcategory } | null {
  for (const group of CATEGORIES) {
    const sub = group.subs.find((s) => s.id === subId);
    if (sub) return { group, sub };
  }
  return null;
}
export const classificationOf = (subId: string): Classification | null => findSub(subId)?.sub.classification ?? null;

/* ------------------------------------------------------------------ global UX handover note (spec) */

export const UX_HANDOVER_NOTE =
  'All screens require complete UX/UI validation, error-state, empty-state, loading-state, retry, and edge-case designs. The absence of a specific state from the wireframes does not mean it is excluded from the final product requirements. The UX/UI team is responsible for designing comprehensive error and validation experiences for every field, step, and integration.';
