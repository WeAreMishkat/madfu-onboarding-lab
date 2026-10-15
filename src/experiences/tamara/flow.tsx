import { TamaraMark } from '@/lab/BrandMarks';
import type { Block, ExperienceDef, FieldDef, Option, Preset, ScreenDef, Values } from '@/engine/types';
import {
  CoreModel,
  CrResult,
  DemoHint,
  FreelancerNotWalked,
  FreelancerVerify,
  LabNote,
  NafathWait,
  ReopenedBank,
  ReopenedBusiness,
  VerifyAccount,
  bankVerified,
  crAttempts,
  crLocked,
  MAX_ATTEMPTS
} from './blocks';
import {
  ASSOCIATES,
  CANCELLED_ID_SUFFIX,
  CATEGORIES,
  CONTACT_TIMES,
  DEMO_APPLICATION_ID,
  DEMO_COMPANY,
  DEMO_EMAIL,
  DEMO_MASKED_NATIONAL_ID,
  DEMO_P_NUMBER,
  DEMO_SMS_CODE,
  DEMO_TAKEN_EMAIL,
  INVALID_ID_SUFFIX,
  MISMATCH_IBAN_SUFFIX,
  REGISTERED_SUFFIX,
  REJECTED_FL_SUFFIX,
  SALES_BANDS,
  SUBCATEGORIES,
  SUBCATEGORY_NOTE,
  UNFINISHED_SUFFIX,
  demoIban,
  demoMobile,
  demoSwift,
  demoUnifiedNumber,
  emailValid,
  ibanValid,
  labelOf,
  phoneValid,
  routeMobile
} from './demo';
import { R } from './refs';

/*
 * Tamara Business merchant onboarding (partners.tamara.co), rebuilt from repository evidence only.
 * Newest evidence wins: the 2026-10-14 walks (TAM-JOURNEY-000010 new CR application to Nafath,
 * TAM-JOURNEY-000011 above SAR 20 million to submission; TAM-STATE-000071..085, TAM-RULE-000071..078)
 * supersede the older "new mobile -> OTP" assumption. The resumed, reopened application
 * (TAM-JOURNEY-000008, 2026-10-07) backs the resume, reopen and bank screens.
 * Screen status: OBSERVED = walked; DOCUMENTED = Help Centre; INFERRED = application payload or shipped
 * copy; UNKNOWN = not established. All values are fictional.
 */

const isCR = (v: Values) => v.businessType === 'registered';
const isFL = (v: Values) => v.businessType === 'freelancer';
const bizLocked = (v: Values) => crLocked(v) || !!v.flVerified;
const contactLocked = (v: Values) => !!v.contactLocked;

/** Simulated registry answer for a Unified National Number. */
const registry = (unn: unknown): 'active' | 'cancelled' | 'invalid' => {
  const s = String(unn ?? '');
  if (s.length !== 10 || s.endsWith(INVALID_ID_SUFFIX)) return 'invalid';
  if (s.endsWith(CANCELLED_ID_SUFFIX)) return 'cancelled';
  return 'active';
};

const BUSINESS_TYPES: Option[] = [
  { value: 'freelancer', label: 'Freelancer' },
  { value: 'registered', label: 'Registered Business' }
];

const reopenValues = (): Values => ({
  businessType: 'registered',
  reopenUnn: demoUnifiedNumber('345'),
  edited_reopenUnn: false,
  reopenBankPhase: 'flagged',
  reopenIban: demoIban('4321')
});

const flNote: Block = { type: 'custom', when: isFL, render: () => <FreelancerNotWalked /> };

/* ---------------- Sign-up (Step 1) ---------------- */

const businessTypeSelect: FieldDef = {
  name: 'businessType',
  label: 'Select your business type',
  kind: 'select',
  placeholder: 'Select a business type',
  options: BUSINESS_TYPES,
  required: true
};

const signupFields: Block[] = [
  { type: 'field', field: businessTypeSelect },
  {
    type: 'field',
    field: {
      name: 'countryCode',
      label: 'Country code',
      kind: 'select',
      placeholder: 'Code',
      options: [{ value: '+966', label: '+966' }, { value: '+971', label: '+971' }],
      required: true,
      when: (v) => !!v.businessType,
      width: 'half'
    }
  },
  {
    type: 'field',
    field: {
      name: 'phone',
      label: 'Phone number',
      kind: 'tel',
      placeholder: '555 000-0000',
      digitsOnly: true,
      maxLength: 9,
      required: true,
      when: (v) => !!v.businessType,
      width: 'half',
      validate: (_val, v) =>
        phoneValid(v) ? null : v.countryCode === '+971' ? 'Phone number must be 9 digits' : 'Saudi Arabia phone number must be 9 digits and start with 5'
    }
  }
];

const consentField: Block = {
  type: 'field',
  field: {
    name: 'consent',
    label: 'I agree to receive updates and communication from Tamara',
    kind: 'checkbox',
    when: (v) => !!v.businessType
  }
};

const signupDemo: Block = {
  type: 'custom',
  render: () => (
    <DemoHint
      items={[
        `Mobile ending in ${REGISTERED_SUFFIX}: already a Tamara merchant (blocked).`,
        `Mobile ending in ${UNFINISHED_SUFFIX}: unfinished application (password resume).`,
        'Any other valid mobile: new applicant (set a password; no code at this point).'
      ]}
    />
  )
};

const signupContinue = {
  label: 'Continue',
  variant: 'primary' as const,
  to: 'before-you-proceed',
  enabledWhen: (v: Values) => !!v.businessType && phoneValid(v)
};

const signupTitle = 'Fuel your business growth now with Tamara';
const signupSubtitle = 'Attract more customers, boost sales, and unleash your business potential!';

const passwordFields: Block[] = [
  { type: 'field', field: { name: 'newPassword', label: 'Password', kind: 'password', required: true } },
  {
    type: 'field',
    field: {
      name: 'confirmPassword',
      label: 'Confirm password',
      kind: 'password',
      required: true,
      validate: (val, v) => (val === v.newPassword ? null : 'Passwords do not match')
    }
  }
];

/* ---------------- Business verification (first pass, 2026-10-14) ---------------- */

const businessVerificationBlocks: Block[] = [
  {
    type: 'field',
    field: {
      name: 'businessType',
      label: 'Which option describes your business best?',
      kind: 'radio',
      options: BUSINESS_TYPES,
      required: true,
      readOnly: bizLocked
    }
  },
  {
    type: 'notice',
    tone: 'info',
    text: 'Business type, number and category are locked for this application after verification.',
    when: bizLocked
  },
  {
    type: 'field',
    field: {
      name: 'unn',
      label: 'Unified National Number',
      kind: 'text',
      digitsOnly: true,
      maxLength: 10,
      placeholder: '7XXXXXXXXX',
      required: true,
      when: isCR,
      readOnly: (v) => crLocked(v) || crAttempts(v) >= MAX_ATTEMPTS
    }
  },
  { type: 'custom', when: isCR, render: (ctx) => <CrResult ctx={ctx} /> },
  flNote,
  {
    type: 'field',
    field: {
      name: 'flNumber',
      label: 'Freelancer certificate number',
      kind: 'text',
      prefix: 'FL-',
      maxLength: 10,
      required: true,
      when: isFL,
      readOnly: (v) => !!v.flVerified,
      width: 'half',
      status: 'INFERRED',
      statusNote: 'Field name from the session transcript only (TAM-EVID-000093), seen when the type was switched on the reopened CR application. No valid screenshot.'
    }
  },
  {
    type: 'field',
    field: {
      name: 'nationalId',
      label: 'National ID',
      kind: 'text',
      readOnly: true,
      when: isFL,
      width: 'half',
      hint: "The account holder's National ID, pre-filled and locked.",
      status: 'INFERRED',
      statusNote: 'From the session transcript only (TAM-EVID-000093). No valid screenshot.'
    }
  },
  { type: 'custom', when: isFL, render: (ctx) => <FreelancerVerify ctx={ctx} /> },
  {
    type: 'text',
    muted: true,
    when: isFL,
    text: 'Help Centre: a Commercial Registration is mandatory for regulated categories (for example food and beverage, tobacco and vaping, medical products incl. cosmetics, pets, precious stones, education); a Freelance Certificate is not accepted for them.'
  },
  {
    type: 'field',
    field: {
      name: 'category',
      label: 'Business category',
      kind: 'select',
      placeholder: 'Select a category',
      options: CATEGORIES,
      required: true,
      readOnly: bizLocked,
      width: 'half',
      hint: 'The live list has 16 categories. Only the names recorded in the repository are offered here.'
    }
  },
  {
    type: 'field',
    field: {
      name: 'subCategory',
      label: 'Business subcategory',
      kind: 'select',
      placeholder: 'Select a subcategory',
      options: (v) => SUBCATEGORIES[String(v.category)] ?? [],
      required: true,
      readOnly: bizLocked,
      width: 'half',
      when: (v) => !!SUBCATEGORIES[String(v.category)]
    }
  },
  { type: 'text', muted: true, text: (v) => SUBCATEGORY_NOTE[String(v.category)] ?? '', when: (v) => !!SUBCATEGORY_NOTE[String(v.category)] },
  {
    type: 'custom',
    render: () => (
      <DemoHint
        items={[
          'Unified National Number: any 10 digits verify (active registration).',
          `Ending in ${CANCELLED_ID_SUFFIX}: "Your commercial registration has been cancelled." and one attempt used (observed).`,
          `Ending in ${INVALID_ID_SUFFIX}, or not 10 digits: "Invalid CR number" (observed on the resumed application; whether it uses an attempt was not recorded, so it does not here).`,
          `Freelancer certificate number ending in ${REJECTED_FL_SUFFIX}: Verify fails (outcome simulated).`
        ]}
      />
    )
  },
  { type: 'custom', when: isCR, render: () => <CoreModel /> }
];

const crVerifyLabel = (v: Values) => {
  if (crLocked(v) || !v.unn) return 'Continue';
  const n = crAttempts(v);
  return n === 0 ? 'Verify' : `Verify ${Math.min(n + 1, MAX_ATTEMPTS)} / ${MAX_ATTEMPTS}`;
};

/* ---------------- Screens ---------------- */

const screens: ScreenDef[] = [
  /* ---------- Entry (all applicants) ---------- */
  {
    id: 'signup',
    stage: 'signup',
    title: signupTitle,
    subtitle: signupSubtitle,
    status: 'OBSERVED',
    statusNote:
      'Step 1, observed for both types (Registered Business re-captured 2026-10-14; Freelancer selected 2026-10-07, Continue not pressed). Phone and consent appear once a type is chosen; the fields are identical for both types.',
    evidence: [R.stStep1, R.step1Fields, R.shotStep1Hd, R.shotStep1, R.shotFlStep1, R.shotPhoneErr, R.stPhoneErr],
    blocks: [...signupFields, consentField, signupDemo],
    actions: [signupContinue],
    noBack: true
  },
  {
    id: 'before-you-proceed',
    stage: 'signup',
    variant: 'modal',
    title: 'Before You Proceed',
    status: 'OBSERVED',
    statusNote: 'Shown after Continue on Step 1, before the server checks the mobile (POST /v3/onboarding/initialize). Re-captured 2026-10-14.',
    evidence: [R.gate, R.stGate, R.shotGateHd, R.shotGate, R.ariaGate, R.routing, R.netRouting],
    blocks: [
      {
        type: 'text',
        text: "This form is for registered businesses that want to offer Tamara as a payment method at checkout. It's not for customers, personal use or financing."
      }
    ],
    actions: [
      { label: 'Sign up as a customer', variant: 'secondary', to: 'customer-exit' },
      {
        label: 'Proceed as a business',
        variant: 'primary',
        loading: { ms: 1000, label: 'Checking…' },
        set: (v) => ({ mobileRoute: routeMobile(v.phone), blockedPhone: routeMobile(v.phone) === 'registered' ? v.phone : '' }),
        to: (v) => (v.mobileRoute === 'registered' ? 'mobile-registered' : v.mobileRoute === 'unfinished' ? 'resume-password' : 'new-password')
      }
    ]
  },
  {
    id: 'mobile-registered',
    stage: 'signup',
    title: signupTitle,
    subtitle: signupSubtitle,
    status: 'OBSERVED',
    statusNote: 'Server check after "Proceed as a business". Same for Freelancer and Registered Business. No code is sent and no sign-in link is offered (2026-10-07).',
    evidence: [R.blocked, R.routing, R.stBlocked, R.shotBlocked, R.ariaBlocked, R.netRouting],
    blocks: [
      ...signupFields,
      {
        type: 'notice',
        tone: 'error',
        text: 'This phone number is already registered. Try signing in instead.',
        when: (v) => !!v.blockedPhone && v.blockedPhone === v.phone
      },
      consentField,
      signupDemo
    ],
    actions: [signupContinue],
    noBack: true
  },
  {
    id: 'customer-exit',
    stage: 'signup',
    variant: 'center',
    title: 'Sign up as a customer',
    status: 'UNKNOWN',
    statusNote: 'The button is observed; where it leads was not recorded.',
    evidence: [R.gate, R.stGate],
    blocks: [
      { type: 'text', text: 'Consumers are diverted away from the merchant form. The destination of this button was not recorded, so it is not reproduced here.' }
    ],
    actions: [],
    terminal: true
  },

  /* ---------- New applicant (2026-10-14) ---------- */
  {
    id: 'new-password',
    stage: 'signup',
    title: 'Set up your password',
    status: 'OBSERVED',
    statusNote:
      'New mobile: the password is set straight after "Before You Proceed", with no SMS code at entry. The mobile is verified later, at the legal-signatory step. A signed-in onboarding session takes precedence over a new mobile (TAM-RULE-000077): log out first to start a separate application. Freelancer: not walked.',
    evidence: [R.routing, R.stNewPw, R.shotNewPw, R.session, R.jNew, R.jHigh],
    blocks: [flNote, ...passwordFields],
    actions: [
      {
        label: 'Continue',
        variant: 'primary',
        loading: { ms: 900, label: 'Saving…' },
        set: () => ({ newPassword: '', confirmPassword: '' }),
        to: 'contact'
      }
    ],
    noBack: true
  },
  {
    id: 'contact',
    stage: 'contact',
    title: 'Get your business set up with Tamara',
    status: 'OBSERVED',
    statusNote:
      'Contact step (2026-10-14): Application ID, Business Name, Email, Estimated total yearly sales (two bands). Below SAR 20 million continues to business verification; Above goes to a sales call. Read-only after Continue; the Application ID then shows a Salesforce-style lead id (fictional here). A reused email is refused. Which fields are mandatory beyond these was not recorded. Freelancer: not walked.',
    evidence: [R.contact, R.emailUnique, R.high, R.stContactEmpty, R.stSalesBands, R.stContactFilled, R.stContactLocked, R.stHighContact, R.stEmailTaken, R.shotContactEmpty, R.shotSalesBands, R.shotContactFilled, R.shotContactLocked, R.shotHighContact, R.shotEmailTaken],
    blocks: [
      flNote,
      { type: 'summary', rows: (v) => [['Application ID', contactLocked(v) ? DEMO_APPLICATION_ID : DEMO_P_NUMBER]] },
      { type: 'field', field: { name: 'businessName', label: 'Business Name', kind: 'text', required: true, readOnly: contactLocked } },
      {
        type: 'field',
        field: {
          name: 'email',
          label: 'Email',
          kind: 'email',
          required: true,
          readOnly: contactLocked,
          validate: (val) => (emailValid(val) ? null : 'Enter a valid email address (simulated message; the real one was not recorded).')
        }
      },
      {
        type: 'notice',
        tone: 'error',
        text: 'This email is already registered. Try signing in instead.',
        when: (v) => !!v.emailTakenFor && v.emailTakenFor === v.email
      },
      {
        type: 'field',
        field: {
          name: 'yearlySales',
          label: 'Estimated total yearly sales',
          kind: 'select',
          placeholder: 'Select',
          options: SALES_BANDS,
          required: true,
          readOnly: contactLocked
        }
      },
      {
        type: 'custom',
        when: contactLocked,
        render: () => (
          <LabNote status="OBSERVED" title="Locked after Continue">
            <p>Observed on the way back from business verification: every field is read-only, so the sales band cannot be changed on this mobile.</p>
          </LabNote>
        )
      },
      {
        type: 'custom',
        when: (v) => !contactLocked(v),
        render: () => (
          <DemoHint
            items={[
              `Email ${DEMO_TAKEN_EMAIL}: already used by another application (refused).`,
              'Below SAR 20 million: self-service application. Above SAR 20 million: sales-led route.'
            ]}
          />
        )
      }
    ],
    actions: [
      {
        label: 'Continue',
        variant: 'primary',
        loading: { ms: 900, label: 'Saving…' },
        set: (v) => {
          if (contactLocked(v)) return {};
          if (String(v.email ?? '').toLowerCase() === DEMO_TAKEN_EMAIL) return { emailTakenFor: v.email };
          return { contactLocked: true, emailTakenFor: '' };
        },
        to: (v) => (!contactLocked(v) ? '' : v.yearlySales === 'above-20m' ? 'schedule-call' : 'business-verification')
      }
    ],
    noBack: true
  },

  /* ---------- Above SAR 20 million: sales-led (2026-10-14, walked end to end) ---------- */
  {
    id: 'schedule-call',
    stage: 'contact',
    hideProgress: true,
    title: 'Schedule a call to complete your setup',
    status: 'OBSERVED',
    statusNote:
      'Above SAR 20 million only. No business verification, legal signatory, Nafath or bank step on this route. Business Name is locked; Website URL and a preferred time are asked. Which of them is mandatory was not recorded; the Lab requires both.',
    evidence: [R.high, R.stSchedule, R.shotSchedule1, R.shotSchedule2, R.shotSchedule3, R.shotSchedule4, R.jHigh],
    blocks: [
      {
        type: 'notice',
        tone: 'info',
        text: 'With annual sales above SAR 20 million, a few extra details let Tamara set up a dedicated Tamara Business account and tailored support for you.'
      },
      { type: 'field', field: { name: 'businessName', label: 'Business Name', kind: 'text', readOnly: true } },
      { type: 'field', field: { name: 'websiteUrl', label: 'Website URL', kind: 'url', placeholder: 'https://', required: true } },
      { type: 'field', field: { name: 'preferredTime', label: 'Preferred Time to Contact', kind: 'radio-cards', options: CONTACT_TIMES, required: true } }
    ],
    actions: [{ label: 'Continue', variant: 'primary', loading: { ms: 1100, label: 'Submitting…' }, to: 'submitted' }]
  },
  {
    id: 'submitted',
    stage: 'contact',
    hideProgress: true,
    variant: 'center',
    title: 'Application Submitted Successfully',
    status: 'OBSERVED',
    statusNote: 'End of the above-SAR-20M route (2026-10-14). What happens on the call, and after it, is not established.',
    evidence: [R.high, R.stSubmitted, R.shotSubmitted, R.jHigh],
    blocks: [
      { type: 'text', text: 'Our team will review your application and get back to you in 24 hours.' },
      { type: 'text', muted: true, text: 'A Partner Support email address is shown for questions (not reproduced in the Lab), with a "Learn more about Tamara" link.' },
      {
        type: 'custom',
        render: () => (
          <LabNote status="UNKNOWN" title="After submission">
            <p>The sales call, the review outcome, any later verification (registry, signatory, bank, documents) and the contract for this route were not observed.</p>
          </LabNote>
        )
      }
    ],
    actions: [],
    terminal: true
  },

  /* ---------- Below SAR 20 million: self-service ---------- */
  {
    id: 'business-verification',
    stage: 'business',
    title: 'Business verification',
    status: 'OBSERVED',
    statusNote:
      'First pass observed on a new CR application (2026-10-14): Continue becomes Verify; the number is checked by Lean (3 attempts); a cancelled registration is refused and uses an attempt; an active one goes straight to the legal signatory. Freelancer fields: session transcript only; Verify never run.',
    evidence: [R.bizVerifyNew, R.bizVerify, R.categories, R.regulated, R.stBizNew, R.stCrCancelled, R.stLocked, R.shotBizNew1, R.shotBizNew2, R.shotBizNew3, R.shotCrCancelled, R.shotLocked, R.netResumed, R.helpExtract, R.jNew],
    blocks: businessVerificationBlocks,
    actions: [
      {
        label: crVerifyLabel,
        variant: 'primary',
        when: isCR,
        enabledWhen: (v) => crLocked(v) || crAttempts(v) < MAX_ATTEMPTS,
        loading: { ms: 1200, label: 'Verifying…' },
        set: (v) => {
          if (crLocked(v)) return {};
          const r = registry(v.unn);
          if (r === 'active') return { crVerified: true, crVerifiedFor: v.unn, crFailedFor: '', crError: '' };
          if (r === 'cancelled') return { crVerified: false, crFailedFor: v.unn, crError: 'cancelled', crAttempts: crAttempts(v) + 1 };
          return { crVerified: false, crFailedFor: v.unn, crError: 'invalid' };
        },
        to: (v) => (crLocked(v) ? 'signatory' : '')
      },
      {
        label: 'Continue',
        variant: 'primary',
        when: isFL,
        enabledWhen: (v) => !!v.flVerified,
        to: 'fl-next'
      }
    ]
  },
  {
    id: 'fl-next',
    stage: 'signatory',
    title: 'Freelancer: next section',
    status: 'UNKNOWN',
    statusNote:
      'Not walked. A new Freelancer application was never taken past Step 1, so what follows Freelancer verification (signatory and Nafath, or not; bank; documents) is not established.',
    evidence: [R.sections, R.bizVerify, R.netResumed],
    blocks: [
      {
        type: 'custom',
        render: () => (
          <LabNote status="UNKNOWN" title="Not walked for Freelancers">
            <p>
              The legal signatory is picked from the CR associates returned by the registry, which a Freelancer does not have. The application record has the same
              six sections for every application. To keep the Lab navigable it continues to bank details; every Freelancer screen from here on is unverified.
            </p>
          </LabNote>
        )
      }
    ],
    actions: [{ label: 'Continue to bank details', variant: 'primary', to: 'bank' }]
  },
  {
    id: 'signatory',
    stage: 'signatory',
    title: `Who is the legal signatory of ${DEMO_COMPANY}?`,
    status: 'OBSERVED',
    statusNote:
      'Observed 2026-10-14 on a new CR application: one card per associate returned by the registry, name partly masked and ID shown as first 2 / last 4 digits. Verify opens an SMS code check, then Nafath.',
    evidence: [R.signatoryNew, R.signatory, R.stSignatoryList, R.shotSignatory1, R.shotSignatory2, R.jNew],
    blocks: [
      { type: 'field', field: { name: 'signatory', label: 'Legal signatory', kind: 'radio-cards', options: ASSOCIATES, required: true } }
    ],
    actions: [
      {
        label: 'Verify',
        variant: 'primary',
        loading: { ms: 800, label: 'Sending code…' },
        set: () => ({ smsCode: '', smsError: false }),
        to: 'signatory-sms'
      }
    ]
  },
  {
    id: 'signatory-sms',
    stage: 'signatory',
    variant: 'modal',
    title: 'Mobile verification',
    subtitle: (v) => `Enter the 6-digit code sent to ${v.countryCode ?? '+966'} ${v.phone ?? ''}`,
    status: 'OBSERVED',
    statusNote:
      'Observed 2026-10-14: a 6-digit code to the application mobile before Nafath; "Change number"; resend after 60 s; "OTP must be 6 digits". What "Change number" does and the wrong-code message were not recorded.',
    evidence: [R.routing, R.signatoryNew, R.stSignatorySms, R.shotSignatorySms, R.jNew],
    blocks: [
      {
        type: 'field',
        field: {
          name: 'smsCode',
          label: 'Verification code',
          kind: 'otp',
          length: 6,
          required: true,
          validate: (val) => (String(val).length === 6 ? null : 'OTP must be 6 digits')
        }
      },
      { type: 'notice', tone: 'error', text: 'The code is not correct (simulated; the real message was not recorded).', when: (v) => !!v.smsError },
      { type: 'text', muted: true, text: 'Resend in 1:00' },
      { type: 'custom', render: () => <DemoHint items={[`Code: ${DEMO_SMS_CODE}`]} /> }
    ],
    actions: [
      { label: 'Change number', variant: 'ghost', enabledWhen: () => false },
      {
        label: 'Continue',
        variant: 'primary',
        loading: { ms: 900, label: 'Verifying…' },
        set: (v) =>
          v.smsCode === DEMO_SMS_CODE
            ? { smsError: false, nafathAttempts: Number(v.nafathAttempts ?? 0) + 1, nafathStatus: 'pending' }
            : { smsError: true, smsCode: '' },
        to: (v) => (v.smsError ? '' : 'nafath')
      }
    ]
  },
  {
    id: 'nafath',
    stage: 'signatory',
    title: 'Verify with Nafath',
    status: 'OBSERVED',
    statusNote:
      'Number matching observed 2026-10-14. The push goes to the selected associate, not to the applicant. In the walk it was not approved; an approval was never captured on a new application, so "approved" below is simulated.',
    evidence: [R.signatoryNew, R.nafathRejected, R.stNafath, R.shotNafath, R.jNew],
    blocks: [{ type: 'custom', render: (ctx) => <NafathWait ctx={ctx} /> }],
    actions: []
  },
  {
    id: 'nafath-rejected',
    stage: 'signatory',
    variant: 'modal',
    title: 'Nafath verification has rejected',
    status: 'OBSERVED',
    statusNote:
      'Observed 2026-10-14 when the selected associate did not approve. The application stays at the Nafath step; bank details cannot be reached until Nafath succeeds. What Try again sends (a new push, a new SMS code) and the attempt limit on this route were not recorded.',
    evidence: [R.nafathRejected, R.stNafathRejected, R.shotNafathRejected, R.signatory, R.jNew],
    blocks: [
      { type: 'text', text: 'We were unable to verify your info with Nafath' },
      {
        type: 'custom',
        when: (v) => Number(v.nafathAttempts ?? 0) >= MAX_ATTEMPTS,
        render: () => (
          <LabNote status="UNKNOWN" title="No attempts left (simulated)">
            <p>Nafath allows 3 attempts (observed on the resumed application). What the applicant sees after the third rejection was not observed.</p>
          </LabNote>
        )
      }
    ],
    actions: [
      {
        label: 'Try again',
        variant: 'primary',
        enabledWhen: (v) => Number(v.nafathAttempts ?? 0) < MAX_ATTEMPTS,
        loading: { ms: 900, label: 'Sending request…' },
        set: (v) => ({ nafathAttempts: Number(v.nafathAttempts ?? 0) + 1, nafathStatus: 'pending' }),
        to: 'nafath'
      }
    ],
    noBack: true
  },
  {
    id: 'bank',
    stage: 'bank',
    title: 'Bank details',
    subtitle: 'Add the bank account that will receive your settlements.',
    status: 'OBSERVED',
    statusNote:
      'Observed only on the resumed, reopened CR application (2026-10-07: fields, Lean "Verify account", mismatch message). On a new application this step was not captured: the walk stopped at Nafath. The Freelancer bank step was not walked.',
    evidence: [R.bank, R.stVerifyAcct, R.stBankReopen, R.shotVerifyAcct, R.ariaVerifyAcct, R.shotBankReopen, R.netResumed, R.validity, R.nafathRejected, R.jNew],
    blocks: [
      {
        type: 'custom',
        when: (v) => !!v.nafathSimulated,
        render: () => (
          <LabNote status="INFERRED" title="Not captured on a new application">
            <p>Reached through a simulated Nafath approval. The form and its checks are reconstructed from the resumed application, where they were observed with pre-filled values.</p>
          </LabNote>
        )
      },
      flNote,
      {
        type: 'field',
        field: {
          name: 'iban',
          label: 'IBAN',
          kind: 'text',
          placeholder: 'SA',
          maxLength: 24,
          required: true,
          validate: (val) => (ibanValid(val) ? null : 'The IBAN entered does not match the expected format.')
        }
      },
      { type: 'custom', render: (ctx) => <VerifyAccount ctx={ctx} /> },
      {
        type: 'field',
        field: {
          name: 'beneficiary',
          label: 'Beneficiary Name',
          kind: 'text',
          readOnly: true,
          when: bankVerified,
          hint: 'Fetched from the bank and locked. English only.'
        }
      },
      { type: 'field', field: { name: 'swift', label: 'Swift Code', kind: 'text', maxLength: 11, required: true } },
      {
        type: 'field',
        field: {
          name: 'ibanCertificate',
          label: 'Upload IBAN Certificate',
          kind: 'upload',
          accept: 'jpeg, png, jpg or pdf, max 5 MB',
          required: true,
          when: bankVerified
        }
      },
      {
        type: 'custom',
        render: () => <DemoHint items={[`An IBAN ending in ${MISMATCH_IBAN_SUFFIX} does not match the business (mismatch message). Any other SA + 22 digits verifies.`]} />
      }
    ],
    actions: [{ label: 'Continue', variant: 'primary', enabledWhen: bankVerified, to: 'channel' }]
  },
  {
    id: 'channel',
    stage: 'channel',
    title: 'Business channel',
    subtitle: 'Where do you sell?',
    status: 'INFERRED',
    statusNote:
      'Not captured: reconstructed from the application payload (business_channel). The screen was never reached (resumed walk: bank deadlock; new walk: stopped at Nafath). Labels, layout and which fields are mandatory are not established.',
    evidence: [R.sections, R.reopen, R.netResumed, R.jNew],
    blocks: [
      flNote,
      {
        type: 'field',
        field: {
          name: 'country',
          label: 'Country',
          kind: 'select',
          options: [{ value: 'SA', label: 'Saudi Arabia' }, { value: 'AE', label: 'United Arab Emirates' }],
          width: 'half'
        }
      },
      {
        type: 'field',
        field: {
          name: 'channels',
          label: 'Sales channels',
          kind: 'checkgroup',
          options: [{ value: 'online', label: 'Online' }, { value: 'instore', label: 'In-store' }],
          required: true
        }
      },
      { type: 'field', field: { name: 'posService', label: 'POS service', kind: 'text', width: 'half', when: (v) => Array.isArray(v.channels) && v.channels.includes('instore') } },
      { type: 'field', field: { name: 'branches', label: 'Number of branches', kind: 'number', digitsOnly: true, maxLength: 4, width: 'half', when: (v) => Array.isArray(v.channels) && v.channels.includes('instore') } },
      {
        type: 'field',
        field: {
          name: 'mapsLink',
          label: 'Google Maps link',
          kind: 'url',
          placeholder: 'https://',
          when: (v) => Array.isArray(v.channels) && v.channels.includes('instore'),
          hint: 'Reviewers check this listing: an observed reopen reason was "G-maps link has no images".'
        }
      },
      { type: 'field', field: { name: 'onlinePlatform', label: 'Online platform', kind: 'text', width: 'half', when: (v) => Array.isArray(v.channels) && v.channels.includes('online') } },
      { type: 'field', field: { name: 'website', label: 'Website', kind: 'url', placeholder: 'https://', width: 'half', when: (v) => Array.isArray(v.channels) && v.channels.includes('online') } },
      { type: 'field', field: { name: 'social', label: 'Social media', kind: 'url', placeholder: 'https://', when: (v) => Array.isArray(v.channels) && v.channels.includes('online') } },
      {
        type: 'custom',
        render: () => (
          <LabNote status="INFERRED" title="Not captured: reconstructed from the application payload">
            <p>Payload fields: country, channels (online / in-store), store POS service, Google-Maps link and coordinates, online platform, website, social media, number of branches. Which channel reveals which field is an assumption.</p>
          </LabNote>
        )
      }
    ],
    actions: [{ label: 'Continue', variant: 'primary', to: 'additional' }]
  },
  {
    id: 'additional',
    stage: 'additional',
    title: 'Additional information',
    status: 'INFERRED',
    statusNote:
      'Not captured: reconstructed from the application payload (additional_info.has_vat_id, vat_id, legal_address); "Do you have a VAT?" and the 15-digit rule from shipped copy. The screen was never reached.',
    evidence: [R.sections, R.docs, R.regulated, R.netResumed, R.helpExtract, R.jNew],
    blocks: [
      flNote,
      {
        type: 'field',
        field: {
          name: 'hasVat',
          label: 'Do you have a VAT?',
          kind: 'radio',
          options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }],
          required: true
        }
      },
      {
        type: 'field',
        field: {
          name: 'vatNumber',
          label: 'VAT number',
          kind: 'text',
          digitsOnly: true,
          maxLength: 15,
          required: true,
          when: (v) => v.hasVat === 'yes',
          validate: (val) => (String(val).length === 15 ? null : 'VAT number must be 15 digits')
        }
      },
      { type: 'field', field: { name: 'legalAddress', label: 'Legal address', kind: 'textarea' } },
      { type: 'text', muted: true, text: 'Help Centre: a VAT certificate is required if VAT-registered, and always for tobacco and vaping.' }
    ],
    actions: [{ label: 'Continue', variant: 'primary', to: 'documents' }]
  },
  {
    id: 'documents',
    stage: 'documents',
    title: 'KYC documents',
    subtitle: 'Upload official documents valid for at least 30 days.',
    status: 'DOCUMENTED',
    statusNote:
      'Not captured. The list is the Help Centre KSA document list; the application record has a kyc_documents list. Upload layout and per-document rules on screen are not established.',
    evidence: [R.docs, R.regulated, R.validity, R.helpExtract, R.sections, R.netResumed],
    blocks: [
      { type: 'field', field: { name: 'docCr', label: 'Commercial Registration (CR)', kind: 'upload', accept: 'Official document', required: true, when: isCR } },
      { type: 'field', field: { name: 'docFl', label: 'Freelance Certificate', kind: 'upload', accept: 'Official document', required: true, when: isFL } },
      { type: 'field', field: { name: 'docId', label: 'National ID or Passport of the legal signatory', kind: 'upload', accept: 'Official document', required: true } },
      {
        type: 'field',
        field: {
          name: 'docIban',
          label: 'IBAN certificate stamped by the bank (or IBAN on stamped company letterhead)',
          kind: 'upload',
          accept: 'Official document',
          required: true
        }
      },
      { type: 'field', field: { name: 'docVat', label: 'VAT certificate', kind: 'upload', accept: 'Official document', required: true, when: (v) => v.hasVat === 'yes' } },
      {
        type: 'field',
        field: {
          name: 'docPoa',
          label: 'Power of Attorney (POA)',
          kind: 'upload',
          accept: 'Official document',
          status: 'DOCUMENTED',
          statusNote: 'Shown among accepted-document examples; when it is required is not stated.'
        }
      },
      { type: 'heading', text: 'Tips' },
      {
        type: 'list',
        items: [
          'Documents must be official and valid for at least 30 days.',
          'The IBAN letter must be stamped.',
          'Beneficiary details on the IBAN and VAT certificates must match the legal entity on the CR or FL.'
        ]
      }
    ],
    actions: [{ label: 'Continue', variant: 'primary', to: 'review' }]
  },
  {
    id: 'review',
    stage: 'review',
    title: 'Review and submit',
    status: 'UNKNOWN',
    statusNote:
      'Not captured. The Help Centre documents a submission followed by review; this summary is a minimal stand-in, not the real layout or copy. The screen after a self-service submit was not captured either.',
    evidence: [R.sla, R.sections, R.helpExtract, R.jNew],
    blocks: [
      {
        type: 'custom',
        render: () => (
          <LabNote status="UNKNOWN" title="Stand-in screen">
            <p>Whether a separate review page exists, and what it shows, was not observed.</p>
          </LabNote>
        )
      },
      {
        type: 'summary',
        title: 'Application',
        rows: (v) => [
          ['Business type', labelOf(BUSINESS_TYPES, v.businessType)],
          ['Estimated total yearly sales', labelOf(SALES_BANDS, v.yearlySales)],
          [isFL(v) ? 'Freelancer certificate' : 'Unified National Number', isFL(v) ? `FL-${v.flNumber ?? ''}` : String(v.unn ?? '')],
          ['Business category', labelOf(CATEGORIES, v.category)],
          ['Legal signatory', isFL(v) ? 'Not established for Freelancers' : labelOf(ASSOCIATES, v.signatory)],
          ['Beneficiary', String(v.beneficiary ?? '')],
          ['Channels', Array.isArray(v.channels) ? v.channels.map((c) => (c === 'online' ? 'Online' : 'In-store')).join(', ') : ''],
          ['VAT', v.hasVat === 'yes' ? 'Yes' : v.hasVat === 'no' ? 'No' : '']
        ]
      },
      { type: 'text', muted: true, text: 'Help Centre: the team reviews within 1 business day; the application cannot be changed while it is under review.' }
    ],
    actions: [{ label: 'Submit application', variant: 'primary', loading: { ms: 1200, label: 'Submitting…' }, to: 'status' }]
  },
  {
    id: 'status',
    stage: 'review',
    variant: 'center',
    title: 'Verifying KYC',
    subtitle: 'Your application is being reviewed.',
    status: 'OBSERVED',
    statusNote:
      'Status "Verifying KYC" and the Application ID (= Salesforce lead id) observed on the resumed application (2026-10-07). The ID here is fictional. Reached in the Lab after a simulated submit; review outcomes are UNKNOWN.',
    evidence: [R.sections, R.sla, R.cancel, R.netResumed, R.helpExtract, R.jResumed],
    blocks: [
      {
        type: 'summary',
        rows: () => [
          ['Application ID', DEMO_APPLICATION_ID],
          ['Status', 'Verifying KYC']
        ]
      },
      { type: 'text', muted: true, text: 'Help Centre: review within 1 business day; no changes while under review; the outcome is emailed. Cancelling needs a signed and stamped letter on company letterhead.' }
    ],
    actions: [
      { label: 'Lab: simulate a reviewer reopen', variant: 'secondary', set: () => reopenValues(), to: 'reopened-business' },
      { label: 'Lab: after approval', variant: 'secondary', to: 'contract' }
    ],
    terminal: true
  },

  /* ---------- Unfinished application: resume (2026-10-07) ---------- */
  {
    id: 'resume-password',
    stage: 'signup',
    title: 'Enter your password',
    subtitle: (v) => `Enter your password for ${v.countryCode ?? '+966'} ${v.phone ?? ''}`,
    status: 'OBSERVED',
    statusNote:
      'The mobile has an unfinished application with a password, so it resumes without any code. The application then opens at its saved step; in the walk that was business verification, reopened by review. In the demo any password resumes it.',
    evidence: [R.routing, R.routingOld, R.stResume, R.shotResume, R.ariaResume, R.netRouting, R.jResumed],
    blocks: [{ type: 'field', field: { name: 'password', label: 'Password', kind: 'password', required: true } }],
    actions: [
      { label: 'Change number', variant: 'ghost', to: 'signup', set: () => ({ password: '' }) },
      {
        label: 'Forgot password',
        variant: 'secondary',
        loading: { ms: 900, label: 'Sending…' },
        set: () => ({ resetCode: '', resetAttempts: 0, resetError: false }),
        to: 'reset-otp'
      },
      {
        label: 'Continue',
        variant: 'primary',
        loading: { ms: 900, label: 'Signing in…' },
        set: () => ({ password: '', ...reopenValues() }),
        to: 'reopened-business'
      }
    ]
  },
  {
    id: 'reset-otp',
    stage: 'signup',
    title: 'Mobile verification',
    subtitle: (v) => `Please enter the 6-digit code sent to the phone number ${v.countryCode ?? '+966'} ${v.phone ?? ''}`,
    status: 'OBSERVED',
    statusNote: 'Forgot-password recovery (2026-10-07). Two fresh codes were rejected (otp_not_found) and a later code was accepted: intermittent. The lab switch reproduces that sequence.',
    evidence: [R.resetFail, R.resend, R.resetOk, R.stResetOtp, R.stResetRej, R.stResetRej2, R.shotResetOtp, R.shotResetRej, R.shotResetRej2, R.netRouting, R.netResumed],
    blocks: [
      { type: 'notice', tone: 'info', text: 'We have sent an OTP code if the account information you entered matches the account in our system.' },
      {
        type: 'field',
        field: {
          name: 'resetCode',
          label: 'Verification code',
          kind: 'otp',
          length: 6,
          required: true,
          validate: (val) => (String(val).length === 6 ? null : 'Enter the 6-digit code')
        }
      },
      { type: 'notice', tone: 'error', text: 'Verification code not found. Please request a new one.', when: (v) => !!v.resetError },
      { type: 'text', muted: true, text: 'Resend in 1:00' },
      {
        type: 'field',
        field: {
          name: 'resetSimulateFailures',
          label: 'Lab switch: reproduce the observed failures (the first two codes are rejected)',
          kind: 'toggle'
        }
      },
      { type: 'custom', render: () => <DemoHint items={[`Code: ${DEMO_SMS_CODE}`]} /> }
    ],
    actions: [
      {
        label: 'Resend the code',
        variant: 'ghost',
        loading: { ms: 600, label: 'Sending…' },
        set: () => ({ resetCode: '', resetError: false })
      },
      {
        label: 'Continue',
        variant: 'primary',
        loading: { ms: 900, label: 'Verifying…' },
        set: (v) => {
          const n = Number(v.resetAttempts ?? 0) + 1;
          const fail = (!!v.resetSimulateFailures && n <= 2) || v.resetCode !== DEMO_SMS_CODE;
          return { resetAttempts: n, resetError: fail, resetCode: fail ? '' : v.resetCode };
        },
        to: (v) => (v.resetError ? '' : 'set-password')
      }
    ]
  },
  {
    id: 'set-password',
    stage: 'signup',
    title: 'Set up your password',
    status: 'OBSERVED',
    statusNote: 'After the recovery code is accepted (2026-10-07). The application then resumes at its saved step: here, business verification reopened by review.',
    evidence: [R.resetOk, R.stSetPw, R.shotSetPw, R.netResumed, R.jResumed],
    blocks: passwordFields,
    actions: [
      {
        label: 'Continue',
        variant: 'primary',
        loading: { ms: 900, label: 'Saving…' },
        set: () => ({ newPassword: '', confirmPassword: '', ...reopenValues() }),
        to: 'reopened-business'
      }
    ],
    noBack: true
  },
  {
    id: 'reopened-business',
    stage: 'business',
    title: 'Business verification',
    subtitle: 'Reopened by review',
    status: 'OBSERVED',
    statusNote:
      'Observed on the resumed application (2026-10-07): every reopen_reason was "G-maps link has no images"; the reason shows under each flagged field; only flagged fields are editable; category locked.',
    evidence: [R.reopen, R.stReopenBiz, R.shotReopenBiz, R.ariaReopenBiz, R.netResumed, R.jResumed],
    blocks: [{ type: 'custom', render: (ctx) => <ReopenedBusiness ctx={ctx} /> }],
    actions: [
      {
        label: 'Continue',
        variant: 'primary',
        enabledWhen: (v) => !!v.edited_reopenUnn && String(v.reopenUnn ?? '').length > 0,
        loading: { ms: 900, label: 'Saving…' },
        to: 'reopened-bank'
      }
    ]
  },
  {
    id: 'reopened-bank',
    stage: 'bank',
    title: 'Bank details',
    subtitle: 'Reopened by review',
    status: 'OBSERVED',
    statusNote:
      'The deadlock that ended the resumed walk (2026-10-07): the IBAN flag clears only when the IBAN is edited, editing forces Verify account, and after verification the flag returns and the certificate is cleared. How Tamara resolves it is UNKNOWN.',
    evidence: [R.deadlock, R.reopen, R.signatory, R.stDeadlock, R.stBankReopen, R.shotDeadlock, R.shotBankReopen, R.ariaBankReopen, R.netResumed, R.jResumed],
    blocks: [
      {
        type: 'custom',
        render: () => (
          <LabNote status="OBSERVED" title="Legal signatory passed in between">
            <p>Nafath had already been completed on this application, so no new push was sent and the signatory step passed (network log). That screen was not captured, so the Lab goes straight to bank details.</p>
          </LabNote>
        )
      },
      { type: 'custom', render: (ctx) => <ReopenedBank ctx={ctx} /> }
    ],
    actions: [
      { label: 'Lab: back to status', variant: 'ghost', to: 'status' },
      { label: 'Continue', variant: 'primary', enabledWhen: () => false }
    ]
  },
  {
    id: 'contract',
    stage: 'review',
    variant: 'center',
    title: 'Merchant contract',
    status: 'DOCUMENTED',
    statusNote: 'Help Centre only: after approval the contract arrives by email for e-signature via Juro. A legal_kyc_contract_file slot exists on the application. Approval and activation are UNKNOWN.',
    evidence: [R.juro, R.helpExtract, R.sections],
    blocks: [
      { type: 'text', text: 'After approval, the merchant contract is emailed for e-signature. If it is not in your inbox, search your email for "Juro".' },
      {
        type: 'custom',
        render: () => (
          <LabNote status="UNKNOWN" title="Approval and activation">
            <p>Review criteria, outcomes, go-live and credentials (docs: emailed once integration begins) were not observed.</p>
          </LabNote>
        )
      }
    ],
    actions: [],
    terminal: true
  }
];

/* ---------------- Presets ---------------- */

const base: Values = { businessType: 'registered', countryCode: '+966', consent: false };
const newMobile = () => demoMobile('345');
const contactDone = (): Values => ({
  ...base,
  phone: newMobile(),
  businessName: DEMO_COMPANY,
  email: DEMO_EMAIL,
  yearlySales: 'below-20m',
  contactLocked: true
});
const crVerifiedApp = (): Values => ({
  ...contactDone(),
  unn: demoUnifiedNumber('345'),
  crVerified: true,
  crVerifiedFor: demoUnifiedNumber('345'),
  category: 'personal-professional',
  subCategory: 'legal-services'
});

const presets: Preset[] = [
  {
    id: 'cr-business',
    group: 'New application (below SAR 20M)',
    label: 'New CR at business verification',
    description: 'Contact step saved (Below SAR 20 million); Unified National Number not yet verified.',
    screen: 'business-verification',
    values: contactDone()
  },
  {
    id: 'signatory',
    group: 'New application (below SAR 20M)',
    label: 'Signatory + Nafath (approval simulated)',
    description: 'Pick an associate, SMS code, Nafath number match; approval is not captured, so it is simulated.',
    screen: 'signatory',
    values: crVerifiedApp()
  },
  {
    id: 'nafath-rejected',
    group: 'New application (below SAR 20M)',
    label: 'Nafath rejected',
    description: '"Nafath verification has rejected": the observed end of the new-application walk.',
    screen: 'nafath-rejected',
    values: { ...crVerifiedApp(), signatory: 'assoc-1', nafathAttempts: 1, nafathStatus: 'rejected' }
  },
  {
    id: 'above-20m',
    group: 'Above SAR 20M',
    label: 'Above SAR 20M: sales-led',
    description: 'Contact step with Above SAR 20 million -> Schedule a call -> Application Submitted Successfully.',
    screen: 'contact',
    values: { ...base, phone: newMobile(), businessName: DEMO_COMPANY, email: DEMO_EMAIL, yearlySales: 'above-20m' }
  },
  {
    id: 'registered-mobile',
    group: 'Entry routing',
    label: 'Registered mobile blocked',
    description: 'Mobile already owns a merchant account: blocked before any code.',
    screen: 'mobile-registered',
    values: { ...base, phone: demoMobile(REGISTERED_SUFFIX), blockedPhone: demoMobile(REGISTERED_SUFFIX), mobileRoute: 'registered' }
  },
  {
    id: 'unfinished',
    group: 'Entry routing',
    label: 'Unfinished application: password resume',
    description: 'Enter your password, with the intermittent forgot-password recovery.',
    screen: 'resume-password',
    values: { ...base, phone: demoMobile(UNFINISHED_SUFFIX), mobileRoute: 'unfinished' }
  },
  {
    id: 'reopened',
    group: 'Review',
    label: 'Reopened application (reviewer reason)',
    description: 'Flagged field shows "G-maps link has no images"; then the bank-step deadlock.',
    screen: 'reopened-business',
    values: { ...crVerifiedApp(), ...reopenValues() }
  },
  {
    id: 'freelancer-step1',
    group: 'Entry routing',
    label: 'Freelancer at Step 1 (not walked further)',
    description: 'Freelancer selected on Step 1. Nothing after Step 1 was walked for a Freelancer.',
    screen: 'signup',
    values: { ...base, businessType: 'freelancer', phone: newMobile() }
  },
  {
    id: 'status',
    group: 'Review',
    label: 'Verifying KYC status',
    description: 'Application ID + "Verifying KYC"; reopen and contract follow-ups.',
    screen: 'status',
    values: crVerifiedApp()
  },
  {
    id: 'bank-mismatch',
    group: 'Review',
    label: 'Bank verification mismatch',
    description: 'IBAN that Lean reports as not matching the business number (resumed-application behaviour).',
    screen: 'bank',
    values: { ...crVerifiedApp(), signatory: 'assoc-1', nafathStatus: 'approved', nafathSimulated: true, iban: demoIban(MISMATCH_IBAN_SUFFIX), swift: demoSwift() }
  }
];

export const tamaraExperience: ExperienceDef = {
  id: 'tamara',
  name: 'Tamara',
  kind: 'Benchmark Experience',
  themeClass: 'theme-tamara',
  header: () => (
    <div className="tm-header">
      <TamaraMark size={24} />
      <span className="tm-header-business">Business</span>
      <span className="tm-header-spacer" />
      <span className="tm-header-lang" lang="ar" aria-hidden="true">العربية</span>
    </div>
  ),
  stages: [
    { id: 'contact', label: 'Business contact' },
    { id: 'business', label: 'Business verification' },
    { id: 'signatory', label: 'Legal signatory' },
    { id: 'bank', label: 'Bank details' },
    { id: 'channel', label: 'Business channel' },
    { id: 'additional', label: 'Additional info' },
    { id: 'documents', label: 'KYC documents' },
    { id: 'review', label: 'Review' }
  ],
  screens,
  start: 'signup',
  initialValues: { countryCode: '+966', nationalId: DEMO_MASKED_NATIONAL_ID, resetSimulateFailures: true },
  presets,
  reachNote:
    'Three production walks back this experience. 2026-10-14: a new Registered Business application from Step 1 through set password (no code at entry), the contact step, business verification (Lean), the legal signatory, an SMS code and Nafath, where the signatory did not approve ("Nafath verification has rejected"); and a second new application with yearly sales above SAR 20 million, walked through "Schedule a call" to "Application Submitted Successfully". 2026-10-07: a July application resumed by password recovery, reopened by review and walked to bank details (Lean "Verify account"), where a reopen-flag deadlock stopped it. Not captured: Nafath approval and every later step on a new application (bank details here come from the resumed application; business channel, additional info and KYC documents are rebuilt from the application payload and the Help Centre), the self-service submit, review outcomes, the Juro contract, activation, and every Freelancer screen after Step 1. All values are fictional; research screenshots are never published.'
};
