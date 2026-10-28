/**
 * Madfu Proposed v6 — pure transitions. Components call these through `apply(fn)`; tests call them
 * directly. No transition talks to a real service: answers come from the Prototype Controls (Sim).
 *
 * Shared start: Know Your Business (internal) → Identifier + mobile → internal existence check → OTP
 * (entered mobile for a new identifier; REGISTERED mobile for an existing record) → routing by the
 * application lifecycle AND the authorization lifecycle.
 *
 * - Not Eligible is INTERNAL: every not-eligible applicant still passes Identify + OTP, the application
 *   is captured (backend.notEligible) and the merchant sees "Application submitted" / "Under review".
 * - Registered business: CR verification → Business Details → Commercial Offer → Review → Authorization
 *   choice → (self) owner / manager + mobile ↔ National ID + Nafath → Contract → Submit, or (signer)
 *   Signer Handoff: the application and offer freeze, the signer gets a secure SMS link → masked
 *   confirmation → Nafath → read-only Review → Contract → Submit. No signer OTP in Phase 1.
 * - Freelancer: Business Details (+ IBAN) → Commercial Offer → Review → Certificate → mobile ↔ National
 *   ID + Nafath → Contract → Submit (same shape as CR; the certificate is the final authority step).
 */
import { activityLabel, deriveCategory } from './activity';
import { DAY_MS, HANDOFF_RULES, LIMITS, isFreelancer, isSaudiMobile, maskLast3, type HandoffRules } from './config';
import { evaluateEligibility, kybComplete } from './eligibility';
import { evaluateGovernment } from './government';
import {
  DEMO, DEMO_SMS_CODE, NAFATH_NUMBERS, bankFromIban, certificatesAdapter, crAdapter, demoIban, eligiblePersons, ibanAdapter,
  mobileMatchAdapter, nafathAdapter, newApplicationId, newContinueToken, newQualificationId, newSignerToken, personsAdapter, providerRef,
  selectableCertificates
} from './mock';
import { buildOffer } from './pricing';
import { assessRisk } from './risk';
import { validateMapsUrl, validateWebsite } from './urls';
import { invalidate, log, makeRecord, reusable, reuseOnResume, store } from './verifications';
import type {
  Application, AuthEndReason, AuthMode, AuthStatus, Authorization, Backend, DelegationStatus, DelegationType, Existence, Flag,
  HandoffVersion, Lifecycle, NafathResult, OtpState, OutcomeKind, ProposedState, ReasonCode, SectionId, Sim, StepId
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

export const initialAuthorization = (): Authorization => ({
  mode: null, status: 'NOT_STARTED', versions: [], extraVersions: 0, limitReached: false, frozenAt: null, frozenSnapshot: null,
  delegation: { type: null, status: 'idle' }
});

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
    enteredMobileIgnored: false,
    throttled: false,
    identifyChecks: 0,
    registeredMobile: '',
    contactMobileVerified: false,
    authorizedMobileVerified: false,
    sessionVerified: false,
    actor: 'preparer',
    signerSession: null,
    pendingMobile: '',
    otp: freshOtp(),
    cr: { status: 'idle', tries: 0, record: null, gov: null, govReason: null },
    categoryCheck: null,
    risk: null,
    persons: { status: 'idle', tries: 0, list: [], selectedId: null },
    mobileMatch: { status: 'idle', checks: 0, matchedFor: null },
    nafath: { status: 'idle', failures: 0, technical: 0, requests: 0, lastResult: null, number: NAFATH_NUMBERS[0], verifiedFor: null },
    certs: { status: 'idle', tries: 0, list: [], selectedId: null },
    business: { websiteUrl: '', mapsUrl: '', iban: '', ibanStatus: 'idle', ibanFailures: 0, ibanLast: null, bankName: '' },
    commercial: { reviewRequested: false, evidence: [], uploadError: null, agreed: null },
    contract: { status: 'unavailable', acceptedAt: '' },
    authorization: initialAuthorization(),
    verifications: {},
    ledger: [],
    flags: [],
    status: 'QUALIFICATION',
    outcome: null,
    outcomeReason: null,
    submittedAt: ''
  };
}

export const initialBackend = (): Backend => ({ qualifications: {}, applications: {}, identities: {}, merchants: {}, notEligible: [], tokens: {}, signerLinks: {}, sms: [] });

export function initialState(): ProposedState {
  return { app: initialApplication(), sim: initialSim(), scenarioId: null, backend: initialBackend() };
}

/* ------------------------------------------------------------------ helpers */

const iso = (ms = Date.now()) => new Date(ms).toISOString();
const now = () => iso();
const withApp = (s: ProposedState, patch: Partial<Application>): ProposedState => ({ ...s, app: { ...s.app, ...patch } });
const mapApp = (s: ProposedState, f: (a: Application) => Application): ProposedState => ({ ...s, app: f(s.app) });
export const addFlag = (flags: Flag[], f: Flag) => (flags.includes(f) ? flags : [...flags, f]);
export const dropFlags = (flags: Flag[], drop: Flag[]) => flags.filter((f) => !drop.includes(f));
const fl = (app: Application) => isFreelancer(app.kyb.kind);
const isCr = (app: Application) => app.kyb.kind === 'CR';
const isSigner = (app: Application) => app.actor === 'signer';

/** Linear order of screens, used for "furthest step reached". */
const ORDER: StepId[] = ['kyb', 'identify', 'otp', 'cr', 'business', 'commercial', 'review', 'authorize', 'delegation', 'handoff', 'signer', 'certificates', 'nafath', 'contract', 'outcome', 'status', 'login'];
const furthest = (a: StepId, b: StepId) => (ORDER.indexOf(b) > ORDER.indexOf(a) ? b : a);

/** Move to a step and remember the furthest step reached. Saves the application. */
export function go(s: ProposedState, step: StepId, patch: Partial<Application> = {}): ProposedState {
  return persist(withApp(s, { ...patch, step, lastStep: furthest(s.app.lastStep, step) }));
}

/** Save the application in the simulated backend (resume, existence checks, Continue / signer links). */
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
  const submitted = status === 'SUBMITTED' || status === 'NOT_ELIGIBLE';
  return go(s, 'outcome', { outcome, status, outcomeReason: reason, returnTo: null, editBaseline: null, submittedAt: submitted ? now() : s.app.submittedAt });
}

/**
 * Not Eligible (INTERNAL). The application is captured with its verified contact, Page-1 answers and the
 * internal reason; the merchant sees exactly the normal "Application submitted" page. No further step,
 * no paid check. The team contacts the applicant and explains the reason manually.
 */
function captureNotEligible(s: ProposedState, reason: ReasonCode): ProposedState {
  const { app } = s;
  const record = { applicationId: app.id!, qualificationId: app.qualificationId, kyb: app.kyb, identifier: app.identity.identifier, mobile: app.registeredMobile, reason, at: now() };
  const saved = { ...s, backend: { ...s.backend, notEligible: [...s.backend.notEligible.filter((r) => r.applicationId !== app.id), record] } };
  const logged = mapApp(saved, (a) => log(a, { kind: 'internal', check: 'ELIGIBILITY', note: `Not Eligible (internal): ${reason} — merchant sees Application submitted` }));
  return revokeTokens(finish(logged, 'RECEIVED', 'NOT_ELIGIBLE', reason));
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

/* ------------------------------------------------------------------ authorization helpers */

/** Authorization statuses while a signer handoff version is live. */
export const ACTIVE_AUTH: AuthStatus[] = ['HANDOFF_CREATED', 'AWAITING_SIGNER', 'NAFATH_PENDING', 'NAFATH_VERIFIED', 'CONTRACT_PENDING'];

export const currentVersion = (app: Application): HandoffVersion | null => app.authorization.versions.at(-1) ?? null;
export const activeVersion = (app: Application): HandoffVersion | null => {
  const v = currentVersion(app);
  return app.authorization.mode === 'signer' && v && ACTIVE_AUTH.includes(v.status) ? v : null;
};
/** Once a signer handoff starts, application data and the Commercial Offer are frozen (Phase 1: for good). */
export const isFrozen = (app: Application) => !!app.authorization.frozenAt;
/** Only the preparer edits, only a non-frozen draft. */
export const canEdit = (app: Application) => !isSigner(app) && !isFrozen(app) && app.status === 'DRAFT';

/** Set the authorization status and mirror it on the live handoff version. */
function setAuth(app: Application, status: AuthStatus, patch: Partial<HandoffVersion> = {}): Application {
  const a = app.authorization;
  const live = a.mode === 'signer' && a.versions.length && ACTIVE_AUTH.includes(a.versions.at(-1)!.status);
  const versions = live ? [...a.versions.slice(0, -1), { ...a.versions.at(-1)!, status, ...patch }] : a.versions;
  return { ...app, authorization: { ...a, status, versions } };
}

const authLog = (app: Application, note: string) => log(app, { kind: 'internal', check: 'AUTHORIZATION', note });

/** Handoff versions of this application created inside the control window ending at `at`. */
export const handoffsInWindow = (app: Application, at = Date.now(), rules: HandoffRules = HANDOFF_RULES) =>
  app.authorization.versions.filter((v) => at - Date.parse(v.createdAt) < rules.windowDays * DAY_MS).length;

export const handoffAllowance = (app: Application, rules: HandoffRules = HANDOFF_RULES) => rules.maxVersions + app.authorization.extraVersions;

/** Can a NEW signer handoff start now? Never while one is live; never above the limit in the window. */
export const canStartHandoff = (app: Application, at = Date.now(), rules: HandoffRules = HANDOFF_RULES) =>
  !activeVersion(app) && handoffsInWindow(app, at, rules) < handoffAllowance(app, rules);

/** Fingerprint of what the signer authorizes: the frozen application data and the offer. */
export function freezeSnapshot(app: Application): string {
  const o = app.commercial.agreed;
  return JSON.stringify({
    id: app.id, kyb: app.kyb, identifier: app.identity.identifier, cr: app.cr.record?.legalName ?? null,
    category: app.categoryCheck?.verifiedSub ?? app.kyb.sub, presence: [app.business.websiteUrl, app.business.mapsUrl],
    offer: o ? { pricingVersion: o.pricingVersion, pricingSub: o.pricingSub, standardRate: o.standardRate, at: o.at } : null,
    rateReview: app.commercial.reviewRequested
  });
}

/* ------------------------------------------------------------------ lifecycle routing */

export const SUBMITTED_STATUSES: Lifecycle[] = ['SUBMITTED', 'UNDER_REVIEW', 'ACTION_REQUIRED', 'APPROVED', 'UNABLE_TO_PROCEED'];

/**
 * Where an application opens for the PREPARER. Reads the lifecycle status first, then the authorization
 * status; only a DRAFT is routed by completion. A submitted (or internally Not Eligible) application
 * never reopens onboarding: it opens Application Progress.
 */
export function routeFor(app: Application): StepId {
  if (app.status === 'DRAFT') return firstIncomplete(app);
  if (app.status === 'AWAITING_AUTHORIZATION') {
    // Frozen. A new self-authorization in progress continues; otherwise the Authorization status page
    // (live handoff, or an expired / ended version with "Start a new authorization").
    const a = app.authorization;
    if (a.mode === 'self' && (a.status === 'NAFATH_VERIFIED' || a.status === 'CONTRACT_PENDING')) return 'contract';
    if (a.mode === 'self' && a.status === 'NAFATH_PENDING') return 'nafath';
    return 'handoff';
  }
  if (SUBMITTED_STATUSES.includes(app.status) || app.status === 'NOT_ELIGIBLE') return 'status';
  if (app.status === 'LIVE') return 'login';
  if (app.status === 'PAUSED_CR') return 'outcome';
  return app.eligibility ? 'identify' : 'kyb';
}

/* ------------------------------------------------------------------ path, Back, locks */

export function pathFor(app: Application): StepId[] {
  const p: StepId[] = ['kyb', 'identify', 'otp'];
  if (isCr(app)) p.push('cr', 'business', 'commercial', 'review', 'authorize', 'nafath', 'contract');
  else {
    p.push('business', 'commercial', 'review', 'certificates', 'nafath');
    if (contractEligible(app) || app.step === 'contract') p.push('contract');
  }
  p.push('outcome');
  return p;
}

/** Verified sensitive steps cannot be reopened with Back. */
export function stepLocked(app: Application, step: StepId): boolean {
  if (step === 'nafath') return app.nafath.status === 'verified' || app.nafath.status === 'exhausted';
  if (step === 'certificates') return fl(app) && (app.nafath.status === 'verified' || app.nafath.status === 'exhausted');
  if (step === 'authorize') return isFrozen(app) || (app.authorization.mode === 'self' && app.nafath.status === 'verified');
  if (step === 'otp' || step === 'identify' || step === 'kyb') return !!app.id;
  return false;
}

const NO_BACK: StepId[] = ['outcome', 'otp', 'status', 'login', 'handoff', 'signer', 'delegation'];

export function previousStep(app: Application): StepId | null {
  if (isSigner(app) || NO_BACK.includes(app.step) || app.returnTo) return null;
  if (isFrozen(app) && ['review', 'business', 'commercial'].includes(app.step)) return null;
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

/**
 * Evaluate preliminary eligibility (internal, no external call) and save the qualification record.
 * Everyone continues to Identify — eligible or not. Nothing is shown about the result.
 */
export function submitKyb(s: ProposedState): ProposedState {
  const k = s.app.kyb;
  if (!kybComplete(k) || s.app.id) return s;
  const eligibility = evaluateEligibility({ kind: k.kind, sub: k.sub, revenue: k.revenue, channel: k.channel });
  const backend = { ...s.backend, qualifications: { ...s.backend.qualifications, [s.app.qualificationId]: { kyb: k, eligibility, at: eligibility.at, linkedTo: null } } };
  const next: ProposedState = { ...s, backend, app: log({ ...s.app, eligibility }, { kind: 'internal', check: 'ELIGIBILITY', note: `Preliminary eligibility ${eligibility.result} (${eligibility.ruleId}) — internal, never shown` }) };
  return go(next, 'identify', { identity: { ...next.app.identity, prerequisite: null } });
}

/** Page 2 asks the IBAN-linkage question only of an eligible Freelancer with a certificate. */
export const asksPrerequisite = (app: Application) => app.eligibility?.result === 'ELIGIBLE' && app.kyb.kind === 'FL_CERT';

/** Internally Not Eligible: Page 2 collects the contact neutrally (no "eligible" message, no question). */
export const capturesNotEligible = (app: Application) => app.eligibility?.result === 'NOT_ELIGIBLE';

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
  const who = { identifier: id, mobile: DEMO.registeredMobile };
  // In progress: a registered business saved at Business Details; a Freelancer saved before Nafath.
  const saved = forced === 'not_eligible' ? notEligibleRecord(kind, who) : prefill(kind, forced === 'submitted' ? 'status' : kind === 'CR' ? 'business' : 'nafath', who);
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
    const mobile = saved.registeredMobile;
    if (saved.status === 'DRAFT') return { existence: 'incomplete', mobile, appId };
    if (saved.status === 'AWAITING_AUTHORIZATION') return { existence: 'awaiting_authorization', mobile, appId };
    if (SUBMITTED_STATUSES.includes(saved.status)) return { existence: 'submitted', mobile, appId };
    if (saved.status === 'LIVE') return { existence: 'live', mobile, appId };
    if (saved.status === 'PAUSED_CR') return { existence: 'paused', mobile, appId };
    if (saved.status === 'NOT_ELIGIBLE') return { existence: 'not_eligible', mobile, appId };
  }
  return { existence: 'new', mobile: s.app.identity.mobile, appId: null };
}

/**
 * Submit Page 2: throttle check, internal existence check, then OTP. A new identifier gets a code on
 * the ENTERED mobile; an existing application or account gets it on its STORED mobile. A different
 * entered mobile is never used and can never take over an existing application.
 */
export function submitIdentify(s: ProposedState): ProposedState {
  if (s.app.id) return s;
  const checks = s.app.identifyChecks + 1;
  if (s.sim.rateLimited || checks > LIMITS.identifyChecksPerSession) return withApp(s, { throttled: true, identifyChecks: checks });
  let next = ensureFixture(withApp(s, { identifyChecks: checks, throttled: false }));
  const ex = existenceFor(next);
  next = mapApp(next, (a) => log({ ...a, existence: ex.existence, enteredMobileIgnored: false }, { kind: 'internal', check: 'EXISTENCE', note: `Existence check: ${ex.existence} — internal database, no provider call` }));
  if (ex.existence === 'new') return sendOtp(withApp(next, { status: 'OTP_PENDING' }), 'application', next.app.identity.mobile);
  if (next.app.identity.mobile && next.app.identity.mobile !== ex.mobile) {
    next = mapApp(next, (a) => log({ ...a, enteredMobileIgnored: true }, { kind: 'internal', check: 'EXISTENCE', note: `Entered mobile differs from the stored mobile ${maskLast3(ex.mobile)} — not used; code sent to the stored mobile only` }));
  }
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

/**
 * New identifier, contact mobile verified: create the record, link Stage 1, route. Internally Not
 * Eligible → captured, "Application submitted", no further call.
 */
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
  if (e.result === 'NOT_ELIGIBLE') return captureNotEligible(base, e.reason);
  if (s.app.kyb.kind === 'FL_CERT' && s.app.identity.prerequisite === 'no') return captureNotEligible(base, 'FL_IBAN_NOT_LINKED');
  return go(base, isCr(base.app) ? 'cr' : 'business');
}

/** Existing record, stored mobile verified: open it by its lifecycle + authorization, never by completion alone. */
function openExisting(s: ProposedState, ex: { existence: Existence; appId: string | null }): ProposedState {
  if (ex.existence === 'live' && !ex.appId) return go(s, 'login', { existence: 'live', sessionVerified: true });
  const saved = ex.appId ? s.backend.applications[ex.appId] : null;
  if (!saved) return go(s, 'kyb');
  // A new session: provider retry counters start again; technical Nafath failures too.
  let app: Application = {
    ...saved,
    actor: 'preparer', signerSession: null, enteredMobileIgnored: s.app.enteredMobileIgnored, existence: s.app.existence ?? saved.existence,
    otp: { ...s.app.otp, status: 'verified' },
    // This session's existence check and code (never entries the saved record already has).
    ledger: [...saved.ledger, ...s.app.ledger.filter((e) => (e.kind === 'otp' || e.check === 'EXISTENCE') && !saved.ledger.includes(e)).slice(-3)],
    sessionVerified: true, returnTo: null, editBaseline: null, throttled: false, identifyChecks: 0,
    cr: saved.cr.status === 'unavailable' ? { ...saved.cr, status: 'idle', tries: 0 } : saved.cr,
    persons: saved.persons.status === 'unavailable' ? { ...saved.persons, status: 'idle', tries: 0 } : saved.persons,
    certs: saved.certs.status === 'unavailable' ? { ...saved.certs, status: 'idle', tries: 0 } : saved.certs,
    nafath: { ...saved.nafath, technical: 0, status: saved.nafath.status === 'unavailable' || saved.nafath.status === 'waiting' ? 'idle' : saved.nafath.status }
  };
  app = reuseOnResume(app);
  const opened = checkExpiry({ ...s, app });
  const step = routeFor(opened.app);
  return persist({ ...opened, app: { ...opened.app, step, lastStep: furthest(opened.app.lastStep, step) } });
}

/* ------------------------------------------------------------------ Continue Application link (resume) */

/** "Save & exit": send a Continue Application link to the registered mobile (DRAFT only). */
export function sendContinueLink(s: ProposedState): ProposedState {
  const { app } = s;
  if (!app.id || app.status !== 'DRAFT' || !app.registeredMobile || isSigner(app)) return s;
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
  const app: Application = { ...saved, actor: 'preparer', signerSession: null, sessionVerified: false, returnTo: null, editBaseline: null };
  return sendOtp({ ...s, app }, 'resume', saved.registeredMobile);
}

/* ------------------------------------------------------------------ Stage 3 (CR): CR verification */

const crFingerprint = (app: Application) => `cr:${app.identity.identifier}`;
const personsFingerprint = (app: Application) => `persons:${app.identity.identifier}`;

/**
 * Registered business: CR data (status, age, activities, National Address, entity), the hard rules,
 * the verified category, the backend risk score and the owners / managers (kept for the Authorization
 * step). The merchant only reviews the retrieved registration and continues — nobody is chosen here.
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
    if (cat.block) return captureNotEligible({ ...next, app }, cat.block);
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
    // Nobody on the CR can authorize (delegates are Phase 2): captured internally.
    return captureNotEligible({ ...next, app: { ...app, persons: { status: 'none', tries, list, selectedId: null } } }, 'NO_OWNER_MANAGER_ON_CR');
  }
  return persist({ ...next, app: { ...app, persons: { status: 'loaded', tries, list, selectedId: eligible.length === 1 ? eligible[0].id : app.persons.selectedId } } });
}

export const crVerified = (app: Application) => app.cr.status === 'loaded' && app.persons.status === 'loaded';
export const continueFromCr = (s: ProposedState): ProposedState => (crVerified(s.app) ? go(s, 'business') : s);

/* ------------------------------------------------------------------ Stage 7 (FL): certificate after Review, BEFORE Nafath */

const certsFingerprint = (app: Application) => `certs:${app.identity.identifier}`;

/**
 * One retrieval by National ID, after Review and before Nafath (no certificate → no Nafath cost). No
 * usable certificate → captured internally ("Application submitted"). A stored result is reused.
 */
export function loadCertificates(s: ProposedState): ProposedState {
  if (!fl(s.app) || s.app.certs.status === 'loaded') return s;
  if (reusable(s.app, 'FL_CERTS', certsFingerprint(s.app)) && s.app.certs.list.length) {
    const app = log(s.app, { kind: 'reuse', check: 'FL_CERTS', note: 'Stored certificate list reused — no new call' });
    return persist({ ...s, app: { ...app, certs: { ...app.certs, status: 'loaded' } } });
  }
  const tries = s.app.certs.tries + 1;
  let app = log(s.app, { kind: 'call', check: 'FL_CERTS', note: `Freelancer Certificate retrieval by National ID — before Nafath (attempt ${tries})` });
  const r = s.sim.certificates;
  if (r === 'unavailable') return persist({ ...s, app: { ...app, certs: { ...app.certs, status: 'unavailable', tries } } });
  const list = r === 'none' ? [] : certificatesAdapter(r, app.kyb.sub);
  const selectable = selectableCertificates(list);
  app = store(app, makeRecord('FL_CERTS', certsFingerprint(app), selectable.length ? `${list.length} certificate(s), ${selectable.length} usable` : 'no usable certificate', now(), providerRef('FLC', tries)));
  if (!selectable.length) return captureNotEligible({ ...s, app: { ...app, certs: { ...app.certs, status: 'idle', tries, list } } }, 'FL_CERT_NOT_FOUND');
  return persist({ ...s, app: { ...app, certs: { status: 'loaded', tries, list, selectedId: app.certs.selectedId ?? (selectable.length === 1 ? selectable[0].id : null) } } });
}

export function selectCertificate(s: ProposedState, id: string): ProposedState {
  if (stepLocked(s.app, 'certificates') || !canEdit(s.app) || s.app.certs.selectedId === id) return s;
  // The IBAN was already checked in Business Details (against the National ID): choosing the certificate does not reset it.
  return withApp(s, { certs: { ...s.app.certs, selectedId: id } });
}

/**
 * Confirm the certificate (after Review): its activity becomes the verified category (authoritative) and
 * part of the authorization context. Then Nafath. The offer agreed earlier is kept; a reclassified
 * activity is flagged internally.
 */
export function confirmCertificate(s: ProposedState): ProposedState {
  const cert = s.app.certs.list.find((c) => c.id === s.app.certs.selectedId);
  if (!cert || cert.status !== 'active' || cert.issue === 'duplicate' || stepLocked(s.app, 'certificates')) return s;
  let flags = dropFlags(s.app.flags, ['CERTIFICATE_INCONSISTENT', 'CATEGORY_RECLASSIFIED', 'ACTIVITY_UNMAPPED']);
  if (cert.issue === 'inconsistent') flags = addFlag(flags, 'CERTIFICATE_INCONSISTENT');
  const cat = deriveCategory(s.app.kyb.kind!, s.app.kyb.sub, 'CERTIFICATE', [{ code: cert.activity, primary: true }], s.app.kyb.channel ?? 'online');
  if (cat.check.outcome === 'RECLASSIFIED') flags = addFlag(flags, 'CATEGORY_RECLASSIFIED');
  if (cat.check.outcome === 'UNMAPPED') flags = addFlag(flags, 'ACTIVITY_UNMAPPED');
  let app: Application = { ...s.app, flags, categoryCheck: cat.check };
  app = log({ ...app, risk: assessRisk(app) }, { kind: 'internal', check: 'RISK', note: `Risk calculated from revenue and certificate activity ${activityLabel(cert.activity)} (synthetic)` });
  if (cat.block) return captureNotEligible({ ...s, app }, cat.block);
  return go({ ...s, app }, 'nafath');
}

export const certificateConfirmed = (app: Application) => app.categoryCheck?.source === 'CERTIFICATE';

/* ------------------------------------------------------------------ CR Authorization choice (after Review) */

/**
 * The Authorization page can still change: preparer, registered business, no handoff live, no
 * self-Nafath verified; a draft, or a frozen application whose previous version expired / ended.
 */
function authOpen(app: Application): boolean {
  if (!isCr(app) || isSigner(app) || activeVersion(app)) return false;
  if (app.authorization.mode === 'self' && app.nafath.status === 'verified') return false;
  return app.status === 'DRAFT' || app.status === 'AWAITING_AUTHORIZATION';
}

/** "Who will authorize and sign this application?" — a draft choice until Nafath / a handoff starts. */
export function chooseAuthMode(s: ProposedState, mode: AuthMode): ProposedState {
  if (!authOpen(s.app) || s.app.step !== 'authorize') return s;
  return persist(withApp(s, { authorization: { ...s.app.authorization, mode } }));
}

/** The owner / manager who authorizes (self: the preparer themself; handoff: the signer). */
export function selectPerson(s: ProposedState, id: string): ProposedState {
  if (!authOpen(s.app) || s.app.persons.selectedId === id || !eligiblePersons(s.app.persons.list).some((p) => p.id === id)) return s;
  return persist(withApp(s, { persons: { ...s.app.persons, selectedId: id }, authorizedMobileVerified: false, mobileMatch: { ...s.app.mobileMatch, status: 'idle', matchedFor: null } }));
}

const freshNafath = (app: Application): Application['nafath'] => ({ ...app.nafath, status: 'idle', failures: 0, technical: 0, lastResult: null });

/** A. "I can complete the authorization myself": the preparer is the selected owner / manager → Nafath. */
export function authorizeSelf(s: ProposedState): ProposedState {
  const { app } = s;
  if (!authOpen(app) || !app.persons.selectedId || app.authorization.mode !== 'self') return s;
  const next = withApp(s, { nafath: app.nafath.verifiedFor === app.persons.selectedId ? app.nafath : freshNafath(app) });
  return go(mapApp(next, (a) => authLog(setAuth(a, 'NAFATH_PENDING'), 'Self-authorization: preparer verifies with Nafath')), 'nafath');
}

/** Back from Nafath (not verified yet) to the Authorization choice. */
export function backToAuthorize(s: ProposedState): ProposedState {
  const { app } = s;
  if (isSigner(app) || !isCr(app) || app.nafath.status === 'verified' || activeVersion(app)) return s;
  const previous = currentVersion(app)?.status ?? 'NOT_STARTED';
  const reset = app.authorization.mode === 'self' ? { ...app.authorization, status: previous } : app.authorization;
  return go(s, 'authorize', { authorization: reset, mobileMatch: { ...app.mobileMatch, status: 'idle' } });
}

/**
 * B. "Send to another signer": one owner / manager on the CR + their primary Nafath mobile. Creates the
 * authorization version, freezes the application and the offer, makes it read-only for the preparer,
 * sends the secure SMS link and opens the preparer's Authorization status page.
 * Blocked while a handoff is live, and above `maxVersions` handoffs in `windowDays`.
 */
export function createHandoff(s: ProposedState, signerId: string, mobile: string, at = Date.now(), rules: HandoffRules = HANDOFF_RULES): ProposedState {
  const { app } = s;
  const signer = eligiblePersons(app.persons.list).find((p) => p.id === signerId);
  const statusOk = app.status === 'DRAFT' || (app.status === 'AWAITING_AUTHORIZATION' && !activeVersion(app));
  if (!isCr(app) || !app.id || isSigner(app) || !statusOk || !signer || !isSaudiMobile(mobile) || reviewIssues(app).length || app.nafath.status === 'verified' && app.authorization.mode === 'self') return s;
  if (!canStartHandoff(app, at, rules)) {
    const blocked = authLog({ ...app, flags: addFlag(app.flags, 'AUTHORIZATION_LIMIT_REACHED'), authorization: { ...app.authorization, limitReached: true } },
      `Handoff refused: ${handoffsInWindow(app, at, rules)} of ${handoffAllowance(app, rules)} in ${rules.windowDays} days — internal unlock needed`);
    return persist({ ...s, app: blocked });
  }
  const version = app.authorization.versions.length + 1;
  const snapshot = freezeSnapshot(app);
  const v: HandoffVersion = {
    version, applicationId: app.id, signerId, signerName: `${signer.name[0]} ${signer.name[3]}`, signerIdMasked: signer.idMasked, signerMobile: mobile,
    createdAt: iso(at), expiresAt: iso(at + rules.expiryDays * DAY_MS), status: 'HANDOFF_CREATED', initiatedBy: `Preparer (registered mobile ${maskLast3(app.registeredMobile)})`,
    endReason: null, endedAt: null, completedAt: null, snapshot
  };
  const token = newSignerToken(at + version + s.backend.sms.length);
  let next: Application = {
    ...app,
    status: 'AWAITING_AUTHORIZATION',
    persons: { ...app.persons, selectedId: signerId },
    nafath: freshNafath(app), authorizedMobileVerified: false, mobileMatch: { status: 'idle', checks: 0, matchedFor: null },
    authorization: { ...app.authorization, mode: 'signer', status: 'HANDOFF_CREATED', versions: [...app.authorization.versions, v], limitReached: false, frozenAt: app.authorization.frozenAt ?? iso(at), frozenSnapshot: snapshot }
  };
  next = authLog(next, `Authorization V${version} created for ${v.signerName} — application and offer frozen`);
  next = authLog(setAuth(next, 'AWAITING_SIGNER'), `Secure signer link sent by SMS (valid ${rules.expiryDays} days)`);
  const sent = revokeTokens(go({ ...s, app: next }, 'handoff', { returnTo: null, editBaseline: null }));
  return {
    ...sent,
    backend: {
      ...sent.backend,
      signerLinks: { ...sent.backend.signerLinks, [token]: { applicationId: app.id, version } },
      sms: [...sent.backend.sms, { to: mobile, kind: 'signer-link', token, text: `Authorize a Madfu merchant application (demo link, V${version}).`, at: iso(at) }]
    }
  };
}

/** End the live handoff version (expiry, signer mobile mismatch, signer Nafath failed). The application stays. */
function endHandoff(s: ProposedState, reason: AuthEndReason, at = Date.now()): ProposedState {
  const v = activeVersion(s.app);
  if (!v) return s;
  const status: AuthStatus = reason === 'EXPIRED' ? 'EXPIRED' : 'CANCELLED';
  let app = authLog(setAuth(s.app, status, { endReason: reason, endedAt: iso(at) }), `Authorization V${v.version} ${status.toLowerCase()} (${reason}) — application kept, no new application`);
  if (isSigner(app)) app = { ...app, step: 'signer', signerSession: { version: v.version, link: reason === 'EXPIRED' ? 'expired' : 'ended' } };
  return persist({ ...s, app });
}

/** Expire the live handoff once its validity has passed (checked whenever either side opens it). */
export function checkExpiry(s: ProposedState, at = Date.now()): ProposedState {
  const v = activeVersion(s.app);
  return v && at >= Date.parse(v.expiresAt) ? endHandoff(s, 'EXPIRED', at) : s;
}

/**
 * After an expired / ended version the SAME application can get a new authorization version (self or
 * signer) — within the limit. Data and offer stay frozen.
 */
export function restartAuthorization(s: ProposedState): ProposedState {
  const { app } = s;
  if (isSigner(app) || app.status !== 'AWAITING_AUTHORIZATION' || activeVersion(app) || !['EXPIRED', 'CANCELLED'].includes(app.authorization.status)) return s;
  return go(s, 'authorize', { authorization: { ...app.authorization, mode: null } });
}

/** INTERNAL / manual unlock (Prototype Controls): one more handoff above the limit. */
export function manualUnlock(s: ProposedState): ProposedState {
  const a = s.app.authorization;
  const app = authLog({ ...s.app, flags: dropFlags(s.app.flags, ['AUTHORIZATION_LIMIT_REACHED']), authorization: { ...a, extraVersions: a.extraVersions + 1, limitReached: false } }, 'Internal team unlocked one more signer handoff');
  return persist({ ...s, app });
}

/* ------------------------------------------------------------------ the signer: secure link, Nafath, review, contract */

/** The token of the newest signer link of this application (Prototype Controls). */
export const latestSignerToken = (s: ProposedState, appId = s.app.id): string | null =>
  Object.entries(s.backend.signerLinks).filter(([, l]) => l.applicationId === appId).sort((a, b) => b[1].version - a[1].version)[0]?.[0] ?? null;

/**
 * The signer opens the secure SMS link in their own session. No OTP in Phase 1, and the link alone does
 * not authorize anything: the first page shows only masked request details; Nafath comes next.
 * An expired, ended, completed or older version's link no longer works.
 */
export function openSignerLink(s: ProposedState, token: string, at = Date.now()): ProposedState {
  const link = s.backend.signerLinks[token];
  const saved = link ? s.backend.applications[link.applicationId] : null;
  if (!link || !saved) return { ...s, app: { ...initialApplication(), actor: 'signer', step: 'signer', signerSession: { version: 0, link: 'invalid' } } };
  const opened = checkExpiry({ ...s, app: { ...saved, actor: 'signer', sessionVerified: false, returnTo: null, editBaseline: null } }, at);
  const app = opened.app;
  const v = app.authorization.versions.find((x) => x.version === link.version)!;
  const latest = currentVersion(app)?.version === v.version;
  const state: Application['signerSession'] = {
    version: v.version,
    link: v.status === 'COMPLETED' ? 'completed' : v.status === 'EXPIRED' ? 'expired' : !latest || v.status === 'CANCELLED' ? 'ended' : 'active'
  };
  // A new signer session always verifies with Nafath again before anything is shown.
  const nafath = { ...app.nafath, technical: 0, status: app.nafath.status === 'exhausted' ? 'exhausted' as const : 'idle' as const };
  const logged = log({ ...app, nafath, signerSession: state, step: 'signer' }, { kind: 'internal', check: 'AUTHORIZATION', note: `Signer link V${v.version} opened (${state.link}) — no OTP; Nafath required` });
  return persist({ ...opened, app: logged });
}

const signerActive = (app: Application) => isSigner(app) && app.signerSession?.link === 'active' && !!activeVersion(app);

/** "Start Nafath Verification": mobile ↔ National ID for the signer's mobile, then the Nafath request. */
export function signerStartNafath(s: ProposedState): ProposedState {
  if (!signerActive(s.app)) return s;
  const next = s.app.authorization.status === 'AWAITING_SIGNER' ? mapApp(s, (a) => authLog(setAuth(a, 'NAFATH_PENDING'), 'Signer started Nafath')) : s;
  return sendToNafath(next);
}

/* ------------------------------------------------------------------ mobile ↔ National ID, then Nafath */

const nafathSubject = (app: Application) => (isCr(app) ? app.persons.selectedId ?? '' : app.identity.identifier);
/** The mobile that must belong to the verifying person: the signer's handoff mobile, or the registered mobile. */
export const verifyingMobile = (app: Application) => (isSigner(app) ? activeVersion(app)?.signerMobile ?? '' : app.registeredMobile);
const matchFingerprint = (app: Application) => `mm:${verifyingMobile(app)}:${nafathSubject(app)}`;
const nafathFingerprint = (app: Application) => `nafath:${app.id}:${nafathSubject(app)}`;
export const nafathRemaining = (app: Application) => Math.max(0, LIMITS.nafathAttempts - app.nafath.failures);

/** Nafath can be requested here: a confirmed certificate after Review (FL), a chosen self-authorizer (CR) or a live signer link. */
const nafathReady = (app: Application) =>
  fl(app) ? certificateConfirmed(app) : isSigner(app) ? signerActive(app) : app.authorization.mode === 'self' && !!app.persons.selectedId;

/**
 * "Send to Nafath": first confirm that the mobile belongs to the National ID of the person who will
 * verify. Mismatch → no Nafath request. A signer mismatch ends the handoff (no self-service mobile
 * change in Phase 1).
 */
export function sendToNafath(s: ProposedState): ProposedState {
  if (!nafathReady(s.app) || !nafathSubject(s.app)) return s;
  const fp = matchFingerprint(s.app);
  let next = s;
  if (!(s.app.authorizedMobileVerified && s.app.mobileMatch.matchedFor === fp)) {
    if (reusable(s.app, 'MOBILE_MATCH', fp)) {
      next = mapApp(s, (a) => log({ ...a, authorizedMobileVerified: true, mobileMatch: { ...a.mobileMatch, status: 'matched', matchedFor: fp } }, { kind: 'reuse', check: 'MOBILE_MATCH', note: 'Mobile ↔ National ID match reused' }));
    } else {
      const m = s.app.mobileMatch;
      if (m.checks >= LIMITS.mobileMatchChecks && !isSigner(s.app)) return persist(withApp(s, { mobileMatch: { ...m, status: 'blocked' }, flags: addFlag(s.app.flags, 'MOBILE_OWNERSHIP_UNVERIFIED') }));
      const checks = m.checks + 1;
      let app = log(s.app, { kind: 'call', check: 'MOBILE_MATCH', note: `Mobile ↔ National ID ownership check ${checks}${isSigner(s.app) ? ' (signer)' : ''}` });
      const result = mobileMatchAdapter(s.sim, checks - 1);
      if (result === 'mismatch') {
        if (isSigner(app)) return endHandoff({ ...s, app: { ...app, authorizedMobileVerified: false, mobileMatch: { status: 'mismatch', checks, matchedFor: null } } }, 'SIGNER_MOBILE_MISMATCH');
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

/** "Use another mobile number" after a mismatch (preparer / Freelancer only). */
export const startMobileChange = (s: ProposedState): ProposedState => (s.app.mobileMatch.status === 'mismatch' && !isSigner(s.app) ? withApp(s, { mobileMatch: { ...s.app.mobileMatch, status: 'entering' } }) : s);
export const cancelMobileChange = (s: ProposedState): ProposedState => withApp(s, { step: 'nafath', mobileMatch: { ...s.app.mobileMatch, status: 'mismatch' } });

/** OTP to the corrected mobile (its own code budget). Nothing else is reset. */
export function submitMobileChange(s: ProposedState, mobile: string): ProposedState {
  if (s.app.mobileMatch.status !== 'entering' || isSigner(s.app)) return s;
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
  // The signer always verifies again in a new session: the link alone never reaches the application.
  if (!isSigner(s.app) && reusable(s.app, 'NAFATH', nafathFingerprint(s.app))) {
    return go(mapApp(s, (a) => log(a, { kind: 'reuse', check: 'NAFATH', note: 'Nafath verified previously — reused, no new request' })), 'nafath', { nafath: { ...n, status: 'verified', verifiedFor: nafathSubject(s.app) } });
  }
  if (n.failures >= LIMITS.nafathAttempts) return go(s, 'nafath', { nafath: { ...n, status: 'exhausted' } });
  if (n.technical >= LIMITS.nafathTechnicalRetries) return go(s, 'nafath', { nafath: { ...n, status: 'unavailable' } });
  const requests = n.requests + 1;
  const app = log(s.app, { kind: 'call', check: 'NAFATH', note: `Nafath request ${requests}${isSigner(s.app) ? ' (signer)' : ''}` });
  return go({ ...s, app }, 'nafath', { nafath: { ...n, status: 'waiting', requests, number: NAFATH_NUMBERS[(requests - 1) % NAFATH_NUMBERS.length] } });
}

/** Rejected and timeout use an attempt; a technical failure does not, but is bounded per session. */
export function nafathResult(s: ProposedState, result: NafathResult): ProposedState {
  const n = s.app.nafath;
  if (n.status !== 'waiting' && n.status !== 'failed' && n.status !== 'idle') return s;
  if (result === 'verified') {
    let app = store(s.app, makeRecord('NAFATH', nafathFingerprint(s.app), 'verified', now(), providerRef('NFT', n.requests)));
    app = { ...app, nafath: { ...n, status: 'verified', lastResult: result, verifiedFor: nafathSubject(s.app) }, flags: dropFlags(app.flags, ['NAFATH_UNVERIFIED']) };
    if (isCr(app) && (isSigner(app) || app.authorization.mode === 'self')) app = authLog(setAuth(app, 'NAFATH_VERIFIED'), `${isSigner(app) ? 'Signer' : 'Preparer'} verified with Nafath`);
    if (isSigner(app)) app = { ...app, sessionVerified: true };
    return persist({ ...s, app });
  }
  if (result === 'technical') {
    const technical = n.technical + 1;
    return persist(withApp(s, { nafath: { ...n, status: technical >= LIMITS.nafathTechnicalRetries ? 'unavailable' : 'failed', technical, lastResult: result } }));
  }
  const failures = n.failures + 1;
  const exhausted = failures >= LIMITS.nafathAttempts;
  const next = persist(withApp(s, {
    nafath: { ...n, status: exhausted ? 'exhausted' : 'failed', failures, lastResult: result },
    flags: exhausted ? addFlag(s.app.flags, 'NAFATH_UNVERIFIED') : s.app.flags
  }));
  return exhausted && isSigner(next.app) ? endHandoff(next, 'SIGNER_NAFATH_FAILED') : next;
}

/** The answer the simulated Nafath app gives to the current request. */
export const nextNafathAnswer = (s: ProposedState) => nafathAdapter(s.sim, s.app.nafath.requests - 1);

/**
 * After Nafath. Signer → full read-only Review. CR preparer (self) → Contract, or (failed twice) manual
 * verification. Freelancer → Contract, or (failed twice) manual verification — same as the CR preparer.
 */
export function continueAfterNafath(s: ProposedState): ProposedState {
  const { app } = s;
  const n = app.nafath;
  if (isSigner(app)) return n.status === 'verified' && app.sessionVerified && signerActive(app) ? go(s, 'review') : s;
  if (n.status === 'verified' && fl(app)) return contractEligible(app) ? go(s, 'contract', { contract: { status: 'ready', acceptedAt: '' } }) : s;
  if (n.status === 'verified') return go(mapApp(s, (a) => setAuth(a, 'CONTRACT_PENDING')), 'contract', { contract: { status: 'ready', acceptedAt: '' } });
  if (n.status === 'exhausted') return revokeTokens(finish(s, 'SUBMITTED_MANUAL', 'SUBMITTED'));
  return s;
}

/* ------------------------------------------------------------------ Stage 4: Business Details */

export const setPresence = (s: ProposedState, patch: Partial<Pick<Application['business'], 'websiteUrl' | 'mapsUrl'>>) =>
  canEdit(s.app) ? withApp(s, { business: { ...s.app.business, ...patch } }) : s;

export const needsWebsite = (app: Application) => app.kyb.channel === 'online' || app.kyb.channel === 'both';
export const needsMaps = (app: Application) => app.kyb.channel === 'offline' || app.kyb.channel === 'both';
export const presenceComplete = (app: Application) =>
  (!needsWebsite(app) || !validateWebsite(app.business.websiteUrl)) && (!needsMaps(app) || !validateMapsUrl(app.business.mapsUrl));

/** Checked in Business Details, before the certificate is chosen: linked to the National ID that holds the certificates. */
const ibanTarget = (app: Application) => `nid:${app.identity.identifier}`;
const ibanFingerprint = (app: Application) => `iban:${app.business.iban}:${ibanTarget(app)}`;

/** Freelancer IBAN. A different IBAN invalidates only the IBAN check and starts with fresh attempts. */
export function setIban(s: ProposedState, iban: string): ProposedState {
  const b = s.app.business;
  if (iban === b.iban || b.ibanStatus === 'verified' || !canEdit(s.app)) return s;
  let app = s.app;
  if (app.verifications.IBAN?.status === 'valid') app = invalidate(app, ['IBAN'], 'IBAN changed');
  return { ...s, app: { ...app, business: { ...b, iban, ibanStatus: 'idle', ibanFailures: 0, ibanLast: null, bankName: '' } } };
}

/** Same IBAN and same owner as a stored success: reused. Otherwise a new linkage check starts. */
export function startIbanCheck(s: ProposedState): ProposedState {
  if (!fl(s.app) || s.app.business.ibanStatus === 'failed_final' || !canEdit(s.app)) return s;
  if (reusable(s.app, 'IBAN', ibanFingerprint(s.app))) {
    const app = log(s.app, { kind: 'reuse', check: 'IBAN', note: 'Same IBAN verified previously — reused, no new check' });
    return persist({ ...s, app: { ...app, business: { ...app.business, ibanStatus: 'verified', bankName: bankFromIban(app.business.iban) } } });
  }
  return withApp(s, { business: { ...s.app.business, ibanStatus: 'verifying' } });
}

export function finishIbanCheck(s: ProposedState): ProposedState {
  if (!canEdit(s.app)) return s;
  const b = s.app.business;
  const index = s.app.ledger.filter((e) => e.kind === 'call' && e.check === 'IBAN').length;
  const result = ibanAdapter(s.sim, index);
  let app = log(s.app, { kind: 'call', check: 'IBAN', note: 'IBAN linkage check (individual National ID)' });
  if (result === 'verified') {
    app = store(app, makeRecord('IBAN', ibanFingerprint(app), 'linked to the National ID', now(), providerRef('IBN', index + 1)));
    return persist({ ...s, app: { ...app, business: { ...b, ibanStatus: 'verified', ibanLast: result, bankName: bankFromIban(b.iban) } } });
  }
  if (result === 'technical') return persist({ ...s, app: { ...app, business: { ...b, ibanStatus: 'failed', ibanLast: result, bankName: '' } } });
  const ibanFailures = b.ibanFailures + 1;
  return persist({ ...s, app: { ...app, business: { ...b, ibanStatus: ibanFailures >= LIMITS.ibanAttempts ? 'failed_final' : 'failed', ibanFailures, ibanLast: result, bankName: '' } } });
}

export const businessComplete = (app: Application) => presenceComplete(app) && (!fl(app) || app.business.ibanStatus === 'verified');

/** Next (or "Save and return" during an edit: the edit is applied). */
export const submitBusiness = (s: ProposedState): ProposedState => (businessComplete(s.app) && canEdit(s.app) ? go(s, s.app.returnTo ?? 'commercial', { returnTo: null, editBaseline: null }) : s);

/* ------------------------------------------------------------------ Stage 5: Commercial Offer (preparer only) */

const offerEditable = (s: ProposedState, f: (s: ProposedState) => ProposedState) => (canEdit(s.app) ? f(s) : s);

/** The merchant asked for a rate review: kept as an internal flag even with no file. */
export const requestRateReview = (s: ProposedState) => offerEditable(s, (x) => withApp(x, { commercial: { ...x.app.commercial, reviewRequested: true }, flags: addFlag(x.app.flags, 'COMMERCIAL_RATE_REVIEW_REQUESTED') }));
export const withdrawRateReview = (s: ProposedState) => offerEditable(s, (x) => withApp(x, { commercial: { ...x.app.commercial, reviewRequested: false, evidence: [], uploadError: null }, flags: dropFlags(x.app.flags, ['COMMERCIAL_RATE_REVIEW_REQUESTED']) }));
export const addEvidence = (s: ProposedState, id: string) => offerEditable(s, (x) => {
  const r = requestRateReview(x);
  return withApp(r, { commercial: { ...r.app.commercial, uploadError: null, evidence: r.app.commercial.evidence.includes(id) ? r.app.commercial.evidence : [...r.app.commercial.evidence, id] } });
});
/** Simulated failed optional upload: shown inline, never blocks the standard offer. */
export const failUpload = (s: ProposedState, id: string) => offerEditable(s, (x) => { const r = requestRateReview(x); return withApp(r, { commercial: { ...r.app.commercial, uploadError: id } }); });
export const removeEvidence = (s: ProposedState, id: string) => offerEditable(s, (x) => withApp(x, { commercial: { ...x.app.commercial, evidence: x.app.commercial.evidence.filter((e) => e !== id) } }));

/** Confirm the standard offer (verified category). Never waits for the rate review. Frozen after a handoff. */
export function confirmOffer(s: ProposedState): ProposedState {
  if (!canEdit(s.app)) return s;
  return go(s, s.app.returnTo ?? 'review', { commercial: { ...s.app.commercial, agreed: buildOffer(s.app) }, returnTo: null, editBaseline: null });
}

/* ------------------------------------------------------------------ Stage 6: Review, transactional edit */

/** Sections that can be edited after verification (preparer, non-frozen draft). Everything else is locked. */
export const EDITABLE_SECTIONS: SectionId[] = ['presence', 'commercial'];

/** Edit opens on a full copy of the application: nothing is applied or invalidated until Save. */
export function startEdit(s: ProposedState, section: SectionId): ProposedState {
  if (!EDITABLE_SECTIONS.includes(section) || !canEdit(s.app)) return s;
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
  if (app.nafath.status !== 'verified' || app.nafath.verifiedFor !== nafathSubject(app)) out.push('Nafath not verified for the signing person');
  if (!app.authorizedMobileVerified) out.push('Mobile ownership not confirmed for the signing person');
  if (isCr(app)) {
    if (!(app.persons.status === 'loaded' && app.persons.selectedId)) out.push('No owner / manager authorizes');
    if (!app.authorization.mode) out.push('Authorization not chosen');
    if (app.authorization.mode === 'signer' && !(isSigner(app) && app.sessionVerified && signerActive(app))) out.push('Only the signer signs (verified in this session, live link)');
  }
  if (fl(app)) {
    if (!certificateConfirmed(app)) out.push('No confirmed certificate');
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

/**
 * Continue from Review. Signer (read-only) → Contract. CR preparer → Authorization choice (or straight
 * back to the Contract when self-authorization is already verified). Freelancer → Certificate selection
 * (or the first of certificate → Nafath → Contract still unfinished).
 */
export function continueFromReview(s: ProposedState): ProposedState {
  const { app } = s;
  if (isSigner(app)) {
    return app.nafath.status === 'verified' && app.sessionVerified && signerActive(app)
      ? go(mapApp(s, (a) => setAuth(a, 'CONTRACT_PENDING')), 'contract', { contract: { status: 'ready', acceptedAt: '' } })
      : s;
  }
  if (reviewIssues(app).length || app.status !== 'DRAFT') return s;
  if (isCr(app)) return app.authorization.mode === 'self' && contractEligible(app) ? go(s, 'contract') : go(s, 'authorize');
  if (!certificateConfirmed(app)) return go(s, 'certificates');
  if (app.nafath.status !== 'verified') return go(s, 'nafath');
  return contractEligible(app) ? go(s, 'contract') : s;
}

/* ------------------------------------------------------------------ Stage 7 / 8: Contract, Submit, Status */

/**
 * The single contract action: records the (simulated) acceptance and submits the application.
 * Preparer: "Agree & Submit" (Freelancer, or CR self-authorization). Signer: "Agree & Sign".
 */
export function agreeAndSubmit(s: ProposedState): ProposedState {
  const { app } = s;
  if (!(app.status === 'DRAFT' || app.status === 'AWAITING_AUTHORIZATION') || !contractEligible(app)) return s;
  let next: Application = { ...app, contract: { status: 'accepted', acceptedAt: now() } };
  if (isCr(app)) {
    next = authLog(setAuth(next, 'COMPLETED', { completedAt: now() }), `Authorization ${app.authorization.mode === 'signer' ? `V${currentVersion(app)?.version} signed by the signer` : 'completed by the preparer'}`);
    if (isSigner(app)) next = { ...next, signerSession: { ...next.signerSession!, link: 'completed' } };
  }
  return revokeTokens(finish({ ...s, app: next }, 'SUBMITTED', 'SUBMITTED'));
}

/** Application Progress (prototype control): the team moves a submitted application along. */
export function setReviewStatus(s: ProposedState, status: Lifecycle): ProposedState {
  if (!SUBMITTED_STATUSES.includes(s.app.status) || !SUBMITTED_STATUSES.includes(status)) return s;
  return go(s, 'status', { status });
}

/** The approved merchant goes live: the merchant account exists from now on; re-entry shows the login popup. */
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
  return go({ ...s, sim: { ...s.sim, cr: { ...s.sim.cr, status: 'ACTIVE' } }, app }, 'cr');
}

/* ------------------------------------------------------------------ delegated signer (PHASE 2, demo only) */

/** Opens the delegated-signer demo from the Authorization page. No Phase-1 behaviour depends on it. */
export const openDelegation = (s: ProposedState): ProposedState => (s.app.step === 'authorize' && authOpen(s.app) ? go(s, 'delegation') : s);
export const setDelegationType = (s: ProposedState, type: DelegationType): ProposedState =>
  s.app.step === 'delegation' ? persist(withApp(s, { authorization: { ...s.app.authorization, delegation: { type, status: 'idle' } } })) : s;
/** Demo outcomes: MOJ (automatic) valid / invalid; documents (manual Quality) under review / approved / rejected. */
export function delegationResult(s: ProposedState, status: DelegationStatus): ProposedState {
  const d = s.app.authorization.delegation;
  if (s.app.step !== 'delegation' || !d.type) return s;
  const allowed: DelegationStatus[] = d.type === 'MOJ' ? ['idle', 'valid', 'invalid'] : ['idle', 'under_review', 'approved', 'rejected'];
  if (!allowed.includes(status)) return s;
  return persist(withApp(s, { authorization: { ...s.app.authorization, delegation: { ...d, status } } }));
}
export const leaveDelegation = (s: ProposedState): ProposedState => (s.app.step === 'delegation' ? go(s, 'authorize') : s);

/* ------------------------------------------------------------------ reviewer-only Back (Prototype Controls) */

/** Merchant-facing steps a reviewer can step back through after the application exists. */
const REVIEWER_STEPS: StepId[] = ['cr', 'certificates', 'nafath', 'business', 'commercial', 'review', 'authorize', 'contract'];

/**
 * Reviewer / prototype navigation only — not merchant UX. Moves to the previous screen WITHOUT
 * changing anything else: no verification, lifecycle status or saved value is reset, and locked
 * screens simply show their existing values. Not available during an edit, on a code screen, in a
 * signer session, or once the application has left DRAFT (handoff, submitted, captured, paused).
 */
export function reviewerBackTarget(app: Application): StepId | null {
  if (app.returnTo || app.editBaseline || isSigner(app)) return null;
  if (!app.id) {
    if (app.step === 'identify') return 'kyb';
    if (app.step === 'otp' && app.otp.purpose === 'application') return 'identify';
    return null;
  }
  if (app.status !== 'DRAFT') return null;
  if (app.step === 'delegation') return 'authorize';
  const path = pathFor(app).filter((st) => REVIEWER_STEPS.includes(st));
  const i = path.indexOf(app.step);
  return i > 0 ? path[i - 1] : null;
}

export function reviewerBack(s: ProposedState): ProposedState {
  const target = reviewerBackTarget(s.app);
  if (!target) return s;
  // Before the application exists, Page 1 / Page 2 are simply reopened (nothing is persisted yet).
  if (!s.app.id) return withApp(s, { step: target, status: 'QUALIFICATION', outcome: null, outcomeReason: null });
  return persist(withApp(s, { step: target }));
}

/* ------------------------------------------------------------------ resume target (DRAFT only) */

/** First screen that still needs input in a DRAFT. Never used for any other lifecycle status. */
export function firstIncomplete(app: Application): StepId {
  if (!app.id) return app.eligibility ? 'identify' : 'kyb';
  if (isCr(app)) {
    if (!crVerified(app)) return 'cr';
    if (!businessComplete(app)) return 'business';
    if (!app.commercial.agreed) return 'commercial';
    if (app.authorization.mode === 'self' && app.authorization.status !== 'NOT_STARTED') return contractEligible(app) ? 'contract' : 'nafath';
    return ORDER.indexOf(app.lastStep) >= ORDER.indexOf('authorize') ? 'authorize' : 'review';
  }
  // Freelancer: Business Details → Offer → Review → Certificate → Nafath → Contract.
  if (!businessComplete(app)) return 'business';
  if (!app.commercial.agreed) return 'commercial';
  if (!certificateConfirmed(app)) return ORDER.indexOf(app.lastStep) >= ORDER.indexOf('certificates') ? 'certificates' : 'review';
  if (app.nafath.status !== 'verified') return 'nafath';
  return contractEligible(app) ? 'contract' : 'review';
}

/** The next operation that would create a NEW external call (Internal view). */
export function nextPaidCall(s: ProposedState): string {
  const { app } = s;
  if (app.step === 'otp' && app.otp.status !== 'verified') return 'None — the SMS code was already sent';
  if (!app.id) return app.step === 'identify' ? 'Internal existence check, then one SMS OTP' : app.step === 'signer' ? 'None — invalid link' : 'None — Stage 1 is internal (no provider call)';
  if (isSigner(app)) {
    if (app.step === 'signer' && signerActive(app)) return 'Signer: mobile ↔ National ID check, then Nafath request (no OTP)';
    return app.step === 'nafath' && app.nafath.status !== 'verified' ? 'Signer Nafath request' : 'None — the signer’s next screen needs no provider call';
  }
  if (app.status !== 'DRAFT' && app.status !== 'AWAITING_AUTHORIZATION') return 'None — the application is not a draft';
  const step = app.step;
  if (step === 'cr' && app.cr.status !== 'loaded') return 'CR data retrieval, then owners / managers';
  if (step === 'cr' && app.persons.status !== 'loaded') return 'Owners / managers retrieval';
  if (step === 'certificates' && app.certs.status !== 'loaded') return 'Freelancer Certificate retrieval (after Review, before Nafath)';
  if (step === 'nafath' && app.nafath.status !== 'verified') return app.authorizedMobileVerified ? 'Nafath request' : 'Mobile ↔ National ID check, then Nafath request';
  if (step === 'business' && fl(app) && app.business.ibanStatus !== 'verified') return 'IBAN linkage check';
  if (step === 'authorize') return 'None — the signer’s checks run only after the secure link is opened';
  return 'None — the next screen needs no provider call';
}

/* ------------------------------------------------------------------ prefilled applications (scenarios, PDF, boards) */

type PrefillKind = 'CR' | 'FL_CERT';

const CR_ORDER: StepId[] = ['kyb', 'identify', 'otp', 'cr', 'business', 'commercial', 'review', 'authorize', 'nafath', 'contract', 'outcome', 'status'];
const FL_ORDER: StepId[] = ['kyb', 'identify', 'otp', 'business', 'commercial', 'review', 'certificates', 'nafath', 'contract', 'outcome', 'status'];

/**
 * A healthy self-service application walked with the REAL transitions up to (not including) `upTo`.
 * 'status' = submitted. A CR walked past 'authorize' uses self-authorization by the first owner.
 * Used by scenarios, fixtures and the PDF.
 */
export function prefill(kind: PrefillKind, upTo: StepId, who: { identifier?: string; mobile?: string } = {}): Application {
  const isFl = kind === 'FL_CERT';
  const order = isFl ? FL_ORDER : CR_ORDER;
  const reach = (step: StepId) => order.indexOf(upTo) > order.indexOf(step);
  const at = (s: ProposedState) => ({ ...s.app, step: upTo, lastStep: furthest(s.app.lastStep, upTo) });
  let s: ProposedState = { app: initialApplication(1_760_000_000_000), sim: initialSim(), scenarioId: null, backend: initialBackend() };
  s = setKyb(s, isFl
    ? { kind, group: 'services', sub: 'services-design', revenue: 'MID_BAND', channel: 'online' }
    : { kind, group: 'food', sub: 'food-cafe', revenue: 'MID_BAND', channel: 'both' });
  if (!reach('kyb')) return at(s);
  s = submitKyb(s);
  s = setIdentity(s, { identifier: who.identifier ?? (isFl ? DEMO.nationalId : DEMO.cr), mobile: who.mobile ?? DEMO.mobile, prerequisite: isFl ? 'yes' : null });
  if (!reach('identify')) return at(s);
  s = submitIdentify(s);
  if (!reach('otp')) return at(s);
  s = verifyOtp(s, DEMO_SMS_CODE);
  if (!isFl && reach('cr')) { s = runBusinessVerification(s); s = continueFromCr(s); }
  if (reach('business')) {
    s = setPresence(s, isFl ? { websiteUrl: 'https://studio.example.com' } : { websiteUrl: 'https://najdroastery.example.com', mapsUrl: 'https://maps.google.com/?q=24.7136,46.6753' });
    if (isFl) { s = setIban(s, demoIban('80', '4821')); s = finishIbanCheck(startIbanCheck(s)); }
    s = submitBusiness(s);
  }
  if (reach('commercial')) s = confirmOffer(s);
  if (reach('review')) s = continueFromReview(s);
  if (isFl && reach('certificates')) { s = loadCertificates(s); s = confirmCertificate(s); }
  if (!isFl && reach('authorize')) { s = chooseAuthMode(s, 'self'); s = selectPerson(s, 'p1'); s = authorizeSelf(s); }
  if (reach('nafath')) { s = sendToNafath(s); s = nafathResult(s, 'verified'); s = continueAfterNafath(s); }
  if (reach('contract')) s = agreeAndSubmit(s);
  if (upTo === 'status' || upTo === 'outcome') return { ...s.app, step: upTo === 'status' ? 'status' : 'outcome' };
  return at(s);
}

/** A record captured as internally Not Eligible (unsupported category, verified contact) — scenarios, fixtures. */
export function notEligibleRecord(kind: PrefillKind, who: { identifier?: string; mobile?: string } = {}): Application {
  let s: ProposedState = { app: initialApplication(1_760_000_000_000), sim: initialSim(), scenarioId: null, backend: initialBackend() };
  s = setKyb(s, { kind, group: 'fixture', sub: 'fixture-blocked', revenue: 'MID_BAND', channel: 'online' });
  s = submitKyb(s);
  s = setIdentity(s, { identifier: who.identifier ?? (kind === 'FL_CERT' ? DEMO.nationalId : DEMO.cr), mobile: who.mobile ?? DEMO.mobile });
  s = verifyOtp(submitIdentify(s), DEMO_SMS_CODE);
  return s.app;
}

/** A state whose backend holds `app` (saved), so resume and existence checks see it. */
export function withSaved(app: Application, sim: Sim = initialSim(), scenarioId: string | null = null): ProposedState {
  return persist({ app, sim, scenarioId, backend: initialBackend() });
}

/** A CR application at Review → "Send to another signer" (signer p2, the demo signer mobile) at `at`. */
export function withHandoff(at = Date.now(), base: ProposedState = withSaved(prefill('CR', 'authorize'))): ProposedState {
  return createHandoff(chooseAuthMode(base, 'signer'), 'p2', DEMO.signerMobile, at);
}
