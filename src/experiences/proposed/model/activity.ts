/**
 * Government activity → Madfu category. Before retrieval, the Page-1 category is a declaration; once
 * CR activities (or the selected certificate's activity) are known, the government data is the
 * authoritative source for the category, its eligibility and its pricing.
 *
 * SYNTHETIC FIXTURE. The production mapping, and how several CR activities are reconciled, are open
 * PRODUCT / RISK / COMPLIANCE tasks. The model only fixes the architecture:
 * - a CR carries several activities (one primary);
 * - many government activities can map to one Madfu subcategory;
 * - an unmapped activity never silently decides anything (internal flag, declared category kept).
 */
import { evaluateEligibility } from './eligibility';
import type { ApplicantKind, CategoryCheck, Channel, CrActivity, ReasonCode } from './types';

export const ACTIVITY_MAPPING_VERSION = 'ACT-MAP-v4-demo (2026-10-27)';

export interface GovActivity {
  code: string;
  label: string;
  /** The Madfu subcategory this activity maps to (null = not in the mapping yet). */
  mappedSub: string | null;
}

/** Many-to-one: several activity codes can map to the same Madfu subcategory. */
export const ACTIVITIES: GovActivity[] = [
  { code: 'ACT-4771', label: 'Retail sale of clothing (demo)', mappedSub: 'retail-fashion' },
  { code: 'ACT-4772', label: 'Retail sale of footwear and leather goods (demo)', mappedSub: 'retail-fashion' },
  { code: 'ACT-4741', label: 'Retail sale of electronic equipment (demo)', mappedSub: 'retail-electronics' },
  { code: 'ACT-4777', label: 'Retail sale of gold and jewellery (demo)', mappedSub: 'retail-jewelry' },
  { code: 'ACT-5630', label: 'Coffee shops (demo)', mappedSub: 'food-cafe' },
  { code: 'ACT-5610', label: 'Restaurants and cafés (demo)', mappedSub: 'food-cafe' },
  { code: 'ACT-1079', label: 'Home food production (demo)', mappedSub: 'food-homemade' },
  { code: 'ACT-7410', label: 'Specialised design activities (demo)', mappedSub: 'services-design' },
  { code: 'ACT-7420', label: 'Photographic activities (demo)', mappedSub: 'services-photo' },
  { code: 'ACT-7020', label: 'Management consultancy (demo)', mappedSub: 'services-consulting' },
  { code: 'ACT-4719', label: 'General retail trade (demo)', mappedSub: null },
  { code: 'ACT-9999', label: 'Activity not in the mapping (demo)', mappedSub: null }
];
export const activityByCode = (code: string) => ACTIVITIES.find((a) => a.code === code) ?? null;
export const activityLabel = (code: string) => activityByCode(code)?.label ?? code;

/** The first activity code that maps to a subcategory (used by the simulated providers' "auto" answer). */
export const matchingActivity = (sub: string) => ACTIVITIES.find((a) => a.mappedSub === sub)?.code ?? 'ACT-9999';

export interface CategoryResult {
  check: CategoryCheck;
  /** Not Eligible from the VERIFIED activity (e.g. a regulated activity), whatever was declared. */
  block: ReasonCode | null;
}

/**
 * Derive the verified category. Order (demo rule, final reconciliation is an open decision):
 * 1. any mapped activity that is not eligible for this applicant → Not Eligible (it cannot be hidden
 *    behind a declared category);
 * 2. an activity that maps to the declared subcategory → CONFIRMED (declared = verified);
 * 3. otherwise the primary mapped activity → RECLASSIFIED (government wins; internal flag);
 * 4. nothing mapped → UNMAPPED (declared kept provisionally; internal flag).
 */
export function deriveCategory(kind: ApplicantKind, declaredSub: string, source: 'CR' | 'CERTIFICATE', activities: CrActivity[], channel: Channel = 'online'): CategoryResult {
  const ordered = [...activities].sort((a, b) => Number(b.primary) - Number(a.primary));
  const mapped = ordered.map((a) => ({ code: a.code, mappedSub: activityByCode(a.code)?.mappedSub ?? null }));
  const base = { source, declaredSub, activities: mapped };
  for (const m of mapped) {
    if (!m.mappedSub) continue;
    const e = evaluateEligibility({ kind, sub: m.mappedSub, revenue: 'MID_BAND', channel });
    if (e.result === 'NOT_ELIGIBLE') {
      const reason: ReasonCode = e.reason === 'ACTIVITY_REQUIRES_CR' || e.reason === 'CHANNEL_NOT_SUPPORTED' ? e.reason : 'ACTIVITY_REGULATED';
      return { check: { ...base, verifiedSub: m.mappedSub, outcome: 'RECLASSIFIED' }, block: reason };
    }
  }
  if (mapped.some((m) => m.mappedSub === declaredSub)) return { check: { ...base, verifiedSub: declaredSub, outcome: 'CONFIRMED' }, block: null };
  const first = mapped.find((m) => m.mappedSub);
  if (first) return { check: { ...base, verifiedSub: first.mappedSub!, outcome: 'RECLASSIFIED' }, block: null };
  return { check: { ...base, verifiedSub: declaredSub, outcome: 'UNMAPPED' }, block: null };
}
