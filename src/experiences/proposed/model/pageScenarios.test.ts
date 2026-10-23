import { describe, expect, it } from 'vitest';
import { DETAILED_BOARD } from './boards';
import { NOT_IMPLEMENTED, OPEN_ITEMS } from './decisions';
import { PAGE_SCENARIOS, pageScenarios } from './pageScenarios';
import { scenarioById } from './scenarios';
import { initialSim, initialState, openContinueLink, leaveSession, sendContinueLink, submitIdentify, submitKyb } from './state';
import type { ProposedState, StepId } from './types';
import { FLAG_LABEL, REASON_LABEL, STATUS_LABEL } from './copy';

const build = (id: string) => scenarioById(id)!.build();
/** Every visible word on the panel for a state: page title, intro, group titles, option labels. */
const text = (s: ProposedState) => {
  const { page, groups } = pageScenarios(s);
  return [page.title, page.intro, ...page.integrations, ...groups.flatMap((g) => [g.title, g.note ?? '', ...g.options.map((o) => o.label)])].join(' | ');
};
const labels = (s: ProposedState) => pageScenarios(s).groups.flatMap((g) => g.options.map((o) => o.label));

/** One representative state per screen. */
const AT: Partial<Record<StepId, () => ProposedState>> = {
  kyb: () => build('kyb-cr-both'),
  identify: () => build('id-new-cr'),
  otp: () => submitIdentify(build('id-new-cr')),
  'cr-verify': () => build('act-match'),
  persons: () => build('x-no-people'),
  nafath: () => build('nafath-ok'),
  certificates: () => build('fl-cert'),
  business: () => build('iban-ok'),
  commercial: () => build('com-6'),
  review: () => build('edit-website'),
  contract: () => build('contract-accept')
};

describe('Page Scenarios are page-specific', () => {
  it('every screen has a definition', () => {
    for (const step of ['kyb', 'lead', 'identify', 'otp', 'cr-verify', 'persons', 'nafath', 'certificates', 'business', 'commercial', 'review', 'contract', 'outcome'] as StepId[]) {
      expect(PAGE_SCENARIOS[step], step).toBeTruthy();
    }
  });

  it('OTP page shows only OTP cases', () => {
    const s = AT.otp!();
    expect(s.app.step).toBe('otp');
    expect(labels(s)).toEqual(['Verified', 'Incorrect code', 'Expired / timed out', 'All attempts failed', 'Resend code', 'Edit mobile number']);
    expect(text(s)).not.toMatch(/\bCR\b|Nafath|IBAN|categor|commission|contract|certificate|plan/i);
  });

  it('resumed OTP page: same OTP cases (no Edit mobile), backend reuse stays in the Internal view', () => {
    let s = sendContinueLink(build('iban-resume'));
    s = openContinueLink(leaveSession(s), Object.keys(s.backend.tokens).pop()!);
    expect(labels(s)).toEqual(['Verified', 'Incorrect code', 'Expired / timed out', 'All attempts failed', 'Resend code']);
    expect(text(s)).not.toMatch(/reused|Nafath|IBAN/i);
  });

  it('CR page shows no OTP / Nafath / IBAN cases, and includes the category ↔ activity outcomes', () => {
    const s = AT['cr-verify']!();
    const t = text(s);
    expect(t).not.toMatch(/OTP|\bcode\b|Nafath|IBAN/i);
    expect(t).toMatch(/CR 3 months old or less/);
    expect(t).toMatch(/National Address missing/);
    expect(labels(s)).toEqual(expect.arrayContaining(['Match', 'Conflict', 'Not in the mapping']));
  });

  it('Nafath page shows only Nafath answers and attempts', () => {
    const s = AT.nafath!();
    expect(labels(s)).toEqual(['Verified', 'Rejected', 'Timeout', 'Technical failure', 'First failure — retry available', 'Final failed attempt → manual route']);
    expect(text(s)).not.toMatch(/OTP|IBAN|certificate|commission|categor/i);
  });

  it('banking page shows only banking controls (and the Freelancer bank-link question for Freelancers)', () => {
    const cr = AT.business!();
    expect(text(cr)).not.toMatch(/Nafath|OTP|categor|contract|commission/i);
    expect(labels(cr)).toEqual(expect.arrayContaining(['Verified', 'Ownership mismatch (first failed attempt)', 'Previously verified (resume) → reused']));
    expect(labels(cr).some((l) => /linked/.test(l))).toBe(false);
    const fl = build('fl-bank-yes');
    expect(labels(fl)).toEqual(['Yes → show IBAN', 'No / not yet → skip IBAN (banking setup required)']);
  });

  it('Commercial Offer shows commercial controls; plans are multi-selected on the page, not as scenario combinations', () => {
    const s = AT.commercial!();
    expect(labels(s)).toEqual(['No documents uploaded (standard commission)', 'Optional documents uploaded → Commercial review', 'Standard plans only (3 + 4 months)']);
    expect(labels(s).some((l) => /6 \+ 9|9 \+ 12/.test(l))).toBe(false);
  });

  it('Contract shows only accept / decline, no plan or commission controls', () => {
    const s = AT.contract!();
    expect(labels(s)).toEqual(['Contract accepted', 'Contract declined']);
    expect(text(s)).not.toMatch(/6 months|9 months|12 months|select.*plan/i);
  });

  it('controls change after navigation: options of one stage disappear in the next', () => {
    const k = build('kyb-cr-online');
    const i = submitKyb(k);
    expect(i.app.step).toBe('identify');
    const before = labels(k);
    const after = labels(i);
    expect(before).toContain('Category blocked');
    expect(after).not.toContain('Category blocked');
    expect(after).toContain('New applicant');
    const o = submitIdentify(i);
    expect(labels(o)).not.toContain('New applicant');
    expect(labels(o)).toContain('Incorrect code');
  });

  it('every option on every page runs on its representative state', () => {
    for (const [step, make] of Object.entries(AT)) {
      for (const g of pageScenarios(make!()).groups) {
        for (const o of g.options) expect(() => o.run(make!()), `${step}: ${o.label}`).not.toThrow();
      }
    }
  });

  it('options simulate through the real transitions', () => {
    const otp = AT.otp!();
    const run = (s: ProposedState, label: string) => pageScenarios(s).groups.flatMap((g) => g.options).find((o) => o.label === label)!.run(s);
    expect(run(otp, 'Verified').app.step).toBe('cr-verify');
    expect(run(otp, 'Incorrect code').app.otp.status).toBe('incorrect');
    expect(run(AT['cr-verify']!(), 'CR 3 months old or less').app.outcome).toBe('TEMPORARILY_NOT_ELIGIBLE');
    expect(run(AT.nafath!(), 'Final failed attempt → manual route').app.nafath.status).toBe('exhausted');
    expect(run(AT.business!(), 'Previously verified (resume) → reused').app.ledger.at(-1)?.kind).toBe('reuse');
    expect(run(AT.contract!(), 'Contract declined').app.outcome).toBe('CONTRACT_DECLINED');
  });
});

describe('Mobile ↔ selected owner mismatch: open decision only', () => {
  const MISMATCH = /mobile.*(match|owner|national id)|mismatch.*mobile/i;

  it('is documented as an open decision, marked NOT IMPLEMENTED — DECISION REQUIRED', () => {
    const od = OPEN_ITEMS.find((o) => o.title === 'Mobile ownership vs selected authorized person')!;
    expect(od.type).toBe('PRODUCT / COMPLIANCE DECISION');
    expect(od.notImplemented).toBe(true);
    expect(NOT_IMPLEMENTED).toBe('NOT IMPLEMENTED — DECISION REQUIRED');
    expect(od.clarify).toHaveLength(10);
  });

  it('appears on the Detailed Master Board as an open-decision note near Authorized Person → Nafath, not as a branch', () => {
    const c1 = DETAILED_BOARD.find((m) => m.id === 'cr')!;
    const node = c1.nodes.find((n) => n.kind === 'open' && MISMATCH.test(`${n.label} ${n.detail}`))!;
    expect(node).toBeTruthy();
    expect(c1.edges.some((e) => e.from === node.id || e.to === node.id)).toBe(false);
    const pick = c1.nodes.find((n) => n.id === 'pick')!;
    expect(Math.abs(node.col - pick.col)).toBeLessThanOrEqual(1);
  });

  it('has no functional logic: no flag, reason, status, simulated answer or page scenario for it', () => {
    const vocab = [...Object.keys(FLAG_LABEL), ...Object.values(FLAG_LABEL), ...Object.keys(REASON_LABEL), ...Object.values(REASON_LABEL), ...Object.keys(STATUS_LABEL), ...Object.keys(initialSim())].join(' | ');
    expect(vocab).not.toMatch(MISMATCH);
    for (const make of Object.values(AT)) expect(text(make!())).not.toMatch(MISMATCH);
    expect(text(initialState())).not.toMatch(MISMATCH);
  });
});
