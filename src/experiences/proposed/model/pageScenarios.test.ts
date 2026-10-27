import { describe, expect, it } from 'vitest';
import { PAGE_SCENARIOS, pageScenarios } from './pageScenarios';
import { scenarioById } from './scenarios';
import { runBusinessVerification, runCertificatePrecheck, submitIdentify, submitKyb } from './state';
import type { ProposedState, StepId } from './types';
import { callsSince } from './verifications';

const at = (id: string, step?: StepId) => { const s = scenarioById(id)!.build(); return step ? { ...s, app: { ...s.app, step } } : s; };

/** A representative state per screen. */
const SAMPLE: Record<StepId, () => ProposedState> = {
  kyb: () => at('kyb-cr-online'),
  identify: () => at('id-new-cr'),
  otp: () => at('otp-errors'),
  persons: () => runBusinessVerification(at('cr-business')),
  nafath: () => at('mm-match'),
  certificates: () => at('fl-certs-multi'),
  business: () => at('biz-fl'),
  commercial: () => at('com-standard'),
  review: () => at('review'),
  contract: () => at('contract'),
  outcome: () => at('cr-expired'),
  status: () => at('status-approved'),
  login: () => at('status-submitted', 'login')
};

const labels = (s: ProposedState) => pageScenarios(s).groups.flatMap((g) => g.options.map((o) => o.label));
const titles = (s: ProposedState) => pageScenarios(s).groups.map((g) => g.title);

describe('Page Scenarios are page-specific', () => {
  it('every screen has a definition', () => {
    for (const step of Object.keys(SAMPLE) as StepId[]) expect(PAGE_SCENARIOS[step], step).toBeDefined();
  });

  it('Page 1 shows the four eligibility cases only — no Sales, revenue-routing, website or Maps scenarios', () => {
    const l = labels(SAMPLE.kyb());
    expect(l).toEqual(['Eligible Registered Business', 'Eligible Freelancer', 'Freelancer without Certificate → Not Eligible', 'Unsupported Category → Identify / OTP → Not Eligible']);
    expect(l.some((x) => /website|maps|url|sales|lead|blocked|SAR/i.test(x))).toBe(false);
  });

  it('Page 1 options run through the real eligibility: no-certificate stops at once, unsupported continues to Identify', () => {
    const run = (label: string) => submitKyb(pageScenarios(SAMPLE.kyb()).groups[0].options.find((o) => o.label === label)!.run(SAMPLE.kyb()));
    expect(run('Eligible Registered Business').app.step).toBe('identify');
    expect(run('Eligible Freelancer').app.step).toBe('identify');
    expect(run('Freelancer without Certificate → Not Eligible').app).toMatchObject({ step: 'outcome', outcome: 'NOT_ELIGIBLE' });
    const unsupported = run('Unsupported Category → Identify / OTP → Not Eligible');
    expect(unsupported.app).toMatchObject({ step: 'identify', outcome: null });
    expect(unsupported.app.eligibility?.result).toBe('NOT_ELIGIBLE');
  });

  it('Page 2 shows the record lookup, the declaration and the abuse control', () => {
    const l = labels(SAMPLE.identify());
    expect(l).toEqual(expect.arrayContaining(['New applicant', 'Application already in progress', 'Application already submitted', 'Already a Madfu merchant', 'Saved as Not Eligible earlier', 'Too many requests (rate limit)']));
    expect(titles(SAMPLE.identify())).toContain('Owner or manager on the CR?');
    expect(titles(at('id-new-fl'))).toContain('IBAN linked to the certificate?');
  });

  it('OTP page shows only OTP cases; registered-mobile codes cannot edit the mobile', () => {
    const l = labels(SAMPLE.otp());
    expect(l).toEqual(['Verified', 'Incorrect code', 'Invalid code (wrong format)', 'Expired / timed out', 'Resend code (3 left)', 'Edit mobile number']);
    const reg = labels(submitIdentify(at('id-incomplete')));
    expect(reg).toContain('Verified');
    expect(reg).not.toContain('Edit mobile number');
  });

  it('Business verification shows CR results, risk attributes and owners — no OTP / Nafath / IBAN', () => {
    const l = labels(SAMPLE.persons());
    expect(l).toEqual(expect.arrayContaining(['Active CR', 'Expired → saved + Sales', 'Suspended → saved + Sales', 'Provider unavailable', 'Several activities (government category differs)', 'CR 2 months old', 'One owner / manager', 'None (only a delegate / company)']));
    expect(l.some((x) => /Nafath|OTP|IBAN|code/i.test(x))).toBe(false);
  });

  it('Nafath page: mobile ↔ National ID and Nafath answers; the Freelancer adds the backend certificate pre-check', () => {
    expect(titles(SAMPLE.nafath())).toEqual(['Mobile ↔ National ID', 'Nafath answer', 'Attempts']);
    const flTitles = titles(runCertificatePrecheck(at('fl-nafath')));
    expect(flTitles[0]).toBe('Certificate pre-check (backend, before Nafath)');
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
    const run = (s: ProposedState, label: string) => pageScenarios(s).groups.flatMap((g) => g.options).find((o) => o.label === label)!.run(s);
    const expired = run(SAMPLE.persons(), 'Expired → saved + Sales');
    expect(expired.app.status).toBe('PAUSED_CR');
    const pre = run(runCertificatePrecheck(at('fl-nafath')), 'No certificate → Not Eligible, no Nafath');
    expect(pre.app.outcome).toBe('NOT_ELIGIBLE');
    expect(callsSince(pre.app, 0).map((c) => c.check)).not.toContain('NAFATH');
    const mm = run(SAMPLE.nafath(), 'Mismatch, then the corrected mobile matches');
    const answered = pageScenarios(mm).groups.flatMap((g) => g.options).find((o) => o.label === 'Verified')!.run(mm);
    expect(answered.app.mobileMatch.status).toBe('mismatch');
    expect(answered.app.nafath.status).toBe('idle');
  });
});
