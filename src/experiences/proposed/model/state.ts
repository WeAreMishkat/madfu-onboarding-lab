/**
 * Madfu Proposed v3 — pure transitions. Components call these through `apply(fn)`; tests call them
 * directly. No transition talks to a real service: answers come from the Prototype Controls (Sim).
 *
 * Order of the journey: Know Your Business (cheap, internal) -> Identify & Verify (OTP) -> Business
 * Verification (paid, external, reused) -> Business & Banking -> Commercial Offer -> Review -> Contract
 * -> Submit / Outcome.
 */
import { reconcile } from './activity';
import { LIMITS, RULE_FLAGS, isFreelancer } from './config';
import { continuesToIdentity, evaluateEligibility, kybComplete } from './eligibility';
import { evaluateGovernment } from './government';
import {
  DEMO, DEMO_SMS_CODE, NAFATH_NUMBERS, bankFromIban, certificatesAdapter, crAdapter, demoIban, eligiblePersons, ibanAdapter,
  nafathAdapter, newApplicationId, newContinueToken, newQualificationId, personsAdapter, providerRef
} from './mock';
import { buildOffer } from './pricing';
import { invalidate, log, makeRecord, reusable, reuseOnResume, store } from './verifications';
import type {
  Application, Backend, Flag, InternalStatus, NafathResult, OutcomeKind, ProposedState, ReasonCode, SectionId, Sim, StepId, Tenure,
  VerificationType
} from './types';

/* ------------------------------------------------------------------ initial state */

export function initialSim(): Sim {
  return {
    identity: 'new',
    cr: { result: 'found', status: 'ACTIVE', issuedMonthsAgo: 26, entity: 'SAUDI', nationalAddress: 'VALID', activity: 'auto' },
    persons: 'multiple',
    nafath: ['verified'],
    certificates: 'one',
    iban: ['verified']
  };
}

export function initialApplication(seed = Date.now()): Application {
  return {
    qualificationId: newQualificationId(seed),
    id: null,
    createdAt: new Date(seed).toISOString(),
    step: 'kyb',
    lastStep: 'kyb',
    returnTo: null,
    editBaseline: null,
    kyb: { kind: null, group: '', sub: '', revenue: null, channel: null, websiteUrl: '', mapsUrl: '' },
    eligibility: null,
    kybSnapshot: null,
    lead: { name: '', mobile: '' },
    identity: { identifier: '', mobile: '' },
    identityCheck: null,
    sessionMobile: '',
    verifiedMobile: '',
    otp: { purpose: 'application', status: 'sent', attemptsLeft: LIMITS.otpAttempts, code: '', resendAt: 0 },
    resumed: false,
    cr: { status: 'idle', tries: 0, record: null, decision: null, decisionReason: null },
    activity: null,
    persons: { status: 'idle', tries: 0, list: [], selectedId: null },
    nafath: { status: 'idle', failures: 0, requests: 0, lastResult: null, number: NAFATH_NUMBERS[0], verifiedFor: null },
    certs: { status: 'idle', tries: 0, list: [], selectedId: null },
    business: { bankLinked: null, iban: '', ibanStatus: 'idle', ibanFailures: 0, ibanLast: null, bankName: '', vat: null, vatNumber: '', vatLookup: 'idle', branches: '' },
    commercial: { optional: [], evidence: [], evidenceSkipped: false, agreed: null },
    contract: { status: 'unavailable', acceptedAt: '' },
    verifications: {},
    ledger: [],
    flags: [],
    status: 'QUALIFICATION_DRAFT',
    outcome: null,
    outcomeReason: null,
    submittedAt: ''
  };
}

export const initialBackend = (): Backend => ({ qualifications: {}, applications: {}, identities: {}, leads: [], tokens: {}, sms: [] });

export function initialState(): ProposedState {
  return { app: initialApplication(), sim: initialSim(), scenarioId: null, backend: initialBackend() };
}

/* ------------------------------------------------------------------ helpers */

const now = () => new Date().toISOString();
const withApp = (s: ProposedState, patch: Partial<Application>): ProposedState => ({ ...s, app: { ...s.app, ...patch } });
const mapApp = (s: ProposedState, f: (a: Application) => Application): ProposedState => ({ ...s, app: f(s.app) });
export const addFlag = (flags: Flag[], f: Flag) => (flags.includes(f) ? flags : [...flags, f]);
export const dropFlags = (flags: Flag[], drop: Flag[]) => flags.filter((f) => !drop.includes(f));
const fl = (app: Application) => isFreelancer(app.kyb.kind);

/** Linear order of screens, used for "furthest step reached". */
const ORDER: StepId[] = ['kyb', 'lead', 'identify', 'otp', 'cr-verify', 'persons', 'nafath', 'certificates', 'business', 'commercial', 'review', 'contract', 'outcome'];
const furthest = (a: StepId, b: StepId) => (ORDER.indexOf(b) > ORDER.indexOf(a) ? b : a);

/** Move to a step and remember the furthest step reached. Saves the application. */
export function go(s: ProposedState, step: StepId, patch: Partial<Application> = {}): ProposedState {
  return persist(withApp(s, { ...patch, step, lastStep: furthest(s.app.lastStep, step) }));
}

/** Save the application in the simulated backend (resume, duplicate detection, Continue links). */
export function persist(s: ProposedState): ProposedState {
  const { app } = s;
  if (!app.id) return s;
  return {
    ...s,
    backend: {
      ...s.backend,
      applications: { ...s.backend.applications, [app.id]: app },
      identities: app.identity.identifier ? { ...s.backend.identities, [app.identity.identifier]: app.id } : s.backend.identities
    }
  };
}

function finish(s: ProposedState, outcome: OutcomeKind, status: InternalStatus, reason: ReasonCode | null = null): ProposedState {
  return go(s, 'outcome', { outcome, status, outcomeReason: reason, returnTo: null, editBaseline: null, submittedAt: now() });
}

function sendOtp(s: ProposedState, purpose: Application['otp']['purpose'], to: string): ProposedState {
  const app = log({ ...s.app, otp: { purpose, status: 'sent', attemptsLeft: LIMITS.otpAttempts, code: '', resendAt: Date.now() + LIMITS.otpResendSeconds * 1000 } }, { kind: 'otp', check: 'OTP', note: `SMS code sent (${purpose})` });
  return {
    ...s,
    app: { ...app, step: 'otp', lastStep: furthest(app.lastStep, 'otp') },
    backend: { ...s.backend, sms: [...s.backend.sms, { to, kind: 'otp', text: `Your Madfu verification code is ${DEMO_SMS_CODE} (demo).`, at: now() }] }
  };
}

/* ------------------------------------------------------------------ path, Back */

export function pathFor(app: Application): StepId[] {
  if (app.eligibility && app.eligibility.result === 'SALES_LEAD') return ['kyb', 'lead', 'otp', 'outcome'];
  const p: StepId[] = ['kyb', 'identify', 'otp'];
  if (app.kyb.kind === 'CR') {
    p.push('cr-verify', 'persons');
    if (app.persons.status !== 'none') p.push('nafath');
  } else {
    p.push('nafath', 'certificates');
  }
  p.push('business', 'commercial', 'review');
  if (contractEligible(app)) p.push('contract');
  p.push('outcome');
  return p;
}

/**
 * Back never re-enters a verified SMS code, and never leaves an application for the identity page
 * once the application exists (identity changes go through Review › Edit).
 */
export function previousStep(app: Application): StepId | null {
  if (app.step === 'outcome' || app.step === 'otp') return null;
  const p = pathFor(app);
  const i = p.indexOf(app.step);
  if (i <= 0) return null;
  const prev = p[i - 1];
  if (prev === 'otp') return app.id ? null : 'identify';
  return prev;
}

export const back = (s: ProposedState): ProposedState => {
  const prev = previousStep(s.app);
  return prev ? persist(withApp(s, { step: prev })) : s;
};

/* ------------------------------------------------------------------ Stage 1: Know Your Business */

export const setKyb = (s: ProposedState, patch: Partial<Application['kyb']>): ProposedState =>
  withApp(s, { kyb: { ...s.app.kyb, ...patch } });

/** Evaluate eligibility (internal, no external call) and route. Saves the qualification record. */
export function submitKyb(s: ProposedState): ProposedState {
  const k = s.app.kyb;
  if (!kybComplete(k)) return s;
  if (s.app.id && s.app.returnTo) return saveKybEdit(s);
  const eligibility = evaluateEligibility({ kind: k.kind, sub: k.sub, revenue: k.revenue, channel: k.channel });
  const backend = { ...s.backend, qualifications: { ...s.backend.qualifications, [s.app.qualificationId]: { kyb: k, eligibility, at: eligibility.at, linkedTo: null } } };
  const flags = eligibility.result === 'MANUAL_REVIEW' ? addFlag(s.app.flags, 'CATEGORY_MANUAL_REVIEW') : dropFlags(s.app.flags, ['CATEGORY_MANUAL_REVIEW']);
  const next: ProposedState = { ...s, backend, app: { ...s.app, eligibility, flags } };
  switch (eligibility.result) {
    case 'ELIGIBLE':
    case 'MANUAL_REVIEW':
      return go(next, 'identify');
    case 'SALES_LEAD':
      return go(next, 'lead');
    case 'NOT_ELIGIBLE':
      return finish(next, 'NOT_ELIGIBLE', 'NOT_ELIGIBLE', eligibility.reason);
    case 'TEMPORARILY_NOT_ELIGIBLE':
      return finish(next, 'TEMPORARILY_NOT_ELIGIBLE', 'TEMPORARILY_NOT_ELIGIBLE', eligibility.reason);
  }
}

/** Saving Stage-1 answers edited after the application exists. Internal re-evaluation only. */
function saveKybEdit(s: ProposedState): ProposedState {
  const app = s.app;
  const k = app.kyb;
  if (!kybComplete(k)) return s;
  const base = app.editBaseline?.kyb;
  const eligibility = evaluateEligibility({ kind: k.kind, sub: k.sub, revenue: k.revenue, channel: k.channel });
  let next: ProposedState = withApp(s, { eligibility, kybSnapshot: app.kybSnapshot ? { ...app.kybSnapshot, ...k, eligibility } : null });
  if (!continuesToIdentity(eligibility)) {
    if (eligibility.result === 'SALES_LEAD') {
      const status: InternalStatus = eligibility.reason === 'REVENUE_BELOW_BAND' ? 'LEAD_LOW_REVENUE' : 'LEAD_HIGH_REVENUE';
      return finish(next, 'SALES_LEAD', status, eligibility.reason);
    }
    const out = eligibility.result === 'TEMPORARILY_NOT_ELIGIBLE' ? 'TEMPORARILY_NOT_ELIGIBLE' : 'NOT_ELIGIBLE';
    return finish(next, out, out, eligibility.reason);
  }
  let flags = eligibility.result === 'MANUAL_REVIEW' ? addFlag(next.app.flags, 'CATEGORY_MANUAL_REVIEW') : dropFlags(next.app.flags, ['CATEGORY_MANUAL_REVIEW']);
  next = withApp(next, { flags });
  // Category changed: reconcile again on the STORED activity (no provider call), re-derive pricing.
  if (base && base.sub !== k.sub) {
    const activity = storedActivity(next.app);
    if (activity) {
      const rc = reconcile(k.kind, k.sub, activity.code);
      next = mapApp(next, (a) => log(a, { kind: 'reuse', check: activity.source === 'CR' ? 'CR_DATA' : 'FL_CERTS', note: 'Category changed: reconciliation re-run on the stored activity, no new provider call' }));
      if (rc.action === 'stop') return finish(next, 'NOT_ELIGIBLE', 'NOT_ELIGIBLE', 'ACTIVITY_REGULATED');
      flags = dropFlags(next.app.flags, ['ACTIVITY_AMBIGUOUS', 'ACTIVITY_UNMAPPED', 'ACTIVITY_CONFLICT_REVIEW']);
      if (rc.action === 'manual_review') flags = addFlag(flags, rc.outcome === 'AMBIGUOUS' ? 'ACTIVITY_AMBIGUOUS' : 'ACTIVITY_UNMAPPED');
      next = withApp(next, { flags, activity: { source: activity.source, activity: activity.code, declaredSub: k.sub, outcome: rc.outcome, action: rc.action, acknowledged: false } });
    }
    const agreed = next.app.commercial.agreed;
    if (agreed && JSON.stringify(buildOffer(k.sub, next.app.commercial.optional, agreed.at).plans) !== JSON.stringify(agreed.plans)) {
      next = withApp(next, { commercial: { ...next.app.commercial, agreed: null } });
    }
  }
  return returnFromEdit(next);
}

function storedActivity(app: Application): { source: 'CR' | 'CERTIFICATE'; code: string } | null {
  if (app.kyb.kind === 'CR' && app.cr.record) return { source: 'CR', code: app.cr.record.activity };
  const cert = app.certs.list.find((c) => c.id === app.certs.selectedId);
  return cert ? { source: 'CERTIFICATE', code: cert.activity } : null;
}

/* ------------------------------------------------------------------ lead capture (Sales route, Freelancer without certificate) */

export const setLead = (s: ProposedState, patch: Partial<Application['lead']>) => withApp(s, { lead: { ...s.app.lead, ...patch } });

export function submitLead(s: ProposedState): ProposedState {
  return sendOtp(s, 'lead', s.app.lead.mobile);
}

function completeLead(s: ProposedState): ProposedState {
  const e = s.app.eligibility!;
  const status: InternalStatus = e.reason === 'FL_CERT_REQUIRED' ? 'LEAD_FL_CERT_REQUIRED' : e.reason === 'REVENUE_BELOW_BAND' ? 'LEAD_LOW_REVENUE' : 'LEAD_HIGH_REVENUE';
  const lead = { qualificationId: s.app.qualificationId, kyb: s.app.kyb, eligibility: e, name: s.app.lead.name, mobile: s.app.lead.mobile, status, at: now() };
  const next = { ...s, backend: { ...s.backend, leads: [...s.backend.leads, lead] } };
  return finish(next, e.reason === 'FL_CERT_REQUIRED' ? 'FL_CERT_REQUIRED' : 'SALES_LEAD', status, e.reason);
}

/* ------------------------------------------------------------------ Stage 2: Identify & Verify */

export const setIdentity = (s: ProposedState, patch: Partial<Application['identity']>) => withApp(s, { identity: { ...s.app.identity, ...patch } });

/**
 * Backend checks, identity first: existing merchant, application for this identity under the same
 * mobile (resume) or another mobile (duplicate). A mobile used with other identities never rejects.
 */
export function identityCheck(s: ProposedState): Application['identityCheck'] {
  if (s.sim.identity !== 'new') return s.sim.identity;
  const appId = s.backend.identities[s.app.identity.identifier];
  if (!appId || appId === s.app.id) return 'new';
  const saved = s.backend.applications[appId];
  return saved && saved.verifiedMobile === s.app.identity.mobile ? 'current_application' : 'duplicate_identity';
}

export function submitIdentify(s: ProposedState): ProposedState {
  if (s.app.id && s.app.returnTo) return saveIdentityEdit(s);
  const check = identityCheck(s);
  return sendOtp(withApp(s, { identityCheck: check }), 'application', s.app.identity.mobile);
}

/** After a successful code for a new identity: create the Application and link the Stage-1 record. */
function createApplication(s: ProposedState): ProposedState {
  const at = now();
  const id = newApplicationId(Date.parse(s.app.createdAt) + Object.keys(s.backend.applications).length);
  const e = s.app.eligibility!;
  const kybSnapshot = { ...s.app.kyb, qualificationId: s.app.qualificationId, eligibility: e, linkedAt: at };
  const q = s.backend.qualifications[s.app.qualificationId];
  const backend = q ? { ...s.backend, qualifications: { ...s.backend.qualifications, [s.app.qualificationId]: { ...q, linkedTo: id } } } : s.backend;
  const first: StepId = s.app.kyb.kind === 'CR' ? 'cr-verify' : 'nafath';
  return go({ ...s, backend }, first, { id, kybSnapshot, status: 'DRAFT', verifiedMobile: s.app.identity.mobile, sessionMobile: s.app.identity.mobile });
}

function routeAfterIdentityOtp(s: ProposedState): ProposedState {
  switch (s.app.identityCheck) {
    case 'existing_merchant': return finish(s, 'EXISTING_MERCHANT', 'EXISTING_MERCHANT');
    case 'duplicate_identity': return finish(s, 'DUPLICATE_IDENTITY', 'DUPLICATE_IDENTITY');
    case 'current_application': return resumeExisting(s);
    default: return createApplication(s);
  }
}

/** Same identity + same mobile: reopen the saved application. Today's Stage-1 draft is discarded. */
function resumeExisting(s: ProposedState): ProposedState {
  const appId = s.backend.identities[s.app.identity.identifier];
  const saved = appId ? s.backend.applications[appId] : null;
  const base = saved ?? resumeFixture(s.app);
  let app: Application = { ...base, ledger: [...base.ledger, ...s.app.ledger.filter((e) => e.kind === 'otp').slice(-1)], sessionMobile: s.app.identity.mobile, resumed: true, otp: { ...s.app.otp, status: 'verified' } };
  app = reuseOnResume(app);
  const step = firstIncomplete(app);
  return persist({ ...s, app: { ...app, step, lastStep: furthest(app.lastStep, step), returnTo: null } });
}

/** The saved application used when the Prototype Controls force "saved application". */
function resumeFixture(app: Application): Application {
  const kind = app.kyb.kind === 'FL_CERT' ? 'FL_CERT' : 'CR';
  const base = prefill(kind, 'business');
  return { ...base, identity: { ...app.identity }, verifiedMobile: app.identity.mobile };
}

/* ------------------------------------------------------------------ OTP */

export function verifyOtp(s: ProposedState, code: string): ProposedState {
  const otp = s.app.otp;
  if (otp.status === 'expired' || otp.status === 'exhausted') return s;
  if (code !== DEMO_SMS_CODE) {
    const attemptsLeft = otp.attemptsLeft - 1;
    return withApp(s, { otp: { ...otp, code, attemptsLeft, status: attemptsLeft <= 0 ? 'exhausted' : 'incorrect' } });
  }
  const verified = withApp(s, { otp: { ...otp, status: 'verified', code } });
  switch (otp.purpose) {
    case 'lead': return completeLead(verified);
    case 'application': return routeAfterIdentityOtp(verified);
    case 'resume': {
      const app = reuseOnResume({ ...verified.app, sessionMobile: verified.app.verifiedMobile, resumed: true });
      const step = firstIncomplete(app);
      return persist({ ...verified, app: { ...app, step, lastStep: furthest(app.lastStep, step), returnTo: null } });
    }
    case 'mobile-change': {
      const mobile = verified.app.identity.mobile;
      return returnFromEdit(withApp(verified, { verifiedMobile: mobile, sessionMobile: mobile }));
    }
  }
}

export const expireOtp = (s: ProposedState): ProposedState => withApp(s, { otp: { ...s.app.otp, status: 'expired' } });
export const resendOtp = (s: ProposedState): ProposedState => {
  const to = s.app.otp.purpose === 'lead' ? s.app.lead.mobile : s.app.otp.purpose === 'resume' ? s.app.verifiedMobile : s.app.identity.mobile;
  return sendOtp(s, s.app.otp.purpose, to);
};
/** "Edit mobile" from the code screen: back to the form that asked for it. */
export function editMobileFromOtp(s: ProposedState): ProposedState {
  const step: StepId = s.app.otp.purpose === 'lead' ? 'lead' : 'identify';
  return withApp(s, { step });
}

/* ------------------------------------------------------------------ Continue Application link (resume) */

/** "Save & exit": send a secure Continue Application link to the verified mobile. */
export function sendContinueLink(s: ProposedState): ProposedState {
  const { app } = s;
  if (!app.id || !app.verifiedMobile) return s;
  const token = newContinueToken(Date.now() + s.backend.sms.length);
  const saved = persist(s);
  return {
    ...saved,
    backend: {
      ...saved.backend,
      tokens: { ...saved.backend.tokens, [token]: app.id },
      sms: [...saved.backend.sms, { to: app.verifiedMobile, kind: 'continue-link', token, text: 'Continue your Madfu application (demo link).', at: now() }]
    }
  };
}

/** The visitor left: a new browser session with no application open. */
export const leaveSession = (s: ProposedState): ProposedState => ({ ...s, app: initialApplication(), scenarioId: s.scenarioId });

/**
 * Opening the link identifies the application but does NOT authorise access: a new session starts on
 * the OTP screen with the known mobile. Nothing else is re-asked; nothing is re-verified.
 */
export function openContinueLink(s: ProposedState, token: string): ProposedState {
  const appId = s.backend.tokens[token];
  const saved = appId ? s.backend.applications[appId] : null;
  if (!saved) return { ...s, app: { ...initialApplication(), step: 'kyb' } };
  const app: Application = { ...saved, sessionMobile: '', resumed: false, returnTo: null, editBaseline: null };
  return sendOtp({ ...s, app }, 'resume', saved.verifiedMobile);
}

/* ------------------------------------------------------------------ Stage 3: CR verification */

const crFingerprint = (app: Application) => `cr:${app.identity.identifier}`;

/** Retrieve CR data once; on later visits the stored result is reused. */
export function runCrVerification(s: ProposedState): ProposedState {
  const fp = crFingerprint(s.app);
  if (reusable(s.app, 'CR_DATA', fp) && s.app.cr.record) {
    return persist(mapApp(s, (a) => log(a, { kind: 'reuse', check: 'CR_DATA', note: 'Stored CR data reused — no new provider call' })));
  }
  const tries = s.app.cr.tries + 1;
  let app = log(s.app, { kind: 'call', check: 'CR_DATA', note: `CR data retrieval (attempt ${tries})` });
  const rec = crAdapter(s.sim, app.kyb.sub);
  if (s.sim.cr.result === 'not_found') return persist({ ...s, app: { ...app, cr: { status: 'not_found', tries, record: null, decision: null, decisionReason: null } } });
  if (!rec) return persist({ ...s, app: { ...app, cr: { status: 'unavailable', tries, record: null, decision: null, decisionReason: null } } });

  app = store(app, makeRecord('CR_DATA', fp, `${rec.status}, ${rec.issuedMonthsAgo} months, address ${rec.nationalAddress.toLowerCase()}`, now(), providerRef('CR', tries)));
  const gov = evaluateGovernment(rec);
  let flags = dropFlags(app.flags, ['ADDITIONAL_DOCUMENTS_REQUIRED', 'NATIONAL_ADDRESS_MISSING', 'NATIONAL_ADDRESS_EXPIRED', 'ACTIVITY_AMBIGUOUS', 'ACTIVITY_UNMAPPED', 'ACTIVITY_CONFLICT_REVIEW']);
  gov.flags.forEach((f) => { flags = addFlag(flags, f); });
  app = { ...app, flags, cr: { status: 'loaded', tries, record: rec, decision: gov.action, decisionReason: gov.reason } };
  const next = { ...s, app };
  if (gov.action === 'manual_review') return finish(next, 'MANUAL_VERIFICATION', 'SUBMITTED_MANUAL_VERIFICATION', gov.reason);
  if (gov.action === 'not_eligible') return finish(next, 'NOT_ELIGIBLE', 'NOT_ELIGIBLE', gov.reason);
  if (gov.action === 'temporarily_not_eligible') return finish(next, 'TEMPORARILY_NOT_ELIGIBLE', 'TEMPORARILY_NOT_ELIGIBLE', gov.reason);
  return applyReconciliation(next, 'CR', rec.activity);
}

function applyReconciliation(s: ProposedState, source: 'CR' | 'CERTIFICATE', activityCode: string): ProposedState {
  const k = s.app.kyb;
  const rc = reconcile(k.kind!, k.sub, activityCode);
  if (rc.action === 'stop') return finish(withApp(s, { activity: { source, activity: activityCode, declaredSub: k.sub, outcome: rc.outcome, action: 'stop', acknowledged: false } }), 'NOT_ELIGIBLE', 'NOT_ELIGIBLE', 'ACTIVITY_REGULATED');
  let flags = dropFlags(s.app.flags, ['ACTIVITY_AMBIGUOUS', 'ACTIVITY_UNMAPPED', 'ACTIVITY_CONFLICT_REVIEW']);
  if (rc.action === 'manual_review') flags = addFlag(flags, rc.outcome === 'AMBIGUOUS' ? 'ACTIVITY_AMBIGUOUS' : 'ACTIVITY_UNMAPPED');
  return persist(withApp(s, { flags, activity: { source, activity: activityCode, declaredSub: k.sub, outcome: rc.outcome, action: rc.action, acknowledged: false } }));
}

/** CONFLICT: the applicant continues; the team confirms the activity. No automatic contract. */
export function acknowledgeActivity(s: ProposedState): ProposedState {
  if (!s.app.activity) return s;
  return persist(withApp(s, { activity: { ...s.app.activity, acknowledged: true }, flags: addFlag(s.app.flags, 'ACTIVITY_CONFLICT_REVIEW') }));
}

export const activityPending = (app: Application) => app.activity?.action === 'clarify' && !app.activity.acknowledged;
export const crCanContinue = (app: Application) => app.cr.status === 'loaded' && app.cr.decision === 'continue' && !activityPending(app);

export const continueFromCr = (s: ProposedState): ProposedState => (crCanContinue(s.app) ? go(s, s.app.returnTo ?? 'persons', { returnTo: null }) : s);

/* ------------------------------------------------------------------ authorised people */

const personsFingerprint = (app: Application) => `persons:${app.identity.identifier}`;

export function loadPersons(s: ProposedState): ProposedState {
  const fp = personsFingerprint(s.app);
  if (reusable(s.app, 'PERSONS', fp) && s.app.persons.status !== 'idle') {
    return persist(mapApp(s, (a) => log(a, { kind: 'reuse', check: 'PERSONS', note: 'Stored people list reused — no new provider call' })));
  }
  const tries = s.app.persons.tries + 1;
  let app = log(s.app, { kind: 'call', check: 'PERSONS', note: `Associated people retrieval (attempt ${tries})` });
  if (s.sim.persons === 'unavailable') return persist({ ...s, app: { ...app, persons: { ...app.persons, status: 'unavailable', tries } } });
  const list = personsAdapter(s.sim.persons);
  const eligible = eligiblePersons(list);
  app = store(app, makeRecord('PERSONS', fp, `${eligible.length} eligible individual(s)`, now(), providerRef('PPL', tries)));
  return persist({ ...s, app: { ...app, persons: { status: eligible.length ? 'loaded' : 'none', tries, list, selectedId: eligible.length === 1 ? eligible[0].id : app.persons.selectedId } } });
}

/**
 * Changing the selected person never resets the shared attempt counter. A successful verification
 * belonged to the previous person, so it is invalidated (and with it the contract).
 */
export function selectPerson(s: ProposedState, id: string): ProposedState {
  const n = s.app.nafath;
  const changedAfterSuccess = n.status === 'verified' && n.verifiedFor !== id;
  let app: Application = { ...s.app, persons: { ...s.app.persons, selectedId: id } };
  if (changedAfterSuccess) {
    app = invalidate(app, ['NAFATH'], 'Selected authorised person changed');
    app = { ...app, nafath: { ...n, status: 'idle', verifiedFor: null }, contract: { status: 'unavailable', acceptedAt: '' } };
  }
  return { ...s, app };
}

export function continueWithoutPerson(s: ProposedState): ProposedState {
  return go(s, 'business', { persons: { ...s.app.persons, status: 'none' }, flags: addFlag(addFlag(s.app.flags, 'NO_ELIGIBLE_PERSON'), 'NAFATH_UNVERIFIED') });
}

/* ------------------------------------------------------------------ Nafath */

const nafathSubject = (app: Application) => (app.kyb.kind === 'CR' ? app.persons.selectedId ?? '' : app.identity.identifier);
const nafathFingerprint = (app: Application) => `nafath:${app.id}:${nafathSubject(app)}`;
export const nafathRemaining = (app: Application) => Math.max(0, LIMITS.nafathAttempts - app.nafath.failures);

export function startNafath(s: ProposedState): ProposedState {
  const n = s.app.nafath;
  if (reusable(s.app, 'NAFATH', nafathFingerprint(s.app))) {
    return go(mapApp(s, (a) => log(a, { kind: 'reuse', check: 'NAFATH', note: 'Nafath verified previously — reused, no new request' })), 'nafath', { nafath: { ...n, status: 'verified' } });
  }
  if (n.failures >= LIMITS.nafathAttempts) return withApp(s, { step: 'nafath', nafath: { ...n, status: 'exhausted' } });
  const requests = n.requests + 1;
  const app = log(s.app, { kind: 'call', check: 'NAFATH', note: `Nafath request ${requests}` });
  return go({ ...s, app }, 'nafath', { nafath: { ...n, status: 'waiting', requests, number: NAFATH_NUMBERS[(requests - 1) % NAFATH_NUMBERS.length] } });
}

/** Rejected and timeout use an attempt; a technical failure does not unless the rule flag says so. */
export function nafathResult(s: ProposedState, result: NafathResult): ProposedState {
  const n = s.app.nafath;
  if (result === 'verified') {
    let app = store(s.app, makeRecord('NAFATH', nafathFingerprint(s.app), 'verified', now(), providerRef('NFT', n.requests)));
    app = { ...app, nafath: { ...n, status: 'verified', lastResult: result, verifiedFor: nafathSubject(s.app) }, flags: dropFlags(app.flags, ['NAFATH_UNVERIFIED']) };
    return persist({ ...s, app });
  }
  const counts = result !== 'technical' || RULE_FLAGS.nafathTechnicalFailureCounts;
  const failures = counts ? n.failures + 1 : n.failures;
  const exhausted = failures >= LIMITS.nafathAttempts;
  return persist(withApp(s, {
    nafath: { ...n, status: exhausted ? 'exhausted' : 'failed', failures, lastResult: result },
    flags: exhausted ? addFlag(s.app.flags, 'NAFATH_UNVERIFIED') : s.app.flags
  }));
}

/** The answer the simulated Nafath app gives to the current request. */
export const nextNafathAnswer = (s: ProposedState) => nafathAdapter(s.sim, s.app.nafath.requests - 1);

export function continueAfterNafath(s: ProposedState): ProposedState {
  const n = s.app.nafath;
  if (s.app.returnTo && n.status === 'verified') return go(s, s.app.returnTo, { returnTo: null });
  if (s.app.kyb.kind === 'CR') return go(s, 'business');
  if (n.status === 'verified') return go(s, 'certificates');
  // Freelancer, Nafath failed twice: certificates cannot be retrieved for an unverified identity.
  return finish(withApp(s, { flags: addFlag(s.app.flags, 'NAFATH_UNVERIFIED') }), 'MANUAL_VERIFICATION', 'SUBMITTED_MANUAL_VERIFICATION');
}

/* ------------------------------------------------------------------ Freelancer certificates */

const certsFingerprint = (app: Application) => `certs:${app.identity.identifier}`;

export function loadCertificates(s: ProposedState): ProposedState {
  const fp = certsFingerprint(s.app);
  if (reusable(s.app, 'FL_CERTS', fp) && s.app.certs.status === 'loaded') {
    return persist(mapApp(s, (a) => log(a, { kind: 'reuse', check: 'FL_CERTS', note: 'Stored certificates reused — no new retrieval' })));
  }
  const tries = s.app.certs.tries + 1;
  let app = log(s.app, { kind: 'call', check: 'FL_CERTS', note: `Freelancer Certificate retrieval (attempt ${tries})` });
  const r = s.sim.certificates;
  if (r === 'unavailable') return persist({ ...s, app: { ...app, certs: { ...app.certs, status: 'unavailable', tries } } });
  if (r === 'none') {
    app = store(app, makeRecord('FL_CERTS', fp, 'no active certificate', now(), providerRef('FLC', tries)));
    // No document upload fallback: the applicant becomes a "certificate required" lead.
    return finish({ ...s, app: { ...app, certs: { ...app.certs, status: 'none', tries, list: [] } } }, 'FL_CERT_REQUIRED', 'LEAD_FL_CERT_NOT_FOUND', 'FL_CERT_REQUIRED');
  }
  const list = certificatesAdapter(r, app.kyb.sub);
  const selectable = list.filter((c) => c.status === 'active' && c.issue !== 'duplicate');
  app = store(app, makeRecord('FL_CERTS', fp, `${list.length} certificate(s), ${selectable.length} selectable`, now(), providerRef('FLC', tries)));
  return persist({ ...s, app: { ...app, certs: { ...app.certs, status: 'loaded', tries, list, selectedId: app.certs.selectedId ?? (selectable.length === 1 ? selectable[0].id : null) } } });
}

export function selectCertificate(s: ProposedState, id: string): ProposedState {
  if (s.app.certs.selectedId === id) return s;
  let app: Application = { ...s.app, certs: { ...s.app.certs, selectedId: id }, activity: null };
  if (app.business.ibanStatus === 'verified') {
    app = invalidate(app, ['IBAN'], 'Freelance certificate changed');
    app = { ...app, business: { ...app.business, ibanStatus: 'idle', bankName: '' } };
  }
  return { ...s, app };
}

export function confirmCertificate(s: ProposedState): ProposedState {
  const cert = s.app.certs.list.find((c) => c.id === s.app.certs.selectedId);
  if (!cert || cert.status !== 'active' || cert.issue === 'duplicate') return s;
  let flags = dropFlags(s.app.flags, ['CERTIFICATE_INCONSISTENT']);
  if (cert.issue === 'inconsistent') flags = addFlag(flags, 'CERTIFICATE_INCONSISTENT');
  const next = applyReconciliation(withApp(s, { flags }), 'CERTIFICATE', cert.activity);
  if (next.app.step === 'outcome' || activityPending(next.app)) return next;
  return go(next, next.app.returnTo ?? 'business', { returnTo: null });
}

export function continueFromCertificates(s: ProposedState): ProposedState {
  if (activityPending(s.app) || !s.app.activity) return s;
  return go(s, s.app.returnTo ?? 'business', { returnTo: null });
}

/* ------------------------------------------------------------------ Stage 4: Business & Banking */

export const setBusiness = (s: ProposedState, patch: Partial<Application['business']>) => withApp(s, { business: { ...s.app.business, ...patch } });

/** IBAN ownership target: the business (CR), or the individual + certificate (Freelancer). */
export const ibanTarget = (app: Application) => (app.kyb.kind === 'CR' ? `cr:${app.identity.identifier}` : `nid:${app.identity.identifier}:${app.certs.selectedId ?? ''}`);
const ibanFingerprint = (app: Application) => `iban:${app.business.iban}:${ibanTarget(app)}`;

/** Freelancer: is the bank account linked to the certificate? "No" skips IBAN; banking set-up later. */
export function setBankLinked(s: ProposedState, v: 'yes' | 'no'): ProposedState {
  if (s.app.business.bankLinked === v) return s;
  let app = s.app;
  if (app.verifications.IBAN?.status === 'valid') app = invalidate(app, ['IBAN'], 'Bank-linked answer changed');
  const b = app.business;
  if (v === 'no') {
    return { ...s, app: { ...app, business: { ...b, bankLinked: 'no', ibanStatus: 'skipped', bankName: '' }, flags: addFlag(dropFlags(app.flags, ['IBAN_UNVERIFIED']), 'BANKING_SETUP_REQUIRED') } };
  }
  return { ...s, app: { ...app, business: { ...b, bankLinked: 'yes', ibanStatus: 'idle', bankName: '' }, flags: dropFlags(app.flags, ['BANKING_SETUP_REQUIRED']) } };
}

/** Editing the IBAN invalidates only the IBAN verification. The attempt counter belongs to the application. */
export function setIban(s: ProposedState, iban: string): ProposedState {
  const b = s.app.business;
  if (iban === b.iban) return s;
  let app = s.app;
  if (app.verifications.IBAN?.status === 'valid') app = invalidate(app, ['IBAN'], 'IBAN changed');
  return { ...s, app: { ...app, business: { ...b, iban, ibanStatus: b.ibanFailures >= LIMITS.ibanAttempts ? 'unverified' : 'idle', bankName: '' }, flags: b.ibanFailures >= LIMITS.ibanAttempts ? app.flags : dropFlags(app.flags, ['IBAN_UNVERIFIED']) } };
}

/** Same IBAN and same owner as a stored success: reused. Otherwise a new ownership check starts. */
export function startIbanCheck(s: ProposedState): ProposedState {
  if (reusable(s.app, 'IBAN', ibanFingerprint(s.app))) {
    const app = log(s.app, { kind: 'reuse', check: 'IBAN', note: 'Same IBAN verified previously — reused, no new check' });
    return persist({ ...s, app: { ...app, business: { ...app.business, ibanStatus: 'verified', bankName: bankFromIban(app.business.iban) } } });
  }
  return setBusiness(s, { ibanStatus: 'verifying' });
}

export function finishIbanCheck(s: ProposedState): ProposedState {
  const b = s.app.business;
  const result = ibanAdapter(s.sim, b.ibanFailures);
  let app = log(s.app, { kind: 'call', check: 'IBAN', note: `IBAN ownership check (${s.app.kyb.kind === 'CR' ? 'against the business' : 'against the individual + certificate'})` });
  if (result === 'verified') {
    app = store(app, makeRecord('IBAN', ibanFingerprint(app), 'owner matched', now(), providerRef('IBN', b.ibanFailures + 1)));
    return persist({ ...s, app: { ...app, business: { ...b, ibanStatus: 'verified', ibanLast: result, bankName: bankFromIban(b.iban) }, flags: dropFlags(app.flags, ['IBAN_UNVERIFIED']) } });
  }
  const ibanFailures = b.ibanFailures + 1;
  const done = ibanFailures >= LIMITS.ibanAttempts;
  return persist({ ...s, app: { ...app, business: { ...b, ibanStatus: done ? 'unverified' : 'failed', ibanFailures, ibanLast: result, bankName: '' }, flags: done ? addFlag(app.flags, 'IBAN_UNVERIFIED') : app.flags } });
}

export const ibanSettled = (app: Application) => ['verified', 'unverified', 'skipped'].includes(app.business.ibanStatus);
export const bankingComplete = (app: Application) => {
  const b = app.business;
  if (fl(app) && !b.bankLinked) return false;
  if (!ibanSettled(app)) return false;
  if (!b.vat) return false;
  return true;
};

export const submitBusiness = (s: ProposedState): ProposedState => go(s, s.app.returnTo ?? 'commercial', { returnTo: null, editBaseline: null });

/* ------------------------------------------------------------------ Stage 5: Commercial Offer */

export function toggleOptionalPlan(s: ProposedState, t: Tenure): ProposedState {
  const cur = s.app.commercial.optional;
  return withApp(s, { commercial: { ...s.app.commercial, optional: cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t].sort((a, b) => a - b) } });
}
export const addEvidence = (s: ProposedState, id: string) => withApp(s, { commercial: { ...s.app.commercial, evidence: s.app.commercial.evidence.includes(id) ? s.app.commercial.evidence : [...s.app.commercial.evidence, id], evidenceSkipped: false } });
export const removeEvidence = (s: ProposedState, id: string) => withApp(s, { commercial: { ...s.app.commercial, evidence: s.app.commercial.evidence.filter((x) => x !== id) } });

/** Confirm the offer: standard commission, base plans + selected optional plans. Never waits for pricing review. */
export function confirmOffer(s: ProposedState): ProposedState {
  const c = s.app.commercial;
  const agreed = buildOffer(s.app.kyb.sub, c.optional);
  const flags = c.evidence.length ? addFlag(s.app.flags, 'COMMERCIAL_PRICING_REVIEW') : dropFlags(s.app.flags, ['COMMERCIAL_PRICING_REVIEW']);
  return go(s, s.app.returnTo ?? 'review', { commercial: { ...c, agreed, evidenceSkipped: c.evidence.length === 0 }, flags, returnTo: null, editBaseline: null });
}

/* ------------------------------------------------------------------ Stage 6: Review and Edit */

export function startEdit(s: ProposedState, section: SectionId, returnTo: StepId = 'review'): ProposedState {
  const a = s.app;
  const editBaseline = { kyb: a.kyb, identity: a.identity, business: a.business, commercial: a.commercial };
  const step: StepId =
    section === 'kyb' ? 'kyb'
      : section === 'identification' ? 'identify'
        : section === 'verified' ? (a.kyb.kind === 'CR' ? 'persons' : 'certificates')
          : section === 'banking' ? 'business'
            : 'commercial';
  return withApp(s, { step, returnTo, editBaseline });
}

/** Cancel restores the values the edit started with. Verifications are untouched. */
export function cancelEdit(s: ProposedState): ProposedState {
  const b = s.app.editBaseline;
  const restored = b ? { kyb: b.kyb, identity: b.identity, business: b.business, commercial: b.commercial } : {};
  return withApp(s, { ...restored, step: s.app.returnTo ?? 'review', returnTo: null, editBaseline: null });
}

function returnFromEdit(s: ProposedState): ProposedState {
  return go(s, s.app.returnTo ?? 'review', { returnTo: null, editBaseline: null });
}

/** Saving Identification edited from Review: invalidate exactly what depends on what changed. */
function saveIdentityEdit(s: ProposedState): ProposedState {
  const base = s.app.editBaseline?.identity;
  if (!base) return returnFromEdit(s);
  const idChanged = base.identifier !== s.app.identity.identifier;
  const mobileChanged = base.mobile !== s.app.identity.mobile;
  let next = s;
  if (idChanged) {
    const check = identityCheck(next);
    if (check !== 'new') return withApp(next, { identityCheck: check });
    let app = next.app;
    const deps: VerificationType[] = app.kyb.kind === 'CR' ? ['CR_DATA', 'PERSONS', 'NAFATH', 'IBAN'] : ['NAFATH', 'FL_CERTS', 'IBAN'];
    app = invalidate(app, deps, app.kyb.kind === 'CR' ? 'CR number changed' : 'National ID changed');
    app = {
      ...app,
      identityCheck: 'new',
      cr: { status: 'idle', tries: 0, record: null, decision: null, decisionReason: null },
      activity: null,
      persons: { status: 'idle', tries: 0, list: [], selectedId: null },
      // The Nafath attempt counter belongs to the application and is not reset.
      nafath: { ...app.nafath, status: app.nafath.status === 'exhausted' ? 'exhausted' : 'idle', verifiedFor: null, lastResult: null },
      certs: { status: 'idle', tries: 0, list: [], selectedId: null },
      business: { ...app.business, ibanStatus: app.business.ibanStatus === 'skipped' ? 'skipped' : 'idle', bankName: '' },
      contract: { status: 'unavailable', acceptedAt: '' },
      flags: dropFlags(app.flags, ['ADDITIONAL_DOCUMENTS_REQUIRED', 'NATIONAL_ADDRESS_MISSING', 'NATIONAL_ADDRESS_EXPIRED', 'ACTIVITY_AMBIGUOUS', 'ACTIVITY_UNMAPPED', 'ACTIVITY_CONFLICT_REVIEW', 'NO_ELIGIBLE_PERSON', 'IBAN_UNVERIFIED', 'CERTIFICATE_INCONSISTENT'])
    };
    const identities = { ...next.backend.identities };
    delete identities[base.identifier];
    next = { ...next, app, backend: { ...next.backend, identities } };
  }
  if (mobileChanged) {
    // The new mobile must be verified; then the edit returns to Review (or continues below).
    const after = idChanged ? withApp(next, { returnTo: firstIncomplete(next.app) }) : next;
    return sendOtp(after, 'mobile-change', s.app.identity.mobile);
  }
  if (idChanged) return go(next, firstIncomplete(next.app), { returnTo: null, editBaseline: null });
  return returnFromEdit(next);
}

/* ------------------------------------------------------------------ contract gate */

/** Why the contract is not available (empty = available). Configurable gates, no screen logic. */
export function contractBlockers(app: Application): string[] {
  const out: string[] = [];
  if (app.nafath.status !== 'verified') out.push('Nafath not verified');
  if (app.kyb.kind === 'CR' && !(app.persons.status === 'loaded' && app.persons.selectedId)) out.push('No verified authorised person');
  if (app.flags.includes('ACTIVITY_CONFLICT_REVIEW')) out.push('Activity conflict to be confirmed by the team');
  if (fl(app)) {
    const cert = app.certs.list.find((c) => c.id === app.certs.selectedId);
    if (!cert || cert.status !== 'active') out.push('No selected certificate');
    if (RULE_FLAGS.flLinkedIbanRequiredBeforeContract && app.business.bankLinked !== 'yes') out.push('Bank account not linked to the certificate (compliance rule flag)');
  }
  return out;
}
export const contractEligible = (app: Application) => contractBlockers(app).length === 0;

export interface Issue { section: SectionId; message: string }

export function reviewIssues(app: Application): Issue[] {
  const out: Issue[] = [];
  const b = app.business;
  if (fl(app) && !b.bankLinked) out.push({ section: 'banking', message: 'Tell us whether your bank account is linked to your certificate.' });
  else if (b.bankLinked !== 'no' && !b.iban) out.push({ section: 'banking', message: 'Add the IBAN for settlements.' });
  else if (!ibanSettled(app)) out.push({ section: 'banking', message: 'Finish verifying the IBAN.' });
  if (!b.vat) out.push({ section: 'banking', message: 'Answer whether you are VAT registered.' });
  if (!app.commercial.agreed) out.push({ section: 'commercial', message: 'Confirm your commercial offer.' });
  if (fl(app) && !app.certs.selectedId) out.push({ section: 'verified', message: 'Select a freelance certificate.' });
  return out;
}

export function continueFromReview(s: ProposedState): ProposedState {
  if (reviewIssues(s.app).length) return s;
  if (contractEligible(s.app)) {
    return go(s, 'contract', { contract: { status: s.app.contract.status === 'accepted' ? 'accepted' : 'ready', acceptedAt: s.app.contract.acceptedAt } });
  }
  const blockers = contractBlockers(s.app);
  const onlyBanking = blockers.length === 1 && blockers[0].startsWith('Bank account not linked');
  if (onlyBanking) return finish(withApp(s, { contract: { status: 'unavailable', acceptedAt: '' } }), 'SUBMITTED_BANKING_PENDING', 'SUBMITTED_BANKING_PENDING');
  return finish(withApp(s, { contract: { status: 'unavailable', acceptedAt: '' } }), 'MANUAL_VERIFICATION', 'SUBMITTED_MANUAL_VERIFICATION');
}

/* ------------------------------------------------------------------ Stage 7 / 8: Contract, Submit */

export const acceptContract = (s: ProposedState): ProposedState => persist(withApp(s, { contract: { status: 'accepted', acceptedAt: now() } }));

export function submitApplication(s: ProposedState): ProposedState {
  if (s.app.contract.status !== 'accepted') return s;
  if (fl(s.app) && s.app.business.bankLinked === 'no') return finish(s, 'SUBMITTED_BANKING_PENDING', 'SUBMITTED_BANKING_PENDING');
  return finish(s, 'SUBMITTED', 'SUBMITTED');
}

export const declineContract = (s: ProposedState): ProposedState =>
  finish(withApp(s, { contract: { status: 'declined', acceptedAt: '' } }), 'CONTRACT_DECLINED', 'CONTRACT_DECLINED');

/** After a decline (or a resume after one), the contract opens again. */
export const reopenContract = (s: ProposedState): ProposedState =>
  go(s, 'contract', { outcome: null, outcomeReason: null, status: 'DRAFT', contract: { status: 'ready', acceptedAt: '' } });

/* ------------------------------------------------------------------ resume target */

/** First screen that still needs input. Used after OTP on resume and after invalidating edits. */
export function firstIncomplete(app: Application): StepId {
  if (!app.id) return app.eligibility ? 'identify' : 'kyb';
  if (app.contract.status === 'declined') return 'contract';
  if (app.kyb.kind === 'CR') {
    if (!crCanContinue(app)) return 'cr-verify';
    if (app.persons.status === 'idle' || app.persons.status === 'unavailable' || (app.persons.status === 'loaded' && !app.persons.selectedId)) return 'persons';
    if (app.persons.status === 'loaded' && app.nafath.status !== 'verified' && app.nafath.status !== 'exhausted') return 'nafath';
  } else {
    if (app.nafath.status !== 'verified') return 'nafath';
    if (app.certs.status !== 'loaded' || !app.certs.selectedId || !app.activity || activityPending(app)) return 'certificates';
  }
  if (!bankingComplete(app)) return 'business';
  if (!app.commercial.agreed) return 'commercial';
  if (app.lastStep === 'contract' && contractEligible(app)) return 'contract';
  return 'review';
}

/** The next operation that would create a NEW external call (Internal View). */
export function nextPaidCall(s: ProposedState): string {
  const { app } = s;
  if (app.step === 'otp' && app.otp.status !== 'verified') return 'None — the SMS code was already sent';
  if (!app.id) return app.step === 'identify' || app.step === 'lead' ? 'SMS OTP when the form is submitted' : 'None — Stage 1 is internal (no provider call)';
  const step = app.step;
  if (step === 'cr-verify' && !reusable(app, 'CR_DATA', crFingerprint(app))) return 'CR data retrieval';
  if (step === 'persons' && !reusable(app, 'PERSONS', personsFingerprint(app))) return 'Associated people retrieval';
  if (step === 'nafath' && app.nafath.status !== 'verified') return app.nafath.status === 'exhausted' ? 'None — Nafath attempts used' : 'Nafath request';
  if (step === 'certificates' && !reusable(app, 'FL_CERTS', certsFingerprint(app))) return 'Freelancer Certificate retrieval';
  if (step === 'business' && app.business.bankLinked !== 'no' && app.business.ibanStatus !== 'verified' && app.business.ibanStatus !== 'unverified') return 'IBAN ownership check';
  return 'None — the next screen needs no provider call';
}

/* ------------------------------------------------------------------ prefilled applications (scenarios, PDF, boards) */

type PrefillKind = 'CR' | 'FL_CERT';

/**
 * A healthy self-service application filled up to (not including) `upTo`, with the verification
 * records and ledger entries the earlier steps would have produced. Used by scenarios and the PDF.
 */
export function prefill(kind: PrefillKind, upTo: StepId, sim: Sim = initialSim()): Application {
  const order: StepId[] = ['kyb', 'identify', 'otp', 'cr-verify', 'persons', 'nafath', 'certificates', 'business', 'commercial', 'review', 'contract', 'outcome'];
  const reach = (step: StepId) => order.indexOf(upTo) > order.indexOf(step);
  const isFl = kind === 'FL_CERT';
  const at = '2026-10-23T08:00:00.000Z';
  let app = initialApplication(1_760_000_000_000);
  const sub = isFl ? 'services-design' : 'food-cafe';
  const kyb = isFl
    ? { kind, group: 'services', sub, revenue: 'SELF_SERVICE_BAND' as const, channel: 'online' as const, websiteUrl: 'https://studio.example.com', mapsUrl: '' }
    : { kind, group: 'food', sub, revenue: 'SELF_SERVICE_BAND' as const, channel: 'both' as const, websiteUrl: 'https://najdroastery.example.com', mapsUrl: 'https://maps.google.com/?q=24.7136,46.6753' };
  app = { ...app, step: upTo, lastStep: upTo, kyb };
  if (reach('kyb')) app = { ...app, eligibility: evaluateEligibility({ kind, sub, revenue: kyb.revenue, channel: kyb.channel }, at) };
  if (reach('identify')) app = { ...app, identity: { identifier: isFl ? DEMO.nationalId : DEMO.cr, mobile: DEMO.mobile }, identityCheck: 'new' };
  if (reach('otp')) {
    app = log(app, { kind: 'otp', check: 'OTP', note: 'SMS code sent (application)' }, at);
    app = {
      ...app, id: newApplicationId(1_760_000_000_000), status: 'DRAFT', verifiedMobile: DEMO.mobile, sessionMobile: DEMO.mobile,
      otp: { ...app.otp, status: 'verified' },
      kybSnapshot: { ...kyb, qualificationId: app.qualificationId, eligibility: app.eligibility!, linkedAt: at }
    };
  }
  if (!isFl && reach('cr-verify')) {
    const rec = crAdapter(sim, sub)!;
    app = log(app, { kind: 'call', check: 'CR_DATA', note: 'CR data retrieval (attempt 1)' }, at);
    app = store(app, makeRecord('CR_DATA', `cr:${DEMO.cr}`, `${rec.status}, ${rec.issuedMonthsAgo} months, address ${rec.nationalAddress.toLowerCase()}`, at, providerRef('CR', 1)));
    const rc = reconcile('CR', sub, rec.activity);
    app = { ...app, cr: { status: 'loaded', tries: 1, record: rec, decision: 'continue', decisionReason: 'OK' }, activity: { source: 'CR', activity: rec.activity, declaredSub: sub, outcome: rc.outcome, action: rc.action, acknowledged: false } };
  }
  if (!isFl && reach('persons')) {
    const list = personsAdapter(sim.persons === 'one' ? 'one' : 'multiple');
    app = log(app, { kind: 'call', check: 'PERSONS', note: 'Associated people retrieval (attempt 1)' }, at);
    app = store(app, makeRecord('PERSONS', `persons:${DEMO.cr}`, `${eligiblePersons(list).length} eligible individual(s)`, at, providerRef('PPL', 1)));
    app = { ...app, persons: { status: 'loaded', tries: 1, list, selectedId: 'p1' } };
  }
  if (reach('nafath')) {
    const subject = isFl ? DEMO.nationalId : 'p1';
    app = log(app, { kind: 'call', check: 'NAFATH', note: 'Nafath request 1' }, at);
    app = store(app, makeRecord('NAFATH', `nafath:${app.id}:${subject}`, 'verified', at, providerRef('NFT', 1)));
    app = { ...app, nafath: { ...app.nafath, status: 'verified', requests: 1, lastResult: 'verified', verifiedFor: subject } };
  }
  if (isFl && reach('certificates')) {
    const list = certificatesAdapter('one', sub);
    app = log(app, { kind: 'call', check: 'FL_CERTS', note: 'Freelancer Certificate retrieval (attempt 1)' }, at);
    app = store(app, makeRecord('FL_CERTS', `certs:${DEMO.nationalId}`, '1 certificate(s), 1 selectable', at, providerRef('FLC', 1)));
    const rc = reconcile(kind, sub, list[0].activity);
    app = { ...app, certs: { status: 'loaded', tries: 1, list, selectedId: list[0].id }, activity: { source: 'CERTIFICATE', activity: list[0].activity, declaredSub: sub, outcome: rc.outcome, action: rc.action, acknowledged: false } };
  }
  if (reach('business')) {
    const iban = demoIban(isFl ? '80' : '10', '4821');
    app = { ...app, business: { ...app.business, bankLinked: isFl ? 'yes' : null, iban, vat: 'no', branches: isFl ? '' : '2' } };
    app = log(app, { kind: 'call', check: 'IBAN', note: 'IBAN ownership check' }, at);
    app = store(app, makeRecord('IBAN', `iban:${iban}:${ibanTarget(app)}`, 'owner matched', at, providerRef('IBN', 1)));
    app = { ...app, business: { ...app.business, ibanStatus: 'verified', ibanLast: 'verified', bankName: bankFromIban(iban) } };
  }
  if (reach('commercial')) app = { ...app, commercial: { optional: [6], evidence: [], evidenceSkipped: true, agreed: buildOffer(sub, [6], at) } };
  if (reach('review') && contractEligible(app)) app = { ...app, contract: { status: 'ready', acceptedAt: '' } };
  return app;
}

/** A state whose backend holds `app` (saved), so resume and duplicate detection see it. */
export function withSaved(app: Application, sim: Sim = initialSim(), scenarioId: string | null = null): ProposedState {
  return persist({ app, sim, scenarioId, backend: initialBackend() });
}
