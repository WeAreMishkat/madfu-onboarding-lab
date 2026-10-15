import { validateScreen } from '@/engine/FlowRunner';
import type { ExperienceDef, FieldDef, Preset, ScreenDef, Values } from '@/engine/types';
import {
  BusinessTypePills,
  DocIllustration,
  EnvelopeIllustration,
  IbanVerification,
  IdentifierCard,
  LabButton,
  LabChoice,
  LabNote,
  MadfuHeader,
  OfferCards,
  PasswordChecklist,
  RatingHint,
  ResendTimer,
  SignitFrame,
  SummarySection,
  Toast,
  WathqCard,
  WIZARD_STEPS
} from './components';
import {
  BANKS,
  BANK_OPTIONS,
  CODE,
  DECLINE_REASONS,
  DEMO_BANK_BENEFICIARY,
  DEMO_CR_ADDRESS,
  DEMO_CR_NAME,
  DEMO_EMAIL,
  DEMO_EXISTING_FL,
  DEMO_EXISTING_UNIFIED,
  DEMO_FL,
  DEMO_IN_PROGRESS_UNIFIED,
  DEMO_LINK,
  DEMO_MOBILE,
  DEMO_PERSON,
  DEMO_PERSON_LEAD,
  DEMO_UNIFIED,
  EMAIL_RE,
  EV,
  FILE_ACCEPT,
  LEAD_MESSAGES,
  PROD,
  SA_IBAN_RE,
  TEST_CR,
  TEST_FL,
  TEST_HIGH,
  URL_RE,
  demoIban,
  demoNationalId,
  ev,
  ibanVerified,
  identifierLabel,
  identifierValue,
  isCR,
  isFL,
  leadOutcome,
  maskEmail,
  maskMobile,
  maskOwnerId,
  passwordOk,
  shot,
  str,
  verifiedBankFor
} from './data';

const REQUIRED = 'This field is required';

// ---------------------------------------------------------------------------------------------
// Shared field definitions
// ---------------------------------------------------------------------------------------------
const f = (field: FieldDef) => ({ type: 'field' as const, field });

const fullNameField: FieldDef = { name: 'fullName', label: 'Full Name', kind: 'text', placeholder: 'Enter your Full Name', required: true, width: 'half' };
const idNumberField: FieldDef = {
  name: 'idNumber', label: 'ID Number', kind: 'text', placeholder: 'Enter a Valid ID/ Iqama Number', required: true, width: 'half',
  digitsOnly: true, maxLength: 10,
  validate: (v) => (/^[12]\d{9}$/.test(String(v)) ? null : 'Should be 10-digit number starting with 1 or 2')
};
const contactPhoneField: FieldDef = {
  name: 'contactPhoneMasked', label: 'Phone Number', kind: 'tel', required: true, readOnly: true, width: 'half',
  hint: 'Phone number must be owned by Same ID'
};
const contactEmailField: FieldDef = {
  name: 'contactEmail', label: 'Email address', kind: 'email', placeholder: 'Please enter your Email Address', required: true, width: 'half',
  validate: (v) => (EMAIL_RE.test(String(v)) ? null : 'Please enter a valid email address.')
};
const upload = (name: string, label: string, when?: (v: Values) => boolean): FieldDef => ({
  name, label, kind: 'upload', accept: FILE_ACCEPT, required: true, ...(when ? { when } : {})
});
const bankField: FieldDef = { name: 'bank', label: 'Bank Name', kind: 'select', placeholder: 'Select your bank', required: true, options: BANK_OPTIONS };
const ibanField: FieldDef = {
  name: 'iban', label: 'IBAN Number', kind: 'text', placeholder: 'Enter your IBAN', required: true, maxLength: 24,
  validate: (v) => (SA_IBAN_RE.test(String(v)) ? null : 'Please enter a valid Saudi IBAN.')
};
const vatFields: FieldDef[] = [
  { name: 'vatRegistered', label: "I'm VAT Registered", kind: 'toggle' },
  upload('vatCertDoc', 'VAT Certificate', (v) => v.vatRegistered === true),
  {
    name: 'vatNumber', label: 'VAT Registration Number', kind: 'text', placeholder: 'Enter VAT Registration Number', required: true,
    digitsOnly: true, maxLength: 15, when: (v) => v.vatRegistered === true,
    validate: (v) => (/^3\d{14}$/.test(String(v)) ? null : 'Invalid VAT number. Must be 15 digits and start with 3.')
  }
];
const otpField = (name: string, label: string): FieldDef => ({ name, label, kind: 'otp', length: 4, required: true });
const fourDigits = (name: string) => (v: Values) => /^\d{4}$/.test(str(v, name));

/** The single Wathq owner shown in the Lab (the observed run returned one owner). */
const ownerOptions = () => [{ value: 'owner-1', label: DEMO_PERSON, description: maskOwnerId(demoNationalId()) }];

const ratingOptions = ['1', '2', '3', '4', '5'].map((x) => ({ value: x, label: x }));
const SURVEY_QUESTIONS: Array<{ name: string; label: string; when?: (v: Values) => boolean }> = [
  { name: 'rateEmail', label: 'Ease of Email Verification' },
  { name: 'rateLogin', label: 'Ease of Login & Portal Navigation' },
  { name: 'rateMerchant', label: 'Clarity of Merchant Info step' },
  { name: 'rateBusiness', label: 'Clarity of Business Info step' },
  { name: 'rateSummary', label: 'Ease of Summary Review' },
  { name: 'rateContract', label: 'Contract Sign-Off Experience', when: (v) => v.contractPath === true },
  { name: 'rateOverall', label: 'Overall Satisfaction' }
];

// ---------------------------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------------------------
const screens: ScreenDef[] = [
  // ------------------------------------------------------------------------------------ Entry
  {
    id: 'lead',
    stage: 'lead',
    title: 'Let’s Get Started',
    subtitle: 'Please fill out the below information. All data provided will be stored',
    status: 'OBSERVED',
    statusNote: 'Lead form walked on TEST (2026-10-12 CR, 2026-10-14 above SAR 20M) and production (2026-10-07). The name rule is server-side only; Generate OTP stays disabled until the form is valid.',
    noBack: true,
    evidence: [
      shot('MDF-STATE-000065', 'Lead form: Business Type (default Registered Business), Unified Number, Sales Channels, Annual Revenue, Link, Name, Phone Number; Generate OTP disabled until valid.', TEST_FL),
      shot('MDF-STATE-000066', 'Annual Revenue has two options only: Less than SAR 20 Million / Above SAR 20 Million.', TEST_FL),
      shot('MDF-STATE-000067', 'Registered Business lead filled: Online makes Link mandatory; Generate OTP enabled.', TEST_FL),
      shot('MDF-STATE-000135', 'Above SAR 20 Million selected: the form is the same as below 20M.', TEST_HIGH),
      ev('MDF-RULE-000026', 'rule', 'OBSERVED', 'Unified Number: numeric, starts with 7, exactly 10. Freelance Certificate Number: fixed "FL - " mask + exactly 9 digits. Switching type clears the value.', TEST_FL),
      ev('MDF-RULE-000027', 'rule', 'OBSERVED', 'Online (alone or with In Store) makes Link required with URL validation.', TEST_FL),
      ev('MDF-RULE-000033', 'rule', 'OBSERVED', 'Mobile: +966 fixed, 9 digits starting with 5.', TEST_FL),
      ev('MDF-RULE-000032', 'rule', 'OBSERVED', 'The lead record is created before the phone is verified; de-duplication is keyed on the CR/FL identifier.', TEST_FL),
      shot('MDF-STATE-000012', 'A name with a hyphen is accepted by the client and rejected by RegisterMerchantLead (422) as a toast.', PROD),
      shot('MDF-STATE-000013', 'A Unified Number with an in-progress lead: 400 "He has in-progress request and will be contacted by Sales team."; no OTP. Toast text from the response.', PROD),
      ev('MDF-RULE-000031', 'rule', 'OBSERVED', 'In-progress lead for the Unified Number: no OTP, no self-service; the applicant is parked with Sales.', PROD),
      ev('MDF-RULE-000104', 'rule', 'OBSERVED', 'On TEST a lead still waiting for its SMS code (otpSent) does not block a new lead for the same Unified Number: a fresh code is sent.', TEST_HIGH)
    ],
    blocks: [
      { type: 'custom', when: (v) => !!str(v, 'leadError'), render: (ctx) => <Toast tone="error" text={str(ctx.values, 'leadError')} /> },
      {
        type: 'custom',
        when: (v) => str(v, 'leadError') === LEAD_MESSAGES.sales,
        render: () => (
          <LabNote title="In-progress lead: parked with Sales" status="OBSERVED">
            No SMS code and no self-service: Madfu&apos;s Sales team contacts the applicant (production, 2026-10-07). On TEST, a lead that was still waiting for its SMS code did not trigger this block: the form was accepted again with a fresh code (2026-10-14).
          </LabNote>
        )
      },
      {
        type: 'custom',
        when: (v) => v.leadReset === true,
        render: () => (
          <LabNote title="Offer declined: back at the lead form" status="INFERRED">
            The rejection-reason dialog was observed in production; that submitting a reason returns the applicant to step 1 of the lead form is read from shipped code (MDF-RULE-000035). Whether the fields are cleared is not established, so the Lab keeps them.
          </LabNote>
        )
      },
      { type: 'custom', render: (ctx) => <BusinessTypePills ctx={ctx} /> },
      f({
        name: 'unifiedNumber', label: 'Unified Number', kind: 'text', placeholder: 'Please enter your Unified Number', required: true,
        digitsOnly: true, maxLength: 10, when: isCR,
        validate: (v) => (/^7\d{9}$/.test(String(v)) ? null : 'Must be numeric, start with 7, and have an exact length of 10 characters')
      }),
      f({
        name: 'flNumber', label: 'Freelance Certificate Number', kind: 'text', prefix: 'FL - ', required: true,
        digitsOnly: true, maxLength: 9, when: isFL,
        validate: (v) => (/^\d{9}$/.test(String(v)) ? null : 'Freelancing certificate must start with FL followed by 9 digits')
      }),
      f({
        name: 'salesChannels', label: 'Sales Channels', kind: 'checkgroup', required: true,
        options: [
          { value: 'instore', label: 'In Store', description: 'Sales through a physical store' },
          { value: 'online', label: 'Online', description: 'Sales through an online platform' }
        ]
      }),
      f({
        name: 'annualRevenue', label: 'Annual Revenue', kind: 'select', placeholder: 'Select from list', required: true, width: 'half',
        options: [
          { value: 'lt20', label: 'Less than SAR 20 Million' },
          { value: 'gt20', label: 'Above SAR 20 Million' }
        ]
      }),
      f({
        name: 'link', label: 'Link', kind: 'url', placeholder: 'Company website or social media link', width: 'half',
        required: (v) => Array.isArray(v.salesChannels) && (v.salesChannels as string[]).includes('online'),
        validate: (v) => (URL_RE.test(String(v)) ? null : 'Please enter a valid URL (e.g., https://example.com)')
      }),
      f({ name: 'name', label: 'Name', kind: 'text', required: true }),
      f({
        name: 'phone', label: 'Phone Number', kind: 'tel', prefix: '+966', required: true, digitsOnly: true, maxLength: 9,
        validate: (v) => (/^5\d{8}$/.test(String(v)) ? null : 'Invalid mobile number. Please enter a 9 digits number starting with 5')
      }),
      {
        type: 'custom',
        render: () => (
          <LabNote title="Demo values (synthetic)">
            <ul className="mc-demo-list">
              <li>Any other valid Unified Number (starts with 7, 10 digits) or FL number (9 digits) continues to the SMS OTP.</li>
              <li>Unified Number <code>{DEMO_EXISTING_UNIFIED}</code> or FL <code>{DEMO_EXISTING_FL}</code>: the identity already owns an account.</li>
              <li>Unified Number <code>{DEMO_IN_PROGRESS_UNIFIED}</code>: an in-progress lead exists for this CR (parked with Sales).</li>
              <li>A name with a special character (e.g. a hyphen) is accepted here and rejected by the server.</li>
              <li>Above SAR 20 Million: same SMS OTP, then a Relationship Manager outcome instead of the offer.</li>
            </ul>
          </LabNote>
        )
      }
    ],
    actions: [
      {
        label: 'Generate OTP',
        variant: 'primary',
        loading: { ms: 900, label: 'Generating OTP…' },
        set: (v) => {
          const o = leadOutcome(v);
          return { leadError: o === 'sales' || o === 'name' ? LEAD_MESSAGES[o] : '', leadReset: false, smsCode: '', otpResent: false };
        },
        to: (v) => {
          const o = leadOutcome(v);
          return o === 'existing' ? 'existing-account' : o === 'ok' ? 'lead-otp' : '';
        }
      }
    ]
  },
  {
    id: 'existing-account',
    stage: 'lead',
    title: 'Sign in to MADFU Panel',
    status: 'OBSERVED',
    statusNote: 'The toast was observed on TEST in a browser with no Madfu session; Generate OTP answered with the message and redirected to the login page.',
    variant: 'center',
    terminal: true,
    evidence: [
      ev('MDF-RULE-000074', 'rule', 'OBSERVED', 'Lead identity (CR / mobile) already owns an account: "You already have an account. Please sign in." and a redirect to the login page. No OTP, no new lead.', TEST_FL),
      shot('MDF-PAGE-000001', 'The "Sign in to MADFU Panel" login page the toast redirects to.', { date: '2026-10-06', env: 'production' }),
      ev('MDF-RULE-000056', 'rule', 'OBSERVED', 'From a signed-in browser the same message appears even for a new CR and a different mobile.', PROD)
    ],
    blocks: [
      { type: 'custom', render: () => <Toast tone="error" text={LEAD_MESSAGES.existing} /> },
      {
        type: 'custom',
        render: () => (
          <LabNote>
            Generate OTP sent no SMS and created no lead; the applicant lands on the Sign in page. The Lab stops here: signing in to an existing merchant is outside onboarding.
          </LabNote>
        )
      }
    ],
    actions: []
  },
  {
    id: 'lead-otp',
    stage: 'otp',
    title: 'OTP Verification',
    subtitle: (v) => `Enter the verification code sent to the number ${str(v, 'phone').slice(0, 6)}***`,
    status: 'OBSERVED',
    statusNote: 'Walked on TEST (Freelancer 2026-10-12; above SAR 20M 2026-10-14). The lead already exists at this point.',
    evidence: [
      shot('MDF-STATE-000075', 'OTP Verification: 4 boxes, masked number, resend after about 2 minutes, Previous / Submit.', TEST_FL),
      shot('MDF-STATE-000136', 'Toast "Your information has been submitted successfully" and the same 4-digit OTP screen (above SAR 20M).', TEST_HIGH),
      shot('MDF-STATE-000138', 'Resend: toast "OTP has been resent successfully"; countdown restarts at 2:00.', TEST_HIGH),
      ev('MDF-RULE-000080', 'rule', 'OBSERVED', '4-digit SMS code; success toast "OTP verified successfully".', TEST_FL),
      ev('MDF-RULE-000105', 'rule', 'OBSERVED', 'On TEST the SMS did not reach three real mobiles (2026-10-14), so the above-20M screen after the code is unobserved.', TEST_HIGH)
    ],
    blocks: [
      {
        type: 'custom',
        render: (ctx) =>
          ctx.values.otpResent === true
            ? <Toast tone="success" text="OTP has been resent successfully" />
            : <Toast tone="success" text="Your information has been submitted successfully" />
      },
      f(otpField('smsCode', 'Verification code')),
      { type: 'custom', render: (ctx) => <ResendTimer seconds={119} lead="Didn't receive the Code?" action="Resend the code" onResend={() => ctx.set({ otpResent: true })} /> },
      { type: 'custom', render: () => <p className="mc-proto-hint">Prototype: any 4 digits are accepted.</p> }
    ],
    actions: [
      { label: 'Previous', variant: 'secondary', back: true },
      {
        label: 'Submit',
        variant: 'primary',
        enabledWhen: fourDigits('smsCode'),
        loading: { ms: 800, label: 'Verifying…' },
        to: (v) => (v.annualRevenue === 'gt20' ? 'rm-assigned' : 'offer')
      }
    ]
  },
  {
    id: 'rm-assigned',
    stage: 'offer',
    title: 'Thank you for registering with Madfu',
    subtitle: 'A dedicated Relationship Manager has been assigned to you and will contact you shortly to get started.',
    status: 'INFERRED',
    statusNote: 'Observed up to the SMS OTP on TEST (2026-10-14). The screen after the code is from shipped code and UI copy: the TEST SMS never arrived, so it was not reached.',
    variant: 'center',
    terminal: true,
    hideProgress: true,
    evidence: [
      ev('MDF-RULE-000029', 'rule', 'INFERRED', 'Above SAR 20 Million: after the OTP the lead goes to a Relationship Manager (leadStatus confirmedOver20M); no offer and no self-service account.', CODE),
      ev('MDF-RULE-000087', 'rule', 'INFERRED', 'Shipped copy for the over SAR 20M end state.', CODE),
      shot('MDF-STATE-000136', 'Observed part of the route: same lead form and the same SMS OTP screen.', TEST_HIGH),
      ev('MDF-RULE-000105', 'rule', 'OBSERVED', 'Why the outcome is not observed: TEST SMS undelivered to three real mobiles.', TEST_HIGH),
      EV.copy151
    ],
    blocks: [
      { type: 'custom', render: () => <DocIllustration /> },
      {
        type: 'custom',
        render: () => (
          <LabNote status="INFERRED">
            No partnership offer, no account and no self-onboarding on this route: Sales / a Relationship Manager contacts the merchant. The wording is shipped copy; the screen itself was never reached.
          </LabNote>
        )
      }
    ],
    actions: []
  },
  {
    id: 'offer',
    stage: 'offer',
    title: 'Grow your sales. We handle the rest.',
    subtitle: 'A limited partnership offer tailored for your store — terms and conditions apply.',
    status: 'OBSERVED',
    statusNote: 'Walked on TEST (Freelancer, < SAR 20M) and production. No account can be created without answering the offer.',
    noBack: true,
    evidence: [
      shot('MDF-STATE-000076', 'Toast "OTP verified successfully", then the offer: 7% Special Offer, Weekly Transfers, Instant Processing, Marketing Support; No Thanks / Claim Offer.', TEST_FL),
      ev('MDF-RULE-000081', 'rule', 'OBSERVED', 'Below SAR 20M the offer must be answered before an account can be created.', TEST_FL),
      ev('MDF-RULE-000034', 'rule', 'OBSERVED', 'Claim Offer -> accept-offer -> briefing -> Create Account.', PROD)
    ],
    blocks: [
      { type: 'custom', render: () => <Toast tone="success" text="OTP verified successfully" /> },
      { type: 'custom', render: () => <OfferCards /> }
    ],
    actions: [
      { label: 'No Thanks', variant: 'ghost', to: 'offer-decline-confirm' },
      { label: 'Claim Offer', variant: 'primary', loading: { ms: 700, label: 'Claiming…' }, to: 'offer-claimed' }
    ]
  },
  {
    id: 'offer-decline-confirm',
    stage: 'offer',
    title: 'Are you sure you want to cancel?',
    status: 'OBSERVED',
    statusNote: 'Observed in production (2026-10-07).',
    variant: 'modal',
    evidence: [
      shot('MDF-STATE-000016', 'Offer decline confirmation: "Are you sure you want to cancel?" Yes / No.', PROD),
      ev('MDF-RULE-000035', 'rule', 'OBSERVED', 'Declining requires a reason; per code the lead form then resets to step 1.', PROD)
    ],
    blocks: [],
    actions: [
      { label: 'No', variant: 'secondary', back: true },
      { label: 'Yes', variant: 'primary', to: 'offer-reasons' }
    ]
  },
  {
    id: 'offer-reasons',
    stage: 'offer',
    title: 'Rejection Reasons',
    subtitle: 'Your experience matters to us. Share the reason behind your decision, it helps us serve you better in the future.',
    status: 'OBSERVED',
    statusNote: 'Dialog observed in production (Submit disabled until a reason is chosen). What happens after Submit is read from code: rejectOffer resets the lead form to step 1.',
    variant: 'modal',
    evidence: [
      shot('MDF-STATE-000017', 'Five reasons; Submit disabled until one is chosen. Closed without submitting.', PROD),
      ev('MDF-RULE-000035', 'rule', 'OBSERVED', 'Mandatory reason; the reset to the lead form is from code (a reason was not submitted live).', PROD),
      EV.copy151
    ],
    blocks: [
      f({ name: 'declineReason', label: 'Reason', kind: 'radio', required: true, options: DECLINE_REASONS.map((r) => ({ value: r, label: r })) })
    ],
    actions: [
      {
        label: 'Submit',
        variant: 'primary',
        enabledWhen: (v) => !!str(v, 'declineReason'),
        loading: { ms: 600, label: 'Submitting…' },
        set: () => ({ leadReset: true, declineReason: '', smsCode: '', leadError: '' }),
        to: 'lead'
      }
    ]
  },
  {
    id: 'offer-claimed',
    stage: 'offer',
    title: 'Offer Successfully Claimed',
    status: 'OBSERVED',
    statusNote: 'Walked on TEST and production.',
    variant: 'center',
    noBack: true,
    evidence: [shot('MDF-STATE-000077', '"Offer Successfully Claimed": four next steps, resume hint, Create Account.', TEST_FL), EV.copy151],
    blocks: [
      { type: 'custom', render: () => <DocIllustration /> },
      { type: 'heading', text: 'Whats next:' },
      {
        type: 'list',
        items: ["Create a Merchant's account", 'Fill in the form (5-10 mins)', 'Get quick approval', 'Start selling with MADFU and get paid']
      },
      {
        type: 'text',
        muted: true,
        text: 'After creating your account, you can pause at any time, and your progress wont be lost. Just sign in with your email and password and continue where you left off'
      }
    ],
    actions: [{ label: 'Create Account', variant: 'primary', to: 'register' }]
  },
  {
    id: 'register',
    stage: 'account',
    title: 'Register your account',
    status: 'OBSERVED',
    statusNote: 'Walked on TEST (Freelancer) and production. The CR applicant\'s own account screens were not captured (the CR account was prepared by QA); they are the same screens.',
    noBack: true,
    evidence: [
      shot('MDF-STATE-000078', 'Register your account: identifier shown, Email, Password, Confirm Password, two consents; Sign Up disabled.', TEST_FL),
      shot('MDF-STATE-000079', 'Six-line password checklist all met; Sign Up enabled.', TEST_FL),
      ev('MDF-RULE-000037', 'rule', 'OBSERVED', 'Password: >= 8, uppercase, lowercase, digit, special from ! @ # $ % ^ & * _ - + = ?, match. Sign Up only when email valid, all six met and both consents ticked.', TEST_FL),
      ev('MDF-RULE-000036', 'rule', 'OBSERVED', 'The Terms link is the full merchant agreement: the commercial agreement is accepted at sign-up, before any KYC.', PROD),
      ev('MDF-RULE-000082', 'rule', 'OBSERVED', 'Sign Up -> "Please check your inbox".', TEST_FL)
    ],
    blocks: [
      { type: 'custom', render: (ctx) => <p className="mc-inline-id"><strong>{identifierLabel(ctx.values)}</strong> {identifierValue(ctx.values)}</p> },
      f({
        name: 'email', label: 'Email address', kind: 'email', required: true,
        validate: (v) => (EMAIL_RE.test(String(v)) ? null : 'Please enter a valid email address.')
      }),
      f({ name: 'pw', label: 'Password', kind: 'password', required: true }),
      f({ name: 'pwConfirm', label: 'Confirm Password', kind: 'password', required: true }),
      { type: 'custom', render: (ctx) => <PasswordChecklist values={ctx.values} /> },
      f({ name: 'termsAccepted', label: 'I have read and agreed to the Terms and Conditions', kind: 'checkbox', required: true }),
      f({ name: 'privacyAccepted', label: 'I have read and agreed to the Privacy Policy', kind: 'checkbox', required: true })
    ],
    actions: [
      {
        label: 'Sign Up',
        variant: 'primary',
        loading: { ms: 900, label: 'Creating account…' },
        // The typed password is not kept in the Lab once the account exists.
        set: (v) => ({ pw: '', pwConfirm: '', signinEmail: str(v, 'email') }),
        to: 'check-inbox'
      }
    ]
  },
  {
    id: 'check-inbox',
    stage: 'account',
    title: 'Please check your inbox',
    subtitle: (v) => `Please check ${str(v, 'email')} inbox for verification`,
    status: 'OBSERVED',
    statusNote: 'Walked on TEST. The verification e-mail itself is simulated by the Lab button.',
    variant: 'center',
    noBack: true,
    evidence: [
      shot('MDF-STATE-000080', '"Please check your inbox" with a Resend Email timer.', TEST_FL),
      ev('MDF-RULE-000082', 'rule', 'OBSERVED', 'Verification is a link sent by e-mail.', TEST_FL)
    ],
    blocks: [
      { type: 'custom', render: () => <EnvelopeIllustration /> },
      { type: 'custom', render: () => <ResendTimer seconds={59} action="Resend Email" /> },
      {
        type: 'custom',
        render: () => (
          <LabNote>The applicant now leaves the portal, opens their mailbox and clicks the verification link. The button below simulates that click.</LabNote>
        )
      }
    ],
    actions: [{ label: 'Open the e-mail link (simulated)', variant: 'primary', loading: { ms: 500, label: 'Opening link…' }, to: 'signin' }]
  },
  {
    id: 'signin',
    stage: 'account',
    title: 'Sign in to MADFU Panel',
    status: 'OBSERVED',
    statusNote: 'The verification link lands on Sign in with a success toast; it does not sign the applicant in. Sign-in observed for the Freelancer (2026-10-12) and the Registered Business (2026-10-13).',
    noBack: true,
    evidence: [
      shot('MDF-STATE-000082', 'Toast "Email validated successfully" on the Sign in page; the user is not logged in by the link.', TEST_FL),
      shot('MDF-STATE-000095', 'Sign in (Registered Business): Email address, Password, Forgot Password ?, Sign in.', TEST_CR),
      ev('MDF-RULE-000039', 'rule', 'OBSERVED', 'Verification chain: SMS OTP -> e-mail link -> mandatory sign-in -> 4-digit e-mail code on every sign-in.', TEST_FL),
      ev('MDF-RULE-000100', 'rule', 'OBSERVED', 'Existing CR applicant: email + password -> 4-digit e-mail code -> the wizard resumes at the saved step.', TEST_CR)
    ],
    blocks: [
      { type: 'custom', render: () => <Toast tone="success" text="Email validated successfully" /> },
      f({ name: 'signinEmail', label: 'Email address', kind: 'email', required: true, validate: (v) => (EMAIL_RE.test(String(v)) ? null : 'Please enter a valid email address.') }),
      f({ name: 'signinPw', label: 'Password', kind: 'password', required: true, hint: 'Prototype: any password is accepted and nothing is stored.' })
    ],
    actions: [
      { label: 'Sign in', variant: 'primary', loading: { ms: 800, label: 'Signing in…' }, set: () => ({ signinPw: '', emailCode: '' }), to: 'email-code' }
    ]
  },
  {
    id: 'email-code',
    stage: 'account',
    title: 'Email verification',
    subtitle: 'Enter the 4-digit code you received through email',
    status: 'OBSERVED',
    statusNote: 'Walked on TEST (Freelancer and Registered Business). A 4-digit e-mail code is required at every sign-in, after which the wizard resumes at the saved step.',
    noBack: true,
    evidence: [
      shot('MDF-STATE-000081', 'Toast "OTP has been sent successfully"; 4-digit e-mail code, resend timer, Submit.', TEST_FL),
      shot('MDF-STATE-000096', 'E-mail code at sign-in (Registered Business); the code is redacted in the capture.', TEST_CR),
      ev('MDF-RULE-000083', 'rule', 'OBSERVED', 'Every sign-in sends a 4-digit e-mail code before the wizard opens.', TEST_FL),
      ev('MDF-RULE-000055', 'rule', 'OBSERVED', 'Progress is held server-side and resumes at the saved step.', TEST_FL),
      ev('MDF-RULE-000100', 'rule', 'OBSERVED', 'Registered Business resumed at Merchant Information after the code.', TEST_CR)
    ],
    blocks: [
      { type: 'custom', render: () => <Toast tone="success" text="OTP has been sent successfully" /> },
      f(otpField('emailCode', 'Email verification code')),
      { type: 'custom', render: () => <ResendTimer seconds={119} lead="Didn't receive the Code?" action="Resend the code" /> },
      { type: 'custom', render: () => <p className="mc-proto-hint">Prototype: any 4 digits are accepted.</p> }
    ],
    actions: [
      {
        label: 'Submit',
        variant: 'primary',
        enabledWhen: fourDigits('emailCode'),
        loading: { ms: 900, label: 'Verifying…' },
        set: (v) => ({ contactPhoneMasked: maskMobile(str(v, 'phone')) }),
        to: (v) => (isFL(v) ? 'merchant-fl' : 'merchant-cr')
      }
    ]
  },

  // ------------------------------------------------------------------- Registered Business (CR)
  {
    id: 'merchant-cr',
    stage: 'merchant',
    title: 'Merchant Information',
    status: 'OBSERVED',
    statusNote: 'Walked on TEST (2026-10-13, single-use QA account). Wathq returned the CR and one owner. Selecting the owner is mandatory; no manual-entry, someone-else or delegation option was shown. No document uploads and no extra OTP. No Back on this step.',
    noBack: true,
    evidence: [
      shot('MDF-STATE-000097', 'Green "Verified" card (Unified Number, Legal Business Name, address line; retrieved, read-only) and "Are you one of the below *": one owner card with name and ID masked first 4 / last 2. Continue disabled until an owner is selected.', TEST_CR),
      shot('MDF-STATE-000098', 'Owner selected: Phone Number appears pre-filled with the masked lead mobile, read-only, "Phone number must be owned by Same ID". Continue enabled.', TEST_CR),
      ev('MDF-RULE-000089', 'rule', 'OBSERVED', 'Wathq returns owners: verified CR card + mandatory owner selection; no manual, someone-else or delegation option was shown (one owner returned); no uploads.', TEST_CR),
      ev('MDF-RULE-000090', 'rule', 'OBSERVED', 'Continue -> SubmitSpocInfo (isDelegate=false, spocId = owner) -> no extra OTP.', TEST_CR),
      ev('MDF-JOURNEY-000008', 'journey', 'UNKNOWN', 'TEST-data note, not a product branch: on 2026-10-12 the TEST Wathq mock returned no owners -> manual fields; Continue later failed silently (422). Production behaviour with no owners: UNKNOWN.', TEST_FL),
      EV.network211,
      EV.journey10
    ],
    blocks: [
      { type: 'custom', render: (ctx) => <WathqCard unified={str(ctx.values, 'unifiedNumber')} legalName={DEMO_CR_NAME} address={DEMO_CR_ADDRESS} /> },
      f({ name: 'ownerChoice', label: 'Are you one of the below', kind: 'radio-cards', required: true, options: ownerOptions }),
      f({ ...contactPhoneField, when: (v) => !!str(v, 'ownerChoice') }),
      {
        type: 'custom',
        render: () => (
          <LabNote title="Not observed: several owners, or an applicant who is not an owner" status="UNKNOWN">
            The walked CR returned one owner. What the list looks like with several owners, and whether a non-owner or delegate can continue, is not established.
          </LabNote>
        )
      },
      {
        type: 'custom',
        render: () => (
          <LabNote title="TEST-data note (not a product branch)" status="UNKNOWN">
            On 2026-10-12 the TEST Wathq mock returned no owners, so the form showed manual fields; Continue then failed silently at Business Information (HTTP 422). That was a defect in TEST data. What production shows when Wathq returns no owners is unknown.
          </LabNote>
        )
      }
    ],
    actions: [
      {
        label: 'Continue',
        variant: 'primary',
        loading: { ms: 900, label: 'Saving…' },
        set: (v) => ({ fullName: DEMO_PERSON, idNumber: demoNationalId(), contactEmail: str(v, 'email') || DEMO_EMAIL, ownerMatch: true }),
        to: 'business-cr'
      }
    ]
  },
  {
    id: 'business-cr',
    stage: 'business',
    title: 'Business Information',
    status: 'OBSERVED',
    statusNote: 'Walked on TEST (2026-10-13). Proof of sales is the only document. The IBAN is verified server-side; bank name and SWIFT follow the IBAN and the IBAN locks. The Lab waits for the verification result before Continue. No Back on this step.',
    noBack: true,
    evidence: [
      shot('MDF-STATE-000099', 'Business Information directly after owner selection: Tax Returns or Proof of Sales * (PDF, max 3 MB), Bank Name *, IBAN Number *, I\'m VAT Registered. No category, channel, beneficiary, SWIFT or IBAN-certificate fields.', TEST_CR),
      shot('MDF-STATE-000100', 'VAT registered ON adds VAT Certificate * (PDF) and VAT Registration Number *. No lookup on toggle.', TEST_CR),
      shot('MDF-STATE-000101', 'Bank list: 11 banks.', TEST_CR),
      shot('MDF-STATE-000102', 'Arab National Bank selected, IBAN empty, Continue disabled.', TEST_CR),
      shot('MDF-STATE-000103', 'IBAN verified: green strip with Bank Name and Swift Code and "Verified"; IBAN read-only; the bank named comes from the IBAN although Arab National Bank was selected; no mismatch message.', TEST_CR),
      ev('MDF-RULE-000091', 'rule', 'OBSERVED', 'Registered Business document burden: one PDF (Tax Returns or Proof of Sales); VAT Certificate only if VAT registered.', TEST_CR),
      ev('MDF-RULE-000092', 'rule', 'OBSERVED', 'Proof of sales + Bank Name + IBAN + VAT switch. Category, sales channel, beneficiary, SWIFT and IBAN certificate are not asked.', TEST_CR),
      ev('MDF-RULE-000093', 'rule', 'OBSERVED', 'VerifyIban is sent with the IBAN and selected bankId only; the comparison basis is server-side and not visible; no third-party host is called from the browser.', TEST_CR),
      ev('MDF-RULE-000094', 'rule', 'OBSERVED', 'Verified bank details come from the IBAN, not the selected bank; the returned beneficiary differs from the CR legal name without a warning.', TEST_CR),
      ev('MDF-RULE-000095', 'rule', 'OBSERVED', 'VAT OFF by default; ON adds number + certificate; no VAT lookup.', TEST_CR),
      ev('MDF-RULE-000077', 'rule', 'OBSERVED', 'Earlier run with a mock IBAN: VerifyIban answered HTTP 400, nothing was shown and Continue stayed enabled.', TEST_FL),
      ev('MDF-RULE-000050', 'rule', 'OBSERVED', 'VAT number: 15 digits starting with 3.', TEST_FL),
      EV.network211
    ],
    blocks: [
      f(upload('taxDoc', 'Tax Returns or Proof of Sales')),
      { type: 'heading', text: 'Bank Information' },
      f(bankField),
      f({ ...ibanField, readOnly: ibanVerified }),
      { type: 'custom', render: (ctx) => <IbanVerification ctx={ctx} /> },
      {
        type: 'custom',
        when: (v) => ibanVerified(v) && !!str(v, 'bank') && BANKS.find((b) => b.value === str(v, 'bank'))?.verifiedName !== str(v, 'verifiedBankName'),
        render: (ctx) => (
          <LabNote title="Known current issue: the selected bank is not enforced" status="OBSERVED">
            You selected {BANKS.find((b) => b.value === str(ctx.values, 'bank'))?.label}; the verified result names {str(ctx.values, 'verifiedBankName')} (derived from the IBAN) and still says Verified, with no mismatch message. Observed on TEST, 2026-10-13.
          </LabNote>
        )
      },
      {
        type: 'custom',
        render: () => (
          <LabNote title="How the IBAN check works today" status="OBSERVED">
            The check runs on Madfu&apos;s server: the request carries only the IBAN and the selected bank. Madfu product names the provider as Spare; this is not visible from the browser, and what the IBAN is compared against (CR, Unified Number or legal entity) is unknown. The beneficiary name the bank returns is not shown here, only on the Summary, and it is not matched to the CR legal name. On an earlier TEST run a mock IBAN failed the check (HTTP 400) with no message.
          </LabNote>
        )
      },
      ...vatFields.map(f)
    ],
    actions: [
      {
        label: 'Continue',
        variant: 'primary',
        loading: { ms: 1000, label: 'Saving…' },
        set: () => ({ contractOutcome: 'created' }),
        to: 'summary'
      }
    ]
  },

  // ---------------------------------------------------------------------------------- Freelancer
  {
    id: 'merchant-fl',
    stage: 'merchant',
    title: 'Merchant Information',
    status: 'OBSERVED',
    statusNote: 'Walked on TEST (Freelancer, 2026-10-12) and production. Identity is typed and three PDFs are mandatory; no automated identity check. Delegation Certificate observed in production.',
    noBack: true,
    evidence: [
      shot('MDF-STATE-000083', 'Freelancer Merchant Information: National Address, ID / Iqama, Freelance Certificate (PDF), Full Name, ID Number, Phone (lead mobile), Email, Delegation Certificate toggle.', TEST_FL),
      shot('MDF-STATE-000084', 'Three uploads show "Success"; Continue enabled; Delegation left off.', TEST_FL),
      shot('MDF-STATE-000022', 'Delegation Certificate ON adds a mandatory PDF upload.', PROD),
      ev('MDF-RULE-000041', 'rule', 'OBSERVED', 'Freelancer: 3 PDF uploads + Full Name + ID Number + email; phone locked to the lead mobile.', TEST_FL),
      ev('MDF-RULE-000044', 'rule', 'OBSERVED', 'Uploads: PDF only, max 3 MB each.', TEST_FL),
      ev('MDF-RULE-000040', 'rule', 'OBSERVED', 'Freelancer: GetFullInfo still queries Wathq and fails (code 1500); the message is not shown.', TEST_FL),
      EV.journey9
    ],
    blocks: [
      { type: 'custom', render: (ctx) => <IdentifierCard label="Freelance Certificate Number" value={`FL - ${str(ctx.values, 'flNumber')}`} /> },
      f({ ...upload('nationalAddressDoc', 'National Address'), width: 'half' }),
      f({ ...upload('idDoc', 'Upload your ID / Iqama'), width: 'half' }),
      f(upload('flCertDoc', 'Freelance Certificate')),
      f(fullNameField),
      f(idNumberField),
      f(contactPhoneField),
      f(contactEmailField),
      f({ name: 'delegation', label: 'Delegation Certificate', kind: 'toggle' }),
      f(upload('delegationDoc', 'Delegation Certificate', (v) => v.delegation === true)),
      {
        type: 'custom',
        render: () => (
          <LabNote title="Known current issue: the Wathq result is not shown" status="OBSERVED">
            GetFullInfo is called for Freelancers too and always fails with code 1500. Nothing is shown; the applicant types and uploads everything, and the documents are reviewed manually after submission.
          </LabNote>
        )
      }
    ],
    actions: [{ label: 'Continue', variant: 'primary', loading: { ms: 900, label: 'Saving…' }, to: 'business-fl' }]
  },
  {
    id: 'business-fl',
    stage: 'business',
    title: 'Business Information',
    status: 'OBSERVED',
    statusNote: 'Walked on TEST (Freelancer) and production. No automatic IBAN verification for Freelancers: beneficiary and SWIFT are typed, the IBAN certificate is uploaded.',
    noBack: true,
    evidence: [
      shot('MDF-STATE-000085', 'Freelancer Business Information: proof of sales, Bank Name, IBAN, Beneficiary Name, Swift Code, IBAN Certificate (PDF), VAT switch.', TEST_FL),
      shot('MDF-STATE-000086', 'Arabic beneficiary name accepted despite the English-spelling hint; SWIFT typed manually.', TEST_FL),
      ev('MDF-RULE-000079', 'rule', 'OBSERVED', 'Beneficiary and SWIFT typed manually; Arabic beneficiary accepted.', TEST_FL),
      ev('MDF-RULE-000048', 'rule', 'OBSERVED', 'Freelancer: no IBAN verification call; IBAN certificate required.', TEST_FL),
      ev('MDF-RULE-000051', 'rule', 'OBSERVED', 'IBAN Saudi pattern, uppercase only; SWIFT 8 or 11 letters.', TEST_FL),
      ev('MDF-RULE-000052', 'rule', 'OBSERVED', 'Tax Returns or Proof of Sales is mandatory for every applicant.', TEST_FL)
    ],
    blocks: [
      f(upload('taxDoc', 'Tax Returns or Proof of Sales')),
      { type: 'heading', text: 'Bank Information' },
      f(bankField),
      f(ibanField),
      f({ name: 'beneficiaryName', label: 'Beneficiary Name', kind: 'text', required: true, width: 'half', hint: 'The English Spelling must match the spelling used by the bank' }),
      f({
        name: 'swiftCode', label: 'Swift Code', kind: 'text', required: true, width: 'half', maxLength: 11,
        validate: (v) => (/^[A-Za-z]{8}([A-Za-z]{3})?$/.test(String(v)) ? null : 'Please enter a valid SWIFT/BIC code.')
      }),
      f(upload('ibanCertDoc', 'IBAN Certificate')),
      ...vatFields.map(f),
      {
        type: 'custom',
        render: () => (
          <LabNote title="Not enforced" status="OBSERVED">
            The beneficiary hint asks for the English spelling, but an Arabic name is accepted. Nothing on this step is checked against the bank.
          </LabNote>
        )
      }
    ],
    actions: [{ label: 'Continue', variant: 'primary', loading: { ms: 1000, label: 'Saving…' }, to: 'summary' }]
  },

  // ---------------------------------------------------------------------------------- Review
  {
    id: 'summary',
    stage: 'review',
    title: 'Almost there, Review Your Information',
    subtitle: 'Please review your information, representative details, and attachments before final submission.',
    status: 'OBSERVED',
    statusNote: 'Observed for the Registered Business (2026-10-13) and the Freelancer (2026-10-12) on TEST. No section Edit; Previous was not exercised (single-use account), so the Lab simply returns to Business Information.',
    evidence: [
      shot('MDF-STATE-000104', 'Registered Business: three collapsible sections; Previous; Proceed To Contract Sign-Off. No per-section Edit.', TEST_CR),
      shot('MDF-STATE-000105', 'CR Merchant Information: Legal Business Name, National Address (retrieved), Full Name, ID Number in full, Phone and Email masked.', TEST_CR),
      shot('MDF-STATE-000106', 'CR Business Information: IBAN in full, Beneficiary Name (returned by the bank check; differs from the legal name, not flagged), SWIFT Code.', TEST_CR),
      shot('MDF-STATE-000107', 'CR Attachments: one file, Tax_return.', TEST_CR),
      ev('MDF-RULE-000096', 'rule', 'OBSERVED', 'CR Summary sections and CTA "Proceed To Contract Sign-Off"; no per-section Edit.', TEST_CR),
      ev('MDF-RULE-000097', 'rule', 'OBSERVED', 'No Back on Merchant / Business Information; stepper display-only; Previous only on the Summary.', TEST_CR),
      shot('MDF-STATE-000087', 'Freelancer: toast "Your information has been submitted successfully"; three collapsible blocks; Previous / Submit.', TEST_FL),
      shot('MDF-STATE-000090', 'Freelancer Attachments: IBAN Certificate, Tax_return, National Address, Freelance Certificate, ID/Iqama.', TEST_FL),
      ev('MDF-RULE-000084', 'rule', 'OBSERVED', 'Freelancer summary shows "-" for Legal Business Name and National Address although a National Address PDF was uploaded.', TEST_FL),
      ev('MDF-RULE-000057', 'rule', 'OBSERVED', 'Fully verified (Wathq owner + IBAN verified) -> contract before submission; otherwise (Freelancer) straight to manual review.', TEST_CR)
    ],
    blocks: [
      { type: 'custom', when: isFL, render: () => <Toast tone="success" text="Your information has been submitted successfully" /> },
      { type: 'custom', render: (ctx) => <SummaryBlocks values={ctx.values} /> },
      {
        type: 'custom',
        when: isFL,
        render: () => (
          <LabNote title="Known current issue: missing values" status="OBSERVED">
            For a Freelancer, Legal Business Name and National Address show &quot;-&quot; even though a National Address PDF was uploaded.
          </LabNote>
        )
      },
      {
        type: 'custom',
        when: isCR,
        render: () => (
          <LabNote title="Known current issue: beneficiary not matched" status="OBSERVED">
            The Beneficiary Name returned by the bank check differs from the CR legal name, and nothing flags it.
          </LabNote>
        )
      },
      {
        type: 'custom',
        when: (v) => v.vatRegistered === true,
        render: () => (
          <LabNote status="UNKNOWN">
            Whether the VAT certificate is listed under Attachments was not observed: VAT was left off in both walks.
          </LabNote>
        )
      },
      {
        type: 'custom',
        render: (ctx) => (
          <LabNote title={isCR(ctx.values) ? 'Next: the contract, before final submission' : 'Next: manual review, no contract'} status="OBSERVED">
            {isCR(ctx.values)
              ? 'The owner was selected from Wathq and the IBAN verified, so the application counts as fully verified: the CTA is Proceed To Contract Sign-Off.'
              : 'A Freelancer is not auto-verified (no registry owner match, no IBAN check), so Submit sends the application straight to review with no contract.'}
          </LabNote>
        )
      },
      {
        type: 'custom',
        when: isCR,
        render: (ctx) => (
          <LabChoice
            legend="SignContract answer"
            value={str(ctx.values, 'contractOutcome') === 'fail' ? 'fail' : 'created'}
            onPick={(x) => ctx.set({ contractOutcome: x })}
            options={[
              { value: 'created', label: 'Contract created (retry, about 5 s)', status: 'OBSERVED' },
              { value: 'fail', label: 'No answer after about 60 s (first attempt)', status: 'OBSERVED' }
            ]}
          />
        )
      }
    ],
    actions: [
      { label: 'Previous', variant: 'secondary', to: (v) => (isFL(v) ? 'business-fl' : 'business-cr') },
      {
        label: (v) => (isCR(v) ? 'Proceed To Contract Sign-Off' : 'Submit'),
        variant: 'primary',
        loading: { ms: 1600, label: 'Please wait…' },
        set: (v) => ({ contractPath: isCR(v), surveySkipped: false, submitRequestFailed: false }),
        to: (v) => (isFL(v) ? 'survey' : str(v, 'contractOutcome') === 'fail' ? 'contract-failed' : 'contract')
      }
    ]
  },

  // ---------------------------------------------------------------------------- CR contract
  {
    id: 'contract-failed',
    stage: 'contract',
    title: 'We were unable to create your contract.',
    subtitle: "Please click on 'Submit Request' and we will create the contract later.",
    status: 'OBSERVED',
    statusNote: 'Observed on TEST (2026-10-13) after SignContract got no answer for about 60 s. Submit Request failed twice; a page reload returned to the Summary and the retry created the contract. Stepper hidden.',
    variant: 'center',
    noBack: true,
    hideProgress: true,
    evidence: [
      shot('MDF-STATE-000109', 'Full-page spinner over the Summary while SignContract is pending (about 60 s).', TEST_CR),
      shot('MDF-STATE-000110', '"We were unable to create your contract." Single button Submit Request. Stepper hidden.', TEST_CR),
      shot('MDF-STATE-000111', 'Submit Request: SubmitOnboarding 200 with data null; toast "Something went wrong. Please try again later."', TEST_CR),
      shot('MDF-STATE-000112', 'Retry: same result; the application was not submitted.', TEST_CR),
      shot('MDF-STATE-000113', 'After a page reload the wizard resumes at the Summary with Proceed To Contract Sign-Off available again.', TEST_CR),
      ev('MDF-RULE-000098', 'rule', 'OBSERVED', 'First SignContract attempt: no response for about 60 s, then this screen.', TEST_CR),
      ev('MDF-RULE-000099', 'rule', 'OBSERVED', 'Submit Request after the failure: generic error, page unchanged (reproduced twice).', TEST_CR),
      ev('MDF-RULE-000101', 'rule', 'OBSERVED', 'Reload + retry recovered: the contract was created in about 4.7 s.', TEST_CR)
    ],
    blocks: [
      { type: 'custom', when: (v) => v.submitRequestFailed === true, render: () => <Toast tone="error" text="Something went wrong. Please try again later." /> },
      { type: 'custom', render: () => <DocIllustration /> },
      {
        type: 'custom',
        render: (ctx) => (
          <LabNote title="Known current issue: the fallback does not work" status="OBSERVED">
            <p>On TEST, Submit Request after this screen failed twice and nothing was submitted. Whether &quot;we will create the contract later&quot; ever works is unknown. What recovered the application was reloading the page: it reopened the Summary, and the second attempt created the contract.</p>
            <p>
              <LabButton
                onClick={() => {
                  ctx.set({ contractOutcome: 'created', submitRequestFailed: false });
                  ctx.go('summary');
                }}
              >
                Reload the page
              </LabButton>
            </p>
          </LabNote>
        )
      }
    ],
    actions: [
      {
        label: 'Submit Request',
        variant: 'primary',
        loading: { ms: 900, label: 'Submitting…' },
        set: () => ({ submitRequestFailed: true })
      }
    ]
  },
  {
    id: 'contract',
    stage: 'contract',
    title: 'Read the contract to sign-off',
    subtitle: 'Please review your contract and all the contract details to sign-off easily',
    status: 'OBSERVED',
    statusNote: 'Observed on TEST (2026-10-13): Madfu embeds Signit (sandbox, Arabic) showing the Madfu merchant agreement. The Lab simulates the Signit frame; the agreement text is not reproduced. Madfu\'s Submit Request stays disabled until signing completes.',
    noBack: true,
    evidence: [
      shot('MDF-STATE-000114', '"Read the contract to sign-off"; stepper on Contract Sign-off; embedded Signit with terms / privacy notice and "Agree & continue"; Submit Request disabled.', TEST_CR),
      shot('MDF-STATE-000120', 'Signit: "Review the document and fill the required fields (2)" with Next / Previous; date fields pre-filled.', TEST_CR),
      shot('MDF-STATE-000121', 'Signit: the Madfu merchant agreement (Arabic).', TEST_CR),
      shot('MDF-STATE-000122', 'Signit: signature dialog over the document.', TEST_CR),
      shot('MDF-STATE-000123', 'Signit closes; Madfu switches to the signed state (MarkContractSignedWaitingVerification 200).', TEST_CR),
      ev('MDF-RULE-000102', 'rule', 'OBSERVED', 'Contract sign-off is an embedded Signit flow: agree -> fill 2 fields -> sign -> signed; Submit Request enabled only after signing.', TEST_CR)
    ],
    blocks: [
      {
        type: 'custom',
        render: (ctx) => (
          <SignitFrame
            onSigned={() => {
              ctx.set({ contractSigned: true });
              ctx.go('contract-signed');
            }}
          />
        )
      }
    ],
    actions: [{ label: 'Submit Request', variant: 'primary', enabledWhen: (v) => v.contractSigned === true, to: 'contract-signed' }]
  },
  {
    id: 'contract-signed',
    stage: 'contract',
    title: 'Your contract has been signed successfully',
    subtitle: 'Please click the button below to proceed with submitting your request',
    status: 'OBSERVED',
    statusNote: 'Observed on TEST (2026-10-13). Signing does not submit the application: Submit Request is a separate, required step.',
    variant: 'center',
    noBack: true,
    evidence: [
      shot('MDF-STATE-000116', '"Your contract has been signed successfully"; Submit Request enabled; no other actions.', TEST_CR),
      shot('MDF-STATE-000117', 'Submit Request pressed: SignOff in progress.', TEST_CR),
      ev('MDF-RULE-000103', 'rule', 'OBSERVED', 'After signing, Submit Request is a separate, required submit (SignOff) -> "Submitted successfully!" with the survey.', TEST_CR)
    ],
    blocks: [{ type: 'custom', render: () => <DocIllustration /> }],
    actions: [
      {
        label: 'Submit Request',
        variant: 'primary',
        loading: { ms: 900, label: 'Submitting…' },
        set: () => ({ contractPath: true, surveySkipped: false }),
        to: 'survey'
      }
    ]
  },

  // ----------------------------------------------------------------------------- Submission
  {
    id: 'survey',
    stage: 'submit',
    title: 'We’d love to hear from you!',
    subtitle: 'Please take a moment to share your experience with MADFU onboarding. Your feedback helps us improve.',
    status: 'OBSERVED',
    statusNote: 'Observed for both types on TEST. The Registered Business version adds "Contract Sign-Off Experience". Which answers Submit Survey requires is not established; the Lab asks for every rating.',
    variant: 'modal',
    hideProgress: true,
    noBack: true,
    evidence: [
      shot('MDF-STATE-000118', 'Registered Business: "Submitted successfully!" behind the survey; 1-5 ratings incl. Contract Sign-Off Experience, Open Feedback; Skip for Now / Submit Survey.', TEST_CR),
      shot('MDF-STATE-000091', 'Freelancer: toast "Onboarding submitted successfully and is now pending review"; survey without the contract question.', TEST_FL),
      ev('MDF-RULE-000086', 'rule', 'OBSERVED', 'Survey can be skipped ("No problem, we\'ll ask again later."); skips are counted server-side.', TEST_FL),
      ev('MDF-RULE-000085', 'rule', 'OBSERVED', 'Freelancer submit goes to review with no contract step.', TEST_FL)
    ],
    blocks: [
      { type: 'custom', when: (v) => v.contractPath !== true, render: () => <Toast tone="success" text="Onboarding submitted successfully and is now pending review" /> },
      {
        type: 'custom',
        when: (v) => v.contractPath === true,
        render: () => <LabNote>Behind this dialog the page already reads &quot;Submitted successfully!&quot;.</LabNote>
      },
      { type: 'custom', render: () => <RatingHint /> },
      ...SURVEY_QUESTIONS.map((q) => f({ name: q.name, label: q.label, kind: 'radio', options: ratingOptions, ...(q.when ? { when: q.when } : {}) })),
      f({ name: 'feedback', label: 'Open Feedback', kind: 'textarea', placeholder: 'Open Feedback' })
    ],
    actions: [
      { label: 'Skip for Now', variant: 'secondary', set: () => ({ surveySkipped: true }), to: 'submitted' },
      {
        label: 'Submit Survey',
        variant: 'primary',
        enabledWhen: (v) => SURVEY_QUESTIONS.filter((q) => !q.when || q.when(v)).every((q) => !!str(v, q.name)),
        loading: { ms: 700, label: 'Sending…' },
        set: () => ({ surveySkipped: false }),
        to: 'submitted'
      }
    ]
  },
  {
    id: 'submitted',
    stage: 'submit',
    title: 'Submitted successfully!',
    subtitle: "Thanks for completing your details. We're reviewing everything now and will reach out to you soon.",
    status: 'OBSERVED',
    statusNote: 'Observed on TEST for the Freelancer (2026-10-12) and the Registered Business (2026-10-13). The application waits for Madfu review; no activation, dashboard link or next step is shown.',
    variant: 'center',
    terminal: true,
    hideProgress: true,
    noBack: true,
    evidence: [
      shot('MDF-STATE-000119', 'Registered Business: toast "No problem, we\'ll ask again later." then "Submitted successfully!"; no activation, dashboard or next-step CTA.', TEST_CR),
      shot('MDF-STATE-000092', 'Freelancer: Skip for Now -> toast -> "Submitted successfully!".', TEST_FL),
      ev('MDF-RULE-000103', 'rule', 'OBSERVED', 'Final screen after the contract and Submit Request: under review.', TEST_CR),
      ev('MDF-RULE-000085', 'rule', 'OBSERVED', 'Freelancer: Submit -> pending review -> survey -> Submitted successfully; Contract Sign-off never visited.', TEST_FL),
      EV.journey10,
      EV.journey9
    ],
    blocks: [
      { type: 'custom', when: (v) => v.surveySkipped === true, render: () => <Toast tone="success" text="No problem, we'll ask again later." /> },
      { type: 'custom', render: () => <DocIllustration /> },
      {
        type: 'custom',
        render: () => (
          <LabNote title="Where the evidence stops" status="UNKNOWN">
            The review outcome, approval and account activation after this screen were not observed for either business type.
          </LabNote>
        )
      }
    ],
    actions: []
  }
];

function SummaryBlocks({ values: v }: { values: Values }) {
  const fl = isFL(v);
  const merchantRows: Array<[string, string]> = fl
    ? [
        ['Legal Business Name', '-'],
        ['National Address', '-'],
        ['Full Name', str(v, 'fullName')],
        ['ID Number', str(v, 'idNumber')],
        ['Phone Number', maskMobile(str(v, 'phone'))],
        ['Email Address', maskEmail(str(v, 'contactEmail'))]
      ]
    : [
        ['Legal Business Name', DEMO_CR_NAME],
        ['National Address', DEMO_CR_ADDRESS],
        ['Full Name', str(v, 'fullName')],
        ['ID Number', str(v, 'idNumber')],
        ['Phone Number', maskMobile(str(v, 'phone'))],
        ['Email Address', maskEmail(str(v, 'contactEmail'))]
      ];
  const businessRows: Array<[string, string]> = [
    ['IBAN', str(v, 'iban')],
    ['Beneficiary Name', fl ? str(v, 'beneficiaryName') : str(v, 'bankBeneficiary')],
    ['SWIFT Code', fl ? str(v, 'swiftCode') : str(v, 'verifiedSwift')]
  ];
  const files = fl ? ['IBAN Certificate', 'Tax_return', 'National Address', 'Freelance Certificate', 'ID/Iqama'] : ['Tax_return'];
  return (
    <div className="mc-collapse-group">
      <SummarySection title="Merchant Information" rows={merchantRows} />
      <SummarySection title="Business Information" rows={businessRows} />
      <SummarySection title="Attachments" files={files} />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// The real Madfu stepper per screen (Register shows three steps; the wizard four).
// ---------------------------------------------------------------------------------------------
const STEPPER: Record<string, { current: number; steps: string[] }> = {
  register: { current: 0, steps: WIZARD_STEPS.slice(0, 3) },
  'merchant-cr': { current: 1, steps: WIZARD_STEPS },
  'merchant-fl': { current: 1, steps: WIZARD_STEPS },
  'business-cr': { current: 2, steps: WIZARD_STEPS },
  'business-fl': { current: 2, steps: WIZARD_STEPS },
  summary: { current: 2, steps: WIZARD_STEPS },
  contract: { current: 3, steps: WIZARD_STEPS },
  'contract-signed': { current: 3, steps: WIZARD_STEPS }
};

// Madfu keeps the primary button disabled until the visible form is valid (Generate OTP, Sign Up,
// Continue). Errors still appear on blur.
const DISABLED_UNTIL_VALID = new Set(['lead', 'register', 'merchant-cr', 'merchant-fl', 'business-cr', 'business-fl']);
const EXTRA_GATE: Record<string, (v: Values) => boolean> = { register: passwordOk, 'business-cr': ibanVerified };
for (const s of screens) {
  if (!DISABLED_UNTIL_VALID.has(s.id)) continue;
  const primary = s.actions.find((a) => a.variant === 'primary');
  if (!primary) continue;
  const extra = EXTRA_GATE[s.id] ?? (() => true);
  primary.enabledWhen = (v) => Object.keys(validateScreen(s, v, REQUIRED)).length === 0 && extra(v);
}

// ---------------------------------------------------------------------------------------------
// Presets (synthetic values only; identifier-shaped values are assembled at runtime)
// ---------------------------------------------------------------------------------------------
const LEAD_CR: Values = {
  businessType: 'cr', unifiedNumber: DEMO_UNIFIED, salesChannels: ['instore', 'online'], annualRevenue: 'lt20',
  link: DEMO_LINK, name: DEMO_PERSON_LEAD, phone: DEMO_MOBILE
};
const LEAD_FL: Values = {
  businessType: 'fl', flNumber: DEMO_FL, salesChannels: ['instore'], annualRevenue: 'lt20', name: DEMO_PERSON_LEAD, phone: DEMO_MOBILE
};
const ACCOUNT: Values = { email: DEMO_EMAIL, signinEmail: DEMO_EMAIL, contactPhoneMasked: maskMobile(DEMO_MOBILE) };
const crMerchantDone = (): Values => ({ ownerChoice: 'owner-1', fullName: DEMO_PERSON, idNumber: demoNationalId(), contactEmail: DEMO_EMAIL, ownerMatch: true });
const crBusinessDone = (): Values => {
  const iban = demoIban();
  const b = verifiedBankFor(iban, 'anb');
  return {
    taxDoc: 'sample-tax-doc.pdf', bank: 'anb', iban, ibanVerifiedFor: iban,
    verifiedBankName: b.verifiedName, verifiedSwift: b.swift, bankBeneficiary: DEMO_BANK_BENEFICIARY
  };
};
const CR_DONE = (): Values => ({ ...LEAD_CR, ...ACCOUNT, ...crMerchantDone(), ...crBusinessDone() });
const MERCHANT_FL: Values = {
  nationalAddressDoc: 'sample-national-address.pdf', idDoc: 'sample-id-doc.pdf', flCertDoc: 'sample-fl-cert-doc.pdf',
  fullName: DEMO_PERSON, contactEmail: DEMO_EMAIL
};
const BUSINESS_FL = (): Values => ({
  taxDoc: 'sample-tax-doc.pdf', bank: 'alinma', iban: demoIban(), beneficiaryName: DEMO_PERSON, ibanCertDoc: 'sample-iban-cert-doc.pdf'
});

const presets: Preset[] = [
  { id: 'cr-lead', group: 'Entry', label: 'Registered Business lead form', description: 'Empty lead form, Registered Business (the default).', screen: 'lead', values: { businessType: 'cr' } },
  { id: 'fl-lead', group: 'Entry', label: 'Freelancer lead form', description: 'Empty lead form with Freelancer selected (FL - mask).', screen: 'lead', values: { businessType: 'fl' } },
  {
    id: 'existing', group: 'Entry', label: 'Existing account', description: 'Lead form filled with an identity that already owns an account. Press Generate OTP.',
    screen: 'lead', values: { ...LEAD_CR, unifiedNumber: DEMO_EXISTING_UNIFIED }
  },
  {
    id: 'in-progress', group: 'Entry', label: 'In-progress lead (Sales)', description: 'Lead form filled with a CR that already has an in-progress lead. Press Generate OTP.',
    screen: 'lead', values: { ...LEAD_CR, unifiedNumber: DEMO_IN_PROGRESS_UNIFIED }
  },
  {
    id: 'gt20', group: 'Entry', label: 'Above SAR 20 Million', description: 'SMS OTP for a lead above SAR 20M. Enter any 4 digits and Submit: Relationship Manager outcome (inferred).',
    screen: 'lead-otp', values: { ...LEAD_CR, annualRevenue: 'gt20' }
  },
  { id: 'offer-declined', group: 'Entry', label: 'Offer declined', description: 'Rejection Reasons dialog after No Thanks -> Yes.', screen: 'offer-reasons', values: { ...LEAD_CR } },
  {
    id: 'cr-merchant', group: 'Registered Business', label: 'CR Merchant Information (owner list)', description: 'Wathq-verified CR card and the mandatory owner selection.',
    screen: 'merchant-cr', values: { ...LEAD_CR, ...ACCOUNT }
  },
  {
    id: 'cr-business', group: 'Registered Business', label: 'CR Business Information', description: 'Proof of sales, bank, IBAN (verified server-side), VAT.',
    screen: 'business-cr', values: { ...LEAD_CR, ...ACCOUNT, ...crMerchantDone() }
  },
  {
    id: 'cr-summary', group: 'Registered Business', label: 'CR Summary -> contract', description: 'Summary with Previous only; Proceed To Contract Sign-Off opens the Signit contract.',
    screen: 'summary', values: { ...CR_DONE(), contractOutcome: 'created' }
  },
  {
    id: 'cr-contract-failed', group: 'Registered Business', label: 'CR contract could not be created', description: 'First contract attempt timed out; Submit Request fails; reload + retry recovers.',
    screen: 'contract-failed', values: { ...CR_DONE(), contractOutcome: 'fail' }
  },
  {
    id: 'cr-signed', group: 'Registered Business', label: 'Contract signed -> Submit Request', description: 'Signed contract; the separate Submit Request leads to the survey.',
    screen: 'contract-signed', values: { ...CR_DONE(), contractSigned: true }
  },
  {
    id: 'fl-merchant', group: 'Freelancer', label: 'FL Merchant Information', description: 'Three PDF uploads, identity and Delegation toggle.',
    screen: 'merchant-fl', values: { ...LEAD_FL, ...ACCOUNT }
  },
  {
    id: 'fl-business', group: 'Freelancer', label: 'FL Business Information', description: 'Manual bank details: Beneficiary Name, Swift Code and IBAN Certificate.',
    screen: 'business-fl', values: { ...LEAD_FL, ...ACCOUNT, ...MERCHANT_FL, idNumber: demoNationalId() }
  },
  {
    id: 'fl-submitted', group: 'Freelancer', label: 'FL submitted', description: '"Submitted successfully!" after skipping the survey; no contract.',
    screen: 'submitted', values: { ...LEAD_FL, ...ACCOUNT, ...MERCHANT_FL, ...BUSINESS_FL(), idNumber: demoNationalId(), surveySkipped: true }
  }
];

const initialValues: Values = {
  businessType: 'cr',
  salesChannels: [],
  contractOutcome: 'created'
};

export const madfuCurrentExperience: ExperienceDef = {
  id: 'madfu-current',
  name: 'Madfu Current',
  kind: 'Current Experience',
  themeClass: 'theme-madfu-current',
  header: (ctx) => <MadfuHeader stepper={STEPPER[ctx.screen.id]} />,
  stages: [
    { id: 'lead', label: 'Lead form' },
    { id: 'otp', label: 'Phone OTP' },
    { id: 'offer', label: 'Offer' },
    { id: 'account', label: 'Create Account' },
    { id: 'merchant', label: 'Merchant Information' },
    { id: 'business', label: 'Business Information' },
    { id: 'review', label: 'Summary' },
    { id: 'contract', label: 'Contract Sign-off (CR)' },
    { id: 'submit', label: 'Submitted' }
  ],
  screens,
  start: 'lead',
  initialValues,
  presets,
  requiredMessage: REQUIRED,
  reachNote:
    'Registered Business walked on Madfu TEST from sign-in to a signed Signit contract, a separate Submit Request and "Submitted successfully!" (2026-10-13, single-use QA account with one Wathq owner). Freelancer walked on TEST to "Submitted successfully!" (2026-10-12). The lead form, offer and account screens were walked on TEST and in production; the CR applicant\'s own SMS OTP, offer and account screens were not captured (same screens). Above SAR 20 Million was walked to the SMS OTP (2026-10-14); the Relationship Manager outcome after the code is from shipped copy (INFERRED). Not observed: several Wathq owners or a non-owner applicant, what Previous on the Summary does to saved data, and the review outcome, approval and activation after submission. All values are synthetic; research screenshots are never published.'
};
