/**
 * Pricing & Commission Matrix (Stage 5, Commercial Offer).
 *
 * SYNTHETIC PROTOTYPE VALUES. The production matrix is a PRODUCT TASK ("Pricing & Commission Matrix").
 * The standard commission comes from the VERIFIED category (government CR activity, or the selected
 * certificate's activity) — never from the self-declared Page-1 category once government data exists,
 * and never from self-declared revenue. Payment plans are not configured in onboarding: the merchant
 * configures them later in the Merchant Portal.
 */
import { findSub } from './eligibility';
import type { AgreedOffer, Application } from './types';

export const PRICING_VERSION = 'PRICING-v4-demo (2026-10-27)';

interface PriceRow { key: string; standard: number }

/** Subcategory rows override the category row. Percentages, synthetic. */
export const PRICING_MATRIX: PriceRow[] = [
  { key: 'retail', standard: 7.0 },
  { key: 'retail-electronics', standard: 6.5 },
  { key: 'food', standard: 6.0 },
  { key: 'services', standard: 7.5 },
  { key: 'fixture', standard: 7.0 }
];

/** Optional evidence for a rate review. Placeholder names: the real documents are not finalised. */
export const PRICING_EVIDENCE = [
  { id: 'doc-a', label: 'Supporting document', hint: 'Optional. Exact requirements to be confirmed by Commercial.' },
  { id: 'doc-b', label: 'Additional supporting document', hint: 'Optional. Exact requirements to be confirmed by Commercial.' }
];

export function priceFor(subId: string): PriceRow {
  const f = findSub(subId);
  return PRICING_MATRIX.find((p) => p.key === subId) ?? PRICING_MATRIX.find((p) => p.key === f?.group.id) ?? PRICING_MATRIX[0];
}

/** The category pricing reads: verified (government-mapped) when available, the declaration otherwise. */
export const pricingSub = (app: Application) => app.categoryCheck?.verifiedSub ?? app.kyb.sub;

export function buildOffer(app: Application, at = new Date().toISOString()): AgreedOffer {
  const sub = pricingSub(app);
  return { pricingVersion: PRICING_VERSION, pricingSub: sub, standardRate: priceFor(sub).standard, at };
}

export const pct = (n: number) => `${n.toFixed(1)}%`;
