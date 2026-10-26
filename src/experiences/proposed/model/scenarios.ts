/**
 * Scenario catalogue (automated tests, PDF, docs) and the journey presets of "Start demo". Each sets
 * the simulated provider answers (Sim) and, where useful, an application walked with the real
 * transitions to the screen where the behaviour shows. Inside a screen, the Prototype Controls show
 * only that screen's Page Scenarios (model/pageScenarios.ts).
 */
import { DEMO } from './mock';
import {
  initialApplication, initialSim, leaveSession, openContinueLink, prefill, runBusinessVerification, sendContinueLink, setIdentity, submitIdentify,
  submitKyb, withSaved
} from './state';
import type { Application, Kyb, Lifecycle, ProposedState, Sim, StepId } from './types';

export type ScenarioGroup =
  | 'Know Your Business'
  | 'Identify & routing'
  | 'Registered business'
  | 'Mobile & Nafath'
  | 'Freelancer'
  | 'Business Details'
  | 'Commercial Offer'
  | 'Review & contract'
  | 'Application status';

export const SCENARIO_GROUPS: ScenarioGroup[] = ['Know Your Business', 'Identify & routing', 'Registered business', 'Mobile & Nafath', 'Freelancer', 'Business Details', 'Commercial Offer', 'Review & contract', 'Application status'];

export interface Scenario {
  id: string;
  group: ScenarioGroup;
  label: string;
  hint: string;
  build: () => ProposedState;
}

const simWith = (patch: Partial<Sim> = {}, cr: Partial<Sim['cr']> = {}): Sim => {
  const base = initialSim();
  return { ...base, ...patch, cr: { ...base.cr, ...cr } };
};

/* ------------------------------------------------------------------ builders */

const KYB_CR: Kyb = { kind: 'CR', group: 'retail', sub: 'retail-fashion', revenue: 'SELF_SERVICE_BAND', channel: 'online' };
const KYB_FL: Kyb = { kind: 'FL_CERT', group: 'services', sub: 'services-design', revenue: 'SELF_SERVICE_BAND', channel: 'online' };

/** Page 1 filled in, ready for "Check eligibility". */
function atKyb(id: string, kyb: Partial<Kyb>, sim: Sim = simWith()): ProposedState {
  const app: Application = { ...initialApplication(1_760_000_000_000 + id.length), kyb: { ...KYB_CR, ...kyb } };
  return { app, sim, scenarioId: id, backend: withSaved(app).backend };
}

/** Page 2 filled in, ready for "Send code". */
function atIdentify(id: string, kyb: Partial<Kyb>, sim: Sim = simWith(), prerequisite: 'yes' | 'no' | null = 'yes'): ProposedState {
  const s = submitKyb(atKyb(id, kyb, sim));
  const isCr = s.app.kyb.kind === 'CR';
  return setIdentity(s, { identifier: isCr ? DEMO.cr : DEMO.nationalId, mobile: DEMO.mobile, prerequisite: s.app.eligibility?.result === 'SELF_ONBOARDING' ? prerequisite : null });
}

/** Healthy application walked to `step`, saved in the backend. */
function at(id: string, kind: 'CR' | 'FL_CERT', step: StepId, sim: Sim = simWith(), patch: (a: Application) => Application = (a) => a): ProposedState {
  return withSaved(patch(prefill(kind, step)), sim, id);
}

/** Saved at `savedAt`; the visitor left; the Continue link was opened (registered-mobile OTP screen). */
function resumeFrom(id: string, kind: 'CR' | 'FL_CERT', savedAt: StepId): ProposedState {
  let s = at(id, kind, savedAt);
  s = sendContinueLink(s);
  const token = Object.keys(s.backend.tokens)[0];
  return { ...openContinueLink(leaveSession(s), token), scenarioId: id };
}

/** Certificates not retrieved yet: the certificate screen retrieves them with the scenario's answer. */
const freshCerts = (a: Application): Application => {
  const { FL_CERTS: _drop, ...verifications } = a.verifications;
  return { ...a, certs: { precheck: 'idle', status: 'idle', tries: 0, list: [], selectedId: null }, verifications };
};

const withStatus = (status: Lifecycle) => (a: Application): Application => ({ ...a, status });

/* ------------------------------------------------------------------ the list */

export const SCENARIOS: Scenario[] = [
  // Page 1
  { id: 'kyb-cr-online', group: 'Know Your Business', label: 'Eligible registered business', hint: 'Five answers, no URL. Check eligibility, then Page 2.', build: () => atKyb('kyb-cr-online', {}) },
  { id: 'kyb-cr-both', group: 'Know Your Business', label: 'Eligible registered business — sells online and in store', hint: 'Channel captured now; the URLs are asked later in Business Details.', build: () => atKyb('kyb-cr-both', { group: 'food', sub: 'food-cafe', channel: 'both' }) },
  { id: 'kyb-blocked', group: 'Know Your Business', label: 'Blacklisted category', hint: 'Blocked on Page 1 with a personalised reason; no OTP, no cost.', build: () => atKyb('kyb-blocked', { group: 'fixture', sub: 'fixture-blocked' }) },
  { id: 'kyb-fl-cr-required', group: 'Know Your Business', label: 'Freelancer in a CR-only category', hint: 'Blocked on Page 1: the activity requires a CR.', build: () => atKyb('kyb-fl-cr-required', { kind: 'FL_CERT', group: 'food', sub: 'food-cafe' }) },
  { id: 'kyb-fl-offline', group: 'Know Your Business', label: 'Freelancer category online only, sells offline', hint: 'Blocked on Page 1 (channel rule).', build: () => atKyb('kyb-fl-offline', { kind: 'FL_CERT', group: 'retail', sub: 'retail-electronics', channel: 'offline' }) },
  { id: 'kyb-fl-no-cert', group: 'Know Your Business', label: 'Freelancer without certificate', hint: 'Lead route: National ID + mobile + OTP, then the certificate-required outcome.', build: () => atKyb('kyb-fl-no-cert', { kind: 'FL_NO_CERT', group: 'services', sub: 'services-design' }) },
  { id: 'kyb-cr-sales', group: 'Know Your Business', label: 'Registered business above SAR 20M', hint: 'Sales route: CR + mobile + OTP, then the Sales thank-you. Nothing else is asked.', build: () => atKyb('kyb-cr-sales', { revenue: 'ABOVE_20M' }) },
  { id: 'kyb-cr-low', group: 'Know Your Business', label: 'Registered business below SAR 100K', hint: 'Lead route (configurable threshold).', build: () => atKyb('kyb-cr-low', { revenue: 'BELOW_100K' }) },

  // Page 2 + routing
  { id: 'id-new-cr', group: 'Identify & routing', label: 'New registered business', hint: 'CR + mobile + owner / manager = Yes → existence check → OTP to the entered mobile.', build: () => atIdentify('id-new-cr', {}) },
  { id: 'id-new-fl', group: 'Identify & routing', label: 'New Freelancer', hint: 'National ID + mobile + IBAN linked = Yes → OTP.', build: () => atIdentify('id-new-fl', KYB_FL) },
  { id: 'id-cr-not-owner', group: 'Identify & routing', label: 'Not an owner or manager', hint: 'Owner / manager = No → OTP → blocked with the reason. Delegation is out of V1.', build: () => atIdentify('id-cr-not-owner', {}, simWith(), 'no') },
  { id: 'id-fl-iban-no', group: 'Identify & routing', label: 'Freelancer IBAN not linked', hint: 'IBAN linked = No → OTP → blocked with linkage instructions.', build: () => atIdentify('id-fl-iban-no', KYB_FL, simWith(), 'no') },
  { id: 'id-incomplete', group: 'Identify & routing', label: 'Application already in progress', hint: 'Code goes to the REGISTERED mobile (•••••••123), not the entered one; then resume.', build: () => atIdentify('id-incomplete', {}, simWith({ existence: 'incomplete' })) },
  { id: 'id-submitted', group: 'Identify & routing', label: 'Application already submitted', hint: 'Registered-mobile code → Application Progress. Never Review or Contract.', build: () => atIdentify('id-submitted', {}, simWith({ existence: 'submitted' })) },
  { id: 'id-live', group: 'Identify & routing', label: 'Already a Madfu merchant', hint: 'Account-mobile code → merchant login. No application is created.', build: () => atIdentify('id-live', {}, simWith({ existence: 'live' })) },
  { id: 'id-throttled', group: 'Identify & routing', label: 'Too many requests', hint: 'Rate limit / bot challenge on Page 2 (simulated).', build: () => atIdentify('id-throttled', {}, simWith({ rateLimited: true })) },
  { id: 'otp-errors', group: 'Identify & routing', label: 'OTP errors', hint: 'Wrong codes, expiry, bounded resends.', build: () => { const s = submitIdentify(atIdentify('otp-errors', {})); return { ...s, app: { ...s.app, otp: { ...s.app.otp, status: 'incorrect', attemptsLeft: 2, code: '135790' } } }; } },
  { id: 'resume-link', group: 'Identify & routing', label: 'Continue link → OTP → resume', hint: 'Saved at the Commercial Offer: only the code, then the offer; nothing re-verified.', build: () => resumeFrom('resume-link', 'CR', 'commercial') },

  // Registered business
  { id: 'cr-happy', group: 'Registered business', label: 'Walk the registered-business journey', hint: 'From Page 1 to Submit (code 246810).', build: () => atKyb('cr-happy', { group: 'food', sub: 'food-cafe', channel: 'both' }) },
  { id: 'cr-business', group: 'Registered business', label: 'Business verification (auto)', hint: 'CR data and owners / managers are retrieved on the owner / manager screen; no separate CR page.', build: () => at('cr-business', 'CR', 'persons') },
  { id: 'cr-expired', group: 'Registered business', label: 'CR expired', hint: 'Saved + Sales recovery; no people, Nafath or IBAN call; no Refresh button.', build: () => runBusinessVerification(at('cr-expired', 'CR', 'persons', simWith({}, { status: 'EXPIRED' }))) },
  { id: 'cr-suspended', group: 'Registered business', label: 'CR suspended', hint: 'Same Sales recovery route.', build: () => runBusinessVerification(at('cr-suspended', 'CR', 'persons', simWith({}, { status: 'SUSPENDED' }))) },
  { id: 'cr-young', group: 'Registered business', label: 'CR 2 months old', hint: 'Continues: CR age is a risk attribute (Internal view), not a rejection.', build: () => at('cr-young', 'CR', 'persons', simWith({}, { ageMonths: 2 })) },
  { id: 'cr-multi', group: 'Registered business', label: 'Several CR activities, government category differs', hint: 'Declared café; registered consultancy + general trade: verified category = consultancy (pricing too).', build: () => at('cr-multi', 'CR', 'persons', simWith({}, { activities: ['ACT-7020', 'ACT-4719'] })) },
  { id: 'cr-regulated', group: 'Registered business', label: 'Regulated registered activity', hint: 'A gold & jewellery activity blocks whatever was declared.', build: () => at('cr-regulated', 'CR', 'persons', simWith({}, { activities: ['ACT-5630', 'ACT-4777'] })) },
  { id: 'cr-unavailable', group: 'Registered business', label: 'CR provider unavailable', hint: 'Bounded retries in this session; Save & exit; retries reset on resume.', build: () => at('cr-unavailable', 'CR', 'persons', simWith({}, { result: 'unavailable' })) },
  { id: 'cr-no-owner', group: 'Registered business', label: 'No owner or manager on the CR', hint: 'Only a delegate and a company: the declaration is not confirmed → blocked.', build: () => at('cr-no-owner', 'CR', 'persons', simWith({ persons: 'none' })) },

  // Mobile + Nafath
  { id: 'mm-match', group: 'Mobile & Nafath', label: 'Mobile matches the owner', hint: 'Send to Nafath: ownership check passes, Nafath request sent.', build: () => at('mm-match', 'CR', 'nafath') },
  { id: 'mm-mismatch', group: 'Mobile & Nafath', label: 'Mobile does not belong to the selected owner', hint: 'Use another mobile → OTP → check again → Nafath. CR progress kept.', build: () => at('mm-mismatch', 'CR', 'nafath', simWith({ mobileMatch: ['mismatch', 'match'] })) },
  { id: 'mm-blocked', group: 'Mobile & Nafath', label: 'Still a mismatch after the correction', hint: 'Verification step paused; progress saved; no Nafath call.', build: () => at('mm-blocked', 'CR', 'nafath', simWith({ mobileMatch: ['mismatch', 'mismatch'] })) },
  { id: 'nafath-fail', group: 'Mobile & Nafath', label: 'Nafath first failure', hint: 'Rejected once: one attempt left.', build: () => at('nafath-fail', 'CR', 'nafath', simWith({ nafath: ['rejected', 'verified'] })) },
  { id: 'nafath-max', group: 'Mobile & Nafath', label: 'Nafath failed twice', hint: 'Details still collected; manual verification, no contract.', build: () => at('nafath-max', 'CR', 'nafath', simWith({ nafath: ['rejected', 'timeout'] })) },
  { id: 'nafath-technical', group: 'Mobile & Nafath', label: 'Nafath technical failures', hint: 'No attempt used; bounded per session.', build: () => at('nafath-technical', 'CR', 'nafath', simWith({ nafath: ['technical'] })) },

  // Freelancer
  { id: 'fl-happy', group: 'Freelancer', label: 'Walk the Freelancer journey', hint: 'From Page 1 to Submit.', build: () => atKyb('fl-happy', KYB_FL) },
  { id: 'fl-nafath', group: 'Freelancer', label: 'Certificate pre-check, then Nafath', hint: 'Backend checks the certificate first (cost order); the applicant sees Nafath.', build: () => at('fl-nafath', 'FL_CERT', 'nafath') },
  { id: 'fl-no-cert', group: 'Freelancer', label: 'No certificate found', hint: 'Stops before Nafath: certificate-required lead.', build: () => at('fl-no-cert', 'FL_CERT', 'nafath', simWith({ certificates: 'none' })) },
  { id: 'fl-cert-unavailable', group: 'Freelancer', label: 'Certificate service unavailable', hint: 'Retry later; no Nafath call yet.', build: () => at('fl-cert-unavailable', 'FL_CERT', 'nafath', simWith({ certificates: 'unavailable' })) },
  { id: 'fl-mismatch', group: 'Freelancer', label: 'Mobile not registered to the National ID', hint: 'Same mobile correction as for owners.', build: () => at('fl-mismatch', 'FL_CERT', 'nafath', simWith({ mobileMatch: ['mismatch', 'match'] })) },
  { id: 'fl-certs-multi', group: 'Freelancer', label: 'Several certificates', hint: 'Choose one; its activity becomes the verified category.', build: () => at('fl-certs-multi', 'FL_CERT', 'certificates', simWith({ certificates: 'multiple' }), freshCerts) },
  { id: 'fl-cert-cr-only', group: 'Freelancer', label: 'Certificate activity requires a CR', hint: 'Blocked after confirmation.', build: () => at('fl-cert-cr-only', 'FL_CERT', 'certificates', simWith({ certificates: 'mismatch' }), freshCerts) },

  // Business Details
  { id: 'biz-cr-both', group: 'Business Details', label: 'Registered business: website + Google Maps', hint: 'No IBAN, VAT or branch count for a registered business.', build: () => at('biz-cr-both', 'CR', 'business') },
  { id: 'biz-fl', group: 'Business Details', label: 'Freelancer: website + IBAN linkage', hint: 'IBAN verified against the National ID and certificate.', build: () => at('biz-fl', 'FL_CERT', 'business') },
  { id: 'biz-fl-iban-fail', group: 'Business Details', label: 'Freelancer IBAN not linked', hint: 'Two mismatches for an IBAN: enter another IBAN. Technical errors do not count.', build: () => at('biz-fl-iban-fail', 'FL_CERT', 'business', simWith({ iban: ['mismatch', 'mismatch', 'verified'] })) },

  // Commercial
  { id: 'com-standard', group: 'Commercial Offer', label: 'Standard offer', hint: 'One rate from the verified category → Continue. No plan selection.', build: () => at('com-standard', 'CR', 'commercial') },
  { id: 'com-review', group: 'Commercial Offer', label: 'Rate review requested', hint: 'Interest kept without a file; standard offer continues.', build: () => at('com-review', 'CR', 'commercial', simWith(), (a) => ({ ...a, commercial: { ...a.commercial, reviewRequested: true }, flags: [...a.flags, 'COMMERCIAL_RATE_REVIEW_REQUESTED'] })) },
  { id: 'com-upload', group: 'Commercial Offer', label: 'Rate review with evidence', hint: 'Optional file added; never blocks.', build: () => at('com-upload', 'CR', 'commercial', simWith(), (a) => ({ ...a, commercial: { ...a.commercial, reviewRequested: true, evidence: ['doc-a'] }, flags: [...a.flags, 'COMMERCIAL_RATE_REVIEW_REQUESTED'] })) },

  // Review / contract
  { id: 'review', group: 'Review & contract', label: 'Review with locked verified sections', hint: 'Only store presence and the rate review can be edited; Cancel restores everything.', build: () => at('review', 'CR', 'review') },
  { id: 'review-fl', group: 'Review & contract', label: 'Freelancer review', hint: 'Certificate, IBAN and verified category locked.', build: () => at('review-fl', 'FL_CERT', 'review') },
  { id: 'contract', group: 'Review & contract', label: 'Contract', hint: 'Agree & Submit: one action. Standard commission only.', build: () => at('contract', 'CR', 'contract') },
  { id: 'contract-decline', group: 'Review & contract', label: 'Contract declined', hint: 'Still a draft; resumable at the contract.', build: () => at('contract-decline', 'CR', 'contract') },
  { id: 'submit-manual', group: 'Review & contract', label: 'Submitted for manual verification', hint: 'Nafath failed twice: Review submits without a contract.', build: () => at('submit-manual', 'CR', 'review', simWith(), (a) => ({ ...a, nafath: { ...a.nafath, status: 'exhausted', failures: 2, verifiedFor: null }, verifications: { ...a.verifications, NAFATH: undefined }, flags: [...a.flags, 'NAFATH_UNVERIFIED'] })) },

  // Status
  { id: 'status-submitted', group: 'Application status', label: 'Submitted', hint: 'Application Progress after the registered-mobile code.', build: () => at('status-submitted', 'CR', 'status') },
  { id: 'status-review', group: 'Application status', label: 'Under review', hint: 'Status only; nothing editable.', build: () => at('status-review', 'CR', 'status', simWith(), withStatus('UNDER_REVIEW')) },
  { id: 'status-action', group: 'Application status', label: 'Action required', hint: 'The team contacts the merchant; onboarding is not reopened.', build: () => at('status-action', 'CR', 'status', simWith(), withStatus('ACTION_REQUIRED')) },
  { id: 'status-approved', group: 'Application status', label: 'Approved', hint: 'Approved is not live: no activation claim.', build: () => at('status-approved', 'CR', 'status', simWith(), withStatus('APPROVED')) }
];

export const scenarioById = (id: string | null) => SCENARIOS.find((s) => s.id === id) ?? null;

/** Full-journey starting points for "Start demo". */
export const JOURNEY_PRESETS: Array<{ id: string; label: string; hint: string }> = [
  { id: 'cr-happy', label: 'Happy path — registered business', hint: 'Page 1 filled in. Check eligibility, then code 246810.' },
  { id: 'fl-happy', label: 'Happy path — Freelancer', hint: 'Freelancer with a certificate, from Page 1.' },
  { id: 'kyb-cr-sales', label: 'Sales lead', hint: 'Registered business above SAR 20M: Page 2 + code, then the Sales thank-you.' },
  { id: 'kyb-fl-no-cert', label: 'Freelancer without certificate', hint: 'Lead route, no verification.' },
  { id: 'id-incomplete', label: 'Existing incomplete application', hint: 'Code goes to the registered mobile; then resume.' },
  { id: 'id-submitted', label: 'Submitted application', hint: 'Registered-mobile code → Application Progress.' },
  { id: 'id-live', label: 'Live merchant', hint: 'Account-mobile code → login.' },
  { id: 'mm-mismatch', label: 'Mobile mismatch before Nafath', hint: 'Use another mobile → OTP → check again.' },
  { id: 'cr-expired', label: 'Expired CR', hint: 'Saved and handed to Sales; no further paid checks.' },
  { id: 'resume-link', label: 'Resume (Continue link)', hint: 'Only the code; stored checks are reused.' },
  { id: 'review', label: 'Review & edit', hint: 'Locked verified sections; transactional edit.' }
];
