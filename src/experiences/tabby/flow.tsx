import { TabbyMark } from '@/lab/BrandMarks';
import type { Block, ExperienceDef, Preset, Values } from '@/engine/types';
import {
  CodeLinks,
  IbanLookup,
  LabNote,
  LookupArchitecture,
  StoreMap,
  TurnstileCheck,
  UnifiedDemoValues,
  UnifiedLookupData,
  UnifiedNumberLookup
} from './components';
import {
  AUTHORITY_TEXT,
  CATEGORY_OPTIONS,
  CHANNEL_OPTIONS,
  DEMO_UN_VALID,
  D_HD,
  D_LOOKUP,
  D_WALK,
  LICENCE_OPTIONS,
  LOCATION_OPTIONS,
  MSG_409,
  MSG_NATIONAL_ID,
  MSG_UN_INVALID,
  MSG_UN_NOT_7,
  MSG_VAT,
  MSG_WEBSITE,
  PHONE_CODES,
  STORE_AND_LEGAL_RESET,
  categoryLabel,
  channels,
  demoFreeEmail,
  demoIban,
  demoMobile,
  demoNationalId,
  isCR,
  isEmail,
  isFL,
  isFreeEmail,
  isHighRevenueFL,
  isSaIban,
  isSalesLed,
  isWebsite,
  licenceLabel,
  lookupIban,
  lookupUnifiedNumber,
  maskIban,
  maskPhone,
  ref,
  revenueLabel,
  revenueOptions,
  sellsInStore,
  sellsOnline,
  shot,
  subCategoryLabel,
  subCategoryOptions,
  unLookupInvalid,
  unLookupValid,
  unValue
} from './data';

/**
 * Tabby KSA merchant onboarding as captured in production:
 *  2026-10-07  Commercial licence (< SAR 5m) to review, Submit refused 409; Freelancer submitted, in review.
 *  2026-10-08  new Commercial licence applicant to the Unified Number lookup (errors, expired registration).
 *  2026-10-14  HD re-capture sign-up -> review with SAR 5m-20m (not submitted); the >= SAR 20m short
 *              application for SAR 20m-100m and Above SAR 100m, submitted to "We'll reach out to continue".
 * Code-only facts are INFERRED, help-centre facts DOCUMENTED. Every value in this Lab is synthetic.
 */

// ---------------------------------------------------------------- shared evidence
const E_LOG = ref('TAB-EVID-000107', 'network', 'OBSERVED', 'Sign-up and application network/screen log with verbatim screen copy (redacted).', D_WALK);
const E_LOG2 = ref('TAB-EVID-000131', 'network', 'OBSERVED', 'Freelancer route to submission: network and screen log (redacted).', D_WALK);
const E_CODE = ref('TAB-EVID-000106', 'code', 'INFERRED', 'Step function by country / tier / licence, revenue tiers, free-email rule, store-type rules and submit conflicts read from the shipped bundle.', D_WALK);
const E_LOOKUP_CODE = ref('TAB-EVID-000159', 'code', 'INFERRED', 'Wizard bundle extract: licence-unified-number endpoint, response mapping, legal-details-sau form logic and provider-string scan.', D_LOOKUP);
const E_LOOKUP_SCHEMA = ref('TAB-EVID-000160', 'network', 'OBSERVED', 'Observed request/response schema of the Unified Number lookup (29 fields), headers and timings.', D_LOOKUP);
const E_HELP = ref('TAB-EVID-000101', 'help-centre', 'DOCUMENTED', 'Help-centre extract: how to apply and what happens after applying (about 2 working days, contract, dashboard).', D_WALK);
const J_FULL = ref('TAB-JOURNEY-000007', 'journey', 'OBSERVED', 'Real applicant, < SAR 5m: Commercial licence to review (409), Freelancer submitted.', D_WALK);
const J_HIGH = ref('TAB-JOURNEY-000009', 'journey', 'OBSERVED', 'Commercial licence >= SAR 20m: basics (SAR 20m-100m, then Above SAR 100m) -> licence -> category -> store type with Submit -> submitted.', D_HD);
const J_MID = ref('TAB-JOURNEY-000010', 'journey', 'OBSERVED', 'Commercial licence SAR 5m-20m: sign-up to review in HD; not submitted.', D_HD);
const R_ROUTE = ref('TAB-RULE-000080', 'rule', 'OBSERVED', 'Commercial licence + SAR 20m-100m or Above SAR 100m: store type shows Submit and the application ends; "We\'ll reach out to continue". Less than SAR 5m / SAR 5m-20m: Continue -> legal -> bank -> review. Supersedes the code-only TAB-RULE-000042.', D_HD);

// ---------------------------------------------------------------- summaries (review + submitted)
const basicRows = (v: Values): Array<[string, string]> => [
  ['First name', String(v.firstName ?? '')],
  ['Last name', String(v.lastName ?? '')],
  ['Email', String(v.email ?? '')],
  ['Phone', maskPhone(v)],
  ['Business name', String(v.businessName ?? '')],
  ['Country of business registration', 'Saudi Arabia'],
  ['Annual sales revenue', revenueLabel(v)]
];
const storeRows = (v: Values): Array<[string, string]> => {
  const rows: Array<[string, string]> = [
    ['Category', categoryLabel(v)],
    ['Sub-category', subCategoryLabel(v)],
    ['Store type', isFL(v) ? 'Online' : CHANNEL_OPTIONS.filter((o) => channels(v).includes(o.value)).map((o) => o.label).join(', ')]
  ];
  if (sellsOnline(v)) rows.push(['Website or social media', String(v.website ?? '')]);
  if (sellsInStore(v)) {
    rows.push(['Number of in-store locations', LOCATION_OPTIONS.find((o) => o.value === v.locations)?.label ?? '']);
    if (v.locations === '1') rows.push(['Address', String(v.storeAddress ?? '')]);
  }
  return rows;
};
const legalRowsCR = (v: Values): Array<[string, string]> => {
  const rows: Array<[string, string]> = [
    ['Business licence', licenceLabel(v)],
    ['Unified number', unValue(v)],
    ['Legal name of business', String(v.legalCompanyName ?? '')],
    ['Legal address', String(v.legalAddress ?? '')],
    ['Reclaim your VAT', v.vatOn ? 'Yes' : 'No']
  ];
  if (v.vatOn) {
    rows.push(['VAT registration number', String(v.vatNumber ?? '')]);
    rows.push(['VAT certificate', String(v.vatCertificate ?? '')]);
  }
  return rows;
};
const legalRowsFL = (v: Values): Array<[string, string]> => [
  ['Business licence', licenceLabel(v)],
  ['Freelance certificate number', v.flNumber ? `FL-${String(v.flNumber)}` : ''],
  ['National ID', String(v.nationalIdPhoto ?? '')],
  ['National ID number', v.nationalIdNumber ? `••••••${String(v.nationalIdNumber).slice(-4)}` : ''],
  ['Proof of national address', String(v.addressProof ?? '')],
  ['National address', String(v.nationalAddress ?? '')]
];
const bankRows = (v: Values): Array<[string, string]> => {
  const rows: Array<[string, string]> = [
    ['IBAN', maskIban(v.iban)],
    ['Bank name', String(v.bankName ?? '')],
    ['SWIFT', String(v.swiftCode ?? '')],
    ['Beneficiary name', String(v.beneficiary ?? '')]
  ];
  if (isFL(v)) rows.push(['English IBAN certificate', String(v.ibanCertificate ?? '')]);
  return rows;
};

const summaryBlocks = (editable: boolean): Block[] => [
  { type: 'summary', title: 'Basic details', rows: basicRows, editTo: editable ? 'basic-info' : undefined },
  { type: 'summary', title: 'Product and store', rows: storeRows, editTo: editable ? 'product-category' : undefined },
  { type: 'summary', title: 'Legal', rows: legalRowsCR, editTo: editable ? 'legal-details-sau' : undefined, when: isCR },
  { type: 'summary', title: 'Legal', rows: legalRowsFL, editTo: editable ? 'legal-details-sau-freelance' : undefined, when: isFL },
  { type: 'summary', title: 'Bank information', rows: bankRows, editTo: editable ? 'bank-details' : undefined }
];

// ---------------------------------------------------------------- presets (all values synthetic)
const DEMO_EMAIL = 'noura.ops@example.com';
const BASE: Values = {
  region: 'SAU',
  email: DEMO_EMAIL,
  turnstileFor: DEMO_EMAIL,
  emailCode: '',
  phoneCc: '+966',
  firstName: 'Noura',
  lastName: 'Al-Harbi',
  businessName: 'Rimal Home',
  annualVolume: 'less_than_1m',
  category: 'other',
  subCategory: 'other:Services'
};
const crStore: Values = { licence: 'cr', savedLicence: 'cr', channels: ['online'], website: 'https://rimal-home.example.com' };
const crLegalDone: Values = {
  unifiedNumber: DEMO_UN_VALID,
  unChecked: DEMO_UN_VALID,
  unValid: true,
  unAddressReturned: true,
  legalCompanyName: lookupUnifiedNumber(DEMO_UN_VALID).legal_company_name,
  legalAddress: lookupUnifiedNumber(DEMO_UN_VALID).legal_address,
  vatOn: false
};
const bankDone = (beneficiary: string): Values => {
  const iban = demoIban();
  return { iban, ibanChecked: iban, ...lookupIban(iban), beneficiary };
};
const FL_EMAIL = 'faisal.studio@example.com';
const flBase: Values = {
  ...BASE,
  phone: demoMobile(),
  email: FL_EMAIL,
  turnstileFor: FL_EMAIL,
  firstName: 'Faisal',
  lastName: 'Al-Qahtani',
  businessName: 'Faisal Design Studio',
  licence: 'fl',
  savedLicence: 'fl',
  category: 'other',
  subCategory: 'other:Services',
  website: 'https://studio.example.com'
};
const HIGH_EMAIL = 'ops@big-retail.example.com';
const crHigh = (annualVolume: string): Values => ({
  ...BASE,
  phone: demoMobile(),
  email: HIGH_EMAIL,
  turnstileFor: HIGH_EMAIL,
  businessName: 'Big Retail Demo',
  annualVolume,
  ...crStore,
  website: 'https://big-retail.example.com'
});

const presets: Preset[] = [
  {
    id: 'cr-legal',
    label: 'Commercial licence, < SAR 5m, at legal details',
    group: 'Commercial licence below SAR 20m',
    description: 'Unified Number lookup with the demo values. OBSERVED (2026-10-07/08, HD 2026-10-14).',
    values: { ...BASE, phone: demoMobile(), ...crStore },
    screen: 'legal-details-sau'
  },
  {
    id: 'cr-5-20m',
    label: 'Commercial licence, SAR 5m-20m, at store type',
    group: 'Commercial licence below SAR 20m',
    description: '"Where do you sell?" with Continue: the full form follows. OBSERVED 2026-10-14.',
    values: { ...BASE, phone: demoMobile(), annualVolume: 'from_1m_to_5m', ...crStore },
    screen: 'store-type'
  },
  {
    id: 'cr-review-409',
    label: 'Commercial licence at review (duplicate 409 demo)',
    group: 'Commercial licence below SAR 20m',
    description: 'Ready to submit; the Lab duplicate switch is on, so Submit returns 409. OBSERVED on the CR route (2026-10-07).',
    values: {
      ...BASE,
      phone: demoMobile(),
      ...crStore,
      ...crLegalDone,
      ...bankDone('Rimal Home Supplies Co.'),
      payoutEmail: DEMO_EMAIL,
      labDuplicate: true
    },
    screen: 'result'
  },
  {
    id: 'cr-20-100m',
    label: 'Commercial licence, SAR 20m-100m, sales-led (store type)',
    group: 'Commercial licence SAR 20m and above',
    description: 'Store type shows Submit; the application ends there. OBSERVED 2026-10-14.',
    values: crHigh('from_5m_to_15m'),
    screen: 'store-type'
  },
  {
    id: 'cr-100m-plus',
    label: 'Commercial licence, Above SAR 100m, sales-led (store type)',
    group: 'Commercial licence SAR 20m and above',
    description: 'Store type shows Submit, then "We\'ll reach out to continue". OBSERVED 2026-10-14.',
    values: crHigh('above_15m'),
    screen: 'store-type'
  },
  {
    id: 'fl-legal',
    label: 'Freelancer at legal details (documents)',
    group: 'Freelancer',
    description: 'FL number (no lookup), National ID photo + number, proof of national address. OBSERVED 2026-10-07.',
    values: flBase,
    screen: 'legal-details-sau-freelance'
  },
  {
    id: 'fl-submitted',
    label: 'Freelancer submitted (in review)',
    group: 'Freelancer',
    description: '"We\'re reviewing your application", around two business days. OBSERVED 2026-10-07.',
    values: {
      ...flBase,
      flNumber: '400100200',
      nationalIdPhoto: 'national_id.pdf',
      nationalIdNumber: demoNationalId(),
      addressProof: 'proof_of_national_address_certificate.pdf',
      nationalAddress: 'Unit 4, Prince Sultan Road, Jeddah (fictional)',
      ...bankDone('Faisal Al-Qahtani'),
      ibanCertificate: 'iban_certificate_url.pdf',
      confirmAuthority: true
    },
    screen: 'submitted'
  },
  {
    id: 'free-email',
    label: 'Free-email account: revenue options',
    group: 'Revenue',
    description: 'Free e-mail domain sees only "Less than SAR 5m" / "Above SAR 5m". INFERRED from shipped code.',
    values: { ...BASE, phone: demoMobile(), email: demoFreeEmail(), turnstileFor: demoFreeEmail(), annualVolume: '' },
    screen: 'basic-info'
  }
];

// ---------------------------------------------------------------- experience
export const tabbyExperience: ExperienceDef = {
  id: 'tabby',
  name: 'Tabby',
  kind: 'Benchmark Experience',
  themeClass: 'theme-tabby',
  header: () => (
    <div className="tb-header">
      <TabbyMark size={24} />
      <span className="tb-header-region">Saudi Arabia</span>
    </div>
  ),
  stages: [
    { id: 'account', label: 'Account' },
    { id: 'basics', label: 'Basics' },
    { id: 'licence', label: 'Licence' },
    { id: 'category', label: 'Category' },
    { id: 'store', label: 'Store' },
    { id: 'legal', label: 'Legal' },
    { id: 'bank', label: 'Bank' },
    { id: 'review', label: 'Review' }
  ],
  start: 'region',
  initialValues: { region: 'SAU', phoneCc: '+966', channels: [], vatOn: false, confirmAuthority: false },
  presets,
  reachNote:
    'Walked live in production with authorised data. 2026-10-07: the Commercial licence route (Less than SAR 5m) to review, where Submit was refused with 409 (legal and bank details already in use), and the Freelancer route, submitted and in review. 2026-10-08: a new Commercial licence applicant to the Unified Number lookup (format error, test value, expired registration). 2026-10-14: an HD re-capture from sign-up to review with SAR 5m-20m (not submitted), and the SAR 20m-and-above short application for both SAR 20m-100m and Above SAR 100m: store type shows Submit and ends at "We\'ll reach out to continue". A successful Commercial licence submission was never observed: its "We\'re reviewing your application" screen is the Freelancer capture, shown here as INFERRED. Read from shipped code only (INFERRED): the free-email revenue bands, the Freelancer route above SAR 5m, the hidden storage of owner data and the lookup messages for valid but inactive or expiring licences. DOCUMENTED (help centre): approval, contract and dashboard. UNKNOWN: the registry provider behind Tabby\'s backend, the review outcome and what Sales does after the SAR 20m-and-above submit. Screenshots stay private; the Evidence drawer lists record IDs only. All values in this Lab are synthetic.',
  screens: [
    // ------------------------------------------------------------ account
    {
      id: 'region',
      stage: 'account',
      title: 'Choose your region',
      subtitle: "If you use both, you'll need to sign in to each one separately.",
      status: 'OBSERVED',
      statusNote: 'Captured 2026-10-07 on merchant.tabby.ai, reached from tabby.ai Business. Saudi Arabia routes to the KSA sign-in.',
      variant: 'modal',
      noBack: true,
      evidence: [
        ref('TAB-STATE-000026', 'state', 'OBSERVED', '"Choose your region": Saudi Arabia / UAE / Kuwait; each region is a separate sign-in.', D_WALK),
        ref('TAB-PAGE-000027', 'record', 'OBSERVED', 'Global entry merchant.tabby.ai; Saudi Arabia routes to the KSA sign-up and log-in form.', D_WALK),
        shot('TAB-EVID-000098', '"Choose your region" dialog.', D_WALK),
        ref('TAB-EVID-000100', 'aria-snapshot', 'OBSERVED', 'Transcribed field inventory of the auth page and region dialog.', D_WALK)
      ],
      blocks: [
        {
          type: 'field',
          field: {
            name: 'region',
            label: 'Region',
            kind: 'radio-cards',
            required: true,
            options: [
              { value: 'SAU', label: 'Saudi Arabia' },
              { value: 'ARE', label: 'United Arab Emirates', description: 'Not represented in this Lab', disabled: true },
              { value: 'KWT', label: 'Kuwait', description: 'Not represented in this Lab', disabled: true }
            ]
          }
        }
      ],
      actions: [{ label: 'Continue', variant: 'primary', to: 'sign-in' }]
    },
    {
      id: 'sign-in',
      stage: 'account',
      title: 'Sign up or log in',
      status: 'OBSERVED',
      statusNote:
        "Turnstile auto-passed in the user's real browser (2026-10-07, HD 2026-10-14); an automated browser profile was refused (TAB-STATE-000025). The check is simulated here.",
      evidence: [
        ref('TAB-RULE-000040', 'rule', 'OBSERVED', 'Turnstile appears once the email is typed -> 6-digit email code -> mandatory phone link -> 4-digit SMS code. Implicit consent.', D_WALK),
        ref('TAB-STATE-000027', 'state', 'OBSERVED', 'Email entered: Cloudflare Turnstile "Success!" without interaction; Continue enabled.', D_WALK),
        ref('TAB-STATE-000025', 'state', 'OBSERVED', 'Human verification gate: Continue disabled until the check passes.', D_WALK),
        shot('TAB-EVID-000179', 'HD: email entered, Turnstile auto-passed.', D_HD),
        shot('TAB-EVID-000180', 'HD: email entered, Turnstile auto-passed (second frame).', D_HD),
        shot('TAB-EVID-000102', 'KSA "Sign up or log in", By email.', D_WALK),
        shot('TAB-EVID-000103', 'Valid email entered: "Verify you are human" appears; Continue disabled until verified.', D_WALK),
        shot('TAB-EVID-000104', 'KSA By phone: +966 default, 9-digit mask, Turnstile.', D_WALK),
        ref('TAB-EVID-000105', 'aria-snapshot', 'OBSERVED', 'Transcribed KSA sign-up form fields, toggle and Turnstile.', D_WALK)
      ],
      blocks: [
        { type: 'field', field: { name: 'email', label: 'Email', kind: 'email', placeholder: 'name@example.com', required: true } },
        { type: 'custom', render: (ctx) => <TurnstileCheck ctx={ctx} /> },
        {
          type: 'custom',
          render: () => (
            <LabNote status="OBSERVED">
              A "By phone" option (+966, 9 digits) also exists on this screen. The Lab follows the email route that was walked.
            </LabNote>
          )
        }
      ],
      actions: [
        {
          label: 'Continue',
          variant: 'primary',
          enabledWhen: (v) => isEmail(String(v.email ?? '')) && v.turnstileFor === String(v.email ?? '').trim(),
          loading: { ms: 700, label: 'Sending code' },
          set: () => ({ emailCode: '' }),
          to: 'email-code'
        }
      ]
    },
    {
      id: 'email-code',
      stage: 'account',
      title: 'Enter the verification code',
      subtitle: (v) => `We sent a 6-digit code to ${String(v.email ?? '')}. This code will be valid for 2 minutes.`,
      status: 'OBSERVED',
      statusNote: 'Re-captured in HD 2026-10-14: 6 digits, valid 2 minutes, Change email, resend countdown, implied consent line.',
      evidence: [
        ref('TAB-STATE-000068', 'state', 'OBSERVED', '"Enter the verification code": 6-digit email code valid 2 minutes; Change email; Resend code countdown; terms and privacy line.', D_HD),
        ref('TAB-RULE-000082', 'rule', 'OBSERVED', '6-digit email code (2 min) then mandatory phone link with a 4-digit SMS code (2 min); consent implied by continuing.', D_HD),
        shot('TAB-EVID-000171', 'HD: email verification code screen.', D_HD),
        ref('TAB-NET-000001', 'network', 'OBSERVED', 'POST auth/authenticate 200: 6-digit email code sent.', D_WALK),
        ref('TAB-NET-000002', 'network', 'OBSERVED', 'POST auth/verify 200 after the applicant typed the code.', D_WALK),
        E_LOG
      ],
      blocks: [
        { type: 'field', field: { name: 'emailCode', label: 'Code', kind: 'otp', length: 6, hint: 'Prototype: any 6 digits are accepted.' } },
        { type: 'custom', render: (ctx) => <CodeLinks ctx={ctx} changeLabel="Change email" /> },
        { type: 'text', muted: true, text: 'By continuing, you agree to our terms of service and privacy policy' }
      ],
      actions: [
        {
          label: 'Continue',
          variant: 'primary',
          enabledWhen: (v) => String(v.emailCode ?? '').length === 6,
          loading: { ms: 600, label: 'Verifying' },
          to: 'link-phone'
        }
      ]
    },
    {
      id: 'link-phone',
      stage: 'account',
      title: 'Link phone number to your account',
      subtitle: "We'll send a verification code to this phone number",
      status: 'OBSERVED',
      statusNote: 'Mandatory: there is no skip. Seven country codes are offered.',
      evidence: [
        ref('TAB-STATE-000028', 'state', 'OBSERVED', 'Mandatory phone link; 7 country codes.', D_WALK),
        shot('TAB-EVID-000181', 'HD: Link phone number to your account.', D_HD),
        shot('TAB-EVID-000109', 'Link phone number to your account.', D_WALK),
        ref('TAB-NET-000003', 'network', 'OBSERVED', 'POST auth/challenge/setup 204: 4-digit SMS code sent.', D_WALK),
        E_LOG
      ],
      blocks: [
        { type: 'field', field: { name: 'phoneCc', label: 'Country code', kind: 'select', options: PHONE_CODES, width: 'half', required: true } },
        {
          type: 'field',
          field: { name: 'phone', label: 'Phone number', kind: 'tel', digitsOnly: true, maxLength: 10, placeholder: '5x xxx xxxx', width: 'half', required: true }
        }
      ],
      actions: [
        {
          label: 'Continue',
          variant: 'primary',
          enabledWhen: (v) => String(v.phone ?? '').length >= (v.phoneCc === '+966' ? 9 : 7),
          loading: { ms: 700, label: 'Sending code' },
          set: () => ({ smsCode: '' }),
          to: 'phone-code'
        }
      ]
    },
    {
      id: 'phone-code',
      stage: 'account',
      title: 'Enter the verification code',
      subtitle: (v) => `We sent a 4-digit code to ${maskPhone(v)}. This code will be valid for 2 minutes.`,
      status: 'OBSERVED',
      statusNote: 'Observed in the network/screen log; no screenshot of this screen is recorded.',
      evidence: [
        ref('TAB-RULE-000082', 'rule', 'OBSERVED', '4-digit SMS code valid 2 minutes after the phone link.', D_HD),
        ref('TAB-RULE-000040', 'rule', 'OBSERVED', 'Mandatory phone link with a 4-digit SMS code.', D_WALK),
        E_LOG
      ],
      blocks: [
        { type: 'field', field: { name: 'smsCode', label: 'Code', kind: 'otp', length: 4, hint: 'Prototype: any 4 digits are accepted.' } },
        { type: 'custom', render: (ctx) => <CodeLinks ctx={ctx} changeLabel="Change phone number" /> }
      ],
      actions: [
        {
          label: 'Continue',
          variant: 'primary',
          enabledWhen: (v) => String(v.smsCode ?? '').length === 4,
          loading: { ms: 600, label: 'Verifying' },
          to: 'no-account'
        }
      ]
    },
    {
      id: 'no-account',
      stage: 'account',
      title: 'No business account found in the KSA',
      status: 'OBSERVED',
      statusNote:
        'The applicant is now a verified personal Tabby user; the business application starts here. The country chosen at sign-in decides the legal market.',
      variant: 'center',
      evidence: [
        ref('TAB-STATE-000029', 'state', 'OBSERVED', 'Create a new KSA account / Switch to UAE & Kuwait.', D_WALK),
        ref('TAB-RULE-000041', 'rule', 'OBSERVED', 'A verified user without a KSA business sees this screen.', D_WALK),
        shot('TAB-EVID-000182', 'HD: No business account found in the KSA.', D_HD),
        shot('TAB-EVID-000110', 'No business account found in the KSA.', D_WALK),
        ref('TAB-NET-000004', 'network', 'OBSERVED', 'GET application 200 on Create a new KSA account.', D_WALK),
        E_LOG
      ],
      blocks: [
        {
          type: 'notice',
          tone: 'info',
          when: (v) => !!v.switchNote,
          text: 'Switching to UAE & Kuwait is outside this Lab. Only the KSA flow is represented.'
        }
      ],
      actions: [
        { label: 'Switch to UAE & Kuwait', variant: 'secondary', set: () => ({ switchNote: true }) },
        { label: 'Create a new KSA account', variant: 'primary', loading: { ms: 800, label: 'Creating application' }, to: 'basic-info' }
      ]
    },
    // ------------------------------------------------------------ basics
    {
      id: 'basic-info',
      stage: 'basics',
      title: "Let's start with the basics",
      subtitle: "We'd like to get to know you a bit",
      status: 'OBSERVED',
      statusNote:
        'Four revenue bands OBSERVED with a business email (2026-10-07, HD 2026-10-14). The band decides the route for a Commercial licence (TAB-RULE-000080). The two-band list for free e-mail domains is INFERRED from shipped code (TAB-RULE-000044).',
      evidence: [
        ref('TAB-STATE-000030', 'state', 'OBSERVED', 'First / last name, business name, annual sales revenue.', D_WALK),
        ref('TAB-STATE-000031', 'state', 'OBSERVED', 'Revenue options with a business email: 4 bands.', D_WALK),
        R_ROUTE,
        ref('TAB-RULE-000044', 'rule', 'INFERRED', 'Free e-mail provider -> only "Less than SAR 5m" / "Above SAR 5m"; can never declare SAR 20m or more.', D_WALK, 'client code'),
        shot('TAB-EVID-000183', 'HD: basic-info.', D_HD),
        shot('TAB-EVID-000185', 'HD: revenue options (business email, 4 bands).', D_HD),
        shot('TAB-EVID-000186', 'HD: revenue options (business email, 4 bands), second frame.', D_HD),
        shot('TAB-EVID-000111', "basic-info: Let's start with the basics.", D_WALK),
        shot('TAB-EVID-000112', 'basic-info: revenue options (business email, 4 bands).', D_WALK),
        ref('TAB-NET-000006', 'network', 'OBSERVED', 'POST check-merchant-group 200 on Continue (purpose inferred: merchant-group / duplicate check).', D_WALK),
        ref('TAB-NET-000005', 'network', 'OBSERVED', 'PUT application 200: draft autosave on each Continue.', D_WALK),
        E_CODE
      ],
      blocks: [
        { type: 'field', field: { name: 'firstName', label: 'First name', kind: 'text', required: true, width: 'half' } },
        { type: 'field', field: { name: 'lastName', label: 'Last name', kind: 'text', required: true, width: 'half' } },
        { type: 'field', field: { name: 'businessName', label: 'Business name', kind: 'text', required: true } },
        {
          type: 'field',
          field: {
            name: 'annualVolume',
            label: 'Annual sales revenue',
            kind: 'select',
            required: true,
            placeholder: 'Select',
            options: revenueOptions,
            validate: (val, v) => (revenueOptions(v).some((o) => o.value === val) ? null : 'Select an option')
          }
        },
        {
          type: 'custom',
          when: (v) => !isFreeEmail(v.email),
          render: () => (
            <LabNote status="OBSERVED" title="Revenue decides the route">
              With a Commercial licence, Less than SAR 5m and SAR 5m to SAR 20m continue to the full form. SAR 20m to SAR 100m
              and Above SAR 100m get a short application that ends at store type with Submit (TAB-RULE-000080).
            </LabNote>
          )
        },
        {
          type: 'custom',
          when: (v) => isFreeEmail(v.email),
          render: () => (
            <LabNote status="INFERRED" title="Free e-mail domain">
              Your account email is on a free provider, so only two bands are offered. Read from shipped code
              (TAB-RULE-000044); not observed on screen. Such applicants can never reach the SAR 20m-and-above route.
            </LabNote>
          )
        }
      ],
      actions: [{ label: 'Continue', variant: 'primary', loading: { ms: 700, label: 'Saving' }, to: 'business-licence-sau' }]
    },
    // ------------------------------------------------------------ licence
    {
      id: 'business-licence-sau',
      stage: 'licence',
      title: 'How is your business registered?',
      status: 'OBSERVED',
      statusNote:
        "The Freelance option's subtitle reuses the in-store copy in the live product (copy bug, kept as observed). Changing the licence resets store-type and legal data.",
      evidence: [
        ref('TAB-STATE-000032', 'state', 'OBSERVED', 'Commercial licence / Freelance or productive family certificate.', D_WALK),
        shot('TAB-EVID-000187', 'HD: business-licence-sau.', D_HD),
        shot('TAB-EVID-000188', 'HD: business-licence-sau, second frame.', D_HD),
        shot('TAB-EVID-000113', 'business-licence-sau.', D_WALK),
        ref('TAB-RULE-000053', 'rule', 'OBSERVED', 'Changing the licence type resets store-type and legal data; reload routes to the first incomplete step.', D_WALK),
        ref('TAB-RULE-000060', 'rule', 'OBSERVED', 'The licence choice alone is not saved (only with store-type); one switch was lost when the wizard re-initialised.', D_WALK),
        E_LOG
      ],
      blocks: [{ type: 'field', field: { name: 'licence', label: 'Business licence', kind: 'radio-cards', required: true, options: LICENCE_OPTIONS } }],
      actions: [
        {
          label: 'Continue',
          variant: 'primary',
          set: (v) => (v.savedLicence !== v.licence ? { ...STORE_AND_LEGAL_RESET, savedLicence: v.licence } : {}),
          to: 'product-category'
        }
      ]
    },
    // ------------------------------------------------------------ category
    {
      id: 'product-category',
      stage: 'category',
      title: 'What do you sell?',
      status: 'OBSERVED',
      statusNote:
        'Mandatory Category -> Sub-category (recorded as 7 / 40). Only 6 sub-category names are in tracked evidence; the rest are shown as unnamed placeholders. The per-category counts recorded in TAB-RULE-000045 add up to 37, not 40. No category is refused and the step list does not change; risk is decided in review.',
      evidence: [
        ref('TAB-STATE-000033', 'state', 'OBSERVED', 'Category -> dependent Sub-category (7 / 40).', D_WALK),
        ref('TAB-RULE-000045', 'rule', 'OBSERVED', 'Category mandatory; 7 categories / 40 sub-categories; no category refused; no step change.', D_WALK),
        ref('TAB-RULE-000056', 'rule', 'INFERRED', 'Review rejection codes include sells_risky_items, sells_blacklisted_items, regulatory_block.', D_WALK, 'client code'),
        shot('TAB-EVID-000189', 'HD: product-category.', D_HD),
        shot('TAB-EVID-000190', 'HD: product-category, second frame.', D_HD),
        shot('TAB-EVID-000191', 'HD: product-category, third frame.', D_HD),
        shot('TAB-EVID-000114', 'product-category: What do you sell?', D_WALK),
        ref('TAB-NET-000007', 'network', 'OBSERVED', 'GET sub-category list per section.', D_WALK),
        E_LOG
      ],
      blocks: [
        {
          type: 'field',
          field: { name: 'category', label: 'Category', kind: 'select', required: true, options: CATEGORY_OPTIONS }
        },
        {
          type: 'field',
          field: {
            name: 'subCategory',
            label: 'Sub-category',
            kind: 'select',
            required: true,
            when: (v) => !!v.category,
            options: (v) => subCategoryOptions(v.category),
            validate: (val, v) => (String(val).startsWith(`${String(v.category)}:`) ? null : 'Select an option'),
            status: 'UNKNOWN',
            statusNote: 'The field is OBSERVED; most sub-category names are not in tracked evidence.'
          }
        }
      ],
      actions: [{ label: 'Continue', variant: 'primary', loading: { ms: 500, label: 'Saving' }, to: 'store-type' }]
    },
    // ------------------------------------------------------------ store type
    {
      id: 'store-type',
      stage: 'store',
      title: 'Where do you sell?',
      status: 'OBSERVED',
      statusNote:
        'Commercial licence: Online, In-store and both OBSERVED (2026-10-07, Less than SAR 5m); SAR 5m-20m shows Continue (HD 2026-10-14). SAR 20m-100m and Above SAR 100m show Submit and the application ends here (OBSERVED 2026-10-14, TAB-RULE-000080; replaces the code-only TAB-RULE-000042). 1 vs 2 locations observed, 3 / More than 3 not individually. Freelancers see the website field only.',
      evidence: [
        R_ROUTE,
        ref('TAB-STATE-000069', 'state', 'OBSERVED', 'Commercial licence, SAR 20m-100m or Above SAR 100m: Submit instead of Continue; no legal, bank or review step follows.', D_HD),
        ref('TAB-STATE-000071', 'state', 'OBSERVED', 'Commercial licence, SAR 5m-20m: Continue; Online reveals "Website or social media"; leads to legal details.', D_HD),
        ref('TAB-RULE-000081', 'rule', 'OBSERVED', 'Switching a completed application back to SAR 20m-100m on review puts it on the short path: Submit at store type, legal / bank / review skipped.', D_HD),
        shot('TAB-EVID-000172', 'HD: store type with Submit (SAR 20m and above).', D_HD),
        shot('TAB-EVID-000173', 'HD: store type with Submit (SAR 20m and above), second frame.', D_HD),
        shot('TAB-EVID-000174', 'HD: store type with Submit (SAR 20m and above), third frame.', D_HD),
        shot('TAB-EVID-000175', 'HD: store type with Submit (SAR 20m and above), fourth frame.', D_HD),
        shot('TAB-EVID-000177', 'HD: store type with Continue (SAR 5m-20m).', D_HD),
        shot('TAB-EVID-000178', 'HD: store type with Continue (SAR 5m-20m), Online + website.', D_HD),
        J_HIGH,
        ref('TAB-STATE-000034', 'state', 'OBSERVED', 'Online + In-store: number of in-store locations + website or social media.', D_WALK),
        ref('TAB-STATE-000035', 'state', 'OBSERVED', 'Exactly 1 location: map search + Address appear.', D_WALK),
        ref('TAB-STATE-000036', 'state', 'OBSERVED', 'Address search not restricted to Saudi Arabia.', D_WALK),
        ref('TAB-STATE-000037', 'state', 'OBSERVED', 'Website must start with https://.', D_WALK),
        ref('TAB-STATE-000044', 'state', 'OBSERVED', 'Freelancer: Online / In-store selector removed; saved website wiped by the licence switch.', D_WALK),
        ref('TAB-RULE-000046', 'rule', 'OBSERVED', 'Online -> https:// link required. In-store -> 1 / 2 / 3 / More than 3; exactly 1 -> map pin + address. No platform question.', D_WALK),
        ref('TAB-RULE-000047', 'rule', 'OBSERVED', 'Freelance licence -> online only, no branch or location data.', D_WALK),
        ref('TAB-RULE-000048', 'rule', 'OBSERVED', 'Store-name search auto-selected an address outside Saudi Arabia.', D_WALK),
        ref('TAB-RULE-000043', 'rule', 'OBSERVED', 'Freelance licence: legal -> bank -> review at every revenue tier (route OBSERVED at Less than SAR 5m; tier-independence from code).', D_WALK),
        shot('TAB-EVID-000115', 'store-type (CR): Online + In-store.', D_WALK),
        shot('TAB-EVID-000116', 'store-type (CR): 1 location, map + address.', D_WALK),
        shot('TAB-EVID-000117', 'store-type: map search resolved outside Saudi Arabia.', D_WALK),
        shot('TAB-EVID-000118', 'store-type: website must start with https://.', D_WALK),
        shot('TAB-EVID-000125', 'store-type (Freelancer): website only.', D_WALK)
      ],
      blocks: [
        {
          type: 'field',
          field: { name: 'channels', label: 'Store type', kind: 'checkgroup', required: true, options: CHANNEL_OPTIONS, when: isCR }
        },
        {
          type: 'field',
          field: {
            name: 'website',
            label: 'Website or social media',
            kind: 'url',
            placeholder: 'https://',
            required: true,
            when: sellsOnline,
            validate: (val) => (isWebsite(String(val)) ? null : MSG_WEBSITE)
          }
        },
        {
          type: 'field',
          field: { name: 'locations', label: 'Number of in-store locations', kind: 'select', required: true, options: LOCATION_OPTIONS, when: sellsInStore }
        },
        { type: 'custom', when: (v) => sellsInStore(v) && v.locations === '1', render: (ctx) => <StoreMap ctx={ctx} /> },
        {
          type: 'field',
          field: {
            name: 'storeAddress',
            label: 'Address',
            kind: 'text',
            hint: 'Search address before editing',
            required: true,
            when: (v) => sellsInStore(v) && v.locations === '1'
          }
        },
        {
          type: 'custom',
          when: (v) => sellsInStore(v) && v.locations === '1',
          render: () => <LabNote status="OBSERVED">The live address search is not restricted to Saudi Arabia (TAB-RULE-000048).</LabNote>
        },
        {
          type: 'custom',
          when: (v) => sellsInStore(v) && !!v.locations && v.locations !== '1',
          render: () => <LabNote status="OBSERVED">With 2 or more locations no address is collected at application time.</LabNote>
        },
        {
          type: 'custom',
          when: isFL,
          render: () => (
            <LabNote status="OBSERVED" title="Freelancer">
              The Online / In-store choice is not shown: Freelancers are onboarded as online only, with no branch or location data
              (TAB-RULE-000047).
            </LabNote>
          )
        },
        {
          type: 'custom',
          when: isHighRevenueFL,
          render: () => (
            <LabNote status="INFERRED" title="Freelancer at SAR 20m or more">
              The Submit-at-store-type rule applies to a Commercial licence only. For a Freelancer the full form continues at every
              band according to the shipped step function; the Freelancer route was walked at Less than SAR 5m.
            </LabNote>
          )
        },
        {
          type: 'custom',
          when: isSalesLed,
          render: () => (
            <LabNote status="OBSERVED" title="Short application (SAR 20m and above)">
              The button reads Submit: this is the last step. No Unified Number lookup, bank details, review page or authority
              confirmation follow. Captured for both SAR 20m to SAR 100m and Above SAR 100m (TAB-STATE-000069). Switching a
              completed application back to this band also skips them (TAB-RULE-000081).
            </LabNote>
          )
        }
      ],
      actions: [
        { label: 'Submit', variant: 'primary', when: isSalesLed, loading: { ms: 1200, label: 'Submitting' }, to: 'reach-out' },
        {
          label: 'Continue',
          variant: 'primary',
          when: (v) => !isSalesLed(v),
          loading: { ms: 600, label: 'Saving' },
          to: (v) => (isFL(v) ? 'legal-details-sau-freelance' : 'legal-details-sau')
        }
      ]
    },
    {
      id: 'reach-out',
      stage: 'store',
      title: "We'll reach out to continue",
      subtitle:
        "We'd like to give your high-value business extra attention. We'll contact you by phone or email in the next 2 business days to continue your application.",
      status: 'OBSERVED',
      statusNote:
        'Captured 2026-10-14 after Submit at store type with Above SAR 100m. With SAR 20m-100m the Submit button was captured at store type and TAB-RULE-000080 records the same outcome; no difference between the two bands is in the evidence.',
      variant: 'center',
      terminal: true,
      hideProgress: true,
      evidence: [
        ref('TAB-STATE-000070', 'state', 'OBSERVED', '"We\'ll reach out to continue": high-value business, contact by phone or email within 2 business days.', D_HD),
        ref('TAB-PAGE-000030', 'record', 'OBSERVED', 'Application status page of the SAR 20m-and-above short application; no legal, bank or review step before it.', D_HD),
        shot('TAB-EVID-000176', 'HD: "We\'ll reach out to continue" after the Above SAR 100m submit.', D_HD),
        R_ROUTE,
        J_HIGH
      ],
      blocks: [
        {
          type: 'custom',
          render: () => (
            <LabNote status="OBSERVED" title="What this route collected">
              <ul className="tb-list">
                <li>Basic details, revenue band, licence, category and store type only.</li>
                <li>No Unified Number lookup, bank details, review page or authority confirmation.</li>
              </ul>
            </LabNote>
          )
        },
        {
          type: 'custom',
          render: () => (
            <LabNote status="UNKNOWN" title="Not in the evidence">
              How Sales follows up, what is collected afterwards and whether the contract differs were not observed.
            </LabNote>
          )
        }
      ],
      actions: []
    },
    // ------------------------------------------------------------ legal (CR)
    {
      id: 'legal-details-sau',
      stage: 'legal',
      title: 'Legal details',
      subtitle: 'We need this information to verify some details about your business',
      status: 'OBSERVED',
      statusNote:
        'Valid lookup rendered legal name and address read-only (2026-10-07, HD 2026-10-14). Lookup on blur, client format error, is_valid=false for a test value and for an expired registration OBSERVED 2026-10-08. Hidden storage of owners and licence data is from code (INFERRED). Registry provider UNKNOWN.',
      evidence: [
        ref('TAB-STATE-000038', 'state', 'OBSERVED', 'Empty: Unified number, editable Legal address, Reclaim your VAT.', D_WALK),
        ref('TAB-STATE-000039', 'state', 'OBSERVED', 'Registry lookup filled legal name and address read-only.', D_WALK),
        ref('TAB-STATE-000064', 'state', 'OBSERVED', 'Value not starting with 7: inline client error, no request.', D_LOOKUP),
        ref('TAB-STATE-000065', 'state', 'OBSERVED', 'Test value: 200 is_valid=false; generic error; Legal address hidden.', D_LOOKUP),
        ref('TAB-STATE-000066', 'state', 'OBSERVED', 'Expired / inactive registration: data returned with is_valid=false; generic error; every prefilled value cleared.', D_LOOKUP),
        ref('TAB-STATE-000040', 'state', 'OBSERVED', 'Reclaim your VAT ON: certificate upload, VAT number, address on certificate.', D_WALK),
        shot('TAB-EVID-000192', 'HD: legal-details-sau (CR), empty.', D_HD),
        shot('TAB-EVID-000194', 'HD: registry lookup filled legal name and address.', D_HD),
        shot('TAB-EVID-000193', 'HD: lookup returned not valid for a test value.', D_HD),
        shot('TAB-EVID-000195', 'HD: Reclaim your VAT ON.', D_HD),
        ref('TAB-RULE-000049', 'rule', 'OBSERVED', 'Commercial licence: only the Unified Number is typed; no owner ID, licence copy or ownership question.', D_WALK),
        ref('TAB-RULE-000071', 'rule', 'OBSERVED', "Blur with a value starting with 7 calls Tabby's own licence-unified-number endpoint (29-field response).", D_LOOKUP),
        ref('TAB-RULE-000072', 'rule', 'OBSERVED', 'Client: digits, leading 7, length >= 10; any value starting with 7 is still sent; unknown -> 200 is_valid=false.', D_LOOKUP),
        ref('TAB-RULE-000073', 'rule', 'OBSERVED', 'Expired / inactive -> is_valid=false -> generic error; specific messages only for is_valid=true.', D_LOOKUP),
        ref('TAB-RULE-000074', 'rule', 'OBSERVED', 'company_owners[] returned (roles, shareholder / signatory / UBO flags, national IDs); never displayed.', D_LOOKUP),
        ref('TAB-RULE-000075', 'rule', 'INFERRED', 'Valid lookup silently stores CR number, licence expiry, licence type and owners in legal_info.', D_LOOKUP, 'client code'),
        ref('TAB-RULE-000076', 'rule', 'OBSERVED', 'The typed Unified Number is autosaved to the draft even when invalid.', D_LOOKUP),
        ref('TAB-RULE-000077', 'rule', 'INFERRED', 'A valid lookup fires analytics events carrying the prefilled values.', D_LOOKUP, 'client code'),
        ref('TAB-RULE-000078', 'rule', 'OBSERVED', 'No registry provider identifiable from the browser (same-origin endpoint, Cloudflare + Envoy).', D_LOOKUP),
        ref('TAB-RULE-000079', 'rule', 'INFERRED', 'About 0.3 s for implausible values vs about 2.4 s for a real number: consistent with an upstream call.', D_LOOKUP, 'research notes'),
        ref('TAB-RULE-000050', 'rule', 'OBSERVED', 'Reclaim your VAT optional: certificate (JPG/PNG/PDF up to 10 MB) + VAT number + certificate address.', D_WALK),
        ref('TAB-NET-000059', 'network', 'OBSERVED', "GET licence-unified-number/{unifiedNumber} on Tabby's origin; no provider header.", D_LOOKUP),
        ref('TAB-NET-000060', 'network', 'OBSERVED', 'PUT application: draft legal_info has no provider / reference / verification-status field.', D_LOOKUP),
        E_LOOKUP_SCHEMA,
        E_LOOKUP_CODE,
        shot('TAB-EVID-000119', 'legal-details-sau (CR): empty.', D_WALK),
        shot('TAB-EVID-000120', 'Registry lookup filled legal name and address.', D_WALK),
        shot('TAB-EVID-000121', 'Reclaim your VAT ON.', D_WALK),
        shot('TAB-EVID-000161', 'Before lookup: empty Unified number, editable Legal address.', D_LOOKUP),
        shot('TAB-EVID-000162', 'Client error "Enter a unified number instead of a commercial registration number".', D_LOOKUP),
        shot('TAB-EVID-000163', '"Please enter valid unified number" after is_valid=false for a test value.', D_LOOKUP),
        shot('TAB-EVID-000164', 'Expired / inactive registration: generic error.', D_LOOKUP),
        ref('TAB-EVID-000165', 'aria-snapshot', 'OBSERVED', 'Normalised structured snapshot: before lookup.', D_LOOKUP),
        ref('TAB-EVID-000166', 'aria-snapshot', 'OBSERVED', 'Normalised structured snapshot: client-side format error.', D_LOOKUP),
        ref('TAB-EVID-000167', 'aria-snapshot', 'OBSERVED', 'Normalised structured snapshot: server not-valid for a test value.', D_LOOKUP),
        ref('TAB-EVID-000168', 'aria-snapshot', 'OBSERVED', 'Normalised structured snapshot: expired registration, data returned but hidden.', D_LOOKUP)
      ],
      blocks: [
        { type: 'custom', render: () => <UnifiedDemoValues /> },
        {
          type: 'field',
          field: {
            name: 'unifiedNumber',
            label: 'Unified number',
            kind: 'text',
            required: true,
            maxLength: 15,
            validate: (val, v) => {
              const s = String(val).trim();
              if (!s.startsWith('7')) return MSG_UN_NOT_7;
              if (v.unChecked === s && !v.unValid) return MSG_UN_INVALID;
              return null;
            }
          }
        },
        { type: 'custom', render: (ctx) => <UnifiedNumberLookup ctx={ctx} /> },
        {
          type: 'field',
          field: { name: 'legalCompanyName', label: 'Legal name of business', kind: 'text', readOnly: true, when: unLookupValid }
        },
        {
          type: 'field',
          field: {
            name: 'legalAddress',
            label: 'Legal address',
            kind: 'text',
            // Read-only when the valid response carried an address; editable otherwise; hidden after is_valid=false.
            readOnly: (v) => unLookupValid(v) && v.unAddressReturned === true,
            when: (v) => !unLookupInvalid(v)
          }
        },
        { type: 'custom', render: (ctx) => <UnifiedLookupData ctx={ctx} /> },
        { type: 'custom', render: () => <LookupArchitecture /> },
        {
          type: 'field',
          field: {
            name: 'vatOn',
            label: 'Reclaim your VAT',
            kind: 'toggle',
            hint: 'Easily reclaim the VAT you pay on Tabby charges by uploading your VAT registration certificate'
          }
        },
        {
          type: 'field',
          field: { name: 'vatCertificate', label: 'VAT registration certificate', kind: 'upload', accept: 'JPG, PNG, PDF up to 10 MB', required: true, when: (v) => !!v.vatOn }
        },
        {
          type: 'field',
          field: {
            name: 'vatNumber',
            label: 'VAT registration number',
            kind: 'text',
            digitsOnly: true,
            maxLength: 15,
            hint: MSG_VAT,
            required: true,
            when: (v) => !!v.vatOn,
            validate: (val) => (/^3\d{12}03$/.test(String(val)) ? null : MSG_VAT)
          }
        },
        {
          type: 'field',
          field: { name: 'vatAddress', label: 'Address on VAT registration certificate', kind: 'text', required: true, when: (v) => !!v.vatOn }
        }
      ],
      actions: [
        {
          label: 'Continue',
          variant: 'primary',
          enabledWhen: (v) => !v.unPending,
          loading: { ms: 600, label: 'Saving' },
          // TAB-RULE-000083: the payout-report email is pre-filled with the sign-in email.
          set: (v) => (v.payoutEmail ? {} : { payoutEmail: String(v.email ?? '') }),
          to: 'bank-details'
        }
      ]
    },
    // ------------------------------------------------------------ legal (Freelancer)
    {
      id: 'legal-details-sau-freelance',
      stage: 'legal',
      title: 'Legal details',
      subtitle: 'We need this information to verify some details about your business',
      status: 'OBSERVED',
      statusNote: 'Captured 2026-10-07. No lookup: the FL number is typed and saved. Uploads are renamed server-side. No VAT option on this step.',
      evidence: [
        ref('TAB-STATE-000045', 'state', 'OBSERVED', 'FL number, National ID photo + number, national address proof + text.', D_WALK),
        ref('TAB-STATE-000046', 'state', 'OBSERVED', 'Uploads complete; files renamed national_id.pdf / proof_of_national_address_certificate.pdf.', D_WALK),
        ref('TAB-RULE-000051', 'rule', 'OBSERVED', 'FL number (no lookup) + National ID photo + ID number ("starts with 1 or 2") + proof of national address + address text. No FL certificate upload.', D_WALK),
        ref('TAB-RULE-000043', 'rule', 'OBSERVED', 'Freelance licence: legal-details-sau-freelance -> bank-details -> result (route OBSERVED at Less than SAR 5m; tier-independence from code).', D_WALK),
        ref('TAB-NET-000010', 'network', 'OBSERVED', 'POST upload 200; files renamed server-side.', D_WALK),
        shot('TAB-EVID-000126', 'legal-details-sau-freelance: empty.', D_WALK),
        shot('TAB-EVID-000127', 'legal-details-sau-freelance: uploads complete.', D_WALK),
        E_LOG2
      ],
      blocks: [
        {
          type: 'field',
          field: { name: 'flNumber', label: 'Freelance certificate number', kind: 'text', prefix: 'FL-', digitsOnly: true, maxLength: 12, required: true, hint: 'You can find it at freelance.sa' }
        },
        {
          type: 'field',
          field: {
            name: 'nationalIdPhoto',
            label: 'National ID',
            kind: 'upload',
            accept: 'JPG, PNG, PDF up to 10 MB',
            required: true,
            hint: 'Upload a clear photo of the National ID of the freelance certificate holder'
          }
        },
        {
          type: 'field',
          field: {
            name: 'nationalIdNumber',
            label: 'National ID number',
            kind: 'text',
            digitsOnly: true,
            maxLength: 10,
            required: true,
            hint: MSG_NATIONAL_ID,
            validate: (val) => (/^[12]\d{9}$/.test(String(val)) ? null : MSG_NATIONAL_ID)
          }
        },
        {
          type: 'field',
          field: { name: 'addressProof', label: 'Proof of national address certificate', kind: 'upload', accept: 'JPG, PNG, PDF up to 10 MB', required: true, hint: 'You can find it at splonline.com.sa' }
        },
        { type: 'field', field: { name: 'nationalAddress', label: 'National address', kind: 'text', required: true } },
        {
          type: 'custom',
          render: () => (
            <LabNote status="OBSERVED">
              No registry check on the FL number: documents replace the lookup. There is no upload of the FL certificate itself.
            </LabNote>
          )
        }
      ],
      actions: [{ label: 'Continue', variant: 'primary', loading: { ms: 600, label: 'Saving' }, to: 'bank-details' }]
    },
    // ------------------------------------------------------------ bank
    {
      id: 'bank-details',
      stage: 'bank',
      title: 'Bank details',
      status: 'OBSERVED',
      statusNote:
        'IBAN lookup for everyone derives bank name and SWIFT (locked); clearing the IBAN keeps them (TAB-RULE-000057). Commercial licence re-captured in HD 2026-10-14: currency SAR and a payout-report email pre-filled with the sign-in email (TAB-RULE-000083; field labels not recorded verbatim, not recorded for the Freelancer step). Prototype validation: SA + 22 digits.',
      evidence: [
        ref('TAB-STATE-000041', 'state', 'OBSERVED', 'Commercial licence: business account only; no IBAN certificate.', D_WALK),
        ref('TAB-STATE-000042', 'state', 'OBSERVED', 'IBAN lookup filled bank name and SWIFT read-only.', D_WALK),
        ref('TAB-STATE-000043', 'state', 'OBSERVED', 'Derived bank name / SWIFT remain after the IBAN is cleared.', D_WALK),
        ref('TAB-STATE-000047', 'state', 'OBSERVED', 'Freelancer: personal account allowed; English IBAN certificate required.', D_WALK),
        ref('TAB-RULE-000083', 'rule', 'OBSERVED', 'CR bank: business account only, beneficiary on the commercial licence; IBAN fills bank name + SWIFT; beneficiary typed (English spelling must match the bank); currency SAR; payout-report email pre-filled.', D_HD),
        ref('TAB-RULE-000052', 'rule', 'OBSERVED', 'IBAN lookup for everyone; beneficiary typed, not compared with the registry name; FL certificate required.', D_WALK),
        ref('TAB-RULE-000057', 'rule', 'OBSERVED', 'Clearing the IBAN leaves the derived bank name and SWIFT displayed and saved.', D_WALK),
        ref('TAB-NET-000009', 'network', 'OBSERVED', 'GET iban/{IBAN} 200: bank name + SWIFT derived and locked.', D_WALK),
        shot('TAB-EVID-000196', 'HD: bank-details (CR), empty.', D_HD),
        shot('TAB-EVID-000197', 'HD: IBAN lookup filled bank name and SWIFT.', D_HD),
        shot('TAB-EVID-000122', 'bank-details (CR): empty.', D_WALK),
        shot('TAB-EVID-000123', 'IBAN lookup filled bank name and SWIFT.', D_WALK),
        shot('TAB-EVID-000124', 'Stale bank / SWIFT after the IBAN was cleared.', D_WALK),
        shot('TAB-EVID-000128', 'bank-details (Freelancer): English IBAN certificate required.', D_WALK),
        E_LOG
      ],
      blocks: [
        {
          type: 'notice',
          tone: 'info',
          when: isCR,
          text: 'The account must be your business bank account, not a personal one. The beneficiary of the account must be on the commercial licence.'
        },
        {
          type: 'notice',
          tone: 'info',
          when: isFL,
          text: "This must be the business bank account linked to your licence, or if you don't have one, your personal bank account. The beneficiary of the account must be on the licence."
        },
        {
          type: 'field',
          field: {
            name: 'iban',
            label: 'IBAN',
            kind: 'text',
            placeholder: 'SA',
            maxLength: 34,
            required: true,
            hint: 'Bank name and SWIFT are filled in from the IBAN.',
            validate: (val) => (isSaIban(val) ? null : 'Enter a valid IBAN')
          }
        },
        { type: 'custom', render: (ctx) => <IbanLookup ctx={ctx} /> },
        { type: 'field', field: { name: 'bankName', label: 'Bank name', kind: 'text', readOnly: true, width: 'half', when: (v) => !!v.bankName } },
        { type: 'field', field: { name: 'swiftCode', label: 'SWIFT', kind: 'text', readOnly: true, width: 'half', when: (v) => !!v.bankName } },
        { type: 'field', field: { name: 'beneficiary', label: 'Beneficiary name', kind: 'text', required: true } },
        {
          type: 'custom',
          when: isCR,
          render: () => (
            <div className="tb-static" aria-label="Currency">
              <span className="tb-static-label">Currency</span>
              <span className="tb-static-value">SAR</span>
            </div>
          )
        },
        {
          type: 'field',
          field: {
            name: 'payoutEmail',
            label: 'Payout report email',
            kind: 'email',
            when: isCR,
            hint: 'Pre-filled with your sign-in email.'
          }
        },
        {
          type: 'custom',
          render: (ctx) => (
            <LabNote status="OBSERVED">
              The beneficiary is typed by hand and not compared with the registry legal name
              {isCR(ctx.values) ? '; its English spelling must match the bank (TAB-RULE-000083)' : ''}. Duplicates of legal + bank
              details are only detected at Submit.
            </LabNote>
          )
        },
        {
          type: 'field',
          field: {
            name: 'ibanCertificate',
            label: 'English IBAN certificate',
            kind: 'upload',
            required: true,
            when: isFL,
            hint: "The certificate should match the account. If it doesn't, payouts may be delayed or cancelled."
          }
        }
      ],
      actions: [
        {
          label: 'Continue',
          variant: 'primary',
          enabledWhen: (v) => !v.ibanPending,
          loading: { ms: 600, label: 'Saving' },
          set: () => ({ submitError: '' }),
          to: 'result'
        }
      ]
    },
    // ------------------------------------------------------------ review
    {
      id: 'result',
      stage: 'review',
      title: 'Review application',
      subtitle: 'Check the information below before submitting your application',
      status: 'OBSERVED',
      statusNote:
        'Reached on both routes (2026-10-07; CR re-captured in HD with SAR 5m-20m on 2026-10-14, not submitted). The 409 duplicate refusal is OBSERVED on the Commercial licence route; the 200 submission on the Freelancer route only. Authority is a self-declaration; there is no owner / representative question.',
      evidence: [
        ref('TAB-STATE-000048', 'state', 'OBSERVED', 'Review application: summary sections, Confirmation of authority, Submit.', D_WALK),
        ref('TAB-STATE-000049', 'state', 'OBSERVED', 'Submit refused: 409 LEGAL_BANK_DETAILS_CONFLICT; toast "Legal and bank details already in use"; stays on review. The toast had closed before the screenshot.', D_WALK),
        ref('TAB-STATE-000050', 'state', 'OBSERVED', 'Freelancer route review; declaration ticked by the applicant.', D_WALK),
        ref('TAB-RULE-000054', 'rule', 'OBSERVED', 'Edit per section; mandatory "Confirmation of authority" self-declaration; no POA / delegation anywhere.', D_WALK),
        ref('TAB-RULE-000055', 'rule', 'OBSERVED', 'Legal entity + bank details already used -> 409 at final Submit only; earlier lookups give no warning.', D_WALK),
        ref('TAB-RULE-000081', 'rule', 'OBSERVED', 'Editing Basic details here and choosing SAR 20m-100m puts the application back on the short path (Submit at store type).', D_HD),
        ref('TAB-NET-000011', 'network', 'OBSERVED', 'POST submit 409: "Legal and bank details already in use".', D_WALK),
        shot('TAB-EVID-000198', 'HD: Review application (CR, SAR 5m-20m).', D_HD),
        shot('TAB-EVID-000199', 'HD: Review application, second frame.', D_HD),
        shot('TAB-EVID-000129', 'Review application (final boundary).', D_WALK),
        shot('TAB-EVID-000130', 'After the refused Submit (409); the toast is not visible in this capture.', D_WALK),
        shot('TAB-EVID-000132', 'Freelancer route review (declaration ticked by the applicant).', D_WALK),
        J_MID,
        J_FULL
      ],
      blocks: [
        ...summaryBlocks(true),
        {
          type: 'custom',
          when: isCR,
          render: () => (
            <LabNote status="OBSERVED" title="Revenue edit">
              Editing Basic details and choosing SAR 20m or more puts this application back on the short path: store type then shows
              Submit and the legal, bank and review steps are skipped (TAB-RULE-000081).
            </LabNote>
          )
        },
        {
          type: 'custom',
          when: isCR,
          render: (ctx) => (
            <label className="tb-lab-toggle">
              <input
                type="checkbox"
                checked={!!ctx.values.labDuplicate}
                onChange={(e) => ctx.set({ labDuplicate: e.target.checked, submitError: '' })}
              />
              <span>
                <strong>Lab control:</strong> an existing Tabby merchant already uses these legal and bank details (demonstrates the
                observed 409 at Submit)
              </span>
            </label>
          )
        },
        {
          type: 'notice',
          tone: 'error',
          when: (v) => v.submitError === 'LEGAL_BANK_DETAILS_CONFLICT',
          title: MSG_409,
          text: 'Submit returned HTTP 409. Nothing was submitted and the page stays on the review step.'
        },
        { type: 'heading', text: 'Confirmation of authority' },
        { type: 'field', field: { name: 'confirmAuthority', label: AUTHORITY_TEXT, kind: 'checkbox', required: true } }
      ],
      actions: [
        {
          label: 'Submit',
          variant: 'primary',
          loading: { ms: 1200, label: 'Submitting' },
          set: (v) => ({ submitError: isCR(v) && v.labDuplicate ? 'LEGAL_BANK_DETAILS_CONFLICT' : '' }),
          to: (v) => (v.submitError ? '' : isFL(v) ? 'submitted' : 'submitted-cr')
        }
      ]
    },
    // ------------------------------------------------------------ submitted
    {
      id: 'submitted',
      stage: 'review',
      title: "We're reviewing your application",
      subtitle: 'This usually takes around two business days',
      status: 'OBSERVED',
      statusNote: 'Observed 2026-10-07 for the Freelancer route with a personal IBAN (submitted by the applicant). Sections are read-only.',
      variant: 'center',
      terminal: true,
      evidence: [
        ref('TAB-STATE-000051', 'state', 'OBSERVED', 'Submitted: "We\'re reviewing your application", about two business days; status page polls business-profile.', D_WALK),
        ref('TAB-RULE-000059', 'rule', 'OBSERVED', 'Submit 200: organisation, store and store contract resource created immediately; sections read-only.', D_WALK),
        ref('TAB-NET-000012', 'network', 'OBSERVED', 'POST submit 200, followed by business-profile, stores and store contract calls.', D_WALK),
        shot('TAB-EVID-000133', 'Submitted: "We\'re reviewing your application" (Freelancer).', D_WALK),
        E_LOG2,
        E_HELP
      ],
      blocks: [...summaryBlocks(false), { type: 'custom', render: () => <AfterSubmit route="fl" /> }],
      actions: []
    },
    {
      id: 'submitted-cr',
      stage: 'review',
      title: "We're reviewing your application",
      subtitle: 'This usually takes around two business days',
      status: 'INFERRED',
      statusNote:
        'Shared outcome. A successful Commercial licence submission was never observed: the only CR Submit (2026-10-07) returned 409 and the 2026-10-14 SAR 5m-20m walk stopped at review. This state was captured in the Freelancer path (TAB-STATE-000051); per the user every self-onboarding success shows the same screen.',
      variant: 'center',
      terminal: true,
      evidence: [
        ref('TAB-STATE-000051', 'state', 'OBSERVED', 'Captured in the Freelancer path, not on a Commercial licence application. Reused here as the shared outcome.', D_WALK),
        shot('TAB-EVID-000133', 'Freelancer-path screenshot of "We\'re reviewing your application". No Commercial licence capture exists.', D_WALK),
        ref('TAB-RULE-000059', 'rule', 'OBSERVED', 'Submit 200 and this page: observed for a Freelancer only.', D_WALK),
        ref('TAB-RULE-000055', 'rule', 'OBSERVED', 'The Commercial licence Submit that was tried returned 409.', D_WALK),
        J_MID,
        E_HELP
      ],
      blocks: [...summaryBlocks(false), { type: 'custom', render: () => <AfterSubmit route="cr" /> }],
      actions: []
    }
  ]
};

function AfterSubmit({ route }: { route: 'cr' | 'fl' }) {
  return (
    <>
      {route === 'cr' ? (
        <LabNote status="INFERRED" title="Commercial licence success not observed">
          This screen was captured after a Freelancer submission. For a Commercial licence it is assumed to be the same; the
          resources created at submission were only seen for the Freelancer.
        </LabNote>
      ) : (
        <LabNote status="OBSERVED" title="Created at submission">
          An organisation, a store and a store contract resource exist immediately after Submit, before review.
        </LabNote>
      )}
      <LabNote status="DOCUMENTED" title="What happens next (help centre)">
        <ol className="tb-list">
          <li>Review by the onboarding team, about 2 working days.</li>
          <li>Contract signed after approval.</li>
          <li>Dashboard access.</li>
        </ol>
        The approval outcome and contract signing were not observed (UNKNOWN). Review reasons coded in the client include
        young_business, sells_risky_items, no_valid_license and regulatory_block (INFERRED).
      </LabNote>
    </>
  );
}
