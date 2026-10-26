/**
 * Madfu Proposed v4 — pure transitions. Components call these through `apply(fn)`; tests call them
 * directly. No transition talks to a real service: answers come from the Prototype Controls (Sim).
 *
 * Order: Know Your Business (internal) → Identifier + mobile + prerequisite → internal existence
 * check → OTP (entered mobile for a new identifier; REGISTERED mobile for an existing application or
 * account) → lifecycle routing → self-onboarding (CR: CR data + owners/managers; FL: certificate
 * pre-check) → mobile ↔ National ID → Nafath → (FL: certificate) → Business Details → Commercial
 * Offer → Review → Contract → Submit → Application Status.
 */
import { deriveCategory } from './activity';
import { LIMITS, RULE_FLAGS, isFreelancer } from './config';
import { evaluateEligibility, kybComplete } from './eligibility';
import { evaluateGovernment } from './government';
import {
  DEMO, DEMO_SMS_CODE, NAFATH_NUMBERS, bankFromIban, certificatesAdapter, crAdapter, demoIban, eligiblePersons, ibanAdapter,
  mobileMatchAdapter, nafathAdapter, newApplicationId, newContinueToken, newQualificationId, personsAdapter, providerRef, selectableCertificates
} from './mock';
import { buildOffer } from './pricing';
import { assessRisk } from './risk';
import { validateMapsUrl, validateWebsite } from './urls';
import { invalidate, log, makeRecord, reusable, reuseOnResume, store } from './verifications';
import type {
  Application, Backend, Existence, Flag, Lifecycle, NafathResult, OtpState, OutcomeKind, ProposedState, ReasonCode, SectionId, Sim, StepId
} from './types';

/* ------------------------------------------------------------------ initial state */

export function initialSim(): Sim {
  return {
    existence: 'auto',
    rateLimited: false,
    cr: { result: 'found', status: 'ACTIVE', ageMonths: 26, entity: 'SAUDI', nationalAddress: 'VALID', activities: 'auto' },
    persons: 'multiple',
    mobileMatch: ['match'],
    nafath: ['verified'],
    certificates: 'one',
    iban: ['verified']
  };
}

const freshOtp = (): OtpState => ({ purpose: 'application', to: '', status: 'sent', attemptsLeft: LIMITS.otpAttempts, resendsLeft: LIMITS.otpResends, code: '', resendAt: 0 });

export function initialApplication(seed = Date.now()): Application {
  return {
    qualificationId: newQualificationId(seed),
    id: null,
    createdAt: new Date(seed).toISOString(),
    step: 'kyb',
    lastStep: 'kyb',
    returnTo: null,
    editBaseline: null,
    kyb: { kind: null, group: '', sub: '', revenue: null, channel: null },
    eligibility: null,
    kybSnapshot: null,
    identity: { identifier: '', mobile: '', prerequisite: null },
    existence: null,
    throttled: false,
    identifyChecks: 0,
    registeredMobile: '',
    contactMobileVerified: false,
    authorizedMobileVerified: false,
    sessionVerified: false,
    pendingMobile: '',
    otp: freshOtp(),
    cr: { status: 'idle', tries: 0, record: null, gov: null, govReason: null },
    categoryCheck: null,
    risk: null,
    persons: { status: 'idle', tries: 0, list: [], selectedId: null },
    mobileMatch: { status: 'idle', checks: 0, matchedFor: null },
    nafath: { status: 'idle', failures: 0, technical: 0, requests: 0, lastResult: null, number: NAFATH_NUMBERS[0], verifiedFor: null },
    certs: { precheck: 'idle', status: 'idle', tries: 0, list: [], selectedId: null },
    business: { websiteUrl: '', mapsUrl: '', iban: '', ibanStatus: 'idle', ibanFailures: 0, ibanLast: null, bankName: '' },
    commercial: { reviewRequested: false, evidence: [], uploadError: null, agreed: null },
    contract: { status: 'unavailable', acceptedAt: '' },
    verifications: {},
    ledger: [],
    flags: [],
    status: 'QUALIFICATION',
    outcome: null,
    outcomeReason: null,
    submittedAt: ''
  };
}

export const initialBackend = (): Backend => ({ qualifications: {}, applications: {}, identities: {}, merchants: {}, leads: [], tokens: {}, sms: [] });

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
const ORDER: StepId[] = ['kyb', 'identify', 'otp', 'persons', 'nafath', 'certificates', 'business', 'commercial', 'review', 'contract', 'outcome', 'status', 'login'];
const furthest = (a: StepId, b: StepId) => (ORDER.indexOf(b) > ORDER.indexOf(a) ? b : a);

/** Move to a step and remember the furthest step reached. Saves the application. */
export function go(s: ProposedState, step: StepId, patch: Partial<Application> = {}): ProposedState {
  return persist(withApp(s, { ...patch, step, lastStep: furthest(s.app.lastStep, step) }));
}

/** Save the application in the simulated backend (resume, existence checks, Continue links). */
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

function finish(s: ProposedState, outcome: OutcomeKind, status: Lifecycle, reason: ReasonCode | null = null): ProposedState {
  return go(s, 'outcome', { outcome, status, outcomeReason: reason, returnTo: null, editBaseline: null, submittedAt: status === 'SUBMITTED' ? now() : s.app.submittedAt });
}

/** Continue links stop working when the application leaves DRAFT or its mobile changes. */
function revokeTokens(s: ProposedState): ProposedState {
  const id = s.app.id;
  if (!id) return s;
  const tokens = Object.fromEntries(Object.entries(s.backend.tokens).filter(([, appId]) => appId !== id));
  return { ...s, backend: { ...s.backend, tokens } };
}

function sendOtp(s: ProposedState, purpose: OtpState['purpose'], to: string, fresh = true): ProposedState {
  const resendsLeft = fresh ? LIMITS.otpResends : s.app.otp.resendsLeft - 1;
  const otp: OtpState = { purpose, to, status: 'sent', attemptsLeft: LIMITS.otpAttempts, resendsLeft, code: '', resendAt: Date.now() + LIMITS.otpResendSeconds * 1000 };
  const app = log({ ...s.app, otp }, { kind: 'otp', check: 'OTP', note: `SMS code sent (${purpose})` });
  return {
    ...s,
    app: { ...app, step: 'otp', lastStep: furthest(app.lastStep, 'otp') },
    backend: { ...s.backend, sms: [...s.backend.sms, { to, kind: 'otp', text: `Your Madfu verification code is ${DEMO_SMS_CODE} (demo).`, at: now() }] }
  };
}

/* ------------------------------------------------------------------ lifecycle routing */

export const SUBMITTED_STATUSES: Lifecycle[] = ['SUBMITTED', 'UNDER_REVIEW', 'ACTION_REQUIRED', 'APPROVED', 'UNABLE_TO_PROCEED'];

/**
 * Where an application opens. Reads the lifecycle status FIRST; only a DRAFT is routed by completion.
 * A submitted application never reopens Review or Contract.
 */
export function routeFor(app: Application): StepId {
  if (app.status === 'DRAFT') return firstIncomplete(app);
  if (SUBMITTED_STATUSES.includes(app.status)) return 'status';
  if (app.status === 'LIVE') return 'login';
  if (app.status === 'SALES_LEAD' || app.status === 'BLOCKED' || app.status === 'PAUSED_CR') return 'outcome';
  return app.eligibility ? 'identify' : 'kyb';
}

/* ------------------------------------------------------------------ path, Back, locks */

export function pathFor(app: Application): StepId[] {
  const p: StepId[] = ['kyb', 'identify', 'otp'];
  if (app.kyb.kind === 'CR') p.push('persons', 'nafath');
  else p.push('nafath', 'certificates');
  p.push('business', 'commercial', 'review');
  if (contractEligible(app)) p.push('contract');
  p.push('outcome');
  return p;
}

/** Verified sensitive steps cannot be reopened with Back. */
export function stepLocked(app: Application, step: StepId): boolean {
  if (step === 'persons' || step === 'nafath') return app.nafath.status === 'verified' || app.nafath.status === 'exhausted';
  if (step === 'certificates') return app.categoryCheck?.source === 'CERTIFICATE';
  if (step === 'otp' || step === 'identify' || step === 'kyb') return !!app.id;
  return false;
}

export function previousStep(app: Application): StepId | null {
  if (['outcome', 'otp', 'status', 'login'].includes(app.step) || app.returnTo) return null;
  const p = pathFor(app);
  for (let i = p.indexOf(app.step) - 1; i >= 0; i--) {
    const prev = p[i];
    if (prev === 'otp') continue;
    if (stepLocked(app, prev)) return null;
    return prev;
  }
  return null;
}

export const back = (s: ProposedState): ProposedState => {
  const prev = previousStep(s.app);
  return prev ? persist(withApp(s, { step: prev })) : s;
};

/* ------------------------------------------------------------------ Page 1: Know Your Business */

export const setKyb = (s: ProposedState, patch: Partial<Application['kyb']>): ProposedState =>
  s.app.id ? s : withApp(s, { kyb: { ...s.app.kyb, ...patch } });

/** Evaluate preliminary eligibility (internal, no external call) and route. Saves the qualification record. */
export function submitKyb(s: ProposedState): ProposedState {
  const k = s.app.kyb;
  if (!kybComplete(k) || s.app.id) return s;
  const eligibility = evaluateEligibility({ kind: k.kind, sub: k.sub, revenue: k.revenue, channel: k.channel });
  const backend = { ...s.backend, qualifications: { ...s.backend.qualifications, [s.app.qualificationId]: { kyb: k, eligibility, at: eligibility.at, linkedTo: null } } };
  const next: ProposedState = { ...s, backend, app: log({ ...s.app, eligibility }, { kind: 'internal', check: 'ELIGIBILITY', note: `Preliminary eligibility ${eligibility.result} (${eligibility.ruleId}) — internal, no provider call` }) };
  if (eligibility.result === 'BLOCKED') return finish(next, 'BLOCKED', 'BLOCKED', eligibility.reason);
  return go(next, 'identify', { identity: { ...next.app.identity, prerequisite: null } });
}

/** Page 2 asks the prerequisite question only on the self-onboarding route. */
export const asksPrerequisite = (app: Application) => app.eligibility?.result === 'SELF_ONBOARDING' && (app.kyb.kind === 'CR' || app.kyb.kind === 'FL_CERT');

/* ------------------------------------------------------------------ Page 2: identifier + mobile, existence check */

export const setIdentity = (s: ProposedState, patch: Partial<Application['identity']>) => (s.app.id ? s : withApp(s, { identity: { ...s.app.identity, ...patch } }));

/** A stored record for the entered identifier when the Prototype Controls force one. */
function ensureFixture(s: ProposedState): ProposedState {
  const forced = s.sim.existence;
  const id = s.app.identity.identifier;
  if (forced === 'auto' || !id) return s;
  if (forced === 'live') return { ...s, backend: { ...s.backend, merchants: { ...s.backend.merchants, [id]: { mobile: DEMO.registeredMobile } } } };
  const existing = s.backend.applications[s.backend.identities[id] ?? ''];
  if (existing) return s;
  const kind = s.app.kyb.kind === 'CR' ? 'CR' : 'FL_CERT';
  const saved = prefill(kind, forced === 'submitted' ? 'status' : 'business', { identifier: id, mobile: DEMO.registeredMobile });
  return { ...s, backend: { ...s.backend, applications: { ...s.backend.applications, [saved.id!]: saved }, identities: { ...s.backend.identities, [id]: saved.id! } } };
}

/** Cheap internal lookup by CR / National ID. Calls no provider. */
export function existenceFor(s: ProposedState): { existence: Existence; mobile: string; appId: string | null } {
  const id = s.app.identity.identifier;
  const merchant = s.backend.merchants[id];
  if (merchant) return { existence: 'live', mobile: merchant.mobile, appId: null };
  const appId = s.backend.identities[id] ?? null;
  const saved = appId ? s.backend.applications[appId] : null;
  if (saved && saved.id !== s.app.id) {
    if (saved.status === 'DRAFT') return { existence: 'incomplete', mobile: saved.registeredMobile, appId };
    if (SUBMITTED_STATUSES.includes(saved.status)) return { existence: 'submitted', mobile: saved.registeredMobile, appId };
    if (saved.status === 'LIVE') return { existence: 'live', mobile: saved.registeredMobile, appId };
    if (saved.status === 'PAUSED_CR') return { existence: 'paused', mobile: saved.registeredMobile, appId };
  }
  return { existence: 'new', mobile: s.app.identity.mobile, appId: null };
}

/**
 * Submit Page 2: throttle check, internal existence check, then OTP. A new identifier gets a code on
 * the ENTERED mobile; an existing application or account gets it on its REGISTERED mobile — the
 * entered mobile is never used to open an existing record.
 */
export function submitIdentify(s: ProposedState): ProposedState {
  const checks = s.app.identifyChecks + 1;
  if (s.sim.rateLimited || checks > LIMITS.identifyChecksPerSession) return withApp(s, { throttled: true, identifyChecks: checks });
  let next = ensureFixture(withApp(s, { identifyChecks: checks, throttled: false }));
  const ex = existenceFor(next);
  next = mapApp(next, (a) => log({ ...a, existence: ex.existence }, { kind: 'internal', check: 'EXISTENCE', note: `Existence check: ${ex.existence} — internal database, no provider call` }));
  if (ex.existence === 'new') return sendOtp(withApp(next, { status: 'OTP_PENDING' }), 'application', next.app.identity.mobile);
  return sendOtp(next, 'registered', ex.mobile);
}

/* ------------------------------------------------------------------ OTP */

export function verifyOtp(s: ProposedState, code: string): ProposedState {
  const otp = s.app.otp;
  if (otp.status === 'expired' || otp.status === 'exhausted' || otp.status === 'locked') return s;
  // Not a 6-digit code: rejected as invalid without using an attempt.
  if (!/^\d{6}$/.test(code)) return withApp(s, { otp: { ...otp, code: '', status: 'invalid' } });
  if (code !== DEMO_SMS_CODE) {
    const attemptsLeft = otp.attemptsLeft - 1;
    const status: OtpState['status'] = attemptsLeft > 0 ? 'incorrect' : otp.resendsLeft > 0 ? 'exhausted' : 'locked';
    return withApp(s, { otp: { ...otp, code, attemptsLeft, status } });
  }
  const verified = withApp(s, { otp: { ...otp, status: 'verified', code } });
  switch (otp.purpose) {
    case 'application': return createApplication(verified);
    case 'registered': return openExisting(verified, existenceFor(verified));
    case 'resume': return openExisting(verified, { existence: 'incomplete', appId: verified.app.id });
    case 'mobile-change': return applyMobileChange(verified);
  }
}

export const expireOtp = (s: ProposedState): ProposedState => withApp(s, { otp: { ...s.app.otp, status: s.app.otp.resendsLeft > 0 ? 'expired' : 'locked' } });

/** A new code within the resend budget. The budget is never restored by resending. */
export const resendOtp = (s: ProposedState): ProposedState => {
  if (s.app.otp.resendsLeft <= 0) return withApp(s, { otp: { ...s.app.otp, status: 'locked' } });
  return sendOtp(s, s.app.otp.purpose, s.app.otp.to, false);
};

/** "Edit mobile" on the code screen: only for a NEW application or a mobile correction. */
export function editMobileFromOtp(s: ProposedState): ProposedState {
  if (s.app.otp.purpose === 'mobile-change') return withApp(s, { step: 'nafath', mobileMatch: { ...s.app.mobileMatch, status: 'entering' } });
  if (s.app.otp.purpose !== 'application') return s;
  return withApp(s, { step: 'identify', status: 'QUALIFICATION' });
}

/* ------------------------------------------------------------------ after the first OTP: create + route */

/** New identifier, contact mobile verified: create the Application, link Stage 1, route by eligibility + declaration. */
function createApplication(s: ProposedState): ProposedState {
  const at = now();
  const id = newApplicationId(Date.parse(s.app.createdAt) + Object.keys(s.backend.applications).length);
  const e = s.app.eligibility!;
  const kybSnapshot = { ...s.app.kyb, qualificationId: s.app.qualificationId, eligibility: e, linkedAt: at };
  const q = s.backend.qualifications[s.app.qualificationId];
  const backend = q ? { ...s.backend, qualifications: { ...s.backend.qualifications, [s.app.qualificationId]: { ...q, linkedTo: id } } } : s.backend;
  const mobile = s.app.identity.mobile;
  const base: ProposedState = {
    ...s, backend,
    app: { ...s.app, id, kybSnapshot, status: 'DRAFT', registeredMobile: mobile, contactMobileVerified: true, sessionVerified: true }
  };
  if (e.result === 'SALES_LEAD') {
    const lead = { applicationId: id, qualificationId: s.app.qualificationId, kyb: s.app.kyb, identifier: s.app.identity.identifier, mobile, reason: e.reason, at };
    const withLead = { ...base, backend: { ...base.backend, leads: [...base.backend.leads, lead] } };
    return finish(withLead, e.reason === 'FL_CERT_REQUIRED' ? 'FL_CERT_REQUIRED' : 'SALES_LEAD', 'SALES_LEAD', e.reason);
  }
  if (s.app.identity.prerequisite === 'no') return finish(base, 'BLOCKED', 'BLOCKED', s.app.kyb.kind === 'CR' ? 'NOT_OWNER_MANAGER' : 'FL_IBAN_NOT_LINKED');
  return go(base, s.app.kyb.kind === 'CR' ? 'persons' : 'nafath');
}

/** Existing record, registered mobile verified: open it by its lifecycle, never by completion alone. */
function openExisting(s: ProposedState, ex: { existence: Existence; appId: string | null }): ProposedState {
  if (ex.existence === 'live' && !ex.appId) return go(s, 'login', { existence: 'live', sessionVerified: true });
  const saved = ex.appId ? s.backend.applications[ex.appId] : null;
  if (!saved) return go(s, 'kyb');
  // A new session: provider retry counters start again; technical Nafath failures too.
  let app: Application = {
    ...saved,
    otp: { ...s.app.otp, status: 'verified' },
    ledger: [...saved.ledger, ...s.app.ledger.filter((e) => e.kind === 'otp').slice(-1)],
    sessionVerified: true, returnTo: null, editBaseline: null, throttled: false, identifyChecks: 0,
    cr: saved.cr.status === 'unavailable' ? { ...saved.cr, status: 'idle', tries: 0 } : saved.cr,
    persons: saved.persons.status === 'unavailable' ? { ...saved.persons, status: 'idle', tries: 0 } : saved.persons,
    certs: saved.certs.precheck === 'unavailable' ? { ...saved.certs, precheck: 'idle', tries: 0 } : saved.certs,
    nafath: { ...saved.nafath, technical: 0, status: saved.nafath.status === 'unavailable' || saved.nafath.status === 'waiting' ? 'idle' : saved.nafath.status }
  };
  app = reuseOnResume(app);
  const step = routeFor(app);
  return persist({ ...s, app: { ...app, step, lastStep: furthest(app.lastStep, step) } });
}

/* ------------------------------------------------------------------ Continue Application link (resume) */

/** "Save & exit": send a Continue Application link to the registered mobile (DRAFT only). */
export function sendContinueLink(s: ProposedState): ProposedState {
  const { app } = s;
  if (!app.id || app.status !== 'DRAFT' || !app.registeredMobile) return s;
  const token = newContinueToken(Date.now() + s.backend.sms.length);
  const saved = persist(s);
  return {
    ...saved,
    backend: {
      ...saved.backend,
      tokens: { ...saved.backend.tokens, [token]: app.id },
      sms: [...saved.backend.sms, { to: app.registeredMobile, kind: 'continue-link', token, text: 'Continue your Madfu application (demo link).', at: now() }]
    }
  };
}

/** The visitor left: a new browser session with no application open. */
export const leaveSession = (s: ProposedState): ProposedState => ({ ...s, app: initialApplication(), scenarioId: s.scenarioId });

/** The link identifies the application but does NOT authorise it: OTP to the registered mobile first. */
export function openContinueLink(s: ProposedState, token: string): ProposedState {
  const appId = s.backend.tokens[token];
  const saved = appId ? s.backend.applications[appId] : null;
  if (!saved) return { ...s, app: initialApplication() };
  const app: Application = { ...saved, sessionVerified: false, returnTo: null, editBaseline: null };
  return sendOtp({ ...s, app }, 'resume', saved.registeredMobile);
}

/* ------------------------------------------------------------------ Stage 3 (CR): CR data + owners / managers */

const crFingerprint = (app: Application) => `cr:${app.identity.identifier}`;
const personsFingerprint = (app: Application) => `persons:${app.identity.identifier}`;

/**
 * Registered business: CR data (status, age, activities, National Address, entity), the hard rules,
 * the verified category and the backend risk score; then the owners / managers. Runs on the
 * owner / manager screen — there is no separate CR confirmation page.
 */
export function runBusinessVerification(s: ProposedState): ProposedState {
  let next = s;
  if (reusable(next.app, 'CR_DATA', crFingerprint(next.app)) && next.app.cr.record) {
    if (!next.app.ledger.some((e) => e.kind === 'reuse' && e.check === 'CR_DATA')) next = mapApp(next, (a) => log(a, { kind: 'reuse', check: 'CR_DATA', note: 'Stored CR data reused — no new provider call' }));
  } else {
    const tries = next.app.cr.tries + 1;
    let app = log(next.app, { kind: 'call', check: 'CR_DATA', note: `CR data retrieval (attempt ${tries})` });
    const rec = crAdapter(next.sim, app.kyb.sub);
    if (!rec) return persist({ ...next, app: { ...app, cr: { ...app.cr, status: 'unavailable', tries } } });
    app = store(app, makeRecord('CR_DATA', crFingerprint(app), `${rec.status}, ${rec.ageMonths} months, ${rec.activities.length} activities`, now(), providerRef('CR', tries)));
    const gov = evaluateGovernment(rec);
    let flags = dropFlags(app.flags, ['ADDITIONAL_DOCUMENTS_REQUIRED', 'NATIONAL_ADDRESS_MISSING', 'NATIONAL_ADDRESS_EXPIRED', 'CATEGORY_RECLASSIFIED', 'ACTIVITY_UNMAPPED', 'SALES_FOLLOW_UP']);
    gov.flags.forEach((f) => { flags = addFlag(flags, f); });
    app = { ...app, flags, cr: { status: 'loaded', tries, record: rec, gov: gov.action, govReason: gov.reason } };
    if (gov.action === 'pause_sales') {
      // Saved, handed to Sales. No people, mobile, Nafath or other paid call.
      app = log({ ...app, risk: assessRisk(app) }, { kind: 'internal', check: 'RISK', note: 'Risk recalculated (synthetic)' });
      return finish({ ...next, app }, 'PAUSED_CR', 'PAUSED_CR', gov.reason);
    }
    const cat = deriveCategory('CR', app.kyb.sub, 'CR', rec.activities, app.kyb.channel ?? 'online');
    if (cat.check.outcome === 'RECLASSIFIED') flags = addFlag(app.flags, 'CATEGORY_RECLASSIFIED');
    else if (cat.check.outcome === 'UNMAPPED') flags = addFlag(app.flags, 'ACTIVITY_UNMAPPED');
    else flags = app.flags;
    app = { ...app, flags, categoryCheck: cat.check };
    app = log({ ...app, risk: assessRisk(app) }, { kind: 'internal', check: 'RISK', note: 'Risk calculated from CR age, entity, address, revenue, verified category (synthetic)' });
    if (cat.block) return finish({ ...next, app }, 'BLOCKED', 'BLOCKED', cat.block);
    next = { ...next, app };
  }
  if (reusable(next.app, 'PERSONS', personsFingerprint(next.app)) && next.app.persons.status === 'loaded') return persist(next);
  const tries = next.app.persons.tries + 1;
  let app = log(next.app, { kind: 'call', check: 'PERSONS', note: `Owners / managers retrieval (attempt ${tries})` });
  if (next.sim.persons === 'unavailable') return persist({ ...next, app: { ...app, persons: { ...app.persons, status: 'unavailable', tries } } });
  const list = personsAdapter(next.sim.persons);
  const eligible = eligiblePersons(list);
  app = store(app, makeRecord('PERSONS', personsFingerprint(app), `${eligible.length} owner(s) / manager(s)`, now(), providerRef('PPL', tries)));
  if (!eligible.length) {
    // The Page-2 declaration is not confirmed by government data. Delegates are out of V1.
    return finish({ ...next, app: { ...app, persons: { status: 'none', tries, list, selectedId: null } } }, 'BLOCKED', 'BLOCKED', 'NO_OWNER_MANAGER_ON_CR');
  }
  return persist({ ...next, app: { ...app, persons: { status: 'loaded', tries, list, selectedId: eligible.length === 1 ? eligible[0].id : app.persons.selectedId } } });
}

/** Before Nafath the selection can change; a match for another person no longer applies. */
export function selectPerson(s: ProposedState, id: string): ProposedState {
  if (stepLocked(s.app, 'persons') || s.app.persons.selectedId === id) return s;
  return persist(withApp(s, { persons: { ...s.app.persons, selectedId: id }, authorizedMobileVerified: false, mobileMatch: { ...s.app.mobileMatch, status: 'idle', matchedFor: null } }));
}

export const continueToNafath = (s: ProposedState): ProposedState => (s.app.persons.selectedId ? go(s, 'nafath') : s);

/* ------------------------------------------------------------------ Stage 3 (FL): certificate pre-check (backend only) */

const certsFingerprint = (app: Application) => `certs:${app.identity.identifier}`;

/** One retrieval for the National ID. Used before Nafath (pre-check) or after it (rule flag off). */
function retrieveCertificates(s: ProposedState, when: 'pre-check' | 'after Nafath'): ProposedState {
  const tries = s.app.certs.tries + 1;
  let app = log(s.app, { kind: 'call', check: 'FL_CERTS', note: `Freelancer Certificate retrieval — ${when} (attempt ${tries})` });
  const r = s.sim.certificates;
  if (r === 'unavailable') return persist({ ...s, app: { ...app, certs: { ...app.certs, precheck: 'unavailable', tries } } });
  const list = r === 'none' ? [] : certificatesAdapter(r, app.kyb.sub);
  const selectable = selectableCertificates(list);
  app = store(app, makeRecord('FL_CERTS', certsFingerprint(app), selectable.length ? `${list.length} certificate(s), ${selectable.length} usable` : 'no usable certificate', now(), providerRef('FLC', tries)));
  if (!selectable.length) {
    const lead = { applicationId: app.id!, qualificationId: app.qualificationId, kyb: app.kyb, identifier: app.identity.identifier, mobile: app.registeredMobile, reason: 'FL_CERT_NOT_FOUND' as const, at: now() };
    const next = { ...s, app: { ...app, certs: { ...app.certs, precheck: 'none' as const, tries, list } }, backend: { ...s.backend, leads: [...s.backend.leads, lead] } };
    return finish(next, 'FL_CERT_REQUIRED', 'SALES_LEAD', 'FL_CERT_NOT_FOUND');
  }
  return persist({ ...s, app: { ...app, certs: { ...app.certs, precheck: 'found', tries, list } } });
}

/**
 * Freelancer cost order (rule flag): certificate existence is checked BEFORE Nafath, silently. No
 * certificate → stop before any Nafath cost. Nothing about the certificate is shown before Nafath.
 */
export function runCertificatePrecheck(s: ProposedState): ProposedState {
  if (!RULE_FLAGS.flCertificatePrecheckBeforeNafath || s.app.kyb.kind !== 'FL_CERT') return s;
  if (s.app.certs.precheck === 'found' && reusable(s.app, 'FL_CERTS', certsFingerprint(s.app))) return s;
  return retrieveCertificates(s, 'pre-check');
}

export const precheckPending = (app: Application) => RULE_FLAGS.flCertificatePrecheckBeforeNafath && app.kyb.kind === 'FL_CERT' && app.certs.precheck !== 'found';

/* ------------------------------------------------------------------ mobile ↔ National ID, then Nafath */

const nafathSubject = (app: Application) => (app.kyb.kind === 'CR' ? app.persons.selectedId ?? '' : app.identity.identifier);
const matchFingerprint = (app: Application) => `mm:${app.registeredMobile}:${nafathSubject(app)}`;
const nafathFingerprint = (app: Application) => `nafath:${app.id}:${nafathSubject(app)}`;
export const nafathRemaining = (app: Application) => Math.max(0, LIMITS.nafathAttempts - app.nafath.failures);

/**
 * "Send to Nafath": first confirm that the verified mobile belongs to the National ID of the person
 * who will verify (selected owner / manager, or the Freelancer). Mismatch → no Nafath request.
 */
export function sendToNafath(s: ProposedState): ProposedState {
  if (precheckPending(s.app) || !nafathSubject(s.app)) return s;
  const fp = matchFingerprint(s.app);
  let next = s;
  if (!(s.app.authorizedMobileVerified && s.app.mobileMatch.matchedFor === fp)) {
    if (reusable(s.app, 'MOBILE_MATCH', fp)) {
      next = mapApp(s, (a) => log({ ...a, authorizedMobileVerified: true, mobileMatch: { ...a.mobileMatch, status: 'matched', matchedFor: fp } }, { kind: 'reuse', check: 'MOBILE_MATCH', note: 'Mobile ↔ National ID match reused' }));
    } else {
      const m = s.app.mobileMatch;
      if (m.checks >= LIMITS.mobileMatchChecks) return persist(withApp(s, { mobileMatch: { ...m, status: 'blocked' }, flags: addFlag(s.app.flags, 'MOBILE_OWNERSHIP_UNVERIFIED') }));
      const checks = m.checks + 1;
      let app = log(s.app, { kind: 'call', check: 'MOBILE_MATCH', note: `Mobile ↔ National ID ownership check ${checks}` });
      const result = mobileMatchAdapter(s.sim, checks - 1);
      if (result === 'mismatch') {
        const blocked = checks >= LIMITS.mobileMatchChecks;
        app = { ...app, authorizedMobileVerified: false, mobileMatch: { status: blocked ? 'blocked' : 'mismatch', checks, matchedFor: null }, flags: blocked ? addFlag(app.flags, 'MOBILE_OWNERSHIP_UNVERIFIED') : app.flags };
        return persist({ ...s, app });
      }
      app = store(app, makeRecord('MOBILE_MATCH', fp, 'mobile belongs to the National ID', now(), providerRef('MOB', checks)));
      app = { ...app, authorizedMobileVerified: true, mobileMatch: { status: 'matched', checks, matchedFor: fp }, flags: dropFlags(app.flags, ['MOBILE_OWNERSHIP_UNVERIFIED']) };
      next = { ...s, app };
    }
  }
  return startNafath(next);
}

/** "Use another mobile number" after a mismatch. */
export const startMobileChange = (s: ProposedState): ProposedState => (s.app.mobileMatch.status === 'mismatch' ? withApp(s, { mobileMatch: { ...s.app.mobileMatch, status: 'entering' } }) : s);
export const cancelMobileChange = (s: ProposedState): ProposedState => withApp(s, { step: 'nafath', mobileMatch: { ...s.app.mobileMatch, status: 'mismatch' } });

/** OTP to the corrected mobile (its own code budget). Nothing else is reset. */
export function submitMobileChange(s: ProposedState, mobile: string): ProposedState {
  if (s.app.mobileMatch.status !== 'entering') return s;
  return sendOtp(withApp(s, { pendingMobile: mobile }), 'mobile-change', mobile);
}

/** Corrected mobile verified: it becomes the registered mobile; the match check runs again. */
function applyMobileChange(s: ProposedState): ProposedState {
  const mobile = s.app.pendingMobile;
  let app = invalidate(s.app, ['MOBILE_MATCH'], 'Mobile changed');
  app = { ...app, registeredMobile: mobile, identity: { ...app.identity, mobile }, pendingMobile: '', contactMobileVerified: true, sessionVerified: true, authorizedMobileVerified: false, mobileMatch: { ...app.mobileMatch, status: 'idle', matchedFor: null } };
  // Links sent to the old number stop working.
  const next = revokeTokens(go({ ...s, app }, 'nafath'));
  return sendToNafath(next);
}

export function startNafath(s: ProposedState): ProposedState {
  const n = s.app.nafath;
  if (reusable(s.app, 'NAFATH', nafathFingerprint(s.app))) {
    return go(mapApp(s, (a) => log(a, { kind: 'reuse', check: 'NAFATH', note: 'Nafath verified previously — reused, no new request' })), 'nafath', { nafath: { ...n, status: 'verified' } });
  }
  if (n.failures >= LIMITS.nafathAttempts) return go(s, 'nafath', { nafath: { ...n, status: 'exhausted' } });
  if (n.technical >= LIMITS.nafathTechnicalRetries) return go(s, 'nafath', { nafath: { ...n, status: 'unavailable' } });
  const requests = n.requests + 1;
  const app = log(s.app, { kind: 'call', check: 'NAFATH', note: `Nafath request ${requests}` });
  return go({ ...s, app }, 'nafath', { nafath: { ...n, status: 'waiting', requests, number: NAFATH_NUMBERS[(requests - 1) % NAFATH_NUMBERS.length] } });
}

/** Rejected and timeout use an attempt; a technical failure does not, but is bounded per session. */
export function nafathResult(s: ProposedState, result: NafathResult): ProposedState {
  const n = s.app.nafath;
  if (result === 'verified') {
    let app = store(s.app, makeRecord('NAFATH', nafathFingerprint(s.app), 'verified', now(), providerRef('NFT', n.requests)));
    app = { ...app, nafath: { ...n, status: 'verified', lastResult: result, verifiedFor: nafathSubject(s.app) }, flags: dropFlags(app.flags, ['NAFATH_UNVERIFIED']) };
    return persist({ ...s, app });
  }
  if (result === 'technical') {
    const technical = n.technical + 1;
    return persist(withApp(s, { nafath: { ...n, status: technical >= LIMITS.nafathTechnicalRetries ? 'unavailable' : 'failed', technical, lastResult: result } }));
  }
  const failures = n.failures + 1;
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
  if (n.status === 'verified') return go(s, s.app.kyb.kind === 'CR' ? 'business' : 'certificates');
  if (n.status !== 'exhausted') return s;
  if (s.app.kyb.kind === 'CR') return go(s, 'business');
  // Freelancer: certificate details are never shown to an unverified identity → manual verification.
  return revokeTokens(finish(s, 'SUBMITTED_MANUAL', 'SUBMITTED'));
}

/* ------------------------------------------------------------------ Stage 3 (FL): certificate selection */

/** After Nafath: show the certificates found by the pre-check (no new call), or retrieve them now. */
export function loadCertificates(s: ProposedState): ProposedState {
  if (s.app.nafath.status !== 'verified') return s;
  if (s.app.certs.status === 'loaded') return s;
  let next = s;
  if (s.app.certs.precheck === 'found' && reusable(s.app, 'FL_CERTS', certsFingerprint(s.app))) {
    next = mapApp(s, (a) => log(a, { kind: 'reuse', check: 'FL_CERTS', note: 'Certificate details from the pre-check — shown now, no new call' }));
  } else {
    next = retrieveCertificates(s, 'after Nafath');
    if (next.app.step === 'outcome' || next.app.certs.precheck !== 'found') return next;
  }
  const selectable = selectableCertificates(next.app.certs.list);
  return persist(withApp(next, { certs: { ...next.app.certs, status: 'loaded', selectedId: next.app.certs.selectedId ?? (selectable.length === 1 ? selectable[0].id : null) } }));
}

export function selectCertificate(s: ProposedState, id: string): ProposedState {
  if (stepLocked(s.app, 'certificates') || s.app.certs.selectedId === id) return s;
  let app: Application = { ...s.app, certs: { ...s.app.certs, selectedId: id } };
  if (app.verifications.IBAN?.status === 'valid') {
    app = invalidate(app, ['IBAN'], 'Freelancer certificate changed');
    app = { ...app, business: { ...app.business, ibanStatus: 'idle', ibanFailures: 0, bankName: '' } };
  }
  return { ...s, app };
}

/** Confirm the certificate: its activity becomes the verified category (authoritative). */
export function confirmCertificate(s: ProposedState): ProposedState {
  const cert = s.app.certs.list.find((c) => c.id === s.app.certs.selectedId);
  if (!cert || cert.status !== 'active' || cert.issue === 'duplicate') return s;
  let flags = dropFlags(s.app.flags, ['CERTIFICATE_INCONSISTENT', 'CATEGORY_RECLASSIFIED', 'ACTIVITY_UNMAPPED']);
  if (cert.issue === 'inconsistent') flags = addFlag(flags, 'CERTIFICATE_INCONSISTENT');
  const cat = deriveCategory(s.app.kyb.kind!, s.app.kyb.sub, 'CERTIFICATE', [{ code: cert.activity, primary: true }], s.app.kyb.channel ?? 'online');
  if (cat.check.outcome === 'RECLASSIFIED') flags = addFlag(flags, 'CATEGORY_RECLASSIFIED');
  if (cat.check.outcome === 'UNMAPPED') flags = addFlag(flags, 'ACTIVITY_UNMAPPED');
  let app: Application = { ...s.app, flags, categoryCheck: cat.check };
  app = log({ ...app, risk: assessRisk(app) }, { kind: 'internal', check: 'RISK', note: 'Risk calculated from revenue and verified certificate category (synthetic)' });
  if (cat.block) return finish({ ...s, app }, 'BLOCKED', 'BLOCKED', cat.block);
  return go({ ...s, app }, 'business');
}

/* ------------------------------------------------------------------ Stage 4: Business Details */

export const setPresence = (s: ProposedState, patch: Partial<Pick<Application['business'], 'websiteUrl' | 'mapsUrl'>>) => withApp(s, { business: { ...s.app.business, ...patch } });

export const needsWebsite = (app: Application) => app.kyb.channel === 'online' || app.kyb.channel === 'both';
export const needsMaps = (app: Application) => app.kyb.channel === 'offline' || app.kyb.channel === 'both';
export const presenceComplete = (app: Application) =>
  (!needsWebsite(app) || !validateWebsite(app.business.websiteUrl)) && (!needsMaps(app) || !validateMapsUrl(app.business.mapsUrl));

const ibanTarget = (app: Application) => `nid:${app.identity.identifier}:${app.certs.selectedId ?? ''}`;
const ibanFingerprint = (app: Application) => `iban:${app.business.iban}:${ibanTarget(app)}`;

/** Freelancer IBAN. A different IBAN invalidates only the IBAN check and starts with fresh attempts. */
export function setIban(s: ProposedState, iban: string): ProposedState {
  const b = s.app.business;
  if (iban === b.iban || b.ibanStatus === 'verified') return s;
  let app = s.app;
  if (app.verifications.IBAN?.status === 'valid') app = invalidate(app, ['IBAN'], 'IBAN changed');
  return { ...s, app: { ...app, business: { ...b, iban, ibanStatus: 'idle', ibanFailures: 0, ibanLast: null, bankName: '' } } };
}

/** Same IBAN and same owner as a stored success: reused. Otherwise a new linkage check starts. */
export function startIbanCheck(s: ProposedState): ProposedState {
  if (!fl(s.app) || s.app.business.ibanStatus === 'failed_final') return s;
  if (reusable(s.app, 'IBAN', ibanFingerprint(s.app))) {
    const app = log(s.app, { kind: 'reuse', check: 'IBAN', note: 'Same IBAN verified previously — reused, no new check' });
    return persist({ ...s, app: { ...app, business: { ...app.business, ibanStatus: 'verified', bankName: bankFromIban(app.business.iban) } } });
  }
  return withApp(s, { business: { ...s.app.business, ibanStatus: 'verifying' } });
}

export function finishIbanCheck(s: ProposedState): ProposedState {
  const b = s.app.business;
  const index = s.app.ledger.filter((e) => e.kind === 'call' && e.check === 'IBAN').length;
  const result = ibanAdapter(s.sim, index);
  let app = log(s.app, { kind: 'call', check: 'IBAN', note: 'IBAN linkage check (individual + certificate)' });
  if (result === 'verified') {
    app = store(app, makeRecord('IBAN', ibanFingerprint(app), 'linked to the National ID and certificate', now(), providerRef('IBN', index + 1)));
    return persist({ ...s, app: { ...app, business: { ...b, ibanStatus: 'verified', ibanLast: result, bankName: bankFromIban(b.iban) } } });
  }
  if (result === 'technical') return persist({ ...s, app: { ...app, business: { ...b, ibanStatus: 'failed', ibanLast: result, bankName: '' } } });
  const ibanFailures = b.ibanFailures + 1;
  return persist({ ...s, app: { ...app, business: { ...b, ibanStatus: ibanFailures >= LIMITS.ibanAttempts ? 'failed_final' : 'failed', ibanFailures, ibanLast: result, bankName: '' } } });
}

export const businessComplete = (app: Application) => presenceComplete(app) && (!fl(app) || app.business.ibanStatus === 'verified');

/** Next (or "Save and return" during an edit: the edit is applied). */
export const submitBusiness = (s: ProposedState): ProposedState => (businessComplete(s.app) ? go(s, s.app.returnTo ?? 'commercial', { returnTo: null, editBaseline: null }) : s);

/* ------------------------------------------------------------------ Stage 5: Commercial Offer */

/** The merchant asked for a rate review: kept as an internal flag even with no file. */
export const requestRateReview = (s: ProposedState) => withApp(s, { commercial: { ...s.app.commercial, reviewRequested: true }, flags: addFlag(s.app.flags, 'COMMERCIAL_RATE_REVIEW_REQUESTED') });
export const withdrawRateReview = (s: ProposedState) => withApp(s, { commercial: { ...s.app.commercial, reviewRequested: false, evidence: [], uploadError: null }, flags: dropFlags(s.app.flags, ['COMMERCIAL_RATE_REVIEW_REQUESTED']) });
export const addEvidence = (s: ProposedState, id: string) => {
  const r = requestRateReview(s);
  return withApp(r, { commercial: { ...r.app.commercial, uploadError: null, evidence: r.app.commercial.evidence.includes(id) ? r.app.commercial.evidence : [...r.app.commercial.evidence, id] } });
};
/** Simulated failed optional upload: shown inline, never blocks the standard offer. */
export const failUpload = (s: ProposedState, id: string) => { const r = requestRateReview(s); return withApp(r, { commercial: { ...r.app.commercial, uploadError: id } }); };
export const removeEvidence = (s: ProposedState, id: string) => withApp(s, { commercial: { ...s.app.commercial, evidence: s.app.commercial.evidence.filter((x) => x !== id) } });

/** Confirm the standard offer (verified category). Never waits for the rate review. */
export function confirmOffer(s: ProposedState): ProposedState {
  return go(s, s.app.returnTo ?? 'review', { commercial: { ...s.app.commercial, agreed: buildOffer(s.app) }, returnTo: null, editBaseline: null });
}

/* ------------------------------------------------------------------ Stage 6: Review, transactional edit */

/** Sections that can be edited after verification. Everything else is locked. */
export const EDITABLE_SECTIONS: SectionId[] = ['presence', 'commercial'];

/** Edit opens on a full copy of the application: nothing is applied or invalidated until Save. */
export function startEdit(s: ProposedState, section: SectionId): ProposedState {
  if (!EDITABLE_SECTIONS.includes(section)) return s;
  const { editBaseline: _ignored, ...rest } = s.app;
  return withApp(s, { step: section === 'presence' ? 'business' : 'commercial', returnTo: 'review', editBaseline: JSON.stringify(rest) });
}

/** Cancel restores the application exactly as it was when the edit started. */
export function cancelEdit(s: ProposedState): ProposedState {
  if (!s.app.editBaseline) return withApp(s, { step: s.app.returnTo ?? 'review', returnTo: null });
  const restored = JSON.parse(s.app.editBaseline) as Application;
  return persist({ ...s, app: { ...restored, editBaseline: null, returnTo: null, step: 'review' } });
}

/* ------------------------------------------------------------------ contract gate */

/** Why the contract is not available (empty = available). Configurable gates, no screen logic. */
export function contractBlockers(app: Application): string[] {
  const out: string[] = [];
  if (app.nafath.status !== 'verified') out.push('Nafath not verified');
  if (!app.authorizedMobileVerified) out.push('Mobile ownership not confirmed for the verifying person');
  if (app.kyb.kind === 'CR' && !(app.persons.status === 'loaded' && app.persons.selectedId)) out.push('No owner / manager selected');
  if (fl(app)) {
    if (app.categoryCheck?.source !== 'CERTIFICATE') out.push('No confirmed certificate');
    if (app.business.ibanStatus !== 'verified') out.push('Freelancer IBAN not verified');
  }
  return out;
}
export const contractEligible = (app: Application) => contractBlockers(app).length === 0;

export interface Issue { section: SectionId; message: string }

export function reviewIssues(app: Application): Issue[] {
  const out: Issue[] = [];
  if (!presenceComplete(app)) out.push({ section: 'presence', message: 'Add your store presence link.' });
  if (fl(app) && app.business.ibanStatus !== 'verified') out.push({ section: 'banking', message: 'Verify the IBAN linked to your Freelancer Certificate.' });
  if (!app.commercial.agreed) out.push({ section: 'commercial', message: 'Confirm your commercial offer.' });
  return out;
}

export function continueFromReview(s: ProposedState): ProposedState {
  if (reviewIssues(s.app).length || s.app.status !== 'DRAFT') return s;
  if (contractEligible(s.app)) {
    return go(s, 'contract', { contract: { status: s.app.contract.status === 'accepted' ? 'accepted' : 'ready', acceptedAt: s.app.contract.acceptedAt } });
  }
  return revokeTokens(finish(withApp(s, { contract: { status: 'unavailable', acceptedAt: '' } }), 'SUBMITTED_MANUAL', 'SUBMITTED'));
}

/* ------------------------------------------------------------------ Stage 7 / 8: Contract, Submit, Status */

/** The single contract action: records the (simulated) acceptance and submits the application. */
export function agreeAndSubmit(s: ProposedState): ProposedState {
  if (s.app.status !== 'DRAFT' || !contractEligible(s.app)) return s;
  return revokeTokens(finish(withApp(s, { contract: { status: 'accepted', acceptedAt: now() } }), 'SUBMITTED', 'SUBMITTED'));
}

export const declineContract = (s: ProposedState): ProposedState =>
  finish(withApp(s, { contract: { status: 'declined', acceptedAt: '' } }), 'CONTRACT_DECLINED', 'DRAFT');

/** After a decline (or a resume after one), the contract opens again. */
export const reopenContract = (s: ProposedState): ProposedState =>
  s.app.status === 'DRAFT' ? go(s, 'contract', { outcome: null, outcomeReason: null, contract: { status: 'ready', acceptedAt: '' } }) : s;

/** Application Progress (prototype control): the team moves a submitted application along. */
export function setReviewStatus(s: ProposedState, status: Lifecycle): ProposedState {
  if (!SUBMITTED_STATUSES.includes(s.app.status) || !SUBMITTED_STATUSES.includes(status)) return s;
  return go(s, 'status', { status });
}

/** The approved merchant goes live: the merchant account exists from now on; re-entry goes to login. */
export function goLive(s: ProposedState): ProposedState {
  if (s.app.status !== 'APPROVED') return s;
  const next = go(s, 'login', { status: 'LIVE' });
  return { ...next, backend: { ...next.backend, merchants: { ...next.backend.merchants, [s.app.identity.identifier]: { mobile: s.app.registeredMobile } } } };
}

/** Controlled Sales recovery after the merchant updated the CR: the CR is re-checked once, here only. */
export function salesRecoverCr(s: ProposedState): ProposedState {
  if (s.app.status !== 'PAUSED_CR') return s;
  let app = invalidate(s.app, ['CR_DATA'], 'CR corrected — controlled re-check by Sales');
  app = { ...app, status: 'DRAFT', outcome: null, outcomeReason: null, cr: { status: 'idle', tries: 0, record: null, gov: null, govReason: null }, flags: dropFlags(app.flags, ['SALES_FOLLOW_UP']) };
  return go({ ...s, sim: { ...s.sim, cr: { ...s.sim.cr, status: 'ACTIVE' } }, app }, 'persons');
}

/* ------------------------------------------------------------------ resume target (DRAFT only) */

/** First screen that still needs input in a DRAFT. Never used for any other lifecycle status. */
export function firstIncomplete(app: Application): StepId {
  if (!app.id) return app.eligibility ? 'identify' : 'kyb';
  if (app.contract.status === 'declined') return 'contract';
  if (app.kyb.kind === 'CR') {
    if (app.cr.status !== 'loaded' || app.persons.status !== 'loaded' || !app.persons.selectedId) return 'persons';
    if (app.nafath.status !== 'verified' && app.nafath.status !== 'exhausted') return 'nafath';
  } else {
    if (app.nafath.status !== 'verified') return 'nafath';
    if (app.categoryCheck?.source !== 'CERTIFICATE') return 'certificates';
  }
  if (!businessComplete(app)) return 'business';
  if (!app.commercial.agreed) return 'commercial';
  if (app.lastStep === 'contract' && contractEligible(app)) return 'contract';
  return 'review';
}

/** The next operation that would create a NEW external call (Internal view). */
export function nextPaidCall(s: ProposedState): string {
  const { app } = s;
  if (app.step === 'otp' && app.otp.status !== 'verified') return 'None — the SMS code was already sent';
  if (!app.id) return app.step === 'identify' ? 'Internal existence check, then one SMS OTP' : 'None — Stage 1 is internal (no provider call)';
  if (app.status !== 'DRAFT') return 'None — the application is not a draft';
  const step = app.step;
  if (step === 'persons' && app.cr.status !== 'loaded') return 'CR data retrieval, then owners / managers';
  if (step === 'persons' && app.persons.status !== 'loaded') return 'Owners / managers retrieval';
  if (step === 'nafath' && precheckPending(app)) return 'Freelancer Certificate pre-check (backend, before Nafath)';
  if (step === 'nafath' && app.nafath.status !== 'verified') return app.authorizedMobileVerified ? 'Nafath request' : 'Mobile ↔ National ID check, then Nafath request';
  if (step === 'certificates' && app.certs.precheck !== 'found') return 'Freelancer Certificate retrieval';
  if (step === 'business' && fl(app) && app.business.ibanStatus !== 'verified') return 'IBAN linkage check';
  return 'None — the next screen needs no provider call';
}

/* ------------------------------------------------------------------ prefilled applications (scenarios, PDF, boards) */

type PrefillKind = 'CR' | 'FL_CERT';

/**
 * A healthy self-service application walked with the REAL transitions up to (not including) `upTo`.
 * 'status' = submitted. Used by scenarios, fixtures and the PDF.
 */
export function prefill(kind: PrefillKind, upTo: StepId, who: { identifier?: string; mobile?: string } = {}): Application {
  const order: StepId[] = ['kyb', 'identify', 'otp', 'persons', 'nafath', 'certificates', 'business', 'commercial', 'review', 'contract', 'outcome', 'status'];
  const reach = (step: StepId) => order.indexOf(upTo) > order.indexOf(step);
  const isFl = kind === 'FL_CERT';
  const at = (s: ProposedState) => ({ ...s.app, step: upTo, lastStep: furthest(s.app.lastStep, upTo) });
  let s: ProposedState = { app: initialApplication(1_760_000_000_000), sim: initialSim(), scenarioId: null, backend: initialBackend() };
  s = setKyb(s, isFl
    ? { kind, group: 'services', sub: 'services-design', revenue: 'SELF_SERVICE_BAND', channel: 'online' }
    : { kind, group: 'food', sub: 'food-cafe', revenue: 'SELF_SERVICE_BAND', channel: 'both' });
  if (!reach('kyb')) return at(s);
  s = submitKyb(s);
  s = setIdentity(s, { identifier: who.identifier ?? (isFl ? DEMO.nationalId : DEMO.cr), mobile: who.mobile ?? DEMO.mobile, prerequisite: 'yes' });
  if (!reach('identify')) return at(s);
  s = submitIdentify(s);
  if (!reach('otp')) return at(s);
  s = verifyOtp(s, DEMO_SMS_CODE);
  if (!isFl) {
    if (reach('persons')) { s = runBusinessVerification(s); s = selectPerson(s, 'p1'); s = continueToNafath(s); }
    if (reach('nafath')) { s = sendToNafath(s); s = nafathResult(s, 'verified'); s = continueAfterNafath(s); }
  } else {
    if (reach('nafath')) { s = runCertificatePrecheck(s); s = sendToNafath(s); s = nafathResult(s, 'verified'); s = continueAfterNafath(s); }
    if (reach('certificates')) { s = loadCertificates(s); s = confirmCertificate(s); }
  }
  if (reach('business')) {
    s = setPresence(s, isFl ? { websiteUrl: 'https://studio.example.com' } : { websiteUrl: 'https://najdroastery.example.com', mapsUrl: 'https://maps.google.com/?q=24.7136,46.6753' });
    if (isFl) { s = setIban(s, demoIban('80', '4821')); s = finishIbanCheck(startIbanCheck(s)); }
    s = submitBusiness(s);
  }
  if (reach('commercial')) s = confirmOffer(s);
  if (reach('review')) s = continueFromReview(s);
  if (reach('contract')) s = agreeAndSubmit(s);
  if (upTo === 'status' || upTo === 'outcome') return { ...s.app, step: upTo === 'status' ? 'status' : 'outcome' };
  return at(s);
}

/** A state whose backend holds `app` (saved), so resume and existence checks see it. */
export function withSaved(app: Application, sim: Sim = initialSim(), scenarioId: string | null = null): ProposedState {
  return persist({ app, sim, scenarioId, backend: initialBackend() });
}
