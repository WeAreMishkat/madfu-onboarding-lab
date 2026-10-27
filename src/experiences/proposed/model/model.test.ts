import { describe, expect, it } from 'vitest';
import { deriveCategory } from './activity';
import { LIMITS, REVENUE_OPTIONS, RULE_FLAGS, STAGES } from './config';
import { OUTCOME_COPY } from './copy';
import { CATEGORIES, ELIGIBILITY_RULES, evaluateEligibility } from './eligibility';
import { GOV_RULES, evaluateGovernment } from './government';
import { DEMO, DEMO_SMS_CODE, demoIban } from './mock';
import { buildOffer, pricingSub } from './pricing';
import { HARD_BLOCKS, RISK_CONFIG, assessRisk } from './risk';
import { SCENARIOS, scenarioById } from './scenarios';
import {
  addEvidence, agreeAndSubmit, asksPrerequisite, cancelEdit, capturesNotEligible, confirmCertificate, confirmOffer, continueAfterNafath, continueFromReview, continueToNafath,
  existenceFor, finishIbanCheck, firstIncomplete, goLive, initialSim, initialState, leaveSession, loadCertificates, nafathResult, openContinueLink, prefill,
  reviewerBack, reviewerBackTarget, requestRateReview, resendOtp, routeFor, runBusinessVerification, runCertificatePrecheck, salesRecoverCr, selectPerson, sendContinueLink,
  sendToNafath, setIban, setIdentity, setKyb, setPresence, setReviewStatus, startEdit, startIbanCheck, startMobileChange, submitBusiness, submitIdentify,
  submitKyb, submitMobileChange, verifyOtp, withSaved
} from './state';
import type { Kyb, ProposedState, Sim } from './types';
import { validateMapsUrl, validateWebsite } from './urls';
import { callsSince } from './verifications';

const otp = (s: ProposedState) => verifyOtp(s, DEMO_SMS_CODE);
const calls = (s: ProposedState, from = 0) => callsSince(s.app, from).map((e) => e.check);
const paid = (s: ProposedState, from = 0) => calls(s, from).filter((c) => c !== 'OTP');
const simWith = (patch: Partial<Sim> = {}, cr: Partial<Sim['cr']> = {}): Sim => { const b = initialSim(); return { ...b, ...patch, cr: { ...b.cr, ...cr } }; };

const CR_KYB: Kyb = { kind: 'CR', group: 'food', sub: 'food-cafe', revenue: 'MID_BAND', channel: 'both' };
const FL_KYB: Kyb = { kind: 'FL_CERT', group: 'services', sub: 'services-design', revenue: 'MID_BAND', channel: 'online' };

/** Page 1 → Page 2 → OTP on a fresh browser state. */
function apply(kyb: Kyb, who: { identifier?: string; mobile?: string; prerequisite?: 'yes' | 'no' } = {}, sim: Sim = initialSim(), base?: ProposedState): ProposedState {
  let s: ProposedState = base ? { ...leaveSession(base), sim } : { ...initialState(), sim };
  s = submitKyb(setKyb(s, kyb));
  s = setIdentity(s, { identifier: who.identifier ?? (kyb.kind === 'CR' ? DEMO.cr : DEMO.nationalId), mobile: who.mobile ?? DEMO.mobile, prerequisite: who.prerequisite ?? 'yes' });
  return submitIdentify(s);
}

describe('Page 1 — Know Your Business', () => {
  it('starts on KYB and asks only type, category, subcategory, revenue and channel', () => {
    const s = initialState();
    expect(s.app.step).toBe('kyb');
    expect(STAGES[0].label).toBe('Know Your Business');
    expect(Object.keys(s.app.kyb).sort()).toEqual(['channel', 'group', 'kind', 'revenue', 'sub']);
  });

  it('all five answers are required; no website or Maps link is needed', () => {
    const missing = submitKyb(setKyb(initialState(), { ...CR_KYB, channel: null }));
    expect(missing.app.step).toBe('kyb');
    const ok = submitKyb(setKyb(initialState(), CR_KYB));
    expect(ok.app.step).toBe('identify');
    expect(paid(ok)).toEqual([]);
    expect(calls(ok)).toEqual([]);
  });

  it('only two outcomes, Eligible / Not Eligible; revenue never changes the result', () => {
    const e = (kind: Kyb['kind'], sub: string, revenue: Kyb['revenue'] = 'MID_BAND', channel: Kyb['channel'] = 'online') => evaluateEligibility({ kind: kind!, sub, revenue: revenue!, channel: channel! });
    expect(new Set(ELIGIBILITY_RULES.map((r) => r.result))).toEqual(new Set(['ELIGIBLE', 'NOT_ELIGIBLE']));
    for (const revenue of REVENUE_OPTIONS.map((o) => o.value)) {
      expect(e('CR', 'retail-fashion', revenue)).toMatchObject({ result: 'ELIGIBLE', notEligibleAt: null });
      expect(e('FL_CERT', 'services-design', revenue)).toMatchObject({ result: 'ELIGIBLE', notEligibleAt: null });
    }
    // No rule reads revenue: every applicant / category / channel gives the same result in every band.
    for (const kind of ['CR', 'FL_CERT', 'FL_NO_CERT'] as const) for (const g of CATEGORIES) for (const sub of g.subs) for (const channel of ['online', 'offline', 'both'] as const) {
      const results = REVENUE_OPTIONS.map((o) => e(kind, sub.id, o.value, channel)).map((r) => `${r.result}:${r.reason}`);
      expect(new Set(results).size, `${kind} ${sub.id} ${channel}`).toBe(1);
    }
    expect(e('CR', 'fixture-blocked')).toMatchObject({ result: 'NOT_ELIGIBLE', notEligibleAt: 'AFTER_OTP', reason: 'CATEGORY_NOT_SUPPORTED' });
    expect(e('FL_CERT', 'food-cafe')).toMatchObject({ result: 'NOT_ELIGIBLE', notEligibleAt: 'AFTER_OTP', reason: 'ACTIVITY_REQUIRES_CR' });
    expect(e('FL_CERT', 'retail-electronics', 'MID_BAND', 'offline').reason).toBe('CHANNEL_NOT_SUPPORTED');
    expect(e('FL_NO_CERT', 'services-design')).toMatchObject({ result: 'NOT_ELIGIBLE', notEligibleAt: 'KYB', reason: 'FL_CERT_REQUIRED' });
    // Gold & jewellery is prohibited for both types: a Freelancer is not told to get a CR for it.
    expect(e('FL_CERT', 'retail-jewelry').reason).toBe('REGULATORY_RESTRICTION');
  });

  it('Freelancer without certificate: Not Eligible directly on Page 1 — no Identify, no National ID, no OTP, no call', () => {
    const s = submitKyb(setKyb(initialState(), { ...FL_KYB, kind: 'FL_NO_CERT' }));
    expect(s.app).toMatchObject({ step: 'outcome', outcome: 'NOT_ELIGIBLE', status: 'NOT_ELIGIBLE', outcomeReason: 'FL_CERT_REQUIRED', id: null });
    expect(s.app.identity.identifier).toBe('');
    expect(s.backend.sms).toEqual([]);
    expect(calls(s)).toEqual([]);
  });

  it('an unsupported category is NOT stopped on Page 1: it continues to Identify, with no prerequisite question', () => {
    for (const kind of ['CR', 'FL_CERT'] as const) {
      const s = submitKyb(setKyb(initialState(), { ...(kind === 'CR' ? CR_KYB : FL_KYB), group: 'fixture', sub: 'fixture-blocked' }));
      expect(s.app.step).toBe('identify');
      expect(s.app.outcome).toBeNull();
      expect(capturesNotEligible(s.app)).toBe(true);
      expect(asksPrerequisite(s.app)).toBe(false);
      expect(calls(s)).toEqual([]);
    }
  });
});

describe('Page 2 — identifier, mobile, prerequisite; existence check before OTP', () => {
  it('a new identifier: internal existence check, then OTP to the ENTERED mobile; nothing paid', () => {
    const s = apply(CR_KYB);
    expect(s.app.step).toBe('otp');
    expect(s.app.existence).toBe('new');
    expect(s.app.otp).toMatchObject({ purpose: 'application', to: DEMO.mobile });
    expect(s.app.ledger.some((l) => l.check === 'EXISTENCE' && l.kind === 'internal')).toBe(true);
    expect(paid(s)).toEqual([]);
    expect(s.app.id).toBeNull();
  });

  it('the application is created only after OTP; contact mobile verified ≠ authorised-person mobile verified', () => {
    const s = otp(apply(CR_KYB));
    expect(s.app.id).toMatch(/^APP-/);
    expect(s.app.kybSnapshot?.sub).toBe('food-cafe');
    expect(s.app.contactMobileVerified).toBe(true);
    expect(s.app.authorizedMobileVerified).toBe(false);
    expect(s.app.registeredMobile).toBe(DEMO.mobile);
    expect(s.app.status).toBe('DRAFT');
    expect(s.app.step).toBe('persons');
  });

  it('CR owner / manager = No: Not Eligible after OTP with a personalised reason, before any paid check', () => {
    const s = otp(apply(CR_KYB, { prerequisite: 'no' }));
    expect(s.app.outcome).toBe('NOT_ELIGIBLE');
    expect(s.app.outcomeReason).toBe('NOT_OWNER_MANAGER');
    expect(paid(s)).toEqual([]);
  });

  it('Freelancer IBAN linked = No: Not Eligible with the linkage instruction, before any paid check', () => {
    const s = otp(apply(FL_KYB, { prerequisite: 'no' }));
    expect(s.app.outcome).toBe('NOT_ELIGIBLE');
    expect(s.app.outcomeReason).toBe('FL_IBAN_NOT_LINKED');
    expect(paid(s)).toEqual([]);
  });

  it('the identify page is throttled after the configured number of submissions (rate limit)', () => {
    let s = submitKyb(setKyb(initialState(), CR_KYB));
    s = setIdentity(s, { identifier: DEMO.cr, mobile: DEMO.mobile, prerequisite: 'yes' });
    for (let i = 0; i < LIMITS.identifyChecksPerSession; i++) s = { ...submitIdentify(s), app: { ...submitIdentify(s).app, step: 'identify' } };
    expect(submitIdentify(s).app.throttled).toBe(true);
    expect(submitIdentify({ ...s, sim: { ...s.sim, rateLimited: true }, app: { ...s.app, identifyChecks: 0 } }).app.throttled).toBe(true);
  });
});

describe('Not Eligible after Identify + OTP (unsupported category)', () => {
  it.each([['CR', CR_KYB], ['FL_CERT', FL_KYB]] as const)('%s: OTP to the entered mobile, details saved, Not Eligible; no paid verification', (_, kyb) => {
    const sent = apply({ ...kyb, group: 'fixture', sub: 'fixture-blocked' }, { prerequisite: undefined });
    expect(sent.app.step).toBe('otp');
    expect(sent.app.otp).toMatchObject({ purpose: 'application', to: DEMO.mobile });
    const s = otp(sent);
    expect(s.app).toMatchObject({ step: 'outcome', outcome: 'NOT_ELIGIBLE', status: 'NOT_ELIGIBLE', outcomeReason: 'CATEGORY_NOT_SUPPORTED', contactMobileVerified: true, registeredMobile: DEMO.mobile });
    expect(s.app.id).toMatch(/^APP-/);
    expect(s.backend.notEligible).toHaveLength(1);
    expect(s.backend.notEligible[0]).toMatchObject({ identifier: kyb.kind === 'CR' ? DEMO.cr : DEMO.nationalId, mobile: DEMO.mobile, reason: 'CATEGORY_NOT_SUPPORTED', kyb: { sub: 'fixture-blocked' } });
    // Only the OTP: no CR data, owners, mobile match, Nafath, certificate or IBAN call.
    expect(paid(s)).toEqual([]);
    expect(routeFor(s.app)).toBe('outcome');
    expect(reviewerBackTarget(s.app)).toBeNull();
  });

  it('re-entry with a saved Not Eligible record: code to the REGISTERED mobile → the Not Eligible confirmation; no new record', () => {
    const first = otp(apply({ ...CR_KYB, group: 'fixture', sub: 'fixture-blocked' }));
    const again = apply(CR_KYB, { mobile: DEMO.otherMobile }, initialSim(), first);
    expect(again.app.existence).toBe('not_eligible');
    expect(again.app.otp).toMatchObject({ purpose: 'registered', to: DEMO.mobile });
    const s = otp(again);
    expect(s.app).toMatchObject({ step: 'outcome', outcome: 'NOT_ELIGIBLE', id: first.app.id });
    expect(Object.keys(s.backend.applications)).toHaveLength(1);
  });
});

describe('Revenue never routes: every band self-onboards when otherwise eligible', () => {
  it.each(['BELOW_100K', 'MID_BAND', 'ABOVE_20M'] as const)('registered business %s → self-onboarding (DRAFT, owner / manager)', (revenue) => {
    const s = otp(apply({ ...CR_KYB, revenue }));
    expect(s.app).toMatchObject({ status: 'DRAFT', step: 'persons', outcome: null });
    expect(asksPrerequisite(submitKyb(setKyb(initialState(), { ...CR_KYB, revenue })).app)).toBe(true);
  });

  it.each(['BELOW_100K', 'ABOVE_20M'] as const)('Freelancer with certificate %s → self-onboarding (DRAFT, Nafath)', (revenue) => {
    expect(otp(apply({ ...FL_KYB, revenue })).app).toMatchObject({ status: 'DRAFT', step: 'nafath' });
  });

  it('revenue is still collected and is a risk input', () => {
    const s = otp(apply({ ...CR_KYB, revenue: 'ABOVE_20M' }));
    expect(s.app.kybSnapshot?.revenue).toBe('ABOVE_20M');
    expect(assessRisk(s.app).factors.find((f) => f.factor === 'Declared revenue')?.value).toBe('ABOVE_20M');
  });
});

describe('Existing records: registered-mobile OTP, status-aware routing', () => {
  const draft = () => withSaved(prefill('CR', 'business'));
  const submitted = () => withSaved(prefill('CR', 'status'));

  it('incomplete application + a DIFFERENT entered mobile: the code goes to the stored mobile only', () => {
    const s = apply(CR_KYB, { mobile: DEMO.otherMobile }, initialSim(), draft());
    expect(s.app.existence).toBe('incomplete');
    expect(s.app.otp).toMatchObject({ purpose: 'registered', to: DEMO.mobile });
    expect(s.backend.sms.at(-1)!.to).toBe(DEMO.mobile);
    expect(s.backend.sms.some((m) => m.to === DEMO.otherMobile)).toBe(false);
    // Without the code nothing is exposed: no application is open in this session.
    expect(s.app.id).toBeNull();
  });

  it('registered-mobile OTP resumes the first unfinished stage; nothing is re-verified', () => {
    const base = draft();
    const before = base.backend.applications[base.app.id!].ledger.length;
    const s = otp(apply(CR_KYB, { mobile: DEMO.otherMobile }, initialSim(), base));
    expect(s.app.id).toBe(base.app.id);
    expect(s.app.step).toBe('business');
    expect(paid(s, before)).toEqual([]);
    expect(s.app.ledger.filter((l) => l.kind === 'reuse').map((l) => l.check)).toEqual(expect.arrayContaining(['CR_DATA', 'PERSONS', 'NAFATH']));
    expect(s.app.registeredMobile).toBe(DEMO.mobile);
  });

  it('a failed registered-mobile OTP never opens the application and creates no other one', () => {
    const base = draft();
    let s = apply(CR_KYB, { mobile: DEMO.otherMobile }, initialSim(), base);
    for (let i = 0; i < LIMITS.otpAttempts; i++) s = verifyOtp(s, '111111');
    expect(s.app.otp.status).toBe('exhausted');
    expect(s.app.id).toBeNull();
    expect(Object.keys(s.backend.applications)).toEqual([base.app.id]);
  });

  it('submitted application: OTP opens Application Progress, never Review or Contract', () => {
    const base = submitted();
    const s = otp(apply(CR_KYB, {}, initialSim(), base));
    expect(s.app.step).toBe('status');
    expect(routeFor({ ...s.app, status: 'UNDER_REVIEW' })).toBe('status');
    expect(continueFromReview(s).app.step).toBe('status');
    expect(agreeAndSubmit({ ...s, app: { ...s.app, step: 'contract' } }).app.status).toBe('SUBMITTED');
    expect(reviewerBack(s).app.step).toBe('status');
  });

  it('live merchant: OTP to the account mobile, then login; no application is created', () => {
    const s0 = { ...initialState(), backend: { ...initialState().backend, merchants: { [DEMO.cr]: { mobile: DEMO.registeredMobile } } } };
    let s = apply(CR_KYB, { mobile: DEMO.mobile }, initialSim(), s0);
    expect(s.app.existence).toBe('live');
    expect(s.app.otp.to).toBe(DEMO.registeredMobile);
    s = otp(s);
    expect(s.app.step).toBe('login');
    expect(Object.keys(s.backend.applications)).toEqual([]);
  });

  it('forced existence from the Prototype Controls uses a stored mobile ending 123', () => {
    for (const existence of ['incomplete', 'submitted', 'live', 'not_eligible'] as const) {
      const s = apply(CR_KYB, {}, simWith({ existence }));
      expect(s.app.existence).toBe(existence);
      expect(s.app.otp.to).toBe(DEMO.registeredMobile);
      expect(otp(s).app.step).toBe({ incomplete: 'business', submitted: 'status', live: 'login', not_eligible: 'outcome' }[existence]);
    }
  });

  it('existence is an internal lookup: an identifier stopped on Page 1 left no record', () => {
    const stopped = submitKyb(setKyb(initialState(), { ...FL_KYB, kind: 'FL_NO_CERT' }));
    expect(existenceFor({ ...leaveSession(stopped), app: { ...leaveSession(stopped).app, identity: { identifier: DEMO.nationalId, mobile: DEMO.mobile, prerequisite: 'yes' } } }).existence).toBe('new');
  });
});

describe('OTP limits (not the only abuse control, but bounded)', () => {
  it('resend never restores the budget: after the last code, attempts end in a locked state', () => {
    let s = apply(CR_KYB);
    let wrong = 0;
    for (let r = 0; r <= LIMITS.otpResends; r++) {
      for (let i = 0; i < LIMITS.otpAttempts; i++) { s = verifyOtp(s, '111111'); wrong++; }
      if (r < LIMITS.otpResends) s = resendOtp(s);
    }
    expect(s.app.otp.status).toBe('locked');
    expect(wrong).toBe(LIMITS.otpAttempts * (LIMITS.otpResends + 1));
    expect(verifyOtp(s, DEMO_SMS_CODE).app.id).toBeNull();
    expect(resendOtp(s).app.otp.status).toBe('locked');
    expect(s.backend.sms.filter((m) => m.kind === 'otp')).toHaveLength(LIMITS.otpResends + 1);
  });
});

describe('Registered business: CR data, government rules, category, risk', () => {
  it('CR verification only after the new-application OTP; CR data and owners / managers retrieved once', () => {
    let s = otp(apply(CR_KYB));
    s = runBusinessVerification(s);
    expect(paid(s)).toEqual(['CR_DATA', 'PERSONS']);
    expect(s.app.persons.list.filter((p) => p.role === 'delegate')).toHaveLength(1);
    const from = s.app.ledger.length;
    s = runBusinessVerification(s);
    expect(paid(s, from)).toEqual([]);
  });

  it('owners / managers only; a CR with none blocks (the declaration is not confirmed)', () => {
    const s = runBusinessVerification(otp(apply(CR_KYB, {}, simWith({ persons: 'none' }))));
    expect(s.app.outcomeReason).toBe('NO_OWNER_MANAGER_ON_CR');
  });

  it.each([['EXPIRED', 'CR_EXPIRED'], ['SUSPENDED', 'CR_SUSPENDED']] as const)('CR %s: saved + Sales recovery; no people / Nafath / other paid call', (status, reason) => {
    const s = runBusinessVerification(otp(apply(CR_KYB, {}, simWith({}, { status }))));
    expect(s.app.status).toBe('PAUSED_CR');
    expect(s.app.outcome).toBe('PAUSED_CR');
    expect(s.app.outcomeReason).toBe(reason);
    expect(s.app.flags).toContain('SALES_FOLLOW_UP');
    expect(paid(s)).toEqual(['CR_DATA']);
    expect(s.backend.applications[s.app.id!].status).toBe('PAUSED_CR');
  });

  it('a paused application re-entered by the merchant shows the same message; only Sales re-checks the CR', () => {
    const paused = runBusinessVerification(otp(apply(CR_KYB, {}, simWith({}, { status: 'EXPIRED' }))));
    const back = otp(apply(CR_KYB, {}, paused.sim, paused));
    expect(back.app.step).toBe('outcome');
    expect(back.app.outcome).toBe('PAUSED_CR');
    const from = back.app.ledger.length;
    expect(paid(back, from)).toEqual([]);
    const recovered = runBusinessVerification(salesRecoverCr(back));
    expect(recovered.app.status).toBe('DRAFT');
    expect(paid(recovered, from)).toEqual(['CR_DATA', 'PERSONS']);
  });

  it('CR age is a risk attribute, never a rejection', () => {
    const young = runBusinessVerification(otp(apply(CR_KYB, {}, simWith({}, { ageMonths: 2 }))));
    expect(young.app.status).toBe('DRAFT');
    expect(young.app.persons.status).toBe('loaded');
    expect(young.app.risk?.factors.find((f) => f.factor === 'CR age')?.points).toBe(RISK_CONFIG.crAge[0].points);
    const old = runBusinessVerification(otp(apply(CR_KYB)));
    expect(young.app.risk!.score).toBeGreaterThan(old.app.risk!.score);
    expect(Object.keys(GOV_RULES)).not.toContain('minCrAgeMonths');
    expect(evaluateGovernment({ ...young.app.cr.record!, ageMonths: 1 }).action).toBe('continue');
  });

  it('hard blocks and risk are separate: no hard-block reason is ever produced by the risk score', () => {
    expect(HARD_BLOCKS.map((h) => h.reason)).toEqual(expect.arrayContaining(['CR_EXPIRED', 'CR_SUSPENDED', 'NOT_OWNER_MANAGER', 'FL_IBAN_NOT_LINKED']));
    const risk = assessRisk({ ...prefill('CR', 'review'), cr: { ...prefill('CR', 'review').cr, record: { ...prefill('CR', 'review').cr.record!, ageMonths: 1, entity: 'NON_SAUDI', nationalAddress: 'MISSING' } } });
    expect(risk.level).toBe('HIGH');
  });

  it('multiple CR activities are supported; government activity is authoritative and prices the offer', () => {
    // Declared café, registered: management consultancy (primary) + general trade.
    const s = runBusinessVerification(otp(apply(CR_KYB, {}, simWith({}, { activities: ['ACT-7020', 'ACT-4719'] }))));
    expect(s.app.cr.record!.activities).toHaveLength(2);
    expect(s.app.categoryCheck).toMatchObject({ declaredSub: 'food-cafe', verifiedSub: 'services-consulting', outcome: 'RECLASSIFIED' });
    expect(pricingSub(s.app)).toBe('services-consulting');
    expect(buildOffer(s.app).standardRate).toBe(7.5);
    expect(s.app.flags).toContain('CATEGORY_RECLASSIFIED');
  });

  it('a declared category matching ANY activity is confirmed; a regulated activity blocks whatever was declared', () => {
    expect(deriveCategory('CR', 'food-cafe', 'CR', [{ code: 'ACT-4719', primary: true }, { code: 'ACT-5610', primary: false }]).check.outcome).toBe('CONFIRMED');
    expect(deriveCategory('CR', 'retail-fashion', 'CR', [{ code: 'ACT-4771', primary: true }, { code: 'ACT-4777', primary: false }]).block).toBe('ACTIVITY_REGULATED');
    expect(deriveCategory('CR', 'food-cafe', 'CR', [{ code: 'ACT-9999', primary: true }]).check.outcome).toBe('UNMAPPED');
  });

  it('after verification the declared category cannot be edited: no bypass of the government activity', () => {
    const s = withSaved(prefill('CR', 'review'));
    expect(setKyb(s, { group: 'services', sub: 'services-consulting' }).app.kyb.sub).toBe('food-cafe');
    expect(startEdit(s, 'applicant')).toBe(s);
    expect(startEdit(s, 'verified')).toBe(s);
    expect(submitKyb(s)).toBe(s);
  });
});

describe('Mobile ↔ National ID before Nafath', () => {
  const atNafath = (sim: Sim) => continueToNafath(selectPerson(runBusinessVerification(otp(apply(CR_KYB, {}, sim))), 'p1'));

  it('match → Nafath request; the authorised-person mobile is now verified', () => {
    const s = sendToNafath(atNafath(initialSim()));
    expect(paid(s)).toEqual(['CR_DATA', 'PERSONS', 'MOBILE_MATCH', 'NAFATH']);
    expect(s.app.authorizedMobileVerified).toBe(true);
    expect(s.app.nafath.status).toBe('waiting');
  });

  it('mismatch blocks Nafath; the new mobile needs an OTP; a new match continues; CR progress is kept', () => {
    let s = sendToNafath(atNafath(simWith({ mobileMatch: ['mismatch', 'match'] })));
    expect(s.app.mobileMatch.status).toBe('mismatch');
    expect(calls(s)).not.toContain('NAFATH');
    const crCalls = paid(s).filter((c) => c === 'CR_DATA' || c === 'PERSONS').length;
    s = submitMobileChange(startMobileChange(s), DEMO.otherMobile);
    expect(s.app.step).toBe('otp');
    expect(s.app.otp).toMatchObject({ purpose: 'mobile-change', to: DEMO.otherMobile });
    expect(s.app.registeredMobile).toBe(DEMO.mobile);
    s = otp(s);
    expect(s.app.registeredMobile).toBe(DEMO.otherMobile);
    expect(s.app.authorizedMobileVerified).toBe(true);
    expect(s.app.nafath.status).toBe('waiting');
    expect(s.app.persons.selectedId).toBe('p1');
    expect(s.app.cr.record).not.toBeNull();
    expect(paid(s).filter((c) => c === 'CR_DATA' || c === 'PERSONS').length).toBe(crCalls);
  });

  it('still a mismatch after the correction: verification paused, nothing lost, no Nafath call', () => {
    let s = sendToNafath(atNafath(simWith({ mobileMatch: ['mismatch', 'mismatch'] })));
    s = otp(submitMobileChange(startMobileChange(s), DEMO.otherMobile));
    expect(s.app.mobileMatch.status).toBe('blocked');
    expect(s.app.flags).toContain('MOBILE_OWNERSHIP_UNVERIFIED');
    expect(calls(s)).not.toContain('NAFATH');
    expect(s.app.status).toBe('DRAFT');
    expect(sendToNafath(s).app.ledger.length).toBe(s.app.ledger.length);
  });

  it('the Freelancer gets the same check on their own National ID', () => {
    let s = otp(apply(FL_KYB, {}, simWith({ mobileMatch: ['mismatch'] })));
    s = sendToNafath(runCertificatePrecheck(s));
    expect(s.app.mobileMatch.status).toBe('mismatch');
    expect(calls(s)).not.toContain('NAFATH');
  });
});

describe('Freelancer: certificate pre-check before Nafath (cost order)', () => {
  it('rule flag on: certificate existence is checked before any Nafath call', () => {
    expect(RULE_FLAGS.flCertificatePrecheckBeforeNafath).toBe(true);
    let s = otp(apply(FL_KYB));
    expect(sendToNafath(s).app.ledger.length).toBe(s.app.ledger.length); // Nafath waits for the pre-check
    s = sendToNafath(runCertificatePrecheck(s));
    expect(paid(s)).toEqual(['FL_CERTS', 'MOBILE_MATCH', 'NAFATH']);
  });

  it('no certificate → Not Eligible, and NO Nafath call', () => {
    const s = runCertificatePrecheck(otp(apply(FL_KYB, {}, simWith({ certificates: 'none' }))));
    expect(s.app.outcome).toBe('NOT_ELIGIBLE');
    expect(s.app.outcomeReason).toBe('FL_CERT_NOT_FOUND');
    expect(paid(s)).toEqual(['FL_CERTS']);
    expect(s.backend.notEligible).toHaveLength(1);
  });

  it('certificate details stay hidden until Nafath; afterwards they are shown without a new call', () => {
    let s = runCertificatePrecheck(otp(apply(FL_KYB)));
    expect(loadCertificates(s).app.certs.status).toBe('idle');
    s = continueAfterNafath(nafathResult(sendToNafath(s), 'verified'));
    expect(s.app.step).toBe('certificates');
    const from = s.app.ledger.length;
    s = loadCertificates(s);
    expect(s.app.certs.status).toBe('loaded');
    expect(paid(s, from)).toEqual([]);
  });

  it('the confirmed certificate activity prices the offer; a CR-only activity blocks', () => {
    const ok = prefill('FL_CERT', 'commercial');
    expect(ok.categoryCheck).toMatchObject({ source: 'CERTIFICATE', verifiedSub: 'services-design' });
    let s = runCertificatePrecheck(otp(apply(FL_KYB, {}, simWith({ certificates: 'mismatch' }))));
    s = loadCertificates(continueAfterNafath(nafathResult(sendToNafath(s), 'verified')));
    s = confirmCertificate(s);
    expect(s.app.outcomeReason).toBe('ACTIVITY_REQUIRES_CR');
  });
});

describe('Business Details', () => {
  it('URLs are conditional on the Page-1 channel; CR has no IBAN, VAT or branch count', () => {
    const cr = withSaved(prefill('CR', 'business'));
    expect(Object.keys(cr.app.business)).not.toContain('vat');
    expect(Object.keys(cr.app.business)).not.toContain('branches');
    expect(submitBusiness(cr).app.step).toBe('business'); // both channel: website + Maps required
    const s = submitBusiness(setPresence(cr, { websiteUrl: 'najdroastery.example.com', mapsUrl: 'https://maps.app.goo.gl/abc' }));
    expect(s.app.step).toBe('commercial');
    expect(paid(s, cr.app.ledger.length)).toEqual([]);
  });

  it('Freelancer IBAN is verified (linkage); a mismatch twice needs another IBAN; technical errors do not count', () => {
    let s = withSaved(prefill('FL_CERT', 'business'), simWith({ iban: ['technical', 'mismatch', 'mismatch', 'verified'] }));
    s = setPresence(s, { websiteUrl: 'https://studio.example.com' });
    s = setIban(s, demoIban('80', '1111'));
    s = finishIbanCheck(startIbanCheck(s));
    expect(s.app.business).toMatchObject({ ibanStatus: 'failed', ibanFailures: 0 });
    s = finishIbanCheck(startIbanCheck(finishIbanCheck(startIbanCheck(s))));
    expect(s.app.business.ibanStatus).toBe('failed_final');
    expect(startIbanCheck(s)).toBe(s);
    expect(submitBusiness(s).app.step).toBe('business');
    s = finishIbanCheck(startIbanCheck(setIban(s, demoIban('80', '2222'))));
    expect(s.app.business.ibanStatus).toBe('verified');
    expect(submitBusiness(s).app.step).toBe('commercial');
  });

  it('website / Maps validation: scheme optional, Saudi and Arabic domains, Google Maps in any country domain', () => {
    expect(validateWebsite('yourstore.com')).toBeNull();
    expect(validateWebsite('https://store.salla.sa/najd')).toBeNull();
    expect(validateWebsite('https://متجر.السعودية')).toBeNull();
    expect(validateWebsite('my-store')).toBe('format');
    expect(validateWebsite('https://instagram.com/najd')).toBe('social');
    expect(validateWebsite('https://wa.me/966500000000')).toBe('whatsapp');
    expect(validateWebsite('https://bit.ly/x')).toBe('shortener');
    for (const ok of ['https://maps.google.com/?q=1,2', 'https://maps.app.goo.gl/abc', 'https://www.google.com.sa/maps/place/x', 'https://maps.google.com.sa/?q=1', 'goo.gl/maps/abc']) expect(validateMapsUrl(ok), ok).toBeNull();
    for (const bad of ['https://example.com/loc', 'https://goo.gl/forms/x', 'https://www.google.com/search?q=cafe']) expect(validateMapsUrl(bad), bad).toBe('not-maps');
  });
});

describe('Commercial Offer', () => {
  it('standard offer only: no plans; the rate comes from the verified category', () => {
    const s = confirmOffer(withSaved(prefill('CR', 'commercial')));
    expect(Object.keys(s.app.commercial.agreed!)).toEqual(['pricingVersion', 'pricingSub', 'standardRate', 'at']);
    expect(s.app.step).toBe('review');
  });

  it('rate review interest is kept without any file; files add evidence; the standard offer never waits', () => {
    let s = requestRateReview(withSaved(prefill('CR', 'commercial')));
    expect(s.app.flags).toContain('COMMERCIAL_RATE_REVIEW_REQUESTED');
    s = confirmOffer(s);
    expect(s.app.commercial.reviewRequested).toBe(true);
    expect(s.app.step).toBe('review');
    expect(addEvidence(s, 'doc-a').app.commercial.evidence).toEqual(['doc-a']);
  });
});

describe('Review: locked sections, transactional edit', () => {
  it('only store presence and the commercial review can be edited; Cancel restores everything', () => {
    const s = withSaved(prefill('CR', 'review'));
    let e = startEdit(s, 'presence');
    expect(e.app.step).toBe('business');
    e = setPresence(e, { websiteUrl: 'https://changed.example.com' });
    const c = cancelEdit(e);
    expect(c.app.business.websiteUrl).toBe(s.app.business.websiteUrl);
    expect(c.app.step).toBe('review');
    expect(c.app.verifications).toEqual(s.app.verifications);
    expect(c.app.ledger).toEqual(s.app.ledger);
  });

  it('Save applies the edit and invalidates nothing', () => {
    const s = withSaved(prefill('CR', 'review'));
    const saved = submitBusiness(setPresence(startEdit(s, 'presence'), { websiteUrl: 'https://changed.example.com' }));
    expect(saved.app.step).toBe('review');
    expect(saved.app.business.websiteUrl).toBe('https://changed.example.com');
    expect(saved.app.editBaseline).toBeNull();
    expect(saved.app.ledger.filter((l) => l.kind === 'invalidate')).toEqual([]);
  });

  it('an owner / manager cannot be changed after Nafath', () => {
    const s = withSaved(prefill('CR', 'review'));
    expect(selectPerson(s, 'p2').app.persons.selectedId).toBe('p1');
  });
});

describe('Contract, submission and Application Progress', () => {
  it('Agree & Submit submits; the submitted application never reopens Review or Contract', () => {
    let s = agreeAndSubmit(withSaved(prefill('CR', 'contract')));
    expect(s.app.outcome).toBe('SUBMITTED');
    expect(s.app.status).toBe('SUBMITTED');
    expect(routeFor(s.app)).toBe('status');
    expect(Object.keys(s.backend.tokens)).toEqual([]);
    s = setReviewStatus(s, 'APPROVED');
    expect(s.app.step).toBe('status');
    s = goLive(s);
    expect(s.app.status).toBe('LIVE');
    expect(otp(apply(CR_KYB, {}, initialSim(), s)).app.step).toBe('login');
  });

  it('there is no decline path: the contract either stays open or is agreed', () => {
    expect(Object.keys(OUTCOME_COPY)).not.toContain('CONTRACT_DECLINED');
    const s = withSaved(prefill('CR', 'contract'));
    expect(firstIncomplete(s.app)).toBe('contract');
    expect(agreeAndSubmit(s).app.outcome).toBe('SUBMITTED');
  });

  it('Nafath not verified: Review submits for manual verification without a contract', () => {
    const base = prefill('CR', 'review');
    const s = continueFromReview(withSaved({ ...base, nafath: { ...base.nafath, status: 'exhausted', verifiedFor: null }, verifications: { ...base.verifications, NAFATH: undefined } }));
    expect(s.app.outcome).toBe('SUBMITTED_MANUAL');
    expect(s.app.status).toBe('SUBMITTED');
  });
});

describe('Reviewer-only Back (Prototype Controls)', () => {
  it('steps back through a draft without changing any verification, status or saved value', () => {
    const s = withSaved(prefill('CR', 'contract'));
    const steps: string[] = [];
    let x = s;
    while (reviewerBackTarget(x.app)) { x = reviewerBack(x); steps.push(x.app.step); }
    expect(steps).toEqual(['review', 'commercial', 'business', 'nafath', 'persons']);
    const { step: _a, ...after } = x.app;
    const { step: _b, ...before } = s.app;
    expect(after).toEqual(before);
    expect(x.backend.applications[s.app.id!].verifications).toEqual(s.app.verifications);
    // Locked screens show their values: the owner cannot be changed, Nafath stays verified.
    expect(selectPerson(x, 'p2').app.persons.selectedId).toBe('p1');
    expect(x.app.nafath.status).toBe('verified');
  });

  it('Freelancer path goes back through certificate and Nafath', () => {
    let x = withSaved(prefill('FL_CERT', 'review'));
    const steps: string[] = [];
    while (reviewerBackTarget(x.app)) { x = reviewerBack(x); steps.push(x.app.step); }
    expect(steps).toEqual(['commercial', 'business', 'certificates', 'nafath']);
  });

  it('before the application exists it reopens Page 2 / Page 1; never on code screens, during an edit or after DRAFT', () => {
    const identify = submitKyb(setKyb(initialState(), CR_KYB));
    expect(reviewerBack(identify).app.step).toBe('kyb');
    const otpNew = apply(CR_KYB);
    expect(reviewerBack(otpNew).app.step).toBe('identify');
    expect(reviewerBackTarget(apply(CR_KYB, {}, simWith({ existence: 'incomplete' })).app)).toBeNull();
    expect(reviewerBackTarget(startEdit(withSaved(prefill('CR', 'review')), 'presence').app)).toBeNull();
    expect(reviewerBackTarget(withSaved(prefill('CR', 'status')).app)).toBeNull();
    const stopped = submitKyb(setKyb(initialState(), { ...FL_KYB, kind: 'FL_NO_CERT' }));
    expect(reviewerBack(stopped).app).toMatchObject({ step: 'kyb', outcome: null, status: 'QUALIFICATION' });
  });

  it('re-submitting Page 2 after stepping back cannot create a second application', () => {
    const s = withSaved(prefill('CR', 'business'));
    expect(submitIdentify({ ...s, app: { ...s.app, step: 'identify' } })).toEqual({ ...s, app: { ...s.app, step: 'identify' } });
  });
});

describe('Continue link resume', () => {
  it('Save & exit → link → OTP to the registered mobile → first unfinished stage; ordinary resume costs one OTP', () => {
    let s = sendContinueLink(withSaved(prefill('CR', 'commercial')));
    const token = Object.keys(s.backend.tokens)[0];
    s = openContinueLink(leaveSession(s), token);
    expect(s.app.otp).toMatchObject({ purpose: 'resume', to: DEMO.mobile });
    const from = s.app.ledger.length - 1;
    s = otp(s);
    expect(s.app.step).toBe('commercial');
    expect(calls(s, from)).toEqual(['OTP']);
  });

  it('provider outage retries reset on resume (no permanent dead end)', () => {
    let s = otp(apply(CR_KYB, {}, simWith({}, { result: 'unavailable' })));
    for (let i = 0; i <= LIMITS.providerRetries; i++) s = runBusinessVerification(s);
    expect(s.app.cr.tries).toBe(LIMITS.providerRetries + 1);
    s = sendContinueLink(s);
    s = otp(openContinueLink(leaveSession(s), Object.keys(s.backend.tokens)[0]));
    expect(s.app.cr).toMatchObject({ status: 'idle', tries: 0 });
    expect(s.app.step).toBe('persons');
  });
});

describe('scenarios', () => {
  it('every catalogue scenario builds', () => {
    for (const sc of SCENARIOS) expect(() => sc.build(), sc.id).not.toThrow();
    expect(scenarioById('cr-happy')).not.toBeNull();
  });

  it('saved states survive a JSON round trip (localStorage persistence)', () => {
    for (const sc of SCENARIOS) {
      const s = sc.build();
      expect(JSON.parse(JSON.stringify(s)), sc.id).toEqual(s);
    }
  });
});
