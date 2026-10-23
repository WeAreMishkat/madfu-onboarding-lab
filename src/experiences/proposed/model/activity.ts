/**
 * Madfu Category/Subcategory <-> government (CR or freelance-certificate) activity mapping.
 *
 * SYNTHETIC FIXTURE. The production mapping is a PRODUCT TASK for the Product/Business team
 * ("Define Category/Subcategory <-> CR Activity Mapping"). Activity codes below are invented.
 */
import { continuesToIdentity, evaluateEligibility } from './eligibility';
import type { ApplicantKind, MappingAction, MappingOutcome } from './types';

export const ACTIVITY_MAPPING_VERSION = 'ACT-MAP-v3-demo (2026-10-23)';

export interface GovActivity {
  code: string;
  label: string;
  /** The Madfu subcategory this activity implies (used to re-run eligibility on the real activity). */
  impliedSub: string | null;
}

export const ACTIVITIES: GovActivity[] = [
  { code: 'ACT-4771', label: 'Retail sale of clothing (demo)', impliedSub: 'retail-fashion' },
  { code: 'ACT-4741', label: 'Retail sale of electronic equipment (demo)', impliedSub: 'retail-electronics' },
  { code: 'ACT-4777', label: 'Retail sale of gold and jewellery (demo)', impliedSub: 'retail-jewelry' },
  { code: 'ACT-4719', label: 'General retail trade (demo)', impliedSub: null },
  { code: 'ACT-5630', label: 'Coffee shops (demo)', impliedSub: 'food-cafe' },
  { code: 'ACT-1079', label: 'Home food production (demo)', impliedSub: 'food-homemade' },
  { code: 'ACT-7410', label: 'Specialised design activities (demo)', impliedSub: 'services-design' },
  { code: 'ACT-7420', label: 'Photographic activities (demo)', impliedSub: 'services-photo' },
  { code: 'ACT-7020', label: 'Management consultancy (demo)', impliedSub: 'services-consulting' },
  { code: 'ACT-9999', label: 'Activity not in the mapping (demo)', impliedSub: null }
];
export const activityByCode = (code: string) => ACTIVITIES.find((a) => a.code === code) ?? null;

/** Explicit pairs. A pair not listed is UNMAPPED. */
export const ACTIVITY_MAPPING: Array<{ sub: string; activity: string; outcome: MappingOutcome }> = [
  { sub: 'retail-fashion', activity: 'ACT-4771', outcome: 'MATCH' },
  { sub: 'retail-fashion', activity: 'ACT-4719', outcome: 'AMBIGUOUS' },
  { sub: 'retail-fashion', activity: 'ACT-4777', outcome: 'CONFLICT' },
  { sub: 'retail-electronics', activity: 'ACT-4741', outcome: 'MATCH' },
  { sub: 'retail-electronics', activity: 'ACT-4719', outcome: 'COMPATIBLE' },
  { sub: 'retail-jewelry', activity: 'ACT-4777', outcome: 'MATCH' },
  { sub: 'food-cafe', activity: 'ACT-5630', outcome: 'MATCH' },
  { sub: 'food-cafe', activity: 'ACT-7020', outcome: 'CONFLICT' },
  { sub: 'food-homemade', activity: 'ACT-1079', outcome: 'MATCH' },
  { sub: 'food-homemade', activity: 'ACT-5630', outcome: 'COMPATIBLE' },
  { sub: 'services-design', activity: 'ACT-7410', outcome: 'MATCH' },
  { sub: 'services-design', activity: 'ACT-7420', outcome: 'COMPATIBLE' },
  { sub: 'services-photo', activity: 'ACT-7420', outcome: 'MATCH' },
  { sub: 'services-photo', activity: 'ACT-7410', outcome: 'COMPATIBLE' },
  { sub: 'services-consulting', activity: 'ACT-7020', outcome: 'MATCH' },
  { sub: 'fixture-manual', activity: 'ACT-7020', outcome: 'MATCH' }
];

/** Outcome -> business action. Configurable. */
export const MAPPING_ACTION: Record<MappingOutcome, MappingAction> = {
  MATCH: 'continue',
  COMPATIBLE: 'continue',
  AMBIGUOUS: 'manual_review',
  CONFLICT: 'clarify',
  UNMAPPED: 'manual_review'
};

/** The activity code that matches a subcategory (used by the simulated provider's "auto" answer). */
export const matchingActivity = (sub: string) => ACTIVITY_MAPPING.find((m) => m.sub === sub && m.outcome === 'MATCH')?.activity ?? 'ACT-9999';

export interface Reconciliation { outcome: MappingOutcome; action: MappingAction; regulatedStop: boolean }

/**
 * Compares the declared subcategory with the government activity. Independently of the pair, if the
 * real activity implies a subcategory that is not eligible for this applicant (e.g. a regulated
 * activity), the journey stops: the declared category cannot hide the registered activity.
 */
export function reconcile(kind: ApplicantKind, declaredSub: string, activityCode: string): Reconciliation {
  const outcome = ACTIVITY_MAPPING.find((m) => m.sub === declaredSub && m.activity === activityCode)?.outcome ?? 'UNMAPPED';
  const implied = activityByCode(activityCode)?.impliedSub;
  if (implied && implied !== declaredSub) {
    const e = evaluateEligibility({ kind, sub: implied, revenue: 'SELF_SERVICE_BAND', channel: 'online' });
    if (!continuesToIdentity(e) && e.result === 'NOT_ELIGIBLE') return { outcome, action: 'stop', regulatedStop: true };
  }
  return { outcome, action: MAPPING_ACTION[outcome], regulatedStop: false };
}
