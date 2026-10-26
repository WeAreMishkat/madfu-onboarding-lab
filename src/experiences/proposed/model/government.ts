/**
 * Stage 3 government-data rules for registered businesses. Evaluated in the backend after the CR data
 * is retrieved (once; reused afterwards). These are HARD rules (status → action). CR age is NOT a
 * hard rule any more: it is a risk attribute (model/risk.ts). The complete hard-block inventory is an
 * open PRODUCT / COMPLIANCE task: only the rules below are known.
 */
import type { CrRecord, CrStatus, Flag, GovAction, NationalAddress, ReasonCode } from './types';

export const GOV_RULESET = 'GOV-CR-v4-demo (2026-10-27)';

export const GOV_RULES = {
  /**
   * Expired / suspended: self-onboarding stops; the application is saved and handed to Sales for
   * recovery after the merchant updates the CR. No merchant-facing "refresh CR" (no repeated paid
   * checks). RESTRICTED follows the same route PROVISIONALLY (hard-block inventory is open).
   */
  statusAction: {
    ACTIVE: { action: 'continue', reason: 'OK' },
    EXPIRED: { action: 'pause_sales', reason: 'CR_EXPIRED' },
    SUSPENDED: { action: 'pause_sales', reason: 'CR_SUSPENDED' },
    RESTRICTED: { action: 'pause_sales', reason: 'CR_RESTRICTED' }
  } as Record<CrStatus, { action: GovAction; reason: ReasonCode }>,
  /** National Address problems do not stop the journey: flagged for operations. National Address is legal / HQ data, not the selling location. */
  nationalAddressFlag: { VALID: null, MISSING: 'NATIONAL_ADDRESS_MISSING', EXPIRED: 'NATIONAL_ADDRESS_EXPIRED' } as Record<NationalAddress, Flag | null>,
  /** Entities that may need extra documents by regulation: collected later, near go-live. */
  additionalDocumentsFor: ['NON_SAUDI'] as string[]
};

export interface GovEvaluation { action: GovAction; reason: ReasonCode; flags: Flag[]; ruleIds: string[] }

/** Status (hard rule) first, then non-blocking flags. Age is scored, never evaluated here. */
export function evaluateGovernment(rec: CrRecord): GovEvaluation {
  const flags: Flag[] = [];
  const ruleIds: string[] = [];
  const status = GOV_RULES.statusAction[rec.status];
  if (status.action !== 'continue') return { action: status.action, reason: status.reason, flags: ['SALES_FOLLOW_UP'], ruleIds: [`GOV-STATUS-${rec.status}`] };
  const na = GOV_RULES.nationalAddressFlag[rec.nationalAddress];
  if (na) { flags.push(na); ruleIds.push('GOV-NATIONAL-ADDRESS'); }
  if (GOV_RULES.additionalDocumentsFor.includes(rec.entity)) { flags.push('ADDITIONAL_DOCUMENTS_REQUIRED'); ruleIds.push('GOV-ENTITY-DOCS'); }
  return { action: 'continue', reason: 'OK', flags, ruleIds };
}
