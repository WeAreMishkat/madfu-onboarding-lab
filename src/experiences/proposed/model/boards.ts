/**
 * Simple Master Board and Detailed Master Board for Madfu Proposed, built from the same model the
 * prototype runs: stage names come from STAGES, outcome titles from OUTCOME_COPY, rule counts from the
 * rule modules. Nodes reference step ids and outcome kinds so tests can prove the boards and the
 * prototype describe the same journey.
 */
import { MAPPING_ACTION } from './activity';
import { LIMITS, RULE_FLAGS, STAGES } from './config';
import { OUTCOME_COPY } from './copy';
import { ELIGIBILITY_RULES } from './eligibility';
import { GOV_RULES } from './government';
import { BASE_PLANS, OPTIONAL_PLANS } from './pricing';
import type { OutcomeKind, StepId } from './types';

export type NodeKind = 'screen' | 'decision' | 'backend' | 'external' | 'cached' | 'manual' | 'outcome' | 'open' | 'note' | 'connector';

export interface MapNode {
  id: string;
  kind: NodeKind;
  label: string;
  /** Second line: fields, rule or detail (detailed board). */
  detail?: string;
  col: number;
  row: number;
  step?: StepId;
  outcome?: OutcomeKind;
}
export interface MapEdge { from: string; to: string; label?: string; dashed?: boolean }
export interface JourneyMap { id: string; title: string; caption: string; nodes: MapNode[]; edges: MapEdge[]; large?: boolean; notes?: string[] }

export const NODE_KIND_LABEL: Record<Exclude<NodeKind, 'connector' | 'note'>, string> = {
  screen: 'User-facing page',
  decision: 'Backend decision',
  backend: 'Internal backend step',
  external: 'External provider check',
  cached: 'Cached / reused verification',
  manual: 'Manual route',
  outcome: 'Final outcome',
  open: 'Open product / compliance decision'
};

const S = (n: number) => STAGES[n - 1].label;
const O = (k: OutcomeKind) => OUTCOME_COPY[k].title;
export const REUSE_NOTE = 'Previously verified CR / Nafath / IBAN data is reused. Resume normally triggers OTP only.';

/* ------------------------------------------------------------------ Simple Master Board */

export const SIMPLE_BOARD: JourneyMap = {
  id: 'simple',
  title: 'Simple Master Board',
  caption: 'Madfu Proposed self-onboarding: ask cheaply first, verify expensively later, never ask twice.',
  nodes: [
    { id: 'kyb', kind: 'screen', label: `1 · ${S(1)}`, detail: 'Type · category · revenue · channel · URL', col: 0, row: 1, step: 'kyb' },
    { id: 'elig', kind: 'decision', label: 'Eligibility', detail: 'Internal, no provider cost', col: 1, row: 1 },
    { id: 'id', kind: 'screen', label: `2 · ${S(2)}`, detail: 'CR / National ID + mobile + OTP', col: 2, row: 1, step: 'identify' },
    { id: 'ver', kind: 'external', label: `3 · ${S(3)}`, detail: 'Government data · Nafath · certificate', col: 3, row: 1, step: 'cr-verify' },
    { id: 'bank', kind: 'screen', label: `4 · ${S(4)}`, detail: 'Only what is still missing + IBAN', col: 4, row: 1, step: 'business' },
    { id: 'offer', kind: 'screen', label: `5 · ${S(5)}`, detail: `Standard commission · ${BASE_PLANS.join('/')} included · ${OPTIONAL_PLANS.join('/')} optional`, col: 5, row: 1, step: 'commercial' },
    { id: 'review', kind: 'screen', label: `6 · ${S(6)}`, detail: 'Full summary + Edit', col: 6, row: 1, step: 'review' },
    { id: 'contract', kind: 'screen', label: `7 · ${S(7)}`, detail: 'Contract only', col: 7, row: 1, step: 'contract' },
    { id: 'submit', kind: 'outcome', label: `8 · ${S(8)}`, detail: O('SUBMITTED'), col: 8, row: 1, step: 'outcome', outcome: 'SUBMITTED' },

    { id: 'notelig', kind: 'outcome', label: 'Not eligible', detail: 'Stopped before any external cost', col: 1, row: 0, outcome: 'NOT_ELIGIBLE' },
    { id: 'leadscr', kind: 'screen', label: 'Lead contact + OTP', detail: 'KYB answers kept', col: 1, row: 2, step: 'lead' },
    { id: 'fllead', kind: 'outcome', label: 'Freelancer without certificate → Lead', detail: 'Saved; team may contact', col: 2, row: 2, outcome: 'FL_CERT_REQUIRED' },
    { id: 'saleslead', kind: 'outcome', label: 'CR revenue → Sales route', detail: 'Sales / Business Team follow-up', col: 0, row: 2, outcome: 'SALES_LEAD' },
    { id: 'manual', kind: 'manual', label: 'Manual verification', detail: 'Government status · Nafath failed', col: 3, row: 2, outcome: 'MANUAL_VERIFICATION' },
    { id: 'banking', kind: 'manual', label: 'Banking setup required', detail: 'Freelancer bank not linked: continue', col: 4, row: 2, outcome: 'SUBMITTED_BANKING_PENDING' },

    { id: 'link', kind: 'screen', label: 'Resume link', detail: 'Continue Application SMS', col: 5, row: 3 },
    { id: 'rotp', kind: 'screen', label: 'OTP', detail: 'Identity + mobile known', col: 6, row: 3, step: 'otp' },
    { id: 'last', kind: 'cached', label: 'Last valid stage', detail: 'Verified checks reused', col: 7, row: 3 },
    { id: 'note', kind: 'note', label: REUSE_NOTE, col: 0, row: 3 }
  ],
  edges: [
    { from: 'kyb', to: 'elig' }, { from: 'elig', to: 'id', label: 'eligible' }, { from: 'id', to: 'ver', label: 'verified' },
    { from: 'ver', to: 'bank' }, { from: 'bank', to: 'offer' }, { from: 'offer', to: 'review' }, { from: 'review', to: 'contract' }, { from: 'contract', to: 'submit', label: 'accept' },
    { from: 'elig', to: 'notelig', label: 'not eligible' }, { from: 'elig', to: 'leadscr', label: 'lead' }, { from: 'leadscr', to: 'fllead', label: 'no certificate' }, { from: 'leadscr', to: 'saleslead', label: 'CR revenue' },
    { from: 'ver', to: 'manual', label: 'manual' }, { from: 'bank', to: 'banking', label: 'not linked', dashed: true },
    { from: 'link', to: 'rotp' }, { from: 'rotp', to: 'last', label: 'verified' }
  ]
};

/* ------------------------------------------------------------------ Detailed Master Board (panels) */

const A: JourneyMap = {
  id: 'kyb', large: true, title: `A · ${S(1)} and eligibility`,
  caption: 'First page. No CR, National ID, mobile or OTP. Eligibility is evaluated internally before any paid verification.',
  nodes: [
    { id: 'kyb', kind: 'screen', label: S(1), detail: 'Applicant type · Category · Subcategory · Annual revenue · Sales channel', col: 0, row: 1, step: 'kyb' },
    { id: 'urls', kind: 'backend', label: 'URL validation (configurable)', detail: 'Online/Both: website (no social, no WhatsApp) · Offline/Both: Google Maps', col: 1, row: 1 },
    { id: 'draft', kind: 'backend', label: 'Qualification record (KYB-…)', detail: 'Temporary until linked after OTP', col: 2, row: 1 },
    { id: 'engine', kind: 'decision', label: 'Eligibility engine', detail: `${ELIGIBILITY_RULES.length} ordered rules`, col: 3, row: 1 },
    { id: 'ok', kind: 'connector', label: `Eligible → ${S(2)}`, col: 5, row: 1, step: 'identify' },
    { id: 'mr', kind: 'manual', label: 'Manual-review category', detail: 'Continue, internal flag', col: 5, row: 2 },
    { id: 'ne', kind: 'outcome', label: 'Not eligible / temporarily not eligible', detail: 'Blocked · regulatory · CR required · channel · paused', col: 3, row: 0, outcome: 'NOT_ELIGIBLE' },
    { id: 'lead', kind: 'screen', label: 'Lead contact', detail: 'Name · mobile', col: 3, row: 3, step: 'lead' },
    { id: 'lotp', kind: 'screen', label: 'SMS OTP (lead)', col: 4, row: 3, step: 'otp' },
    { id: 'sl', kind: 'outcome', label: 'Sales lead', detail: O('SALES_LEAD'), col: 5, row: 3, outcome: 'SALES_LEAD' },
    { id: 'flc', kind: 'outcome', label: 'Certificate required (lead)', detail: O('FL_CERT_REQUIRED'), col: 5, row: 4, outcome: 'FL_CERT_REQUIRED' },
    { id: 'matrix', kind: 'open', label: 'PRODUCT TASK: Eligibility Matrix', detail: 'Production catalogue not defined (fixture)', col: 1, row: 3 }
  ],
  edges: [
    { from: 'kyb', to: 'urls' }, { from: 'urls', to: 'draft', label: 'valid' }, { from: 'draft', to: 'engine' },
    { from: 'engine', to: 'ok', label: 'ELIGIBLE' }, { from: 'engine', to: 'mr', label: 'MANUAL_REVIEW' }, { from: 'mr', to: 'ok', dashed: true },
    { from: 'engine', to: 'ne', label: 'NOT_ELIGIBLE / TEMPORARY' },
    { from: 'engine', to: 'lead', label: 'SALES_LEAD' }, { from: 'lead', to: 'lotp' }, { from: 'lotp', to: 'sl', label: 'CR revenue' }, { from: 'lotp', to: 'flc', label: 'no certificate' }
  ]
};

const B: JourneyMap = {
  id: 'identify', large: true, title: `B · ${S(2)}, duplicates and resume`,
  caption: 'Identity after eligibility. The Continue link identifies the application; OTP authorises it. Resume goes to the first incomplete screen.',
  nodes: [
    { id: 'id', kind: 'screen', label: 'Identification', detail: 'CR: CR / Unified Number + mobile · FL: National ID + mobile', col: 0, row: 1, step: 'identify' },
    { id: 'dup', kind: 'backend', label: 'Duplicate / existing checks', detail: 'Merchant · application (same / other mobile) · mobile association', col: 1, row: 1 },
    { id: 'otp', kind: 'screen', label: 'SMS OTP', detail: `${LIMITS.otpAttempts} attempts · resend · edit mobile`, col: 2, row: 1, step: 'otp' },
    { id: 'res', kind: 'decision', label: 'Identity result', col: 3, row: 1 },
    { id: 'em', kind: 'outcome', label: 'Existing merchant', detail: 'No new application', col: 2, row: 0, outcome: 'EXISTING_MERCHANT' },
    { id: 'dupo', kind: 'outcome', label: 'Duplicate identity', detail: 'Other mobile · no new application', col: 3, row: 2, outcome: 'DUPLICATE_IDENTITY' },
    { id: 'create', kind: 'backend', label: 'Create application + link KYB', detail: 'Snapshot, eligibility result, reason, ruleset, timestamp', col: 4, row: 1 },
    { id: 'st3', kind: 'connector', label: `→ ${S(3)}`, col: 5, row: 1, step: 'cr-verify' },
    { id: 'saved', kind: 'cached', label: 'Saved application reopened', detail: 'Same identity + same mobile', col: 4, row: 0 },
    { id: 'exit', kind: 'screen', label: 'Save & exit', detail: 'Any stage after OTP', col: 0, row: 3 },
    { id: 'sms', kind: 'backend', label: 'Continue Application link', detail: 'Sent to the verified mobile', col: 1, row: 3 },
    { id: 'open', kind: 'screen', label: 'Link opened → OTP', detail: 'Application context, masked mobile + ID', col: 2, row: 3, step: 'otp' },
    { id: 'reuse', kind: 'cached', label: 'Reuse verified checks', detail: 'CR · people · Nafath · certificates · IBAN', col: 3, row: 3 },
    { id: 'last', kind: 'connector', label: '→ First incomplete screen', col: 4, row: 3 }
  ],
  edges: [
    { from: 'id', to: 'dup' }, { from: 'dup', to: 'otp' }, { from: 'otp', to: 'res', label: 'verified' },
    { from: 'res', to: 'em', label: 'merchant' }, { from: 'res', to: 'dupo', label: 'other mobile' }, { from: 'res', to: 'create', label: 'new' }, { from: 'res', to: 'saved', label: 'same mobile' },
    { from: 'create', to: 'st3' }, { from: 'saved', to: 'st3', dashed: true },
    { from: 'exit', to: 'sms' }, { from: 'sms', to: 'open' }, { from: 'open', to: 'reuse', label: 'verified' }, { from: 'reuse', to: 'last' }
  ],
  notes: [REUSE_NOTE]
};

const C1: JourneyMap = {
  id: 'cr', large: true, title: `C1 · ${S(3)}: Registered business`,
  caption: `Government data is retrieved once and reused. CR ${GOV_RULES.minCrAgeMonths} months or younger: temporarily not eligible. Declared category is reconciled with the registered activity.`,
  nodes: [
    { id: 'flags', kind: 'backend', label: 'Non-blocking flags', detail: 'Additional documents later · National Address', col: 0, row: 0 },
    { id: 'cr', kind: 'external', label: 'CR data retrieval', detail: 'Status · age · entity · activities · National Address', col: 0, row: 1, step: 'cr-verify' },
    { id: 'crc', kind: 'cached', label: 'Stored CR data', detail: 'Reused on resume / edit', col: 0, row: 2 },
    { id: 'tne', kind: 'outcome', label: 'Temporarily not eligible', detail: `CR ≤ ${GOV_RULES.minCrAgeMonths} months`, col: 1, row: 0, outcome: 'TEMPORARILY_NOT_ELIGIBLE' },
    { id: 'gov', kind: 'decision', label: 'Government rules', detail: 'Status, then age', col: 1, row: 1 },
    { id: 'mv', kind: 'manual', label: 'Manual verification', detail: 'Expired · government violation', col: 1, row: 2, outcome: 'MANUAL_VERIFICATION' },
    { id: 'ne', kind: 'outcome', label: 'Not eligible', detail: 'Suspended · regulated activity', col: 2, row: 0, outcome: 'NOT_ELIGIBLE' },
    { id: 'act', kind: 'decision', label: 'Category ↔ CR activity', detail: 'Mapping outcome → action', col: 2, row: 1 },
    { id: 'clar', kind: 'screen', label: 'Activity clarification', detail: 'Change category, or continue: team confirms, no contract', col: 2, row: 2, step: 'cr-verify' },
    { id: 'ppl', kind: 'external', label: 'Associated people', detail: 'Individuals only', col: 3, row: 1 },
    { id: 'pick', kind: 'screen', label: 'Select authorised person', detail: 'Masked names and IDs', col: 4, row: 1, step: 'persons' },
    { id: 'none', kind: 'manual', label: 'No eligible individual', detail: 'Manual authority check → Business & Banking, no contract', col: 4, row: 2 },
    { id: 'nafc', kind: 'cached', label: 'Nafath verified', detail: 'Not requested again on resume', col: 5, row: 0 },
    { id: 'mobdec', kind: 'open', label: 'Open decision (not implemented)', detail: 'Handling when the OTP-verified mobile does not match the selected person’s National ID', col: 4, row: 0 },
    { id: 'naf', kind: 'external', label: 'Nafath', detail: `${LIMITS.nafathAttempts} attempts per application, shared`, col: 5, row: 1, step: 'nafath' },
    { id: 'nfail', kind: 'manual', label: 'Failed twice', detail: 'Unverified; details collected; no contract', col: 5, row: 2 },
    { id: 'next', kind: 'connector', label: `→ ${S(4)}`, col: 6, row: 1, step: 'business' },
    { id: 'map', kind: 'open', label: 'PRODUCT TASK: Category ↔ CR activity mapping', col: 0, row: 3 },
    { id: 'inv', kind: 'open', label: 'PRODUCT TASK: Decision & Validation Inventory', col: 1, row: 3 },
    { id: 'acts', kind: 'note', label: Object.entries(MAPPING_ACTION).map(([o, a]) => `${o} → ${a}`).join(' · '), col: 3, row: 3 }
  ],
  edges: [
    { from: 'cr', to: 'gov' }, { from: 'cr', to: 'crc', dashed: true }, { from: 'cr', to: 'flags', dashed: true },
    { from: 'gov', to: 'tne', label: 'age' }, { from: 'gov', to: 'mv', label: 'expired / violation' }, { from: 'gov', to: 'act', label: 'active' },
    { from: 'act', to: 'ne', label: 'regulated' }, { from: 'act', to: 'clar', label: 'CONFLICT' }, { from: 'act', to: 'ppl', label: 'continue' },
    { from: 'ppl', to: 'pick' }, { from: 'ppl', to: 'none', label: 'none' },
    { from: 'pick', to: 'naf' }, { from: 'naf', to: 'nafc', dashed: true }, { from: 'naf', to: 'next', label: 'verified' }, { from: 'naf', to: 'nfail', label: 'failed twice' },
    { from: 'nfail', to: 'next', dashed: true }
  ]
};

const C2: JourneyMap = {
  id: 'fl', large: true, title: `C2 · ${S(3)}: Freelancer`,
  caption: 'Nafath on the National ID, then the certificates are retrieved (never uploaded). Zero documents.',
  nodes: [
    { id: 'naf', kind: 'external', label: 'Nafath (National ID)', detail: `${LIMITS.nafathAttempts} attempts`, col: 0, row: 1, step: 'nafath' },
    { id: 'nafc', kind: 'cached', label: 'Nafath verified', detail: 'Reused on resume', col: 0, row: 2 },
    { id: 'mv', kind: 'manual', label: 'Manual verification', detail: 'Nafath failed twice', col: 0, row: 0, outcome: 'MANUAL_VERIFICATION' },
    { id: 'certs', kind: 'external', label: 'Certificate retrieval', detail: 'By verified National ID', col: 1, row: 1 },
    { id: 'certc', kind: 'cached', label: 'Stored certificates', detail: 'Not re-fetched on resume', col: 1, row: 2 },
    { id: 'none', kind: 'outcome', label: 'Certificate required', detail: 'No active certificate: lead, no upload', col: 1, row: 0, outcome: 'FL_CERT_REQUIRED' },
    { id: 'sel', kind: 'screen', label: 'Select certificate', detail: 'Expired / already linked cannot be selected', col: 2, row: 1, step: 'certificates' },
    { id: 'rec', kind: 'decision', label: 'Certificate activity ↔ category', detail: 'CR required → stop · conflict → clarify', col: 3, row: 1 },
    { id: 'ne', kind: 'outcome', label: 'Not eligible', detail: 'Activity requires a CR', col: 3, row: 0, outcome: 'NOT_ELIGIBLE' },
    { id: 'next', kind: 'connector', label: `→ ${S(4)}`, col: 4, row: 1, step: 'business' }
  ],
  edges: [
    { from: 'naf', to: 'certs', label: 'verified' }, { from: 'naf', to: 'mv', label: 'failed twice' }, { from: 'naf', to: 'nafc', dashed: true },
    { from: 'certs', to: 'sel', label: 'found' }, { from: 'certs', to: 'none', label: 'none' }, { from: 'certs', to: 'certc', dashed: true },
    { from: 'sel', to: 'rec' }, { from: 'rec', to: 'ne', label: 'CR required' }, { from: 'rec', to: 'next', label: 'continue' }
  ]
};

const D: JourneyMap = {
  id: 'banking', large: true, title: `D · ${S(4)}`,
  caption: 'Stage-1 answers are shown, not asked again. Only remaining details. IBAN ownership checked once; reused until the IBAN or its owner changes.',
  nodes: [
    { id: 'page', kind: 'screen', label: 'Business & Banking Details', detail: 'VAT · branches (offline) · channel / website / Maps read-only with Edit', col: 0, row: 1, step: 'business' },
    { id: 'type', kind: 'decision', label: 'Applicant type', col: 1, row: 1 },
    { id: 'iban', kind: 'external', label: 'IBAN ownership (business)', detail: `${LIMITS.ibanAttempts} attempts`, col: 2, row: 0 },
    { id: 'q', kind: 'screen', label: 'Bank linked to certificate?', detail: 'Yes / No', col: 2, row: 2, step: 'business' },
    { id: 'ibanfl', kind: 'external', label: 'IBAN ownership (individual + certificate)', col: 3, row: 2 },
    { id: 'skip', kind: 'manual', label: 'Banking setup required', detail: 'IBAN skipped; team follows up', col: 3, row: 3, outcome: 'SUBMITTED_BANKING_PENDING' },
    { id: 'ibanc', kind: 'cached', label: 'IBAN verified', detail: 'Same IBAN + same owner: reused', col: 3, row: 0 },
    { id: 'unv', kind: 'manual', label: 'Unverified after 2 checks', detail: 'Continue; financial review', col: 3, row: 1 },
    { id: 'next', kind: 'connector', label: `→ ${S(5)}`, col: 4, row: 1, step: 'commercial' },
    { id: 'cmp', kind: 'open', label: 'COMPLIANCE DECISION', detail: `Linked IBAN before contract? Rule flag = ${RULE_FLAGS.flLinkedIbanRequiredBeforeContract}`, col: 0, row: 3 }
  ],
  edges: [
    { from: 'page', to: 'type' }, { from: 'type', to: 'iban', label: 'CR' }, { from: 'type', to: 'q', label: 'Freelancer' },
    { from: 'q', to: 'ibanfl', label: 'yes' }, { from: 'q', to: 'skip', label: 'no' }, { from: 'iban', to: 'ibanc', label: 'verified' }, { from: 'iban', to: 'unv', label: 'failed twice' },
    { from: 'ibanfl', to: 'next' }, { from: 'ibanc', to: 'next' }, { from: 'unv', to: 'next', dashed: true }, { from: 'skip', to: 'next', dashed: true }
  ]
};

const E: JourneyMap = {
  id: 'commercial', large: true, title: `E · ${S(5)}`,
  caption: 'All commercial configuration lives here, not in the Contract. Primary path: standard offer → Continue. The better-offer question is collapsed and optional; declared revenue never lowers the commission automatically.',
  nodes: [
    { id: 'page', kind: 'screen', label: S(5), detail: 'Standard offer · included + optional plans · summary · Continue', col: 0, row: 1, step: 'commercial' },
    { id: 'price', kind: 'backend', label: 'Pricing matrix', detail: 'Category / subcategory → standard rate and plan rates', col: 1, row: 1 },
    { id: 'plans', kind: 'screen', label: 'Payment plans', detail: `${BASE_PLANS.join(' + ')} months included · ${OPTIONAL_PLANS.join(' / ')} optional multi-select`, col: 2, row: 1, step: 'commercial' },
    { id: 'ev', kind: 'screen', label: 'Better offer? (collapsed)', detail: 'Yes → optional documents · Not now → stays collapsed · never blocks', col: 1, row: 2, step: 'commercial' },
    { id: 'rev', kind: 'manual', label: 'Commercial pricing review', detail: 'Internal; onboarding does not wait', col: 2, row: 2 },
    { id: 'sum', kind: 'screen', label: 'Offer summary → Continue', col: 3, row: 1, step: 'commercial' },
    { id: 'next', kind: 'connector', label: `→ ${S(6)}`, col: 4, row: 1, step: 'review' },
    { id: 'pm', kind: 'open', label: 'PRODUCT TASK: Pricing & Commission Matrix', col: 0, row: 3 },
    { id: 'docs', kind: 'open', label: 'PRODUCT/COMMERCIAL DECISION: evidence documents', col: 1, row: 3 }
  ],
  edges: [
    { from: 'page', to: 'price' }, { from: 'price', to: 'plans' }, { from: 'page', to: 'ev', dashed: true }, { from: 'ev', to: 'rev', label: 'files added' },
    { from: 'plans', to: 'sum' }, { from: 'sum', to: 'next' }
  ]
};

const F: JourneyMap = {
  id: 'review', large: true, title: `F · ${S(6)}, Edit and dependency invalidation`,
  caption: 'Every section has Edit and returns to Review. An edit invalidates only the verification that depends on the changed field.',
  nodes: [
    { id: 'review', kind: 'screen', label: S(6), detail: 'KYB · Identification · Verified data · Banking · Offer · Plans · Verification status', col: 0, row: 2, step: 'review' },
    { id: 'web', kind: 'backend', label: 'Website / Maps / channel', detail: 'Re-validate; nothing invalidated', col: 2, row: 0 },
    { id: 'cat', kind: 'cached', label: 'Category', detail: 'Eligibility + reconciliation on stored activity; no provider call', col: 2, row: 1 },
    { id: 'iban', kind: 'external', label: 'IBAN', detail: 'Only IBAN verification invalidated', col: 2, row: 2 },
    { id: 'cr', kind: 'external', label: 'CR / National ID', detail: 'CR data · people · reconciliation · Nafath · IBAN', col: 2, row: 3 },
    { id: 'mob', kind: 'screen', label: 'Mobile', detail: 'New OTP only', col: 2, row: 4, step: 'otp' },
    { id: 'edit', kind: 'decision', label: 'Which field changed?', col: 1, row: 2 },
    { id: 'back', kind: 'connector', label: `→ back to ${S(6)}`, col: 3, row: 2 }
  ],
  edges: [
    { from: 'review', to: 'edit', label: 'Edit' }, { from: 'edit', to: 'web' }, { from: 'edit', to: 'cat' }, { from: 'edit', to: 'iban' }, { from: 'edit', to: 'cr' }, { from: 'edit', to: 'mob' },
    { from: 'web', to: 'back', dashed: true }, { from: 'cat', to: 'back', dashed: true }, { from: 'iban', to: 'back', dashed: true }, { from: 'cr', to: 'back', label: 'via Stage 3', dashed: true }, { from: 'mob', to: 'back', dashed: true }
  ]
};

const G: JourneyMap = {
  id: 'contract', large: true, title: `G · ${S(7)} and ${S(8)}`,
  caption: 'The contract page contains the contract only, with one action: Agree & Submit records acceptance and submits the application (no checkbox, no second Submit). Commission and plans are shown as contract content. Nafath is not the contract provider.',
  nodes: [
    { id: 'review', kind: 'screen', label: S(6), col: 0, row: 1, step: 'review' },
    { id: 'gate', kind: 'decision', label: 'Contract gate', detail: 'Nafath · person / certificate', col: 1, row: 1 },
    { id: 'gaten', kind: 'note', label: 'Gate: Nafath verified · authorised person (CR) or selected certificate (FL) · no unresolved activity conflict · Freelancer bank-link rule flag (compliance decision).', col: 0, row: 3 },
    { id: 'contract', kind: 'screen', label: S(7), detail: 'Read · one action: Agree & Submit · decline · no checkbox', col: 2, row: 1, step: 'contract' },
    { id: 'sub', kind: 'outcome', label: 'Submitted', detail: O('SUBMITTED'), col: 3, row: 1, step: 'outcome', outcome: 'SUBMITTED' },
    { id: 'bank', kind: 'outcome', label: 'Submitted · banking pending', detail: 'Freelancer bank not linked', col: 3, row: 2, outcome: 'SUBMITTED_BANKING_PENDING' },
    { id: 'dec', kind: 'outcome', label: 'Contract declined', detail: 'Not submitted; resumable', col: 3, row: 0, outcome: 'CONTRACT_DECLINED' },
    { id: 'mv', kind: 'manual', label: 'Manual verification', detail: O('MANUAL_VERIFICATION'), col: 1, row: 2, outcome: 'MANUAL_VERIFICATION' },
    { id: 'prov', kind: 'open', label: 'Contract provider', detail: 'Generic acceptance until a provider is approved', col: 3, row: 3 }
  ],
  edges: [
    { from: 'review', to: 'gate' }, { from: 'gate', to: 'contract', label: 'pass' }, { from: 'gate', to: 'mv', label: 'blocked' },
    { from: 'contract', to: 'sub', label: 'Agree' }, { from: 'contract', to: 'bank', label: 'FL not linked' }, { from: 'contract', to: 'dec', label: 'decline' },
    { from: 'dec', to: 'contract', dashed: true }
  ]
};

export const DETAILED_BOARD: JourneyMap[] = [A, B, C1, C2, D, E, F, G];
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
