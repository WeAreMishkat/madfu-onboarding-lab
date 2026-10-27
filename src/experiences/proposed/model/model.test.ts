import { describe, expect, it } from 'vitest';
import { deriveCategory } from './activity';
import { DAY_MS, HANDOFF_RULES, LIMITS, REVENUE_OPTIONS, STAGES } from './config';
import { OUTCOME_COPY, PREPARER_AUTH_VIEW, customerStatus } from './copy';
import { CATEGORIES, ELIGIBILITY_RULES, evaluateEligibility } from './eligibility';
import { GOV_RULES, evaluateGovernment } from './government';
import { DEMO, DEMO_SMS_CODE, demoIban } from './mock';
import { buildOffer, pricingSub } from './pricing';
import { HARD_BLOCKS, RISK_CONFIG, assessRisk } from './risk';
import { SCENARIOS, scenarioById } from './scenarios';
import {
  activeVersion, addEvidence, agreeAndSubmit, asksPrerequisite, authorizeSelf, canStartHandoff, cancelEdit, capturesNotEligible, checkExpiry, chooseAuthMode,
  confirmCertificate, confirmOffer, contractEligible, continueAfterNafath, continueFromCr, continueFromReview, createHandoff, currentVersion, delegationResult,
  existenceFor, finishIbanCheck, firstIncomplete, goLive, initialSim, initialState, isFrozen, latestSignerToken, leaveSession, loadCertificates, manualUnlock,
  nafathResult, openContinueLink, openDelegation, openSignerLink, prefill, requestRateReview, resendOtp, restartAuthorization, reviewerBack, reviewerBackTarget,
  routeFor, runBusinessVerification, salesRecoverCr, selectPerson, sendContinueLink, sendToNafath, setDelegationType, setIban, setIdentity, setKyb, setPresence,
  setReviewStatus, signerStartNafath, startEdit, startIbanCheck, startMobileChange, submitBusiness, submitIdentify, submitKyb, submitMobileChange, verifyOtp,
  withHandoff, withSaved, withdrawRateReview
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

/** CR at the Authorization choice, signer p2 + the demo signer mobile, handoff at `at`. */
const handoffAt = (at = Date.now(), sim: Sim = initialSim()) => withHandoff(at, withSaved(prefill('CR', 'authorize'), sim));
/** The signer opens the newest link in a NEW session. */
const signerOpens = (s: ProposedState, at = Date.now()) => openSignerLink(leaveSession(s), latestSignerToken(s)!, at);
/** The signer reaches the read-only review (Nafath verified in this session). */
const signerAtReview = (s: ProposedState) => continueAfterNafath(nafathResult(signerStartNafath(signerOpens(s)), 'verified'));
/** Everything the merchant can read on the outcome / status / signer pages (copy only). */
const merchantCopy = () => Object.values(OUTCOME_COPY).flatMap((c) => [c.title, c.body]).join(' | ');

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

  it('two internal outcomes, Eligible / Not Eligible; revenue never changes the result', () => {
    const e = (kind: Kyb['kind'], sub: string, revenue: Kyb['revenue'] = 'MID_BAND', channel: Kyb['channel'] = 'online') => evaluateEligibility({ kind: kind!, sub, revenue: revenue!, channel: channel! });
    expect(new Set(ELIGIBILITY_RULES.map((r) => r.result))).toEqual(new Set(['ELIGIBLE', 'NOT_ELIGIBLE']));
    for (const revenue of REVENUE_OPTIONS.map((o) => o.value)) {
      expect(e('CR', 'retail-fashion', revenue)).toMatchObject({ result: 'ELIGIBLE' });
      expect(e('FL_CERT', 'services-design', revenue)).toMatchObject({ result: 'ELIGIBLE' });
    }
    for (const kind of ['CR', 'FL_CERT', 'FL_NO_CERT'] as const) for (const g of CATEGORIES) for (const sub of g.subs) for (const channel of ['online', 'offline', 'both'] as const) {
      const results = REVENUE_OPTIONS.map((o) => e(kind, sub.id, o.value, channel)).map((r) => `${r.result}:${r.reason}`);
      expect(new Set(results).size, `${kind} ${sub.id} ${channel}`).toBe(1);
    }
    expect(e('CR', 'fixture-blocked')).toMatchObject({ result: 'NOT_ELIGIBLE', reason: 'CATEGORY_NOT_SUPPORTED' });
    expect(e('FL_CERT', 'food-cafe')).toMatchObject({ result: 'NOT_ELIGIBLE', reason: 'ACTIVITY_REQUIRES_CR' });
    expect(e('FL_CERT', 'retail-electronics', 'MID_BAND', 'offline').reason).toBe('CHANNEL_NOT_SUPPORTED');
    expect(e('FL_NO_CERT', 'services-design')).toMatchObject({ result: 'NOT_ELIGIBLE', reason: 'FL_CERT_REQUIRED' });
    expect(e('FL_CERT', 'retail-jewelry').reason).toBe('REGULATORY_RESTRICTION');
  });

  it('nobody stops on Page 1: Not Eligible continues to Identify with a neutral page and no question', () => {
    for (const kyb of [{ ...CR_KYB, group: 'fixture', sub: 'fixture-blocked' }, { ...FL_KYB, group: 'fixture', sub: 'fixture-blocked' }, { ...FL_KYB, kind: 'FL_NO_CERT' as const }]) {
      const s = submitKyb(setKyb(initialState(), kyb));
      expect(s.app.step).toBe('identify');
      expect(s.app.outcome).toBeNull();
      expect(capturesNotEligible(s.app)).toBe(true);
      expect(asksPrerequisite(s.app)).toBe(false);
      expect(calls(s)).toEqual([]);
    }
  });
});

describe('Page 2 — identifier, mobile; existence check before OTP', () => {
  it('a new identifier: internal existence check, then OTP to the ENTERED mobile; nothing paid', () => {
    const s = apply(CR_KYB);
    expect(s.app.step).toBe('otp');
    expect(s.app.existence).toBe('new');
    expect(s.app.otp).toMatchObject({ purpose: 'application', to: DEMO.mobile });
    expect(s.app.ledger.some((l) => l.check === 'EXISTENCE' && l.kind === 'internal')).toBe(true);
    expect(paid(s)).toEqual([]);
    expect(s.app.id).toBeNull();
  });

  it('a registered business is not asked whether it is an owner / manager (authorization comes after Review)', () => {
    expect(asksPrerequisite(submitKyb(setKyb(initialState(), CR_KYB)).app)).toBe(false);
    expect(asksPrerequisite(submitKyb(setKyb(initialState(), FL_KYB)).app)).toBe(true);
    // A "No" left over in state changes nothing for a CR.
    expect(otp(apply(CR_KYB, { prerequisite: 'no' })).app).toMatchObject({ status: 'DRAFT', step: 'cr' });
  });

  it('the application is created only after OTP; contact mobile verified ≠ authorised-person mobile verified', () => {
    const s = otp(apply(CR_KYB));
    expect(s.app.id).toMatch(/^APP-/);
    expect(s.app.kybSnapshot?.sub).toBe('food-cafe');
    expect(s.app.contactMobileVerified).toBe(true);
    expect(s.app.authorizedMobileVerified).toBe(false);
    expect(s.app.registeredMobile).toBe(DEMO.mobile);
    expect(s.app.status).toBe('DRAFT');
    expect(s.app.step).toBe('cr');
  });

  it('Freelancer IBAN linked = No: captured internally, Application submitted, before any paid check', () => {
    const s = otp(apply(FL_KYB, { prerequisite: 'no' }));
    expect(s.app).toMatchObject({ outcome: 'RECEIVED', status: 'NOT_ELIGIBLE', outcomeReason: 'FL_IBAN_NOT_LINKED' });
    expect(paid(s)).toEqual([]);
  });

  it('the identify page is throttled after the configured number of submissions (rate limit)', () => {
    let s = submitKyb(setKyb(initialState(), CR_KYB));
    s = setIdentity(s, { identifier: DEMO.cr, mobile: DEMO.mobile, prerequisite: null });
    for (let i = 0; i < LIMITS.identifyChecksPerSession; i++) s = { ...submitIdentify(s), app: { ...submitIdentify(s).app, step: 'identify' } };
    expect(submitIdentify(s).app.throttled).toBe(true);
    expect(submitIdentify({ ...s, sim: { ...s.sim, rateLimited: true }, app: { ...s.app, identifyChecks: 0 } }).app.throttled).toBe(true);
  });
});

describe('Not Eligible Application — internal only, the merchant sees a normal submission', () => {
  it.each([
    ['CR unsupported category', { ...CR_KYB, group: 'fixture', sub: 'fixture-blocked' }, 'CATEGORY_NOT_SUPPORTED'],
    ['Freelancer unsupported category', { ...FL_KYB, group: 'fixture', sub: 'fixture-blocked' }, 'CATEGORY_NOT_SUPPORTED'],
    ['Freelancer without certificate', { ...FL_KYB, kind: 'FL_NO_CERT' }, 'FL_CERT_REQUIRED'],
    ['Freelancer in a CR-only category', { ...FL_KYB, group: 'food', sub: 'food-cafe' }, 'ACTIVITY_REQUIRES_CR']
  ] as const)('%s → Identify → OTP → captured → "Application submitted"; reason internal; no paid check', (_, kyb, reason) => {
    const sent = apply(kyb as Kyb, { prerequisite: undefined });
    expect(sent.app.otp).toMatchObject({ purpose: 'application', to: DEMO.mobile });
    const s = otp(sent);
    expect(s.app).toMatchObject({ step: 'outcome', outcome: 'RECEIVED', status: 'NOT_ELIGIBLE', outcomeReason: reason, contactMobileVerified: true });
    expect(s.backend.notEligible).toHaveLength(1);
    expect(s.backend.notEligible[0]).toMatchObject({ reason, mobile: DEMO.mobile });
    // The merchant sees exactly the normal submitted page; nothing says rejected / not eligible.
    expect(OUTCOME_COPY.RECEIVED.title).toBe(OUTCOME_COPY.SUBMITTED.title);
    expect(OUTCOME_COPY.RECEIVED.body).toBe(OUTCOME_COPY.SUBMITTED.body);
    expect(paid(s)).toEqual([]);
    expect(reviewerBackTarget(s.app)).toBeNull();
  });

  it('merchant-facing copy never says rejected / blacklisted / blocked / not eligible', () => {
    expect(merchantCopy()).not.toMatch(/reject|blacklist|blocked|not eligible|ineligible/i);
  });

  it('re-entry: code to the STORED mobile → Application Progress “Under review”; no new record, no reason', () => {
    const first = otp(apply({ ...CR_KYB, group: 'fixture', sub: 'fixture-blocked' }));
    const again = apply(CR_KYB, { mobile: DEMO.otherMobile }, initialSim(), first);
    expect(again.app.existence).toBe('not_eligible');
    expect(again.app.otp).toMatchObject({ purpose: 'registered', to: DEMO.mobile });
    const s = otp(again);
    expect(s.app).toMatchObject({ step: 'status', status: 'NOT_ELIGIBLE', id: first.app.id });
    expect(customerStatus(s.app.status)).toBe('UNDER_REVIEW');
    expect(Object.keys(s.backend.applications)).toHaveLength(1);
  });

  it('mid-flow not-eligible results are captured the same way (regulated CR activity, no owner, no certificate)', () => {
    expect(runBusinessVerification(otp(apply(CR_KYB, {}, simWith({}, { activities: ['ACT-5630', 'ACT-4777'] })))).app).toMatchObject({ outcome: 'RECEIVED', outcomeReason: 'ACTIVITY_REGULATED' });
    expect(runBusinessVerification(otp(apply(CR_KYB, {}, simWith({ persons: 'none' })))).app).toMatchObject({ outcome: 'RECEIVED', outcomeReason: 'NO_OWNER_MANAGER_ON_CR' });
    expect(loadCertificates(otp(apply(FL_KYB, {}, simWith({ certificates: 'none' })))).app).toMatchObject({ outcome: 'RECEIVED', outcomeReason: 'FL_CERT_NOT_FOUND' });
  });
});

describe('Revenue never routes: every band self-onboards when otherwise eligible', () => {
  it.each(['BELOW_100K', 'MID_BAND', 'ABOVE_20M'] as const)('registered business %s → self-onboarding (DRAFT, CR verification)', (revenue) => {
    expect(otp(apply({ ...CR_KYB, revenue })).app).toMatchObject({ status: 'DRAFT', step: 'cr', outcome: null });
  });

  it.each(['BELOW_100K', 'ABOVE_20M'] as const)('Freelancer with certificate %s → self-onboarding (DRAFT, certificate)', (revenue) => {
    expect(otp(apply({ ...FL_KYB, revenue })).app).toMatchObject({ status: 'DRAFT', step: 'certificates' });
  });

  it('revenue is still collected and is a risk input', () => {
    const s = otp(apply({ ...CR_KYB, revenue: 'ABOVE_20M' }));
    expect(s.app.kybSnapshot?.revenue).toBe('ABOVE_20M');
    expect(assessRisk(s.app).factors.find((f) => f.factor === 'Declared revenue')?.value).toBe('ABOVE_20M');
  });
});

describe('Existing records: stored-mobile OTP, lifecycle-aware routing', () => {
  const draftCr = () => withSaved(prefill('CR', 'business'));
  const draftFl = () => withSaved(prefill('FL_CERT', 'nafath'));
  const submitted = () => withSaved(prefill('CR', 'status'));

  it('resume blocks a different entered mobile: the code goes to the stored mobile only and the new mobile is never used', () => {
    const s = apply(CR_KYB, { mobile: DEMO.otherMobile }, initialSim(), draftCr());
    expect(s.app.existence).toBe('incomplete');
    expect(s.app.enteredMobileIgnored).toBe(true);
    expect(s.app.otp).toMatchObject({ purpose: 'registered', to: DEMO.mobile });
    expect(s.backend.sms.some((m) => m.to === DEMO.otherMobile)).toBe(false);
    expect(s.app.id).toBeNull();
    // No path switches the code to the new mobile on a registered-mobile code screen.
    expect(startMobileChange(s)).toBe(s);
    const opened = otp(s);
    expect(opened.app.registeredMobile).toBe(DEMO.mobile);
    expect(opened.app.identity.mobile).toBe(DEMO.mobile);
  });

  it('existing CR resumes at the first unfinished CR step; nothing is re-verified', () => {
    const base = draftCr();
    const before = base.backend.applications[base.app.id!].ledger.length;
    const s = otp(apply(CR_KYB, { mobile: DEMO.otherMobile }, initialSim(), base));
    expect(s.app.id).toBe(base.app.id);
    expect(s.app.step).toBe('business');
    expect(paid(s, before)).toEqual([]);
    expect(s.app.ledger.filter((l) => l.kind === 'reuse').map((l) => l.check)).toEqual(expect.arrayContaining(['CR_DATA', 'PERSONS']));
    expect(Object.keys(s.backend.applications)).toHaveLength(1);
  });

  it('existing Freelancer resumes at the first unfinished Freelancer step (Nafath after the certificate)', () => {
    const base = draftFl();
    const s = otp(apply(FL_KYB, {}, initialSim(), base));
    expect(s.app.id).toBe(base.app.id);
    expect(s.app.step).toBe('nafath');
    expect(s.app.categoryCheck?.source).toBe('CERTIFICATE');
    expect(firstIncomplete(withSaved(prefill('FL_CERT', 'business')).app)).toBe('business');
    expect(firstIncomplete(withSaved(prefill('FL_CERT', 'certificates')).app)).toBe('certificates');
  });

  it('a failed stored-mobile OTP never opens the application and creates no other one', () => {
    const base = draftCr();
    let s = apply(CR_KYB, { mobile: DEMO.otherMobile }, initialSim(), base);
    for (let i = 0; i < LIMITS.otpAttempts; i++) s = verifyOtp(s, '111111');
    expect(s.app.otp.status).toBe('exhausted');
    expect(s.app.id).toBeNull();
    expect(Object.keys(s.backend.applications)).toEqual([base.app.id]);
  });

  it('submitted application: OTP opens Application Progress only, never Review or Contract', () => {
    const s = otp(apply(CR_KYB, {}, initialSim(), submitted()));
    expect(s.app.step).toBe('status');
    expect(routeFor({ ...s.app, status: 'UNDER_REVIEW' })).toBe('status');
    expect(continueFromReview(s).app.step).toBe('status');
    expect(agreeAndSubmit({ ...s, app: { ...s.app, step: 'contract' } }).app.status).toBe('SUBMITTED');
    expect(reviewerBack(s).app.step).toBe('status');
    expect(startEdit(s, 'presence')).toBe(s);
  });

  it('live merchant: OTP to the account mobile, then the active-account popup step; no application is created', () => {
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
      expect(otp(s).app.step).toBe({ incomplete: 'business', submitted: 'status', live: 'login', not_eligible: 'status' }[existence]);
    }
  });

  it('a handoff in progress: the preparer re-enters to the Authorization status page (frozen)', () => {
    const h = handoffAt();
    const s = otp(apply(CR_KYB, {}, initialSim(), h));
    expect(s.app.existence).toBe('awaiting_authorization');
    expect(s.app).toMatchObject({ step: 'handoff', status: 'AWAITING_AUTHORIZATION', actor: 'preparer' });
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

describe('New Eligible CR Merchant: CR verification → details → offer → review → authorization', () => {
  it('end to end with self authorization: CR → Business Details → Offer → Review → Authorization → Nafath → Contract → Submitted', () => {
    let s = otp(apply(CR_KYB));
    s = runBusinessVerification(s);
    expect(s.app.persons.selectedId).toBeNull(); // nobody chosen at CR verification
    s = continueFromCr(s);
    expect(s.app.step).toBe('business');
    s = submitBusiness(setPresence(s, { websiteUrl: 'najd.example.com', mapsUrl: 'https://maps.app.goo.gl/abc' }));
    expect(s.app.step).toBe('commercial');
    s = confirmOffer(s);
    expect(s.app.step).toBe('review');
    s = continueFromReview(s);
    expect(s.app.step).toBe('authorize');
    expect(paid(s)).toEqual(['CR_DATA', 'PERSONS']); // no mobile match / Nafath before authorization
    s = authorizeSelf(selectPerson(chooseAuthMode(s, 'self'), 'p1'));
    expect(s.app).toMatchObject({ step: 'nafath', authorization: { mode: 'self', status: 'NAFATH_PENDING' } });
    s = continueAfterNafath(nafathResult(sendToNafath(s), 'verified'));
    expect(s.app).toMatchObject({ step: 'contract', authorization: { status: 'CONTRACT_PENDING' } });
    s = agreeAndSubmit(s);
    expect(s.app).toMatchObject({ outcome: 'SUBMITTED', status: 'SUBMITTED', authorization: { status: 'COMPLETED', versions: [] } });
    expect(paid(s)).toEqual(['CR_DATA', 'PERSONS', 'MOBILE_MATCH', 'NAFATH']);
  });

  it('CR data and owners / managers are retrieved once and reused', () => {
    let s = runBusinessVerification(otp(apply(CR_KYB)));
    expect(s.app.persons.list.filter((p) => p.role === 'delegate')).toHaveLength(1);
    const from = s.app.ledger.length;
    s = runBusinessVerification(s);
    expect(paid(s, from)).toEqual([]);
  });

  it.each([['EXPIRED', 'CR_EXPIRED'], ['SUSPENDED', 'CR_SUSPENDED']] as const)('CR %s: saved + Sales recovery (controlled state); no people / Nafath / other paid call', (status, reason) => {
    const s = runBusinessVerification(otp(apply(CR_KYB, {}, simWith({}, { status }))));
    expect(s.app).toMatchObject({ status: 'PAUSED_CR', outcome: 'PAUSED_CR', outcomeReason: reason });
    expect(s.app.flags).toContain('SALES_FOLLOW_UP');
    expect(paid(s)).toEqual(['CR_DATA']);
  });

  it('a paused application re-entered by the merchant shows the same message; only Sales re-checks the CR', () => {
    const paused = runBusinessVerification(otp(apply(CR_KYB, {}, simWith({}, { status: 'EXPIRED' }))));
    const back = otp(apply(CR_KYB, {}, paused.sim, paused));
    expect(back.app).toMatchObject({ step: 'outcome', outcome: 'PAUSED_CR' });
    const from = back.app.ledger.length;
    expect(paid(back, from)).toEqual([]);
    const recovered = runBusinessVerification(salesRecoverCr(back));
    expect(recovered.app.status).toBe('DRAFT');
    expect(recovered.app.step).toBe('cr');
    expect(paid(recovered, from)).toEqual(['CR_DATA', 'PERSONS']);
  });

  it('CR age is a risk attribute, never a rejection; the risk decision is illustrative only', () => {
    const young = runBusinessVerification(otp(apply(CR_KYB, {}, simWith({}, { ageMonths: 2 }))));
    expect(young.app.status).toBe('DRAFT');
    expect(young.app.risk?.factors.find((f) => f.factor === 'CR age')?.points).toBe(RISK_CONFIG.crAge[0].points);
    const old = runBusinessVerification(otp(apply(CR_KYB)));
    expect(young.app.risk!.score).toBeGreaterThan(old.app.risk!.score);
    expect(Object.keys(GOV_RULES)).not.toContain('minCrAgeMonths');
    expect(evaluateGovernment({ ...young.app.cr.record!, ageMonths: 1 }).action).toBe('continue');
    expect(['PROCEED_FULLY', 'PROCEED_CONTROLLED', 'HOLD']).toContain(young.app.risk!.decision);
  });

  it('hard blocks and risk are separate: no hard-block reason is ever produced by the risk score', () => {
    expect(HARD_BLOCKS.map((h) => h.reason)).toEqual(expect.arrayContaining(['CR_EXPIRED', 'CR_SUSPENDED', 'FL_IBAN_NOT_LINKED', 'FL_CERT_REQUIRED']));
    const base = prefill('CR', 'review');
    const risk = assessRisk({ ...base, cr: { ...base.cr, record: { ...base.cr.record!, ageMonths: 1, entity: 'NON_SAUDI', nationalAddress: 'MISSING' } } });
    expect(risk.level).toBe('HIGH');
    expect(risk.decision).toBe('HOLD');
  });

  it('multiple CR activities are supported; government activity is authoritative and prices the offer', () => {
    const s = runBusinessVerification(otp(apply(CR_KYB, {}, simWith({}, { activities: ['ACT-7020', 'ACT-4719'] }))));
    expect(s.app.cr.record!.activities).toHaveLength(2);
    expect(s.app.categoryCheck).toMatchObject({ declaredSub: 'food-cafe', verifiedSub: 'services-consulting', outcome: 'RECLASSIFIED' });
    expect(pricingSub(s.app)).toBe('services-consulting');
    expect(buildOffer(s.app).standardRate).toBe(7.5);
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

describe('Mobile ↔ National ID before Nafath (self authorization and Freelancer)', () => {
  const atNafath = (sim: Sim) => withSaved(prefill('CR', 'nafath'), sim);

  it('match → Nafath request; the authorised-person mobile is now verified', () => {
    const base = atNafath(initialSim());
    const s = sendToNafath(base);
    expect(paid(s, base.app.ledger.length)).toEqual(['MOBILE_MATCH', 'NAFATH']);
    expect(s.app.authorizedMobileVerified).toBe(true);
    expect(s.app.nafath.status).toBe('waiting');
  });

  it('mismatch blocks Nafath; the new mobile needs an OTP; a new match continues; CR progress is kept', () => {
    let s = sendToNafath(atNafath(simWith({ mobileMatch: ['mismatch', 'match'] })));
    expect(s.app.mobileMatch.status).toBe('mismatch');
    expect(calls(s)).not.toContain('NAFATH');
    s = submitMobileChange(startMobileChange(s), DEMO.otherMobile);
    expect(s.app.otp).toMatchObject({ purpose: 'mobile-change', to: DEMO.otherMobile });
    s = otp(s);
    expect(s.app.registeredMobile).toBe(DEMO.otherMobile);
    expect(s.app.authorizedMobileVerified).toBe(true);
    expect(s.app.nafath.status).toBe('waiting');
    expect(s.app.persons.selectedId).toBe('p1');
    expect(s.app.cr.record).not.toBeNull();
  });

  it('still a mismatch after the correction: verification paused, nothing lost, no Nafath call', () => {
    let s = sendToNafath(atNafath(simWith({ mobileMatch: ['mismatch', 'mismatch'] })));
    s = otp(submitMobileChange(startMobileChange(s), DEMO.otherMobile));
    expect(s.app.mobileMatch.status).toBe('blocked');
    expect(s.app.flags).toContain('MOBILE_OWNERSHIP_UNVERIFIED');
    expect(calls(s)).not.toContain('NAFATH');
    expect(s.app.status).toBe('DRAFT');
  });

  it('the Freelancer gets the same check on their own National ID', () => {
    const s = sendToNafath(withSaved(prefill('FL_CERT', 'nafath'), simWith({ mobileMatch: ['mismatch'] })));
    expect(s.app.mobileMatch.status).toBe('mismatch');
    expect(calls(s)).not.toContain('NAFATH');
  });

  it('Nafath failed twice (self authorization): submitted for manual verification without a contract', () => {
    let s = atNafath(simWith({ nafath: ['rejected', 'timeout'] }));
    s = nafathResult(sendToNafath(s), 'rejected');
    s = nafathResult(sendToNafath(s), 'timeout');
    expect(s.app.nafath.status).toBe('exhausted');
    s = continueAfterNafath(s);
    expect(s.app).toMatchObject({ outcome: 'SUBMITTED_MANUAL', status: 'SUBMITTED' });
  });
});

describe('New Eligible Freelancer: certificate before Nafath', () => {
  it('end to end: Certificate → mobile ↔ National ID → Nafath → Business Details → Offer → Review → Contract → Submitted', () => {
    let s = otp(apply(FL_KYB));
    expect(s.app.step).toBe('certificates');
    expect(sendToNafath(s)).toBe(s); // Nafath waits for the confirmed certificate
    s = confirmCertificate(loadCertificates(s));
    expect(s.app.step).toBe('nafath');
    s = continueAfterNafath(nafathResult(sendToNafath(s), 'verified'));
    expect(s.app.step).toBe('business');
    s = setPresence(s, { websiteUrl: 'studio.example.com' });
    s = finishIbanCheck(startIbanCheck(setIban(s, demoIban('80', '4821'))));
    s = confirmOffer(submitBusiness(s));
    s = continueFromReview(s);
    expect(s.app.step).toBe('contract');
    s = agreeAndSubmit(s);
    expect(s.app).toMatchObject({ outcome: 'SUBMITTED', status: 'SUBMITTED' });
    expect(paid(s)).toEqual(['FL_CERTS', 'MOBILE_MATCH', 'NAFATH', 'IBAN']);
  });

  it('no certificate → captured internally, and NO Nafath call', () => {
    const s = loadCertificates(otp(apply(FL_KYB, {}, simWith({ certificates: 'none' }))));
    expect(s.app).toMatchObject({ outcome: 'RECEIVED', outcomeReason: 'FL_CERT_NOT_FOUND' });
    expect(paid(s)).toEqual(['FL_CERTS']);
  });

  it('the certificate list is reused on resume and locked once Nafath is verified', () => {
    const s = withSaved(prefill('FL_CERT', 'business'));
    expect(selectCertificateLocked(s)).toBe(true);
    const from = s.app.ledger.length;
    expect(paid(loadCertificates(s), from)).toEqual([]);
  });

  it('the confirmed certificate activity prices the offer; a CR-only activity is captured internally', () => {
    expect(prefill('FL_CERT', 'commercial').categoryCheck).toMatchObject({ source: 'CERTIFICATE', verifiedSub: 'services-design' });
    const s = confirmCertificate(loadCertificates(otp(apply(FL_KYB, {}, simWith({ certificates: 'mismatch' })))));
    expect(s.app).toMatchObject({ outcome: 'RECEIVED', outcomeReason: 'ACTIVITY_REQUIRES_CR' });
  });
});

/** A certificate selection is locked once Nafath is verified. */
function selectCertificateLocked(s: ProposedState) {
  const other = { ...s, app: { ...s.app, certs: { ...s.app.certs, list: [...s.app.certs.list, { ...s.app.certs.list[0], id: 'fl9' }] } } };
  return confirmCertificate({ ...other, app: { ...other.app, certs: { ...other.app.certs, selectedId: 'fl9' } } }).app.step === other.app.step;
}

describe('Business Details', () => {
  it('URLs are conditional on the Page-1 channel; CR has no IBAN, VAT or branch count', () => {
    const cr = withSaved(prefill('CR', 'business'));
    expect(Object.keys(cr.app.business)).not.toContain('vat');
    expect(Object.keys(cr.app.business)).not.toContain('branches');
    expect(submitBusiness(cr).app.step).toBe('business');
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

  it('the authorizing owner / manager cannot be changed after Nafath', () => {
    const s = withSaved(prefill('CR', 'contract'));
    expect(selectPerson(s, 'p2').app.persons.selectedId).toBe('p1');
    expect(chooseAuthMode({ ...s, app: { ...s.app, step: 'authorize' } }, 'signer').app.authorization.mode).toBe('self');
  });
});

describe('CR authorization choice and signer handoff (Phase 1)', () => {
  it('10 · the preparer can choose self authorization (no earlier owner selection)', () => {
    const s = withSaved(prefill('CR', 'authorize'));
    expect(s.app.persons.selectedId).toBeNull();
    const self = authorizeSelf(selectPerson(chooseAuthMode(s, 'self'), 'p1'));
    expect(self.app).toMatchObject({ step: 'nafath', authorization: { mode: 'self', status: 'NAFATH_PENDING' }, status: 'DRAFT' });
  });

  it('11 · the preparer can create a signer handoff: version, SMS link, status page', () => {
    const at = Date.parse('2026-10-28T09:00:00Z');
    const s = handoffAt(at);
    const v = currentVersion(s.app)!;
    expect(s.app).toMatchObject({ step: 'handoff', status: 'AWAITING_AUTHORIZATION', authorization: { mode: 'signer', status: 'AWAITING_SIGNER' } });
    expect(v).toMatchObject({ version: 1, applicationId: s.app.id, signerId: 'p2', signerMobile: DEMO.signerMobile, status: 'AWAITING_SIGNER', createdAt: new Date(at).toISOString() });
    expect(v.initiatedBy).toMatch(/Preparer/);
    expect(s.backend.sms.at(-1)).toMatchObject({ kind: 'signer-link', to: DEMO.signerMobile });
    expect(s.app.ledger.filter((l) => l.check === 'AUTHORIZATION').map((l) => l.note).join(' ')).toMatch(/V1 created.*link sent/);
    expect(paid(s)).toEqual(['CR_DATA', 'PERSONS']); // no signer check before the link is opened
  });

  it('12 · the handoff freezes the application: no edit, no presence / IBAN / offer change, no Back', () => {
    const s = handoffAt();
    expect(isFrozen(s.app)).toBe(true);
    expect(startEdit(s, 'presence')).toBe(s);
    expect(setPresence(s, { websiteUrl: 'https://other.example.com' })).toBe(s);
    expect(submitBusiness({ ...s, app: { ...s.app, step: 'business' } }).app.step).toBe('business');
    expect(reviewerBackTarget(s.app)).toBeNull();
    expect(s.app.authorization.frozenSnapshot).toBe(currentVersion(s.app)!.snapshot);
  });

  it('13 · the secure signer link does not expose the application before Nafath', () => {
    const s = signerOpens(handoffAt());
    expect(s.app).toMatchObject({ actor: 'signer', step: 'signer', sessionVerified: false, signerSession: { version: 1, link: 'active' } });
    // Review and Contract cannot be reached without Nafath in this session.
    expect(continueFromReview({ ...s, app: { ...s.app, step: 'review' } }).app.step).toBe('review');
    expect(continueAfterNafath(s).app.step).toBe('signer');
    expect(contractEligible(s.app)).toBe(false);
  });

  it('14 · the signer starts Nafath without any OTP (mobile ↔ National ID first, on the handoff mobile)', () => {
    const opened = signerOpens(handoffAt());
    const s = signerStartNafath(opened);
    expect(s.app.step).toBe('nafath');
    expect(s.app.nafath.status).toBe('waiting');
    expect(s.app.authorization.status).toBe('NAFATH_PENDING');
    expect(s.backend.sms.filter((m) => m.kind === 'otp').length).toBe(opened.backend.sms.filter((m) => m.kind === 'otp').length);
    expect(paid(s, opened.app.ledger.length)).toEqual(['MOBILE_MATCH', 'NAFATH']);
    expect(s.app.mobileMatch.matchedFor).toContain(DEMO.signerMobile);
  });

  it('15 · successful Nafath opens the full read-only review', () => {
    const s = signerAtReview(handoffAt());
    expect(s.app).toMatchObject({ step: 'review', actor: 'signer', sessionVerified: true, authorization: { status: 'NAFATH_VERIFIED' } });
  });

  it('16 · the signer cannot edit the application', () => {
    const s = signerAtReview(handoffAt());
    expect(startEdit(s, 'presence')).toBe(s);
    expect(startEdit(s, 'commercial')).toBe(s);
    expect(setPresence(s, { websiteUrl: 'https://x.example.com' })).toBe(s);
    expect(setIban(s, demoIban('80', '9999'))).toBe(s);
    expect(reviewerBackTarget(s.app)).toBeNull();
    expect(chooseAuthMode({ ...s, app: { ...s.app, step: 'authorize' } }, 'self')).toEqual({ ...s, app: { ...s.app, step: 'authorize' } });
  });

  it('17 · the signer can continue to the contract', () => {
    const s = continueFromReview(signerAtReview(handoffAt()));
    expect(s.app).toMatchObject({ step: 'contract', authorization: { status: 'CONTRACT_PENDING' } });
    expect(contractEligible(s.app)).toBe(true);
  });

  it('18 · contract completion submits the application and completes the authorization', () => {
    const h = handoffAt();
    const s = agreeAndSubmit(continueFromReview(signerAtReview(h)));
    expect(s.app).toMatchObject({ outcome: 'SUBMITTED', status: 'SUBMITTED', id: h.app.id, authorization: { status: 'COMPLETED' }, signerSession: { link: 'completed' } });
    expect(currentVersion(s.app)).toMatchObject({ status: 'COMPLETED' });
    expect(currentVersion(s.app)!.completedAt).toBeTruthy();
    // The preparer now sees Application Progress; the link no longer works.
    expect(otp(apply(CR_KYB, {}, initialSim(), s)).app.step).toBe('status');
    expect(signerOpens(s).app.signerSession?.link).toBe('completed');
  });

  it('19 · the handoff expires after the configurable duration; the link stops working; the application stays', () => {
    const t0 = Date.parse('2026-10-28T09:00:00Z');
    const s = handoffAt(t0);
    expect(currentVersion(s.app)!.expiresAt).toBe(new Date(t0 + HANDOFF_RULES.expiryDays * DAY_MS).toISOString());
    expect(activeVersion(checkExpiry(s, t0 + (HANDOFF_RULES.expiryDays - 1) * DAY_MS).app)).not.toBeNull();
    const expired = checkExpiry(s, t0 + HANDOFF_RULES.expiryDays * DAY_MS);
    expect(expired.app.authorization.status).toBe('EXPIRED');
    expect(currentVersion(expired.app)).toMatchObject({ status: 'EXPIRED', endReason: 'EXPIRED' });
    expect(expired.app.status).toBe('AWAITING_AUTHORIZATION');
    expect(Object.keys(expired.backend.applications)).toEqual([s.app.id]);
    expect(signerOpens(expired, t0 + 8 * DAY_MS).app).toMatchObject({ step: 'signer', signerSession: { link: 'expired' } });
    expect(signerStartNafath(signerOpens(expired, t0 + 8 * DAY_MS)).app.step).toBe('signer');
    // A different configuration gives a different expiry (not hard-coded).
    const short = withHandoff(t0, withSaved(prefill('CR', 'authorize')));
    const custom = createHandoff(chooseAuthMode(withSaved(prefill('CR', 'authorize')), 'signer'), 'p2', DEMO.signerMobile, t0, { ...HANDOFF_RULES, expiryDays: 3 });
    expect(Date.parse(currentVersion(custom.app)!.expiresAt) - t0).toBe(3 * DAY_MS);
    expect(Date.parse(currentVersion(short.app)!.expiresAt) - t0).toBe(HANDOFF_RULES.expiryDays * DAY_MS);
  });

  it('20 · Authorization V1 and V2 use the same application', () => {
    const t0 = Date.parse('2026-10-01T09:00:00Z');
    const v1 = checkExpiry(handoffAt(t0), t0 + 8 * DAY_MS);
    const restarted = restartAuthorization(v1);
    expect(restarted.app.step).toBe('authorize');
    const v2 = withHandoff(t0 + 9 * DAY_MS, restarted);
    const [a, b] = v2.app.authorization.versions;
    expect([a.version, b.version]).toEqual([1, 2]);
    expect(a.applicationId).toBe(v1.app.id);
    expect(b.applicationId).toBe(v1.app.id);
    expect(a.status).toBe('EXPIRED');
    expect(b.status).toBe('AWAITING_SIGNER');
    expect(Object.keys(v2.backend.applications)).toEqual([v1.app.id]);
    // The V1 link no longer works; V2's does.
    const v1Token = Object.entries(v2.backend.signerLinks).find(([, l]) => l.version === 1)![0];
    expect(openSignerLink(leaveSession(v2), v1Token, t0 + 9 * DAY_MS).app.signerSession?.link).toBe('expired');
    expect(signerOpens(v2, t0 + 9 * DAY_MS).app.signerSession).toEqual({ version: 2, link: 'active' });
  });

  it('21 · a third handoff inside the 30-day window is refused until an internal / manual unlock', () => {
    const t0 = Date.parse('2026-10-01T09:00:00Z');
    let s = checkExpiry(handoffAt(t0), t0 + 8 * DAY_MS);
    s = checkExpiry(withHandoff(t0 + 9 * DAY_MS, restartAuthorization(s)), t0 + 17 * DAY_MS);
    s = restartAuthorization(s);
    expect(canStartHandoff(s.app, t0 + 18 * DAY_MS)).toBe(false);
    const third = withHandoff(t0 + 18 * DAY_MS, s);
    expect(third.app.authorization.versions).toHaveLength(2);
    expect(third.app.authorization.limitReached).toBe(true);
    expect(third.app.flags).toContain('AUTHORIZATION_LIMIT_REACHED');
    // Self authorization is still possible (not a handoff).
    expect(authorizeSelf(selectPerson(chooseAuthMode(third, 'self'), 'p1')).app.step).toBe('nafath');
    // Internal unlock allows one more version.
    const unlocked = withHandoff(t0 + 18 * DAY_MS, manualUnlock(third));
    expect(unlocked.app.authorization.versions).toHaveLength(3);
    // Outside the window the count resets.
    expect(canStartHandoff(s.app, t0 + 45 * DAY_MS)).toBe(true);
  });

  it('22 · Phase 1: the preparer cannot change the signer or mobile while a handoff is live', () => {
    const s = handoffAt();
    expect(createHandoff(s, 'p1', DEMO.otherMobile)).toEqual(s);
    expect(selectPerson(s, 'p1')).toBe(s);
    expect(chooseAuthMode(s, 'self')).toBe(s);
    expect(restartAuthorization(s)).toBe(s);
    expect(PREPARER_AUTH_VIEW.AWAITING_SIGNER.label).toBe('In progress');
  });

  it('a signer whose mobile does not belong to them ends the version (no self-service correction); the application is kept', () => {
    const s = signerStartNafath(signerOpens(handoffAt(Date.now(), simWith({ mobileMatch: ['mismatch'] }))));
    expect(s.app).toMatchObject({ step: 'signer', signerSession: { link: 'ended' }, authorization: { status: 'CANCELLED' } });
    expect(currentVersion(s.app)!.endReason).toBe('SIGNER_MOBILE_MISMATCH');
    expect(calls(s)).not.toContain('NAFATH');
    expect(startMobileChange(s)).toBe(s);
  });

  it('signer Nafath failed twice ends the version; the application stays', () => {
    let s = signerStartNafath(signerOpens(handoffAt(Date.now(), simWith({ nafath: ['rejected', 'timeout'] }))));
    s = nafathResult(s, 'rejected');
    s = nafathResult(signerStartNafath(s), 'timeout');
    expect(s.app).toMatchObject({ authorization: { status: 'CANCELLED' }, signerSession: { link: 'ended' }, status: 'AWAITING_AUTHORIZATION' });
    expect(currentVersion(s.app)!.endReason).toBe('SIGNER_NAFATH_FAILED');
  });

  it('every new signer session verifies with Nafath again (the link alone never reaches the review)', () => {
    const reviewed = signerAtReview(handoffAt());
    const again = signerOpens(reviewed);
    expect(again.app).toMatchObject({ step: 'signer', sessionVerified: false });
    expect(continueAfterNafath(again).app.step).toBe('signer');
  });

  it('23 · delegated signer demo states are represented but marked Phase 2 (no Phase-1 effect)', () => {
    let s = openDelegation(withSaved(prefill('CR', 'authorize')));
    expect(s.app.step).toBe('delegation');
    s = delegationResult(setDelegationType(s, 'MOJ'), 'valid');
    expect(s.app.authorization.delegation).toEqual({ type: 'MOJ', status: 'valid' });
    expect(delegationResult(s, 'under_review')).toBe(s); // MOJ is automatic: no manual review state
    s = delegationResult(setDelegationType(s, 'COMPANY_DOC'), 'under_review');
    expect(s.app.authorization.delegation.status).toBe('under_review');
    expect(s.app.authorization.versions).toEqual([]);
    expect(s.app.status).toBe('DRAFT');
    expect(isFrozen(s.app)).toBe(false);
  });

  it('24 · the Commercial Offer is frozen and read-only during the signer flow', () => {
    const h = handoffAt();
    const offer = h.app.commercial.agreed;
    expect(confirmOffer({ ...h, app: { ...h.app, step: 'commercial' } }).app.commercial.agreed).toBe(offer);
    expect(requestRateReview(h)).toBe(h);
    expect(withdrawRateReview(h)).toBe(h);
    const signer = signerAtReview(h);
    expect(signer.app.commercial.agreed).toEqual(offer);
    expect(startEdit(signer, 'commercial')).toBe(signer);
    expect(JSON.parse(currentVersion(signer.app)!.snapshot).offer.standardRate).toBe(offer!.standardRate);
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

  it('Freelancer Nafath not verified: Review submits for manual verification without a contract', () => {
    const base = prefill('FL_CERT', 'review');
    const s = continueFromReview(withSaved({ ...base, nafath: { ...base.nafath, status: 'exhausted', verifiedFor: null }, verifications: { ...base.verifications, NAFATH: undefined } }));
    expect(s.app.outcome).toBe('SUBMITTED_MANUAL');
    expect(s.app.status).toBe('SUBMITTED');
  });

  it('a CR preparer cannot reach the contract without an authorization choice', () => {
    const s = withSaved(prefill('CR', 'review'));
    expect(contractEligible(s.app)).toBe(false);
    expect(continueFromReview(s).app.step).toBe('authorize');
  });
});

describe('Reviewer-only Back (Prototype Controls)', () => {
  it('steps back through a draft without changing any verification, status or saved value', () => {
    const s = withSaved(prefill('CR', 'contract'));
    const steps: string[] = [];
    let x = s;
    while (reviewerBackTarget(x.app)) { x = reviewerBack(x); steps.push(x.app.step); }
    expect(steps).toEqual(['nafath', 'authorize', 'review', 'commercial', 'business', 'cr']);
    const { step: _a, ...after } = x.app;
    const { step: _b, ...before } = s.app;
    expect(after).toEqual(before);
    expect(selectPerson(x, 'p2').app.persons.selectedId).toBe('p1');
    expect(x.app.nafath.status).toBe('verified');
  });

  it('Freelancer path goes back through Nafath and the certificate', () => {
    let x = withSaved(prefill('FL_CERT', 'review'));
    const steps: string[] = [];
    while (reviewerBackTarget(x.app)) { x = reviewerBack(x); steps.push(x.app.step); }
    expect(steps).toEqual(['commercial', 'business', 'nafath', 'certificates']);
  });

  it('before the application exists it reopens Page 2 / Page 1; never on code screens, during an edit, for a signer or after DRAFT', () => {
    const identify = submitKyb(setKyb(initialState(), CR_KYB));
    expect(reviewerBack(identify).app.step).toBe('kyb');
    expect(reviewerBack(apply(CR_KYB)).app.step).toBe('identify');
    expect(reviewerBackTarget(apply(CR_KYB, {}, simWith({ existence: 'incomplete' })).app)).toBeNull();
    expect(reviewerBackTarget(startEdit(withSaved(prefill('CR', 'review')), 'presence').app)).toBeNull();
    expect(reviewerBackTarget(withSaved(prefill('CR', 'status')).app)).toBeNull();
    expect(reviewerBackTarget(signerOpens(handoffAt()).app)).toBeNull();
  });

  it('re-submitting Page 2 after stepping back cannot create a second application', () => {
    const s = withSaved(prefill('CR', 'business'));
    expect(submitIdentify({ ...s, app: { ...s.app, step: 'identify' } })).toEqual({ ...s, app: { ...s.app, step: 'identify' } });
  });
});

describe('Continue link resume', () => {
  it('Save & exit → link → OTP to the stored mobile → first unfinished stage; ordinary resume costs one OTP', () => {
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
    expect(s.app.step).toBe('cr');
  });

  it('no Continue link for a frozen application or a signer', () => {
    const h = handoffAt();
    expect(sendContinueLink(h)).toBe(h);
    const signer = signerOpens(h);
    expect(sendContinueLink(signer)).toBe(signer);
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

  it('existence is an internal lookup: a Page-1 answer alone left no record', () => {
    const page1 = submitKyb(setKyb(initialState(), { ...FL_KYB, kind: 'FL_NO_CERT' }));
    expect(existenceFor({ ...leaveSession(page1), app: { ...leaveSession(page1).app, identity: { identifier: DEMO.nationalId, mobile: DEMO.mobile, prerequisite: null } } }).existence).toBe('new');
  });
});
