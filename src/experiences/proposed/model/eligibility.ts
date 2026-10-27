/**
 * Stage 1 eligibility engine (preliminary). Evaluates applicant type + DECLARED category / subcategory
 * + sales channel against an ordered, versioned rule list. Exactly two results: ELIGIBLE and
 * NOT_ELIGIBLE. Revenue is still collected but never routes (no Sales-lead route): it is a risk input.
 * Once government activity is retrieved, the same category rules are re-run on the VERIFIED category.
 *
 * When Not Eligible is shown is part of the rule: a Freelancer without a certificate sees it on Page 1
 * (no identifier, mobile or OTP); an unsupported category continues through Identify + OTP first, so
 * Madfu keeps a verified contact, and then sees it — with no paid verification after the OTP.
 *
 * FIXTURE CATALOGUE. The production Eligibility Matrix is a PRODUCT TASK and is not defined yet: the
 * categories, rule types and example restrictions below are synthetic and only demonstrate behaviour.
 * In particular "Gold & jewellery" is an example, not the production policy.
 */
import { isFreelancer } from './config';
import type { ApplicantKind, Channel, Eligibility, EligibilityResult, Kyb, NotEligibleAt, ReasonCode, Revenue } from './types';

export const ELIGIBILITY_RULESET = 'KYB-RULES-v5-demo (2026-10-27)';

/** Rule types a subcategory can carry, per applicant type. */
export type CategoryRule = 'ALLOWED' | 'BLOCKED' | 'REGULATORY_PROHIBITED' | 'CR_REQUIRED' | 'FL_ONLINE_ONLY';

export const CATEGORY_RULE_LABEL: Record<CategoryRule, string> = {
  ALLOWED: 'Allowed',
  BLOCKED: 'Not supported (blacklisted)',
  REGULATORY_PROHIBITED: 'Regulatory prohibition',
  CR_REQUIRED: 'Requires a CR',
  FL_ONLINE_ONLY: 'Freelancer online only'
};

export interface Subcategory {
  id: string;
  label: string;
  rules: { CR: CategoryRule; FL: CategoryRule };
}
export interface CategoryGroup { id: string; label: string; subs: Subcategory[] }

const r = (CR: CategoryRule, FL: CategoryRule = CR) => ({ CR, FL });

export const CATEGORIES: CategoryGroup[] = [
  {
    id: 'retail', label: 'Retail & e-commerce', subs: [
      { id: 'retail-fashion', label: 'Fashion & accessories', rules: r('ALLOWED') },
      { id: 'retail-electronics', label: 'Electronics', rules: r('ALLOWED', 'FL_ONLINE_ONLY') },
      { id: 'retail-jewelry', label: 'Gold & jewellery (example)', rules: r('REGULATORY_PROHIBITED') }
    ]
  },
  {
    id: 'food', label: 'Food & beverage', subs: [
      { id: 'food-cafe', label: 'Cafés & coffee', rules: r('ALLOWED', 'CR_REQUIRED') },
      { id: 'food-homemade', label: 'Home-made food', rules: r('ALLOWED', 'FL_ONLINE_ONLY') }
    ]
  },
  {
    id: 'services', label: 'Services', subs: [
      { id: 'services-design', label: 'Design & creative services', rules: r('ALLOWED') },
      { id: 'services-photo', label: 'Photography', rules: r('ALLOWED') },
      { id: 'services-consulting', label: 'Business consulting', rules: r('ALLOWED') }
    ]
  },
  {
    id: 'fixture', label: 'Fixture examples (demo rules)', subs: [
      { id: 'fixture-blocked', label: 'Example: unsupported (blacklisted) category', rules: r('BLOCKED') }
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
export const subLabel = (subId: string) => {
  const f = findSub(subId);
  return f ? `${f.group.label} › ${f.sub.label}` : '';
};

/** Revenue is part of the input (it is collected and stored) but no rule reads it. */
export interface EligibilityInput { kind: ApplicantKind; sub: string; revenue: Revenue; channel: Channel }

export interface EligibilityRule {
  id: string;
  /** Plain description for the decision tables and the Eligibility Matrix backlog. */
  description: string;
  when: (i: EligibilityInput, rule: CategoryRule) => boolean;
  result: EligibilityResult;
  /** When the Not Eligible outcome is shown (null for ELIGIBLE). */
  notEligibleAt: NotEligibleAt | null;
  reason: ReasonCode;
  kind: 'regulatory' | 'business' | 'internal';
}

/** Ordered: the first matching rule wins. Internal: no external call is made in Stage 1. */
export const ELIGIBILITY_RULES: EligibilityRule[] = [
  { id: 'KYB-R01', description: 'Freelancer without a Freelancer Certificate', when: (i) => i.kind === 'FL_NO_CERT', result: 'NOT_ELIGIBLE', notEligibleAt: 'KYB', reason: 'FL_CERT_REQUIRED', kind: 'business' },
  { id: 'KYB-R02', description: 'Category not supported (blacklisted)', when: (_, c) => c === 'BLOCKED', result: 'NOT_ELIGIBLE', notEligibleAt: 'AFTER_OTP', reason: 'CATEGORY_NOT_SUPPORTED', kind: 'business' },
  { id: 'KYB-R03', description: 'Regulatory prohibition for this applicant type', when: (_, c) => c === 'REGULATORY_PROHIBITED', result: 'NOT_ELIGIBLE', notEligibleAt: 'AFTER_OTP', reason: 'REGULATORY_RESTRICTION', kind: 'regulatory' },
  { id: 'KYB-R04', description: 'Activity requires a CR and the applicant is a Freelancer', when: (i, c) => c === 'CR_REQUIRED' && isFreelancer(i.kind), result: 'NOT_ELIGIBLE', notEligibleAt: 'AFTER_OTP', reason: 'ACTIVITY_REQUIRES_CR', kind: 'regulatory' },
  { id: 'KYB-R05', description: 'Freelancer category allowed online only, applicant sells offline', when: (i, c) => c === 'FL_ONLINE_ONLY' && isFreelancer(i.kind) && i.channel !== 'online', result: 'NOT_ELIGIBLE', notEligibleAt: 'AFTER_OTP', reason: 'CHANNEL_NOT_SUPPORTED', kind: 'business' },
  { id: 'KYB-R06', description: 'Everything else, any revenue band: eligible for self-onboarding', when: () => true, result: 'ELIGIBLE', notEligibleAt: null, reason: 'OK', kind: 'internal' }
];

export const ruleFor = (kind: ApplicantKind, subId: string): CategoryRule => {
  const sub = findSub(subId)?.sub;
  if (!sub) return 'ALLOWED';
  return kind === 'CR' ? sub.rules.CR : sub.rules.FL;
};

export function evaluateEligibility(i: EligibilityInput, at = new Date().toISOString()): Eligibility {
  const cat = ruleFor(i.kind, i.sub);
  const rule = ELIGIBILITY_RULES.find((x) => x.when(i, cat))!;
  return { result: rule.result, notEligibleAt: rule.notEligibleAt, reason: rule.reason, ruleId: rule.id, ruleset: ELIGIBILITY_RULESET, at };
}

export const kybComplete = (k: Kyb): k is Kyb & { kind: ApplicantKind; revenue: Revenue; channel: Channel } =>
  !!k.kind && !!k.group && !!k.sub && !!k.revenue && !!k.channel;
