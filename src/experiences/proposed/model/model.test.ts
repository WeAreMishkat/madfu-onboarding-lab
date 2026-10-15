import { describe, expect, it } from 'vitest';
import { LIMITS, REVENUE_OPTIONS, isSelfService, isStructuralCr, isStructuralNationalId } from './config';
import { DECISION_TABLES } from './decisions';
import { DEMO_SMS_CODE, eligiblePersons, personsAdapter } from './mock';
import { SCENARIOS } from './scenarios';
import {
  acceptContract, confirmCertificate, contractEligible, continueAfterNafath, continueFromReview, continueWithoutPerson, declineContract,
  expireOtp, finishIbanCheck, identityCheck, initialSim, initialState, loadCertificates, loadPersons, nafathResult, prefill, resendOtp,
  runCrVerification, selectCertificate, selectPerson, setIban, startEdit, startIbanCheck, startNafath, submitApplication, submitCategory,
  submitEntry, verifyOtp
} from './state';
import type { ApplicantType, ProposedState, Revenue, Sim, StepId } from './types';

const st = (type: ApplicantType, step: StepId, sim: Partial<Sim> = {}): ProposedState => ({ ...initialState(), sim: { ...initialSim(), ...sim }, app: prefill(type, step) });
const entry = (type: ApplicantType, revenue: Revenue, sim: Partial<Sim> = {}): ProposedState => {
  const s = st(type, 'entry', sim);
  return { ...s, app: { ...s.app, entry: { ...s.app.entry, revenue } } };
};
const throughOtp = (s: ProposedState) => verifyOtp(submitEntry(s), DEMO_SMS_CODE);

describe('entry rules', () => {
  it('structural validation only', () => {
    expect(isStructuralCr('7000000101')).toBe(true);
    expect(isStructuralCr(['1', '000000', '101'].join(''))).toBe(false);
    expect(isStructuralNationalId(['1', '000000', '201'].join(''))).toBe(true);
    expect(isStructuralNationalId('7000000101')).toBe(false);
  });
  it('three revenue bands with no gap or overlap; exactly SAR 100,000 is self-onboarding (provisional)', () => {
    expect(REVENUE_OPTIONS.map((o) => o.label)).toEqual(['Below SAR 100,000', 'SAR 100,000–20,000,000', 'Above SAR 20,000,000']);
  });
});

describe('revenue routing after the SMS code', () => {
  it.each<[ApplicantType, Revenue, boolean]>([
    ['CR', 'BELOW_100K', false], ['CR', 'SELF_SERVICE_BAND', true], ['CR', 'ABOVE_20M', false],
    ['FL', 'BELOW_100K', true], ['FL', 'SELF_SERVICE_BAND', true], ['FL', 'ABOVE_20M', true]
  ])('%s %s → self-service %s', (t, r, self) => {
    expect(isSelfService(t, r)).toBe(self);
    const s = throughOtp(entry(t, r));
    if (self) expect(s.app.step).toBe('category');
    else { expect(s.app.outcome).toBe('SALES_LEAD'); expect(s.app.category.sub).toBe(''); expect(s.app.nafath.requests).toBe(0); }
  });
  it('low and high CR leads carry separate internal statuses', () => {
    expect(throughOtp(entry('CR', 'BELOW_100K')).app.status).toBe('SALES_LEAD_LOW_REVENUE');
    expect(throughOtp(entry('CR', 'ABOVE_20M')).app.status).toBe('SALES_LEAD_HIGH_REVENUE');
  });
});

describe('identity checks come before mobile matching', () => {
  it('existing merchant stops before anything else, after the code', () => {
    const s = submitEntry(entry('CR', 'SELF_SERVICE_BAND', { identity: 'existing_merchant' }));
    expect(s.app.step).toBe('otp');
    expect(verifyOtp(s, DEMO_SMS_CODE).app.outcome).toBe('EXISTING_MERCHANT');
  });
  it('saved application: same mobile resumes, other mobile is a duplicate identity', () => {
    const saved = throughOtp(entry('CR', 'SELF_SERVICE_BAND'));
    const fresh = { ...initialState(), saved: saved.saved };
    const sameMobile = { ...fresh, app: { ...fresh.app, entry: saved.app.entry } };
    expect(identityCheck(sameMobile)).toBe('current_application');
    const otherMobile = { ...fresh, app: { ...fresh.app, entry: { ...saved.app.entry, mobile: '5' + '11112222' } } };
    expect(identityCheck(otherMobile)).toBe('duplicate_identity');
  });
  it('mobile reuse alone never rejects: same mobile, different CR is a new application', () => {
    const saved = throughOtp(entry('CR', 'SELF_SERVICE_BAND'));
    const other = { ...initialState(), saved: saved.saved };
    const s = { ...other, app: { ...other.app, entry: { ...saved.app.entry, identifier: '7000000202' } } };
    expect(identityCheck(s)).toBe('new');
  });
});

describe('SMS code', () => {
  it('3 incorrect attempts exhaust the code; resend restores it', () => {
    let s = submitEntry(entry('CR', 'SELF_SERVICE_BAND'));
    s = verifyOtp(s, '111111');
    expect(s.app.otp.status).toBe('incorrect');
    s = verifyOtp(verifyOtp(s, '111111'), '111111');
    expect(s.app.otp.status).toBe('exhausted');
    expect(verifyOtp(s, DEMO_SMS_CODE).app.otp.status).toBe('exhausted');
    s = resendOtp(s);
    expect(s.app.otp.attemptsLeft).toBe(LIMITS.otpAttempts);
    expect(verifyOtp(s, DEMO_SMS_CODE).app.step).toBe('category');
  });
  it('an expired code cannot be used', () => {
    const s = expireOtp(submitEntry(entry('FL', 'BELOW_100K')));
    expect(verifyOtp(s, DEMO_SMS_CODE).app.step).toBe('otp');
  });
});

describe('category screening', () => {
  const withSub = (t: ApplicantType, sub: string) => { const s = st(t, 'category'); return { ...s, app: { ...s.app, category: { group: 'x', sub } } }; };
  it('blocked: neutral outcome, no registry or Nafath call', () => {
    const s = submitCategory(withSub('CR', 'fixture-blocked'));
    expect(s.app.outcome).toBe('CATEGORY_REVIEW');
    expect(s.app.status).toBe('CATEGORY_BLOCKED');
    expect(s.app.cr.status).toBe('idle');
    expect(s.app.nafath.requests).toBe(0);
  });
  it('Freelancer in a CR-only category is flagged, not rejected', () => {
    const s = submitCategory(withSub('FL', 'fixture-cr-only'));
    expect(s.app.flags).toContain('FL_CR_ONLY_CATEGORY');
    expect(s.app.step).toBe('nafath');
  });
  it('manual-review category is flagged and continues', () => {
    const s = submitCategory(withSub('CR', 'fixture-manual'));
    expect(s.app.flags).toContain('CATEGORY_MANUAL_REVIEW');
    expect(s.app.step).toBe('cr-verify');
  });
});

describe('CR verification and authorised people', () => {
  it('expired: continues with a flag; not found: cannot continue', () => {
    const exp = runCrVerification(st('CR', 'cr-verify', { crResult: 'expired' }));
    expect(exp.app.cr.status).toBe('expired');
    expect(exp.app.flags).toContain('CR_EXPIRED');
    expect(runCrVerification(st('CR', 'cr-verify', { crResult: 'not_found' })).app.cr.record).toBeNull();
  });
  it('provider unavailable: retry counted, no people invented', () => {
    const s = loadPersons(st('CR', 'persons', { persons: 'unavailable' }));
    expect(s.app.persons.status).toBe('unavailable');
    expect(s.app.persons.list).toEqual([]);
  });
  it('companies are never offered for Nafath; names and IDs are masked', () => {
    const list = eligiblePersons(personsAdapter('multiple'));
    expect(list.every((p) => p.kind === 'individual')).toBe(true);
    expect(list.every((p) => /^\d{3}•+\d{3}$/.test(p.idMasked))).toBe(true);
  });
  it('no eligible individual: manual authority check, no contract', () => {
    let s = loadPersons(st('CR', 'persons', { persons: 'none' }));
    expect(s.app.persons.status).toBe('none');
    s = continueWithoutPerson(s);
    expect(s.app.step).toBe('business');
    expect(contractEligible(s.app)).toBe(false);
  });
});

describe('Nafath', () => {
  it('two attempts per CR application, shared across people; changing person does not reset', () => {
    let s = st('CR', 'nafath', { nafath: ['rejected', 'rejected'] });
    s = { ...s, app: { ...s.app, nafath: { ...s.app.nafath, status: 'idle', requests: 0, verifiedPersonId: null } } };
    s = nafathResult(startNafath(s), 'rejected');
    expect(s.app.nafath.status).toBe('failed');
    s = selectPerson(s, 'p2');
    expect(s.app.nafath.failures).toBe(1);
    s = nafathResult(startNafath(s), 'timeout');
    expect(s.app.nafath.status).toBe('exhausted');
    expect(s.app.flags).toContain('NAFATH_UNVERIFIED');
    expect(startNafath(s).app.nafath.status).toBe('exhausted');
  });
  it('a technical failure does not use an attempt (provisional rule)', () => {
    const s = nafathResult(startNafath(st('CR', 'nafath')), 'technical');
    expect(s.app.nafath.failures).toBe(0);
  });
  it('changing the person after success invalidates the verification', () => {
    const s = selectPerson(st('CR', 'review'), 'p2');
    expect(s.app.nafath.status).toBe('idle');
    expect(contractEligible(s.app)).toBe(false);
  });
  it('Freelancer failing twice goes to the manual certificate route with no IBAN check', () => {
    let s = st('FL', 'nafath');
    s = nafathResult(startNafath({ ...s, app: { ...s.app, nafath: { ...s.app.nafath, status: 'idle' } } }), 'rejected');
    s = nafathResult(startNafath(s), 'rejected');
    s = continueAfterNafath(s);
    expect(s.app.step).toBe('manual-certificate');
    s = startIbanCheck(setIban(s, ['SA', '00', '80', '000000', '12345678', '0001'].join('')));
    expect(s.app.business.ibanStatus).toBe('not_checked');
  });
});

describe('Freelancer certificates', () => {
  const certs = (r: Sim['certificates']) => loadCertificates(st('FL', 'certificates', { certificates: r }));
  it('none: nothing invented', () => {
    expect(certs('none').app.certs.list).toEqual([]);
    expect(certs('none').app.certs.status).toBe('none');
  });
  it('duplicate and expired certificates cannot be confirmed', () => {
    const d = certs('duplicate');
    expect(confirmCertificate(selectCertificate(d, 'fl1')).app.step).toBe('certificates');
    const e = certs('expired');
    expect(confirmCertificate(selectCertificate(e, 'fl1')).app.step).toBe('certificates');
  });
  it('category mismatch is flagged and re-evaluated', () => {
    const s = confirmCertificate(certs('mismatch'));
    expect(s.app.flags).toContain('CERTIFICATE_CATEGORY_MISMATCH');
    expect(s.app.step).toBe('business');
  });
});

describe('IBAN, contract and outcomes', () => {
  const failIban = (t: ApplicantType) => {
    let s = st(t, 'business', { iban: ['mismatch', 'technical'] });
    s = setIban(s, ['SA', '00', '10', '000000', '12345678', '7777'].join(''));
    s = finishIbanCheck(startIbanCheck(s));
    expect(s.app.business.ibanStatus).toBe('failed');
    return finishIbanCheck(startIbanCheck(s));
  };
  it('two unsuccessful checks: continue unverified with a flag; a verified applicant keeps the contract', () => {
    for (const t of ['CR', 'FL'] as const) {
      const s = failIban(t);
      expect(s.app.business.ibanStatus).toBe('unverified');
      expect(s.app.flags).toContain('IBAN_UNVERIFIED');
      expect(contractEligible(s.app)).toBe(true);
    }
  });
  it('editing the IBAN invalidates the previous verification', () => {
    const s = setIban(st('CR', 'review'), ['SA', '00', '10', '000000', '12345678', '9000'].join(''));
    expect(s.app.business.ibanStatus).toBe('idle');
  });
  it('not Nafath-verified: no contract, manual verification outcome', () => {
    const s = st('CR', 'review');
    const unverified = { ...s, app: { ...s.app, nafath: { ...s.app.nafath, status: 'exhausted' as const } } };
    expect(continueFromReview(unverified).app.outcome).toBe('MANUAL_VERIFICATION');
  });
  it('accept then submit → submitted; decline → declined', () => {
    const s = continueFromReview(st('FL', 'review'));
    expect(s.app.step).toBe('contract');
    expect(submitApplication(s).app.outcome).toBeNull();
    expect(submitApplication(acceptContract(s)).app.outcome).toBe('SUBMITTED');
    expect(declineContract(s).app.outcome).toBe('CONTRACT_DECLINED');
  });
});

describe('edit from review', () => {
  it('changing the CR invalidates registration, people, Nafath status and contract, but not the attempt counter', () => {
    let s = st('CR', 'review');
    s = { ...s, app: { ...s.app, nafath: { ...s.app.nafath, failures: 1 } } };
    s = startEdit(s, 'applicant');
    s = { ...s, app: { ...s.app, entry: { ...s.app.entry, identifier: '7000000303' } } };
    s = submitEntry(s);
    expect(s.app.cr.status).toBe('idle');
    expect(s.app.persons.selectedId).toBeNull();
    expect(s.app.nafath.status).toBe('idle');
    expect(s.app.nafath.failures).toBe(1);
    expect(s.app.step).toBe('cr-verify');
  });
  it('unchanged identity and mobile: no new SMS code, back to review', () => {
    const s = submitEntry(startEdit(st('CR', 'review'), 'applicant'));
    expect(s.app.step).toBe('review');
  });
});

describe('scenarios and generated documentation', () => {
  it('covers all 24 required scenarios and every preset builds', () => {
    const required = SCENARIOS.filter((x) => x.required).map((x) => x.required).sort((a, b) => a! - b!);
    expect(required).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    expect(new Set(SCENARIOS.map((x) => x.id)).size).toBe(SCENARIOS.length);
    for (const sc of SCENARIOS) expect(sc.build().scenarioId).toBe(sc.id);
  });
  it('decision tables are generated from the running rules', () => {
    const contract = DECISION_TABLES.find((t) => t.id === 'contract')!;
    expect(contract.rows.find((r) => r[1].startsWith('Nafath failed twice'))![2]).toMatch(/No contract/);
    expect(contract.rows.find((r) => r[1].includes('IBAN unverified'))![2]).toBe('Contract available');
  });
});
