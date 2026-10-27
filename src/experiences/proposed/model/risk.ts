/**
 * Backend merchant-risk model (never shown to the merchant).
 *
 * ARCHITECTURE RULE: Not Eligible rules and risk scores are separate. A NOT ELIGIBLE rule is a
 * regulatory or business condition that cannot continue (model/eligibility.ts, model/government.ts, prerequisite
 * declarations). A RISK SCORE only weighs factors into Low / Medium / High. A Not Eligible rule is never turned
 * into a score to let a merchant continue, and a score alone never rejects.
 *
 * SYNTHETIC DEMO WEIGHTS. Production factors, weights and thresholds are open RISK decisions.
 */
import { findSub } from './eligibility';
import type { Application, ReasonCode, RiskAssessment, RiskLevel } from './types';

export const RISK_MODEL_VERSION = 'RISK-v1-demo (2026-10-27)';

export const RISK_CONFIG = {
  /** CR age bands (months, upper bound inclusive) → demo points. Not a rejection rule. */
  crAge: [
    { label: 'Under 12 months', maxMonths: 11, points: 3 },
    { label: '12–24 months', maxMonths: 24, points: 2 },
    { label: 'Over 24 months', maxMonths: Number.POSITIVE_INFINITY, points: 1 }
  ],
  revenue: { BELOW_100K: 2, MID_BAND: 1, ABOVE_20M: 0 } as Record<string, number>,
  /** Category tier from the VERIFIED category group. */
  categoryGroup: { retail: 2, food: 1, services: 1, fixture: 1 } as Record<string, number>,
  entity: { SAUDI: 0, NON_SAUDI: 2 } as Record<string, number>,
  nationalAddress: { VALID: 0, MISSING: 1, EXPIRED: 1 } as Record<string, number>,
  /** Placeholders: fraud, credit and compliance signals are not modelled in the prototype. */
  notModelled: ['Fraud signals', 'Credit signals', 'Compliance / screening signals'],
  thresholds: { mediumFrom: 4, highFrom: 7 }
};

export const levelFor = (score: number): RiskLevel => (score >= RISK_CONFIG.thresholds.highFrom ? 'HIGH' : score >= RISK_CONFIG.thresholds.mediumFrom ? 'MEDIUM' : 'LOW');

/** Synthetic risk from the data known so far. Recalculated whenever its inputs change (e.g. CR age on re-check). */
export function assessRisk(app: Application): RiskAssessment {
  const factors: RiskAssessment['factors'] = [];
  const rec = app.cr.record;
  if (rec) {
    const band = RISK_CONFIG.crAge.find((b) => rec.ageMonths <= b.maxMonths)!;
    factors.push({ factor: 'CR age', value: `${rec.ageMonths} months (${band.label})`, points: band.points });
    factors.push({ factor: 'Entity', value: rec.entity, points: RISK_CONFIG.entity[rec.entity] ?? 0 });
    factors.push({ factor: 'National Address', value: rec.nationalAddress, points: RISK_CONFIG.nationalAddress[rec.nationalAddress] ?? 0 });
  }
  if (app.kyb.revenue) factors.push({ factor: 'Declared revenue', value: app.kyb.revenue, points: RISK_CONFIG.revenue[app.kyb.revenue] ?? 0 });
  const sub = app.categoryCheck?.verifiedSub ?? app.kyb.sub;
  const group = findSub(sub)?.group.id ?? '';
  factors.push({ factor: app.categoryCheck ? 'Verified category' : 'Declared category', value: sub, points: RISK_CONFIG.categoryGroup[group] ?? 1 });
  const score = factors.reduce((n, f) => n + f.points, 0);
  return { model: RISK_MODEL_VERSION, score, level: levelFor(score), factors };
}

/**
 * Not Eligible rules known to the prototype (each is a rule, never a score), plus the paused CR route.
 * "Not Eligible" is the only merchant-facing term; the reason code stays internal.
 */
export const HARD_BLOCKS: Array<{ reason: ReasonCode; where: string; source: string; route: string }> = [
  { reason: 'FL_CERT_REQUIRED', where: 'Page 1', source: 'Applicant type', route: 'Not Eligible immediately — no Identify, no OTP' },
  { reason: 'CATEGORY_NOT_SUPPORTED', where: 'Page 1 (declared) and after retrieval (verified)', source: 'Eligibility Matrix', route: 'Identify → OTP → Not Eligible (details saved, no paid check)' },
  { reason: 'REGULATORY_RESTRICTION', where: 'Page 1', source: 'Eligibility Matrix (regulatory)', route: 'Identify → OTP → Not Eligible (details saved, no paid check)' },
  { reason: 'ACTIVITY_REQUIRES_CR', where: 'Page 1 / certificate activity', source: 'Eligibility Matrix (regulatory)', route: 'Identify → OTP → Not Eligible (details saved, no paid check)' },
  { reason: 'CHANNEL_NOT_SUPPORTED', where: 'Page 1', source: 'Eligibility Matrix', route: 'Identify → OTP → Not Eligible (details saved, no paid check)' },
  { reason: 'ACTIVITY_REGULATED', where: 'After CR / certificate retrieval', source: 'Government activity mapping', route: 'Not Eligible, personalised reason' },
  { reason: 'NOT_OWNER_MANAGER', where: 'Page 2 declaration (after OTP)', source: 'Applicant declaration', route: 'Not Eligible; delegated onboarding is out of V1' },
  { reason: 'NO_OWNER_MANAGER_ON_CR', where: 'After people retrieval', source: 'Government associated parties', route: 'Not Eligible; declaration not confirmed by government data' },
  { reason: 'FL_IBAN_NOT_LINKED', where: 'Page 2 declaration (after OTP)', source: 'Applicant declaration', route: 'Not Eligible until the bank account is linked' },
  { reason: 'FL_CERT_NOT_FOUND', where: 'Certificate pre-check (before Nafath)', source: 'Freelance platform', route: 'Not Eligible; no Nafath call' },
  { reason: 'CR_EXPIRED', where: 'After CR retrieval', source: 'Government CR status', route: 'Paused: saved application + Sales recovery' },
  { reason: 'CR_SUSPENDED', where: 'After CR retrieval', source: 'Government CR status', route: 'Paused: saved application + Sales recovery' },
  { reason: 'CR_RESTRICTED', where: 'After CR retrieval', source: 'Government CR status (provisional)', route: 'Paused: saved application + Sales recovery' }
];
