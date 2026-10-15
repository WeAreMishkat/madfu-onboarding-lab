/**
 * Decision tables for the PDF and the in-app reference. Rows are COMPUTED from the same functions
 * the prototype runs (routing, contract gate), so the document cannot drift from the app.
 */
import { CATEGORIES, LIMITS, REVENUE_OPTIONS, REVENUE_RULE, isSelfService } from './config';
import { OUTCOME_COPY, STATUS_LABEL } from './copy';
import { contractEligible, prefill } from './state';
import type { ApplicantType, OutcomeKind } from './types';

export interface Table { id: string; title: string; note?: string; head: string[]; rows: string[][] }

const typeLabel = (t: ApplicantType) => (t === 'CR' ? 'Registered business' : 'Freelancer');

function revenueRouting(): Table {
  const rows: string[][] = [];
  for (const t of ['CR', 'FL'] as const) {
    for (const r of REVENUE_OPTIONS) rows.push([typeLabel(t), r.label, isSelfService(t, r.value) ? 'Self-onboarding' : 'Sales lead (no onboarding)']);
  }
  return {
    id: 'revenue', title: 'Revenue routing (after a successful SMS code)', head: ['Applicant', 'Annual revenue', 'Route'], rows,
    note: `Provisional boundary: exactly SAR ${REVENUE_RULE.selfServiceFromSar.toLocaleString('en-US')} is treated as self-onboarding (configurable).`
  };
}

const identityOrder: Table = {
  id: 'identity', title: 'Existing and duplicate checks (order)', head: ['Order', 'Check', 'If true'],
  rows: [
    ['1', 'CR (or National ID) belongs to an existing merchant account', 'Stop: "already has a Madfu account"; no new application'],
    ['2', 'An application exists for this CR / National ID with the same mobile', 'Resume the saved application after the SMS code'],
    ['3', 'An application exists for this CR / National ID with another mobile', 'Stop: duplicate identity; no new application'],
    ['4', 'Existing Freelancer adds another certificate', 'Future account flow (not designed)'],
    ['5', 'Mobile number already used with another CR or person', 'Not a reason to reject: same mobile may belong to several businesses']
  ]
};

function categoryTable(): Table {
  const rows = CATEGORIES.flatMap((g) => g.subs.map((s) => {
    const cr = s.classification === 'BLOCKED' ? 'Neutral confirmation; no paid checks' : s.classification === 'MANUAL_REVIEW' ? 'Continue; flag business review' : 'Continue';
    const fl = s.classification === 'BLOCKED' ? 'Neutral confirmation; no paid checks' : s.classification === 'CR_ONLY' ? 'Continue; flag CR-only category' : s.classification === 'MANUAL_REVIEW' ? 'Continue; flag business review' : 'Continue';
    return [`${g.label} › ${s.label}`, s.classification.replace('_', ' ').toLowerCase(), cr, fl];
  }));
  return { id: 'category', title: 'Category screening (fixture catalogue)', head: ['Madfu subcategory', 'Classification', 'Registered business', 'Freelancer'], rows, note: 'Fixture values: the real Madfu catalogue and restrictions are pending.' };
}

const providerTable: Table = {
  id: 'cr', title: 'CR verification results', head: ['Result', 'Behaviour'],
  rows: [
    ['Valid', 'Continue to authorised people'],
    ['Expired', 'Continue; flagged internally for review'],
    ['Not found / invalid', 'Cannot continue; applicant can edit the CR number'],
    ['Provider unavailable', `Retry (bounded, ${LIMITS.providerRetries} retries); progress kept; no people invented`],
    ['Unexpected error', 'Retry; progress kept']
  ]
};

const nafathTable: Table = {
  id: 'nafath', title: 'Nafath (identity and authority, not the contract)', head: ['Situation', 'Registered business', 'Freelancer'],
  rows: [
    ['Attempts', `${LIMITS.nafathAttempts} per application, shared across people`, `${LIMITS.nafathAttempts} per application`],
    ['Changing the selected person', 'Does not reset the counter', '—'],
    ['First failure (rejected / timeout)', 'Retry same person, or choose another; remaining attempts shown', 'Retry; remaining attempts shown'],
    ['Second failure', 'No more automatic Nafath; unverified; business data still collected; no contract', 'Manual route: certificate number by hand, IBAN without ownership check, no contract'],
    ['Technical failure', 'Does not use an attempt (provisional)', 'Does not use an attempt (provisional)'],
    ['Verified', 'Continue to business details', 'Retrieve freelance certificates']
  ]
};

const certificateTable: Table = {
  id: 'certificates', title: 'Freelance certificates', head: ['Result', 'Behaviour'],
  rows: [
    ['One', 'Preselected; confirm'],
    ['Several', 'Choose one'],
    ['None', 'No certificate invented; type the number (manual verification)'],
    ['Provider unavailable', 'Retry, then type the number'],
    ['Expired', 'Shown, cannot be selected'],
    ['Already attached to another account', 'Shown, cannot be selected'],
    ['Inconsistent data', 'Selectable; flagged'],
    ['Activity differs from chosen category', 'Flagged; restriction re-evaluated (restricted → neutral confirmation)']
  ]
};

const ibanTable: Table = {
  id: 'iban', title: 'IBAN ownership', head: ['Applicant', 'Checked against', 'After 2 unsuccessful checks'],
  rows: [
    ['Registered business', 'The business (CR)', 'Continue; unverified; manual financial review'],
    ['Freelancer, Nafath verified', 'The individual', 'Continue; unverified; manual financial review'],
    ['Freelancer, Nafath failed', 'Not checked', 'Collected for manual verification']
  ]
};

function contractTable(): Table {
  const cases: Array<[string, ApplicantType, (a: ReturnType<typeof prefill>) => ReturnType<typeof prefill>]> = [
    ['Nafath verified, IBAN verified', 'CR', (a) => a],
    ['Nafath verified, IBAN unverified after 2 checks', 'CR', (a) => ({ ...a, business: { ...a.business, ibanStatus: 'unverified' } })],
    ['Nafath verified, CR expired (flag)', 'CR', (a) => ({ ...a, cr: { ...a.cr, status: 'expired' } })],
    ['Nafath failed twice', 'CR', (a) => ({ ...a, nafath: { ...a.nafath, status: 'exhausted' } })],
    ['No eligible individual', 'CR', (a) => ({ ...a, persons: { ...a.persons, status: 'none' }, nafath: { ...a.nafath, status: 'idle' } })],
    ['Nafath verified, certificate selected', 'FL', (a) => a],
    ['Nafath verified, certificate typed by hand', 'FL', (a) => ({ ...a, flags: ['CERTIFICATE_MANUAL'], certs: { ...a.certs, selectedId: null, manualNumber: '400000009' } })],
    ['Nafath failed twice', 'FL', (a) => ({ ...a, nafath: { ...a.nafath, status: 'exhausted' } })]
  ];
  const rows = cases.map(([label, t, f]) => {
    const ok = contractEligible(f(prefill(t, 'review')));
    return [typeLabel(t), label, ok ? 'Contract available' : 'No contract: manual verification'];
  });
  return { id: 'contract', title: 'Contract eligibility (computed from the prototype rule)', head: ['Applicant', 'Situation', 'Contract'], rows };
}

function outcomesTable(): Table {
  const map: Array<[OutcomeKind, keyof typeof STATUS_LABEL]> = [
    ['SUBMITTED', 'SUBMITTED'], ['MANUAL_VERIFICATION', 'SUBMITTED_MANUAL_VERIFICATION'], ['SALES_LEAD', 'SALES_LEAD_LOW_REVENUE'],
    ['CATEGORY_REVIEW', 'CATEGORY_BLOCKED'], ['EXISTING_MERCHANT', 'EXISTING_MERCHANT'], ['DUPLICATE_IDENTITY', 'DUPLICATE_IDENTITY'],
    ['ADDITIONAL_CERTIFICATE', 'ADDITIONAL_CERTIFICATE_PENDING'], ['CONTRACT_DECLINED', 'CONTRACT_DECLINED']
  ];
  return {
    id: 'outcomes', title: 'Outcomes: external copy vs internal status', head: ['Applicant sees', 'Internal status'],
    rows: map.map(([o, s]) => [OUTCOME_COPY[o].title, STATUS_LABEL[s]])
  };
}

export const DECISION_TABLES: Table[] = [revenueRouting(), identityOrder, categoryTable(), providerTable, nafathTable, certificateTable, ibanTable, contractTable(), outcomesTable()];

export const PENDING_DECISIONS: string[] = [
  `Exact revenue boundary: is SAR ${REVENUE_RULE.selfServiceFromSar.toLocaleString('en-US')} self-onboarding or a lead? (prototype: self-onboarding)`,
  'Real Madfu category catalogue, its restrictions and CR-only list (prototype uses fixtures).',
  'Provider behind CR enrichment / verification and associated parties (prototype: neutral mock adapter).',
  'Provider behind IBAN ownership verification for businesses and individuals.',
  'Contract / e-signature provider and legal acceptance method (prototype: generic simulated acceptance).',
  'Whether a Nafath technical failure consumes one of the two attempts (prototype: it does not).',
  'Whether editing the IBAN resets the two-check limit (prototype: the limit is per application).',
  'VAT for registered businesses when no VAT record is found (prototype: VAT is retrieved; Freelancers type the number).',
  'Freelancer with no certificate found: allow contract after manual certificate verification? (prototype: no contract, manual verification).',
  'Existing Freelancer adding another certificate: future account flow to be designed.'
];

export const ASSUMPTIONS: string[] = [
  'Application and merchant account are separate: no login or password exists during onboarding; the account is set up after approval.',
  'SMS code: 3 incorrect attempts, then a new code is needed; expiry and resend are simulated.',
  'Identity and duplicate checks run before mobile matching; the outcome is shown only after the SMS code.',
  'Nafath verifies identity and authority; it is not the contract signature.',
  'Expired CR is allowed to progress and is flagged for review.',
  'IBAN is the only bank input; bank name is derived; SWIFT, beneficiary and IBAN certificate are never asked.',
  'Branch count is optional and only asked for offline or mixed sellers.',
  'No Source of Revenue / Source of Income, no Proof of Sales, no VAT certificate, no document uploads.'
];
