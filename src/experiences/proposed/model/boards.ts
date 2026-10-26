/**
 * Master Board and Detailed Logic Board for Madfu Proposed, built from the same model the prototype
 * runs: stage names come from STAGES, outcome titles from OUTCOME_COPY, limits and flags from the
 * configuration. Nodes reference step ids and outcome kinds so tests can prove the boards and the
 * prototype describe the same journey. Node kinds separate merchant-facing steps, backend / internal
 * steps, external provider calls and decisions.
 */
import { LIMITS, RULE_FLAGS, STAGES } from './config';
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
export const REUSE_NOTE = 'Successful CR / owner / mobile / Nafath / certificate / IBAN checks are reused. Resume normally costs one OTP to the registered mobile.';

/* ------------------------------------------------------------------ Master Board */

export const SIMPLE_BOARD: JourneyMap = {
  id: 'simple',
  title: 'Master Board',
  caption: 'Madfu Proposed: Page 1 eligibility → identifier + mobile → internal existence check → OTP → routing → self-onboarding.',
  nodes: [
    { id: 'kyb', kind: 'screen', label: `1 · ${S(1)}`, detail: 'Type · category · revenue · channel (no URLs)', col: 0, row: 1, step: 'kyb' },
    { id: 'kyb-block', kind: 'outcome', label: 'Blocked on Page 1', detail: 'Personalised reason · no OTP, no cost', col: 0, row: 0, outcome: 'BLOCKED' },
    { id: 'id', kind: 'screen', label: 'Identifier + mobile', detail: 'CR / National ID · mobile · owner-manager or IBAN-linked question', col: 1, row: 1, step: 'identify' },
    { id: 'exist', kind: 'backend', label: 'Existing check', detail: 'Internal database · no provider call', col: 2, row: 1 },
    { id: 'otp', kind: 'screen', label: 'OTP', detail: 'New: entered mobile · existing: REGISTERED mobile (•••123)', col: 3, row: 1, step: 'otp' },
    { id: 'route', kind: 'decision', label: 'Routing', detail: 'Lifecycle status + eligibility + declaration', col: 4, row: 1 },
    { id: 'sales', kind: 'outcome', label: 'Sales lead', detail: O('SALES_LEAD'), col: 4, row: 0, outcome: 'SALES_LEAD' },
    { id: 'cr', kind: 'external', label: `New CR · 3 · ${S(3)}`, detail: 'CR data (activities, age → risk) · owners / managers · no CR page', col: 5, row: 1, step: 'persons' },
    { id: 'fl', kind: 'backend', label: 'New Freelancer', detail: 'Certificate pre-check — backend only, before Nafath', col: 5, row: 2, step: 'nafath' },
    { id: 'resume', kind: 'cached', label: 'Resume', detail: 'First unfinished stage · checks reused', col: 5, row: 3 },
    { id: 'status', kind: 'screen', label: 'Submitted → Application Progress', detail: 'Never Review / Contract again', col: 5, row: 4, step: 'status' },
    { id: 'login', kind: 'screen', label: 'Live merchant → login', detail: 'No new application', col: 5, row: 5, step: 'login' },
    { id: 'blocked', kind: 'outcome', label: 'Blocked', detail: 'Not owner / manager · IBAN not linked · personalised', col: 5, row: 6, outcome: 'BLOCKED' },
    { id: 'paused', kind: 'manual', label: 'CR expired / suspended', detail: 'Saved → Sales recovery · no Refresh, no more paid calls', col: 6, row: 0, outcome: 'PAUSED_CR' },
    { id: 'naf', kind: 'external', label: 'Mobile ↔ National ID → Nafath', detail: 'Mismatch: another mobile + OTP · then Nafath (FL: then certificate)', col: 6, row: 1, step: 'nafath' },
    { id: 'details', kind: 'screen', label: `4 · ${S(4)}`, detail: 'Website / Google Maps by channel · FL IBAN · no CR IBAN, VAT, branches', col: 7, row: 1, step: 'business' },
    { id: 'offer', kind: 'screen', label: `5 · ${S(5)}`, detail: 'Standard offer → Continue · no plan selection · rate review optional', col: 8, row: 1, step: 'commercial' },
    { id: 'review', kind: 'screen', label: `6 · ${S(6)}`, detail: 'Verified sections locked · transactional edit', col: 9, row: 1, step: 'review' },
    { id: 'contract', kind: 'screen', label: `7 · ${S(7)}`, detail: 'Agree & Submit', col: 10, row: 1, step: 'contract' },
    { id: 'submit', kind: 'outcome', label: '8 · Submitted', detail: 'Return later → Application Progress', col: 10, row: 2, step: 'outcome', outcome: 'SUBMITTED' },
    { id: 'note', kind: 'note', label: REUSE_NOTE, col: 7, row: 4 }
  ],
  edges: [
    { from: 'kyb', to: 'kyb-block', label: 'blocked' }, { from: 'kyb', to: 'id', label: 'continue' }, { from: 'id', to: 'exist' }, { from: 'exist', to: 'otp' }, { from: 'otp', to: 'route', label: 'verified' },
    { from: 'route', to: 'sales', label: 'Sales' }, { from: 'route', to: 'cr', label: 'new CR' }, { from: 'route', to: 'fl', label: 'new FL' }, { from: 'route', to: 'resume', label: 'incomplete' },
    { from: 'route', to: 'status', label: 'submitted' }, { from: 'route', to: 'login', label: 'live' }, { from: 'route', to: 'blocked', label: 'blocked' },
    { from: 'cr', to: 'paused', label: 'expired / suspended' }, { from: 'cr', to: 'naf' }, { from: 'fl', to: 'naf', label: 'certificate exists' },
    { from: 'naf', to: 'details', label: 'verified' }, { from: 'details', to: 'offer' }, { from: 'offer', to: 'review' }, { from: 'review', to: 'contract' }, { from: 'contract', to: 'submit', label: 'Agree & Submit' }
  ]
};

/* ------------------------------------------------------------------ Detailed Logic Board (panels) */

const A: JourneyMap = {
  id: 'kyb', large: true, title: `A · ${S(1)} (Page 1): preliminary eligibility`,
  caption: 'No identity, mobile, OTP or URL. The declared category is preliminary; it is replaced by the government activity once retrieved.',
  nodes: [
    { id: 'ne', kind: 'outcome', label: 'Blocked', detail: 'Blacklisted · regulatory · needs a CR · channel — personalised reason', col: 2, row: 0, outcome: 'BLOCKED' },
    { id: 'matrix', kind: 'open', label: 'PRODUCT TASK: Eligibility Matrix', detail: 'Production catalogue not defined (fixture)', col: 3, row: 0 },
    { id: 'kyb', kind: 'screen', label: S(1), detail: 'Applicant type · Category · Subcategory · Annual revenue · Sales channel', col: 0, row: 1, step: 'kyb' },
    { id: 'draft', kind: 'backend', label: 'Qualification record (KYB-…)', detail: 'Temporary until linked after OTP', col: 1, row: 1 },
    { id: 'engine', kind: 'decision', label: 'Eligibility engine', detail: `${ELIGIBILITY_RULES.length} ordered rules · allowed / blocked`, col: 2, row: 1 },
    { id: 'ok', kind: 'connector', label: '→ Page 2 (self-onboarding)', col: 4, row: 1, step: 'identify' },
    { id: 'lead', kind: 'connector', label: '→ Page 2 (Sales / no-certificate lead)', col: 2, row: 2, step: 'identify' },
    { id: 'removed', kind: 'note', label: 'Moved out of Page 1: website and Google Maps links (now Business Details). No manual-review category route.', col: 0, row: 3 }
  ],
  edges: [
    { from: 'kyb', to: 'draft' }, { from: 'draft', to: 'engine' }, { from: 'engine', to: 'ok', label: 'SELF_ONBOARDING' },
    { from: 'engine', to: 'ne', label: 'BLOCKED' }, { from: 'engine', to: 'lead', label: 'SALES_LEAD' }
  ]
};

const B: JourneyMap = {
  id: 'identify', large: true, title: 'B · Identifier + mobile, existence check, OTP and routing',
  caption: 'An internal lookup decides where the code goes. Existing records are opened only by the REGISTERED mobile; the entered mobile is never used for them. No takeover workflow.',
  nodes: [
    { id: 'throttle', kind: 'backend', label: 'Rate limit / bot challenge', detail: `${LIMITS.identifyChecksPerSession} submissions / session`, col: 0, row: 0 },
    { id: 'sales', kind: 'outcome', label: 'Sales lead', detail: 'Lead persisted · no further data', col: 5, row: 0, outcome: 'SALES_LEAD' },
    { id: 'id', kind: 'screen', label: 'Identifier + mobile', detail: 'CR or National ID · mobile · "owner / manager?" or "IBAN linked?"', col: 0, row: 1, step: 'identify' },
    { id: 'exist', kind: 'backend', label: 'Existence check', detail: 'Internal database: new · incomplete · submitted · live · paused', col: 1, row: 1 },
    { id: 'dec', kind: 'decision', label: 'Existing record?', col: 2, row: 1 },
    { id: 'otpn', kind: 'screen', label: 'OTP → entered mobile', detail: `contact_mobile_verified · ${LIMITS.otpAttempts} attempts, ${LIMITS.otpResends} resends`, col: 3, row: 1, step: 'otp' },
    { id: 'route', kind: 'decision', label: 'Create application + route', detail: 'Eligibility + declaration', col: 4, row: 1 },
    { id: 'crn', kind: 'connector', label: '→ C · New registered business', col: 5, row: 1, step: 'persons' },
    { id: 'fln', kind: 'connector', label: '→ D · New Freelancer', col: 5, row: 2, step: 'nafath' },
    { id: 'otpr', kind: 'screen', label: 'OTP → REGISTERED mobile', detail: '"Code sent to the registered mobile ending •••123" · also the Continue link', col: 2, row: 3, step: 'otp' },
    { id: 'deny', kind: 'outcome', label: 'Code not completed', detail: 'No access · nothing exposed · no new application', col: 3, row: 3 },
    { id: 'blk', kind: 'outcome', label: 'Blocked', detail: 'Not owner / manager · IBAN not linked (personalised)', col: 5, row: 3, outcome: 'BLOCKED' },
    { id: 'resume', kind: 'cached', label: 'DRAFT → resume', detail: 'First unfinished stage · checks reused', col: 0, row: 4 },
    { id: 'life', kind: 'decision', label: 'Lifecycle status', detail: 'Status + outcome, then completion', col: 2, row: 4 },
    { id: 'login', kind: 'screen', label: 'Live → merchant login', col: 3, row: 4, step: 'login' },
    { id: 'fll', kind: 'outcome', label: 'Certificate required (lead)', detail: 'Freelancer without certificate', col: 5, row: 4, outcome: 'FL_CERT_REQUIRED' },
    { id: 'paused', kind: 'manual', label: 'PAUSED_CR', detail: 'Sales follow-up message', col: 1, row: 5, outcome: 'PAUSED_CR' },
    { id: 'status', kind: 'screen', label: 'Submitted → Application Progress', col: 2, row: 5, step: 'status' }
  ],
  edges: [
    { from: 'id', to: 'throttle', dashed: true }, { from: 'id', to: 'exist' }, { from: 'exist', to: 'dec' }, { from: 'dec', to: 'otpn', label: 'new' }, { from: 'otpn', to: 'route', label: 'verified' },
    { from: 'route', to: 'sales', label: 'Sales' }, { from: 'route', to: 'crn', label: 'CR' }, { from: 'route', to: 'fln', label: 'FL' }, { from: 'route', to: 'blk', label: 'No' }, { from: 'route', to: 'fll', label: 'no cert' },
    { from: 'dec', to: 'otpr', label: 'existing' }, { from: 'otpr', to: 'deny', label: 'failed', dashed: true }, { from: 'otpr', to: 'life', label: 'verified' },
    { from: 'life', to: 'resume', label: 'DRAFT' }, { from: 'life', to: 'paused', label: 'paused' }, { from: 'life', to: 'status', label: 'submitted' }, { from: 'life', to: 'login', label: 'live' }
  ]
};

const C: JourneyMap = {
  id: 'cr', large: true, title: `C · ${S(3)}: registered business`,
  caption: 'CR data and owners / managers are retrieved in the backend once and reused. The merchant sees a screen only when they must act. CR age feeds the risk score; it never rejects.',
  nodes: [
    { id: 'crc', kind: 'cached', label: 'Stored CR data', detail: 'Reused on resume', col: 1, row: 0 },
    { id: 'paused', kind: 'manual', label: 'Expired / suspended', detail: O('PAUSED_CR'), col: 2, row: 0, outcome: 'PAUSED_CR' },
    { id: 'risk', kind: 'backend', label: 'Risk score (synthetic)', detail: 'CR age · entity · address · revenue · category — never a block', col: 3, row: 0 },
    { id: 'start', kind: 'connector', label: 'From routing: new CR (DRAFT)', col: 0, row: 1 },
    { id: 'cr', kind: 'external', label: 'CR data', detail: 'Status · age · activities (several) · National Address · entity', col: 1, row: 1, step: 'persons' },
    { id: 'gov', kind: 'decision', label: 'CR status (hard rule)', col: 2, row: 1 },
    { id: 'cat', kind: 'backend', label: 'Activities → verified category', detail: 'Government wins · prices the offer', col: 3, row: 1 },
    { id: 'ppl', kind: 'external', label: 'Owners / managers', detail: 'Individuals only; delegates out of V1', col: 4, row: 1 },
    { id: 'pick', kind: 'screen', label: 'Select owner / manager', detail: 'Masked names · role · single choice', col: 5, row: 1, step: 'persons' },
    { id: 'next', kind: 'connector', label: '→ E · Mobile ↔ National ID + Nafath', col: 6, row: 1, step: 'nafath' },
    { id: 'unav', kind: 'screen', label: 'Provider unavailable', detail: `Retry (${LIMITS.providerRetries}/session) · Save & exit · reset on resume`, col: 1, row: 2, step: 'persons' },
    { id: 'reg', kind: 'outcome', label: 'Blocked', detail: 'Regulated activity', col: 3, row: 2, outcome: 'BLOCKED' },
    { id: 'none', kind: 'outcome', label: 'Blocked', detail: 'No owner / manager: declaration not confirmed', col: 4, row: 2, outcome: 'BLOCKED' },
    { id: 'od-map', kind: 'open', label: 'PRODUCT TASK: activity mapping', col: 0, row: 3 },
    { id: 'od-multi', kind: 'open', label: 'Multi-activity reconciliation', col: 1, row: 3 },
    { id: 'od-hard', kind: 'open', label: 'Hard-block inventory', col: 2, row: 3 },
    { id: 'od-risk', kind: 'open', label: 'Risk weights / thresholds', col: 3, row: 3 }
  ],
  edges: [
    { from: 'start', to: 'cr' }, { from: 'cr', to: 'crc', dashed: true }, { from: 'cr', to: 'unav', label: 'unavailable', dashed: true }, { from: 'cr', to: 'gov' },
    { from: 'gov', to: 'paused', label: 'expired / suspended' }, { from: 'gov', to: 'cat', label: 'active' }, { from: 'cat', to: 'risk', dashed: true }, { from: 'cat', to: 'reg', label: 'regulated' },
    { from: 'cat', to: 'ppl' }, { from: 'ppl', to: 'none', label: 'none' }, { from: 'ppl', to: 'pick', label: 'found' }, { from: 'pick', to: 'next', label: 'Continue' }
  ]
};

const D: JourneyMap = {
  id: 'fl', large: true, title: `D · ${S(3)}: Freelancer`,
  caption: `Cost order (rule flag ${RULE_FLAGS.flCertificatePrecheckBeforeNafath ? 'ON' : 'OFF'}): the backend checks that a certificate exists BEFORE Nafath, silently. The applicant still sees Nafath → certificate; no certificate detail is shown before Nafath.`,
  nodes: [
    { id: 'none', kind: 'outcome', label: 'Certificate required', detail: 'No certificate: lead, NO Nafath call', col: 1, row: 0, outcome: 'FL_CERT_REQUIRED' },
    { id: 'certc', kind: 'cached', label: 'Pre-check result reused', detail: 'Details shown now, no new call', col: 4, row: 0 },
    { id: 'blk', kind: 'outcome', label: 'Blocked', detail: 'Certificate activity requires a CR', col: 5, row: 0, outcome: 'BLOCKED' },
    { id: 'start', kind: 'connector', label: 'From routing: new Freelancer (DRAFT)', col: 0, row: 1 },
    { id: 'pre', kind: 'external', label: 'Certificate pre-check', detail: 'Backend only · by National ID', col: 1, row: 1, step: 'nafath' },
    { id: 'naf', kind: 'connector', label: '→ E · Mobile ↔ National ID + Nafath', col: 2, row: 1 },
    { id: 'back', kind: 'connector', label: 'From E: Nafath verified', col: 3, row: 1 },
    { id: 'sel', kind: 'screen', label: 'Select certificate', detail: 'Expired / already linked cannot be selected', col: 4, row: 1, step: 'certificates' },
    { id: 'rec', kind: 'decision', label: 'Certificate activity → verified category', col: 5, row: 1 },
    { id: 'next', kind: 'connector', label: '→ F · Business Details', col: 6, row: 1, step: 'business' },
    { id: 'unav', kind: 'screen', label: 'Service unavailable', detail: 'Retry later; no Nafath yet', col: 1, row: 2, step: 'nafath' },
    { id: 'od', kind: 'open', label: 'PROVIDER / COMPLIANCE: pre-check before Nafath permitted?', col: 0, row: 3 },
    { id: 'cost', kind: 'note', label: 'Product assumption: certificate ≈ SAR 9, Nafath ≈ SAR 6. No certificate → ≈ SAR 9 instead of ≈ SAR 15.', col: 2, row: 3 }
  ],
  edges: [
    { from: 'start', to: 'pre' }, { from: 'pre', to: 'none', label: 'none' }, { from: 'pre', to: 'unav', label: 'unavailable', dashed: true }, { from: 'pre', to: 'naf', label: 'exists' },
    { from: 'back', to: 'sel' }, { from: 'sel', to: 'certc', dashed: true }, { from: 'sel', to: 'rec' }, { from: 'rec', to: 'blk', label: 'needs CR' }, { from: 'rec', to: 'next', label: 'continue' }
  ]
};

const E: JourneyMap = {
  id: 'nafath', large: true, title: 'E · Mobile ↔ National ID, then Nafath (registered business and Freelancer)',
  caption: 'Send to Nafath first confirms that the verified mobile belongs to the verifying person (authorized_person_mobile_verified). A mismatch never restarts onboarding: CR data, eligibility, selection and progress are kept.',
  nodes: [
    { id: 'tech', kind: 'backend', label: 'Technical failure', detail: `No attempt used · ${LIMITS.nafathTechnicalRetries} / session`, col: 2, row: 0 },
    { id: 'nafc', kind: 'cached', label: 'Nafath verified', detail: 'Reused on resume; person locked', col: 3, row: 0 },
    { id: 'send', kind: 'screen', label: 'Send to Nafath', detail: 'Selected owner / manager, or the Freelancer', col: 0, row: 1, step: 'nafath' },
    { id: 'mm', kind: 'external', label: 'Mobile ↔ National ID', detail: `${LIMITS.mobileMatchChecks} checks / application`, col: 1, row: 1 },
    { id: 'naf', kind: 'external', label: 'Nafath', detail: `${LIMITS.nafathAttempts} attempts / application`, col: 3, row: 1 },
    { id: 'ok', kind: 'connector', label: '→ CR: F · Business Details · FL: D · certificate', col: 5, row: 1, step: 'business' },
    { id: 'mis', kind: 'screen', label: 'Mismatch', detail: '"The mobile number must belong to the selected owner or manager." · Use another mobile number', col: 1, row: 2, step: 'nafath' },
    { id: 'otp', kind: 'screen', label: 'OTP → new mobile', detail: 'Becomes the registered mobile', col: 2, row: 2, step: 'otp' },
    { id: 'fail', kind: 'screen', label: 'Rejected / timed out', detail: 'Retry while attempts remain', col: 3, row: 2, step: 'nafath' },
    { id: 'ex', kind: 'manual', label: 'Failed twice', detail: 'CR: details collected, no contract · FL: manual verification', col: 4, row: 2, outcome: 'SUBMITTED_MANUAL' },
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
  caption: 'Store presence for the channel declared on Page 1 (fraud / presence evidence). Google Maps = actual selling branch, not the National Address. Freelancers verify the IBAN linkage.',
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
  id: 'commercial', large: true, title: `G · ${S(5)}`,
  caption: 'Your Standard Offer → Continue. The rate comes from the VERIFIED category. A better-rate review is optional, collapsed and low-priority; the interest is kept even with no file.',
  nodes: [
    { id: 'removed', kind: 'note', label: 'Removed: payment-plan selection (3 / 4 / 6 / 9 / 12 months) — configured later in the Merchant Portal.', col: 0, row: 0 },
    { id: 'page', kind: 'screen', label: 'Your Standard Offer', detail: 'One commission · short explanation · Continue', col: 0, row: 1, step: 'commercial' },
    { id: 'price', kind: 'backend', label: 'Pricing matrix', detail: 'Verified (government-mapped) category', col: 1, row: 1 },
    { id: 'next', kind: 'connector', label: `→ H · ${S(6)}`, col: 3, row: 1, step: 'review' },
    { id: 'ask', kind: 'screen', label: '"Want us to review a better rate?"', detail: 'Collapsed link under the offer', col: 0, row: 2, step: 'commercial' },
    { id: 'req', kind: 'backend', label: 'Request rate review', detail: 'COMMERCIAL_RATE_REVIEW_REQUESTED · no file needed', col: 1, row: 2 },
    { id: 'files', kind: 'screen', label: 'Optional evidence', detail: 'Shown only after the request', col: 2, row: 2, step: 'commercial' },
    { id: 'rev', kind: 'manual', label: 'Commercial rate review', detail: 'Never blocks; standard rate applies', col: 3, row: 2 },
    { id: 'od-p', kind: 'open', label: 'PRODUCT TASK: Pricing matrix', col: 0, row: 3 },
    { id: 'od-e', kind: 'open', label: 'COMMERCIAL: evidence for a better rate', col: 1, row: 3 }
  ],
  edges: [
    { from: 'page', to: 'price' }, { from: 'price', to: 'next', label: 'Continue' }, { from: 'page', to: 'ask', dashed: true }, { from: 'ask', to: 'req', label: 'Request rate review' },
    { from: 'req', to: 'files', dashed: true }, { from: 'files', to: 'rev' }
  ]
};

const H: JourneyMap = {
  id: 'review', large: true, title: `H · ${S(6)}: locked sections, transactional edit`,
  caption: 'Verified and sensitive sections are locked. Only store presence and the rate-review request can be edited: changes stay in a draft until Save; Cancel restores the whole application; nothing is invalidated before Save.',
  nodes: [
    { id: 'locked', kind: 'cached', label: 'Locked', detail: 'Type · identifier · category · government data · owner / manager · mobile · certificate · FL IBAN', col: 1, row: 0 },
    { id: 'review', kind: 'screen', label: S(6), detail: 'Applicant · verified identity · store presence · status · banking (FL) · offer', col: 0, row: 1, step: 'review' },
    { id: 'edit', kind: 'decision', label: 'Editable section?', detail: 'Store presence · rate review', col: 1, row: 1 },
    { id: 'draft', kind: 'backend', label: 'Draft copy', detail: 'Nothing applied yet', col: 2, row: 1 },
    { id: 'save', kind: 'backend', label: 'Save', detail: 'Apply · invalidate dependants only (none here)', col: 3, row: 1 },
    { id: 'back', kind: 'connector', label: `→ back to ${S(6)}`, col: 4, row: 1 },
    { id: 'cancel', kind: 'backend', label: 'Cancel', detail: 'Restore the whole application', col: 2, row: 2 }
  ],
  edges: [
    { from: 'review', to: 'locked', dashed: true }, { from: 'review', to: 'edit', label: 'Edit' }, { from: 'edit', to: 'draft', label: 'yes' }, { from: 'draft', to: 'save' }, { from: 'save', to: 'back' },
    { from: 'draft', to: 'cancel', label: 'Cancel' }, { from: 'cancel', to: 'back', dashed: true }
  ]
};

const I: JourneyMap = {
  id: 'contract', large: true, title: `I · ${S(7)}, submission and Application Progress`,
  caption: 'One action: Agree & Submit records acceptance and submits. A submitted application opens Application Progress — never Review, Contract or a second submission. No activation is claimed before it happens.',
  nodes: [
    { id: 'dec', kind: 'outcome', label: 'Contract declined', detail: 'Still a draft; resumable', col: 2, row: 0, outcome: 'CONTRACT_DECLINED' },
    { id: 'review', kind: 'screen', label: S(6), col: 0, row: 1, step: 'review' },
    { id: 'gate', kind: 'decision', label: 'Contract gate', detail: 'Nafath · mobile ownership · owner (CR) · certificate + IBAN (FL)', col: 1, row: 1 },
    { id: 'contract', kind: 'screen', label: S(7), detail: 'Standard commission as Schedule 1 · Agree & Submit', col: 2, row: 1, step: 'contract' },
    { id: 'sub', kind: 'outcome', label: 'Submitted', detail: O('SUBMITTED'), col: 3, row: 1, step: 'outcome', outcome: 'SUBMITTED' },
    { id: 'status', kind: 'screen', label: 'Application Progress', detail: 'Return later with the registered-mobile code', col: 4, row: 1, step: 'status' },
    { id: 'login', kind: 'screen', label: 'Live → login', col: 5, row: 1, step: 'login' },
    { id: 'mv', kind: 'manual', label: 'Submitted for manual verification', detail: O('SUBMITTED_MANUAL'), col: 1, row: 2, outcome: 'SUBMITTED_MANUAL' },
    { id: 'states', kind: 'backend', label: 'Statuses', detail: 'Submitted · Under review · Action required · Approved · Unable to proceed', col: 4, row: 2 },
    { id: 'od', kind: 'open', label: 'OPERATIONS: final status lifecycle / SLA', col: 0, row: 3 }
  ],
  edges: [
    { from: 'review', to: 'gate' }, { from: 'gate', to: 'contract', label: 'pass' }, { from: 'gate', to: 'mv', label: 'blocked' }, { from: 'contract', to: 'sub', label: 'Agree & Submit' },
    { from: 'contract', to: 'dec', label: 'decline' }, { from: 'sub', to: 'status', label: 'later' }, { from: 'status', to: 'states', dashed: true }, { from: 'status', to: 'login', label: 'live', dashed: true }
  ]
};

const J: JourneyMap = {
  id: 'reuse', large: true, title: 'J · Resume, reuse, invalidation and freshness',
  caption: 'Ordinary resume costs one OTP to the registered mobile. Positive results are reused until a dependency changes; negative and technical results follow a policy per result type.',
  nodes: [
    { id: 'fresh', kind: 'open', label: 'Freshness policy per verification', detail: 'Open: reusable until invalidated', col: 1, row: 0 },
    { id: 'in', kind: 'screen', label: 'Registered-mobile OTP', detail: 'Page 2 re-entry or Continue link', col: 0, row: 1, step: 'otp' },
    { id: 'reuse', kind: 'cached', label: 'Valid checks reused', detail: 'CR · owners · mobile match · Nafath · certificate · IBAN', col: 1, row: 1 },
    { id: 'first', kind: 'connector', label: 'First unfinished stage', col: 2, row: 1 },
    { id: 'neg', kind: 'backend', label: 'Negative results', detail: 'Outage: retry, counters reset per session · expired CR: Sales only · CR age: re-scored', col: 1, row: 2 },
    { id: 'inv', kind: 'backend', label: 'Invalidation', detail: 'Mobile → match · certificate → IBAN · IBAN → IBAN only', col: 2, row: 2 }
  ],
  edges: [{ from: 'in', to: 'reuse' }, { from: 'reuse', to: 'first' }, { from: 'reuse', to: 'fresh', dashed: true }, { from: 'reuse', to: 'neg', dashed: true }, { from: 'neg', to: 'inv', dashed: true }],
  notes: [REUSE_NOTE]
};

export const DETAILED_BOARD: JourneyMap[] = [A, B, C, D, E, F, G, H, I, J];
export const ALL_BOARDS: JourneyMap[] = [SIMPLE_BOARD, ...DETAILED_BOARD];

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
