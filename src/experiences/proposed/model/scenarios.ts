/**
 * Scenario catalogue (automated tests, PDF, docs) and the journey presets of "Start demo". Each sets
 * the simulated provider answers (Sim) and, where useful, an application walked with the real
 * transitions to the screen where the behaviour shows. Inside a screen, the Prototype Controls show
 * only that screen's Page Scenarios (model/pageScenarios.ts).
 */
import { DAY_MS } from './config';
import { DEMO } from './mock';
import {
  checkExpiry, chooseAuthMode, continueAfterNafath, continueFromReview, initialApplication, initialSim, latestSignerToken, leaveSession, nafathResult,
  openContinueLink, openDelegation, openSignerLink, prefill, restartAuthorization, runBusinessVerification, selectPerson, sendContinueLink, setIdentity,
  signerStartNafath, submitIdentify, submitKyb, withHandoff, withSaved
} from './state';
import type { Application, Kyb, Lifecycle, ProposedState, Sim, StepId } from './types';

export type ScenarioGroup =
  | 'Know Your Business'
  | 'Identify & routing'
  | 'Registered business'
  | 'Authorization & signer'
  | 'Mobile & Nafath'
  | 'Freelancer'
  | 'Business Details'
  | 'Commercial Offer'
  | 'Review & contract'
  | 'Application status';

export const SCENARIO_GROUPS: ScenarioGroup[] = ['Know Your Business', 'Identify & routing', 'Registered business', 'Authorization & signer', 'Mobile & Nafath', 'Freelancer', 'Business Details', 'Commercial Offer', 'Review & contract', 'Application status'];

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

const KYB_CR: Kyb = { kind: 'CR', group: 'retail', sub: 'retail-fashion', revenue: 'MID_BAND', channel: 'online' };
const KYB_FL: Kyb = { kind: 'FL_CERT', group: 'services', sub: 'services-design', revenue: 'MID_BAND', channel: 'online' };

/** Page 1 filled in, ready for "Check eligibility". */
function atKyb(id: string, kyb: Partial<Kyb>, sim: Sim = simWith()): ProposedState {
  const app: Application = { ...initialApplication(1_760_000_000_000 + id.length), kyb: { ...KYB_CR, ...kyb } };
  return { app, sim, scenarioId: id, backend: withSaved(app).backend };
}

/** Page 2 filled in, ready for "Send code". */
function atIdentify(id: string, kyb: Partial<Kyb>, sim: Sim = simWith(), prerequisite: 'yes' | 'no' | null = 'yes'): ProposedState {
  const s = submitKyb(atKyb(id, kyb, sim));
  const isCr = s.app.kyb.kind === 'CR';
  const asks = s.app.eligibility?.result === 'ELIGIBLE' && s.app.kyb.kind === 'FL_CERT';
  return setIdentity(s, { identifier: isCr ? DEMO.cr : DEMO.nationalId, mobile: DEMO.mobile, prerequisite: asks ? prerequisite : null });
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
  return { ...a, certs: { status: 'idle', tries: 0, list: [], selectedId: null }, verifications };
};

const withStatus = (status: Lifecycle) => (a: Application): Application => ({ ...a, status });

/* ------------------------------------------------------------------ signer handoff builders */

/** CR application at the Authorization page (Review done, offer confirmed). */
const atAuthorize = (id: string, sim: Sim = simWith()) => at(id, 'CR', 'authorize', sim);

/** Handoff V1 created `daysAgo` days ago (preparer's Authorization status page). */
const handoff = (id: string, daysAgo = 0, sim: Sim = simWith()) => ({ ...checkExpiry(withHandoff(Date.now() - daysAgo * DAY_MS, atAuthorize(id, sim))), scenarioId: id });

/** The signer opened the newest secure link in a new session (no OTP). */
const signerOpens = (s: ProposedState) => ({ ...openSignerLink(leaveSession(s), latestSignerToken(s)!), scenarioId: s.scenarioId });

const signerAtNafath = (id: string, sim: Sim = simWith()) => signerStartNafath(signerOpens(handoff(id, 0, sim)));
const signerAtReview = (id: string) => continueAfterNafath(nafathResult(signerAtNafath(id), 'verified'));

/** V1 expired, then a new authorization started on the SAME application. */
function secondVersion(id: string): ProposedState {
  const v1 = handoff(id, 8);
  return { ...withHandoff(Date.now(), restartAuthorization(v1)), scenarioId: id };
}

/** V1 and V2 expired inside the 30-day window: a third handoff is refused (internal unlock needed). */
function limitReached(id: string): ProposedState {
  const v1 = handoff(id, 20);
  const v2 = checkExpiry(withHandoff(Date.now() - 9 * DAY_MS, restartAuthorization(v1)));
  return { ...withHandoff(Date.now(), restartAuthorization(v2)), scenarioId: id };
}

/* ------------------------------------------------------------------ the list */

export const SCENARIOS: Scenario[] = [
  // Page 1 — two internal outcomes: Eligible / Not Eligible. Nothing is shown; revenue never routes.
  { id: 'kyb-cr-online', group: 'Know Your Business', label: 'Eligible registered business', hint: 'Five answers, no URL. Check eligibility, then Page 2.', build: () => atKyb('kyb-cr-online', {}) },
  { id: 'kyb-fl', group: 'Know Your Business', label: 'Eligible Freelancer', hint: 'Freelancer with a certificate: National ID + mobile on Page 2.', build: () => atKyb('kyb-fl', KYB_FL) },
  { id: 'kyb-cr-both', group: 'Know Your Business', label: 'Eligible registered business — sells online and in store', hint: 'Channel captured now; the URLs are asked later in Business Details.', build: () => atKyb('kyb-cr-both', { group: 'food', sub: 'food-cafe', channel: 'both' }) },
  { id: 'kyb-cr-low', group: 'Know Your Business', label: 'Registered business below SAR 100K', hint: 'Eligible: revenue never routes. Self-onboarding as normal.', build: () => atKyb('kyb-cr-low', { revenue: 'BELOW_100K' }) },
  { id: 'kyb-cr-high', group: 'Know Your Business', label: 'Registered business above SAR 20M', hint: 'Eligible: self-onboarding as normal (no Sales route).', build: () => atKyb('kyb-cr-high', { revenue: 'ABOVE_20M' }) },
  { id: 'kyb-fl-no-cert', group: 'Know Your Business', label: 'Freelancer without certificate (internally Not Eligible)', hint: 'Continues to Identify + OTP; the merchant sees Application submitted. Reason internal.', build: () => atKyb('kyb-fl-no-cert', { kind: 'FL_NO_CERT', group: 'services', sub: 'services-design' }) },
  { id: 'kyb-unsupported', group: 'Know Your Business', label: 'Unsupported category (internally Not Eligible)', hint: 'Identify + OTP, then Application submitted. No paid check; the team calls them.', build: () => atKyb('kyb-unsupported', { group: 'fixture', sub: 'fixture-blocked' }) },
  { id: 'kyb-fl-unsupported', group: 'Know Your Business', label: 'Freelancer in an unsupported category', hint: 'National ID + mobile + code, then Application submitted (internal Not Eligible).', build: () => atKyb('kyb-fl-unsupported', { ...KYB_FL, group: 'fixture', sub: 'fixture-blocked' }) },
  { id: 'kyb-fl-cr-required', group: 'Know Your Business', label: 'Freelancer in a CR-only category', hint: 'Identify + OTP, then Application submitted; reason (activity requires a CR) internal.', build: () => atKyb('kyb-fl-cr-required', { kind: 'FL_CERT', group: 'food', sub: 'food-cafe' }) },
  { id: 'kyb-fl-offline', group: 'Know Your Business', label: 'Freelancer category online only, sells offline', hint: 'Identify + OTP, then Application submitted (channel rule internal).', build: () => atKyb('kyb-fl-offline', { kind: 'FL_CERT', group: 'retail', sub: 'retail-electronics', channel: 'offline' }) },

  // Page 2 + routing
  { id: 'id-new-cr', group: 'Identify & routing', label: 'New registered business', hint: 'CR + mobile → existence check → OTP to the entered mobile. No owner / manager question.', build: () => atIdentify('id-new-cr', {}) },
  { id: 'id-new-fl', group: 'Identify & routing', label: 'New Freelancer', hint: 'National ID + mobile + IBAN linked = Yes → OTP.', build: () => atIdentify('id-new-fl', KYB_FL) },
  { id: 'id-unsupported-cr', group: 'Identify & routing', label: 'Not eligible: registered business', hint: 'CR + mobile (neutral page) → OTP → Application submitted. No CR, Nafath or other paid check.', build: () => atIdentify('id-unsupported-cr', { group: 'fixture', sub: 'fixture-blocked' }) },
  { id: 'id-unsupported-fl', group: 'Identify & routing', label: 'Not eligible: Freelancer', hint: 'National ID + mobile → OTP → Application submitted. No certificate or Nafath check.', build: () => atIdentify('id-unsupported-fl', { ...KYB_FL, group: 'fixture', sub: 'fixture-blocked' }) },
  { id: 'id-fl-no-cert', group: 'Identify & routing', label: 'Not eligible: Freelancer without certificate', hint: 'National ID + mobile → OTP → Application submitted (reason internal).', build: () => atIdentify('id-fl-no-cert', { kind: 'FL_NO_CERT', group: 'services', sub: 'services-design' }) },
  { id: 'id-fl-iban-no', group: 'Identify & routing', label: 'Freelancer IBAN not linked', hint: 'IBAN linked = No → OTP → Application submitted (internal Not Eligible).', build: () => atIdentify('id-fl-iban-no', KYB_FL, simWith(), 'no') },
  { id: 'id-incomplete', group: 'Identify & routing', label: 'Registered business in progress (resume)', hint: 'Different mobile entered: the code goes to the STORED mobile (•••••••123) only; then Business Details.', build: () => atIdentify('id-incomplete', {}, simWith({ existence: 'incomplete' })) },
  { id: 'id-incomplete-fl', group: 'Identify & routing', label: 'Freelancer in progress (resume)', hint: 'Code to the stored mobile; resumes at Nafath (certificate already chosen).', build: () => atIdentify('id-incomplete-fl', KYB_FL, simWith({ existence: 'incomplete' })) },
  { id: 'id-submitted', group: 'Identify & routing', label: 'Application already submitted', hint: 'Registered-mobile code → Application Progress. Never Review or Contract.', build: () => atIdentify('id-submitted', {}, simWith({ existence: 'submitted' })) },
  { id: 'id-not-eligible', group: 'Identify & routing', label: 'Captured earlier (internally Not Eligible)', hint: 'Registered-mobile code → Application Progress “Under review”. No new record, no reason shown.', build: () => atIdentify('id-not-eligible', {}, simWith({ existence: 'not_eligible' })) },
  { id: 'id-live', group: 'Identify & routing', label: 'Already a Madfu merchant', hint: 'Account-mobile code → popup “You already have an active account” → Log in only on click.', build: () => atIdentify('id-live', {}, simWith({ existence: 'live' })) },
  { id: 'id-throttled', group: 'Identify & routing', label: 'Too many requests', hint: 'Rate limit / bot challenge on Page 2 (simulated).', build: () => atIdentify('id-throttled', {}, simWith({ rateLimited: true })) },
  { id: 'otp-errors', group: 'Identify & routing', label: 'OTP errors', hint: 'Wrong codes, expiry, bounded resends.', build: () => { const s = submitIdentify(atIdentify('otp-errors', {})); return { ...s, app: { ...s.app, otp: { ...s.app.otp, status: 'incorrect', attemptsLeft: 2, code: '135790' } } }; } },
  { id: 'resume-link', group: 'Identify & routing', label: 'Continue link → OTP → resume (registered business)', hint: 'Saved at the Commercial Offer: only the code, then the offer; nothing re-verified.', build: () => resumeFrom('resume-link', 'CR', 'commercial') },
  { id: 'resume-link-fl', group: 'Identify & routing', label: 'Continue link → OTP → resume (Freelancer)', hint: 'Saved after Review: resumes at the certificate selection; details and offer kept.', build: () => resumeFrom('resume-link-fl', 'FL_CERT', 'certificates') },

  // Registered business
  { id: 'cr-happy', group: 'Registered business', label: 'Walk the registered-business journey', hint: 'From Page 1 to Submit (code 246810).', build: () => atKyb('cr-happy', { group: 'food', sub: 'food-cafe', channel: 'both' }) },
  { id: 'cr-business', group: 'Registered business', label: 'CR verification (auto)', hint: 'CR data and owners / managers are retrieved; the merchant only reviews and continues.', build: () => at('cr-business', 'CR', 'cr') },
  { id: 'cr-expired', group: 'Registered business', label: 'CR expired', hint: 'Saved + Sales recovery; no further paid calls; no Refresh button.', build: () => runBusinessVerification(at('cr-expired', 'CR', 'cr', simWith({}, { status: 'EXPIRED' }))) },
  { id: 'cr-suspended', group: 'Registered business', label: 'CR suspended', hint: 'Same Sales recovery route.', build: () => runBusinessVerification(at('cr-suspended', 'CR', 'cr', simWith({}, { status: 'SUSPENDED' }))) },
  { id: 'cr-young', group: 'Registered business', label: 'CR 2 months old', hint: 'Continues: CR age is a risk input (Internal view), not a rejection.', build: () => at('cr-young', 'CR', 'cr', simWith({}, { ageMonths: 2 })) },
  { id: 'cr-multi', group: 'Registered business', label: 'Several CR activities, government category differs', hint: 'Declared café; registered consultancy + general trade: verified category = consultancy (pricing too).', build: () => at('cr-multi', 'CR', 'cr', simWith({}, { activities: ['ACT-7020', 'ACT-4719'] })) },
  { id: 'cr-regulated', group: 'Registered business', label: 'Regulated registered activity', hint: 'Captured internally as Not Eligible; the merchant sees Application submitted.', build: () => at('cr-regulated', 'CR', 'cr', simWith({}, { activities: ['ACT-5630', 'ACT-4777'] })) },
  { id: 'cr-unavailable', group: 'Registered business', label: 'CR provider unavailable', hint: 'Bounded retries in this session; Save & exit; retries reset on resume.', build: () => at('cr-unavailable', 'CR', 'cr', simWith({}, { result: 'unavailable' })) },
  { id: 'cr-no-owner', group: 'Registered business', label: 'No owner or manager on the CR', hint: 'Nobody can authorize in V1 (delegates are Phase 2): captured internally.', build: () => at('cr-no-owner', 'CR', 'cr', simWith({ persons: 'none' })) },

  // Authorization + signer handoff (registered business)
  { id: 'auth-choice', group: 'Authorization & signer', label: 'Authorization choice', hint: 'After Review: “I can complete the authorization myself” or “Send to another signer”.', build: () => atAuthorize('auth-choice') },
  { id: 'auth-self', group: 'Authorization & signer', label: 'Self authorization', hint: 'The preparer is an owner / manager: select yourself → Nafath → Contract.', build: () => selectPerson(chooseAuthMode(atAuthorize('auth-self'), 'self'), 'p1') },
  { id: 'auth-signer', group: 'Authorization & signer', label: 'Send to another signer', hint: 'Select an owner / manager on the CR + their Nafath mobile → Send Authorization.', build: () => chooseAuthMode(atAuthorize('auth-signer'), 'signer') },
  { id: 'handoff-active', group: 'Authorization & signer', label: 'Handoff active (preparer status)', hint: 'Application and offer frozen; status only; no signer / mobile change in Phase 1.', build: () => handoff('handoff-active') },
  { id: 'signer-link', group: 'Authorization & signer', label: 'Signer opens the secure link', hint: 'No OTP. Masked request only — no application details before Nafath.', build: () => signerOpens(handoff('signer-link')) },
  { id: 'signer-nafath', group: 'Authorization & signer', label: 'Signer Nafath', hint: 'Mobile ↔ National ID for the signer mobile, then Nafath.', build: () => signerAtNafath('signer-nafath') },
  { id: 'signer-nafath-fail', group: 'Authorization & signer', label: 'Signer Nafath fails twice', hint: 'Authorization not completed; the application stays saved.', build: () => signerAtNafath('signer-nafath-fail', simWith({ nafath: ['rejected', 'timeout'] })) },
  { id: 'signer-mismatch', group: 'Authorization & signer', label: 'Signer mobile does not belong to the signer', hint: 'No self-service mobile change in Phase 1: this authorization version ends.', build: () => signerOpens(handoff('signer-mismatch', 0, simWith({ mobileMatch: ['mismatch'] }))) },
  { id: 'signer-review', group: 'Authorization & signer', label: 'Signer read-only review', hint: 'After Nafath: full application + frozen offer, nothing editable.', build: () => signerAtReview('signer-review') },
  { id: 'signer-contract', group: 'Authorization & signer', label: 'Signer contract', hint: 'Agree & Sign submits the application.', build: () => continueFromReview(signerAtReview('signer-contract')) },
  { id: 'handoff-expired', group: 'Authorization & signer', label: 'Handoff expired (preparer)', hint: 'Link no longer works; same application kept; a new authorization version may start.', build: () => handoff('handoff-expired', 8) },
  { id: 'signer-link-expired', group: 'Authorization & signer', label: 'Signer opens an expired link', hint: 'Nothing about the application is shown.', build: () => signerOpens(handoff('signer-link-expired', 8)) },
  { id: 'handoff-v2', group: 'Authorization & signer', label: 'Authorization V2 (same application)', hint: 'V1 expired; V2 sent for the same application ID.', build: () => secondVersion('handoff-v2') },
  { id: 'handoff-limit', group: 'Authorization & signer', label: 'Handoff limit reached', hint: 'Two versions in 30 days: a third is refused until an internal unlock.', build: () => limitReached('handoff-limit') },
  { id: 'delegation-demo', group: 'Authorization & signer', label: 'Delegated signer (Phase 2 demo)', hint: 'MOJ delegation, company document or other document — demo states only.', build: () => openDelegation(atAuthorize('delegation-demo')) },

  // Mobile + Nafath
  { id: 'mm-match', group: 'Mobile & Nafath', label: 'Mobile matches the owner', hint: 'Self authorization: ownership check passes, Nafath request sent.', build: () => at('mm-match', 'CR', 'nafath') },
  { id: 'mm-mismatch', group: 'Mobile & Nafath', label: 'Mobile does not belong to the selected owner', hint: 'Use another mobile → OTP → check again → Nafath. Progress kept.', build: () => at('mm-mismatch', 'CR', 'nafath', simWith({ mobileMatch: ['mismatch', 'match'] })) },
  { id: 'mm-blocked', group: 'Mobile & Nafath', label: 'Still a mismatch after the correction', hint: 'Verification step paused; progress saved; no Nafath call.', build: () => at('mm-blocked', 'CR', 'nafath', simWith({ mobileMatch: ['mismatch', 'mismatch'] })) },
  { id: 'nafath-fail', group: 'Mobile & Nafath', label: 'Nafath first failure', hint: 'Rejected once: one attempt left.', build: () => at('nafath-fail', 'CR', 'nafath', simWith({ nafath: ['rejected', 'verified'] })) },
  { id: 'nafath-max', group: 'Mobile & Nafath', label: 'Nafath failed twice', hint: 'Registered business: submitted for manual verification, no contract.', build: () => at('nafath-max', 'CR', 'nafath', simWith({ nafath: ['rejected', 'timeout'] })) },
  { id: 'nafath-technical', group: 'Mobile & Nafath', label: 'Nafath technical failures', hint: 'No attempt used; bounded per session.', build: () => at('nafath-technical', 'CR', 'nafath', simWith({ nafath: ['technical'] })) },

  // Freelancer
  { id: 'fl-happy', group: 'Freelancer', label: 'Walk the Freelancer journey', hint: 'From Page 1 to Submit.', build: () => atKyb('fl-happy', KYB_FL) },
  { id: 'fl-certs-multi', group: 'Freelancer', label: 'Several certificates', hint: 'After Review, before Nafath: choose one; its activity becomes the verified category.', build: () => at('fl-certs-multi', 'FL_CERT', 'certificates', simWith({ certificates: 'multiple' }), freshCerts) },
  { id: 'fl-no-cert', group: 'Freelancer', label: 'No certificate found', hint: 'Captured internally before any Nafath cost; the merchant sees Application submitted.', build: () => at('fl-no-cert', 'FL_CERT', 'certificates', simWith({ certificates: 'none' }), freshCerts) },
  { id: 'fl-cert-unavailable', group: 'Freelancer', label: 'Certificate service unavailable', hint: 'Retry later; no Nafath call yet.', build: () => at('fl-cert-unavailable', 'FL_CERT', 'certificates', simWith({ certificates: 'unavailable' }), freshCerts) },
  { id: 'fl-cert-cr-only', group: 'Freelancer', label: 'Certificate activity requires a CR', hint: 'Captured internally after confirmation.', build: () => at('fl-cert-cr-only', 'FL_CERT', 'certificates', simWith({ certificates: 'mismatch' }), freshCerts) },
  { id: 'fl-nafath', group: 'Freelancer', label: 'Freelancer Nafath', hint: 'Certificate chosen; mobile ↔ National ID, then Nafath.', build: () => at('fl-nafath', 'FL_CERT', 'nafath') },
  { id: 'fl-mismatch', group: 'Freelancer', label: 'Mobile not registered to the National ID', hint: 'Same mobile correction as for owners.', build: () => at('fl-mismatch', 'FL_CERT', 'nafath', simWith({ mobileMatch: ['mismatch', 'match'] })) },

  // Business Details
  { id: 'biz-cr-both', group: 'Business Details', label: 'Registered business: website + Google Maps', hint: 'No IBAN, VAT or branch count for a registered business.', build: () => at('biz-cr-both', 'CR', 'business') },
  { id: 'biz-fl', group: 'Business Details', label: 'Freelancer: website + IBAN linkage', hint: 'IBAN verified against the National ID; the certificate is chosen after Review.', build: () => at('biz-fl', 'FL_CERT', 'business') },
  { id: 'biz-fl-iban-fail', group: 'Business Details', label: 'Freelancer IBAN not linked', hint: 'Two mismatches for an IBAN: enter another IBAN. Technical errors do not count.', build: () => at('biz-fl-iban-fail', 'FL_CERT', 'business', simWith({ iban: ['mismatch', 'mismatch', 'verified'] })) },

  // Commercial
  { id: 'com-standard', group: 'Commercial Offer', label: 'Standard offer', hint: 'One rate from the verified category → Continue. No plan selection.', build: () => at('com-standard', 'CR', 'commercial') },
  { id: 'com-review', group: 'Commercial Offer', label: 'Rate review requested', hint: 'Interest kept without a file; standard offer continues.', build: () => at('com-review', 'CR', 'commercial', simWith(), (a) => ({ ...a, commercial: { ...a.commercial, reviewRequested: true }, flags: [...a.flags, 'COMMERCIAL_RATE_REVIEW_REQUESTED'] })) },
  { id: 'com-upload', group: 'Commercial Offer', label: 'Rate review with evidence', hint: 'Optional file added; never blocks.', build: () => at('com-upload', 'CR', 'commercial', simWith(), (a) => ({ ...a, commercial: { ...a.commercial, reviewRequested: true, evidence: ['doc-a'] }, flags: [...a.flags, 'COMMERCIAL_RATE_REVIEW_REQUESTED'] })) },

  // Review / contract
  { id: 'review', group: 'Review & contract', label: 'Review with locked verified sections', hint: 'Only store presence and the rate review can be edited; then the Authorization choice.', build: () => at('review', 'CR', 'review') },
  { id: 'review-fl', group: 'Review & contract', label: 'Freelancer review', hint: 'Details, IBAN and offer; the certificate is chosen next.', build: () => at('review-fl', 'FL_CERT', 'review') },
  { id: 'contract', group: 'Review & contract', label: 'Contract (self authorization)', hint: 'Agree & Submit: one action. Standard commission only.', build: () => at('contract', 'CR', 'contract') },
  { id: 'contract-fl', group: 'Review & contract', label: 'Contract (Freelancer)', hint: 'Agree & Submit.', build: () => at('contract-fl', 'FL_CERT', 'contract') },
  { id: 'submit-manual', group: 'Review & contract', label: 'Submitted for manual verification', hint: 'Freelancer Nafath failed twice: Continue submits without a contract.', build: () => at('submit-manual', 'FL_CERT', 'nafath', simWith(), (a) => ({ ...a, nafath: { ...a.nafath, status: 'exhausted', failures: 2, verifiedFor: null }, verifications: { ...a.verifications, NAFATH: undefined }, flags: [...a.flags, 'NAFATH_UNVERIFIED'] })) },

  // Status
  { id: 'status-submitted', group: 'Application status', label: 'Submitted', hint: 'Application Progress after the registered-mobile code.', build: () => at('status-submitted', 'CR', 'status') },
  { id: 'status-review', group: 'Application status', label: 'Under review', hint: 'Status only; nothing editable.', build: () => at('status-review', 'CR', 'status', simWith(), withStatus('UNDER_REVIEW')) },
  { id: 'status-action', group: 'Application status', label: 'Action required', hint: 'The team contacts the merchant; onboarding is not reopened.', build: () => at('status-action', 'CR', 'status', simWith(), withStatus('ACTION_REQUIRED')) },
  { id: 'status-approved', group: 'Application status', label: 'Approved', hint: 'Approved is not live: no activation claim.', build: () => at('status-approved', 'CR', 'status', simWith(), withStatus('APPROVED')) }
];

export const scenarioById = (id: string | null) => SCENARIOS.find((s) => s.id === id) ?? null;

/** The eight target workflows (Start demo) and the detailed cases inside them. */
export const WORKFLOWS = [
  'New Eligible CR Merchant',
  'New Eligible Freelancer',
  'Not Eligible Application',
  'Existing In-Progress CR Merchant — Resume',
  'Existing In-Progress Freelancer — Resume',
  'Submitted Application',
  'Existing Live Merchant',
  'CR Merchant Signer Flow'
] as const;
export type Workflow = (typeof WORKFLOWS)[number];

/** Full-journey starting points for "Start demo", grouped by workflow. */
export const JOURNEY_PRESETS: Array<{ id: string; workflow: Workflow; label: string; hint: string }> = [
  { id: 'cr-happy', workflow: 'New Eligible CR Merchant', label: 'New eligible CR merchant', hint: 'Page 1 filled in. Check eligibility, then code 246810.' },
  { id: 'auth-self', workflow: 'New Eligible CR Merchant', label: 'Self authorization', hint: 'At the Authorization choice: the preparer signs.' },
  { id: 'mm-mismatch', workflow: 'New Eligible CR Merchant', label: 'Mobile mismatch before Nafath', hint: 'Use another mobile → OTP → check again.' },
  { id: 'cr-expired', workflow: 'New Eligible CR Merchant', label: 'Expired CR', hint: 'Saved and handed to Sales; no further paid checks.' },
  { id: 'review', workflow: 'New Eligible CR Merchant', label: 'Review & edit', hint: 'Locked verified sections; transactional edit.' },
  { id: 'fl-happy', workflow: 'New Eligible Freelancer', label: 'New eligible Freelancer', hint: 'Freelancer with a certificate, from Page 1.' },
  { id: 'kyb-unsupported', workflow: 'Not Eligible Application', label: 'Not eligible: registered business', hint: 'Identify + code, then Application submitted (reason internal).' },
  { id: 'kyb-fl-no-cert', workflow: 'Not Eligible Application', label: 'Not eligible: Freelancer without certificate', hint: 'Identify + code, then Application submitted.' },
  { id: 'kyb-fl-unsupported', workflow: 'Not Eligible Application', label: 'Not eligible: Freelancer category', hint: 'Identify + code, then Application submitted.' },
  { id: 'id-incomplete', workflow: 'Existing In-Progress CR Merchant — Resume', label: 'Existing incomplete application', hint: 'Different mobile entered: code to the stored mobile; resume at Business Details.' },
  { id: 'resume-link', workflow: 'Existing In-Progress CR Merchant — Resume', label: 'Resume (Continue link)', hint: 'Only the code; stored checks are reused.' },
  { id: 'id-incomplete-fl', workflow: 'Existing In-Progress Freelancer — Resume', label: 'Existing incomplete Freelancer application', hint: 'Code to the stored mobile; resume at Nafath.' },
  { id: 'resume-link-fl', workflow: 'Existing In-Progress Freelancer — Resume', label: 'Freelancer Continue link', hint: 'Resume at the certificate selection (after Review).' },
  { id: 'id-submitted', workflow: 'Submitted Application', label: 'Submitted application', hint: 'Registered-mobile code → Application Progress.' },
  { id: 'id-live', workflow: 'Existing Live Merchant', label: 'Live merchant', hint: 'Code → “You already have an active account” popup → Log in.' },
  { id: 'auth-signer', workflow: 'CR Merchant Signer Flow', label: 'CR signer handoff', hint: 'Send to another signer from the Authorization choice.' },
  { id: 'handoff-active', workflow: 'CR Merchant Signer Flow', label: 'Handoff active', hint: 'Preparer status page; application frozen.' },
  { id: 'signer-link', workflow: 'CR Merchant Signer Flow', label: 'Signer secure-link entry', hint: 'Masked confirmation → Start Nafath Verification.' },
  { id: 'signer-nafath-fail', workflow: 'CR Merchant Signer Flow', label: 'Signer Nafath failure', hint: 'Two failed Nafath attempts: authorization not completed.' },
  { id: 'handoff-expired', workflow: 'CR Merchant Signer Flow', label: 'Handoff expired', hint: 'Configurable 7 days; the application stays.' },
  { id: 'handoff-v2', workflow: 'CR Merchant Signer Flow', label: 'Authorization V1 / V2', hint: 'Second version on the same application.' },
  { id: 'handoff-limit', workflow: 'CR Merchant Signer Flow', label: 'Handoff limit reached', hint: '2 handoffs in 30 days: internal unlock needed.' },
  { id: 'delegation-demo', workflow: 'CR Merchant Signer Flow', label: 'Delegated signer (Phase 2 demo)', hint: 'Demo states only.' }
];
