import { describe, expect, it } from 'vitest';
import { PAGE_SCENARIOS, pageScenarios } from './pageScenarios';
import { scenarioById } from './scenarios';
import { runBusinessVerification, submitIdentify, submitKyb } from './state';
import type { ProposedState, StepId } from './types';
import { callsSince } from './verifications';

const at = (id: string, step?: StepId) => { const s = scenarioById(id)!.build(); return step ? { ...s, app: { ...s.app, step } } : s; };

/** A representative state per screen. */
const SAMPLE: Record<StepId, () => ProposedState> = {
  kyb: () => at('kyb-cr-online'),
  identify: () => at('id-new-cr'),
  otp: () => at('otp-errors'),
  cr: () => runBusinessVerification(at('cr-business')),
  certificates: () => at('fl-certs-multi'),
  nafath: () => at('mm-match'),
  business: () => at('biz-fl'),
  commercial: () => at('com-standard'),
  review: () => at('review'),
  authorize: () => at('auth-choice'),
  handoff: () => at('handoff-active'),
  delegation: () => at('delegation-demo'),
  signer: () => at('signer-link'),
  contract: () => at('contract'),
  outcome: () => at('cr-expired'),
  status: () => at('status-approved'),
  login: () => at('status-submitted', 'login')
};

const labels = (s: ProposedState) => pageScenarios(s).groups.flatMap((g) => g.options.map((o) => o.label));
const titles = (s: ProposedState) => pageScenarios(s).groups.map((g) => g.title);
const run = (s: ProposedState, label: string) => pageScenarios(s).groups.flatMap((g) => g.options).find((o) => o.label === label)!.run(s);

describe('Page Scenarios are page-specific', () => {
  it('every screen has a definition', () => {
    for (const step of Object.keys(SAMPLE) as StepId[]) expect(PAGE_SCENARIOS[step], step).toBeDefined();
  });

  it('Page 1 shows the four eligibility cases only — no Sales, revenue-routing, website or Maps scenarios', () => {
    const l = labels(SAMPLE.kyb());
    expect(l).toEqual(['Eligible Registered Business', 'Eligible Freelancer', 'Freelancer without Certificate → Identify / OTP → Application submitted', 'Unsupported Category → Identify / OTP → Application submitted']);
    expect(l.some((x) => /website|maps|url|sales|lead|blocked|SAR/i.test(x))).toBe(false);
  });

  it('Page 1 options run through the real eligibility: everyone continues to Identify; Not Eligible stays internal', () => {
    const go = (label: string) => submitKyb(run(SAMPLE.kyb(), label));
    expect(go('Eligible Registered Business').app.step).toBe('identify');
    expect(go('Eligible Freelancer').app.step).toBe('identify');
    for (const label of ['Freelancer without Certificate → Identify / OTP → Application submitted', 'Unsupported Category → Identify / OTP → Application submitted']) {
      const s = go(label);
      expect(s.app).toMatchObject({ step: 'identify', outcome: null });
      expect(s.app.eligibility?.result).toBe('NOT_ELIGIBLE');
    }
  });

  it('Page 2 shows the record lookup, the Freelancer IBAN declaration and the abuse control — no CR owner question', () => {
    const l = labels(SAMPLE.identify());
    expect(l).toEqual(expect.arrayContaining(['New applicant', 'Application already in progress', 'Application already submitted', 'Already a Madfu merchant', 'Captured earlier (internally Not Eligible)', 'Too many requests (rate limit)']));
    expect(titles(SAMPLE.identify())).not.toContain('Owner or manager on the CR?');
    expect(titles(at('id-new-fl'))).toContain('IBAN linked to the certificate?');
  });

  it('OTP page shows only OTP cases; stored-mobile codes cannot edit the mobile', () => {
    const l = labels(SAMPLE.otp());
    expect(l).toEqual(['Verified', 'Incorrect code', 'Invalid code (wrong format)', 'Expired / timed out', 'Resend code (3 left)', 'Edit mobile number']);
    const reg = labels(submitIdentify(at('id-incomplete')));
    expect(reg).toContain('Verified');
    expect(reg).not.toContain('Edit mobile number');
  });

  it('CR verification shows CR results, risk attributes and owners — no OTP / Nafath / IBAN / selection', () => {
    const l = labels(SAMPLE.cr());
    expect(l).toEqual(expect.arrayContaining(['Active CR', 'Expired → saved + Sales', 'Suspended → saved + Sales', 'Provider unavailable', 'Several activities (government category differs)', 'CR 2 months old', 'One owner / manager', 'None (only a delegate / company) → captured internally']));
    expect(l.some((x) => /Nafath|OTP|IBAN|code|Selection/i.test(x))).toBe(false);
  });

  it('Nafath page: mobile ↔ National ID and Nafath answers; the signer has no mobile correction', () => {
    expect(titles(SAMPLE.nafath())).toEqual(['Mobile ↔ National ID', 'Nafath answer', 'Attempts']);
    expect(titles(at('signer-nafath'))).toEqual(['Nafath answer', 'Signer attempts']);
  });

  it('Freelancer certificate page (before Nafath) covers found / several / none / unavailable / CR-only', () => {
    expect(labels(SAMPLE.certificates())).toEqual(expect.arrayContaining(['One certificate', 'Several certificates', 'No certificate → Application submitted (internal)', 'Certificate service unavailable', 'Certificate activity requires a CR']));
  });

  it('Business Details: channel + store presence; IBAN only for Freelancers', () => {
    expect(titles(SAMPLE.business())).toEqual(['Channel declared on Page 1 (simulator)', 'Store presence links', 'Freelancer IBAN linkage']);
    expect(titles(at('biz-cr-both'))).not.toContain('Freelancer IBAN linkage');
  });

  it('Commercial Offer has no plan selection anywhere', () => {
    const l = labels(SAMPLE.commercial());
    expect(l).toEqual(['Standard offer only', 'Rate review requested (no file)', 'Evidence uploaded', 'Optional upload failed']);
    expect(l.some((x) => /month|plan/i.test(x))).toBe(false);
  });

  it('Authorization, handoff, signer and delegation pages expose the signer-flow controls', () => {
    expect(labels(SAMPLE.authorize())).toEqual(expect.arrayContaining(['I can complete the authorization myself', 'Send to another signer', 'Send Authorization (owner / manager + demo mobile)']));
    expect(labels(SAMPLE.handoff())).toEqual(expect.arrayContaining(['Signer opens the secure link (new session)', '7 days pass → link expires', '6 days pass → still valid']));
    expect(labels(at('handoff-expired'))).toContain('Start a new authorization (same application)');
    expect(labels(at('handoff-limit'))).toContain('Internal team: unlock one more handoff');
    expect(labels(SAMPLE.signer())).toEqual(['Start Nafath (mobile matches)', 'Signer mobile does not match → version ends']);
    expect(PAGE_SCENARIOS.delegation.title).toMatch(/PHASE 2/);
    expect(labels(SAMPLE.delegation())).toEqual(['Ministry of Justice delegation', 'Company / commercial delegation document', 'Other official delegation document']);
    expect(labels(at('signer-review'))).toEqual([]); // the signer edits nothing
  });

  it('Application Progress shows statuses; "goes live" only once approved', () => {
    expect(labels(SAMPLE.status())).toContain('Merchant goes live');
    expect(labels(at('status-submitted'))).not.toContain('Merchant goes live');
  });

  it('every option on every page runs on its representative state', () => {
    for (const [step, make] of Object.entries(SAMPLE) as Array<[StepId, () => ProposedState]>) {
      for (const g of pageScenarios(make()).groups) for (const o of g.options) expect(() => o.run(make()), `${step}: ${o.label}`).not.toThrow();
    }
  });

  it('options simulate through the real transitions', () => {
    const expired = run(SAMPLE.cr(), 'Expired → saved + Sales');
    expect(expired.app.status).toBe('PAUSED_CR');
    const none = run(SAMPLE.certificates(), 'No certificate → Application submitted (internal)');
    expect(none.app).toMatchObject({ outcome: 'RECEIVED', status: 'NOT_ELIGIBLE' });
    expect(callsSince(none.app, 0).map((c) => c.check)).not.toContain('NAFATH');
    const mm = run(SAMPLE.nafath(), 'Mismatch, then the corrected mobile matches');
    const answered = run(mm, 'Verified');
    expect(answered.app.mobileMatch.status).toBe('mismatch');
    expect(answered.app.nafath.status).toBe('idle');
    const sent = run(SAMPLE.authorize(), 'Send Authorization (owner / manager + demo mobile)');
    expect(sent.app).toMatchObject({ step: 'handoff', status: 'AWAITING_AUTHORIZATION' });
    const opened = run(sent, 'Signer opens the secure link (new session)');
    expect(opened.app).toMatchObject({ actor: 'signer', step: 'signer' });
    const expiredLink = run(SAMPLE.handoff(), '7 days pass → link expires');
    expect(expiredLink.app.authorization.status).toBe('EXPIRED');
    expect(run(SAMPLE.handoff(), '6 days pass → still valid').app.authorization.status).toBe('AWAITING_SIGNER');
    expect(run(SAMPLE.signer(), 'Signer mobile does not match → version ends').app.authorization.status).toBe('CANCELLED');
  });
});
