/**
 * Page Scenarios: what can realistically happen on THE CURRENT SCREEN, and nothing else.
 *
 * Each screen declares its title, the simulated integrations it touches and groups of human-readable
 * options. Every option is a pure function over the same transitions the prototype runs, so a
 * simulated outcome is exactly what the real screen would produce. The Prototype Controls panel renders
 * only the definition of the current step; there is no global scenario matrix inside the journey.
 *
 * Deliberately absent: the mobile ↔ selected-owner National ID mismatch (open decision OD-8). It is not
 * simulated anywhere.
 */
import { ACTIVITY_MAPPING } from './activity';
import { LIMITS, isFreelancer } from './config';
import { DEMO, DEMO_SMS_CODE, demoIban, eligiblePersons } from './mock';
import {
  acceptContract, addEvidence, declineContract, editMobileFromOtp, expireOtp, finishIbanCheck, ibanTarget, loadCertificates, loadPersons,
  nafathResult, reopenContract, resendOtp, runCrVerification, selectPerson, setBankLinked, setIdentity, setKyb, setLead, startEdit,
  startIbanCheck, startNafath, verifyOtp
} from './state';
import type { Application, CertificatesResult, IbanResult, IdentityState, Kyb, MappingOutcome, NafathResult, PersonsResult, ProposedState, Sim, StepId } from './types';
import { makeRecord } from './verifications';

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
const dropRecord = (a: Application, t: keyof Application['verifications']): Application['verifications'] => {
  const v = { ...a.verifications };
  delete v[t];
  return v;
};

/* ------------------------------------------------------------------ Know Your Business */

const KYB_BASE: Kyb = { kind: 'CR', group: 'retail', sub: 'retail-fashion', revenue: 'SELF_SERVICE_BAND', channel: 'online', websiteUrl: 'https://najdboutique.example.com', mapsUrl: '' };
const fillKyb = (patch: Partial<Kyb>) => (s: ProposedState) => setKyb(s, { ...KYB_BASE, ...patch });
const MAPS_OK = 'https://maps.google.com/?q=24.7136,46.6753';

const kyb: PageDef = {
  title: 'Know Your Business',
  intro: 'Eligibility is decided here, internally, before any identity, OTP or paid check. Options fill the form; press Check eligibility to see the result.',
  integrations: ['None — internal eligibility rules only'],
  groups: (s) => {
    const k = s.app.kyb;
    const groups: PageGroup[] = [{
      title: 'Eligibility result',
      options: [
        { id: 'eligible', label: 'Eligible (registered business)', run: fillKyb({}) },
        { id: 'blocked', label: 'Category blocked', run: fillKyb({ group: 'fixture', sub: 'fixture-blocked' }) },
        { id: 'cr-required', label: 'Category requires a CR (Freelancer)', run: fillKyb({ kind: 'FL_CERT', group: 'food', sub: 'food-cafe' }) },
        { id: 'channel', label: 'Freelancer not allowed for the selected channel', run: fillKyb({ kind: 'FL_CERT', group: 'retail', sub: 'retail-electronics', channel: 'offline', websiteUrl: '', mapsUrl: MAPS_OK }) },
        { id: 'manual', label: 'Manual business review', run: fillKyb({ group: 'fixture', sub: 'fixture-manual' }) },
        { id: 'no-cert', label: 'Freelancer without certificate → lead', run: fillKyb({ kind: 'FL_NO_CERT', group: 'services', sub: 'services-design' }) },
        { id: 'sales', label: 'Registered business above SAR 20M → Sales lead', run: fillKyb({ revenue: 'ABOVE_20M' }) },
        { id: 'paused', label: 'Category temporarily paused', run: fillKyb({ group: 'fixture', sub: 'fixture-paused' }) }
      ]
    }];
    if (k.channel === 'online' || k.channel === 'both') {
      groups.push({
        title: 'Website validation',
        options: [
          { id: 'web-ok', label: 'Valid website', run: (x) => setKyb(x, { websiteUrl: 'https://najdboutique.example.com' }) },
          { id: 'web-bad', label: 'Invalid website', run: (x) => setKyb(x, { websiteUrl: 'my-store' }) },
          { id: 'web-social', label: 'Social-media URL', run: (x) => setKyb(x, { websiteUrl: 'https://instagram.com/najdboutique' }) },
          { id: 'web-wa', label: 'WhatsApp URL', run: (x) => setKyb(x, { websiteUrl: 'https://wa.me/966500000000' }) }
        ]
      });
    }
    if (k.channel === 'offline' || k.channel === 'both') {
      groups.push({
        title: 'Google Maps validation',
        options: [
          { id: 'maps-ok', label: 'Valid Google Maps URL', run: (x) => setKyb(x, { mapsUrl: MAPS_OK }) },
          { id: 'maps-bad', label: 'Invalid Maps URL', run: (x) => setKyb(x, { mapsUrl: 'https://example.com/our-location' }) }
        ]
      });
    }
    return groups;
  }
};

/* ------------------------------------------------------------------ lead contact */

const lead: PageDef = {
  title: 'Lead contact',
  intro: 'Only for leads (Sales route or Freelancer without certificate). Their Know Your Business answers are kept.',
  integrations: ['SMS OTP service (next)'],
  groups: () => [{ title: 'Form', options: [{ id: 'fill', label: 'Fill demo contact details', run: (x) => setLead(x, { name: 'Sara Al-Harbi (demo)', mobile: DEMO.mobile }) }] }]
};

/* ------------------------------------------------------------------ identify */

const identityOpt = (id: IdentityState, label: string): PageOption => ({
  id, label,
  run: (x) => setIdentity(sim(x, { identity: id }), { identifier: x.app.identity.identifier || (x.app.kyb.kind === 'CR' ? DEMO.cr : DEMO.nationalId), mobile: x.app.identity.mobile || DEMO.mobile }),
  current: (x) => x.sim.identity === id
});

const identify: PageDef = {
  title: 'Identify & Verify',
  intro: 'CR / National ID and mobile. Duplicate and existing checks run in the backend; their result shows after the code. Then press Send code.',
  integrations: ['Madfu application and merchant records (internal)', 'SMS OTP service (next)'],
  groups: () => [{
    title: 'Identity check result',
    options: [
      identityOpt('new', 'New applicant'),
      identityOpt('current_application', 'Saved application, same mobile → resume'),
      identityOpt('duplicate_identity', 'Application exists under another mobile'),
      identityOpt('existing_merchant', 'Already a Madfu merchant')
    ]
  }]
};

/* ------------------------------------------------------------------ OTP */

const otp: PageDef = {
  title: 'OTP verification',
  intro: `Demo code ${DEMO_SMS_CODE}. ${LIMITS.otpAttempts} attempts per code.`,
  integrations: ['SMS OTP service'],
  groups: (s) => {
    const blocked = s.app.otp.status === 'expired' || s.app.otp.status === 'exhausted';
    const result: PageGroup = {
      title: 'OTP result',
      options: [
        { id: 'verified', label: 'Verified', run: (x) => verifyOtp(x, DEMO_SMS_CODE) },
        ...(blocked ? [] : [{ id: 'incorrect', label: 'Incorrect code', run: (x: ProposedState) => verifyOtp(x, '135790') }]),
        { id: 'expired', label: 'Expired / timed out', run: expireOtp },
        { id: 'exhausted', label: 'All attempts failed', run: (x) => app(x, { otp: { ...x.app.otp, status: 'exhausted', attemptsLeft: 0, code: '' } }) }
      ]
    };
    const actions: PageGroup = {
      title: 'Actions',
      options: [
        { id: 'resend', label: 'Resend code', run: resendOtp },
        ...(s.app.otp.purpose === 'resume' ? [] : [{ id: 'edit-mobile', label: 'Edit mobile number', run: editMobileFromOtp }])
      ]
    };
    return [result, actions];
  }
};

/* ------------------------------------------------------------------ CR verification */

const CR_DEFAULT: Sim['cr'] = { result: 'found', status: 'ACTIVE', issuedMonthsAgo: 26, entity: 'SAUDI', nationalAddress: 'VALID', activity: 'auto' };

/** A fresh CR retrieval with the given provider answer (one new simulated call). */
const crCase = (patch: Partial<Sim['cr']>) => (x: ProposedState) => {
  const reset = app(sim(x, { cr: { ...CR_DEFAULT, ...patch } }), { cr: { status: 'idle', tries: 0, record: null, decision: null, decisionReason: null }, activity: null, verifications: dropRecord(x.app, 'CR_DATA') });
  return runCrVerification(reset);
};

const OUTCOME_LABEL: Record<MappingOutcome, string> = { MATCH: 'Match', COMPATIBLE: 'Compatible', AMBIGUOUS: 'Ambiguous', CONFLICT: 'Conflict', UNMAPPED: 'Not in the mapping' };

const crVerify: PageDef = {
  title: 'Business verification (CR)',
  intro: 'Each option simulates a fresh government CR retrieval and its rules. Stop outcomes leave this page.',
  integrations: ['Government CR data (registry, activities, National Address)'],
  groups: (s) => {
    const sub = s.app.kyb.sub;
    const pairs = ACTIVITY_MAPPING.filter((m) => m.sub === sub);
    const activity: PageOption[] = (['MATCH', 'COMPATIBLE', 'AMBIGUOUS', 'CONFLICT'] as MappingOutcome[])
      .map((o) => ({ o, pair: pairs.find((p) => p.outcome === o) }))
      .filter((x) => x.pair)
      .map(({ o, pair }) => ({ id: `act-${o}`, label: OUTCOME_LABEL[o], run: crCase({ activity: pair!.activity }) }));
    activity.push({ id: 'act-UNMAPPED', label: OUTCOME_LABEL.UNMAPPED, run: crCase({ activity: 'ACT-9999' }) });
    return [
      {
        title: 'CR result',
        options: [
          { id: 'valid', label: 'Valid CR', run: crCase({}) },
          { id: 'young', label: 'CR 3 months old or less', run: crCase({ issuedMonthsAgo: 2 }) },
          { id: 'expired', label: 'Expired', run: crCase({ status: 'EXPIRED' }) },
          { id: 'suspended', label: 'Suspended', run: crCase({ status: 'SUSPENDED' }) },
          { id: 'violation', label: 'Government restriction / violation', run: crCase({ status: 'VIOLATION' }) },
          { id: 'unavailable', label: 'Provider unavailable', run: crCase({ result: 'unavailable' }) },
          { id: 'not-found', label: 'CR not found', run: crCase({ result: 'not_found' }) }
        ]
      },
      {
        title: 'Non-blocking findings',
        options: [
          { id: 'na-missing', label: 'National Address missing', run: crCase({ nationalAddress: 'MISSING' }) },
          { id: 'na-expired', label: 'National Address expired', run: crCase({ nationalAddress: 'EXPIRED' }) },
          { id: 'docs', label: 'Extra documents required later', run: crCase({ entity: 'NON_SAUDI' }) }
        ]
      },
      { title: 'Declared category ↔ registered activity', note: 'Options depend on the category chosen in Know Your Business.', options: activity }
    ];
  }
};

/* ------------------------------------------------------------------ authorised person */

const personsCase = (r: PersonsResult) => (x: ProposedState) =>
  loadPersons(app(sim(x, { persons: r }), { persons: { status: 'idle', tries: 0, list: [], selectedId: null }, verifications: dropRecord(x.app, 'PERSONS') }));

const persons: PageDef = {
  title: 'Authorised person',
  intro: 'People on the CR; only individuals can use Nafath. Each option simulates a fresh retrieval.',
  integrations: ['Government associated parties'],
  groups: (s) => {
    const list = eligiblePersons(s.app.persons.list);
    const other = list.find((p) => p.id !== s.app.persons.selectedId);
    return [{
      title: 'People on the registration',
      options: [
        { id: 'one', label: 'One eligible person', run: personsCase('one') },
        { id: 'multiple', label: 'Several eligible people', run: personsCase('multiple') },
        { id: 'none', label: 'No eligible person', run: personsCase('none') },
        { id: 'unavailable', label: 'Government data unavailable', run: personsCase('unavailable') },
        ...(other ? [{ id: 'change', label: 'Selection changed', run: (x: ProposedState) => selectPerson(x, other.id) }] : [])
      ]
    }];
  }
};

/* ------------------------------------------------------------------ Nafath */

const answer = (r: NafathResult) => (x: ProposedState) => nafathResult(x.app.nafath.status === 'waiting' ? x : startNafath(x), r);
const attempt = (usedBefore: number) => (x: ProposedState) =>
  answer('rejected')(app(x, { nafath: { ...x.app.nafath, status: 'idle', failures: usedBefore, lastResult: null } }));

const nafath: PageDef = {
  title: 'Nafath',
  intro: `Identity and authority, not the contract. ${LIMITS.nafathAttempts} attempts per application.`,
  integrations: ['Nafath'],
  groups: (s) => {
    if (s.app.nafath.status === 'verified') return [];
    if (s.app.nafath.status === 'exhausted') return [];
    return [
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
    ];
  }
};

/* ------------------------------------------------------------------ Freelancer certificates */

const certCase = (r: CertificatesResult) => (x: ProposedState) =>
  loadCertificates(app(sim(x, { certificates: r }), { certs: { status: 'idle', tries: 0, list: [], selectedId: null }, activity: null, verifications: dropRecord(x.app, 'FL_CERTS') }));

const certificates: PageDef = {
  title: 'Freelancer certificate',
  intro: 'Certificates are retrieved for the verified National ID, never uploaded. Each option simulates a fresh retrieval.',
  integrations: ['Freelance platform (certificates)'],
  groups: () => [{
    title: 'Retrieval result',
    options: [
      { id: 'one', label: 'One certificate', run: certCase('one') },
      { id: 'multiple', label: 'Multiple certificates', run: certCase('multiple') },
      { id: 'none', label: 'No certificate found', run: certCase('none') },
      { id: 'expired', label: 'Certificate expired', run: certCase('expired') },
      { id: 'unavailable', label: 'Certificate service unavailable', run: certCase('unavailable') },
      { id: 'mismatch', label: 'Certificate / category mismatch', run: certCase('mismatch') },
      { id: 'duplicate', label: 'Already linked to another account', run: certCase('duplicate') }
    ]
  }]
};

/* ------------------------------------------------------------------ Business & Banking */

const IBAN_DEMO = demoIban('10', '4821');

/** Fresh IBAN ownership check with the given answers. `failures` = attempts already used. */
const ibanCase = (queue: IbanResult[], failures = 0, pending = false) => (x: ProposedState) => {
  const b = x.app.business;
  const iban = b.iban || IBAN_DEMO;
  const prepared = app(sim(x, { iban: queue }), {
    business: { ...b, iban, ibanStatus: 'idle', ibanFailures: failures, ibanLast: null, bankName: '' },
    verifications: dropRecord(x.app, 'IBAN')
  });
  const started = startIbanCheck(prepared);
  return pending ? started : finishIbanCheck(started);
};

/** Resume with an IBAN verified earlier: the stored result is reused, no new check. */
const ibanReused = (x: ProposedState) => {
  const b = x.app.business;
  const iban = b.iban || IBAN_DEMO;
  const a = { ...x.app, business: { ...b, iban, ibanStatus: 'idle' as const, bankName: '' } };
  const rec = makeRecord('IBAN', `iban:${iban}:${ibanTarget(a)}`, 'owner matched', new Date().toISOString(), 'SIM-IBN-PREV');
  return startIbanCheck({ ...x, app: { ...a, verifications: { ...a.verifications, IBAN: rec } } });
};

const business: PageDef = {
  title: 'Business & banking details',
  intro: 'Only what was not retrieved. Stage-1 answers are shown, not asked again.',
  integrations: ['Bank ownership provider (IBAN)'],
  groups: (s) => {
    const groups: PageGroup[] = [];
    const fl = isFreelancer(s.app.kyb.kind);
    if (fl) {
      groups.push({
        title: 'Bank account linked to the Freelancer Certificate?',
        options: [
          { id: 'linked-yes', label: 'Yes → show IBAN', run: (x) => setBankLinked(x, 'yes'), current: (x) => x.app.business.bankLinked === 'yes' },
          { id: 'linked-no', label: 'No / not yet → skip IBAN (banking setup required)', run: (x) => setBankLinked(x, 'no'), current: (x) => x.app.business.bankLinked === 'no' }
        ]
      });
    }
    if (!fl || s.app.business.bankLinked === 'yes') {
      groups.push({
        title: 'IBAN ownership check',
        options: [
          { id: 'verifying', label: 'Verifying', run: ibanCase(['verified'], 0, true) },
          { id: 'verified', label: 'Verified', run: ibanCase(['verified']) },
          { id: 'mismatch', label: 'Ownership mismatch (first failed attempt)', run: ibanCase(['mismatch']) },
          { id: 'final', label: 'Final failed attempt → continue unverified', run: ibanCase(['mismatch'], LIMITS.ibanAttempts - 1) },
          { id: 'technical', label: 'Technical error', run: ibanCase(['technical']) },
          { id: 'reused', label: 'Previously verified (resume) → reused', run: ibanReused }
        ]
      });
    }
    return groups;
  }
};

/* ------------------------------------------------------------------ Commercial Offer */

const commercial: PageDef = {
  title: 'Commercial Offer',
  intro: '3 and 4 months are always included. Select 6 / 9 / 12 months directly on the page; prices come from the mock pricing configuration.',
  integrations: ['Pricing & Commission Matrix (mock)'],
  groups: () => [
    {
      title: 'Better pricing',
      options: [
        { id: 'no-docs', label: 'No documents uploaded (standard commission)', run: (x) => app(x, { commercial: { ...x.app.commercial, evidence: [] } }), current: (x) => x.app.commercial.evidence.length === 0 },
        { id: 'docs', label: 'Optional documents uploaded → Commercial review', run: (x) => addEvidence(x, 'doc-a'), current: (x) => x.app.commercial.evidence.length > 0 }
      ]
    },
    {
      title: 'Payment plans',
      note: 'Multi-select 6 / 9 / 12 months on the page itself.',
      options: [{ id: 'base', label: 'Standard plans only (3 + 4 months)', run: (x) => app(x, { commercial: { ...x.app.commercial, optional: [] } }), current: (x) => x.app.commercial.optional.length === 0 }]
    }
  ]
};

/* ------------------------------------------------------------------ Review */

const review: PageDef = {
  title: 'Review',
  intro: 'Use Edit to see dependency invalidation: the Internal view shows what each change invalidates.',
  integrations: ['None until an edit changes a verified field'],
  groups: () => [{
    title: 'Edit',
    options: [
      { id: 'edit-kyb', label: 'Edit Know Your Business', run: (x) => startEdit(x, 'kyb') },
      { id: 'edit-id', label: 'Edit identification', run: (x) => startEdit(x, 'identification') },
      { id: 'edit-banking', label: 'Edit business details / IBAN', run: (x) => startEdit(x, 'banking') },
      { id: 'edit-offer', label: 'Edit commercial offer', run: (x) => startEdit(x, 'commercial') }
    ]
  }]
};

/* ------------------------------------------------------------------ Contract, Outcome */

const contract: PageDef = {
  title: 'Contract',
  intro: 'Contract only. Plans and commission are shown as contract content and cannot be changed here.',
  integrations: ['Contract acceptance (generic, provider not approved)'],
  groups: (s) => s.app.contract.status === 'accepted' ? [] : [{
    title: 'Contract result',
    options: [
      { id: 'accepted', label: 'Contract accepted', run: acceptContract },
      { id: 'declined', label: 'Contract declined', run: declineContract }
    ]
  }]
};

const outcome: PageDef = {
  title: 'Outcome',
  intro: 'Final page. Use Start demo to begin another journey.',
  integrations: [],
  groups: (s) => s.app.outcome === 'CONTRACT_DECLINED' ? [{ title: 'After a decline', options: [{ id: 'reopen', label: 'Return to the contract', run: reopenContract }] }] : []
};

export const PAGE_SCENARIOS: Record<StepId, PageDef> = {
  kyb, lead, identify, otp, 'cr-verify': crVerify, persons, nafath, certificates, business, commercial, review, contract, outcome
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
  if (step === 'cr-verify' && s.app.cr.status === 'loaded' && reused('CR_DATA')) return 'CR data already retrieved — reused';
  if (step === 'business' && s.app.business.ibanStatus === 'verified' && reused('IBAN')) return 'IBAN already verified — reused';
  return null;
}
