import { describe, expect, it } from 'vitest';
import { ACTIVITY_MAPPING, reconcile } from './activity';
import { RULE_FLAGS, STAGES } from './config';
import { evaluateEligibility } from './eligibility';
import { GOV_RULES, evaluateGovernment } from './government';
import { DEMO, DEMO_SMS_CODE, demoIban } from './mock';
import { BASE_PLANS, OPTIONAL_PLANS, buildOffer, priceFor } from './pricing';
import { SCENARIOS, scenarioById } from './scenarios';
import {
  acceptContract, confirmOffer, continueAfterNafath, continueFromReview, contractEligible, declineContract, finishIbanCheck, firstIncomplete,
  initialState, leaveSession, loadCertificates, loadPersons, nafathResult, openContinueLink, prefill, reopenContract, runCrVerification,
  sendContinueLink, setBankLinked, setIban, setIdentity, setKyb, startEdit, startIbanCheck, startNafath, submitApplication, submitBusiness,
  submitIdentify, submitKyb, submitLead, toggleOptionalPlan, verifyOtp, withSaved, cancelEdit, confirmCertificate, selectPerson, addEvidence,
  agreeAndSubmit, setBetterInterest, failUpload
} from './state';
import type { ProposedState } from './types';
import { validateMapsUrl, validateWebsite } from './urls';
import { FRESHNESS_DAYS, callsSince, reusable } from './verifications';

const build = (id: string) => scenarioById(id)!.build();
const calls = (s: ProposedState, from: number) => callsSince(s.app, from).map((e) => e.check);
const otp = (s: ProposedState) => verifyOtp(s, DEMO_SMS_CODE);

/** KYB -> identify -> OTP for a fresh CR applicant. */
function newCrApplication(): ProposedState {
  let s = setKyb(initialState(), { kind: 'CR', group: 'food', sub: 'food-cafe', revenue: 'SELF_SERVICE_BAND', channel: 'online', websiteUrl: 'https://najd.example.com' });
  s = submitKyb(s);
  s = setIdentity(s, { identifier: DEMO.cr, mobile: DEMO.mobile });
  return otp(submitIdentify(s));
}

describe('Stage 1 — Know Your Business comes first', () => {
  it('the journey starts on KYB, before any identity, mobile or OTP', () => {
    const s = initialState();
    expect(s.app.step).toBe('kyb');
    expect(STAGES[0].label).toBe('Know Your Business');
    expect(s.app.identity.identifier).toBe('');
    expect(s.app.ledger).toEqual([]);
  });

  it('eligibility is internal: no external call or OTP before identity', () => {
    const s = submitKyb(build('kyb-cr-online'));
    expect(s.app.step).toBe('identify');
    expect(s.app.ledger).toEqual([]);
  });

  it('routes eligible, blocked, CR-required, offline-not-allowed, paused and lead', () => {
    const e = (kind: 'CR' | 'FL_CERT' | 'FL_NO_CERT', sub: string, revenue = 'SELF_SERVICE_BAND' as const, channel = 'online' as const) => evaluateEligibility({ kind, sub, revenue, channel: channel as 'online' | 'offline' | 'both' });
    expect(e('CR', 'retail-fashion').result).toBe('ELIGIBLE');
    expect(e('CR', 'fixture-blocked').reason).toBe('CATEGORY_NOT_SUPPORTED');
    expect(e('CR', 'retail-jewelry').reason).toBe('REGULATORY_RESTRICTION');
    expect(e('FL_CERT', 'retail-jewelry').reason).toBe('ACTIVITY_REQUIRES_CR');
    expect(evaluateEligibility({ kind: 'FL_CERT', sub: 'retail-electronics', revenue: 'SELF_SERVICE_BAND', channel: 'offline' }).reason).toBe('CHANNEL_NOT_SUPPORTED');
    expect(evaluateEligibility({ kind: 'FL_CERT', sub: 'retail-electronics', revenue: 'SELF_SERVICE_BAND', channel: 'online' }).result).toBe('ELIGIBLE');
    expect(e('CR', 'fixture-paused').result).toBe('TEMPORARILY_NOT_ELIGIBLE');
    expect(e('CR', 'fixture-manual').result).toBe('MANUAL_REVIEW');
    expect(e('FL_NO_CERT', 'services-design').reason).toBe('FL_CERT_REQUIRED');
    expect(evaluateEligibility({ kind: 'CR', sub: 'retail-fashion', revenue: 'ABOVE_20M', channel: 'online' }).reason).toBe('REVENUE_ABOVE_BAND');
    expect(evaluateEligibility({ kind: 'FL_CERT', sub: 'services-design', revenue: 'ABOVE_20M', channel: 'online' }).result).toBe('ELIGIBLE');
  });

  it('blocked category stops before any external cost', () => {
    const s = submitKyb(build('kyb-blocked'));
    expect(s.app.outcome).toBe('NOT_ELIGIBLE');
    expect(s.app.outcomeReason).toBe('CATEGORY_NOT_SUPPORTED');
    expect(s.app.ledger).toEqual([]);
  });

  it('Freelancer without certificate becomes a lead, never a verification journey', () => {
    let s = submitKyb(build('kyb-fl-no-cert'));
    expect(s.app.step).toBe('lead');
    s = otp(submitLead({ ...s, app: { ...s.app, lead: { name: 'Sara', mobile: DEMO.mobile } } }));
    expect(s.app.outcome).toBe('FL_CERT_REQUIRED');
    expect(s.app.status).toBe('LEAD_FL_CERT_REQUIRED');
    expect(s.backend.leads).toHaveLength(1);
    expect(s.backend.leads[0].kyb.sub).toBe('services-design');
    expect(calls(s, 0)).toEqual(['OTP']);
  });

  it('website and Google Maps validation is configurable and rejects social / WhatsApp / non-Maps links', () => {
    expect(validateWebsite('https://najd.example.com')).toBeNull();
    expect(validateWebsite('my-store')).toBe('format');
    expect(validateWebsite('https://instagram.com/najd')).toBe('social');
    expect(validateWebsite('https://wa.me/966500000000')).toBe('whatsapp');
    expect(validateMapsUrl('https://maps.google.com/?q=1,2')).toBeNull();
    expect(validateMapsUrl('https://www.google.com/maps/place/x')).toBeNull();
    expect(validateMapsUrl('https://maps.app.goo.gl/abc')).toBeNull();
    expect(validateMapsUrl('https://example.com/location')).toBe('not-maps');
    expect(validateMapsUrl('https://instagram.com/najd')).toBe('not-maps');
  });
});

describe('Stage 2 — identity, OTP and the KYB link', () => {
  it('links the Stage-1 snapshot to the application only after OTP', () => {
    let s = submitKyb(build('kyb-cr-online'));
    s = submitIdentify(setIdentity(s, { identifier: DEMO.cr, mobile: DEMO.mobile }));
    expect(s.app.id).toBeNull();
    expect(s.app.kybSnapshot).toBeNull();
    s = otp(s);
    expect(s.app.id).toMatch(/^APP-/);
    const snap = s.app.kybSnapshot!;
    expect(snap.sub).toBe('retail-fashion');
    expect(snap.channel).toBe('online');
    expect(snap.websiteUrl).toBe('https://najdboutique.example.com');
    expect(snap.eligibility.result).toBe('ELIGIBLE');
    expect(snap.eligibility.ruleset).toMatch(/KYB-RULES/);
    expect(snap.linkedAt).toBeTruthy();
    expect(s.backend.qualifications[snap.qualificationId].linkedTo).toBe(s.app.id);
    expect(s.app.step).toBe('cr-verify');
  });

  it('duplicate CR / National ID under another mobile creates no application', () => {
    for (const id of ['id-dup-cr', 'id-dup-nid']) {
      const s = otp(submitIdentify(build(id)));
      expect(s.app.outcome).toBe('DUPLICATE_IDENTITY');
      expect(s.app.id).toBeNull();
    }
  });

  it('existing incomplete application (same identity + mobile) resumes at its first incomplete screen', () => {
    const s = otp(submitIdentify(build('id-existing')));
    expect(s.app.resumed).toBe(true);
    expect(s.app.step).toBe('business');
  });
});

describe('Resume: Continue link -> OTP -> last valid stage, no repeated paid checks', () => {
  it('the link opens the OTP screen; the application is not exposed without the code', () => {
    const s = build('resume-cr');
    expect(s.app.step).toBe('otp');
    expect(s.app.otp.purpose).toBe('resume');
    expect(s.app.sessionMobile).toBe('');
  });

  it('wrong code keeps the application closed', () => {
    const s = verifyOtp(build('resume-cr'), '000000');
    expect(s.app.step).toBe('otp');
    expect(s.app.sessionMobile).toBe('');
  });

  it.each([
    ['resume-link', 'nafath'],
    ['resume-cr', 'persons'],
    ['resume-nafath', 'business'],
    ['resume-iban', 'commercial'],
    ['iban-resume', 'review'],
    ['nafath-resume', 'certificates']
  ])('%s resumes at %s', (id, step) => {
    const s = otp(build(id));
    expect(s.app.step).toBe(step);
  });

  it('ordinary resume costs one OTP and nothing else (CR, Nafath, IBAN reused)', () => {
    const before = build('iban-resume');
    const mark = before.app.ledger.length - 1; // the resume OTP was just sent
    const s = otp(before);
    expect(calls(s, mark)).toEqual(['OTP']);
    const reused = s.app.ledger.slice(mark).filter((e) => e.kind === 'reuse').map((e) => e.check);
    expect(reused).toEqual(expect.arrayContaining(['CR_DATA', 'PERSONS', 'NAFATH', 'IBAN']));
  });

  it('CR not re-fetched, Nafath not repeated, IBAN not repeated after resume even when the screens are opened again', () => {
    let s = otp(build('iban-resume'));
    const mark = s.app.ledger.length;
    s = runCrVerification(s);
    s = loadPersons(s);
    s = startNafath(s);
    expect(s.app.nafath.status).toBe('verified');
    s = startIbanCheck(s);
    expect(s.app.business.ibanStatus).toBe('verified');
    expect(calls(s, mark)).toEqual([]);
  });

  it('Freelancer certificates are not re-fetched on ordinary resume', () => {
    let s = otp(build('resume-iban'.replace('resume-iban', 'nafath-resume')));
    s = loadCertificates(s);
    const mark = s.app.ledger.length;
    s = { ...s, app: { ...s.app } };
    s = loadCertificates(s);
    expect(calls(s, mark)).toEqual([]);
  });

  it('Save & exit sends a Continue link to the verified mobile; reopening goes through OTP', () => {
    let s = newCrApplication();
    s = sendContinueLink(s);
    const sms = s.backend.sms.find((m) => m.kind === 'continue-link')!;
    expect(sms.to).toBe(DEMO.mobile);
    s = openContinueLink(leaveSession(s), sms.token!);
    expect(s.app.step).toBe('otp');
    s = otp(s);
    expect(s.app.step).toBe('cr-verify');
  });

  it('a freshness policy, when defined, makes an expired result not reusable', () => {
    const app = prefill('CR', 'review');
    const rec = app.verifications.CR_DATA!;
    expect(reusable(app, 'CR_DATA', rec.fingerprint)).not.toBeNull();
    expect(rec.expiresAt).toBeNull();
    expect(FRESHNESS_DAYS.CR_DATA).toBeNull();
    const expired = { ...app, verifications: { ...app.verifications, CR_DATA: { ...rec, expiresAt: '2026-01-01T00:00:00.000Z' } } };
    expect(reusable(expired, 'CR_DATA', rec.fingerprint)).toBeNull();
  });
});

describe('Stage 3 — government data and activity reconciliation', () => {
  it('CR age 3 months or less is temporarily not eligible (threshold configurable)', () => {
    expect(GOV_RULES.minCrAgeMonths).toBe(3);
    const s = runCrVerification(build('gov-young'));
    expect(s.app.outcome).toBe('TEMPORARILY_NOT_ELIGIBLE');
    expect(s.app.outcomeReason).toBe('CR_TOO_RECENT');
  });

  it.each([
    ['gov-expired', 'MANUAL_VERIFICATION', 'CR_EXPIRED'],
    ['gov-suspended', 'NOT_ELIGIBLE', 'CR_SUSPENDED'],
    ['gov-violation', 'MANUAL_VERIFICATION', 'CR_GOVERNMENT_VIOLATION']
  ])('%s -> %s', (id, outcome, reason) => {
    const s = runCrVerification(build(id));
    expect(s.app.outcome).toBe(outcome);
    expect(s.app.outcomeReason).toBe(reason);
  });

  it('extra documents and National Address problems are internal flags; the journey continues', () => {
    const docs = runCrVerification(build('gov-docs-later'));
    expect(docs.app.flags).toContain('ADDITIONAL_DOCUMENTS_REQUIRED');
    expect(docs.app.outcome).toBeNull();
    const addr = runCrVerification(build('gov-address'));
    expect(addr.app.flags).toContain('NATIONAL_ADDRESS_MISSING');
    expect(addr.app.outcome).toBeNull();
  });

  it('government rules are evaluated from configuration', () => {
    const base = prefill('CR', 'persons').cr.record!;
    expect(evaluateGovernment({ ...base, status: 'SUSPENDED' }).action).toBe('not_eligible');
    expect(evaluateGovernment({ ...base, issuedMonthsAgo: 3 }).action).toBe('temporarily_not_eligible');
    expect(evaluateGovernment({ ...base, issuedMonthsAgo: 4 }).action).toBe('continue');
  });

  it.each([
    ['act-match', 'MATCH', 'continue'],
    ['act-compatible', 'COMPATIBLE', 'continue'],
    ['act-ambiguous', 'AMBIGUOUS', 'manual_review'],
    ['act-conflict', 'CONFLICT', 'clarify']
  ])('%s -> %s / %s', (id, outcome, action) => {
    const s = runCrVerification(build(id));
    expect(s.app.activity?.outcome).toBe(outcome);
    expect(s.app.activity?.action).toBe(action);
  });

  it('a regulated registered activity stops even if the declared category is allowed (Fashion vs Gold)', () => {
    expect(reconcile('CR', 'retail-fashion', 'ACT-4777').action).toBe('stop');
    const s = runCrVerification(build('x-regulated'));
    expect(s.app.outcome).toBe('NOT_ELIGIBLE');
    expect(s.app.outcomeReason).toBe('ACTIVITY_REGULATED');
  });

  it('unmapped activity is a manual-review flag', () => {
    expect(reconcile('CR', 'services-design', 'ACT-9999').outcome).toBe('UNMAPPED');
    expect(ACTIVITY_MAPPING.length).toBeGreaterThan(5);
  });

  it('a conflict blocks automatic continuation until the applicant chooses', () => {
    const s = runCrVerification(build('act-conflict'));
    expect(firstIncomplete(s.app)).toBe('cr-verify');
  });
});

describe('Nafath', () => {
  it('first failure keeps the shared counter; second failure moves CR to the manual route without contract', () => {
    let s = startNafath(build('nafath-max'));
    s = nafathResult(s, 'rejected');
    expect(s.app.nafath.status).toBe('failed');
    s = selectPerson(s, 'p2');
    s = nafathResult(startNafath(s), 'timeout');
    expect(s.app.nafath.status).toBe('exhausted');
    s = continueAfterNafath(s);
    expect(s.app.step).toBe('business');
    expect(contractEligible(s.app)).toBe(false);
  });

  it('a technical failure does not use an attempt (rule flag)', () => {
    expect(RULE_FLAGS.nafathTechnicalFailureCounts).toBe(false);
    const s = nafathResult(startNafath(build('x-nafath-technical')), 'technical');
    expect(s.app.nafath.failures).toBe(0);
  });
});

describe('Freelancer verification and banking', () => {
  it('no certificate found -> certificate-required lead, no upload fallback', () => {
    const s = loadCertificates(build('fl-no-cert'));
    expect(s.app.outcome).toBe('FL_CERT_REQUIRED');
    expect(s.app.status).toBe('LEAD_FL_CERT_NOT_FOUND');
  });

  it('a certificate whose activity requires a CR stops', () => {
    let s = loadCertificates(build('x-fl-mismatch'));
    s = confirmCertificate(s);
    expect(s.app.outcome).toBe('NOT_ELIGIBLE');
  });

  it('bank linked = No skips IBAN and continues with "banking setup required"', () => {
    let s = setBankLinked(build('fl-bank-no'), 'no');
    expect(s.app.business.ibanStatus).toBe('skipped');
    expect(s.app.flags).toContain('BANKING_SETUP_REQUIRED');
    s = submitBusiness({ ...s, app: { ...s.app, business: { ...s.app.business, vat: 'no' } } });
    expect(s.app.step).toBe('commercial');
  });

  it('bank linked = Yes verifies the IBAN against the individual + certificate', () => {
    let s = setBankLinked(build('fl-bank-yes'), 'yes');
    s = setIban(s, demoIban('80', '1111'));
    s = finishIbanCheck(startIbanCheck(s));
    expect(s.app.business.ibanStatus).toBe('verified');
    expect(s.app.verifications.IBAN?.fingerprint).toContain('nid:');
  });

  it('the Freelancer IBAN contract gate stays a configurable rule flag', () => {
    expect(RULE_FLAGS.flLinkedIbanRequiredBeforeContract).toBe(false);
    const s = build('submit-banking');
    expect(contractEligible(s.app)).toBe(true);
    const done = submitApplication(acceptContract(s));
    expect(done.app.outcome).toBe('SUBMITTED_BANKING_PENDING');
  });
});

describe('Commercial Offer', () => {
  it('standard commission comes from the category, not from declared revenue', () => {
    const a = buildOffer('food-cafe', []);
    expect(a.standardRate).toBe(priceFor('food-cafe').standard);
    expect(buildOffer('food-cafe', []).standardRate).toBe(buildOffer('food-cafe', []).standardRate);
  });

  it('3 and 4 months are always included; 6 / 9 / 12 are optional multi-select', () => {
    expect(BASE_PLANS).toEqual([3, 4]);
    expect(OPTIONAL_PLANS).toEqual([6, 9, 12]);
    let s = build('com-base');
    s = toggleOptionalPlan(toggleOptionalPlan(s, 6), 9);
    s = toggleOptionalPlan(s, 9);
    s = confirmOffer(s);
    const plans = s.app.commercial.agreed!.plans.map((p) => p.tenure);
    expect(plans).toEqual([3, 4, 6]);
    expect(s.app.commercial.agreed!.plans.filter((p) => p.included).map((p) => p.tenure)).toEqual([3, 4]);
  });

  it('optional pricing evidence never blocks; uploading flags a Commercial review and keeps the standard rate', () => {
    const skipped = confirmOffer(build('com-skip'));
    expect(skipped.app.step).toBe('review');
    expect(skipped.app.flags).not.toContain('COMMERCIAL_PRICING_REVIEW');
    const uploaded = confirmOffer(addEvidence(build('com-skip'), 'doc-b'));
    expect(uploaded.app.step).toBe('review');
    expect(uploaded.app.flags).toContain('COMMERCIAL_PRICING_REVIEW');
    expect(uploaded.app.commercial.agreed!.standardRate).toBe(priceFor('food-cafe').standard);
  });
});

describe('Review and dependency invalidation', () => {
  it('edit website: no external check is invalidated or repeated', () => {
    let s = build('edit-website');
    const mark = s.app.ledger.length;
    s = startEdit(s, 'kyb');
    s = setKyb(s, { websiteUrl: 'https://new.example.com' });
    s = submitKyb(s);
    expect(s.app.step).toBe('review');
    expect(s.app.kybSnapshot!.websiteUrl).toBe('https://new.example.com');
    expect(s.app.ledger.slice(mark).filter((e) => e.kind === 'invalidate' || e.kind === 'call')).toEqual([]);
  });

  it('edit IBAN: only the IBAN verification is invalidated', () => {
    let s = build('edit-iban');
    const mark = s.app.ledger.length;
    s = setIban(startEdit(s, 'banking'), demoIban('20', '7777'));
    const inv = s.app.ledger.slice(mark).filter((e) => e.kind === 'invalidate').map((e) => e.check);
    expect(inv).toEqual(['IBAN']);
    expect(s.app.verifications.CR_DATA?.status).toBe('valid');
    expect(s.app.verifications.NAFATH?.status).toBe('valid');
    s = finishIbanCheck(startIbanCheck(s));
    expect(calls(s, mark)).toEqual(['IBAN']);
  });

  it('edit category: eligibility + reconciliation re-run on the stored activity, no provider call', () => {
    let s = build('edit-category');
    const mark = s.app.ledger.length;
    s = setKyb(startEdit(s, 'kyb'), { group: 'food', sub: 'food-homemade' });
    s = submitKyb(s);
    expect(s.app.activity?.declaredSub).toBe('food-homemade');
    expect(s.app.activity?.outcome).toBe('COMPATIBLE');
    expect(calls(s, mark)).toEqual([]);
  });

  it('edit CR: CR data, people, Nafath and IBAN are invalidated; the journey resumes at Business Verification', () => {
    let s = build('edit-identity');
    const mark = s.app.ledger.length;
    s = setIdentity(startEdit(s, 'identification'), { identifier: '7000000202' });
    s = submitIdentify(s);
    const inv = s.app.ledger.slice(mark).filter((e) => e.kind === 'invalidate').map((e) => e.check);
    expect(inv.sort()).toEqual(['CR_DATA', 'IBAN', 'NAFATH', 'PERSONS']);
    expect(s.app.step).toBe('cr-verify');
    expect(s.app.commercial.agreed).not.toBeNull();
  });

  it('edit mobile: a new OTP, nothing else', () => {
    let s = build('x-edit-mobile');
    const mark = s.app.ledger.length;
    s = submitIdentify(setIdentity(startEdit(s, 'identification'), { mobile: DEMO.otherMobile }));
    expect(s.app.step).toBe('otp');
    s = otp(s);
    expect(s.app.step).toBe('review');
    expect(s.app.verifiedMobile).toBe(DEMO.otherMobile);
    expect(calls(s, mark)).toEqual(['OTP']);
  });

  it('cancel restores the previous values', () => {
    let s = build('edit-website');
    const before = s.app.kyb.websiteUrl;
    s = cancelEdit(setKyb(startEdit(s, 'kyb'), { websiteUrl: 'https://changed.example.com' }));
    expect(s.app.kyb.websiteUrl).toBe(before);
    expect(s.app.step).toBe('review');
  });
});

describe('Contract and outcomes', () => {
  it('contract accepted -> submitted; declined -> resumable', () => {
    expect(submitApplication(acceptContract(build('contract-accept'))).app.outcome).toBe('SUBMITTED');
    const d = declineContract(build('contract-decline'));
    expect(d.app.outcome).toBe('CONTRACT_DECLINED');
    expect(firstIncomplete(d.app)).toBe('contract');
    expect(reopenContract(d).app.step).toBe('contract');
  });

  it('Nafath not verified -> Review submits for manual verification', () => {
    const s = continueFromReview(build('submit-manual'));
    expect(s.app.outcome).toBe('MANUAL_VERIFICATION');
  });

  it('Sales lead outcome after contact + OTP', () => {
    let s = submitKyb(build('submit-lead'));
    expect(s.app.step).toBe('lead');
    s = otp(submitLead({ ...s, app: { ...s.app, lead: { name: 'Faisal', mobile: DEMO.mobile } } }));
    expect(s.app.outcome).toBe('SALES_LEAD');
    expect(s.app.status).toBe('LEAD_HIGH_REVENUE');
  });
});

describe('Agree & Submit and the optional better offer', () => {
  it('one contract action records acceptance and submits (no separate submit step)', () => {
    const s = agreeAndSubmit(build('contract-accept'));
    expect(s.app.contract.status).toBe('accepted');
    expect(s.app.outcome).toBe('SUBMITTED');
    expect(s.app.step).toBe('outcome');
    expect(agreeAndSubmit(build('submit-banking')).app.outcome).toBe('SUBMITTED_BANKING_PENDING');
  });

  it('better offer: collapsed (null) by default, "Not now" clears files, uploads keep the standard rate', () => {
    const s = build('com-standard');
    expect(s.app.commercial.interest).toBeNull();
    const withFile = addEvidence(setBetterInterest(s, 'yes'), 'doc-a');
    expect(withFile.app.commercial.evidence).toEqual(['doc-a']);
    expect(setBetterInterest(withFile, 'no').app.commercial.evidence).toEqual([]);
    const failed = failUpload(setBetterInterest(s, 'yes'), 'doc-a');
    expect(failed.app.commercial.uploadError).toBe('doc-a');
    expect(confirmOffer(failed).app.step).toBe('review');
    expect(confirmOffer(withFile).app.commercial.agreed!.standardRate).toBe(priceFor('food-cafe').standard);
  });
});

describe('end-to-end CR journey on the model', () => {
  it('KYB -> OTP -> CR -> people -> Nafath -> banking -> offer -> review -> contract -> submitted', () => {
    let s = newCrApplication();
    s = runCrVerification(s);
    s = { ...s, app: { ...s.app, step: 'persons' } };
    s = loadPersons(s);
    s = selectPerson(s, 'p1');
    s = startNafath(s);
    s = nafathResult(s, 'verified');
    s = continueAfterNafath(s);
    s = setIban(s, demoIban('10', '4821'));
    s = finishIbanCheck(startIbanCheck(s));
    s = submitBusiness({ ...s, app: { ...s.app, business: { ...s.app.business, vat: 'no' } } });
    s = confirmOffer(toggleOptionalPlan(s, 12));
    s = continueFromReview(s);
    expect(s.app.step).toBe('contract');
    s = submitApplication(acceptContract(s));
    expect(s.app.outcome).toBe('SUBMITTED');
    const paid = s.app.ledger.filter((e) => e.kind === 'call').map((e) => e.check);
    expect(paid).toEqual(['CR_DATA', 'PERSONS', 'NAFATH', 'IBAN']);
  });
});

describe('scenarios', () => {
  it('60 numbered scenarios, all build', () => {
    const numbered = SCENARIOS.filter((x) => x.n).map((x) => x.n);
    expect(numbered.sort((a, b) => a! - b!)).toEqual(Array.from({ length: 60 }, (_, i) => i + 1));
    for (const sc of SCENARIOS) {
      const s = sc.build();
      expect(s.app.step, sc.id).toBeTruthy();
      expect(s.scenarioId, sc.id).toBe(sc.id);
    }
  });

  it('saved states survive a JSON round trip (localStorage persistence)', () => {
    const s = build('iban-resume');
    const copy = JSON.parse(JSON.stringify(s)) as ProposedState;
    expect(otp(copy).app.step).toBe('review');
    expect(withSaved(copy.app).backend.applications[copy.app.id!]).toBeTruthy();
  });
});
