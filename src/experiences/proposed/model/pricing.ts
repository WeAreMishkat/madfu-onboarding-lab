/**
 * Pricing & Commission Matrix (Stage 5, Commercial Offer).
 *
 * SYNTHETIC PROTOTYPE VALUES. The production matrix is a PRODUCT TASK ("Pricing & Commission Matrix").
 * The standard commission comes from category / subcategory, never from self-declared revenue: a
 * better rate is only possible after the internal Commercial review, and onboarding never waits for it.
 */
import { findSub } from './eligibility';
import type { AgreedOffer, Tenure } from './types';

export const PRICING_VERSION = 'PRICING-v3-demo (2026-10-23)';

export const BASE_PLANS: Tenure[] = [3, 4];
export const OPTIONAL_PLANS: Tenure[] = [6, 9, 12];

interface PriceRow { key: string; standard: number; optional: Record<6 | 9 | 12, number> }

/** Subcategory rows override the category row. Percentages, synthetic. */
export const PRICING_MATRIX: PriceRow[] = [
  { key: 'retail', standard: 7.0, optional: { 6: 8.5, 9: 10.0, 12: 11.5 } },
  { key: 'retail-electronics', standard: 6.5, optional: { 6: 8.0, 9: 9.5, 12: 11.0 } },
  { key: 'food', standard: 6.0, optional: { 6: 7.5, 9: 9.0, 12: 10.5 } },
  { key: 'services', standard: 7.5, optional: { 6: 9.0, 9: 10.5, 12: 12.0 } },
  { key: 'fixture', standard: 7.0, optional: { 6: 8.5, 9: 10.0, 12: 11.5 } }
];

/** Optional evidence for a better rate. Placeholder names: the real documents are not finalised. */
export const PRICING_EVIDENCE = [
  { id: 'doc-a', label: 'Revenue supporting document A', hint: 'Placeholder: document type to be confirmed by Commercial.' },
  { id: 'doc-b', label: 'Revenue supporting document B', hint: 'Placeholder: document type to be confirmed by Commercial.' }
];

export function priceFor(subId: string): PriceRow {
  const f = findSub(subId);
  return PRICING_MATRIX.find((p) => p.key === subId) ?? PRICING_MATRIX.find((p) => p.key === f?.group.id) ?? PRICING_MATRIX[0];
}

export function rateFor(subId: string, tenure: Tenure): number {
  const p = priceFor(subId);
  return tenure === 3 || tenure === 4 ? p.standard : p.optional[tenure];
}

/** The offer the applicant confirms: base plans always included, optional plans as selected. */
export function buildOffer(subId: string, optional: Tenure[], at = new Date().toISOString()): AgreedOffer {
  const p = priceFor(subId);
  const chosen = OPTIONAL_PLANS.filter((t) => optional.includes(t));
  return {
    pricingVersion: PRICING_VERSION,
    standardRate: p.standard,
    plans: [...BASE_PLANS.map((t) => ({ tenure: t, rate: p.standard, included: true })), ...chosen.map((t) => ({ tenure: t, rate: rateFor(subId, t), included: false }))],
    at
  };
}

export const pct = (n: number) => `${n.toFixed(1)}%`;
