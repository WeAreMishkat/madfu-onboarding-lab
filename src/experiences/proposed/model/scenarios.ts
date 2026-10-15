/**
 * Scenario presets for the Prototype Controls. Each one sets the simulated backend answers (Sim)
 * and, where useful, a prefilled application at the step where the behaviour shows.
 */
import { LIMITS } from './config';
import { initialApplication, initialSim, initialState, prefill } from './state';
import type { ApplicantType, Application, ProposedState, Revenue, Sim, StepId } from './types';

export interface Scenario {
  id: string;
  /** Number from the specification's required list, when it is one of them. */
  required?: number;
  group: 'Registered business' | 'Freelancer' | 'Shared';
  label: string;
  hint: string;
  build: () => ProposedState;
}

const make = (id: string, app: Application, sim: Partial<Sim> = {}): ProposedState => ({
  ...initialState(),
  scenarioId: id,
  app,
  sim: { ...initialSim(), ...sim }
});

/** Entry page filled in, ready for Next. */
function atEntry(id: string, type: ApplicantType, revenue: Revenue, sim: Partial<Sim> = {}): ProposedState {
  const base = prefill(type, 'entry');
  return make(id, { ...initialApplication(1_760_000_000_000 + id.length), entry: { ...base.entry, revenue } }, sim);
}

/** Prefilled healthy application stopped at `step`. */
const at = (id: string, type: ApplicantType, step: StepId, sim: Partial<Sim> = {}, patch: (a: Application) => Application = (a) => a) =>
  make(id, patch(prefill(type, step, { ...initialSim(), ...sim })), sim);

export const SCENARIOS: Scenario[] = [
  // ------------------------------------------------------------------ required (spec §31)
  { id: 'cr-all-verified', required: 1, group: 'Registered business', label: 'CR self-onboarding, all verified', hint: 'Walk the whole CR journey: code 246810, any category, pick a person, Nafath approves, IBAN verifies, sign.', build: () => atEntry('cr-all-verified', 'CR', 'SELF_SERVICE_BAND') },
  { id: 'cr-low-lead', required: 2, group: 'Registered business', label: 'CR below SAR 100K → Sales lead', hint: 'After the code: neutral thank-you. No category, Nafath, IBAN or contract.', build: () => atEntry('cr-low-lead', 'CR', 'BELOW_100K') },
  { id: 'cr-high-lead', required: 3, group: 'Registered business', label: 'CR above SAR 20M → Sales lead', hint: 'After the code: neutral thank-you; internal SALES_LEAD_HIGH_REVENUE.', build: () => atEntry('cr-high-lead', 'CR', 'ABOVE_20M') },
  { id: 'cr-duplicate-account', required: 4, group: 'Registered business', label: 'CR already has a merchant account', hint: 'Identity is checked first: no duplicate application is created.', build: () => atEntry('cr-duplicate-account', 'CR', 'SELF_SERVICE_BAND', { identity: 'existing_merchant' }) },
  { id: 'cr-blocked-category', required: 5, group: 'Registered business', label: 'CR blocked category', hint: 'Continue: no registry, Nafath or bank call is made; neutral confirmation.', build: () => at('cr-blocked-category', 'CR', 'category', {}, (a) => ({ ...a, category: { group: 'fixture', sub: 'fixture-blocked' } })) },
  { id: 'cr-expired', required: 6, group: 'Registered business', label: 'CR expired registration', hint: 'Allowed to continue; flagged internally for review.', build: () => at('cr-expired', 'CR', 'cr-verify', { crResult: 'expired' }) },
  { id: 'cr-nafath-rejected-twice', required: 7, group: 'Registered business', label: 'CR Nafath rejected twice', hint: 'Send, rejected, retry (or change person), rejected: manual verification, no contract.', build: () => at('cr-nafath-rejected-twice', 'CR', 'nafath', { nafath: ['rejected', 'rejected'] }) },
  { id: 'cr-nafath-timeout-twice', required: 8, group: 'Registered business', label: 'CR Nafath timeout twice', hint: 'Two timeouts use both attempts.', build: () => at('cr-nafath-timeout-twice', 'CR', 'nafath', { nafath: ['timeout', 'timeout'] }) },
  { id: 'cr-iban-failed-twice', required: 9, group: 'Registered business', label: 'CR Nafath verified + IBAN failed twice', hint: 'Verify twice: unverified, manual financial review. The contract is still available.', build: () => at('cr-iban-failed-twice', 'CR', 'business', { iban: ['mismatch', 'mismatch'] }, (a) => ({ ...a, business: { ...a.business, ibanStatus: 'idle', bankName: '', vat: null, channel: null, websiteUrl: '' } })) },
  { id: 'cr-no-people', required: 10, group: 'Registered business', label: 'CR no eligible people', hint: 'Only a company is associated: manual authority check, no Nafath, no contract.', build: () => at('cr-no-people', 'CR', 'persons', { persons: 'none' }, (a) => ({ ...a, persons: { status: 'idle', tries: 0, list: [], selectedId: null }, nafath: { ...a.nafath, status: 'idle' } })) },
  { id: 'fl-all-verified', required: 11, group: 'Freelancer', label: 'Freelancer, all verified', hint: 'Walk the whole Freelancer journey from the entry page.', build: () => atEntry('fl-all-verified', 'FL', 'SELF_SERVICE_BAND') },
  { id: 'fl-multiple-certs', required: 12, group: 'Freelancer', label: 'Freelancer, multiple certificates', hint: 'Choose one certificate.', build: () => at('fl-multiple-certs', 'FL', 'certificates', { certificates: 'multiple' }, (a) => ({ ...a, certs: { status: 'idle', tries: 0, list: [], selectedId: null, manualNumber: '' } })) },
  { id: 'fl-duplicate-id', required: 13, group: 'Freelancer', label: 'Freelancer duplicate National ID', hint: 'An application already exists for this National ID under another mobile.', build: () => atEntry('fl-duplicate-id', 'FL', 'SELF_SERVICE_BAND', { identity: 'duplicate_identity' }) },
  { id: 'fl-nafath-failed-twice', required: 14, group: 'Freelancer', label: 'Freelancer Nafath failed twice', hint: 'Then: certificate number by hand, IBAN without ownership check, no contract.', build: () => at('fl-nafath-failed-twice', 'FL', 'nafath', { nafath: ['rejected', 'timeout'] }, (a) => ({ ...a, nafath: { ...a.nafath, status: 'idle', requests: 0 } })) },
  { id: 'fl-manual-certificate', required: 15, group: 'Freelancer', label: 'Freelancer manual certificate', hint: 'Nafath already failed twice: type the certificate number.', build: () => at('fl-manual-certificate', 'FL', 'manual-certificate', {}, (a) => ({ ...a, nafath: { ...a.nafath, status: 'exhausted', failures: LIMITS.nafathAttempts, requests: 2, verifiedPersonId: null }, flags: ['NAFATH_UNVERIFIED'] })) },
  { id: 'fl-blocked-category', required: 16, group: 'Freelancer', label: 'Freelancer blocked category', hint: 'No Nafath call; neutral confirmation.', build: () => at('fl-blocked-category', 'FL', 'category', {}, (a) => ({ ...a, category: { group: 'fixture', sub: 'fixture-blocked' } })) },
  { id: 'fl-cr-only', required: 17, group: 'Freelancer', label: 'Freelancer CR-only category', hint: 'Not rejected: flagged internally and the journey continues.', build: () => at('fl-cr-only', 'FL', 'category', {}, (a) => ({ ...a, category: { group: 'fixture', sub: 'fixture-cr-only' } })) },
  { id: 'fl-iban-failed-twice', required: 18, group: 'Freelancer', label: 'Freelancer IBAN failed twice', hint: 'Mismatch, then technical error: unverified, manual financial review.', build: () => at('fl-iban-failed-twice', 'FL', 'business', { iban: ['mismatch', 'technical'] }, (a) => ({ ...a, business: { ...a.business, ibanStatus: 'idle', bankName: '', vat: null, channel: null, websiteUrl: '' } })) },
  { id: 'otp-errors', required: 19, group: 'Shared', label: 'OTP errors', hint: 'One wrong code entered. Try more wrong codes (locks at 3) or expire the code from the controls.', build: () => make('otp-errors', { ...prefill('CR', 'otp'), verifiedMobile: '', otp: { status: 'incorrect', attemptsLeft: LIMITS.otpAttempts - 1, code: '135790', resendAt: Date.now() + 20_000 } }) },
  { id: 'provider-retry', required: 20, group: 'Registered business', label: 'Provider failure and retry', hint: 'CR verification is unavailable: bounded retries, progress kept, no people invented.', build: () => at('provider-retry', 'CR', 'cr-verify', { crResult: 'unavailable' }) },
  { id: 'resume', required: 21, group: 'Shared', label: 'Resume application', hint: 'Same CR + same mobile: after the code the saved application reopens where it stopped.', build: () => atEntry('resume', 'CR', 'SELF_SERVICE_BAND', { identity: 'current_application' }) },
  { id: 'contract-declined', required: 22, group: 'Shared', label: 'Contract declined', hint: 'Open the agreement and decline it.', build: () => at('contract-declined', 'CR', 'contract') },
  { id: 'fl-no-certificates', required: 23, group: 'Freelancer', label: 'Freelancer no certificates', hint: 'Nothing found: no certificate is invented; manual certificate route.', build: () => at('fl-no-certificates', 'FL', 'certificates', { certificates: 'none' }, (a) => ({ ...a, certs: { status: 'idle', tries: 0, list: [], selectedId: null, manualNumber: '' } })) },
  { id: 'fl-cert-mismatch', required: 24, group: 'Freelancer', label: 'Certificate / category mismatch', hint: 'The certificate activity maps to another Madfu subcategory: flagged and re-evaluated.', build: () => at('fl-cert-mismatch', 'FL', 'certificates', { certificates: 'mismatch' }, (a) => ({ ...a, certs: { status: 'idle', tries: 0, list: [], selectedId: null, manualNumber: '' } })) },

  // ------------------------------------------------------------------ additional
  { id: 'cr-invalid', group: 'Registered business', label: 'CR not found', hint: 'The registry has no record: cannot continue; edit the number.', build: () => at('cr-invalid', 'CR', 'cr-verify', { crResult: 'not_found' }) },
  { id: 'cr-provider-error', group: 'Registered business', label: 'CR unexpected error', hint: 'Unexpected provider error: retry, progress kept.', build: () => at('cr-provider-error', 'CR', 'cr-verify', { crResult: 'error' }) },
  { id: 'cr-people-unavailable', group: 'Registered business', label: 'People provider unavailable', hint: 'Associated parties cannot be retrieved: retry; never invented.', build: () => at('cr-people-unavailable', 'CR', 'persons', { persons: 'unavailable' }, (a) => ({ ...a, persons: { status: 'idle', tries: 0, list: [], selectedId: null } })) },
  { id: 'cr-one-person', group: 'Registered business', label: 'CR one eligible person', hint: 'One individual (plus a company that is filtered out).', build: () => at('cr-one-person', 'CR', 'persons', { persons: 'one' }, (a) => ({ ...a, persons: { status: 'idle', tries: 0, list: [], selectedId: null } })) },
  { id: 'cr-nafath-switch-person', group: 'Registered business', label: 'Nafath rejected, other person verifies', hint: 'Rejected, choose another person: the attempt counter is not reset.', build: () => at('cr-nafath-switch-person', 'CR', 'nafath', { nafath: ['rejected', 'verified'] }, (a) => ({ ...a, nafath: { ...a.nafath, status: 'idle', requests: 0, verifiedPersonId: null } })) },
  { id: 'nafath-technical', group: 'Shared', label: 'Nafath technical failure', hint: 'A technical failure does not use an attempt (provisional).', build: () => at('nafath-technical', 'CR', 'nafath', { nafath: ['technical', 'verified'] }, (a) => ({ ...a, nafath: { ...a.nafath, status: 'idle', requests: 0, verifiedPersonId: null } })) },
  { id: 'cr-manual-category', group: 'Registered business', label: 'CR manual-review category', hint: 'Allowed to continue; flagged for business review.', build: () => at('cr-manual-category', 'CR', 'category', {}, (a) => ({ ...a, category: { group: 'fixture', sub: 'fixture-manual' } })) },
  { id: 'cr-duplicate-application', group: 'Registered business', label: 'CR application under another mobile', hint: 'Duplicate identity: the existing application is not overwritten.', build: () => atEntry('cr-duplicate-application', 'CR', 'SELF_SERVICE_BAND', { identity: 'duplicate_identity' }) },
  { id: 'fl-additional-certificate', group: 'Freelancer', label: 'Existing Freelancer, another certificate', hint: 'Future account flow (not designed yet): shown as pending.', build: () => atEntry('fl-additional-certificate', 'FL', 'SELF_SERVICE_BAND', { identity: 'additional_certificate' }) },
  { id: 'fl-certs-unavailable', group: 'Freelancer', label: 'Certificates provider unavailable', hint: 'Retry, then enter the certificate number by hand.', build: () => at('fl-certs-unavailable', 'FL', 'certificates', { certificates: 'unavailable' }, (a) => ({ ...a, certs: { status: 'idle', tries: 0, list: [], selectedId: null, manualNumber: '' } })) },
  { id: 'fl-cert-expired', group: 'Freelancer', label: 'Expired certificate', hint: 'The expired certificate cannot be selected.', build: () => at('fl-cert-expired', 'FL', 'certificates', { certificates: 'expired' }, (a) => ({ ...a, certs: { status: 'idle', tries: 0, list: [], selectedId: null, manualNumber: '' } })) },
  { id: 'fl-cert-duplicate', group: 'Freelancer', label: 'Certificate already attached', hint: 'A certificate already used by another account cannot be selected.', build: () => at('fl-cert-duplicate', 'FL', 'certificates', { certificates: 'duplicate' }, (a) => ({ ...a, certs: { status: 'idle', tries: 0, list: [], selectedId: null, manualNumber: '' } })) },
  { id: 'fl-cert-inconsistent', group: 'Freelancer', label: 'Inconsistent certificate data', hint: 'Selectable; flagged for review.', build: () => at('fl-cert-inconsistent', 'FL', 'certificates', { certificates: 'inconsistent' }, (a) => ({ ...a, certs: { status: 'idle', tries: 0, list: [], selectedId: null, manualNumber: '' } })) },
  { id: 'review-edit', group: 'Shared', label: 'Review and edit', hint: 'Edit any section; data is kept and you return to Review.', build: () => at('review-edit', 'CR', 'review') },
  { id: 'contract-submit', group: 'Shared', label: 'Contract → submit', hint: 'Accept the agreement, then submit.', build: () => at('contract-submit', 'FL', 'contract') }
];

export const scenarioById = (id: string | null) => SCENARIOS.find((s) => s.id === id) ?? null;

