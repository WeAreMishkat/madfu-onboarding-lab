/**
 * Stage 3 government-data validation for registered businesses. Evaluated in the backend after the CR
 * data is retrieved (once; reused afterwards). Every threshold and status -> action mapping is
 * configuration. The complete rule set is the "Onboarding Decision & Validation Inventory", a PRODUCT
 * TASK: only the rules below are known.
 */
import type { CrRecord, CrStatus, Flag, GovAction, NationalAddress, ReasonCode } from './types';

export const GOV_RULESET = 'GOV-CR-v3-demo (2026-10-23)';

export const GOV_RULES = {
  /** Known requirement: CR age of this many months or less cannot be onboarded yet (temporary). */
  minCrAgeMonths: 3,
  /** Expired / suspended / violation do not continue normal automatic onboarding. Provisional mapping. */
  statusAction: {
    ACTIVE: { action: 'continue', reason: 'OK' },
    EXPIRED: { action: 'manual_review', reason: 'CR_EXPIRED' },
    SUSPENDED: { action: 'not_eligible', reason: 'CR_SUSPENDED' },
    VIOLATION: { action: 'manual_review', reason: 'CR_GOVERNMENT_VIOLATION' }
  } as Record<CrStatus, { action: GovAction; reason: ReasonCode }>,
  /** National Address problems do not stop the journey: flagged for operations. */
  nationalAddressFlag: { VALID: null, MISSING: 'NATIONAL_ADDRESS_MISSING', EXPIRED: 'NATIONAL_ADDRESS_EXPIRED' } as Record<NationalAddress, Flag | null>,
  /** Entities that may need extra documents by regulation: collected later, near go-live. */
  additionalDocumentsFor: ['NON_SAUDI'] as string[]
};

export interface GovEvaluation { action: GovAction; reason: ReasonCode; flags: Flag[]; ruleIds: string[] }

/** Status first, then CR age, then non-blocking flags. */
export function evaluateGovernment(rec: CrRecord): GovEvaluation {
  const flags: Flag[] = [];
  const ruleIds: string[] = [];
  const status = GOV_RULES.statusAction[rec.status];
  if (status.action !== 'continue') return { action: status.action, reason: status.reason, flags, ruleIds: [`GOV-STATUS-${rec.status}`] };
  if (rec.issuedMonthsAgo <= GOV_RULES.minCrAgeMonths) {
    return { action: 'temporarily_not_eligible', reason: 'CR_TOO_RECENT', flags, ruleIds: ['GOV-AGE'] };
  }
  const na = GOV_RULES.nationalAddressFlag[rec.nationalAddress];
  if (na) { flags.push(na); ruleIds.push('GOV-NATIONAL-ADDRESS'); }
  if (GOV_RULES.additionalDocumentsFor.includes(rec.entity)) { flags.push('ADDITIONAL_DOCUMENTS_REQUIRED'); ruleIds.push('GOV-ENTITY-DOCS'); }
  return { action: 'continue', reason: 'OK', flags, ruleIds };
}
