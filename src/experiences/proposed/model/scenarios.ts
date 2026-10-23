/**
 * Scenario presets for the Prototype Controls. Each sets the simulated provider answers (Sim) and,
 * where useful, a prefilled application at the screen where the behaviour shows. Numbers 1–60 follow
 * the required list of the 2026-10-23 journey update; "+" scenarios are extra.
 */
import { evaluateEligibility } from './eligibility';
import { DEMO } from './mock';
import { initialApplication, initialSim, leaveSession, openContinueLink, prefill, sendContinueLink, withSaved } from './state';
import type { Application, Kyb, ProposedState, Sim, StepId } from './types';

export type ScenarioGroup =
  | 'Know Your Business'
  | 'Identify & resume'
  | 'Government & activity'
  | 'Nafath'
  | 'Freelancer'
  | 'Banking'
  | 'Commercial Offer'
  | 'Review & edit'
  | 'Contract & submit';

export const SCENARIO_GROUPS: ScenarioGroup[] = ['Know Your Business', 'Identify & resume', 'Government & activity', 'Nafath', 'Freelancer', 'Banking', 'Commercial Offer', 'Review & edit', 'Contract & submit'];

export interface Scenario {
  id: string;
  /** Number in the required list (1–60); undefined = extra scenario. */
  n?: number;
  group: ScenarioGroup;
  label: string;
  hint: string;
  /** For resume scenarios: the ledger position when the Continue link was opened. */
  build: () => ProposedState;
}

const simWith = (patch: Partial<Sim> = {}, cr: Partial<Sim['cr']> = {}): Sim => {
  const base = initialSim();
  return { ...base, ...patch, cr: { ...base.cr, ...cr } };
};

/* ------------------------------------------------------------------ builders */

const KYB_CR: Kyb = { kind: 'CR', group: 'retail', sub: 'retail-fashion', revenue: 'SELF_SERVICE_BAND', channel: 'online', websiteUrl: 'https://najdboutique.example.com', mapsUrl: '' };

/** Stage-1 page filled in, ready for Next. */
function atKyb(id: string, kyb: Partial<Kyb>, sim: Sim = simWith()): ProposedState {
  const app: Application = { ...initialApplication(1_760_000_000_000 + id.length), kyb: { ...KYB_CR, ...kyb } };
  return { ...withSaved(app, sim, id), app };
}

/** Stage 1 passed, identification form filled in, ready for Next. */
function atIdentify(id: string, kind: 'CR' | 'FL_CERT', sim: Sim = simWith()): ProposedState {
  const base = prefill(kind, 'identify', sim);
  const app: Application = { ...initialApplication(1_760_000_100_000 + id.length), kyb: base.kyb, eligibility: base.eligibility, step: 'identify', lastStep: 'identify', identity: { identifier: kind === 'CR' ? DEMO.cr : DEMO.nationalId, mobile: DEMO.mobile } };
  return { ...withSaved(app, sim, id), app };
}

/** Prefilled healthy application stopped at `step`, saved in the backend. */
function at(id: string, kind: 'CR' | 'FL_CERT', step: StepId, sim: Sim = simWith(), patch: (a: Application) => Application = (a) => a): ProposedState {
  return withSaved(patch(prefill(kind, step, sim)), sim, id);
}

/** The application was saved at `savedAt`; the visitor left; the Continue link was opened (OTP screen). */
function resumeFrom(id: string, kind: 'CR' | 'FL_CERT', savedAt: StepId, sim: Sim = simWith(), patch: (a: Application) => Application = (a) => a): ProposedState {
  let s = withSaved(patch(prefill(kind, savedAt, sim)), sim, id);
  s = sendContinueLink(s);
  const token = Object.keys(s.backend.tokens)[0];
  return { ...openContinueLink(leaveSession(s), token), scenarioId: id };
}

/** Declared subcategory changed (and the snapshot with it). */
const declare = (group: string, sub: string) => (a: Application): Application => {
  const kyb = { ...a.kyb, group, sub };
  const eligibility = evaluateEligibility({ kind: kyb.kind!, sub, revenue: kyb.revenue!, channel: kyb.channel! }, '2026-10-23T08:00:00.000Z');
  return { ...a, kyb, eligibility, kybSnapshot: a.kybSnapshot ? { ...a.kybSnapshot, group, sub, eligibility } : null };
};

const idleNafath = (a: Application): Application => ({ ...a, nafath: { ...a.nafath, status: 'idle', requests: 0, failures: 0, lastResult: null, verifiedFor: null } });
const idleCerts = (a: Application): Application => ({ ...a, certs: { status: 'idle', tries: 0, list: [], selectedId: null }, activity: null });
const openIban = (a: Application): Application => ({ ...a, business: { ...a.business, ibanStatus: 'idle', ibanLast: null, bankName: '' }, verifications: { ...a.verifications, IBAN: undefined } });
const offer = (optional: Application['commercial']['optional'], evidence: string[] = []) => (a: Application): Application => ({ ...a, commercial: { optional, evidence, evidenceSkipped: false, agreed: null } });

/* ------------------------------------------------------------------ the list */

export const SCENARIOS: Scenario[] = [
  // Know Your Business / eligibility
  { id: 'kyb-cr-online', n: 1, group: 'Know Your Business', label: 'Eligible CR — Online', hint: 'Next: eligible. Identity is asked only now. Walk on with code 246810.', build: () => atKyb('kyb-cr-online', {}) },
  { id: 'kyb-cr-offline', n: 2, group: 'Know Your Business', label: 'Eligible CR — Offline', hint: 'Offline needs a Google Maps link instead of a website.', build: () => atKyb('kyb-cr-offline', { group: 'food', sub: 'food-cafe', channel: 'offline', websiteUrl: '', mapsUrl: 'https://maps.google.com/?q=24.7136,46.6753' }) },
  { id: 'kyb-cr-both', n: 3, group: 'Know Your Business', label: 'Eligible CR — Both', hint: 'Both channels: website and Google Maps link are required.', build: () => atKyb('kyb-cr-both', { group: 'food', sub: 'food-cafe', channel: 'both', mapsUrl: 'https://maps.app.goo.gl/demo123' }) },
  { id: 'kyb-blocked', n: 4, group: 'Know Your Business', label: 'Blocked category', hint: 'Not eligible, stopped before any external call. Reason code stays internal.', build: () => atKyb('kyb-blocked', { group: 'fixture', sub: 'fixture-blocked' }) },
  { id: 'kyb-fl-cr-required', n: 5, group: 'Know Your Business', label: 'Category requires CR, applicant is Freelancer', hint: 'Freelancer + an activity that needs a CR: cannot continue as Freelancer.', build: () => atKyb('kyb-fl-cr-required', { kind: 'FL_CERT', group: 'food', sub: 'food-cafe' }) },
  { id: 'kyb-fl-offline', n: 6, group: 'Know Your Business', label: 'Freelancer category not allowed Offline', hint: 'Electronics is online-only for Freelancers in the fixture.', build: () => atKyb('kyb-fl-offline', { kind: 'FL_CERT', group: 'retail', sub: 'retail-electronics', channel: 'offline', websiteUrl: '', mapsUrl: 'https://maps.google.com/?q=21.4858,39.1925' }) },
  { id: 'kyb-fl-no-cert', n: 7, group: 'Know Your Business', label: 'Freelancer without certificate → Lead', hint: 'Not discarded: contact details + OTP, saved as a lead. No verification screens.', build: () => atKyb('kyb-fl-no-cert', { kind: 'FL_NO_CERT', group: 'services', sub: 'services-design' }) },
  { id: 'kyb-bad-website', n: 8, group: 'Know Your Business', label: 'Invalid website', hint: 'Press Next: the website is rejected (no https:// and no real domain).', build: () => atKyb('kyb-bad-website', { websiteUrl: 'my-store' }) },
  { id: 'kyb-social-website', n: 9, group: 'Know Your Business', label: 'Social-media URL rejected as website', hint: 'Press Next: an Instagram page is not the merchant’s own website.', build: () => atKyb('kyb-social-website', { websiteUrl: 'https://instagram.com/najdboutique' }) },
  { id: 'kyb-bad-maps', n: 10, group: 'Know Your Business', label: 'Invalid / non-Google Maps offline URL', hint: 'Press Next: only Google Maps location links are accepted.', build: () => atKyb('kyb-bad-maps', { group: 'food', sub: 'food-cafe', channel: 'offline', websiteUrl: '', mapsUrl: 'https://example.com/our-location' }) },

  // Identification / resume
  { id: 'id-new-cr', n: 11, group: 'Identify & resume', label: 'New CR application', hint: 'CR + mobile, then OTP. The Stage-1 record is linked to the new application.', build: () => atIdentify('id-new-cr', 'CR') },
  { id: 'id-new-fl', n: 12, group: 'Identify & resume', label: 'New Freelancer application', hint: 'National ID + mobile, then OTP.', build: () => atIdentify('id-new-fl', 'FL_CERT') },
  { id: 'id-dup-cr', n: 13, group: 'Identify & resume', label: 'Duplicate CR', hint: 'An application exists for this CR under another mobile: no new application.', build: () => atIdentify('id-dup-cr', 'CR', simWith({ identity: 'duplicate_identity' })) },
  { id: 'id-dup-nid', n: 14, group: 'Identify & resume', label: 'Duplicate National ID', hint: 'Same for a Freelancer National ID.', build: () => atIdentify('id-dup-nid', 'FL_CERT', simWith({ identity: 'duplicate_identity' })) },
  {
    id: 'id-existing', n: 15, group: 'Identify & resume', label: 'Existing incomplete application', hint: 'Same CR + same mobile: after OTP the saved application opens at its first incomplete screen.',
    build: () => { const s = at('id-existing', 'CR', 'business'); const cur = atIdentify('id-existing', 'CR'); return { ...s, app: cur.app }; }
  },
  { id: 'resume-link', n: 16, group: 'Identify & resume', label: 'Continue link → OTP → resume Stage 3+', hint: 'Opened from the SMS link: only the code is asked, then Stage 3 opens.', build: () => resumeFrom('resume-link', 'FL_CERT', 'nafath', simWith(), idleNafath) },
  { id: 'resume-cr', n: 17, group: 'Identify & resume', label: 'Resume after CR verified', hint: 'After the code: the CR data is reused (no registry call). See Internal state.', build: () => resumeFrom('resume-cr', 'CR', 'persons', simWith(), (a) => ({ ...a, persons: { status: 'idle', tries: 0, list: [], selectedId: null } })) },
  { id: 'resume-nafath', n: 18, group: 'Identify & resume', label: 'Resume after Nafath verified', hint: 'After the code: Nafath is not requested again.', build: () => resumeFrom('resume-nafath', 'CR', 'business', simWith(), openIban) },
  { id: 'resume-iban', n: 19, group: 'Identify & resume', label: 'Resume after IBAN verified', hint: 'After the code: the IBAN check is reused; the Commercial Offer opens.', build: () => resumeFrom('resume-iban', 'CR', 'commercial', simWith(), (a) => ({ ...a, commercial: { optional: [], evidence: [], evidenceSkipped: false, agreed: null } })) },

  // Government / eligibility
  { id: 'gov-young', n: 20, group: 'Government & activity', label: 'CR 3 months old or less', hint: 'Temporarily not eligible: the applicant can apply later.', build: () => at('gov-young', 'CR', 'cr-verify', simWith({}, { issuedMonthsAgo: 2 })) },
  { id: 'gov-expired', n: 21, group: 'Government & activity', label: 'CR expired', hint: 'No automatic onboarding: manual verification.', build: () => at('gov-expired', 'CR', 'cr-verify', simWith({}, { status: 'EXPIRED' })) },
  { id: 'gov-suspended', n: 22, group: 'Government & activity', label: 'CR suspended', hint: 'Not eligible; reason stays internal.', build: () => at('gov-suspended', 'CR', 'cr-verify', simWith({}, { status: 'SUSPENDED' })) },
  { id: 'gov-violation', n: 23, group: 'Government & activity', label: 'CR government violation', hint: 'No automatic onboarding: manual verification.', build: () => at('gov-violation', 'CR', 'cr-verify', simWith({}, { status: 'VIOLATION' })) },
  { id: 'gov-docs-later', n: 24, group: 'Government & activity', label: 'CR needs extra documents later', hint: 'Non-Saudi entity: the clean journey continues; "additional documents" is an internal flag.', build: () => at('gov-docs-later', 'CR', 'cr-verify', simWith({}, { entity: 'NON_SAUDI' })) },
  { id: 'gov-address', n: 25, group: 'Government & activity', label: 'National Address missing / expired', hint: 'Continues; flagged for operations.', build: () => at('gov-address', 'CR', 'cr-verify', simWith({}, { nationalAddress: 'MISSING' })) },
  { id: 'act-match', n: 26, group: 'Government & activity', label: 'Declared category matches CR activity', hint: 'MATCH: continue.', build: () => at('act-match', 'CR', 'cr-verify') },
  { id: 'act-compatible', n: 27, group: 'Government & activity', label: 'Compatible category / activity', hint: 'COMPATIBLE: continue.', build: () => at('act-compatible', 'CR', 'cr-verify', simWith({}, { activity: 'ACT-4719' }), declare('retail', 'retail-electronics')) },
  { id: 'act-ambiguous', n: 28, group: 'Government & activity', label: 'Category / activity ambiguous', hint: 'AMBIGUOUS: continue, flagged for manual review.', build: () => at('act-ambiguous', 'CR', 'cr-verify', simWith({}, { activity: 'ACT-4719' }), declare('retail', 'retail-fashion')) },
  { id: 'act-conflict', n: 29, group: 'Government & activity', label: 'Category / activity conflict', hint: 'CONFLICT: change the category, or continue and let the team confirm (no automatic contract).', build: () => at('act-conflict', 'CR', 'cr-verify', simWith({}, { activity: 'ACT-7020' })) },

  // Nafath
  { id: 'nafath-ok', n: 30, group: 'Nafath', label: 'Nafath success', hint: 'Send the request; it is approved.', build: () => at('nafath-ok', 'CR', 'nafath', simWith(), idleNafath) },
  { id: 'nafath-fail-once', n: 31, group: 'Nafath', label: 'Nafath first failure', hint: 'Rejected once: retry or choose another person (counter shared).', build: () => at('nafath-fail-once', 'CR', 'nafath', simWith({ nafath: ['rejected', 'verified'] }), idleNafath) },
  { id: 'nafath-max', n: 32, group: 'Nafath', label: 'Nafath max failures → manual', hint: 'Two failures: unverified, business details still collected, no contract.', build: () => at('nafath-max', 'CR', 'nafath', simWith({ nafath: ['rejected', 'timeout'] }), idleNafath) },
  { id: 'nafath-resume', n: 33, group: 'Nafath', label: 'Resume after successful Nafath → reuse', hint: 'Freelancer saved after Nafath: after the code, certificates load; Nafath is reused.', build: () => resumeFrom('nafath-resume', 'FL_CERT', 'certificates', simWith(), idleCerts) },

  // Freelancer
  { id: 'fl-cert', n: 34, group: 'Freelancer', label: 'Freelancer certificate retrieved', hint: 'One certificate found and preselected.', build: () => at('fl-cert', 'FL_CERT', 'certificates', simWith(), idleCerts) },
  { id: 'fl-certs-multi', n: 35, group: 'Freelancer', label: 'Multiple certificates', hint: 'Choose one. A certificate with another activity is reconciled against your category.', build: () => at('fl-certs-multi', 'FL_CERT', 'certificates', simWith({ certificates: 'multiple' }), idleCerts) },
  { id: 'fl-no-cert', n: 36, group: 'Freelancer', label: 'No certificate found', hint: 'No document upload fallback: "certificate required" lead.', build: () => at('fl-no-cert', 'FL_CERT', 'certificates', simWith({ certificates: 'none' }), idleCerts) },
  { id: 'fl-bank-yes', n: 37, group: 'Freelancer', label: 'Bank linked to certificate = Yes', hint: 'Answer Yes, enter the IBAN, verify against the individual + certificate.', build: () => at('fl-bank-yes', 'FL_CERT', 'business', simWith(), (a) => ({ ...openIban(a), business: { ...a.business, bankLinked: null, iban: '', ibanStatus: 'idle', bankName: '' } })) },
  { id: 'fl-bank-no', n: 38, group: 'Freelancer', label: 'Bank linked = No → banking setup required', hint: 'Answer No: IBAN skipped, the journey continues; internal "banking setup required".', build: () => at('fl-bank-no', 'FL_CERT', 'business', simWith(), (a) => ({ ...openIban(a), business: { ...a.business, bankLinked: null, iban: '', ibanStatus: 'idle', bankName: '' } })) },

  // Banking
  { id: 'iban-ok', n: 39, group: 'Banking', label: 'CR IBAN verified', hint: 'Verify: ownership matches the business.', build: () => at('iban-ok', 'CR', 'business', simWith(), openIban) },
  { id: 'iban-fail', n: 40, group: 'Banking', label: 'IBAN failure', hint: 'Mismatch twice: continue unverified (financial review).', build: () => at('iban-fail', 'CR', 'business', simWith({ iban: ['mismatch', 'mismatch'] }), openIban) },
  { id: 'iban-change', n: 41, group: 'Banking', label: 'IBAN changed → only IBAN re-verified', hint: 'Review › Edit banking › change the IBAN: only the IBAN check is invalidated.', build: () => at('iban-change', 'CR', 'review') },
  { id: 'iban-resume', n: 42, group: 'Banking', label: 'Resume with the same verified IBAN → reuse', hint: 'Saved at Review: after the code nothing is re-checked.', build: () => resumeFrom('iban-resume', 'CR', 'review') },

  // Commercial
  { id: 'com-standard', n: 43, group: 'Commercial Offer', label: 'Standard commission accepted', hint: 'Continue with the standard commission.', build: () => at('com-standard', 'CR', 'commercial', simWith(), offer([])) },
  { id: 'com-skip', n: 44, group: 'Commercial Offer', label: 'Optional pricing evidence skipped', hint: 'Nothing uploaded: onboarding is not blocked.', build: () => at('com-skip', 'CR', 'commercial', simWith(), offer([])) },
  { id: 'com-upload', n: 45, group: 'Commercial Offer', label: 'Optional pricing evidence uploaded', hint: 'Continue with the standard commission; internal Commercial pricing review.', build: () => at('com-upload', 'CR', 'commercial', simWith(), offer([], ['doc-a'])) },
  { id: 'com-base', n: 46, group: 'Commercial Offer', label: 'Base 3 / 4-month plans only', hint: '3 and 4 months are included and cannot be removed.', build: () => at('com-base', 'CR', 'commercial', simWith(), offer([])) },
  { id: 'com-6', n: 47, group: 'Commercial Offer', label: 'Add 6-month', hint: '6 months selected.', build: () => at('com-6', 'CR', 'commercial', simWith(), offer([6])) },
  { id: 'com-6-9', n: 48, group: 'Commercial Offer', label: 'Add 6 + 9', hint: '6 and 9 months selected.', build: () => at('com-6-9', 'CR', 'commercial', simWith(), offer([6, 9])) },
  { id: 'com-6-9-12', n: 49, group: 'Commercial Offer', label: 'Add 6 + 9 + 12', hint: 'All optional plans selected.', build: () => at('com-6-9-12', 'CR', 'commercial', simWith(), offer([6, 9, 12])) },
  { id: 'com-remove', n: 50, group: 'Commercial Offer', label: 'Remove an optional tenure', hint: 'Untick one before Continue: the summary updates.', build: () => at('com-remove', 'CR', 'commercial', simWith(), offer([6, 9, 12])) },

  // Review / edit
  { id: 'edit-website', n: 51, group: 'Review & edit', label: 'Edit website', hint: 'Edit Know Your Business, change the website: no CR / Nafath / IBAN re-check.', build: () => at('edit-website', 'CR', 'review') },
  { id: 'edit-iban', n: 52, group: 'Review & edit', label: 'Edit IBAN', hint: 'Only the IBAN verification is invalidated.', build: () => at('edit-iban', 'CR', 'review') },
  { id: 'edit-category', n: 53, group: 'Review & edit', label: 'Edit category', hint: 'Eligibility and reconciliation re-run on the stored CR activity; no provider call.', build: () => at('edit-category', 'CR', 'review') },
  { id: 'edit-identity', n: 54, group: 'Review & edit', label: 'Edit identity / CR', hint: 'A new CR invalidates CR data, people, Nafath and IBAN; the journey resumes at Business Verification.', build: () => at('edit-identity', 'CR', 'review') },

  // Contract / submit
  { id: 'contract-accept', n: 55, group: 'Contract & submit', label: 'Contract accepted', hint: 'Contract only: read, accept, submit. Plans are shown, not selectable.', build: () => at('contract-accept', 'CR', 'contract') },
  { id: 'contract-decline', n: 56, group: 'Contract & submit', label: 'Contract declined', hint: 'Decline: not submitted; return to the contract later.', build: () => at('contract-decline', 'CR', 'contract') },
  { id: 'submit-full', n: 57, group: 'Contract & submit', label: 'Full self-service submitted', hint: 'Walk the whole CR journey from Know Your Business to Submit (code 246810).', build: () => atKyb('submit-full', {}) },
  { id: 'submit-manual', n: 58, group: 'Contract & submit', label: 'Manual verification outcome', hint: 'Nafath failed twice: Review submits for manual verification, no contract.', build: () => at('submit-manual', 'CR', 'review', simWith(), (a) => ({ ...a, nafath: { ...a.nafath, status: 'exhausted', failures: 2, verifiedFor: null }, verifications: { ...a.verifications, NAFATH: undefined }, flags: ['NAFATH_UNVERIFIED'], contract: { status: 'unavailable', acceptedAt: '' } })) },
  { id: 'submit-banking', n: 59, group: 'Contract & submit', label: 'Banking pending outcome', hint: 'Freelancer without a linked bank account: contract allowed (provisional rule flag), submitted with banking follow-up.', build: () => at('submit-banking', 'FL_CERT', 'contract', simWith(), (a) => ({ ...a, business: { ...a.business, bankLinked: 'no', iban: '', ibanStatus: 'skipped', bankName: '' }, verifications: { ...a.verifications, IBAN: undefined }, flags: ['BANKING_SETUP_REQUIRED'] })) },
  { id: 'submit-lead', n: 60, group: 'Contract & submit', label: 'Sales lead outcome', hint: 'CR above SAR 20M: contact details + OTP, then the Sales thank-you.', build: () => atKyb('submit-lead', { revenue: 'ABOVE_20M' }) },

  // Extra
  { id: 'x-walk-fl', group: 'Freelancer', label: 'Walk the Freelancer journey', hint: 'From Know Your Business to Submit, as a Freelancer with a certificate.', build: () => atKyb('x-walk-fl', { kind: 'FL_CERT', group: 'services', sub: 'services-design' }) },
  { id: 'x-cr-low', group: 'Know Your Business', label: 'CR below SAR 100K → lead', hint: 'Lead capture; the Business Team rejects under the proposed policy.', build: () => atKyb('x-cr-low', { revenue: 'BELOW_100K' }) },
  { id: 'x-paused', group: 'Know Your Business', label: 'Category temporarily paused', hint: 'Temporarily not eligible at Stage 1.', build: () => atKyb('x-paused', { group: 'fixture', sub: 'fixture-paused' }) },
  { id: 'x-regulated', group: 'Government & activity', label: 'Fashion declared, gold & jewellery registered', hint: 'The CR activity is regulated: stops; the declared category cannot hide it.', build: () => at('x-regulated', 'CR', 'cr-verify', simWith({}, { activity: 'ACT-4777' }), declare('retail', 'retail-fashion')) },
  { id: 'x-cr-unavailable', group: 'Government & activity', label: 'CR provider unavailable', hint: 'Bounded retries; progress kept; come back with the Continue link.', build: () => at('x-cr-unavailable', 'CR', 'cr-verify', simWith({}, { result: 'unavailable' })) },
  { id: 'x-no-people', group: 'Nafath', label: 'No eligible individual on the CR', hint: 'Only a company: manual authority check, no Nafath, no contract.', build: () => at('x-no-people', 'CR', 'persons', simWith({ persons: 'none' }), (a) => ({ ...a, persons: { status: 'idle', tries: 0, list: [], selectedId: null } })) },
  { id: 'x-nafath-technical', group: 'Nafath', label: 'Nafath technical failure', hint: 'Does not use an attempt (provisional rule flag).', build: () => at('x-nafath-technical', 'CR', 'nafath', simWith({ nafath: ['technical', 'verified'] }), idleNafath) },
  { id: 'x-fl-mismatch', group: 'Freelancer', label: 'Certificate activity requires a CR', hint: 'The only certificate is for an activity a Freelancer cannot onboard: stops.', build: () => at('x-fl-mismatch', 'FL_CERT', 'certificates', simWith({ certificates: 'mismatch' }), idleCerts) },
  { id: 'x-otp-errors', group: 'Identify & resume', label: 'OTP errors', hint: 'Wrong codes (3 attempts), expiry from the controls, resend.', build: () => { const s = atIdentify('x-otp-errors', 'CR'); return { ...s, app: { ...s.app, step: 'otp', otp: { purpose: 'application', status: 'incorrect', attemptsLeft: 2, code: '135790', resendAt: Date.now() + 20_000 } } }; } },
  { id: 'x-edit-mobile', group: 'Review & edit', label: 'Edit mobile', hint: 'Review › Edit identification › new mobile: a new code is required, nothing else.', build: () => at('x-edit-mobile', 'CR', 'review') }
];

export const scenarioById = (id: string | null) => SCENARIOS.find((s) => s.id === id) ?? null;

/**
 * Full-journey starting points for the separate "Start demo" area. Inside a page, the controls are
 * the Page Scenarios of that page only (model/pageScenarios.ts). SCENARIOS above is the complete
 * scenario catalogue used by the automated tests, the PDF and the docs.
 */
export const JOURNEY_PRESETS: Array<{ id: string; label: string; hint: string }> = [
  { id: 'submit-full', label: 'Happy path — registered business', hint: 'Know Your Business filled in. Check eligibility, then code 246810.' },
  { id: 'x-walk-fl', label: 'Happy path — Freelancer', hint: 'Freelancer with a certificate, from Know Your Business.' },
  { id: 'submit-lead', label: 'Sales lead', hint: 'Registered business above SAR 20M: contact + code, then the Sales thank-you.' },
  { id: 'kyb-fl-no-cert', label: 'Freelancer without certificate', hint: 'Becomes a lead; no verification screens.' },
  { id: 'iban-resume', label: 'Resume application (Continue link)', hint: 'Opened from the SMS link: only the code; stored checks are reused.' },
  { id: 'edit-website', label: 'Review & edit', hint: 'A complete application at Review: try Edit and watch the Internal view.' }
];
export const REQUIRED_COUNT = SCENARIOS.filter((s) => s.n).length;
