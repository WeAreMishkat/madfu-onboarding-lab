/**
 * Page Scenarios: what can realistically happen on THE CURRENT SCREEN, and nothing else.
 *
 * Each screen declares its title, the simulated integrations it touches and groups of human-readable
 * options. Every option is a pure function over the same transitions the prototype runs, so a
 * simulated outcome is exactly what the real screen would produce. The Prototype Controls panel renders
 * only the definition of the current step; there is no global scenario matrix inside the journey.
 */
import { HANDOFF_RULES, LIMITS } from './config';
import { DEMO, DEMO_SMS_CODE, demoIban, eligiblePersons } from './mock';
import {
  activeVersion, addEvidence, asksPrerequisite, canStartHandoff, checkExpiry, chooseAuthMode, createHandoff, currentVersion, delegationResult,
  editMobileFromOtp, expireOtp, failUpload, finishIbanCheck, goLive, latestSignerToken, leaveSession, loadCertificates, manualUnlock, nafathResult,
  openSignerLink, requestRateReview, resendOtp, restartAuthorization, runBusinessVerification, salesRecoverCr, selectPerson, sendToNafath,
  setDelegationType, setIban, setIdentity, setKyb, setPresence, setReviewStatus, signerStartNafath, startEdit, startIbanCheck,
  verifyOtp, withdrawRateReview
} from './state';
import type { Application, CertificatesResult, DelegationStatus, DelegationType, Existence, IbanResult, Kyb, Lifecycle, MobileMatchResult, NafathResult, PersonsResult, ProposedState, Sim, StepId } from './types';

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

const KYB_BASE: Kyb = { kind: 'CR', group: 'retail', sub: 'retail-fashion', revenue: 'MID_BAND', channel: 'online' };
const fillKyb = (patch: Partial<Kyb>) => (s: ProposedState) => setKyb(s, { ...KYB_BASE, ...patch });

/** Unsupported category, keeping the applicant type when it can reach Identify. */
const unsupported = (s: ProposedState) => {
  const kind = s.app.kyb.kind === 'FL_CERT' ? 'FL_CERT' : 'CR';
  return setKyb(s, { ...KYB_BASE, kind, group: 'fixture', sub: 'fixture-blocked' });
};

const kyb: PageDef = {
  title: 'Know Your Business',
  intro: 'Preliminary eligibility from five answers, decided internally before any identity, OTP or paid check. Two internal outcomes, Eligible or Not Eligible; nothing is shown to the applicant and everyone continues to Identify. Options fill the form; press Check eligibility.',
  integrations: ['None — internal eligibility rules only'],
  groups: () => [{
    title: 'Eligibility (internal)',
    options: [
      { id: 'eligible', label: 'Eligible Registered Business', run: fillKyb({}) },
      { id: 'eligible-fl', label: 'Eligible Freelancer', run: fillKyb({ kind: 'FL_CERT', group: 'services', sub: 'services-design' }) },
      { id: 'no-cert', label: 'Freelancer without Certificate → Identify / OTP → Application submitted', run: fillKyb({ kind: 'FL_NO_CERT', group: 'services', sub: 'services-design' }) },
      { id: 'unsupported', label: 'Unsupported Category → Identify / OTP → Application submitted', run: unsupported }
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
  intro: 'CR / National ID and mobile (+ the IBAN question for an eligible Freelancer). Send code runs an internal record lookup first (no provider): new → code to this mobile; existing → code to the STORED mobile, never the one typed here.',
  integrations: ['Madfu application and merchant records (internal)', 'SMS OTP service (next)'],
  groups: (s) => {
    const groups: PageGroup[] = [{
      title: 'Record lookup (internal)',
      options: [
        existenceOpt('auto', 'New applicant'),
        existenceOpt('incomplete', 'Application already in progress'),
        existenceOpt('submitted', 'Application already submitted'),
        existenceOpt('live', 'Already a Madfu merchant'),
        existenceOpt('not_eligible', 'Captured earlier (internally Not Eligible)')
      ]
    }];
    if (asksPrerequisite(s.app)) {
      groups.push({
        title: 'IBAN linked to the certificate?',
        options: [
          { id: 'pre-yes', label: 'Yes → continue', run: (x) => setIdentity(x, { prerequisite: 'yes' }), current: (x) => x.app.identity.prerequisite === 'yes' },
          { id: 'pre-no', label: 'No → Application submitted (internal Not Eligible)', run: (x) => setIdentity(x, { prerequisite: 'no' }), current: (x) => x.app.identity.prerequisite === 'no' }
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
    status: 'DRAFT', outcome: null, outcomeReason: null, step: 'cr',
    cr: { status: 'idle', tries: 0, record: null, gov: null, govReason: null }, categoryCheck: null, risk: null,
    persons: { status: 'idle', tries: 0, list: [], selectedId: null }, flags: [], verifications: dropRecords(x.app, 'CR_DATA', 'PERSONS')
  });
  return runBusinessVerification(reset);
};

const cr: PageDef = {
  title: 'CR verification',
  intro: 'CR data and the owners / managers are retrieved here, in the backend, and feed the risk score. Nobody is chosen here: who authorizes is decided after Review.',
  integrations: ['Government CR data (status, age, activities, National Address, entity)', 'Government associated parties'],
  groups: () => {
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
          { id: 'none', label: 'None (only a delegate / company) → captured internally', run: crCase({}, 'none') },
          { id: 'people-unavailable', label: 'People data unavailable', run: crCase({}, 'unavailable') }
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

const nafath: PageDef = {
  title: 'Mobile ownership + Nafath',
  intro: `Send to Nafath first checks that the mobile belongs to the verifying person's National ID (Freelancer, self-authorizing owner / manager, or the signer's handoff mobile). ${LIMITS.nafathAttempts} Nafath attempts; technical failures do not count but are bounded.`,
  integrations: ['Mobile ownership service', 'Nafath'],
  groups: (s) => {
    const groups: PageGroup[] = [];
    if (s.app.nafath.status === 'verified' || s.app.nafath.status === 'exhausted' || !s.app.id) return groups;
    const signer = s.app.actor === 'signer';
    if (!signer) {
      groups.push({
        title: 'Mobile ↔ National ID',
        options: [
          { id: 'mm-match', label: 'Mobile matches', run: matchCase(['match']) },
          { id: 'mm-mismatch', label: 'Mismatch, then the corrected mobile matches', run: matchCase(['mismatch', 'match']) },
          { id: 'mm-twice', label: 'Mismatch twice → verification paused', run: matchCase(['mismatch', 'mismatch']) }
        ]
      });
    }
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
        title: signer ? 'Signer attempts' : 'Attempts',
        options: [
          { id: 'first-fail', label: 'First failure — retry available', run: attempt(0) },
          { id: 'final-fail', label: signer ? 'Final failed attempt → authorization not completed' : 'Final failed attempt → manual route', run: attempt(LIMITS.nafathAttempts - 1) }
        ]
      }
    );
    return groups;
  }
};

/* ------------------------------------------------------------------ Freelancer certificates */

const certCase = (r: CertificatesResult) => (x: ProposedState) =>
  loadCertificates(app(sim(x, { certificates: r }), { status: 'DRAFT', outcome: null, outcomeReason: null, step: 'certificates', categoryCheck: null, certs: { status: 'idle', tries: 0, list: [], selectedId: null }, verifications: dropRecords(x.app, 'FL_CERTS') }));

const certificates: PageDef = {
  title: 'Freelancer certificate',
  intro: 'Before Nafath: one retrieval by National ID (no certificate → no Nafath cost). The confirmed certificate activity becomes the verified category; then Nafath.',
  integrations: ['Freelance platform (certificates)'],
  groups: () => [{
    title: 'Retrieval result',
    options: [
      { id: 'one', label: 'One certificate', run: certCase('one') },
      { id: 'multiple', label: 'Several certificates', run: certCase('multiple') },
      { id: 'expired', label: 'One expired, one active', run: certCase('expired') },
      { id: 'duplicate', label: 'Already linked to another account', run: certCase('duplicate') },
      { id: 'none', label: 'No certificate → Application submitted (internal)', run: certCase('none') },
      { id: 'unavailable', label: 'Certificate service unavailable', run: certCase('unavailable') },
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
  intro: 'Preparer: verified sections are locked; only store presence and the rate review open an edit (draft until Save, Cancel restores everything). Signer: everything is read-only, including the frozen offer.',
  integrations: ['None'],
  groups: (s) => s.app.actor === 'signer' ? [] : [{
    title: 'Controlled edit',
    options: [
      { id: 'edit-presence', label: 'Edit store presence', run: (x) => startEdit(x, 'presence') },
      { id: 'edit-offer', label: 'Edit rate review request', run: (x) => startEdit(x, 'commercial') }
    ]
  }]
};

/* ------------------------------------------------------------------ Authorization (CR), handoff, signer, delegation */

const firstOther = (x: ProposedState) => eligiblePersons(x.app.persons.list).find((p) => p.id !== 'p1')?.id ?? 'p1';

const authorize: PageDef = {
  title: 'Authorization choice',
  intro: `Registered business, after Review: the preparer authorizes personally (owner / manager → Nafath → Contract) or sends the application to another owner / manager on the CR. Max ${HANDOFF_RULES.maxVersions} handoffs in ${HANDOFF_RULES.windowDays} days.`,
  integrations: ['Government associated parties (stored)', 'SMS (secure signer link)'],
  groups: (s) => [
    {
      title: 'Choice',
      options: [
        { id: 'self', label: 'I can complete the authorization myself', run: (x) => selectPerson(chooseAuthMode(x, 'self'), 'p1'), current: (x) => x.app.authorization.mode === 'self' },
        { id: 'signer', label: 'Send to another signer', run: (x) => chooseAuthMode(x, 'signer'), current: (x) => x.app.authorization.mode === 'signer' }
      ]
    },
    ...(canStartHandoff(s.app) ? [{
      title: 'Signer handoff',
      options: [{ id: 'send', label: 'Send Authorization (owner / manager + demo mobile)', run: (x: ProposedState) => createHandoff(chooseAuthMode(x, 'signer'), firstOther(x), DEMO.signerMobile) }]
    }] : [{
      title: 'Signer handoff limit',
      note: `${HANDOFF_RULES.maxVersions} handoffs in ${HANDOFF_RULES.windowDays} days already used for this application.`,
      options: [{ id: 'unlock', label: 'Internal team: unlock one more handoff', run: manualUnlock }]
    }])
  ]
};

const signerOpens = (x: ProposedState) => {
  const token = latestSignerToken(x);
  return token ? openSignerLink(leaveSession(x), token) : x;
};
const afterDays = (x: ProposedState, days: number) => {
  const v = currentVersion(x.app);
  return v ? checkExpiry(x, Date.parse(v.createdAt) + days * 24 * 60 * 60 * 1000) : x;
};

const handoffPage: PageDef = {
  title: 'Authorization status (preparer)',
  intro: `After Send Authorization the application and offer are frozen and read-only; the preparer sees status only. Changing the signer or mobile is Phase 2. Link valid ${HANDOFF_RULES.expiryDays} days (configurable).`,
  integrations: ['SMS (secure signer link)'],
  groups: (s) => {
    const live = !!activeVersion(s.app);
    return [
      ...(live ? [{
        title: 'Signer',
        options: [
          { id: 'open', label: 'Signer opens the secure link (new session)', run: signerOpens },
          { id: 'expire', label: `${HANDOFF_RULES.expiryDays} days pass → link expires`, run: (x: ProposedState) => afterDays(x, HANDOFF_RULES.expiryDays) },
          { id: 'not-yet', label: `${HANDOFF_RULES.expiryDays - 1} days pass → still valid`, run: (x: ProposedState) => afterDays(x, HANDOFF_RULES.expiryDays - 1) }
        ]
      }] : []),
      ...(!live && s.app.status === 'AWAITING_AUTHORIZATION' ? [{
        title: 'New authorization version',
        options: [
          { id: 'restart', label: 'Start a new authorization (same application)', run: restartAuthorization },
          ...(s.app.authorization.limitReached || !canStartHandoff(s.app) ? [{ id: 'unlock', label: 'Internal team: unlock one more handoff', run: manualUnlock }] : [])
        ]
      }] : [])
    ];
  }
};

const signer: PageDef = {
  title: 'Signer entry (secure link)',
  intro: 'No OTP in Phase 1. The link alone does not authorize: masked request details only, then Nafath. The full application is shown only after Nafath.',
  integrations: ['Secure link (token)', 'Mobile ownership service (next)', 'Nafath (next)'],
  groups: (s) => s.app.signerSession?.link !== 'active' ? [] : [{
    title: 'Signer checks before Nafath',
    options: [
      { id: 'start', label: 'Start Nafath (mobile matches)', run: (x) => signerStartNafath(sim(x, { mobileMatch: ['match'] })) },
      { id: 'mismatch', label: 'Signer mobile does not match → version ends', run: (x) => signerStartNafath(sim(x, { mobileMatch: ['mismatch'] })) }
    ]
  }]
};

const DELEGATION_TYPES: Array<[DelegationType, string]> = [['MOJ', 'Ministry of Justice delegation'], ['COMPANY_DOC', 'Company / commercial delegation document'], ['OTHER_DOC', 'Other official delegation document']];
const delegationOpt = (status: DelegationStatus, label: string): PageOption => ({ id: `d-${status}`, label, run: (x) => delegationResult(x, status), current: (x) => x.app.authorization.delegation.status === status });

const delegation: PageDef = {
  title: 'Delegated signer — PHASE 2 (demo only)',
  intro: 'Represented for the demo; not Phase 1 behaviour. Delegation authority is verified BEFORE Nafath (Nafath proves identity, not authority). Manual reviews never need an open session.',
  integrations: ['Ministry of Justice (Phase 2, not integrated)', 'Quality manual review (Phase 2)'],
  groups: (s) => {
    const d = s.app.authorization.delegation;
    return [
      { title: 'Delegation type', options: DELEGATION_TYPES.map(([t, label]) => ({ id: t, label, run: (x: ProposedState) => setDelegationType(x, t), current: (x: ProposedState) => x.app.authorization.delegation.type === t })) },
      ...(d.type === 'MOJ' ? [{ title: 'Ministry of Justice check (demo)', options: [delegationOpt('valid', 'Valid → Nafath → Contract'), delegationOpt('invalid', 'Invalid → stop')] }] : []),
      ...(d.type && d.type !== 'MOJ' ? [{ title: 'Quality review (demo)', options: [delegationOpt('under_review', 'Uploaded → under Quality review'), delegationOpt('approved', 'Approved → continuation link → Nafath → Contract'), delegationOpt('rejected', 'Rejected → stop')] }] : [])
    ];
  }
};

const contract: PageDef = {
  title: 'Contract',
  intro: 'Contract only: Back to Review or one action — Agree & Submit (preparer: Freelancer or self-authorizing owner / manager) or Agree & Sign (signer). There is no Decline action. The frozen standard commission is contract content.',
  integrations: ['Contract acceptance (generic, provider not approved)'],
  groups: () => []
};

const outcome: PageDef = {
  title: 'Outcome',
  intro: 'End page. Internally Not Eligible applications see exactly the normal submitted page. Re-entering routes by the saved lifecycle status (Application Progress).',
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
  title: 'Active account popup',
  intro: 'Existing live merchant after the account-mobile code: a popup “You already have an active account under this CR.” Nothing navigates until the merchant clicks Log in. No application is created.',
  integrations: [],
  groups: () => []
};

export const PAGE_SCENARIOS: Record<StepId, PageDef> = {
  kyb, identify, otp, cr, certificates, nafath, business, commercial, review, authorize, handoff: handoffPage, delegation, signer, contract, outcome, status, login
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
  if (step === 'cr' && s.app.cr.status === 'loaded' && reused('CR_DATA')) return 'CR data already retrieved — reused';
  if (step === 'certificates' && s.app.certs.status === 'loaded' && reused('FL_CERTS')) return 'Certificates already retrieved — no new call';
  if (step === 'signer') return 'The signer link opens without OTP; Nafath runs again in every signer session';
  if (step === 'business' && s.app.business.ibanStatus === 'verified' && reused('IBAN')) return 'IBAN already verified — reused';
  return null;
}

/** Existence values the record-lookup options can force (for docs and tests). */
export const EXISTENCE_OPTIONS: Existence[] = ['new', 'incomplete', 'submitted', 'live', 'not_eligible'];
