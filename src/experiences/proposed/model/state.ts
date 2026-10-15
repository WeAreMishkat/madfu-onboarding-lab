/**
 * Madfu Proposed — pure transitions. Components call these through `apply(fn)`; tests call them
 * directly. No transition talks to a real service: answers come from the Prototype Controls (Sim).
 */
import { LIMITS, classificationOf, findSub, isSelfService } from './config';
import {
  DEMO_SMS_CODE, NAFATH_NUMBERS, bankFromIban, certificatesAdapter, crAdapter, eligiblePersons, ibanAdapter,
  nafathAdapter, newApplicationId, personsAdapter
} from './mock';
import type { Application, InternalStatus, NafathResult, OutcomeKind, ProposedState, ReviewFlag, Sim, StepId } from './types';

/* ------------------------------------------------------------------ initial state */

export function initialSim(): Sim {
  return { identity: 'new', crResult: 'valid', persons: 'multiple', nafath: ['verified'], certificates: 'one', iban: ['verified'] };
}

export function initialApplication(seed = Date.now()): Application {
  return {
    id: newApplicationId(seed),
    createdAt: new Date(seed).toISOString(),
    step: 'entry',
    editing: null,
    entry: { type: null, identifier: '', revenue: null, mobile: '' },
    verifiedMobile: '',
    identityCheck: null,
    resumed: false,
    editBaseline: null,
    otp: { status: 'sent', attemptsLeft: LIMITS.otpAttempts, code: '', resendAt: 0 },
    category: { group: '', sub: '' },
    cr: { status: 'idle', tries: 0, record: null },
    persons: { status: 'idle', tries: 0, list: [], selectedId: null },
    nafath: { status: 'idle', failures: 0, requests: 0, lastResult: null, number: NAFATH_NUMBERS[0], verifiedPersonId: null },
    certs: { status: 'idle', tries: 0, list: [], selectedId: null, manualNumber: '' },
    business: {
      iban: '', ibanStatus: 'idle', ibanFailures: 0, ibanLast: null, bankName: '', vat: null, vatNumber: '', vatLookup: 'idle',
      channel: null, websiteUrl: '', mapsUrl: '', branches: ''
    },
    contract: { status: 'unavailable', acceptedAt: '' },
    flags: [],
    status: 'DRAFT',
    outcome: null,
    submittedAt: ''
  };
}

export function initialState(): ProposedState {
  return { app: initialApplication(), sim: initialSim(), scenarioId: null, saved: {} };
}

/* ------------------------------------------------------------------ helpers */

const withApp = (s: ProposedState, patch: Partial<Application>): ProposedState => ({ ...s, app: { ...s.app, ...patch } });
const addFlag = (flags: ReviewFlag[], f: ReviewFlag) => (flags.includes(f) ? flags : [...flags, f]);
const dropFlags = (flags: ReviewFlag[], drop: ReviewFlag[]) => flags.filter((f) => !drop.includes(f));

function finish(s: ProposedState, outcome: OutcomeKind, status: InternalStatus): ProposedState {
  return persist(withApp(s, { step: 'outcome', outcome, status, editing: null, submittedAt: new Date().toISOString() }));
}

/** Save the application in the simulated backend so it can be resumed / detected as a duplicate. */
export function persist(s: ProposedState): ProposedState {
  const { identifier, mobile } = s.app.entry;
  if (!identifier || !s.app.verifiedMobile) return s;
  const terminalNoApp = s.app.outcome && ['EXISTING_MERCHANT', 'DUPLICATE_IDENTITY', 'ADDITIONAL_CERTIFICATE', 'SALES_LEAD'].includes(s.app.outcome);
  if (terminalNoApp) return s;
  return { ...s, saved: { ...s.saved, [identifier]: { mobile, app: s.app } } };
}

/* ------------------------------------------------------------------ the path (drives Back and progress) */

export function pathFor(app: Application): StepId[] {
  const p: StepId[] = ['entry', 'otp', 'category'];
  if (app.entry.type === 'CR') {
    p.push('cr-verify', 'persons');
    if (app.persons.status !== 'none') p.push('nafath');
  } else {
    p.push('nafath');
    p.push(app.nafath.status === 'exhausted' || app.certs.status === 'none' || app.certs.manualNumber ? 'manual-certificate' : 'certificates');
  }
  p.push('business', 'review');
  if (contractEligible(app)) p.push('contract');
  p.push('outcome');
  return p;
}

export function previousStep(app: Application): StepId | null {
  const p = pathFor(app);
  const i = p.indexOf(app.step);
  if (i <= 0) return null;
  const prev = p[i - 1];
  // Never send the applicant back into a code they already verified.
  return prev === 'otp' ? 'entry' : prev;
}

export const back = (s: ProposedState): ProposedState => {
  const prev = previousStep(s.app);
  return prev ? persist(withApp(s, { step: prev, editing: null })) : s;
};

/* ------------------------------------------------------------------ entry + identity check */

/**
 * Backend checks run on Next, in the specified order: identity FIRST (CR / National ID), then the
 * saved-application match by mobile. Mobile reuse alone never rejects an application.
 */
export function identityCheck(s: ProposedState): Application['identityCheck'] {
  if (s.sim.identity !== 'new') return s.sim.identity;
  const saved = s.saved[s.app.entry.identifier];
  if (!saved || saved.app.id === s.app.id) return 'new';
  return saved.mobile === s.app.entry.mobile ? 'current_application' : 'duplicate_identity';
}

export function submitEntry(s: ProposedState): ProposedState {
  const check = identityCheck(s);
  const editingFromReview = s.app.editing === 'review';
  let app: Application = { ...s.app, identityCheck: check };

  // Editing from Review: dependent verifications are invalidated when identity values change.
  if (editingFromReview) app = invalidateForEntryChange(app);

  // Same session, same mobile: no new code.
  if (app.verifiedMobile && app.verifiedMobile === app.entry.mobile && check === 'new') {
    return routeAfterOtp({ ...s, app });
  }
  return { ...s, app: { ...app, step: 'otp', verifiedMobile: '', otp: { status: 'sent', attemptsLeft: LIMITS.otpAttempts, code: '', resendAt: Date.now() + LIMITS.otpResendSeconds * 1000 } } };
}

function invalidateForEntryChange(app: Application): Application {
  const base = app.editBaseline;
  if (!base) return app;
  const idChanged = base.type !== app.entry.type || base.identifier !== app.entry.identifier;
  if (!idChanged) return { ...app, editBaseline: null };
  return {
    ...app,
    editing: null,
    editBaseline: null,
    category: base.type !== app.entry.type ? { group: '', sub: '' } : app.category,
    cr: { status: 'idle', tries: 0, record: null },
    persons: { status: 'idle', tries: 0, list: [], selectedId: null },
    // The Nafath attempt counter belongs to the application and is not reset.
    nafath: { ...app.nafath, status: app.nafath.status === 'exhausted' ? 'exhausted' : 'idle', verifiedPersonId: null, lastResult: null },
    certs: { status: 'idle', tries: 0, list: [], selectedId: null, manualNumber: '' },
    business: { ...app.business, ibanStatus: app.business.iban ? 'idle' : app.business.ibanStatus, bankName: '' },
    contract: { status: 'unavailable', acceptedAt: '' },
    flags: dropFlags(app.flags, ['CR_EXPIRED', 'NO_ELIGIBLE_PERSON', 'CERTIFICATE_MANUAL', 'CERTIFICATE_INCONSISTENT', 'CERTIFICATE_CATEGORY_MISMATCH', 'IBAN_UNVERIFIED', 'IBAN_NOT_CHECKED'])
  };
}

/* ------------------------------------------------------------------ OTP */

export function verifyOtp(s: ProposedState, code: string): ProposedState {
  const otp = s.app.otp;
  if (otp.status === 'expired' || otp.status === 'exhausted') return s;
  if (code === DEMO_SMS_CODE) {
    return routeAfterOtp(withApp(s, { otp: { ...otp, status: 'verified', code }, verifiedMobile: s.app.entry.mobile }));
  }
  const attemptsLeft = otp.attemptsLeft - 1;
  return withApp(s, { otp: { ...otp, code, attemptsLeft, status: attemptsLeft <= 0 ? 'exhausted' : 'incorrect' } });
}

export const expireOtp = (s: ProposedState): ProposedState => withApp(s, { otp: { ...s.app.otp, status: 'expired' } });
export const resendOtp = (s: ProposedState): ProposedState =>
  withApp(s, { otp: { status: 'sent', attemptsLeft: LIMITS.otpAttempts, code: '', resendAt: Date.now() + LIMITS.otpResendSeconds * 1000 } });

/** Routing happens only after a successful code. */
export function routeAfterOtp(s: ProposedState): ProposedState {
  const { type, revenue } = s.app.entry;
  switch (s.app.identityCheck) {
    case 'existing_merchant': return finish(s, 'EXISTING_MERCHANT', 'EXISTING_MERCHANT');
    case 'duplicate_identity': return finish(s, 'DUPLICATE_IDENTITY', 'DUPLICATE_IDENTITY');
    case 'additional_certificate':
      if (type === 'FL') return finish(s, 'ADDITIONAL_CERTIFICATE', 'ADDITIONAL_CERTIFICATE_PENDING');
      return finish(s, 'EXISTING_MERCHANT', 'EXISTING_MERCHANT');
    case 'current_application': return resume(s);
    default: break;
  }
  if (!isSelfService(type!, revenue!)) {
    return finish(s, 'SALES_LEAD', revenue === 'BELOW_100K' ? 'SALES_LEAD_LOW_REVENUE' : 'SALES_LEAD_HIGH_REVENUE');
  }
  // New application → category. After an edit from Review → the first step that still needs input.
  return persist(withApp(s, { step: firstIncomplete(s.app), editing: null }));
}

/** Reopen the saved application at its last step (or a prepared demo application). */
export function resume(s: ProposedState): ProposedState {
  const saved = s.saved[s.app.entry.identifier]?.app;
  const base = saved ?? resumeFixture(s.app);
  return { ...s, app: { ...base, resumed: true, verifiedMobile: s.app.entry.mobile, otp: { ...s.app.otp, status: 'verified' }, identityCheck: 'current_application' } };
}

/** The "current application" used when the Prototype Controls force one: saved after business details started. */
function resumeFixture(app: Application): Application {
  const filled = prefill(app.entry.type ?? 'CR', 'business', initialSim(), app);
  return { ...filled, business: { ...filled.business, channel: 'online', websiteUrl: 'https://shop.example.com' } };
}

/* ------------------------------------------------------------------ category screening */

export function submitCategory(s: ProposedState): ProposedState {
  const cls = classificationOf(s.app.category.sub);
  let flags = dropFlags(s.app.flags, ['CATEGORY_MANUAL_REVIEW', 'FL_CR_ONLY_CATEGORY']);
  if (cls === 'BLOCKED') {
    // No government, Nafath or bank calls for a blocked category. Neutral confirmation only.
    return finish(withApp(s, { flags }), 'CATEGORY_REVIEW', 'CATEGORY_BLOCKED');
  }
  if (cls === 'MANUAL_REVIEW') flags = addFlag(flags, 'CATEGORY_MANUAL_REVIEW');
  if (cls === 'CR_ONLY' && s.app.entry.type === 'FL') flags = addFlag(flags, 'FL_CR_ONLY_CATEGORY');
  const next: StepId = s.app.editing === 'review' ? 'review' : s.app.entry.type === 'CR' ? 'cr-verify' : 'nafath';
  return persist(withApp(s, { flags, step: next, editing: next === 'review' ? null : s.app.editing }));
}

/* ------------------------------------------------------------------ CR verification */

export function runCrVerification(s: ProposedState): ProposedState {
  const { result, record } = crAdapter(s.sim.crResult);
  const tries = s.app.cr.tries + 1;
  let flags = dropFlags(s.app.flags, ['CR_EXPIRED']);
  if (result === 'expired') flags = addFlag(flags, 'CR_EXPIRED');
  return persist(withApp(s, { cr: { status: result, tries, record }, flags }));
}

/** Expired CR is allowed to progress (flagged internally); invalid / not found cannot continue. */
export const crCanContinue = (app: Application) => app.cr.status === 'valid' || app.cr.status === 'expired';

/* ------------------------------------------------------------------ authorised people */

export function loadPersons(s: ProposedState): ProposedState {
  const tries = s.app.persons.tries + 1;
  if (s.sim.persons === 'unavailable') return withApp(s, { persons: { ...s.app.persons, status: 'unavailable', tries } });
  const list = personsAdapter(s.sim.persons);
  const eligible = eligiblePersons(list);
  return persist(withApp(s, { persons: { status: eligible.length ? 'loaded' : 'none', tries, list, selectedId: eligible.length === 1 ? eligible[0].id : s.app.persons.selectedId } }));
}

/**
 * Changing the selected person never resets the shared attempt counter. A successful verification
 * belonged to the previously selected person, so it (and any contract) is invalidated.
 */
export function selectPerson(s: ProposedState, id: string): ProposedState {
  const n = s.app.nafath;
  const invalidate = n.status === 'verified' && n.verifiedPersonId !== id;
  const status = n.status === 'exhausted' ? 'exhausted' : n.status === 'verified' && !invalidate ? 'verified' : 'idle';
  return withApp(s, {
    persons: { ...s.app.persons, selectedId: id },
    nafath: { ...n, status, verifiedPersonId: invalidate ? null : n.verifiedPersonId },
    contract: invalidate ? { status: 'unavailable', acceptedAt: '' } : s.app.contract
  });
}

/** No eligible individual (or provider down after retries): continue to a manual authority check. */
export function continueWithoutPerson(s: ProposedState): ProposedState {
  return persist(withApp(s, {
    persons: { ...s.app.persons, status: 'none' },
    flags: addFlag(addFlag(s.app.flags, 'NO_ELIGIBLE_PERSON'), 'NAFATH_UNVERIFIED'),
    step: 'business'
  }));
}

/* ------------------------------------------------------------------ Nafath */

export const nafathRemaining = (app: Application) => Math.max(0, LIMITS.nafathAttempts - app.nafath.failures);

export function startNafath(s: ProposedState): ProposedState {
  if (s.app.nafath.failures >= LIMITS.nafathAttempts) return withApp(s, { nafath: { ...s.app.nafath, status: 'exhausted' } });
  const requests = s.app.nafath.requests + 1;
  return withApp(s, { step: 'nafath', nafath: { ...s.app.nafath, status: 'waiting', requests, number: NAFATH_NUMBERS[(requests - 1) % NAFATH_NUMBERS.length] } });
}

/** Rejected and timeout count against the shared limit; a technical failure does not (pending decision). */
export function nafathResult(s: ProposedState, result: NafathResult): ProposedState {
  const n = s.app.nafath;
  if (result === 'verified') {
    const personId = s.app.entry.type === 'CR' ? s.app.persons.selectedId : 'self';
    return persist(withApp(s, {
      nafath: { ...n, status: 'verified', lastResult: result, verifiedPersonId: personId },
      flags: dropFlags(s.app.flags, ['NAFATH_UNVERIFIED'])
    }));
  }
  const failures = result === 'technical' ? n.failures : n.failures + 1;
  const exhausted = failures >= LIMITS.nafathAttempts;
  return persist(withApp(s, {
    nafath: { ...n, status: exhausted ? 'exhausted' : 'failed', failures, lastResult: result },
    flags: exhausted ? addFlag(s.app.flags, 'NAFATH_UNVERIFIED') : s.app.flags
  }));
}

/** The answer the simulated Nafath app will give to the current request. */
export const nextNafathAnswer = (s: ProposedState) => nafathAdapter(s.sim, s.app.nafath.requests - 1);

export function continueAfterNafath(s: ProposedState): ProposedState {
  const fl = s.app.entry.type === 'FL';
  if (s.app.editing === 'review' && s.app.nafath.status === 'verified') return persist(withApp(s, { step: 'review', editing: null }));
  if (!fl) return persist(withApp(s, { step: 'business' }));
  if (s.app.nafath.status === 'verified') return persist(withApp(s, { step: 'certificates' }));
  // Freelancer, Nafath failed twice: manual route.
  return persist(withApp(s, { step: 'manual-certificate', flags: addFlag(s.app.flags, 'NAFATH_UNVERIFIED') }));
}

/* ------------------------------------------------------------------ Freelancer certificates */

export function loadCertificates(s: ProposedState): ProposedState {
  const tries = s.app.certs.tries + 1;
  const r = s.sim.certificates;
  if (r === 'unavailable') return withApp(s, { certs: { ...s.app.certs, status: 'unavailable', tries } });
  if (r === 'none') return persist(withApp(s, { certs: { ...s.app.certs, status: 'none', tries, list: [] } }));
  const list = certificatesAdapter(r);
  const selectable = list.filter((c) => c.status === 'active' && c.issue !== 'duplicate');
  return persist(withApp(s, { certs: { ...s.app.certs, status: 'loaded', tries, list, selectedId: selectable.length === 1 ? selectable[0].id : null } }));
}

export const selectCertificate = (s: ProposedState, id: string): ProposedState => withApp(s, { certs: { ...s.app.certs, selectedId: id } });

/**
 * Associate the selected certificate: duplicate check, category reconciliation and re-evaluation of
 * the restriction for the certificate's activity.
 */
export function confirmCertificate(s: ProposedState): ProposedState {
  const cert = s.app.certs.list.find((c) => c.id === s.app.certs.selectedId);
  if (!cert || cert.status !== 'active' || cert.issue === 'duplicate') return s;
  let flags = dropFlags(s.app.flags, ['CERTIFICATE_INCONSISTENT', 'CERTIFICATE_CATEGORY_MISMATCH', 'CERTIFICATE_MANUAL']);
  if (cert.issue === 'inconsistent') flags = addFlag(flags, 'CERTIFICATE_INCONSISTENT');
  if (cert.madfuSub !== s.app.category.sub) {
    flags = addFlag(flags, 'CERTIFICATE_CATEGORY_MISMATCH');
    const cls = classificationOf(cert.madfuSub);
    if (cls === 'BLOCKED') return finish(withApp(s, { flags }), 'CATEGORY_REVIEW', 'CATEGORY_BLOCKED');
    if (cls === 'MANUAL_REVIEW') flags = addFlag(flags, 'CATEGORY_MANUAL_REVIEW');
  }
  const step: StepId = s.app.editing === 'review' ? 'review' : 'business';
  return persist(withApp(s, { flags, step, editing: null }));
}

/** No certificate found, provider unavailable, or Nafath failed: the applicant types the number. */
export function submitManualCertificate(s: ProposedState): ProposedState {
  const flags = addFlag(s.app.flags, 'CERTIFICATE_MANUAL');
  return persist(withApp(s, { flags, step: s.app.editing === 'review' ? 'review' : 'business', editing: null }));
}

export const isFlCertificateNumber = (v: string) => /^\d{9}$/.test(v);

/* ------------------------------------------------------------------ bank ownership (IBAN) */

/** Freelancer on the manual route: IBAN collected without an ownership check. */
export const ibanCheckApplies = (app: Application) => !(app.entry.type === 'FL' && app.nafath.status !== 'verified');

export function startIbanCheck(s: ProposedState): ProposedState {
  if (!ibanCheckApplies(s.app)) {
    return withApp(s, { business: { ...s.app.business, ibanStatus: 'not_checked', bankName: bankFromIban(s.app.business.iban) }, flags: addFlag(s.app.flags, 'IBAN_NOT_CHECKED') });
  }
  return withApp(s, { business: { ...s.app.business, ibanStatus: 'verifying' } });
}

export function finishIbanCheck(s: ProposedState): ProposedState {
  const b = s.app.business;
  const checkIndex = b.ibanFailures; // each failure moves to the next scripted answer
  const result = ibanAdapter(s.sim, checkIndex);
  if (result === 'verified') {
    return persist(withApp(s, { business: { ...b, ibanStatus: 'verified', ibanLast: result, bankName: bankFromIban(b.iban) }, flags: dropFlags(s.app.flags, ['IBAN_UNVERIFIED']) }));
  }
  const ibanFailures = b.ibanFailures + 1;
  const done = ibanFailures >= LIMITS.ibanAttempts;
  return persist(withApp(s, {
    business: { ...b, ibanStatus: done ? 'unverified' : 'failed', ibanFailures, ibanLast: result, bankName: '' },
    flags: done ? addFlag(s.app.flags, 'IBAN_UNVERIFIED') : s.app.flags
  }));
}

/** Editing the IBAN invalidates the previous verification. The attempt counter belongs to the application. */
export function setIban(s: ProposedState, iban: string): ProposedState {
  const b = s.app.business;
  const unchanged = iban === b.iban;
  return withApp(s, {
    business: { ...b, iban, ibanStatus: unchanged ? b.ibanStatus : b.ibanFailures >= LIMITS.ibanAttempts ? 'unverified' : 'idle', bankName: unchanged ? b.bankName : '' },
    flags: unchanged ? s.app.flags : dropFlags(s.app.flags, ['IBAN_NOT_CHECKED'])
  });
}

export const ibanSettled = (app: Application) => ['verified', 'unverified', 'not_checked'].includes(app.business.ibanStatus);

export function submitBusiness(s: ProposedState): ProposedState {
  return persist(withApp(s, { step: 'review', editing: null }));
}

/* ------------------------------------------------------------------ review, edit, contract, submit */

export type SectionId = 'applicant' | 'category' | 'verification' | 'certificate' | 'bank' | 'tax' | 'channels';

export function startEdit(s: ProposedState, section: SectionId): ProposedState {
  const editBaseline = { type: s.app.entry.type, identifier: s.app.entry.identifier };
  const fl = s.app.entry.type === 'FL';
  const step: StepId =
    section === 'applicant' ? 'entry'
      : section === 'category' ? 'category'
        : section === 'verification' ? (fl ? 'nafath' : 'persons')
          : section === 'certificate' ? (s.app.certs.manualNumber ? 'manual-certificate' : 'certificates')
            : 'business';
  return withApp(s, { step, editing: 'review', editBaseline });
}

export const cancelEdit = (s: ProposedState): ProposedState => withApp(s, { step: 'review', editing: null });

/** Nafath success is the contract gate. IBAN failure after retries does not block a verified applicant. */
export function contractEligible(app: Application): boolean {
  if (app.nafath.status !== 'verified') return false;
  if (app.entry.type === 'CR') return crCanContinue(app) && app.persons.status === 'loaded';
  const cert = app.certs.list.find((c) => c.id === app.certs.selectedId);
  return !!cert && cert.status === 'active' && !app.flags.includes('CERTIFICATE_MANUAL');
}

export interface Issue { section: SectionId; message: string }

export function reviewIssues(app: Application): Issue[] {
  const out: Issue[] = [];
  const b = app.business;
  if (!app.category.sub) out.push({ section: 'category', message: 'Choose a business category.' });
  if (!b.iban) out.push({ section: 'bank', message: 'Add the IBAN for settlements.' });
  else if (!ibanSettled(app)) out.push({ section: 'bank', message: 'Finish verifying the IBAN.' });
  if (!b.vat) out.push({ section: 'tax', message: 'Answer whether you are VAT registered.' });
  if (!b.channel) out.push({ section: 'channels', message: 'Choose how you sell.' });
  if (app.entry.type === 'FL' && !app.certs.selectedId && !app.certs.manualNumber) out.push({ section: 'certificate', message: 'Select a freelance certificate.' });
  return out;
}

export function continueFromReview(s: ProposedState): ProposedState {
  if (reviewIssues(s.app).length) return s;
  if (contractEligible(s.app)) return persist(withApp(s, { step: 'contract', contract: { status: s.app.contract.status === 'accepted' ? 'accepted' : 'ready', acceptedAt: s.app.contract.acceptedAt } }));
  return finish(withApp(s, { contract: { status: 'unavailable', acceptedAt: '' } }), 'MANUAL_VERIFICATION', 'SUBMITTED_MANUAL_VERIFICATION');
}

export const acceptContract = (s: ProposedState): ProposedState =>
  withApp(s, { contract: { status: 'accepted', acceptedAt: new Date().toISOString() } });

export const submitApplication = (s: ProposedState): ProposedState =>
  s.app.contract.status === 'accepted' ? finish(s, 'SUBMITTED', 'SUBMITTED') : s;

export const declineContract = (s: ProposedState): ProposedState =>
  finish(withApp(s, { contract: { status: 'declined', acceptedAt: '' } }), 'CONTRACT_DECLINED', 'CONTRACT_DECLINED');

/** First step that still needs input, used after an edit that invalidated verifications. */
export function firstIncomplete(app: Application): StepId {
  if (!app.category.sub) return 'category';
  if (app.entry.type === 'CR') {
    if (!crCanContinue(app)) return 'cr-verify';
    if (app.persons.status === 'idle' || (app.persons.status === 'loaded' && !app.persons.selectedId)) return 'persons';
    if (app.persons.status === 'loaded' && app.nafath.status !== 'verified' && app.nafath.status !== 'exhausted') return 'nafath';
  } else {
    if (app.nafath.status !== 'verified' && app.nafath.status !== 'exhausted') return 'nafath';
    if (app.nafath.status === 'verified' && !app.certs.selectedId && !app.certs.manualNumber) return 'certificates';
    if (app.nafath.status === 'exhausted' && !app.certs.manualNumber) return 'manual-certificate';
  }
  if (!ibanSettled(app) || !app.business.vat || !app.business.channel) return 'business';
  return 'review';
}

/* ------------------------------------------------------------------ prefilled applications (scenarios, PDF) */

/**
 * A healthy self-service application filled up to (not including) `upTo`.
 * Used by scenarios, the resume fixture and the wireframe PDF.
 */
export function prefill(type: 'CR' | 'FL', upTo: StepId, sim: Sim = initialSim(), from?: Application): Application {
  const order: StepId[] = ['entry', 'otp', 'category', 'cr-verify', 'persons', 'nafath', 'certificates', 'business', 'review', 'contract', 'outcome'];
  const reach = (step: StepId) => order.indexOf(upTo) > order.indexOf(step);
  const fl = type === 'FL';
  let app = from ?? initialApplication(1_760_000_000_000);
  app = {
    ...app,
    step: upTo,
    entry: { type, identifier: fl ? ['1', '000000', '201'].join('') : '7000000101', revenue: 'SELF_SERVICE_BAND', mobile: ['5', '0000', '0012'].join('') }
  };
  if (reach('otp')) app = { ...app, verifiedMobile: app.entry.mobile, otp: { ...app.otp, status: 'verified' }, identityCheck: 'new' };
  if (reach('category')) app = { ...app, category: fl ? { group: 'services', sub: 'services-design' } : { group: 'food', sub: 'food-cafe' } };
  if (!fl && reach('cr-verify')) app = { ...app, cr: { status: 'valid', tries: 1, record: crAdapter('valid').record } };
  if (!fl && reach('persons')) {
    const list = personsAdapter(sim.persons === 'one' ? 'one' : 'multiple');
    app = { ...app, persons: { status: 'loaded', tries: 1, list, selectedId: 'p1' } };
  }
  if (reach('nafath')) app = { ...app, nafath: { ...app.nafath, status: 'verified', requests: 1, verifiedPersonId: fl ? 'self' : 'p1' } };
  if (fl && reach('certificates')) app = { ...app, certs: { status: 'loaded', tries: 1, list: certificatesAdapter('one'), selectedId: 'fl1', manualNumber: '' } };
  if (reach('business')) {
    const iban = ['SA', '00', fl ? '80' : '10', '000000', '12345678', '4821'].join('');
    app = {
      ...app,
      business: { ...app.business, iban, ibanStatus: 'verified', bankName: bankFromIban(iban), vat: 'no', channel: 'online', websiteUrl: fl ? 'https://studio.example.com' : 'https://najdroastery.example.com' }
    };
  }
  if (reach('review') && contractEligible(app)) app = { ...app, contract: { status: 'ready', acceptedAt: '' } };
  return app;
}

export function categoryLabel(app: Application): string {
  const f = findSub(app.category.sub);
  return f ? `${f.group.label} › ${f.sub.label}` : '';
}
