/**
 * Detailed Logic Board for Madfu Proposed, built from the same model the prototype runs: stage names
 * come from STAGES, outcome titles from OUTCOME_COPY, limits from the configuration. Nodes reference
 * step ids and outcome kinds so tests can prove the boards and the prototype describe the same
 * journey. Node kinds separate merchant-facing steps, backend / internal steps, external provider
 * calls and decisions. The simple visual Master Board is model/masterBoard.ts.
 */
import { HANDOFF_RULES, LIMITS, STAGES } from './config';
import { OUTCOME_COPY } from './copy';
import { ELIGIBILITY_RULES } from './eligibility';
import type { OutcomeKind, StepId } from './types';

export type NodeKind = 'screen' | 'decision' | 'backend' | 'external' | 'cached' | 'manual' | 'outcome' | 'open' | 'note' | 'connector';

export interface MapNode {
  id: string;
  kind: NodeKind;
  label: string;
  /** Second line: fields, rule or detail. */
  detail?: string;
  col: number;
  row: number;
  step?: StepId;
  outcome?: OutcomeKind;
}
export interface MapEdge { from: string; to: string; label?: string; dashed?: boolean }
export interface JourneyMap { id: string; title: string; caption: string; nodes: MapNode[]; edges: MapEdge[]; large?: boolean; notes?: string[] }

export const NODE_KIND_LABEL: Record<Exclude<NodeKind, 'connector' | 'note'>, string> = {
  screen: 'Merchant-facing step',
  decision: 'Decision',
  backend: 'Backend / internal step',
  external: 'External / provider call',
  cached: 'Reused / locked result',
  manual: 'Manual / paused route',
  outcome: 'Outcome',
  open: 'Open decision'
};

const S = (n: number) => STAGES[n - 1].label;
const O = (k: OutcomeKind) => OUTCOME_COPY[k].title;
const H_ = HANDOFF_RULES;
export const REUSE_NOTE = 'Successful CR / owner / mobile / Nafath / certificate / IBAN checks are reused by the preparer. Resume normally costs one OTP to the stored mobile. A signer verifies with Nafath again in every session.';

/* ------------------------------------------------------------------ Detailed Logic Board (panels) */

const A: JourneyMap = {
  id: 'kyb', large: true, title: `A · ${S(1)} (Page 1): Eligible or Not Eligible — internal only`,
  caption: 'No identity, mobile, OTP or URL. Two internal outcomes; nothing is shown and everyone continues to Identify. Revenue is collected but never routes (risk input only). The declared category is replaced by the government activity once retrieved.',
  nodes: [
    { id: 'matrix', kind: 'open', label: 'PRODUCT TASK: Eligibility Matrix', detail: 'Production catalogue not defined (fixture)', col: 2, row: 0 },
    { id: 'kyb', kind: 'screen', label: S(1), detail: 'Applicant type · Category · Subcategory · Annual revenue · Sales channel', col: 0, row: 1, step: 'kyb' },
    { id: 'draft', kind: 'backend', label: 'Qualification record (KYB-…)', detail: 'Temporary until linked after OTP', col: 1, row: 1 },
    { id: 'engine', kind: 'decision', label: 'Eligibility engine', detail: `${ELIGIBILITY_RULES.length} ordered rules · internal result`, col: 2, row: 1 },
    { id: 'ok', kind: 'connector', label: '→ B · Identify (eligible, any revenue band)', col: 4, row: 1, step: 'identify' },
    { id: 'capture', kind: 'connector', label: '→ B · Identify (internally Not Eligible: neutral page)', col: 2, row: 2, step: 'identify' },
    { id: 'removed', kind: 'note', label: 'Removed: any Page-1 stop, Not Eligible pages and reasons shown to applicants, Sales-lead / Blocked / revenue routes. Website and Maps links are in Business Details.', col: 0, row: 3 }
  ],
  edges: [
    { from: 'kyb', to: 'draft' }, { from: 'draft', to: 'engine' }, { from: 'engine', to: 'ok', label: 'ELIGIBLE' },
    { from: 'engine', to: 'capture', label: 'NOT ELIGIBLE (internal)' }, { from: 'engine', to: 'matrix', dashed: true }
  ]
};

const B: JourneyMap = {
  id: 'identify', large: true, title: 'B · Identifier + mobile, existence check, OTP and routing',
  caption: 'Everyone reaches Page 2. An internal lookup decides where the code goes. Existing records open only with their STORED mobile — a different entered mobile is never used. Routing reads the application lifecycle and the authorization state, never completion alone.',
  nodes: [
    { id: 'throttle', kind: 'backend', label: 'Rate limit / bot challenge', detail: `${LIMITS.identifyChecksPerSession} submissions / session`, col: 0, row: 0 },
    { id: 'ne', kind: 'outcome', label: 'Application submitted', detail: 'Not Eligible is INTERNAL · captured · no paid check · team calls', col: 5, row: 0, outcome: 'RECEIVED' },
    { id: 'id', kind: 'screen', label: 'Identifier + mobile', detail: 'CR or National ID · mobile · "IBAN linked?" (eligible Freelancer only)', col: 0, row: 1, step: 'identify' },
    { id: 'exist', kind: 'backend', label: 'Existence check', detail: 'Internal: new · incomplete · awaiting authorization · submitted · live · paused · not eligible', col: 1, row: 1 },
    { id: 'dec', kind: 'decision', label: 'Existing record?', col: 2, row: 1 },
    { id: 'otpn', kind: 'screen', label: 'OTP → entered mobile', detail: `contact_mobile_verified · ${LIMITS.otpAttempts} attempts, ${LIMITS.otpResends} resends`, col: 3, row: 1, step: 'otp' },
    { id: 'route', kind: 'decision', label: 'Create record + route', detail: 'Internal eligibility · IBAN declaration (FL)', col: 4, row: 1 },
    { id: 'crn', kind: 'connector', label: '→ C · New registered business', col: 5, row: 1, step: 'cr' },
    { id: 'fln', kind: 'connector', label: '→ D · New Freelancer', col: 5, row: 2, step: 'certificates' },
    { id: 'mis', kind: 'backend', label: 'Entered mobile ≠ stored', detail: 'Never used · no takeover · code to the stored mobile only', col: 1, row: 3 },
    { id: 'otpr', kind: 'screen', label: 'OTP → STORED mobile', detail: '"Code sent to the registered mobile ending •••123" · also the Continue link', col: 2, row: 3, step: 'otp' },
    { id: 'deny', kind: 'outcome', label: 'Code not completed', detail: 'No access · nothing exposed · no new application', col: 3, row: 3 },
    { id: 'resume', kind: 'cached', label: 'DRAFT → resume', detail: 'First unfinished CR / Freelancer step · checks reused', col: 0, row: 4 },
    { id: 'life', kind: 'decision', label: 'Lifecycle + authorization', detail: 'Status first, then authorization, then completion', col: 2, row: 4 },
    { id: 'login', kind: 'screen', label: 'Live → "active account" popup', detail: 'Log in only on click · no auto-redirect · no application', col: 4, row: 4, step: 'login' },
    { id: 'paused', kind: 'manual', label: 'PAUSED_CR', detail: 'Sales follow-up message', col: 1, row: 5, outcome: 'PAUSED_CR' },
    { id: 'status', kind: 'screen', label: 'Submitted / internal Not Eligible → Application Progress', detail: 'Not Eligible shows "Under review"', col: 2, row: 5, step: 'status' },
    { id: 'handoff', kind: 'screen', label: 'Awaiting authorization → status page', detail: 'Frozen · status only', col: 3, row: 5, step: 'handoff' }
  ],
  edges: [
    { from: 'id', to: 'throttle', dashed: true }, { from: 'id', to: 'exist' }, { from: 'exist', to: 'dec' }, { from: 'dec', to: 'otpn', label: 'new' }, { from: 'otpn', to: 'route', label: 'verified' },
    { from: 'route', to: 'ne', label: 'not eligible' }, { from: 'route', to: 'crn', label: 'CR' }, { from: 'route', to: 'fln', label: 'FL' },
    { from: 'dec', to: 'otpr', label: 'existing' }, { from: 'otpr', to: 'mis', dashed: true }, { from: 'otpr', to: 'deny', label: 'failed', dashed: true }, { from: 'otpr', to: 'life', label: 'verified' },
    { from: 'life', to: 'resume', label: 'DRAFT' }, { from: 'life', to: 'paused', label: 'paused' }, { from: 'life', to: 'status', label: 'submitted' }, { from: 'life', to: 'login', label: 'live' },
    { from: 'life', to: 'handoff', label: 'awaiting authorization' }
  ]
};

const C: JourneyMap = {
  id: 'cr', large: true, title: `C · ${S(3)}: registered business (CR verification)`,
  caption: 'CR data and owners / managers are retrieved in the backend once and reused; nobody is chosen here (authorization comes after Review). CR age and other data feed the risk score; they never reject. No CR IBAN, VAT or branch count.',
  nodes: [
    { id: 'crc', kind: 'cached', label: 'Stored CR data', detail: 'Reused on resume', col: 1, row: 0 },
    { id: 'paused', kind: 'manual', label: 'Expired / suspended', detail: O('PAUSED_CR'), col: 2, row: 0, outcome: 'PAUSED_CR' },
    { id: 'risk', kind: 'backend', label: 'Risk score (synthetic)', detail: 'CR age · entity · address · revenue · category — never a block', col: 3, row: 0 },
    { id: 'start', kind: 'connector', label: 'From routing: new CR (DRAFT)', col: 0, row: 1 },
    { id: 'cr', kind: 'external', label: 'CR data', detail: 'Status · age · activities (several) · National Address · entity', col: 1, row: 1, step: 'cr' },
    { id: 'gov', kind: 'decision', label: 'CR status (hard rule)', col: 2, row: 1 },
    { id: 'cat', kind: 'backend', label: 'Activities → verified category', detail: 'Government wins · prices the offer', col: 3, row: 1 },
    { id: 'ppl', kind: 'external', label: 'Owners / managers', detail: 'Kept for the Authorization choice', col: 4, row: 1 },
    { id: 'show', kind: 'screen', label: 'Your business registration', detail: 'Retrieved data · Continue', col: 5, row: 1, step: 'cr' },
    { id: 'next', kind: 'connector', label: `→ F · ${S(4)}`, col: 6, row: 1, step: 'business' },
    { id: 'unav', kind: 'screen', label: 'Provider unavailable', detail: `Retry (${LIMITS.providerRetries}/session) · Save & exit · reset on resume`, col: 1, row: 2, step: 'cr' },
    { id: 'reg', kind: 'outcome', label: 'Application submitted', detail: 'Regulated activity → internal Not Eligible', col: 3, row: 2, outcome: 'RECEIVED' },
    { id: 'none', kind: 'outcome', label: 'Application submitted', detail: 'No owner / manager on the CR → internal Not Eligible', col: 4, row: 2, outcome: 'RECEIVED' },
    { id: 'od-map', kind: 'open', label: 'PRODUCT TASK: activity mapping', col: 0, row: 3 },
    { id: 'od-multi', kind: 'open', label: 'Multi-activity reconciliation', col: 1, row: 3 },
    { id: 'od-hard', kind: 'open', label: 'Not Eligible inventory', col: 2, row: 3 },
    { id: 'od-risk', kind: 'open', label: 'Risk weights / thresholds', col: 3, row: 3 }
  ],
  edges: [
    { from: 'start', to: 'cr' }, { from: 'cr', to: 'crc', dashed: true }, { from: 'cr', to: 'unav', label: 'unavailable', dashed: true }, { from: 'cr', to: 'gov' },
    { from: 'gov', to: 'paused', label: 'expired / suspended' }, { from: 'gov', to: 'cat', label: 'active' }, { from: 'cat', to: 'risk', dashed: true }, { from: 'cat', to: 'reg', label: 'regulated' },
    { from: 'cat', to: 'ppl' }, { from: 'ppl', to: 'none', label: 'none' }, { from: 'ppl', to: 'show', label: 'found' }, { from: 'show', to: 'next', label: 'Continue' }
  ]
};

const D: JourneyMap = {
  id: 'fl', large: true, title: `D · ${S(7)}: Freelancer — certificate after Review, before Nafath`,
  caption: 'Freelancer: Business Details (+ IBAN) → Commercial Offer → Review first, then the certificate list is retrieved by National ID and chosen BEFORE Nafath (one call; no certificate → no Nafath cost). The confirmed certificate activity becomes the verified category and part of the authorization context; then mobile ↔ National ID, Nafath and the Contract.',
  nodes: [
    { id: 'none', kind: 'outcome', label: 'Application submitted', detail: 'No usable certificate → internal Not Eligible · NO Nafath call', col: 1, row: 0, outcome: 'RECEIVED' },
    { id: 'blk', kind: 'outcome', label: 'Application submitted', detail: 'Certificate activity requires a CR → internal', col: 3, row: 0, outcome: 'RECEIVED' },
    { id: 'start', kind: 'connector', label: `From ${S(6)}: Freelancer continues (DRAFT)`, col: 0, row: 1, step: 'review' },
    { id: 'get', kind: 'external', label: 'Certificate retrieval', detail: 'By National ID · reused on resume', col: 1, row: 1, step: 'certificates' },
    { id: 'sel', kind: 'screen', label: 'Choose certificate', detail: 'Expired / already linked cannot be selected', col: 2, row: 1, step: 'certificates' },
    { id: 'rec', kind: 'decision', label: 'Certificate activity → verified category', col: 3, row: 1 },
    { id: 'naf', kind: 'connector', label: '→ E · Mobile ↔ National ID + Nafath', col: 4, row: 1, step: 'nafath' },
    { id: 'next', kind: 'connector', label: '→ Contract (verified) · manual verification (failed twice)', col: 5, row: 1, step: 'contract' },
    { id: 'unav', kind: 'screen', label: 'Service unavailable', detail: 'Retry later; no Nafath yet', col: 1, row: 2, step: 'certificates' },
    { id: 'lock', kind: 'cached', label: 'Locked after Nafath', detail: 'Certificate cannot change once verified', col: 4, row: 2 },
    { id: 'od', kind: 'open', label: 'PRIVACY / PROVIDER: certificate details before Nafath', col: 0, row: 3 },
    { id: 'cost', kind: 'note', label: 'Product assumption: certificate ≈ SAR 9, Nafath ≈ SAR 6. No certificate → ≈ SAR 9 instead of ≈ SAR 15.', col: 2, row: 3 }
  ],
  edges: [
    { from: 'start', to: 'get' }, { from: 'get', to: 'none', label: 'none' }, { from: 'get', to: 'unav', label: 'unavailable', dashed: true }, { from: 'get', to: 'sel', label: 'found' },
    { from: 'sel', to: 'rec' }, { from: 'rec', to: 'blk', label: 'needs CR' }, { from: 'rec', to: 'naf', label: 'continue' }, { from: 'naf', to: 'next', label: 'verified / failed twice' },
    { from: 'naf', to: 'lock', dashed: true }
  ]
};

const E: JourneyMap = {
  id: 'nafath', large: true, title: 'E · Mobile ↔ National ID, then Nafath (Freelancer, self-authorizing owner, signer)',
  caption: 'Send to Nafath first confirms that the mobile belongs to the verifying person. Freelancer: right after the certificate. Registered business: only after Review and the Authorization choice. A preparer / Freelancer mismatch never restarts onboarding; a signer cannot change the mobile in Phase 1.',
  nodes: [
    { id: 'tech', kind: 'backend', label: 'Technical failure', detail: `No attempt used · ${LIMITS.nafathTechnicalRetries} / session`, col: 2, row: 0 },
    { id: 'nafc', kind: 'cached', label: 'Nafath verified', detail: 'Preparer: reused on resume · signer: again every session', col: 3, row: 0 },
    { id: 'send', kind: 'screen', label: 'Send to Nafath', detail: 'Freelancer · self-authorizing owner / manager · signer', col: 0, row: 1, step: 'nafath' },
    { id: 'mm', kind: 'external', label: 'Mobile ↔ National ID', detail: `Signer: the handoff mobile · others: registered mobile · ${LIMITS.mobileMatchChecks} checks`, col: 1, row: 1 },
    { id: 'naf', kind: 'external', label: 'Nafath', detail: `${LIMITS.nafathAttempts} attempts / authorization`, col: 3, row: 1 },
    { id: 'ok', kind: 'connector', label: '→ FL: Business Details · CR self: Contract · signer: read-only Review', col: 5, row: 1, step: 'contract' },
    { id: 'mis', kind: 'screen', label: 'Mismatch (preparer / Freelancer)', detail: '"The mobile number must belong to …" · Use another mobile number', col: 1, row: 2, step: 'nafath' },
    { id: 'otp', kind: 'screen', label: 'OTP → new mobile', detail: 'Becomes the registered mobile', col: 2, row: 2, step: 'otp' },
    { id: 'fail', kind: 'screen', label: 'Rejected / timed out', detail: 'Retry while attempts remain', col: 3, row: 2, step: 'nafath' },
    { id: 'ex', kind: 'manual', label: 'Failed twice', detail: 'FL: details collected, no contract · CR self: manual verification · signer: version ends', col: 4, row: 2, outcome: 'SUBMITTED_MANUAL' },
    { id: 'od8', kind: 'open', label: 'PROVIDER: mobile ownership service', col: 0, row: 3 },
    { id: 'paused', kind: 'manual', label: 'Still a mismatch', detail: 'Verification paused · progress saved · no Nafath call', col: 1, row: 3 },
    { id: 'od9', kind: 'open', label: 'COMPLIANCE: after repeated mismatch', col: 2, row: 3 }
  ],
  edges: [
    { from: 'send', to: 'mm' }, { from: 'mm', to: 'naf', label: 'match' }, { from: 'mm', to: 'mis', label: 'mismatch' }, { from: 'mis', to: 'otp' }, { from: 'otp', to: 'mm', label: 'check again', dashed: true },
    { from: 'mis', to: 'paused', label: 'mismatch again' }, { from: 'naf', to: 'nafc', dashed: true }, { from: 'naf', to: 'tech', dashed: true }, { from: 'naf', to: 'fail', label: 'failed' },
    { from: 'naf', to: 'ex', label: 'failed twice' }, { from: 'naf', to: 'ok', label: 'verified' }
  ]
};

const F: JourneyMap = {
  id: 'details', large: true, title: `F · ${S(4)}`,
  caption: 'Store presence for the channel declared on Page 1 (fraud / presence evidence). Google Maps = actual selling branch, not the National Address. Freelancers verify the IBAN linkage. Frozen once a signer handoff starts.',
  nodes: [
    { id: 'web', kind: 'backend', label: 'Online: store / website URL', detail: 'Scheme optional · no social / WhatsApp / shorteners', col: 2, row: 0 },
    { id: 'page', kind: 'screen', label: S(4), detail: 'Channel shown from Page 1', col: 0, row: 1, step: 'business' },
    { id: 'ch', kind: 'decision', label: 'Channel', col: 1, row: 1 },
    { id: 'both', kind: 'backend', label: 'Both: both links', col: 2, row: 1 },
    { id: 'type', kind: 'decision', label: 'Applicant type', col: 3, row: 1 },
    { id: 'next', kind: 'connector', label: `→ G · ${S(5)}`, col: 5, row: 1, step: 'commercial' },
    { id: 'maps', kind: 'backend', label: 'Offline: Google Maps branch link', detail: 'Any Google Maps domain', col: 2, row: 2 },
    { id: 'iban', kind: 'external', label: 'Freelancer IBAN ↔ certificate', detail: `${LIMITS.ibanAttempts} mismatches / IBAN; technical errors free`, col: 4, row: 2 },
    { id: 'removed', kind: 'note', label: 'Removed: registered-business IBAN (payout account added at activation), VAT, number of branches.', col: 0, row: 3 },
    { id: 'ibanx', kind: 'manual', label: 'Not linked twice', detail: 'Enter another IBAN · contract needs a verified IBAN', col: 4, row: 3 }
  ],
  edges: [
    { from: 'page', to: 'ch' }, { from: 'ch', to: 'web', label: 'online' }, { from: 'ch', to: 'both', label: 'both' }, { from: 'ch', to: 'maps', label: 'offline' },
    { from: 'web', to: 'type' }, { from: 'both', to: 'type' }, { from: 'maps', to: 'type' }, { from: 'type', to: 'next', label: 'CR' }, { from: 'type', to: 'iban', label: 'Freelancer' },
    { from: 'iban', to: 'next', label: 'verified' }, { from: 'iban', to: 'ibanx', label: 'mismatch ×2' }
  ]
};

const G: JourneyMap = {
  id: 'commercial', large: true, title: `G · ${S(5)} (preparer only)`,
  caption: 'Your Standard Offer → Continue, before any authorization. The rate comes from the VERIFIED category. A better-rate review is optional and low-priority. Once a signer handoff starts the offer is frozen with the application; the signer sees it read-only.',
  nodes: [
    { id: 'removed', kind: 'note', label: 'Removed: payment-plan selection (3 / 4 / 6 / 9 / 12 months) — configured later in the Merchant Portal.', col: 0, row: 0 },
    { id: 'page', kind: 'screen', label: 'Your Standard Offer', detail: 'One commission · short explanation · Continue', col: 0, row: 1, step: 'commercial' },
    { id: 'price', kind: 'backend', label: 'Pricing matrix', detail: 'Verified (government-mapped) category', col: 1, row: 1 },
    { id: 'next', kind: 'connector', label: `→ H · ${S(6)}`, col: 3, row: 1, step: 'review' },
    { id: 'ask', kind: 'screen', label: '"Want us to review a better rate?"', detail: 'Collapsed link under the offer', col: 0, row: 2, step: 'commercial' },
    { id: 'req', kind: 'backend', label: 'Request rate review', detail: 'COMMERCIAL_RATE_REVIEW_REQUESTED · no file needed', col: 1, row: 2 },
    { id: 'files', kind: 'screen', label: 'Optional evidence', detail: 'Shown only after the request', col: 2, row: 2, step: 'commercial' },
    { id: 'rev', kind: 'manual', label: 'Commercial rate review', detail: 'Never blocks; standard rate applies', col: 3, row: 2 },
    { id: 'frozen', kind: 'cached', label: 'Frozen at handoff', detail: 'Versioned with the application · signer read-only', col: 4, row: 1 },
    { id: 'od-p', kind: 'open', label: 'PRODUCT TASK: Pricing matrix', col: 0, row: 3 },
    { id: 'od-e', kind: 'open', label: 'COMMERCIAL: evidence for a better rate', col: 1, row: 3 }
  ],
  edges: [
    { from: 'page', to: 'price' }, { from: 'price', to: 'next', label: 'Continue' }, { from: 'page', to: 'ask', dashed: true }, { from: 'ask', to: 'req', label: 'Request rate review' },
    { from: 'req', to: 'files', dashed: true }, { from: 'files', to: 'rev' }, { from: 'next', to: 'frozen', dashed: true }
  ]
};

const H: JourneyMap = {
  id: 'review', large: true, title: `H · ${S(6)}: locked sections, transactional edit`,
  caption: 'Preparer: verified sections are locked; only store presence and the rate-review request can be edited (draft until Save; Cancel restores everything). Registered business continues to the Authorization choice. Signer: the same page, entirely read-only.',
  nodes: [
    { id: 'locked', kind: 'cached', label: 'Locked', detail: 'Type · identifier · category · government data · mobile · certificate · FL IBAN', col: 1, row: 0 },
    { id: 'review', kind: 'screen', label: S(6), detail: 'Applicant · verified identity · store presence · status · banking (FL) · offer', col: 0, row: 1, step: 'review' },
    { id: 'edit', kind: 'decision', label: 'Editable section?', detail: 'Store presence · rate review', col: 1, row: 1 },
    { id: 'draft', kind: 'backend', label: 'Draft copy', detail: 'Nothing applied yet', col: 2, row: 1 },
    { id: 'save', kind: 'backend', label: 'Save', detail: 'Apply · invalidate dependants only (none here)', col: 3, row: 1 },
    { id: 'back', kind: 'connector', label: `→ back to ${S(6)}`, col: 4, row: 1 },
    { id: 'cancel', kind: 'backend', label: 'Cancel', detail: 'Restore the whole application', col: 2, row: 2 },
    { id: 'auth', kind: 'connector', label: '→ I · Authorization choice (CR) · K · Contract (FL)', col: 0, row: 3, step: 'authorize' }
  ],
  edges: [
    { from: 'review', to: 'locked', dashed: true }, { from: 'review', to: 'edit', label: 'Edit' }, { from: 'edit', to: 'draft', label: 'yes' }, { from: 'draft', to: 'save' }, { from: 'save', to: 'back' },
    { from: 'draft', to: 'cancel', label: 'Cancel' }, { from: 'cancel', to: 'back', dashed: true }, { from: 'review', to: 'auth', label: 'Continue' }
  ]
};

const I: JourneyMap = {
  id: 'authorize', large: true, title: `I · Authorization choice and signer handoff (registered business, Phase 1)`,
  caption: `After Review the preparer authorizes personally or sends the application to another owner / manager on the CR. A handoff creates an authorization VERSION of the same application, freezes data and offer, and sends a secure SMS link valid ${H_.expiryDays} days (configurable). Max ${H_.maxVersions} versions in ${H_.windowDays} days — no blanket CR lock.`,
  nodes: [
    { id: 'od-status', kind: 'open', label: 'PRODUCT: final preparer status list', detail: 'Configurable buckets (In progress · Approved · …)', col: 1, row: 0 },
    { id: 'od-change', kind: 'open', label: 'PHASE 2: change signer / mobile, resend / revoke', col: 3, row: 0 },
    { id: 'review', kind: 'connector', label: `From H · ${S(6)}`, col: 0, row: 1 },
    { id: 'choice', kind: 'screen', label: 'Who will authorize and sign?', detail: 'Myself · Send to another signer', col: 1, row: 1, step: 'authorize' },
    { id: 'dec', kind: 'decision', label: 'Choice', col: 2, row: 1 },
    { id: 'self', kind: 'screen', label: 'Select yourself', detail: 'Owner / manager on the CR', col: 3, row: 1, step: 'authorize' },
    { id: 'selfnext', kind: 'connector', label: '→ E · Nafath → K · Contract', col: 4, row: 1, step: 'nafath' },
    { id: 'signernext', kind: 'connector', label: '→ J · Signer opens the link', col: 5, row: 1, step: 'signer' },
    { id: 'form', kind: 'screen', label: 'Send to another signer', detail: 'Owner / manager on the CR + primary Nafath mobile', col: 2, row: 2, step: 'authorize' },
    { id: 'limit', kind: 'decision', label: `≤ ${H_.maxVersions} in ${H_.windowDays} days?`, detail: 'Versions of THIS application', col: 3, row: 2 },
    { id: 'create', kind: 'backend', label: 'Create authorization V{n}', detail: `Same application · audit trail · SMS link (${H_.expiryDays} days)`, col: 4, row: 2 },
    { id: 'status', kind: 'screen', label: 'Waiting for authorization', detail: 'Preparer: status only · no edit · no signer change', col: 5, row: 2, step: 'handoff' },
    { id: 'blocked', kind: 'manual', label: 'Limit reached', detail: 'Internal / manual unlock · self authorization still possible', col: 3, row: 3 },
    { id: 'freeze', kind: 'cached', label: 'Application + offer frozen', detail: 'Signer reviews exactly this version', col: 4, row: 3 },
    { id: 'expired', kind: 'manual', label: 'Expired / ended', detail: 'Link dead · application kept · no new application', col: 5, row: 3 },
    { id: 'v2', kind: 'connector', label: '→ new version (V2) of the SAME application', col: 6, row: 3, step: 'authorize' },
    { id: 'p1', kind: 'note', label: 'Phase 1: no signer / mobile change after the handoff starts; no send-back or edit loop; the preparer sees status only.', col: 0, row: 4 }
  ],
  edges: [
    { from: 'review', to: 'choice' }, { from: 'choice', to: 'dec' }, { from: 'dec', to: 'self', label: 'myself' }, { from: 'self', to: 'selfnext', label: 'Continue to Nafath' },
    { from: 'dec', to: 'form', label: 'another signer' }, { from: 'form', to: 'limit', label: 'Send Authorization' }, { from: 'limit', to: 'create', label: 'yes' }, { from: 'limit', to: 'blocked', label: 'no' },
    { from: 'create', to: 'status' }, { from: 'create', to: 'freeze', dashed: true }, { from: 'status', to: 'signernext', label: 'SMS link' }, { from: 'status', to: 'expired', label: `no signature in ${H_.expiryDays} days` },
    { from: 'expired', to: 'v2', label: 'Start a new authorization' }, { from: 'choice', to: 'od-status', dashed: true }
  ]
};

const J: JourneyMap = {
  id: 'signer', large: true, title: 'J · CR signer: secure link → Nafath → read-only Review → Contract',
  caption: 'No signer OTP in Phase 1, and the link alone authorizes nothing: the first page shows only masked context. Nafath is the strong identity step and runs again in every signer session; only then is the full application shown. One direction only.',
  nodes: [
    { id: 'deleg', kind: 'open', label: 'PHASE 2 · Delegated signer', detail: 'MOJ (automatic) · company / other document (Quality review) · verified BEFORE Nafath', col: 2, row: 0 },
    { id: 'link', kind: 'screen', label: 'Secure SMS link', detail: 'Token → application + version', col: 0, row: 1, step: 'signer' },
    { id: 'valid', kind: 'decision', label: 'Link valid?', detail: 'Latest version · not expired · not ended', col: 1, row: 1 },
    { id: 'confirm', kind: 'screen', label: 'Signer confirmation', detail: 'Business · first + last name · masked ID & mobile · Start Nafath Verification', col: 2, row: 1, step: 'signer' },
    { id: 'mm', kind: 'external', label: 'Mobile ↔ National ID', detail: 'The mobile the preparer entered', col: 3, row: 1 },
    { id: 'naf', kind: 'external', label: 'Nafath', detail: `${LIMITS.nafathAttempts} attempts`, col: 4, row: 1 },
    { id: 'review', kind: 'screen', label: 'Read-only Review', detail: 'Full application + frozen offer · no edit', col: 5, row: 1, step: 'review' },
    { id: 'contract', kind: 'screen', label: 'Contract', detail: 'Agree & Sign', col: 6, row: 1, step: 'contract' },
    { id: 'dead', kind: 'outcome', label: 'Link no longer works', detail: 'Expired / ended / older version · nothing shown', col: 1, row: 2 },
    { id: 'ended', kind: 'manual', label: 'Version ends', detail: 'Mobile mismatch or Nafath failed twice · application kept', col: 3, row: 2 },
    { id: 'done', kind: 'outcome', label: 'Submitted', detail: 'Authorization COMPLETED · preparer sees Application Progress', col: 6, row: 2, outcome: 'SUBMITTED', step: 'outcome' },
    { id: 'p1', kind: 'note', label: 'Phase 1: no send-back, request-changes or edit loop. The signer cannot modify the application or the offer.', col: 0, row: 3 }
  ],
  edges: [
    { from: 'link', to: 'valid' }, { from: 'valid', to: 'confirm', label: 'yes' }, { from: 'valid', to: 'dead', label: 'no' }, { from: 'confirm', to: 'mm', label: 'Start Nafath' },
    { from: 'confirm', to: 'deleg', dashed: true }, { from: 'mm', to: 'naf', label: 'match' }, { from: 'mm', to: 'ended', label: 'mismatch' }, { from: 'naf', to: 'ended', label: 'failed twice' },
    { from: 'naf', to: 'review', label: 'verified' }, { from: 'review', to: 'contract', label: 'Continue' }, { from: 'contract', to: 'done', label: 'Agree & Sign' }
  ]
};

const K: JourneyMap = {
  id: 'contract', large: true, title: `K · Contract, submission and Application Progress`,
  caption: 'Back to Review, or one action: Agree & Submit (preparer) / Agree & Sign (signer) records acceptance and submits (no Decline). A submitted application opens Application Progress — never Review, Contract or a second submission. No activation is claimed before it happens.',
  nodes: [
    { id: 'review', kind: 'screen', label: S(6), col: 0, row: 1, step: 'review' },
    { id: 'gate', kind: 'decision', label: 'Contract gate', detail: 'Signing person: Nafath + mobile ownership · CR: authorization chosen / live signer link · FL: certificate + IBAN', col: 1, row: 1 },
    { id: 'contract', kind: 'screen', label: 'Contract', detail: 'Frozen standard commission as Schedule 1 · one action', col: 2, row: 1, step: 'contract' },
    { id: 'sub', kind: 'outcome', label: 'Submitted', detail: O('SUBMITTED'), col: 3, row: 1, step: 'outcome', outcome: 'SUBMITTED' },
    { id: 'status', kind: 'screen', label: 'Application Progress', detail: 'Return later with the stored-mobile code', col: 4, row: 1, step: 'status' },
    { id: 'login', kind: 'screen', label: 'Live → active-account popup', detail: 'Log in button', col: 5, row: 1, step: 'login' },
    { id: 'mv', kind: 'manual', label: 'Submitted for manual verification', detail: O('SUBMITTED_MANUAL'), col: 1, row: 2, outcome: 'SUBMITTED_MANUAL' },
    { id: 'states', kind: 'backend', label: 'Statuses', detail: 'Submitted · Under review · Action required · Approved · Unable to proceed', col: 4, row: 2 },
    { id: 'od', kind: 'open', label: 'OPERATIONS: final status lifecycle / SLA', col: 0, row: 3 }
  ],
  edges: [
    { from: 'review', to: 'gate' }, { from: 'gate', to: 'contract', label: 'pass' }, { from: 'gate', to: 'mv', label: 'not available' }, { from: 'contract', to: 'sub', label: 'Agree' },
    { from: 'sub', to: 'status', label: 'later' }, { from: 'status', to: 'states', dashed: true }, { from: 'status', to: 'login', label: 'live', dashed: true }
  ]
};

const L: JourneyMap = {
  id: 'reuse', large: true, title: 'L · Resume, reuse, invalidation and freshness',
  caption: 'Ordinary resume costs one OTP to the stored mobile and opens the first unfinished CR or Freelancer step. Positive results are reused until a dependency changes; negative and technical results follow a policy per result type.',
  nodes: [
    { id: 'fresh', kind: 'open', label: 'Freshness policy per verification', detail: 'Open: reusable until invalidated', col: 1, row: 0 },
    { id: 'in', kind: 'screen', label: 'Stored-mobile OTP', detail: 'Page 2 re-entry or Continue link', col: 0, row: 1, step: 'otp' },
    { id: 'reuse', kind: 'cached', label: 'Valid checks reused', detail: 'CR · owners · mobile match · Nafath · certificate · IBAN', col: 1, row: 1 },
    { id: 'first', kind: 'connector', label: 'First unfinished stage', detail: 'CR: CR · details · offer · review / authorization · FL: certificate · Nafath · details · offer', col: 2, row: 1 },
    { id: 'neg', kind: 'backend', label: 'Negative results', detail: 'Outage: retry, counters reset per session · expired CR: Sales only · CR age: re-scored', col: 1, row: 2 },
    { id: 'inv', kind: 'backend', label: 'Invalidation', detail: 'Mobile → match · certificate → IBAN · IBAN → IBAN only', col: 2, row: 2 }
  ],
  edges: [{ from: 'in', to: 'reuse' }, { from: 'reuse', to: 'first' }, { from: 'reuse', to: 'fresh', dashed: true }, { from: 'reuse', to: 'neg', dashed: true }, { from: 'neg', to: 'inv', dashed: true }],
  notes: [REUSE_NOTE]
};

const M: JourneyMap = {
  id: 'states', large: true, title: 'M · Two lifecycles: application vs authorization · Phase 1 vs Phase 2',
  caption: 'Routing reads BOTH: the application lifecycle (top) and the CR authorization lifecycle (bottom). Completing the authorization submits the application. Not Eligible is an internal application state; the merchant sees Submitted / Under review.',
  nodes: [
    { id: 'q', kind: 'backend', label: 'QUALIFICATION', detail: 'Page 1 / Page 2', col: 0, row: 1 },
    { id: 'otp', kind: 'backend', label: 'OTP_PENDING', col: 1, row: 1 },
    { id: 'draft', kind: 'backend', label: 'DRAFT', detail: 'Editable by the preparer', col: 2, row: 1 },
    { id: 'await', kind: 'backend', label: 'AWAITING_AUTHORIZATION', detail: 'Frozen · handoff version exists', col: 3, row: 1 },
    { id: 'sub', kind: 'backend', label: 'SUBMITTED', col: 4, row: 1 },
    { id: 'rev', kind: 'backend', label: 'UNDER_REVIEW → APPROVED', detail: 'or ACTION_REQUIRED / UNABLE_TO_PROCEED', col: 5, row: 1 },
    { id: 'live', kind: 'backend', label: 'LIVE', col: 6, row: 1 },
    { id: 'ne', kind: 'manual', label: 'NOT_ELIGIBLE (internal)', detail: 'Merchant sees Submitted / Under review', col: 1, row: 2 },
    { id: 'paused', kind: 'manual', label: 'PAUSED_CR', detail: 'Expired / suspended CR · Sales', col: 2, row: 2 },
    { id: 'a0', kind: 'backend', label: 'NOT_STARTED', col: 0, row: 3 },
    { id: 'a1', kind: 'backend', label: 'HANDOFF_CREATED', detail: 'transient', col: 1, row: 3 },
    { id: 'a2', kind: 'backend', label: 'AWAITING_SIGNER', col: 2, row: 3 },
    { id: 'a3', kind: 'backend', label: 'NAFATH_PENDING', col: 3, row: 3 },
    { id: 'a4', kind: 'backend', label: 'NAFATH_VERIFIED', col: 4, row: 3 },
    { id: 'a5', kind: 'backend', label: 'CONTRACT_PENDING', col: 5, row: 3 },
    { id: 'a6', kind: 'backend', label: 'COMPLETED', detail: 'Application → SUBMITTED', col: 6, row: 3 },
    { id: 'aexp', kind: 'manual', label: 'EXPIRED', detail: `After ${H_.expiryDays} days (configurable)`, col: 2, row: 4 },
    { id: 'acan', kind: 'manual', label: 'CANCELLED', detail: 'Signer mobile mismatch / Nafath failed twice', col: 3, row: 4 },
    { id: 'phase1', kind: 'note', label: `PHASE 1: CR / Freelancer onboarding · resume · submitted · live popup · CR signer handoff · secure link · no signer OTP · Nafath before signer review · freeze · ${H_.expiryDays}-day configurable link · max ${H_.maxVersions} versions / ${H_.windowDays} days · no signer / mobile change · no send-back loop`, col: 0, row: 5 },
    { id: 'phase2', kind: 'note', label: 'PHASE 2 / FUTURE: change signer / mobile · resend / revoke · delegated signer (MOJ integration, Quality manual review) · signer-change option · advanced signer workflows', col: 3, row: 5 }
  ],
  edges: [
    { from: 'q', to: 'otp' }, { from: 'otp', to: 'draft', label: 'verified' }, { from: 'draft', to: 'await', label: 'handoff' }, { from: 'await', to: 'sub', label: 'signed' }, { from: 'sub', to: 'rev' }, { from: 'rev', to: 'live' },
    { from: 'otp', to: 'ne', label: 'not eligible' }, { from: 'draft', to: 'paused', label: 'CR expired' },
    { from: 'a0', to: 'a1' }, { from: 'a1', to: 'a2', label: 'SMS sent' }, { from: 'a2', to: 'a3', label: 'link opened' }, { from: 'a3', to: 'a4' }, { from: 'a4', to: 'a5' }, { from: 'a5', to: 'a6', label: 'Agree & Sign' },
    { from: 'a2', to: 'aexp', label: 'time' }, { from: 'a3', to: 'acan', label: 'failed' }
  ]
};

export const DETAILED_BOARD: JourneyMap[] = [A, B, C, D, E, F, G, H, I, J, K, L, M];
export const ALL_BOARDS: JourneyMap[] = [...DETAILED_BOARD];

/**
 * Split a wide map into two readable parts (used by the PDF). Edges that cross the split end at, and
 * start from, labelled connector nodes.
 */
export function splitMap(map: JourneyMap, at: number): [JourneyMap, JourneyMap] | null {
  const maxCol = Math.max(...map.nodes.map((n) => n.col));
  if (maxCol < at + 2) return null;
  const left = map.nodes.filter((n) => n.col < at);
  const right = map.nodes.filter((n) => n.col >= at).map((n) => ({ ...n, col: n.col - at + 1 }));
  const inLeft = new Set(left.map((n) => n.id));
  const labelOf = (id: string) => map.nodes.find((n) => n.id === id)!.label;
  const a: JourneyMap = { ...map, title: `${map.title} (part 1 of 2)`, nodes: [...left], edges: [] };
  const b: JourneyMap = { ...map, title: `${map.title} (part 2 of 2)`, nodes: [...right], edges: [] };
  for (const e of map.edges) {
    const fromLeft = inLeft.has(e.from);
    const toLeft = inLeft.has(e.to);
    if (fromLeft && toLeft) a.edges.push(e);
    else if (!fromLeft && !toLeft) b.edges.push(e);
    else if (fromLeft) {
      const src = map.nodes.find((n) => n.id === e.from)!;
      const dst = right.find((n) => n.id === e.to)!;
      const outId = `out-${e.from}-${e.to}`;
      const inId = `in-${e.from}-${e.to}`;
      a.nodes.push({ id: outId, kind: 'connector', label: `Continues → ${labelOf(e.to)}`, col: at, row: src.row });
      a.edges.push({ from: e.from, to: outId, label: e.label, dashed: e.dashed });
      b.nodes.push({ id: inId, kind: 'connector', label: `From ← ${labelOf(e.from)}`, col: 0, row: dst.row });
      b.edges.push({ from: inId, to: e.to, dashed: e.dashed });
    } else {
      const src = right.find((n) => n.id === e.from)!;
      const dst = map.nodes.find((n) => n.id === e.to)!;
      const backId = `back-${e.from}-${e.to}`;
      const retId = `ret-${e.from}-${e.to}`;
      b.nodes.push({ id: backId, kind: 'connector', label: `Back to ← ${labelOf(e.to)}`, col: 0, row: src.row + 1 });
      b.edges.push({ from: e.from, to: backId, label: e.label, dashed: true });
      a.nodes.push({ id: retId, kind: 'connector', label: `Returns from ${labelOf(e.from)}`, col: at, row: dst.row + 1 });
      a.edges.push({ from: retId, to: e.to, dashed: true });
    }
  }
  return [a, b];
}

/* ------------------------------------------------------------------ edge routing (shared by renderer and tests) */

const span = (n: MapNode) => (n.kind === 'note' ? 3 : 1);
const between = (a: number, b: number) => Array.from({ length: Math.max(0, Math.abs(b - a) - 1) }, (_, i) => Math.min(a, b) + i + 1);

export type Route = 'straight' | 'vertical-first' | 'horizontal-first';

/** How an edge is drawn and whether it crosses another node. Elbows prefer vertical-first. */
export function routeEdge(map: JourneyMap, e: MapEdge): { route: Route; blocked: boolean } {
  const occupied = new Set(map.nodes.flatMap((n) => Array.from({ length: span(n) }, (_, i) => `${n.col + i}:${n.row}`)));
  const a = map.nodes.find((n) => n.id === e.from)!;
  const b = map.nodes.find((n) => n.id === e.to)!;
  const clear = (cells: string[]) => cells.every((c) => !occupied.has(c));
  if (a.row === b.row) return { route: 'straight', blocked: !clear(between(a.col, b.col).map((c) => `${c}:${a.row}`)) };
  if (a.col === b.col) return { route: 'straight', blocked: !clear(between(a.row, b.row).map((r) => `${a.col}:${r}`)) };
  const v = [...between(a.row, b.row).map((r) => `${a.col}:${r}`), `${a.col}:${b.row}`, ...between(a.col, b.col).map((c) => `${c}:${b.row}`)];
  const h = [...between(a.col, b.col).map((c) => `${c}:${a.row}`), `${b.col}:${a.row}`, ...between(a.row, b.row).map((r) => `${b.col}:${r}`)];
  if (clear(v)) return { route: 'vertical-first', blocked: false };
  if (clear(h)) return { route: 'horizontal-first', blocked: false };
  return { route: 'vertical-first', blocked: true };
}
