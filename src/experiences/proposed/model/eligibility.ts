/**
 * Stage 1 eligibility engine (preliminary). Evaluates applicant type + DECLARED category / subcategory
 * + revenue + sales channel against an ordered, versioned rule list. Results: SELF_ONBOARDING,
 * SALES_LEAD, BLOCKED. Categories are allowed or blocked; there is no manual-review category route.
 * Once government activity is retrieved, the same rules are re-run on the VERIFIED category.
 *
 * FIXTURE CATALOGUE. The production Eligibility Matrix is a PRODUCT TASK and is not defined yet: the
 * categories, rule types and example restrictions below are synthetic and only demonstrate behaviour.
 * In particular "Gold & jewellery" is an example, not the production policy.
 */
import { REVENUE_RULE, isFreelancer } from './config';
import type { ApplicantKind, Channel, Eligibility, EligibilityResult, Kyb, ReasonCode, Revenue } from './types';

export const ELIGIBILITY_RULESET = 'KYB-RULES-v4-demo (2026-10-27)';

/** Rule types a subcategory can carry, per applicant type. */
export type CategoryRule = 'ALLOWED' | 'BLOCKED' | 'REGULATORY_PROHIBITED' | 'CR_REQUIRED' | 'FL_ONLINE_ONLY';

export const CATEGORY_RULE_LABEL: Record<CategoryRule, string> = {
  ALLOWED: 'Allowed',
  BLOCKED: 'Blocked / blacklisted',
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
      { id: 'fixture-blocked', label: 'Example: blacklisted category', rules: r('BLOCKED') }
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

export interface EligibilityInput { kind: ApplicantKind; sub: string; revenue: Revenue; channel: Channel }

export interface EligibilityRule {
  id: string;
  /** Plain description for the decision tables and the Eligibility Matrix backlog. */
  description: string;
  when: (i: EligibilityInput, rule: CategoryRule) => boolean;
  result: EligibilityResult;
  reason: ReasonCode;
  kind: 'regulatory' | 'business' | 'internal';
}

/** Ordered: the first matching rule wins. Internal: no external call is made in Stage 1. */
export const ELIGIBILITY_RULES: EligibilityRule[] = [
  { id: 'KYB-R01', description: 'Category blocked / blacklisted', when: (_, c) => c === 'BLOCKED', result: 'BLOCKED', reason: 'CATEGORY_NOT_SUPPORTED', kind: 'business' },
  { id: 'KYB-R02', description: 'Regulatory prohibition for this applicant type', when: (_, c) => c === 'REGULATORY_PROHIBITED', result: 'BLOCKED', reason: 'REGULATORY_RESTRICTION', kind: 'regulatory' },
  { id: 'KYB-R03', description: 'Activity requires a CR and the applicant is a Freelancer', when: (i, c) => c === 'CR_REQUIRED' && isFreelancer(i.kind), result: 'BLOCKED', reason: 'ACTIVITY_REQUIRES_CR', kind: 'regulatory' },
  { id: 'KYB-R04', description: 'Freelancer category allowed online only, applicant sells offline', when: (i, c) => c === 'FL_ONLINE_ONLY' && isFreelancer(i.kind) && i.channel !== 'online', result: 'BLOCKED', reason: 'CHANNEL_NOT_SUPPORTED', kind: 'business' },
  { id: 'KYB-R05', description: 'Freelancer without a Freelancer Certificate: kept as a lead', when: (i) => i.kind === 'FL_NO_CERT', result: 'SALES_LEAD', reason: 'FL_CERT_REQUIRED', kind: 'business' },
  { id: 'KYB-R06', description: `Registered business below SAR ${REVENUE_RULE.selfServiceFromSar.toLocaleString('en-US')}: lead (Business Team decides under the proposed policy)`, when: (i) => i.kind === 'CR' && i.revenue === 'BELOW_100K', result: 'SALES_LEAD', reason: 'REVENUE_BELOW_BAND', kind: 'business' },
  { id: 'KYB-R07', description: `Registered business above SAR ${REVENUE_RULE.salesAboveSar.toLocaleString('en-US')}: Sales lead`, when: (i) => i.kind === 'CR' && i.revenue === 'ABOVE_20M', result: 'SALES_LEAD', reason: 'REVENUE_ABOVE_BAND', kind: 'business' },
  { id: 'KYB-R08', description: 'Everything else: self-onboarding', when: () => true, result: 'SELF_ONBOARDING', reason: 'OK', kind: 'internal' }
];

export const ruleFor = (kind: ApplicantKind, subId: string): CategoryRule => {
  const sub = findSub(subId)?.sub;
  if (!sub) return 'ALLOWED';
  return kind === 'CR' ? sub.rules.CR : sub.rules.FL;
};

export function evaluateEligibility(i: EligibilityInput, at = new Date().toISOString()): Eligibility {
  const cat = ruleFor(i.kind, i.sub);
  const rule = ELIGIBILITY_RULES.find((x) => x.when(i, cat))!;
  return { result: rule.result, reason: rule.reason, ruleId: rule.id, ruleset: ELIGIBILITY_RULESET, at };
}

export const kybComplete = (k: Kyb): k is Kyb & { kind: ApplicantKind; revenue: Revenue; channel: Channel } =>
  !!k.kind && !!k.group && !!k.sub && !!k.revenue && !!k.channel;
