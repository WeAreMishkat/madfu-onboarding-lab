import type { EvidenceRef } from '@/lab/evidence';

/**
 * Repository evidence used by the Tamara experience. IDs resolve to records under
 * competitors/tamara/ and comparison/ in the private research repository.
 *
 * Two walks back this experience (both production, partners.tamara.co):
 *  - 2026-10-07: a real July application resumed by password recovery, reopened by review, walked to
 *    bank details (TAM-JOURNEY-000008, BLOCKED by a reopen-flag deadlock).
 *  - 2026-10-14: a new Registered Business application walked to Nafath, which was not approved
 *    (TAM-JOURNEY-000010, BLOCKED), and a second new application with yearly sales above SAR 20 million
 *    walked to "Application Submitted Successfully" (TAM-JOURNEY-000011).
 *
 * Screenshots are research evidence and are never published: they show live applicant data, so they
 * are referenced by ID only (localOnly). Descriptions are short, factual and carry no live values.
 */
type Env = EvidenceRef['env'];
type Status = EvidenceRef['status'];

const D07 = '2026-10-07';
const D14 = '2026-10-14';

const shot = (id: string, description: string, date: string): EvidenceRef => ({
  id, kind: 'screenshot', status: 'OBSERVED', description, localOnly: true, date, env: 'production'
});
const aria = (id: string, description: string, date: string): EvidenceRef => ({
  id, kind: 'aria-snapshot', status: 'OBSERVED', description, localOnly: true, date, env: 'production'
});
const rule = (id: string, status: Status, description: string, date: string, env: Env = 'production'): EvidenceRef => ({
  id, kind: 'rule', status, description, date, env
});
const state = (id: string, description: string, date: string): EvidenceRef => ({
  id, kind: 'state', status: 'OBSERVED', description, date, env: 'production'
});
const journey = (id: string, description: string, date: string): EvidenceRef => ({
  id, kind: 'journey', status: 'OBSERVED', description, date, env: 'production'
});

export const R = {
  /* ---------- Journeys ---------- */
  jResumed: journey('TAM-JOURNEY-000008', 'Resumed application (reopened by review): routing, password recovery, business verification, signatory (earlier Nafath reused), bank details; BLOCKED at the bank-step deadlock.', D07),
  jNew: journey('TAM-JOURNEY-000010', 'New Registered Business application: entry -> set password -> contact -> business verification -> legal signatory -> SMS code -> Nafath. BLOCKED: the selected associate did not approve Nafath; bank and later steps not reached.', D14),
  jHigh: journey('TAM-JOURNEY-000011', 'Registered Business above SAR 20 million: entry -> set password -> contact -> "Schedule a call" -> "Application Submitted Successfully". Walked end to end.', D14),

  /* ---------- Rules: entry and routing ---------- */
  gate: rule('TAM-RULE-000046', 'OBSERVED', '"Before You Proceed" modal limits the form to businesses offering Tamara at checkout; "Sign up as a customer" diverts consumers.', D07),
  blocked: rule('TAM-RULE-000047', 'OBSERVED', 'Mobile that already owns a merchant account: sign-up blocked before any code, for both business types; no sign-in link.', D07),
  routingOld: rule('TAM-RULE-000048', 'OBSERVED', 'POST /v3/onboarding/initialize routes by mobile: unfinished application with password -> resume; merchant -> blocked. Its "new mobile -> OTP" part was never observed and is superseded by TAM-RULE-000071.', D07),
  routing: rule('TAM-RULE-000071', 'OBSERVED', 'Latest routing: merchant -> blocked; unfinished application -> "Enter your password"; new mobile -> "Set up your password" directly, with no SMS code at entry. The mobile is SMS-verified later (6 digits) at the legal-signatory step, just before Nafath.', D14),
  contact: rule('TAM-RULE-000072', 'OBSERVED', 'First application step: Business Name, Email, Estimated total yearly sales (Below / Above SAR 20 million) and the Application ID. Read-only after Continue (the band cannot be changed on the same mobile); the Application ID then shows a Salesforce-style lead id.', D14),
  bizVerifyNew: rule('TAM-RULE-000073', 'OBSERVED', 'Business verification checks the Unified National Number on Verify (3 attempts). Cancelled registration: "Your commercial registration has been cancelled." and one attempt used (Verify 2 / 3). Active registration: straight to the legal signatory. Category and sub-category required.', D14),
  signatoryNew: rule('TAM-RULE-000074', 'OBSERVED', 'Legal signatory: pick one registry associate (masked name and ID) -> Verify -> 6-digit SMS mobile verification -> "Verify with Nafath" number matching. The Nafath push goes to the selected associate, not to the applicant.', D14),
  high: rule('TAM-RULE-000075', 'OBSERVED', 'Yearly sales Above SAR 20 million: no business verification, signatory, Nafath or bank step. "Schedule a call to complete your setup" (website URL + preferred contact time), then "Application Submitted Successfully" (review within 24 hours).', D14),
  emailUnique: rule('TAM-RULE-000076', 'OBSERVED', 'The application email must be unique: a reused email is refused on the contact step ("This email is already registered. Try signing in instead.").', D14),
  session: rule('TAM-RULE-000077', 'OBSERVED', 'A signed-in onboarding session takes precedence over a new mobile: Step 1 with a different mobile while signed in leads back to the signed-in application. Log out first to start a separate application.', D14),
  nafathRejected: rule('TAM-RULE-000078', 'OBSERVED', 'Selected signatory does not approve Nafath: "Nafath verification has rejected" with Try again; the application cannot move on to bank details until Nafath succeeds.', D14),

  /* ---------- Rules: resumed application (2026-10-07) ---------- */
  resetFail: rule('TAM-RULE-000049', 'OBSERVED', 'Password recovery: 6-digit SMS; otp_not_found for two consecutive fresh codes ("Verification code not found. Please request a new one.").', D07),
  resend: rule('TAM-RULE-000050', 'OBSERVED', '"Resend the code" fired two concurrent resend requests (one cooldown 400, one 200).', D07),
  resetOk: rule('TAM-RULE-000051', 'OBSERVED', 'Recovery is intermittent: a later fresh code was accepted -> "Set up your password" -> the application resumes at its saved step.', D07),
  sections: rule('TAM-RULE-000052', 'OBSERVED', 'Application record sections: business verification -> legal signatory -> bank details -> business channel -> additional info -> KYC documents. The first three were walked; the last three are known only from the application payload.', D07),
  reopen: rule('TAM-RULE-000053', 'OBSERVED', 'Reopened application: reviewer reason under each flagged field ("G-maps link has no images"); only flagged fields editable; Continue disabled until each flagged field is edited (retyping the same value is enough).', D07),
  bizVerify: rule('TAM-RULE-000054', 'OBSERVED', 'Unified National Number verified automatically by Lean ("Invalid CR number"). Freelancer fields (from the session transcript only): FL number + locked account National ID + "Verify" (3 attempts). Type, number and category lock after verification.', D07),
  signatory: rule('TAM-RULE-000055', 'OBSERVED', 'Signatory picked from CR associates returned by the registry, verified with Nafath (3 attempts). On the resumed application an earlier completed Nafath session was reused without a new push.', D07),
  bank: rule('TAM-RULE-000056', 'OBSERVED', 'IBAN + SWIFT + beneficiary + IBAN certificate (<= 5 MB). "Verify account" (Lean) fetches and locks the beneficiary; English only; mismatch: "The bank details provided do not match the business number."', D07),
  deadlock: rule('TAM-RULE-000057', 'OBSERVED', 'Reopened bank step: the IBAN flag clears only when the IBAN is edited; editing forces Verify account; after verification the flag returns and the certificate is cleared, so Continue never enables.', D07),
  categories: rule('TAM-RULE-000058', 'OBSERVED', '16 categories with sub-categories, each with country_restricted and is_active flags.', D07),

  /* ---------- Rules: Help Centre (DOCUMENTED) ---------- */
  docs: rule('TAM-RULE-000040', 'DOCUMENTED', 'KSA documents: CR or Freelance Certificate; signatory National ID or passport; bank-stamped IBAN certificate; VAT certificate if applicable.', D07, 'help-centre'),
  regulated: rule('TAM-RULE-000041', 'DOCUMENTED', 'Regulated categories need a CR (FL not accepted); tobacco also needs a VAT certificate.', D07, 'help-centre'),
  validity: rule('TAM-RULE-000042', 'DOCUMENTED', 'Documents official and valid >= 30 days; IBAN letter stamped; beneficiary must match the CR/FL entity.', D07, 'help-centre'),
  sla: rule('TAM-RULE-000043', 'DOCUMENTED', 'Review within 1 business day; no edits while under review; outcome emailed.', D07, 'help-centre'),
  juro: rule('TAM-RULE-000044', 'DOCUMENTED', 'Merchant contract sent by email for e-signature via Juro.', D07, 'help-centre'),
  cancel: rule('TAM-RULE-000045', 'DOCUMENTED', 'Cancelling an application needs a signed and stamped letter on company letterhead.', D07, 'help-centre'),

  /* ---------- States: entry ---------- */
  stPhoneErr: state('TAM-STATE-000017', 'Phone validation: "Saudi Arabia phone number must be 9 digits and start with 5"; Continue disabled.', D07),
  stStep1: state('TAM-STATE-000018', 'Step 1 filled (Registered Business + mobile) before Continue; HD recapture 2026-10-14.', D14),
  stGate: state('TAM-STATE-000019', 'Before You Proceed: Proceed as a business / Sign up as a customer.', D14),
  stBlocked: state('TAM-STATE-000020', 'Phone already registered: inline message, no code sent, no sign-in link.', D07),

  /* ---------- States: new application (2026-10-14) ---------- */
  stNewPw: state('TAM-STATE-000071', 'New mobile: "Set up your password" straight after Before You Proceed; no SMS code at this point.', D14),
  stContactEmpty: state('TAM-STATE-000072', 'Get your business set up: Application ID (P-number), Business Name, Email, Estimated total yearly sales; Logout in the header.', D14),
  stSalesBands: state('TAM-STATE-000073', 'Estimated total yearly sales: Below SAR 20 million / Above SAR 20 million.', D14),
  stContactFilled: state('TAM-STATE-000074', 'Contact step filled (Below SAR 20 million): Continue enabled.', D14),
  stContactLocked: state('TAM-STATE-000075', 'Back from business verification: contact step read-only; Application ID now a Salesforce-style lead id.', D14),
  stBizNew: state('TAM-STATE-000076', 'Business verification, first pass: business type, Unified National Number, category (16) -> sub-category; Continue becomes Verify.', D14),
  stCrCancelled: state('TAM-STATE-000077', '"Your commercial registration has been cancelled." under the number; Verify 2 / 3.', D14),
  stSignatoryList: state('TAM-STATE-000078', '"Who is the legal signatory of <legal name>?": one card per registry associate, name partly masked, ID first 2 / last 4; Verify.', D14),
  stSignatorySms: state('TAM-STATE-000079', 'Mobile verification modal: 6-digit code to the application mobile; Change number; resend after 60 s; "OTP must be 6 digits".', D14),
  stNafath: state('TAM-STATE-000080', 'Verify with Nafath: two-digit number; open Nafath, accept, choose the number, return (up to a minute); Open Nafath App.', D14),
  stNafathRejected: state('TAM-STATE-000085', '"Nafath verification has rejected" / "We were unable to verify your info with Nafath" / Try again.', D14),

  /* ---------- States: above SAR 20 million (2026-10-14) ---------- */
  stHighContact: state('TAM-STATE-000081', 'Contact step with Above SAR 20 million: Continue leads to the schedule-a-call step instead of business verification.', D14),
  stEmailTaken: state('TAM-STATE-000082', 'Contact step: "This email is already registered. Try signing in instead." (contact-details 400).', D14),
  stSchedule: state('TAM-STATE-000083', '"Schedule a call to complete your setup": Business Name (locked), Website URL, Preferred Time to Contact (Morning 9-11, Afternoon 1-3, Evening 4-6).', D14),
  stSubmitted: state('TAM-STATE-000084', '"Application Submitted Successfully": review and reply within 24 hours; Partner Support email shown.', D14),

  /* ---------- States: resumed application (2026-10-07) ---------- */
  stResume: state('TAM-STATE-000021', 'Resume existing onboarding: "Enter your password".', D07),
  stResetOtp: state('TAM-STATE-000022', 'Password recovery: non-enumerating copy, 6-digit code, resend after 1:00.', D07),
  stResetRej: state('TAM-STATE-000023', 'Reset code rejected: "Verification code not found".', D07),
  stResetRej2: state('TAM-STATE-000024', 'Rejected again after resend.', D07),
  stSetPw: state('TAM-STATE-000025', 'Set up your password (password + confirm) after recovery.', D07),
  stReopenBiz: state('TAM-STATE-000026', 'Business verification reopened by review: reason under each field; category locked.', D07),
  stBankReopen: state('TAM-STATE-000029', 'Bank details reopened: IBAN, beneficiary, SWIFT, IBAN certificate (<= 5 MB).', D07),
  stLocked: state('TAM-STATE-000030', 'Business type, Unified National Number ("Verified") and category disabled after CR verification.', D07),
  stDeadlock: state('TAM-STATE-000031', 'Reopened bank deadlock: IBAN flag returns after Verify account; certificate cleared.', D07),
  stVerifyAcct: state('TAM-STATE-000032', 'Verify account: beneficiary fetched from the bank and locked; certificate required again.', D07),

  /* ---------- Evidence files ---------- */
  step1Fields: { id: 'TAM-EVID-000074', kind: 'aria-snapshot', status: 'OBSERVED', description: 'Field inventory of the sign-up form: business type, +966/+971, 9-digit phone, optional consent, Continue disabled until valid.', date: D07, env: 'production', localOnly: true } as EvidenceRef,
  helpExtract: { id: 'TAM-EVID-000075', kind: 'help-centre', status: 'DOCUMENTED', description: 'Help-centre extract: KSA document list, CR-only categories, validity rules, 1-business-day review, Juro contract email.', date: D07, env: 'help-centre' } as EvidenceRef,
  netRouting: { id: 'TAM-EVID-000079', kind: 'network', status: 'OBSERVED', description: 'Sign-up routing log: business gate, registered-phone block, resume by password, forgot-password code failures.', date: D07, env: 'production' } as EvidenceRef,
  netResumed: { id: 'TAM-EVID-000093', kind: 'network', status: 'OBSERVED', description: 'Resumed application log and session transcript: details payload sections, Lean and Nafath configs, categories, signatory (Nafath reuse), Lean bank verification, reopen flags, deadlock; Freelancer field names seen when the type was switched.', date: D07, env: 'production' } as EvidenceRef,

  shotStep1: shot('TAM-EVID-000070', 'Registered Business selected: phone (+966) and consent revealed.', D07),
  shotFlStep1: shot('TAM-EVID-000071', 'Freelancer selected on Step 1 (Continue not pressed): same pre-code fields as Registered Business.', D07),
  shotPhoneErr: shot('TAM-EVID-000072', 'Invalid phone message; Continue disabled.', D07),
  shotStep1Hd: shot('TAM-EVID-000155', 'Step 1 with Registered Business and a mobile, before Continue (HD).', D14),
  shotGate: shot('TAM-EVID-000081', 'Before You Proceed: business-only gate.', D07),
  ariaGate: aria('TAM-EVID-000082', 'Before You Proceed: structure.', D07),
  shotGateHd: shot('TAM-EVID-000156', 'Before You Proceed (HD).', D14),
  shotBlocked: shot('TAM-EVID-000083', 'Phone already registered: sign-up blocked.', D07),
  ariaBlocked: aria('TAM-EVID-000084', 'Phone already registered: structure.', D07),

  shotNewPw: shot('TAM-EVID-000142', 'New mobile: "Set up your password", no code at entry.', D14),
  shotContactEmpty: shot('TAM-EVID-000143', 'Contact step empty.', D14),
  shotSalesBands: shot('TAM-EVID-000144', 'Yearly sales select open: two bands.', D14),
  shotContactFilled: shot('TAM-EVID-000145', 'Contact step filled, Below SAR 20 million.', D14),
  shotContactLocked: shot('TAM-EVID-000146', 'Contact step locked after Continue; lead id shown.', D14),
  shotBizNew1: shot('TAM-EVID-000147', 'Business verification, first pass (empty).', D14),
  shotBizNew2: shot('TAM-EVID-000148', 'Business verification, first pass (category chosen).', D14),
  shotBizNew3: shot('TAM-EVID-000149', 'Business verification, first pass (sub-category, Verify).', D14),
  shotCrCancelled: shot('TAM-EVID-000150', 'Cancelled CR message; Verify 2 / 3.', D14),
  shotSignatory1: shot('TAM-EVID-000151', 'Legal signatory list (masked associates).', D14),
  shotSignatory2: shot('TAM-EVID-000152', 'Legal signatory list with one associate selected.', D14),
  shotSignatorySms: shot('TAM-EVID-000153', 'Mobile verification: 6-digit SMS before Nafath.', D14),
  shotNafath: shot('TAM-EVID-000154', 'Verify with Nafath: number matching.', D14),
  shotNafathRejected: shot('TAM-EVID-000164', 'Nafath verification has rejected (Try again).', D14),
  shotHighContact: shot('TAM-EVID-000157', 'Contact step with Above SAR 20 million.', D14),
  shotEmailTaken: shot('TAM-EVID-000158', 'Contact step: email already registered.', D14),
  shotSchedule1: shot('TAM-EVID-000159', 'Schedule a call: banner and Business Name.', D14),
  shotSchedule2: shot('TAM-EVID-000160', 'Schedule a call: Website URL.', D14),
  shotSchedule3: shot('TAM-EVID-000161', 'Schedule a call: preferred time options.', D14),
  shotSchedule4: shot('TAM-EVID-000162', 'Schedule a call: filled, Continue.', D14),
  shotSubmitted: shot('TAM-EVID-000163', 'Application Submitted Successfully (above SAR 20 million).', D14),

  shotResume: shot('TAM-EVID-000085', 'Resume existing onboarding: Enter your password.', D07),
  ariaResume: aria('TAM-EVID-000086', 'Resume: structure.', D07),
  shotResetOtp: shot('TAM-EVID-000087', 'Forgot-password flow with a 6-digit mobile verification.', D07),
  shotResetRej: shot('TAM-EVID-000089', 'Reset code rejected: Verification code not found.', D07),
  shotResetRej2: shot('TAM-EVID-000091', 'Reset code rejected again after resend.', D07),
  shotSetPw: shot('TAM-EVID-000094', 'Set up your password (after recovery).', D07),
  shotReopenBiz: shot('TAM-EVID-000096', 'Business verification reopened by review (G-maps link has no images).', D07),
  ariaReopenBiz: aria('TAM-EVID-000097', 'Business verification reopened: structure.', D07),
  shotBankReopen: shot('TAM-EVID-000100', 'Bank details: reopened.', D07),
  ariaBankReopen: aria('TAM-EVID-000101', 'Bank details reopened: structure.', D07),
  shotLocked: shot('TAM-EVID-000102', 'Business type locked after CR verification.', D07),
  shotDeadlock: shot('TAM-EVID-000104', 'Reopened bank deadlock: IBAN flag returns after Verify account.', D07),
  shotVerifyAcct: shot('TAM-EVID-000106', 'Verify account: beneficiary fetched from the bank and locked.', D07),
  ariaVerifyAcct: aria('TAM-EVID-000107', 'Verify account: structure.', D07)
} as const;
