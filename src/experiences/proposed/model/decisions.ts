/**
 * Rules & Decisions for Madfu Proposed. Tables are COMPUTED from the same configuration and functions
 * the prototype runs, so documents cannot drift from the app. Confirmed product decisions and open
 * decisions are kept apart: open items are never presented as rules.
 */
import { ACTIVITIES, ACTIVITY_MAPPING_VERSION } from './activity';
import { COST_ASSUMPTIONS_SAR, LIMITS, PREREQUISITE_QUESTION, REVENUE_RULE, RULE_FLAGS, STAGES } from './config';
import { OUTCOME_COPY, REASON_LABEL, STATUS_LABEL } from './copy';
import { CATEGORIES, CATEGORY_RULE_LABEL, ELIGIBILITY_RULES, ELIGIBILITY_RULESET, subLabel } from './eligibility';
import { GOV_RULES, GOV_RULESET } from './government';
import { PRICING_MATRIX, PRICING_VERSION, pct } from './pricing';
import { HARD_BLOCKS, RISK_CONFIG, RISK_MODEL_VERSION } from './risk';
import { contractEligible, prefill } from './state';
import type { Application, Lifecycle } from './types';
import { URL_RULES } from './urls';
import { CALL_ORDER, DEPENDS_ON, EDIT_POLICY, FRESHNESS_DAYS, NEGATIVE_POLICY, VERIFICATION_LABEL } from './verifications';

export interface Table { id: string; title: string; note?: string; head: string[]; rows: string[][] }

/* ------------------------------------------------------------------ confirmed product decisions (2026-10-27) */

export const CONFIRMED_DECISIONS: string[] = [
  'Know Your Business (Page 1) asks only applicant type, category, subcategory, annual revenue and sales channel — no website or Google Maps link.',
  'Identifier + mobile are Page 2, with one prerequisite question for self-onboarding.',
  'An internal existence check runs before any OTP; it calls no provider.',
  'Existing applications and merchant accounts are opened only by an OTP to the REGISTERED mobile (last three digits shown); the newly entered mobile is never used for them.',
  'No automatic account / application takeover, no access-request and no replacement-mobile workflow in V1.',
  `Registered-business applicants declare "${PREREQUISITE_QUESTION.CR}"; No stops self-onboarding before any paid check.`,
  'Delegated-person onboarding is out of V1.',
  `Freelancers declare "${PREREQUISITE_QUESTION.FL_CERT}"; No stops self-onboarding before any paid check. The linkage is still verified technically later.`,
  'The Freelancer Certificate existence check runs before Nafath when provider / compliance permits (rule flag); the applicant still sees Nafath → certificate.',
  'Mobile ↔ National ID ownership is checked before every Nafath request; on a mismatch the mobile can be corrected with a new OTP, without restarting.',
  'Sales leads stop after OTP: no CR, Nafath, banking or contract; the lead is persisted.',
  'Blocked outcomes show a personalised reason per rule; internal scoring is never exposed.',
  'After retrieval, the government CR activity (or certificate activity) is the source of truth for the category; the declared category cannot be edited to bypass it.',
  'Commercial pricing uses the verified, mapped category.',
  'Multiple CR activities are supported in the data model; many activities can map to one Madfu subcategory.',
  'CR age is a backend risk attribute, not a fixed rejection. Hard blocks and risk scores are separate.',
  'Expired / suspended CR: the application is saved and handed to Sales for recovery; no merchant-facing Refresh and no further paid checks.',
  'There is no separate CR confirmation page: the merchant sees a screen only when they must act.',
  'Website / Google Maps store-presence links moved to Business Details; Google Maps is the selling branch, not the National Address.',
  'Registered businesses give no IBAN during onboarding (payout account added later, at activation).',
  'Freelancer IBAN is kept and its linkage to the Freelancer Certificate is verified.',
  'VAT and the number of branches are removed from onboarding.',
  'Payment-plan selection is removed from onboarding (configured later in the Merchant Portal). The Commercial Offer shows the standard offer and Continue.',
  'The better-rate request stays optional and low-priority (collapsed; uploads only after "Request rate review"); the interest is kept even without a file.',
  'The Contract page has no Decline action: Back to Review, or Agree & Submit.',
  'Submitted applications open Application Progress; they never reopen Review, Contract or submission.',
  'Resume continues incomplete applications at the first unfinished stage, reusing every valid check.',
  'Verified, sensitive sections are locked; the few editable sections use a transactional edit (draft → Save; Cancel restores all).',
  'Negative / freshness policy depends on the result type; there is no universal expiry.',
  'OTP is not the only abuse control: rate limiting, IP / device throttling, eligibility limits, bounded resends and attempts, and a bot challenge when suspicious.'
];

/* ------------------------------------------------------------------ tables */

const stagesTable: Table = {
  id: 'stages', title: 'Stages', head: ['#', 'Stage', 'Screens'],
  rows: STAGES.map((s) => [String(s.n), s.label, s.steps.join(' · ')])
};

const eligibilityRules: Table = {
  id: 'eligibility', title: `Page 1 preliminary eligibility rules (ordered, ${ELIGIBILITY_RULESET})`, head: ['Rule', 'Condition', 'Result', 'Reason code', 'Type'],
  rows: ELIGIBILITY_RULES.map((r) => [r.id, r.description, r.result, r.reason, r.kind]),
  note: `First matching rule wins. Internal, before any external call. Revenue thresholds are configuration (SAR ${REVENUE_RULE.selfServiceFromSar.toLocaleString('en-US')} / SAR ${REVENUE_RULE.salesAboveSar.toLocaleString('en-US')}). Production Eligibility Matrix: PRODUCT TASK.`
};

const catalogue: Table = {
  id: 'catalogue', title: 'Category rules (synthetic fixture catalogue)', head: ['Madfu subcategory', 'Registered business', 'Freelancer'],
  rows: CATEGORIES.flatMap((g) => g.subs.map((s) => [`${g.label} › ${s.label}`, CATEGORY_RULE_LABEL[s.rules.CR], CATEGORY_RULE_LABEL[s.rules.FL]])),
  note: 'Categories are allowed or blocked; there is no manual-review category route. Example only (e.g. gold & jewellery).'
};

const routingTable: Table = {
  id: 'routing', title: 'Page 2 → existence check → OTP → routing', head: ['Existence (internal)', 'OTP sent to', 'After the code'],
  rows: [
    ['New identifier, Page 1 = Sales lead', 'Entered mobile', 'Lead persisted → "Thank you. Our Sales team will contact you." (no further data)'],
    ['New identifier, Freelancer without certificate', 'Entered mobile', 'Lead persisted → certificate-required outcome'],
    ['New identifier, prerequisite = No', 'Entered mobile', 'Blocked with a personalised reason (owner / manager, or IBAN linkage)'],
    ['New identifier, registered business', 'Entered mobile', 'Application created (DRAFT) → Business verification'],
    ['New identifier, Freelancer with certificate', 'Entered mobile', 'Application created (DRAFT) → certificate pre-check → Nafath'],
    ['Incomplete application (DRAFT)', 'Registered application mobile (•••••••123)', 'Resume at the first unfinished stage; valid checks reused'],
    ['Submitted, not live', 'Registered application mobile', 'Application Progress (status only)'],
    ['Paused (CR expired / suspended)', 'Registered application mobile', 'Saved; Sales will help you continue'],
    ['Live merchant', 'Registered account mobile', 'Merchant login; no application created'],
    ['Code not completed', '—', 'No access; nothing exposed; no new application']
  ],
  note: `Throttled after ${LIMITS.identifyChecksPerSession} Page-2 submissions per session (simulated rate limit / bot challenge).`
};

const LIFECYCLE: Lifecycle[] = ['QUALIFICATION', 'OTP_PENDING', 'DRAFT', 'SALES_LEAD', 'BLOCKED', 'PAUSED_CR', 'SUBMITTED', 'UNDER_REVIEW', 'ACTION_REQUIRED', 'APPROVED', 'UNABLE_TO_PROCEED', 'LIVE'];
const LIFECYCLE_ROUTE: Record<Lifecycle, string> = {
  QUALIFICATION: 'Page 1 / Page 2 (nothing persisted)', OTP_PENDING: 'OTP screen', DRAFT: 'First unfinished stage', SALES_LEAD: 'Lead outcome',
  BLOCKED: 'Blocked outcome', PAUSED_CR: 'Sales / manual follow-up message', SUBMITTED: 'Application Progress', UNDER_REVIEW: 'Application Progress',
  ACTION_REQUIRED: 'Application Progress', APPROVED: 'Application Progress', UNABLE_TO_PROCEED: 'Application Progress', LIVE: 'Merchant login'
};
const lifecycleTable: Table = {
  id: 'lifecycle', title: 'Application lifecycle → where the application opens', head: ['Status', 'Meaning', 'Opens at'],
  rows: LIFECYCLE.map((l) => [l, STATUS_LABEL[l], LIFECYCLE_ROUTE[l]]),
  note: 'Routing reads status + outcome first; only a DRAFT is routed by completion (first unfinished stage). Merchant entity (CR / National ID), Application and User / mobile are separate: knowing the CR never grants access.'
};

const urlTable: Table = {
  id: 'urls', title: 'Business Details: store-presence validation (configurable)', head: ['Field', 'Asked when', 'Accepted', 'Rejected'],
  rows: [
    ['Online store / business website', 'Channel Online or Both', 'Any real domain, with or without https:// (Saudi and Arabic domains, store platforms)', `Social media (${URL_RULES.socialHosts.slice(0, 4).join(', ')}…) · WhatsApp · link shorteners · invalid format`],
    ['Google Maps branch / store link', 'Channel Offline or Both', `${URL_RULES.mapsHosts.join(', ')} · goo.gl/maps · maps.google.* · google.*/maps (any country domain)`, 'Any other host or path, invalid format']
  ],
  note: 'Fraud / store-presence evidence. Google Maps = actual selling location; National Address = legal / HQ data from the CR. A format check does not prove ownership.'
};

const govTable: Table = {
  id: 'government', title: `Government CR rules — hard (${GOV_RULESET})`, head: ['Check', 'Condition', 'Action'],
  rows: [
    ...Object.entries(GOV_RULES.statusAction).map(([st, a]) => ['CR status', st, a.action === 'continue' ? 'continue' : `saved + Sales recovery (${a.reason})`]),
    ['CR age', 'any', 'No hard rule: risk attribute (see risk model)'],
    ['National Address', 'Missing / expired', 'continue + flag'],
    ['Legal entity', GOV_RULES.additionalDocumentsFor.join(', '), 'continue + "additional documents required" (collected later)']
  ],
  note: 'RESTRICTED follows the Sales route provisionally; the hard-block inventory is open.'
};

const hardBlockTable: Table = {
  id: 'hard-blocks', title: 'Hard blocks (rules) — separate from the risk score', head: ['Reason', 'Where', 'Source', 'Route'],
  rows: HARD_BLOCKS.map((h) => [h.reason, h.where, h.source, h.route]),
  note: 'A hard regulatory or business rule is never converted into a score to let a merchant continue.'
};

const riskTable: Table = {
  id: 'risk', title: `Backend risk model (${RISK_MODEL_VERSION}, synthetic)`, head: ['Factor', 'Values → demo points'],
  rows: [
    ['CR age', RISK_CONFIG.crAge.map((b) => `${b.label}: ${b.points}`).join(' · ')],
    ['Declared revenue', Object.entries(RISK_CONFIG.revenue).map(([k, v]) => `${k}: ${v}`).join(' · ')],
    ['Verified category group', Object.entries(RISK_CONFIG.categoryGroup).map(([k, v]) => `${k}: ${v}`).join(' · ')],
    ['Entity', Object.entries(RISK_CONFIG.entity).map(([k, v]) => `${k}: ${v}`).join(' · ')],
    ['National Address', Object.entries(RISK_CONFIG.nationalAddress).map(([k, v]) => `${k}: ${v}`).join(' · ')],
    ['Not modelled', RISK_CONFIG.notModelled.join(' · ')],
    ['Level', `LOW < ${RISK_CONFIG.thresholds.mediumFrom} ≤ MEDIUM < ${RISK_CONFIG.thresholds.highFrom} ≤ HIGH`]
  ],
  note: 'Backend only; never shown to the merchant; never rejects on its own. Production factors, weights and thresholds: RISK DECISION.'
};

const activityTable: Table = {
  id: 'activity', title: `Government activity → Madfu category (${ACTIVITY_MAPPING_VERSION})`, head: ['Government activity', 'Madfu subcategory'],
  rows: ACTIVITIES.map((a) => [`${a.code} · ${a.label}`, a.mappedSub ? subLabel(a.mappedSub) : 'Not mapped']),
  note: 'Many-to-one. A CR carries several activities. Demo reconciliation: a regulated activity blocks; an activity matching the declaration confirms it; otherwise the primary mapped activity reclassifies; nothing mapped keeps the declaration provisionally (internal flag). Final mapping and multi-activity rules: open.'
};

const costTable: Table = {
  id: 'cost', title: 'External-call order and cost assumptions', head: ['Applicant', 'Order of paid calls (backend)', 'What the applicant sees'],
  rows: [
    ['Before the first OTP', 'None (eligibility and existence checks are internal)', 'Page 1 → Page 2 → code'],
    ['Registered business', CALL_ORDER.CR.join(' → '), 'Code → owner / manager → Send to Nafath'],
    ['Freelancer', CALL_ORDER.FL_CERT.join(' → '), 'Code → Nafath → certificate → IBAN'],
    ['Sales lead / blocked', 'OTP only', 'Code → outcome'],
    ['Expired / suspended CR', 'OTP → CR data (then stop)', 'Code → saved, Sales follow-up'],
    ['Ordinary resume', 'OTP only (valid checks reused)', 'Code → first unfinished stage']
  ],
  note: `Product cost assumptions (Internal view only): ${Object.entries(COST_ASSUMPTIONS_SAR).map(([k, v]) => `${k} ${v === null ? 'unknown' : `≈ SAR ${v}`}`).join(' · ')}. Certificate pre-check rule flag: ${RULE_FLAGS.flCertificatePrecheckBeforeNafath ? 'ON' : 'OFF'} (pending provider / compliance permission).`
};

const reuseTable: Table = {
  id: 'reuse', title: 'Verification reuse (positive results)', head: ['Verification', 'Depends on', 'Freshness policy', 'On ordinary resume'],
  rows: (Object.keys(DEPENDS_ON) as Array<keyof typeof DEPENDS_ON>).map((t) => [VERIFICATION_LABEL[t], DEPENDS_ON[t], FRESHNESS_DAYS[t] === null ? 'Reusable until invalidated (policy open)' : `${FRESHNESS_DAYS[t]} days`, 'Reused — no new provider call']),
  note: 'Resume normally costs one SMS OTP.'
};

const negativeTable: Table = {
  id: 'negative', title: 'Negative / technical results — policy per result type', head: ['Result', 'Policy', 'Merchant sees', 'Repeat call'],
  rows: NEGATIVE_POLICY.map((n) => [n.result, n.policy, n.merchantSees, n.repeatCall])
};

const editTable: Table = {
  id: 'edit', title: 'Review: locked vs editable sections', head: ['Section', 'Editable', 'Invalidates', 'Note'],
  rows: EDIT_POLICY.map((e) => [e.section, e.editable ? 'Yes (transactional)' : 'Locked', e.invalidates.length ? e.invalidates.join(', ') : 'Nothing', e.note]),
  note: 'Transactional edit: values change in a draft; Save applies; Cancel restores the whole application; nothing is invalidated before Save.'
};

const abuseTable: Table = {
  id: 'abuse', title: 'Abuse protection (architecture; prototype simulates the bounded parts)', head: ['Control', 'Where', 'Prototype'],
  rows: [
    ['Request rate limiting', 'Page 1 and Page 2 endpoints', `Page 2 throttled after ${LIMITS.identifyChecksPerSession} submissions / session; simulator toggle`],
    ['IP / device throttling', 'Edge / API gateway', 'Documented (not simulated)'],
    ['Eligibility request limits', 'Page 1', 'Documented (not simulated)'],
    ['OTP resend limit', 'OTP', `${LIMITS.otpResends} resends, ${LIMITS.otpResendSeconds} s cooldown; resend never restores the budget`],
    ['OTP attempt limit', 'OTP', `${LIMITS.otpAttempts} wrong codes per code; locked after the last code`],
    ['Bot protection / challenge when suspicious', 'Page 2', 'Shown as the throttled state'],
    ['Paid-call bounds', 'Providers', `Mobile check ${LIMITS.mobileMatchChecks} / application · Nafath ${LIMITS.nafathAttempts} failures / application, ${LIMITS.nafathTechnicalRetries} technical / session · IBAN ${LIMITS.ibanAttempts} mismatches / IBAN · provider retries ${LIMITS.providerRetries} / session`]
  ]
};

const pricingTable: Table = {
  id: 'pricing', title: `Pricing & Commission Matrix (${PRICING_VERSION}, synthetic)`, head: ['Category / subcategory', 'Standard commission'],
  rows: PRICING_MATRIX.map((p) => [p.key, pct(p.standard)]),
  note: 'Priced on the VERIFIED (government-mapped) category; never on declared revenue. No plan selection in onboarding. A rate review never blocks: the standard offer applies.'
};

function contractTable(): Table {
  const cases: Array<[string, 'CR' | 'FL_CERT', (a: Application) => Application]> = [
    ['Mobile matched, Nafath verified', 'CR', (a) => a],
    ['Nafath failed twice', 'CR', (a) => ({ ...a, nafath: { ...a.nafath, status: 'exhausted' } })],
    ['Mobile ownership not confirmed', 'CR', (a) => ({ ...a, authorizedMobileVerified: false })],
    ['Nafath verified, certificate confirmed, IBAN linkage verified', 'FL_CERT', (a) => a],
    ['IBAN linkage not verified', 'FL_CERT', (a) => ({ ...a, business: { ...a.business, ibanStatus: 'failed_final' } })]
  ];
  return {
    id: 'contract', title: 'Contract gate (computed from the prototype rule)', head: ['Applicant', 'Situation', 'Contract'],
    rows: cases.map(([label, k, f]) => [k === 'CR' ? 'Registered business' : 'Freelancer', label, contractEligible(f(prefill(k, 'review'))) ? 'Contract available' : 'No contract']),
    note: 'Freelancer IBAN linkage must be verified before Review can continue; without Nafath the application is submitted for manual verification without a contract.'
  };
}

function outcomesTable(): Table {
  return { id: 'outcomes', title: 'Outcome pages (merchant-facing)', head: ['Outcome', 'Applicant sees'], rows: Object.entries(OUTCOME_COPY).map(([k, v]) => [k, v.title]) };
}

const reasonsTable: Table = {
  id: 'reasons', title: 'Internal reason codes (shown to the merchant only as a personalised sentence)', head: ['Code', 'Meaning'],
  rows: Object.entries(REASON_LABEL).map(([k, v]) => [k, v])
};

export const DECISION_TABLES: Table[] = [
  stagesTable, routingTable, lifecycleTable, eligibilityRules, catalogue, govTable, hardBlockTable, riskTable, activityTable, costTable, reuseTable, negativeTable,
  editTable, urlTable, abuseTable, pricingTable, contractTable(), outcomesTable(), reasonsTable
];

/* ------------------------------------------------------------------ open decisions (do not present as rules) */

export interface OpenItem {
  id: string;
  type: 'PRODUCT TASK' | 'COMPLIANCE DECISION' | 'PRODUCT / COMPLIANCE DECISION' | 'PRODUCT/COMMERCIAL DECISION' | 'PRODUCT/ENGINEERING DECISION' | 'RISK DECISION' | 'PROVIDER / COMPLIANCE DECISION' | 'LEGAL DECISION' | 'OPERATIONS DECISION';
  title: string;
  detail: string;
}

export const OPEN_ITEMS: OpenItem[] = [
  { id: 'OD-1', type: 'PRODUCT TASK', title: 'Exact Eligibility Matrix', detail: 'Category · subcategory · applicant type · channel · revenue band · result · CR / certificate required · regulatory restriction · reason code · rule version. Prototype: fixture catalogue.' },
  { id: 'OD-2', type: 'PRODUCT TASK', title: 'Exact government activity → category mapping', detail: 'Every activity code → Madfu subcategory (many-to-one). Prototype: synthetic codes.' },
  { id: 'OD-3', type: 'PRODUCT / COMPLIANCE DECISION', title: 'Multi-activity reconciliation behaviour', detail: 'Which activity wins (primary, any, most restrictive), and what happens when several map to different categories. Prototype: demo order (regulated blocks → match confirms → primary reclassifies → unmapped keeps the declaration).' },
  { id: 'OD-4', type: 'RISK DECISION', title: 'Risk scoring weights / formula', detail: 'Factors and weights (CR age, status, revenue, category, fraud, credit, compliance). Prototype: synthetic demo weights.' },
  { id: 'OD-5', type: 'PRODUCT / COMPLIANCE DECISION', title: 'Hard-block inventory', detail: 'The complete list of regulatory / business conditions that cannot continue, incl. how a restricted CR is handled (prototype: Sales route, provisional).' },
  { id: 'OD-6', type: 'RISK DECISION', title: 'Low / Medium / High thresholds and their effect', detail: 'Thresholds and what each level changes (review depth, limits, pricing). Prototype: demo thresholds, no effect on the journey.' },
  { id: 'OD-7', type: 'PROVIDER / COMPLIANCE DECISION', title: 'Certificate lookup before Nafath', detail: `Whether the freelance platform / privacy rules permit an existence check by National ID before Nafath. Prototype rule flag flCertificatePrecheckBeforeNafath = ${RULE_FLAGS.flCertificatePrecheckBeforeNafath}.` },
  { id: 'OD-8', type: 'PROVIDER / COMPLIANCE DECISION', title: 'Mobile ↔ National ID provider / service behaviour', detail: 'Which service confirms mobile ownership, its cost, latency, coverage (e.g. prepaid / non-Saudi numbers) and reuse. Prototype: simulated service.' },
  { id: 'OD-9', type: 'COMPLIANCE DECISION', title: 'Behaviour after repeated mobile mismatch', detail: `Prototype: ${LIMITS.mobileMatchChecks} checks per application, then the verification step pauses with progress saved. Whether this escalates, blocks or routes to manual is open.` },
  { id: 'OD-10', type: 'PRODUCT TASK', title: 'Exact Pricing & Commission Matrix', detail: 'Verified category / subcategory → standard commission; tiers; effective dates. Prototype: synthetic.' },
  { id: 'OD-11', type: 'PRODUCT/COMMERCIAL DECISION', title: 'Evidence requested for a better rate', detail: 'Which documents or data qualify a rate review, and how an improved rate is applied after the contract. Prototype: two placeholder documents.' },
  { id: 'OD-12', type: 'LEGAL DECISION', title: 'Final Freelancer IBAN regulatory / legal wording', detail: 'The Page-2 question, the blocked message and the linkage requirement wording.' },
  { id: 'OD-13', type: 'PRODUCT/ENGINEERING DECISION', title: 'Freshness rules by verification / result', detail: 'How long CR data, people, mobile match, Nafath, certificate and IBAN results stay valid. Prototype: reusable until invalidated; negative results per NEGATIVE_POLICY.' },
  { id: 'OD-14', type: 'OPERATIONS DECISION', title: 'Sales / manual recovery workflow after an expired / suspended CR', detail: 'Who owns it, how the CR is re-checked after correction (prototype: one controlled re-check by Sales), and how the merchant continues.' },
  { id: 'OD-15', type: 'OPERATIONS DECISION', title: 'Final application status lifecycle / SLA', detail: 'Statuses after submission (prototype: Submitted, Under review, Action required, Approved, Unable to proceed) and any SLA. None invented.' },
  { id: 'OD-16', type: 'LEGAL DECISION', title: 'Authorisation of CR owners / managers', detail: 'Whether Legal requires a finer distinction (e.g. signatory powers, partner types) than "owner or manager registered on the CR".' }
];

export const OTHER_OPEN_POINTS: string[] = [
  `Exact treatment of SAR ${REVENUE_RULE.selfServiceFromSar.toLocaleString('en-US')} and SAR ${REVENUE_RULE.salesAboveSar.toLocaleString('en-US')} (prototype: inside the self-service band; above SAR ${REVENUE_RULE.salesAboveSar.toLocaleString('en-US')} → Sales).`,
  'Providers behind CR data, associated parties, mobile ownership, certificates, IBAN linkage and the contract (prototype: neutral simulated adapters).',
  'Which additional documents non-Saudi entities need, and when operations collect them.',
  'Payout IBAN for registered businesses: collected at activation in the Merchant Portal (not built here).'
];

export const ASSUMPTIONS: string[] = [
  'Page 1 has no identity, mobile, OTP or URL; Page 2 has identifier, mobile and the prerequisite question.',
  'Merchant entity, Application and User / mobile are separate; access to an existing record = OTP to its registered mobile.',
  'Application and merchant account are separate: no login or password during onboarding.',
  'A Continue link identifies a DRAFT; OTP to the registered mobile is always required; links stop working on submission or mobile change.',
  'Nafath verifies identity; it is not the contract signature.',
  'No standard-path document uploads; Freelancers upload nothing.',
  'Payment plans are not configured in onboarding; the Contract shows the standard commission only.',
  'Source of Revenue / Source of Income, VAT and branch count are not asked.'
];
