/**
 * Page Scenarios: what can realistically happen on THE CURRENT SCREEN, and nothing else.
 *
 * Each screen declares its title, the simulated integrations it touches and groups of human-readable
 * options. Every option is a pure function over the same transitions the prototype runs, so a
 * simulated outcome is exactly what the real screen would produce. The Prototype Controls panel renders
 * only the definition of the current step; there is no global scenario matrix inside the journey.
 */
import { LIMITS } from './config';
import { DEMO, DEMO_SMS_CODE, demoIban, eligiblePersons } from './mock';
import {
  addEvidence, asksPrerequisite, editMobileFromOtp, expireOtp, failUpload, finishIbanCheck, goLive, loadCertificates, nafathResult,
  requestRateReview, resendOtp, runBusinessVerification, runCertificatePrecheck, salesRecoverCr, selectPerson, sendToNafath, setIban,
  setIdentity, setKyb, setPresence, setReviewStatus, startEdit, startIbanCheck, verifyOtp, withdrawRateReview
} from './state';
import type { Application, CertificatesResult, Existence, IbanResult, Kyb, Lifecycle, MobileMatchResult, NafathResult, PersonsResult, ProposedState, Sim, StepId } from './types';

export interface PageOption {
  id: string;
  label: string;
  run: (s: ProposedState) => ProposedState;
  /** Highlights the option that matches the current simulated state. */
  current?: (s: ProposedState) => boolean;
}
export interface PageGroup { title: string; note?: string; options: PageOption[] }
export interface PageDef {
  title: string;
  /** One line: what this screen does. */
  intro: string;
  /** Simulated integrations relevant to this screen (shown to reviewers). */
  integrations: string[];
  groups: (s: ProposedState) => PageGroup[];
}

/* ------------------------------------------------------------------ helpers */

const app = (s: ProposedState, patch: Partial<Application>): ProposedState => ({ ...s, app: { ...s.app, ...patch } });
const sim = (s: ProposedState, patch: Partial<Sim>): ProposedState => ({ ...s, sim: { ...s.sim, ...patch } });
const dropRecords = (a: Application, ...types: Array<keyof Application['verifications']>): Application['verifications'] => {
  const v = { ...a.verifications };
  for (const t of types) delete v[t];
  return v;
};

/* ------------------------------------------------------------------ Page 1 */

const KYB_BASE: Kyb = { kind: 'CR', group: 'retail', sub: 'retail-fashion', revenue: 'SELF_SERVICE_BAND', channel: 'online' };
const fillKyb = (patch: Partial<Kyb>) => (s: ProposedState) => setKyb(s, { ...KYB_BASE, ...patch });

const kyb: PageDef = {
  title: 'Know Your Business',
  intro: 'Preliminary eligibility from five answers, decided internally before any identity, OTP or paid check. Options fill the form; press Check eligibility.',
  integrations: ['None — internal eligibility rules only'],
  groups: () => [{
    title: 'Eligibility result',
    options: [
      { id: 'eligible', label: 'Self-onboarding (registered business)', run: fillKyb({}) },
      { id: 'eligible-fl', label: 'Self-onboarding (Freelancer)', run: fillKyb({ kind: 'FL_CERT', group: 'services', sub: 'services-design' }) },
      { id: 'sales', label: 'Sales lead (above SAR 20M)', run: fillKyb({ revenue: 'ABOVE_20M' }) },
      { id: 'no-cert', label: 'Freelancer without certificate', run: fillKyb({ kind: 'FL_NO_CERT', group: 'services', sub: 'services-design' }) },
      { id: 'blocked', label: 'Blacklisted category', run: fillKyb({ group: 'fixture', sub: 'fixture-blocked' }) },
      { id: 'cr-required', label: 'Freelancer: activity requires a CR', run: fillKyb({ kind: 'FL_CERT', group: 'food', sub: 'food-cafe' }) },
      { id: 'channel', label: 'Freelancer: online-only category, sells offline', run: fillKyb({ kind: 'FL_CERT', group: 'retail', sub: 'retail-electronics', channel: 'offline' }) }
    ]
  }]
};

/* ------------------------------------------------------------------ Page 2 */

const existenceOpt = (id: Sim['existence'], label: string): PageOption => ({
  id: `exists-${id}`, label,
  run: (x) => setIdentity(sim(x, { existence: id }), { identifier: x.app.identity.identifier || (x.app.kyb.kind === 'CR' ? DEMO.cr : DEMO.nationalId), mobile: x.app.identity.mobile || DEMO.mobile }),
  current: (x) => x.sim.existence === id
});

const identify: PageDef = {
  title: 'Identifier + mobile',
  intro: 'CR / National ID, mobile and the prerequisite question. Send code runs an internal record lookup first (no provider): new → code to this mobile; existing → code to the REGISTERED mobile.',
  integrations: ['Madfu application and merchant records (internal)', 'SMS OTP service (next)'],
  groups: (s) => {
    const groups: PageGroup[] = [{
      title: 'Record lookup (internal)',
      options: [
        existenceOpt('auto', 'New applicant'),
        existenceOpt('incomplete', 'Application already in progress'),
        existenceOpt('submitted', 'Application already submitted'),
        existenceOpt('live', 'Already a Madfu merchant')
      ]
    }];
    if (asksPrerequisite(s.app)) {
      const cr = s.app.kyb.kind === 'CR';
      groups.push({
        title: cr ? 'Owner or manager on the CR?' : 'IBAN linked to the certificate?',
        options: [
          { id: 'pre-yes', label: 'Yes → continue', run: (x) => setIdentity(x, { prerequisite: 'yes' }), current: (x) => x.app.identity.prerequisite === 'yes' },
          { id: 'pre-no', label: cr ? 'No → not available online (V1)' : 'No → link the bank account first', run: (x) => setIdentity(x, { prerequisite: 'no' }), current: (x) => x.app.identity.prerequisite === 'no' }
        ]
      });
    }
    groups.push({
      title: 'Abuse controls',
      note: 'OTP is not the only control: rate limiting and a bot challenge protect Page 2.',
      options: [{ id: 'throttle', label: 'Too many requests (rate limit)', run: (x) => sim(x, { rateLimited: !x.sim.rateLimited }), current: (x) => x.sim.rateLimited }]
    });
    return groups;
  }
};

/* ------------------------------------------------------------------ OTP */

const otp: PageDef = {
  title: 'OTP verification',
  intro: `Demo code ${DEMO_SMS_CODE}. ${LIMITS.otpAttempts} attempts per code, ${LIMITS.otpResends} resends; resending never restores the budget.`,
  integrations: ['SMS OTP service'],
  groups: (s) => {
    const o = s.app.otp;
    const blocked = o.status === 'expired' || o.status === 'exhausted' || o.status === 'locked';
    const result: PageGroup = {
      title: o.purpose === 'registered' || o.purpose === 'resume' ? 'OTP result (registered mobile)' : 'OTP result',
      options: blocked ? [] : [
        { id: 'verified', label: 'Verified', run: (x) => verifyOtp(x, DEMO_SMS_CODE) },
        { id: 'incorrect', label: 'Incorrect code', run: (x) => verifyOtp(x, '135790') },
        { id: 'invalid', label: 'Invalid code (wrong format)', run: (x) => verifyOtp(x, '12ab') },
        { id: 'expired', label: 'Expired / timed out', run: expireOtp }
      ]
    };
    const actions: PageGroup = {
      title: 'Actions',
      options: [
        ...(o.resendsLeft > 0 && o.status !== 'locked' ? [{ id: 'resend', label: `Resend code (${o.resendsLeft} left)`, run: resendOtp }] : []),
        ...(o.purpose === 'application' || o.purpose === 'mobile-change' ? [{ id: 'edit-mobile', label: 'Edit mobile number', run: editMobileFromOtp }] : [])
      ]
    };
    return [result, actions];
  }
};

/* ------------------------------------------------------------------ Business verification (CR) */

const CR_DEFAULT: Sim['cr'] = { result: 'found', status: 'ACTIVE', ageMonths: 26, entity: 'SAUDI', nationalAddress: 'VALID', activities: 'auto' };

/** A fresh CR + owners retrieval with the given provider answers (new simulated calls). */
const crCase = (patch: Partial<Sim['cr']>, persons: PersonsResult = 'multiple') => (x: ProposedState) => {
  const reset = app(sim(x, { cr: { ...CR_DEFAULT, ...patch }, persons }), {
    status: 'DRAFT', outcome: null, outcomeReason: null, step: 'persons',
    cr: { status: 'idle', tries: 0, record: null, gov: null, govReason: null }, categoryCheck: null, risk: null,
    persons: { status: 'idle', tries: 0, list: [], selectedId: null }, flags: [], verifications: dropRecords(x.app, 'CR_DATA', 'PERSONS')
  });
  return runBusinessVerification(reset);
};

const persons: PageDef = {
  title: 'Business verification (CR) + owner / manager',
  intro: 'CR data and the owners / managers are retrieved here, in the backend. The merchant sees a screen only when they must act (select a person, retry, or a stop).',
  integrations: ['Government CR data (status, age, activities, National Address, entity)', 'Government associated parties'],
  groups: (s) => {
    const list = eligiblePersons(s.app.persons.list);
    const other = list.find((p) => p.id !== s.app.persons.selectedId);
    return [
      {
        title: 'CR result',
        options: [
          { id: 'active', label: 'Active CR', run: crCase({}) },
          { id: 'expired', label: 'Expired → saved + Sales', run: crCase({ status: 'EXPIRED' }) },
          { id: 'suspended', label: 'Suspended → saved + Sales', run: crCase({ status: 'SUSPENDED' }) },
          { id: 'unavailable', label: 'Provider unavailable', run: crCase({ result: 'unavailable' }) },
          { id: 'multi', label: 'Several activities (government category differs)', run: crCase({ activities: ['ACT-7020', 'ACT-4719'] }) },
          { id: 'regulated', label: 'Regulated activity among several', run: crCase({ activities: ['ACT-5630', 'ACT-4777'] }) }
        ]
      },
      {
        title: 'Risk attributes (backend only)',
        note: 'Change the score in the Internal view; none of these rejects.',
        options: [
          { id: 'young', label: 'CR 2 months old', run: crCase({ ageMonths: 2 }) },
          { id: 'mid', label: 'CR 18 months old', run: crCase({ ageMonths: 18 }) },
          { id: 'address', label: 'National Address missing', run: crCase({ nationalAddress: 'MISSING' }) },
          { id: 'foreign', label: 'Non-Saudi entity (documents later)', run: crCase({ entity: 'NON_SAUDI' }) }
        ]
      },
      {
        title: 'Owners / managers',
        options: [
          { id: 'one', label: 'One owner / manager', run: crCase({}, 'one') },
          { id: 'multiple', label: 'Several owners / managers', run: crCase({}, 'multiple') },
          { id: 'none', label: 'None (only a delegate / company)', run: crCase({}, 'none') },
          { id: 'people-unavailable', label: 'People data unavailable', run: crCase({}, 'unavailable') },
          ...(other ? [{ id: 'change', label: 'Selection changed', run: (x: ProposedState) => selectPerson(x, other.id) }] : [])
        ]
      }
    ];
  }
};

/* ------------------------------------------------------------------ Mobile ↔ National ID + Nafath */

/** Fresh mobile check with the given answers (state before "Send to Nafath"). */
const matchCase = (queue: MobileMatchResult[]) => (x: ProposedState) =>
  app(sim(x, { mobileMatch: queue }), { authorizedMobileVerified: false, mobileMatch: { status: 'idle', checks: 0, matchedFor: null }, verifications: dropRecords(x.app, 'MOBILE_MATCH', 'NAFATH'), nafath: { ...x.app.nafath, status: 'idle', verifiedFor: null } });

const answer = (r: NafathResult) => (x: ProposedState) => {
  const sent = x.app.nafath.status === 'waiting' ? x : sendToNafath(x);
  return sent.app.nafath.status === 'waiting' ? nafathResult(sent, r) : sent;
};
const attempt = (usedBefore: number) => (x: ProposedState) =>
  answer('rejected')(app(x, { nafath: { ...x.app.nafath, status: 'idle', failures: usedBefore, lastResult: null } }));

const certPre = (r: CertificatesResult) => (x: ProposedState) =>
  runCertificatePrecheck(app(sim(x, { certificates: r }), { status: 'DRAFT', outcome: null, outcomeReason: null, step: 'nafath', certs: { precheck: 'idle', status: 'idle', tries: 0, list: [], selectedId: null }, verifications: dropRecords(x.app, 'FL_CERTS') }));

const nafath: PageDef = {
  title: 'Mobile ownership + Nafath',
  intro: `Send to Nafath first checks that the verified mobile belongs to the verifying person's National ID. ${LIMITS.nafathAttempts} Nafath attempts per application; technical failures do not count but are bounded.`,
  integrations: ['Freelancer Certificate pre-check (backend, Freelancer)', 'Mobile ownership service', 'Nafath'],
  groups: (s) => {
    const groups: PageGroup[] = [];
    if (s.app.kyb.kind === 'FL_CERT') {
      groups.push({
        title: 'Certificate pre-check (backend, before Nafath)',
        note: 'Hidden from the applicant: no certificate detail is shown before Nafath.',
        options: [
          { id: 'pre-found', label: 'Certificate exists', run: certPre('one') },
          { id: 'pre-none', label: 'No certificate → lead, no Nafath', run: certPre('none') },
          { id: 'pre-unavailable', label: 'Certificate service unavailable', run: certPre('unavailable') }
        ]
      });
    }
    if (s.app.nafath.status === 'verified' || s.app.nafath.status === 'exhausted') return groups;
    groups.push({
      title: 'Mobile ↔ National ID',
      options: [
        { id: 'mm-match', label: 'Mobile matches', run: matchCase(['match']) },
        { id: 'mm-mismatch', label: 'Mismatch, then the corrected mobile matches', run: matchCase(['mismatch', 'match']) },
        { id: 'mm-twice', label: 'Mismatch twice → verification paused', run: matchCase(['mismatch', 'mismatch']) }
      ]
    });
    if (s.app.mobileMatch.status === 'mismatch' || s.app.mobileMatch.status === 'entering' || s.app.mobileMatch.status === 'blocked') return groups;
    groups.push(
      {
        title: 'Nafath answer',
        options: [
          { id: 'verified', label: 'Verified', run: answer('verified') },
          { id: 'rejected', label: 'Rejected', run: answer('rejected') },
          { id: 'timeout', label: 'Timeout', run: answer('timeout') },
          { id: 'technical', label: 'Technical failure', run: answer('technical') }
        ]
      },
      {
        title: 'Attempts',
        options: [
          { id: 'first-fail', label: 'First failure — retry available', run: attempt(0) },
          { id: 'final-fail', label: 'Final failed attempt → manual route', run: attempt(LIMITS.nafathAttempts - 1) }
        ]
      }
    );
    return groups;
  }
};

/* ------------------------------------------------------------------ Freelancer certificates */

const certCase = (r: CertificatesResult) => (x: ProposedState) =>
  loadCertificates(app(sim(x, { certificates: r }), { status: 'DRAFT', outcome: null, outcomeReason: null, step: 'certificates', categoryCheck: null, certs: { precheck: 'idle', status: 'idle', tries: 0, list: [], selectedId: null }, verifications: dropRecords(x.app, 'FL_CERTS') }));

const certificates: PageDef = {
  title: 'Freelancer certificate',
  intro: 'After Nafath: the certificates found by the pre-check are shown (no new call). The confirmed certificate activity becomes the verified category.',
  integrations: ['Freelance platform (certificates)'],
  groups: () => [{
    title: 'Retrieval result',
    options: [
      { id: 'one', label: 'One certificate', run: certCase('one') },
      { id: 'multiple', label: 'Several certificates', run: certCase('multiple') },
      { id: 'expired', label: 'One expired, one active', run: certCase('expired') },
      { id: 'duplicate', label: 'Already linked to another account', run: certCase('duplicate') },
      { id: 'mismatch', label: 'Certificate activity requires a CR', run: certCase('mismatch') }
    ]
  }]
};

/* ------------------------------------------------------------------ Business Details */

const IBAN_DEMO = demoIban('80', '4821');

/** Fresh IBAN linkage check with the given answers. `failures` = mismatches already used for this IBAN. */
const ibanCase = (queue: IbanResult[], failures = 0) => (x: ProposedState) => {
  const b = x.app.business;
  const prepared = app(sim(x, { iban: queue }), {
    business: { ...b, iban: b.iban || IBAN_DEMO, ibanStatus: 'idle', ibanFailures: failures, ibanLast: null, bankName: '' },
    verifications: dropRecords(x.app, 'IBAN'),
    ledger: x.app.ledger.filter((l) => !(l.kind === 'call' && l.check === 'IBAN'))
  });
  return finishIbanCheck(startIbanCheck(prepared));
};

const business: PageDef = {
  title: 'Business Details',
  intro: 'Store presence for the channel declared on Page 1 (website and / or Google Maps branch link). Freelancers also verify the IBAN linkage. No IBAN, VAT or branch count for registered businesses.',
  integrations: ['Store-presence URL validation (format only)', 'Freelancer IBAN linkage provider'],
  groups: (s) => {
    const groups: PageGroup[] = [
      {
        title: 'Channel declared on Page 1 (simulator)',
        options: (['online', 'offline', 'both'] as const).map((c) => ({ id: `ch-${c}`, label: c === 'both' ? 'Both' : c[0].toUpperCase() + c.slice(1), run: (x: ProposedState) => app(x, { kyb: { ...x.app.kyb, channel: c } }), current: (x: ProposedState) => x.app.kyb.channel === c }))
      },
      {
        title: 'Store presence links',
        options: [
          { id: 'web-ok', label: 'Valid website / Maps links', run: (x) => setPresence(x, { websiteUrl: 'najdboutique.example.com', mapsUrl: 'https://maps.app.goo.gl/demo123' }) },
          { id: 'web-social', label: 'Website: social-media page', run: (x) => setPresence(x, { websiteUrl: 'https://instagram.com/najdboutique' }) },
          { id: 'web-bad', label: 'Website: invalid', run: (x) => setPresence(x, { websiteUrl: 'my-store' }) },
          { id: 'maps-bad', label: 'Maps: not a Google Maps link', run: (x) => setPresence(x, { mapsUrl: 'https://example.com/our-location' }) }
        ]
      }
    ];
    if (s.app.kyb.kind === 'FL_CERT') {
      groups.push({
        title: 'Freelancer IBAN linkage',
        options: [
          { id: 'iban-verified', label: 'Verified', run: ibanCase(['verified']) },
          { id: 'iban-mismatch', label: 'Not linked (first mismatch)', run: ibanCase(['mismatch']) },
          { id: 'iban-final', label: 'Not linked twice → another IBAN needed', run: ibanCase(['mismatch'], LIMITS.ibanAttempts - 1) },
          { id: 'iban-technical', label: 'Technical error (no attempt used)', run: ibanCase(['technical']) },
          { id: 'iban-new', label: 'Enter a different IBAN', run: (x) => setIban(x, demoIban('20', String(1000 + x.app.ledger.length))) }
        ]
      });
    }
    return groups;
  }
};

/* ------------------------------------------------------------------ Commercial Offer */

const commercial: PageDef = {
  title: 'Commercial Offer',
  intro: 'One standard rate from the verified category → Continue. No payment-plan selection (configured later in the Merchant Portal). The rate review is optional and low-priority.',
  integrations: ['Pricing & Commission Matrix (mock)'],
  groups: () => [{
    title: 'Better rate (optional)',
    options: [
      { id: 'standard', label: 'Standard offer only', run: withdrawRateReview, current: (x) => !x.app.commercial.reviewRequested },
      { id: 'review', label: 'Rate review requested (no file)', run: (x) => requestRateReview(withdrawRateReview(x)), current: (x) => x.app.commercial.reviewRequested && !x.app.commercial.evidence.length && !x.app.commercial.uploadError },
      { id: 'upload-ok', label: 'Evidence uploaded', run: (x) => addEvidence(x, 'doc-a'), current: (x) => x.app.commercial.evidence.length > 0 },
      { id: 'upload-fail', label: 'Optional upload failed', run: (x) => failUpload(x, 'doc-a'), current: (x) => !!x.app.commercial.uploadError }
    ]
  }]
};

/* ------------------------------------------------------------------ Review, Contract, Outcome, Status */

const review: PageDef = {
  title: 'Review',
  intro: 'Verified sections are locked. Only store presence and the rate review open an edit: draft until Save, Cancel restores everything.',
  integrations: ['None'],
  groups: () => [{
    title: 'Controlled edit',
    options: [
      { id: 'edit-presence', label: 'Edit store presence', run: (x) => startEdit(x, 'presence') },
      { id: 'edit-offer', label: 'Edit rate review request', run: (x) => startEdit(x, 'commercial') }
    ]
  }]
};

const contract: PageDef = {
  title: 'Contract',
  intro: 'Contract only: Back to Review or Agree & Submit, which completes the application. There is no Decline action. The standard commission is contract content.',
  integrations: ['Contract acceptance (generic, provider not approved)'],
  groups: () => []
};

const outcome: PageDef = {
  title: 'Outcome',
  intro: 'End page. Re-entering with the same identifier routes by the saved lifecycle status.',
  integrations: [],
  groups: (s) => {
    if (s.app.outcome === 'PAUSED_CR') return [{ title: 'Sales recovery (internal)', note: 'No merchant-facing refresh: only Sales re-checks the CR, after it is corrected.', options: [{ id: 'recover', label: 'Sales: CR corrected → controlled re-check', run: salesRecoverCr }] }];
    return [];
  }
};

const STATUS_OPTIONS: Array<[Lifecycle, string]> = [['SUBMITTED', 'Submitted'], ['UNDER_REVIEW', 'Under review'], ['ACTION_REQUIRED', 'Action required'], ['APPROVED', 'Approved'], ['UNABLE_TO_PROCEED', 'Unable to proceed']];

const status: PageDef = {
  title: 'Application Progress',
  intro: 'A submitted application opens here after the registered-mobile code. Status only: Review, Contract and re-submission are never reopened.',
  integrations: ['Madfu application records (internal)'],
  groups: (s) => [
    { title: 'Application status', options: STATUS_OPTIONS.map(([st, label]) => ({ id: st, label, run: (x: ProposedState) => setReviewStatus(x, st), current: (x: ProposedState) => x.app.status === st })) },
    ...(s.app.status === 'APPROVED' ? [{ title: 'Activation (outside onboarding)', options: [{ id: 'live', label: 'Merchant goes live', run: goLive }] }] : [])
  ]
};

const login: PageDef = {
  title: 'Merchant login',
  intro: 'Existing merchant after the account-mobile code. No onboarding application is created.',
  integrations: [],
  groups: () => []
};

export const PAGE_SCENARIOS: Record<StepId, PageDef> = {
  kyb, identify, otp, persons, nafath, certificates, business, commercial, review, contract, outcome, status, login
};

/** The groups for the current screen, without empty groups. */
export function pageScenarios(s: ProposedState): { page: PageDef; groups: PageGroup[] } {
  const page = PAGE_SCENARIOS[s.app.step];
  return { page, groups: page.groups(s).filter((g) => g.options.length > 0) };
}

/** Status line for reused results on this page (Nafath reused on resume, etc.). */
export function reuseNote(s: ProposedState): string | null {
  const step = s.app.step;
  const reused = (check: string) => s.app.ledger.some((e) => e.kind === 'reuse' && e.check === check);
  if (step === 'nafath' && s.app.nafath.status === 'verified' && reused('NAFATH')) return 'Already verified — reused (no new Nafath call)';
  if (step === 'persons' && s.app.cr.status === 'loaded' && reused('CR_DATA')) return 'CR data already retrieved — reused';
  if (step === 'certificates' && s.app.certs.status === 'loaded' && reused('FL_CERTS')) return 'Certificates from the pre-check — no new call';
  if (step === 'business' && s.app.business.ibanStatus === 'verified' && reused('IBAN')) return 'IBAN already verified — reused';
  return null;
}

/** Existence values the record-lookup options can force (for docs and tests). */
export const EXISTENCE_OPTIONS: Existence[] = ['new', 'incomplete', 'submitted', 'live'];
