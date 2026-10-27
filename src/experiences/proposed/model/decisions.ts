/**
 * Rules & Decisions for Madfu Proposed. Tables are COMPUTED from the same configuration and functions
 * the prototype runs, so documents cannot drift from the app. Confirmed product decisions and open
 * decisions are kept apart: open items are never presented as rules.
 */
import { ACTIVITIES, ACTIVITY_MAPPING_VERSION } from './activity';
import { COST_ASSUMPTIONS_SAR, HANDOFF_RULES, LIMITS, PREREQUISITE_QUESTION, REVENUE_RULE, STAGES } from './config';
import { AUTH_STATUS_LABEL, OUTCOME_COPY, PREPARER_AUTH_VIEW, REASON_LABEL, STATUS_LABEL } from './copy';
import { CATEGORIES, CATEGORY_RULE_LABEL, ELIGIBILITY_RULES, ELIGIBILITY_RULESET, subLabel } from './eligibility';
import { GOV_RULES, GOV_RULESET } from './government';
import { PRICING_MATRIX, PRICING_VERSION, pct } from './pricing';
import { HARD_BLOCKS, RISK_CONFIG, RISK_MODEL_VERSION } from './risk';
import { contractEligible, prefill } from './state';
import type { Application, AuthStatus, Lifecycle } from './types';
import { URL_RULES } from './urls';
import { CALL_ORDER, DEPENDS_ON, EDIT_POLICY, FRESHNESS_DAYS, NEGATIVE_POLICY, VERIFICATION_LABEL } from './verifications';

export interface Table { id: string; title: string; note?: string; head: string[]; rows: string[][] }

const H = HANDOFF_RULES;

/* ------------------------------------------------------------------ confirmed product decisions */

export const DECISIONS_DATE = '2026-10-28';

export const CONFIRMED_DECISIONS: string[] = [
  'Eight target workflows: New Eligible CR Merchant · New Eligible Freelancer · Not Eligible Application · Existing In-Progress CR Merchant — Resume · Existing In-Progress Freelancer — Resume · Submitted Application · Existing Live Merchant · CR Merchant Signer Flow. Sub-cases sit inside them.',
  'Shared start for everyone: Know Your Business / Eligibility → Identification → OTP; then routing by the application lifecycle AND the authorization state.',
  'Know Your Business (one page) asks only applicant type (Registered Business with CR / Freelancer with Certificate / Freelancer without Certificate), category, subcategory, annual revenue and sales channel (online / offline / both) — no website or Google Maps link.',
  'Eligibility has two INTERNAL outcomes, Eligible and Not Eligible. Not Eligible is never shown: no "Rejected", "Blacklisted", "Blocked", "Not eligible" or reason on any merchant screen.',
  'Not Eligible applicants (Freelancer without certificate, unsupported / regulated category, CR-only activity, channel, IBAN not linked, no certificate found, regulated CR activity, no owner / manager on the CR) are treated as leads: Identify + OTP, the application is captured with the internal reason, and the merchant sees "Application submitted" (later "Under review"). The team contacts them and explains the reason manually. No paid check runs after capture.',
  `Annual revenue is collected but never routes: every band (below SAR ${REVENUE_RULE.lowerSar.toLocaleString('en-US')}, SAR ${REVENUE_RULE.lowerSar.toLocaleString('en-US')}–${REVENUE_RULE.upperSar.toLocaleString('en-US')}, above SAR ${REVENUE_RULE.upperSar.toLocaleString('en-US')}) self-onboards when otherwise eligible. Revenue is a risk input only.`,
  'An internal existence check runs before any OTP; it calls no provider.',
  'Existing applications and accounts are opened only by an OTP to their STORED mobile (last three digits shown). A different mobile entered on Page 2 is never used, cannot be switched to and cannot take over an in-progress application.',
  'Resume does not create a new application and does not restart: it opens the first unfinished stage; completed, verified steps stay locked / reused. CR and Freelancer resume are separate workflows because their steps differ.',
  'Submitted applications (and internally Not Eligible ones) open Application Progress after the code; they never reopen Review, Contract or submission.',
  'Existing live merchant: a popup "You already have an active account under this CR." with a "Log in" button; nothing navigates until the merchant clicks. No application is created.',
  'Registered business: CR Verification / CR data → Business Details → Commercial Offer → Review → Authorization choice → (self) Nafath → Contract → Submitted, or Signer Handoff. The preparer is never asked to pick an owner / manager earlier only for signing, and is not asked whether they are an owner / manager on Page 2.',
  `Freelancer: Certificate list / selection → mobile ↔ National ID → Nafath → Business Details → Commercial Offer → Review → Contract → Submitted. The certificate is visible BEFORE Nafath; the retrieval is also the cost check (no certificate → no Nafath). Freelancers declare "${PREREQUISITE_QUESTION.FL_CERT}" on Page 2.`,
  'CR IBAN, VAT and number of branches are not required in onboarding. Freelancer IBAN stays required and must be linked to the Freelancer Certificate.',
  'Website / Google Maps are asked in Business Details by sales channel (online → website · offline → Google Maps · both → both). National Address is separate and not a store-presence substitute.',
  'Commercial Offer belongs to the preparer and comes before the authorization choice: standard terms / rate → Continue, optional low-priority better-rate review. No payment-plan configuration, no 6 / 9 / 12-month selection. The signer can never modify it.',
  'After Review the CR preparer chooses: "I can complete the authorization myself" (select yourself among the owners / managers → mobile ↔ National ID → Nafath → Contract) or "Send to another signer".',
  'Send to another signer: select one owner / manager on the CR + enter their primary Nafath mobile → Send Authorization. This creates an authorization version, freezes the application and the Commercial Offer, makes them read-only for the preparer, sends a secure SMS link and opens the preparer\'s Authorization status page.',
  'Preparer after a handoff: status only, from configurable statuses (displayed as In progress / Approved / Expired / Not completed). No edit; no signer or mobile change in Phase 1.',
  'Signer: Secure SMS link → masked Signer confirmation (business, first + last name, masked National ID and mobile) → Start Nafath Verification (mobile ↔ National ID first) → Nafath → full read-only Review (application + frozen offer) → Contract → Agree & Sign → Submitted. No signer OTP in Phase 1; the link alone authorizes nothing and never exposes the application; Nafath runs again in every signer session.',
  'Signer review is read-only and one-directional: no edit, no send-back, no request-changes loop.',
  `Handoff validity: ${H.expiryDays} days by default, configurable. Each version stores created / expiry timestamps, status and version number. When expired: the link stops working, the application stays saved, nothing disappears, no duplicate application is created.`,
  `No blanket 30-day CR lock. At most ${H.maxVersions} signer handoffs (authorization versions) of the SAME application within any ${H.windowDays}-day window; a further one needs an internal / manual unlock. Versions are tracked separately with an audit trail; the application ID never changes.`,
  'Once a handoff starts, application data, Commercial Offer, CR / business details and onboarding answers are frozen; the signer authorizes exactly the frozen version.',
  'Application lifecycle and authorization lifecycle are separate state machines: QUALIFICATION · OTP_PENDING · DRAFT · AWAITING_AUTHORIZATION · NOT_ELIGIBLE (internal) · PAUSED_CR · SUBMITTED · UNDER_REVIEW · ACTION_REQUIRED · APPROVED · UNABLE_TO_PROCEED · LIVE — and NOT_STARTED · HANDOFF_CREATED · AWAITING_SIGNER · NAFATH_PENDING · NAFATH_VERIFIED · CONTRACT_PENDING · COMPLETED · EXPIRED · CANCELLED.',
  'Progressive risk scoring stays modular and separate from hard regulatory blockers; its objective is a merchant risk level (conceptually Proceed fully / Proceed controlled / Hold), not an automatic rejection. CR age is a risk input, never a rejection.',
  'Expired / suspended CR: no further downstream spend, the application is saved, a controlled state is shown and internal / Sales follow-up recovers it.',
  'After retrieval, the government CR activity (or certificate activity) is the source of truth for the category and the price.',
  'Mobile ↔ National ID ownership is checked before every Nafath request; a preparer / Freelancer mismatch can be corrected with a new OTP, without restarting. A signer mismatch ends that authorization version (no self-service correction in Phase 1).',
  'Verified, sensitive sections are locked; the few editable sections use a transactional edit (draft → Save; Cancel restores all) until a handoff freezes the application.',
  'The Contract page has one action and no Decline: Agree & Submit (preparer) or Agree & Sign (signer).',
  'Delegated signers (Ministry of Justice delegation, company / commercial delegation document, other official document) stay represented in the demo but are Phase 2. Delegation authority is verified BEFORE Nafath; manual reviews never need an open session.',
  'OTP is not the only abuse control: rate limiting, IP / device throttling, eligibility limits, bounded resends and attempts, and a bot challenge when suspicious.'
];

/** Phase boundary (Rules & Decisions, boards and docs). */
export const PHASE_1: string[] = [
  'Core CR and Freelancer onboarding (shared KYB → Identify → OTP)',
  'Not Eligible captured internally; merchant sees Application submitted / Under review',
  'Resume (CR and Freelancer) with the stored mobile only',
  'Submitted application → Application Progress',
  'Live merchant popup with a Log in button',
  'CR Authorization choice: self authorization or signer handoff',
  'Signer secure SMS link — no signer OTP',
  'Nafath before the signer sees the full application; read-only signer review',
  'Application + Commercial Offer freeze at handoff',
  `${H.expiryDays}-day configurable handoff validity`,
  `Maximum ${H.maxVersions} handoff versions within ${H.windowDays} days (then internal unlock)`,
  'No preparer signer / mobile change after the handoff starts',
  'No send-back / request-changes loop'
];

export const PHASE_2: string[] = [
  'Change signer or signer mobile after a handoff (revoke the old link, new version, new link)',
  'Resend / revoke workflow',
  'Delegated signer production implementation',
  'Ministry of Justice delegation integration',
  'Manual delegation Quality-review workflow',
  'Low-priority "change to another owner / manager / signatory" option',
  'Any more advanced signer workflow (multiple signers, send-back)'
];

/** Where the new decisions overrode the previous prototype (documented conflicts). */
export const CONFLICTS_RESOLVED: string[] = [
  'v5 showed "Not Eligible" pages (with a personalised reason) and stopped a Freelancer without certificate on Page 1 → now internal only: everyone goes through Identify + OTP and sees Application submitted.',
  'v5 asked registered businesses "Are you an owner or manager registered on this CR?" (No = Not Eligible) → removed: the preparer can be anyone; the owner / manager is chosen at the Authorization step.',
  'v5 put owner / manager selection and Nafath before Business Details for a CR → now after Review (Authorization choice).',
  'v5 showed the Freelancer Certificate after Nafath (a hidden pre-check ran before) → now visible before Nafath; the separate pre-check and its rule flag are gone.',
  'v5 sent a live merchant straight to a login hand-off screen → now a popup; login only on click.',
  'v5 Nafath attempts were counted per application → now per authorization (a new signer version starts fresh attempts).'
];

/* ------------------------------------------------------------------ tables */

const stagesTable: Table = {
  id: 'stages', title: 'Stages', head: ['#', 'Stage', 'Screens'],
  rows: STAGES.map((s) => [String(s.n), s.label, s.steps.join(' · ')]),
  note: 'Registered business: Nafath is part of stage 7 (after the Authorization choice). Freelancer: Nafath is part of stage 3 (after the certificate). The signer has a short own stepper: Request · Nafath · Review · Sign · Done.'
};

const eligibilityRules: Table = {
  id: 'eligibility', title: `Page 1 preliminary eligibility rules (ordered, ${ELIGIBILITY_RULESET})`, head: ['Rule', 'Condition', 'Result (internal)', 'Reason code', 'Type'],
  rows: ELIGIBILITY_RULES.map((r) => [r.id, r.description, r.result, r.reason, r.kind]),
  note: `First matching rule wins. Internal, before any external call, never shown. Every result continues to Identify + OTP. Revenue (bands at SAR ${REVENUE_RULE.lowerSar.toLocaleString('en-US')} / SAR ${REVENUE_RULE.upperSar.toLocaleString('en-US')}) is collected but no rule reads it — it is a risk input. Production Eligibility Matrix: PRODUCT TASK.`
};

const catalogue: Table = {
  id: 'catalogue', title: 'Category rules (synthetic fixture catalogue)', head: ['Madfu subcategory', 'Registered business', 'Freelancer'],
  rows: CATEGORIES.flatMap((g) => g.subs.map((s) => [`${g.label} › ${s.label}`, CATEGORY_RULE_LABEL[s.rules.CR], CATEGORY_RULE_LABEL[s.rules.FL]])),
  note: 'A category is allowed or (internally) not eligible; there is no manual-review category route. Example only (e.g. gold & jewellery).'
};

const routingTable: Table = {
  id: 'routing', title: 'Page 1 → Page 2 → existence check → OTP → routing', head: ['Situation', 'OTP sent to', 'After the code'],
  rows: [
    ['New identifier, internally Not Eligible (any reason)', 'Entered mobile', 'Application captured with the internal reason → "Application submitted"; no paid check; team contacts the applicant'],
    ['New identifier, eligible Freelancer, IBAN linked = No', 'Entered mobile', 'Captured internally (FL_IBAN_NOT_LINKED) → "Application submitted"'],
    ['New identifier, eligible registered business (any revenue band)', 'Entered mobile', 'Application created (DRAFT) → CR Verification'],
    ['New identifier, eligible Freelancer with certificate (any revenue band)', 'Entered mobile', 'Application created (DRAFT) → Certificate (before Nafath)'],
    ['Incomplete application (DRAFT), any entered mobile', 'STORED application mobile (•••••••123) — never the entered one', 'Resume at the first unfinished CR / Freelancer step; valid checks reused'],
    ['Awaiting authorization (handoff exists)', 'Stored application mobile', 'Authorization status page (frozen, status only)'],
    ['Submitted, not live', 'Stored application mobile', 'Application Progress (status only)'],
    ['Captured as internally Not Eligible', 'Stored mobile', 'Application Progress — "Under review"; no reason'],
    ['Paused (CR expired / suspended)', 'Stored application mobile', 'Saved; Sales will help you continue'],
    ['Live merchant', 'Stored account mobile', 'Popup "You already have an active account under this CR." → Log in (on click only)'],
    ['Code not completed', '—', 'No access; nothing exposed; no new application']
  ],
  note: `There is no Sales-lead route and no merchant-facing Not Eligible page. Throttled after ${LIMITS.identifyChecksPerSession} Page-2 submissions per session (simulated rate limit / bot challenge).`
};

const LIFECYCLE: Lifecycle[] = ['QUALIFICATION', 'OTP_PENDING', 'DRAFT', 'AWAITING_AUTHORIZATION', 'NOT_ELIGIBLE', 'PAUSED_CR', 'SUBMITTED', 'UNDER_REVIEW', 'ACTION_REQUIRED', 'APPROVED', 'UNABLE_TO_PROCEED', 'LIVE'];
const LIFECYCLE_ROUTE: Record<Lifecycle, string> = {
  QUALIFICATION: 'Page 1 / Page 2 (nothing persisted)', OTP_PENDING: 'OTP screen', DRAFT: 'First unfinished stage (CR: … review / authorization; FL: certificate / Nafath / …)',
  AWAITING_AUTHORIZATION: 'Authorization status page (or the self-authorization Nafath / Contract after a new version)',
  NOT_ELIGIBLE: 'Application Progress — "Under review" (internal state)', PAUSED_CR: 'Sales / manual follow-up message', SUBMITTED: 'Application Progress', UNDER_REVIEW: 'Application Progress',
  ACTION_REQUIRED: 'Application Progress', APPROVED: 'Application Progress', UNABLE_TO_PROCEED: 'Application Progress', LIVE: 'Active-account popup → Log in'
};
const lifecycleTable: Table = {
  id: 'lifecycle', title: 'Application lifecycle → where the application opens (preparer)', head: ['Status', 'Meaning', 'Opens at'],
  rows: LIFECYCLE.map((l) => [l, STATUS_LABEL[l], LIFECYCLE_ROUTE[l]]),
  note: 'Routing reads the lifecycle first, then the authorization status; only a DRAFT is routed by completion. Merchant entity (CR / National ID), Application and User / mobile are separate: knowing the CR never grants access.'
};

const AUTH_ORDER: AuthStatus[] = ['NOT_STARTED', 'HANDOFF_CREATED', 'AWAITING_SIGNER', 'NAFATH_PENDING', 'NAFATH_VERIFIED', 'CONTRACT_PENDING', 'COMPLETED', 'EXPIRED', 'CANCELLED'];
const AUTH_MEANING: Record<AuthStatus, string> = {
  NOT_STARTED: 'Authorization not chosen yet (or a draft choice)',
  HANDOFF_CREATED: 'Version record created, SMS not yet sent (transient)',
  AWAITING_SIGNER: 'Secure link sent; signer has not verified',
  NAFATH_PENDING: 'Signer (or self-authorizing preparer) started Nafath',
  NAFATH_VERIFIED: 'Identity verified with Nafath',
  CONTRACT_PENDING: 'Contract opened, not yet signed',
  COMPLETED: 'Signed → application SUBMITTED',
  EXPIRED: `No signature within ${H.expiryDays} days; link dead; application kept`,
  CANCELLED: 'Signer mobile mismatch or Nafath failed twice; application kept'
};
const authorizationTable: Table = {
  id: 'authorization', title: 'Authorization lifecycle (separate from the application lifecycle)', head: ['Status', 'Meaning', 'Preparer sees (configurable)'],
  rows: AUTH_ORDER.map((a) => [a, AUTH_MEANING[a], `${PREPARER_AUTH_VIEW[a].label} — ${AUTH_STATUS_LABEL[a]}`]),
  note: 'The final preparer status list is not defined yet (OD-17): display buckets live in configuration (copy.ts PREPARER_AUTH_VIEW).'
};

const handoffTable: Table = {
  id: 'handoff', title: 'Signer handoff rules (Phase 1, configurable in config.ts HANDOFF_RULES)', head: ['Rule', 'Value / behaviour'],
  rows: [
    ['Who can be the signer', 'One individual owner / manager registered on the CR (delegates: Phase 2)'],
    ['What the preparer enters', 'The signer (from the CR list) + the signer\'s primary Nafath mobile'],
    ['Link validity', `${H.expiryDays} days (expiryDays, default 7)`],
    ['Versions per application', `Max ${H.maxVersions} (maxVersions) within ${H.windowDays} days (windowDays); then internal / manual unlock`],
    ['On expiry', 'Link stops working · application stays saved · no duplicate application · a new version may start (within the limit)'],
    ['Per version, stored', 'Application ID · version · signer · masked signer mobile · created / expiry · status · initiated by · end reason · completion timestamp · frozen snapshot'],
    ['Freeze', 'Application data, Commercial Offer, CR / business details, onboarding answers — from the first handoff'],
    ['Preparer after sending', 'Status only; no edit; no signer / mobile change (Phase 2)'],
    ['Signer entry', 'Secure link → masked confirmation → mobile ↔ National ID → Nafath → read-only Review → Contract (no OTP)'],
    ['Signer failures', 'Mobile mismatch or Nafath failed twice → version CANCELLED; application kept']
  ]
};

const phaseTable: Table = {
  id: 'phases', title: 'Phase 1 vs Phase 2', head: ['Phase', 'Scope'],
  rows: [...PHASE_1.map((p) => ['PHASE 1', p]), ...PHASE_2.map((p) => ['PHASE 2 / FUTURE', p])]
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
  note: 'RESTRICTED follows the Sales route provisionally; the Not Eligible inventory is open.'
};

const hardBlockTable: Table = {
  id: 'hard-blocks', title: 'Not Eligible rules (internal) and the paused CR route — separate from the risk score', head: ['Reason', 'Where', 'Source', 'Route'],
  rows: HARD_BLOCKS.map((h) => [h.reason, h.where, h.source, h.route]),
  note: 'A regulatory or business Not Eligible rule is never converted into a score to let a merchant continue. Revenue is never a Not Eligible rule. No Not Eligible reason is ever shown to the merchant.'
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
    ['Level', `LOW < ${RISK_CONFIG.thresholds.mediumFrom} ≤ MEDIUM < ${RISK_CONFIG.thresholds.highFrom} ≤ HIGH`],
    ['Decision (illustrative)', Object.entries(RISK_CONFIG.decisionByLevel).map(([k, v]) => `${k} → ${v}`).join(' · ')]
  ],
  note: 'Backend only; never shown to the merchant; never rejects on its own; no production weights or thresholds invented. Production factors, weights, thresholds and decision effects: RISK DECISION.'
};

const activityTable: Table = {
  id: 'activity', title: `Government activity → Madfu category (${ACTIVITY_MAPPING_VERSION})`, head: ['Government activity', 'Madfu subcategory'],
  rows: ACTIVITIES.map((a) => [`${a.code} · ${a.label}`, a.mappedSub ? subLabel(a.mappedSub) : 'Not mapped']),
  note: 'Many-to-one. A CR carries several activities. Demo reconciliation: a regulated activity blocks (internally); an activity matching the declaration confirms it; otherwise the primary mapped activity reclassifies; nothing mapped keeps the declaration provisionally (internal flag). Final mapping and multi-activity rules: open.'
};

const costTable: Table = {
  id: 'cost', title: 'External-call order and cost assumptions', head: ['Applicant', 'Order of paid calls (backend)', 'What the applicant sees'],
  rows: [
    ['Before the first OTP', 'None (eligibility and existence checks are internal)', 'Page 1 → Page 2 → code'],
    ['Internally Not Eligible', 'OTP only', 'Code → Application submitted'],
    ['Registered business (self)', CALL_ORDER.CR.join(' → '), 'Code → CR verification → details → offer → review → authorization → Nafath'],
    ['Registered business (signer)', 'OTP → CR data → owners / managers → (signer) mobile match → Nafath', 'Signer: link → confirmation → Nafath'],
    ['Freelancer', CALL_ORDER.FL_CERT.join(' → '), 'Code → certificate → Nafath → details (IBAN)'],
    ['No certificate found', 'OTP → certificate retrieval (then stop)', 'Code → Application submitted (no Nafath cost)'],
    ['Expired / suspended CR', 'OTP → CR data (then stop)', 'Code → saved, Sales follow-up'],
    ['Ordinary resume', 'OTP only (valid checks reused)', 'Code → first unfinished stage']
  ],
  note: `Product cost assumptions (Internal view only): ${Object.entries(COST_ASSUMPTIONS_SAR).map(([k, v]) => `${k} ${v === null ? 'unknown' : `≈ SAR ${v}`}`).join(' · ')}.`
};

const reuseTable: Table = {
  id: 'reuse', title: 'Verification reuse (positive results)', head: ['Verification', 'Depends on', 'Freshness policy', 'On ordinary resume'],
  rows: (Object.keys(DEPENDS_ON) as Array<keyof typeof DEPENDS_ON>).map((t) => [VERIFICATION_LABEL[t], DEPENDS_ON[t], FRESHNESS_DAYS[t] === null ? 'Reusable until invalidated (policy open)' : `${FRESHNESS_DAYS[t]} days`, t === 'NAFATH' ? 'Reused for the preparer; the signer verifies again every session' : 'Reused — no new provider call']),
  note: 'Resume normally costs one SMS OTP.'
};

const negativeTable: Table = {
  id: 'negative', title: 'Negative / technical results — policy per result type', head: ['Result', 'Policy', 'Merchant sees', 'Repeat call'],
  rows: NEGATIVE_POLICY.map((n) => [n.result, n.policy, n.merchantSees, n.repeatCall])
};

const editTable: Table = {
  id: 'edit', title: 'Review: locked vs editable sections', head: ['Section', 'Editable', 'Invalidates', 'Note'],
  rows: EDIT_POLICY.map((e) => [e.section, e.editable ? 'Yes (transactional, preparer, before a handoff)' : 'Locked', e.invalidates.length ? e.invalidates.join(', ') : 'Nothing', e.note]),
  note: 'Transactional edit: values change in a draft; Save applies; Cancel restores the whole application; nothing is invalidated before Save. After a handoff everything is frozen; the signer edits nothing.'
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
    ['Signer handoff limit', 'Authorization', `${H.maxVersions} versions / ${H.windowDays} days per application; link valid ${H.expiryDays} days`],
    ['Paid-call bounds', 'Providers', `Mobile check ${LIMITS.mobileMatchChecks} / application · Nafath ${LIMITS.nafathAttempts} failures / authorization, ${LIMITS.nafathTechnicalRetries} technical / session · IBAN ${LIMITS.ibanAttempts} mismatches / IBAN · provider retries ${LIMITS.providerRetries} / session`]
  ]
};

const pricingTable: Table = {
  id: 'pricing', title: `Pricing & Commission Matrix (${PRICING_VERSION}, synthetic)`, head: ['Category / subcategory', 'Standard commission'],
  rows: PRICING_MATRIX.map((p) => [p.key, pct(p.standard)]),
  note: 'Priced on the VERIFIED (government-mapped) category; never on declared revenue. No plan selection in onboarding. A rate review never blocks: the standard offer applies. Frozen at handoff.'
};

function contractTable(): Table {
  const cases: Array<[string, 'CR' | 'FL_CERT', (a: Application) => Application]> = [
    ['Self authorization: mobile matched, Nafath verified', 'CR', (a) => a],
    ['Nafath failed twice', 'CR', (a) => ({ ...a, nafath: { ...a.nafath, status: 'exhausted' } })],
    ['Mobile ownership not confirmed', 'CR', (a) => ({ ...a, authorizedMobileVerified: false })],
    ['Authorization not chosen', 'CR', (a) => ({ ...a, authorization: { ...a.authorization, mode: null } })],
    ['Certificate confirmed, Nafath verified, IBAN linkage verified', 'FL_CERT', (a) => a],
    ['IBAN linkage not verified', 'FL_CERT', (a) => ({ ...a, business: { ...a.business, ibanStatus: 'failed_final' } })]
  ];
  return {
    id: 'contract', title: 'Contract gate (computed from the prototype rule)', head: ['Applicant', 'Situation', 'Contract'],
    rows: cases.map(([label, k, f]) => [k === 'CR' ? 'Registered business' : 'Freelancer', label, contractEligible(f(prefill(k, 'contract'))) ? 'Contract available' : 'No contract']),
    note: 'A signer-handoff contract opens only for the signer, in a session verified with Nafath, on the live version. Without Nafath the application is submitted for manual verification without a contract.'
  };
}

function outcomesTable(): Table {
  return { id: 'outcomes', title: 'Outcome pages (merchant-facing)', head: ['Outcome', 'Applicant sees'], rows: Object.entries(OUTCOME_COPY).map(([k, v]) => [k, v.title]), note: 'RECEIVED (internally Not Eligible) deliberately shows the same page as SUBMITTED.' };
}

const reasonsTable: Table = {
  id: 'reasons', title: 'Internal reason codes (never shown to the merchant)', head: ['Code', 'Meaning'],
  rows: Object.entries(REASON_LABEL).map(([k, v]) => [k, v]),
  note: 'Only the controlled CR states (expired / suspended / restricted) have merchant copy, because the merchant can fix them.'
};

const conflictsTable: Table = {
  id: 'conflicts', title: 'Conflicts with the previous prototype (v5) — resolved in favour of the 2026-10-28 decisions', head: ['#', 'Change'],
  rows: CONFLICTS_RESOLVED.map((c, i) => [String(i + 1), c])
};

export const DECISION_TABLES: Table[] = [
  phaseTable, stagesTable, routingTable, lifecycleTable, authorizationTable, handoffTable, eligibilityRules, catalogue, govTable, hardBlockTable, riskTable, activityTable, costTable,
  reuseTable, negativeTable, editTable, urlTable, abuseTable, pricingTable, contractTable(), outcomesTable(), reasonsTable, conflictsTable
];

/* ------------------------------------------------------------------ open decisions (do not present as rules) */

export interface OpenItem {
  id: string;
  type: 'PRODUCT TASK' | 'COMPLIANCE DECISION' | 'PRODUCT / COMPLIANCE DECISION' | 'PRODUCT/COMMERCIAL DECISION' | 'PRODUCT/ENGINEERING DECISION' | 'RISK DECISION' | 'PROVIDER / COMPLIANCE DECISION' | 'LEGAL DECISION' | 'OPERATIONS DECISION';
  title: string;
  detail: string;
}

export const OPEN_ITEMS: OpenItem[] = [
  { id: 'OD-1', type: 'PRODUCT TASK', title: 'Exact Eligibility Matrix', detail: 'Category · subcategory · applicant type · channel · internal result (Eligible / Not Eligible) · CR / certificate required · regulatory restriction · internal reason · rule version. Revenue does not decide eligibility. Prototype: fixture catalogue.' },
  { id: 'OD-2', type: 'PRODUCT TASK', title: 'Exact government activity → category mapping', detail: 'Every activity code → Madfu subcategory (many-to-one). Prototype: synthetic codes.' },
  { id: 'OD-3', type: 'PRODUCT / COMPLIANCE DECISION', title: 'Multi-activity reconciliation behaviour', detail: 'Which activity wins (primary, any, most restrictive), and what happens when several map to different categories. Prototype: demo order (regulated blocks → match confirms → primary reclassifies → unmapped keeps the declaration).' },
  { id: 'OD-4', type: 'RISK DECISION', title: 'Risk scoring weights / formula', detail: 'Factors and weights (CR age, status, company type, capital, activities, revenue, category, fraud, credit, compliance). Prototype: synthetic demo weights.' },
  { id: 'OD-5', type: 'PRODUCT / COMPLIANCE DECISION', title: 'Not Eligible inventory', detail: 'The complete list of regulatory / business conditions that cannot continue, incl. how a restricted CR is handled (prototype: Sales route, provisional).' },
  { id: 'OD-6', type: 'RISK DECISION', title: 'Low / Medium / High thresholds and Proceed fully / controlled / Hold', detail: 'Thresholds and what each decision changes (review depth, limits, pricing). Prototype: demo thresholds and an illustrative mapping, no effect on the journey.' },
  { id: 'OD-7', type: 'PROVIDER / COMPLIANCE DECISION', title: 'Showing Freelancer Certificate details before Nafath', detail: 'The certificate list is now shown before Nafath (product decision). Confirm that the freelance platform / privacy rules permit displaying certificate details by National ID before strong identity verification.' },
  { id: 'OD-8', type: 'PROVIDER / COMPLIANCE DECISION', title: 'Mobile ↔ National ID provider / service behaviour', detail: 'Which service confirms mobile ownership, its cost, latency, coverage (e.g. prepaid / non-Saudi numbers) and reuse. Prototype: simulated service.' },
  { id: 'OD-9', type: 'COMPLIANCE DECISION', title: 'Behaviour after repeated mobile mismatch', detail: `Prototype: ${LIMITS.mobileMatchChecks} checks per application, then the verification step pauses with progress saved; a signer mismatch ends the authorization version. Whether this escalates, blocks or routes to manual is open.` },
  { id: 'OD-10', type: 'PRODUCT TASK', title: 'Exact Pricing & Commission Matrix', detail: 'Verified category / subcategory → standard commission; tiers; effective dates. Prototype: synthetic.' },
  { id: 'OD-11', type: 'PRODUCT/COMMERCIAL DECISION', title: 'Evidence requested for a better rate', detail: 'Which documents or data qualify a rate review, and how an improved rate is applied after the contract. Prototype: two placeholder documents.' },
  { id: 'OD-12', type: 'LEGAL DECISION', title: 'Final Freelancer IBAN regulatory / legal wording', detail: 'The Page-2 question and the linkage requirement wording.' },
  { id: 'OD-13', type: 'PRODUCT/ENGINEERING DECISION', title: 'Freshness rules by verification / result', detail: 'How long CR data, people, mobile match, Nafath, certificate and IBAN results stay valid. Prototype: reusable until invalidated; negative results per NEGATIVE_POLICY.' },
  { id: 'OD-14', type: 'OPERATIONS DECISION', title: 'Sales / manual recovery workflow after an expired / suspended CR', detail: 'Who owns it, how the CR is re-checked after correction (prototype: one controlled re-check by Sales), and how the merchant continues.' },
  { id: 'OD-15', type: 'OPERATIONS DECISION', title: 'Final application status lifecycle / SLA', detail: 'Statuses after submission (prototype: Submitted, Under review, Action required, Approved, Unable to proceed) and any SLA. None invented.' },
  { id: 'OD-16', type: 'LEGAL DECISION', title: 'Authorisation of CR owners / managers', detail: 'Whether Legal requires a finer distinction (e.g. signatory powers, partner types) than "owner or manager registered on the CR" for signing.' },
  { id: 'OD-17', type: 'PRODUCT TASK', title: 'Final preparer authorization status list', detail: 'Prototype buckets (configurable): In progress · Approved · Expired · Not completed. The final Phase-1 list (e.g. In Progress / Approved / Rejected) is to be defined.' },
  { id: 'OD-18', type: 'OPERATIONS DECISION', title: 'Internal unlock after the handoff limit', detail: `Who may unlock a further handoff after ${H.maxVersions} versions in ${H.windowDays} days, with which checks, and how it is audited. Prototype: one Internal-view button.` },
  { id: 'OD-19', type: 'OPERATIONS DECISION', title: 'Contacting internally Not Eligible applicants', detail: 'Who calls captured Not Eligible applicants, within what time, what they say, and whether a record can later continue online if the rule changes.' },
  { id: 'OD-20', type: 'LEGAL DECISION', title: 'Signer link without OTP', detail: 'Confirm that a secure SMS link + Nafath (no OTP) is sufficient for the signer in Phase 1, and the masked information allowed on the confirmation page before Nafath.' }
];

export const OTHER_OPEN_POINTS: string[] = [
  `Exact revenue band boundaries at SAR ${REVENUE_RULE.lowerSar.toLocaleString('en-US')} and SAR ${REVENUE_RULE.upperSar.toLocaleString('en-US')} and their risk weights (revenue never routes).`,
  'Whether a signer who cancels / fails can be replaced by the same preparer through a new version immediately, or only after internal review (prototype: a new version is allowed within the limit).',
  'Providers behind CR data, associated parties, mobile ownership, certificates, IBAN linkage, SMS links and the contract (prototype: neutral simulated adapters).',
  'Which additional documents non-Saudi entities need, and when operations collect them.',
  'Payout IBAN for registered businesses: collected at activation in the Merchant Portal (not built here).'
];

export const ASSUMPTIONS: string[] = [
  'Page 1 has no identity, mobile, OTP or URL; Page 2 has identifier, mobile and (eligible Freelancer only) the IBAN question.',
  'Merchant entity, Application and User / mobile are separate; access to an existing record = OTP to its stored mobile.',
  'Application and merchant account are separate: no login or password during onboarding.',
  'A Continue link identifies a DRAFT; OTP to the stored mobile is always required; links stop working on submission, handoff or mobile change.',
  'A signer link identifies one authorization version; Nafath (not the link) proves the signer; the signer verifies with Nafath again in every session.',
  'After an expired or ended handoff the preparer may start a new authorization version of the SAME application (self or signer); data and offer stay frozen.',
  'Self authorization after a cancelled handoff is not a handoff and does not count towards the handoff limit.',
  'Nafath attempts are counted per authorization (each signer version starts fresh); technical failures stay bounded per session.',
  'Nafath verifies identity; it is not the contract signature.',
  'No standard-path document uploads; Freelancers upload nothing.',
  'Payment plans are not configured in onboarding; the Contract shows the standard commission only.',
  'Source of Revenue / Source of Income, VAT and branch count are not asked.'
];
