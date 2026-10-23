/**
 * Decision tables, open decisions and the product backlog for Madfu Proposed. Rows are COMPUTED from
 * the same configuration and functions the prototype runs, so documents cannot drift from the app.
 */
import { ACTIVITY_MAPPING, ACTIVITY_MAPPING_VERSION, MAPPING_ACTION, activityByCode } from './activity';
import { LIMITS, REVENUE_RULE, RULE_FLAGS, STAGES, kindLabel } from './config';
import { OUTCOME_COPY, REASON_LABEL, STATUS_LABEL } from './copy';
import { CATEGORIES, CATEGORY_RULE_LABEL, ELIGIBILITY_RULES, ELIGIBILITY_RULESET, subLabel } from './eligibility';
import { GOV_RULES, GOV_RULESET } from './government';
import { BASE_PLANS, OPTIONAL_PLANS, PRICING_MATRIX, PRICING_VERSION, pct } from './pricing';
import { contractEligible, prefill } from './state';
import type { Application, OutcomeKind } from './types';
import { URL_RULES } from './urls';
import { DEPENDS_ON, FRESHNESS_DAYS, INVALIDATION_RULES, VERIFICATION_LABEL } from './verifications';

export interface Table { id: string; title: string; note?: string; head: string[]; rows: string[][] }

const stagesTable: Table = {
  id: 'stages', title: 'Stages', head: ['#', 'Stage', 'Screens'],
  rows: STAGES.map((s) => [String(s.n), s.label, s.steps.join(' · ')])
};

const eligibilityRules: Table = {
  id: 'eligibility', title: `Stage 1 eligibility rules (ordered, ${ELIGIBILITY_RULESET})`, head: ['Rule', 'Condition', 'Result', 'Reason code', 'Type'],
  rows: ELIGIBILITY_RULES.map((r) => [r.id, r.description, r.result, r.reason, r.kind]),
  note: 'First matching rule wins. Evaluated internally before any external call. Production Eligibility Matrix: PRODUCT TASK.'
};

const catalogue: Table = {
  id: 'catalogue', title: 'Category rules (synthetic fixture catalogue)', head: ['Madfu subcategory', 'Registered business', 'Freelancer'],
  rows: CATEGORIES.flatMap((g) => g.subs.map((s) => [`${g.label} › ${s.label}`, CATEGORY_RULE_LABEL[s.rules.CR], CATEGORY_RULE_LABEL[s.rules.FL]])),
  note: 'Example only (e.g. gold & jewellery). Not the production policy catalogue.'
};

const urlTable: Table = {
  id: 'urls', title: 'Website and Google Maps validation (configurable)', head: ['Field', 'Accepted', 'Rejected'],
  rows: [
    ['Website (Online / Both)', 'https:// link with a real domain', `Social media (${URL_RULES.socialHosts.slice(0, 5).join(', ')}…) · WhatsApp (${URL_RULES.whatsappHosts.slice(0, 2).join(', ')}…) · invalid format`],
    ['Google Maps URL (Offline / Both)', `${URL_RULES.mapsHosts.join(', ')} · google.com/maps`, 'Any other host, social links, invalid format']
  ],
  note: 'A format check does not prove the applicant owns the website or location.'
};

const govTable: Table = {
  id: 'government', title: `Government CR validation (${GOV_RULESET})`, head: ['Check', 'Condition', 'Action'],
  rows: [
    ...Object.entries(GOV_RULES.statusAction).map(([st, a]) => ['CR status', st, `${a.action}${a.reason !== 'OK' ? ` (${a.reason})` : ''}`]),
    ['CR age', `${GOV_RULES.minCrAgeMonths} months or less`, 'temporarily_not_eligible (CR_TOO_RECENT)'],
    ['National Address', 'Missing / expired', 'continue + flag'],
    ['Legal entity', GOV_RULES.additionalDocumentsFor.join(', '), 'continue + "additional documents required" (collected later)']
  ],
  note: 'Only these rules are known. The full Decision & Validation Inventory is a PRODUCT TASK.'
};

const activityTable: Table = {
  id: 'activity', title: `Category ↔ government activity mapping (${ACTIVITY_MAPPING_VERSION})`, head: ['Declared subcategory', 'Government activity', 'Outcome', 'Action'],
  rows: ACTIVITY_MAPPING.map((m) => [subLabel(m.sub), activityByCode(m.activity)?.label ?? m.activity, m.outcome, MAPPING_ACTION[m.outcome]])
    .concat([['Any pair not listed', '—', 'UNMAPPED', MAPPING_ACTION.UNMAPPED], ['Registered activity not eligible for the applicant', 'e.g. gold & jewellery', 'any', 'stop']]),
  note: 'Synthetic fixture. Production mapping: PRODUCT TASK for the Product/Business team.'
};

const reuseTable: Table = {
  id: 'reuse', title: 'Verification reuse (cost rule)', head: ['Verification', 'Depends on', 'Freshness policy', 'On ordinary resume'],
  rows: (Object.keys(DEPENDS_ON) as Array<keyof typeof DEPENDS_ON>).map((t) => [VERIFICATION_LABEL[t], DEPENDS_ON[t], FRESHNESS_DAYS[t] === null ? 'Reusable until invalidated' : `${FRESHNESS_DAYS[t]} days`, 'Reused — no new provider call']),
  note: 'Previously successful external checks are reused until their dependent data changes or an explicit freshness policy invalidates them. Resume normally costs one SMS OTP.'
};

const invalidationTable: Table = {
  id: 'invalidation', title: 'Edit → what is invalidated', head: ['Change', 'External verifications invalidated', 'Internal re-evaluation'],
  rows: INVALIDATION_RULES.map((r) => [r.change, r.invalidates.length ? r.invalidates.map((t) => VERIFICATION_LABEL[t]).join(', ') : 'None', r.extra ? `${r.internal}. ${r.extra}` : r.internal])
};

const pricingTable: Table = {
  id: 'pricing', title: `Pricing & Commission Matrix (${PRICING_VERSION}, synthetic)`, head: ['Category / subcategory', `Standard (${BASE_PLANS.join(' + ')} months, included)`, ...OPTIONAL_PLANS.map((t) => `${t} months (optional)`)],
  rows: PRICING_MATRIX.map((p) => [p.key, pct(p.standard), ...OPTIONAL_PLANS.map((t) => pct(p.optional[t as 6 | 9 | 12]))]),
  note: 'Standard commission never drops because of self-declared revenue. Optional evidence triggers an internal Commercial review; onboarding continues with the standard rate.'
};

function contractTable(): Table {
  const cases: Array<[string, 'CR' | 'FL_CERT', (a: Application) => Application]> = [
    ['Nafath verified, IBAN verified', 'CR', (a) => a],
    ['Nafath verified, IBAN unverified after 2 checks', 'CR', (a) => ({ ...a, business: { ...a.business, ibanStatus: 'unverified' } })],
    ['Activity conflict, team to confirm', 'CR', (a) => ({ ...a, flags: ['ACTIVITY_CONFLICT_REVIEW'] })],
    ['Nafath failed twice', 'CR', (a) => ({ ...a, nafath: { ...a.nafath, status: 'exhausted' } })],
    ['Nafath verified, certificate selected, bank linked', 'FL_CERT', (a) => a],
    ['Nafath verified, bank NOT linked to certificate', 'FL_CERT', (a) => ({ ...a, business: { ...a.business, bankLinked: 'no', ibanStatus: 'skipped' } })]
  ];
  return {
    id: 'contract', title: 'Contract gate (computed from the prototype rule)', head: ['Applicant', 'Situation', 'Contract'],
    rows: cases.map(([label, k, f]) => [kindLabel(k), label, contractEligible(f(prefill(k, 'review'))) ? 'Contract available' : 'No contract: manual verification']),
    note: `Freelancer bank-link gate is a rule flag (currently ${RULE_FLAGS.flLinkedIbanRequiredBeforeContract ? 'ON' : 'OFF'}), pending a Compliance decision.`
  };
}

function outcomesTable(): Table {
  const map: Array<[OutcomeKind, keyof typeof STATUS_LABEL]> = [
    ['SUBMITTED', 'SUBMITTED'], ['SUBMITTED_BANKING_PENDING', 'SUBMITTED_BANKING_PENDING'], ['MANUAL_VERIFICATION', 'SUBMITTED_MANUAL_VERIFICATION'],
    ['SALES_LEAD', 'LEAD_HIGH_REVENUE'], ['SALES_LEAD', 'LEAD_LOW_REVENUE'], ['FL_CERT_REQUIRED', 'LEAD_FL_CERT_REQUIRED'], ['FL_CERT_REQUIRED', 'LEAD_FL_CERT_NOT_FOUND'],
    ['NOT_ELIGIBLE', 'NOT_ELIGIBLE'], ['TEMPORARILY_NOT_ELIGIBLE', 'TEMPORARILY_NOT_ELIGIBLE'], ['EXISTING_MERCHANT', 'EXISTING_MERCHANT'],
    ['DUPLICATE_IDENTITY', 'DUPLICATE_IDENTITY'], ['CONTRACT_DECLINED', 'CONTRACT_DECLINED']
  ];
  return { id: 'outcomes', title: 'Outcomes: applicant sees vs internal status', head: ['Applicant sees', 'Internal status'], rows: map.map(([o, s]) => [OUTCOME_COPY[o].title, STATUS_LABEL[s]]) };
}

const reasonsTable: Table = {
  id: 'reasons', title: 'Internal reason codes (never shown as such)', head: ['Code', 'Meaning'],
  rows: Object.entries(REASON_LABEL).map(([k, v]) => [k, v])
};

export const DECISION_TABLES: Table[] = [stagesTable, eligibilityRules, catalogue, urlTable, govTable, activityTable, reuseTable, invalidationTable, pricingTable, contractTable(), outcomesTable(), reasonsTable];

/* ------------------------------------------------------------------ open decisions (do not present as rules) */

export interface OpenItem {
  id: string;
  type: 'PRODUCT TASK' | 'COMPLIANCE DECISION' | 'PRODUCT / COMPLIANCE DECISION' | 'PRODUCT/COMMERCIAL DECISION' | 'PRODUCT/ENGINEERING DECISION' | 'PRODUCT DECISION';
  title: string;
  detail: string;
  /** Points still to clarify (shown in the docs). */
  clarify?: string[];
  /** Set when the prototype deliberately has NO logic for this item. */
  notImplemented?: boolean;
}

export const NOT_IMPLEMENTED = 'NOT IMPLEMENTED — DECISION REQUIRED';

export const OPEN_ITEMS: OpenItem[] = [
  { id: 'OD-1', type: 'PRODUCT TASK', title: 'Define the full Eligibility Matrix', detail: 'Category · subcategory · applicant type · sales channel · revenue band · result · CR / certificate required · manual review · regulatory restriction · reason code · rule version.' },
  { id: 'OD-2', type: 'PRODUCT TASK', title: 'Define the Pricing & Commission Matrix', detail: 'Category · subcategory · merchant / revenue tier · tenure · standard commission · improved / negotiated logic · proof requirement · effective date / version.' },
  { id: 'OD-3', type: 'PRODUCT TASK', title: 'Define Category/Subcategory ↔ CR Activity mapping', detail: 'MATCH / COMPATIBLE / AMBIGUOUS / CONFLICT / UNMAPPED per pair, and the action for each (continue, manual review, stop, clarification).' },
  { id: 'OD-4', type: 'PRODUCT TASK', title: 'Complete the Onboarding Decision & Validation Inventory', detail: 'Every rule from merchant input, government CR data, National Address, freelancer data, regulation, Madfu policy, categories, CR activities / age / status, legal entity, nationality, violations, banking, sales channel. Per rule: source, field, condition, type, regulatory / business / internal, stage, blocking, user message, internal status, manual follow-up, external-call cost, version.' },
  { id: 'OD-5', type: 'COMPLIANCE DECISION', title: 'Freelancer linked IBAN before contract?', detail: `Can a Freelancer sign the Madfu contract before the required IBAN is linked to the Freelancer Certificate? Prototype rule flag: ${RULE_FLAGS.flLinkedIbanRequiredBeforeContract} (least disruptive: contract allowed, banking follow-up).` },
  { id: 'OD-6', type: 'PRODUCT/COMMERCIAL DECISION', title: 'Optional better-pricing documents', detail: 'Which documents qualify a merchant for improved pricing. Prototype: "Revenue supporting document A / B" placeholders. Contract amendment / repricing after review also open.' },
  { id: 'OD-7', type: 'PRODUCT/ENGINEERING DECISION', title: 'Freshness / expiry policy for stored verifications', detail: 'CR data, people, Nafath, certificates, IBAN. Prototype: "Reusable until invalidated" (no expiry) for all.' },
  {
    id: 'OD-8', type: 'PRODUCT / COMPLIANCE DECISION', title: 'Mobile ownership vs selected authorized person', notImplemented: true,
    detail: 'Registered business: what should happen if the OTP-verified mobile number is not associated with the National ID of the CR owner / authorized person selected for Nafath? The prototype has no logic for this: it does not block, call a provider, show a message or change Nafath.',
    clarify: [
      'Is mobile ↔ National ID ownership matching required?',
      'At what stage should it be checked?',
      'Is it regulatory, risk, or Madfu business policy?',
      'Does a mismatch block self-onboarding?',
      'Can another owner be selected?',
      'Does it route to manual verification?',
      'Can Nafath itself provide sufficient identity assurance?',
      'Which provider / data source should perform the match?',
      'Is the verification paid?',
      'Can an existing result be reused on resume?'
    ]
  }
];

/** Earlier open points that remain valid. Not counted in the seven required items. */
export const OTHER_OPEN_POINTS: string[] = [
  `Exact treatment of SAR ${REVENUE_RULE.selfServiceFromSar.toLocaleString('en-US')} and SAR ${REVENUE_RULE.selfServiceToSar.toLocaleString('en-US')} (policy boundary to confirm; prototype: inside the self-service band).`,
  `Government status → action mapping (prototype: expired and violation → manual verification, suspended → not eligible).`,
  'Providers behind CR data, associated people, certificates, IBAN ownership and the contract (prototype: neutral simulated adapters).',
  `Whether a Nafath technical failure uses one of the ${LIMITS.nafathAttempts} attempts (rule flag: ${RULE_FLAGS.nafathTechnicalFailureCounts}).`,
  'Which additional documents non-Saudi entities need, and when operations collect them.'
];

export const ASSUMPTIONS: string[] = [
  'Know Your Business is the first page: no CR, National ID, mobile or OTP before eligibility.',
  'Application and merchant account are separate: no login or password during onboarding.',
  'A Continue link identifies an application; OTP is always required to reopen it.',
  'Stage-1 answers are never asked again; they are shown with Edit.',
  'Nafath verifies identity and authority; it is not the contract signature.',
  'IBAN is the only bank input; bank name is derived. No standard-path document uploads; Freelancers upload nothing.',
  'Payment plans and commission live in the Commercial Offer; the Contract shows them as contract content only.',
  'Source of Revenue / Source of Income are not asked.'
];
