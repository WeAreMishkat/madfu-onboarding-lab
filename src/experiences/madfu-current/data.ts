import type { EvidenceRef, EvidenceKind, EvidenceStatus } from '@/lab/evidence';
import type { Values } from '@/engine/types';

/**
 * Synthetic demo data for Madfu Current. Nothing here is a real identifier, name or account.
 * Values that share a shape with personal or banking data (mobile, national ID, IBAN) are assembled
 * at runtime so no literal of that shape lives in source.
 */
export const DEMO_UNIFIED = '7012345678';
export const DEMO_FL = '123456789';
export const DEMO_MOBILE = ['5', '5', '1234567'].join('');
export const DEMO_PERSON = 'Sara Al-Harbi';
export const DEMO_PERSON_LEAD = 'Sara Alharbi';
export const DEMO_CR_NAME = 'Najd Roastery Co.';
export const DEMO_CR_ADDRESS = '1234 Demo Street, Al Olaya, Riyadh';
export const DEMO_EMAIL = 'sara.alharbi@example.com';
export const DEMO_LINK = 'https://najd-roastery.example.com';
/** Beneficiary returned by the (simulated) bank check: deliberately differs from the legal name (MDF-RULE-000094). */
export const DEMO_BANK_BENEFICIARY = 'Demo Holding Est.';

/** Lead outcomes that only exist to demo real server answers. */
export const DEMO_EXISTING_UNIFIED = '7000000001';
export const DEMO_EXISTING_FL = '000000001';
export const DEMO_IN_PROGRESS_UNIFIED = '7000000002';

export const demoNationalId = () => '1' + '044556677';
/** Synthetic Saudi-format IBAN with impossible check digits (00). Bank code (positions 5-6) "20". */
export const demoIban = () => 'SA' + '00' + ['2000', '0001', '2345', '6789', '0123'].join('');

export const FILE_ACCEPT = 'Accepted formats: PDF - Max file size: 3 MB per file';

/**
 * Banks offered on TEST (MDF-STATE-000101), in the order observed.
 * `code` is the public Saudi IBAN bank code; the Lab uses it only to show that the verified bank
 * follows the IBAN, not the selected bank (MDF-RULE-000094). `swift` is synthetic.
 */
export const BANKS: Array<{ value: string; label: string; code: string; verifiedName: string; swift: string }> = [
  { value: 'alrajhi', label: 'Al Rajhi Bank', code: '80', verifiedName: 'Al Rajhi Bank', swift: 'DEMOSAAA' },
  { value: 'bsf', label: 'AlBank AlSaudi AlFransi', code: '55', verifiedName: 'Banque Saudi Fransi', swift: 'DEMOSABB' },
  { value: 'alinma', label: 'Alinma Bank', code: '05', verifiedName: 'Alinma Bank', swift: 'DEMOSACC' },
  { value: 'anb', label: 'Arab National Bank', code: '30', verifiedName: 'Arab National Bank', swift: 'DEMOSADD' },
  { value: 'albilad', label: 'Bank Albilad', code: '15', verifiedName: 'Bank Albilad', swift: 'DEMOSAEE' },
  { value: 'aljazira', label: 'Bank AlJazira', code: '60', verifiedName: 'Bank AlJazira', swift: 'DEMOSAFF' },
  { value: 'gib', label: 'Gulf International Bank', code: '90', verifiedName: 'Gulf International Bank', swift: 'DEMOSAGG' },
  { value: 'snb', label: 'Saudi National Bank', code: '10', verifiedName: 'Saudi National Bank', swift: 'DEMOSAHH' },
  { value: 'riyad', label: 'Riyad Bank', code: '20', verifiedName: 'Riyad Bank', swift: 'DEMOSAJJ' },
  { value: 'saib', label: 'Saudi Investment Bank', code: '65', verifiedName: 'Saudi Investment Bank', swift: 'DEMOSAKK' },
  { value: 'sab', label: 'Saudi Awwal Bank', code: '45', verifiedName: 'Saudi Awwal Bank', swift: 'DEMOSALL' }
];
export const BANK_OPTIONS = BANKS.map(({ value, label }) => ({ value, label }));

/**
 * What the simulated server-side check returns: the bank is derived from the IBAN. If the IBAN's
 * bank code is not in the table (a made-up IBAN), the Lab falls back to the selected bank.
 */
export function verifiedBankFor(iban: string, selected: string) {
  const byCode = BANKS.find((b) => b.code === iban.slice(4, 6));
  return byCode ?? BANKS.find((b) => b.value === selected) ?? BANKS[0];
}

export const DECLINE_REASONS = [
  'Too expensive',
  'Not relevent',
  'Already using another provider',
  'Not ready to decide',
  'Prefer manual process'
];

// ---------------------------------------------------------------------------------------------
// Value helpers
// ---------------------------------------------------------------------------------------------
export const str = (v: Values, k: string): string => (typeof v[k] === 'string' ? (v[k] as string) : '');
export const isFL = (v: Values) => v.businessType === 'fl';
export const isCR = (v: Values) => !isFL(v);

export function maskMobile(m: string): string {
  if (!m) return '';
  return `${m.slice(0, 2)}•••••${m.slice(-2)}`;
}
export function maskEmail(e: string): string {
  const [local, domain] = e.split('@');
  if (!domain) return e;
  return `${local.slice(0, 2)}•••@${domain}`;
}
/** Owner card on Merchant Information: ID masked to first 4 / last 2 digits (MDF-RULE-000089). */
export function maskOwnerId(id: string): string {
  if (id.length < 6) return id;
  return `${id.slice(0, 4)}••••${id.slice(-2)}`;
}
export function identifierLabel(v: Values) {
  return isFL(v) ? 'Freelance Certificate Number' : 'Unified Number';
}
export function identifierValue(v: Values) {
  return isFL(v) ? `FL - ${str(v, 'flNumber')}` : str(v, 'unifiedNumber');
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+$/;
export const URL_RE = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/i;
export const SA_IBAN_RE = /^SA\d{22}$/;
/** Server-side name rule (MDF-RULE-000030): words of letters/digits separated by single spaces. */
export const NAME_RE = /^[\p{L}\p{N}]+( [\p{L}\p{N}]+)*$/u;

export type LeadOutcome = 'ok' | 'existing' | 'sales' | 'name';
export function leadOutcome(v: Values): LeadOutcome {
  if (!NAME_RE.test(str(v, 'name').trim())) return 'name';
  if (isCR(v) && str(v, 'unifiedNumber') === DEMO_EXISTING_UNIFIED) return 'existing';
  if (isFL(v) && str(v, 'flNumber') === DEMO_EXISTING_FL) return 'existing';
  if (isCR(v) && str(v, 'unifiedNumber') === DEMO_IN_PROGRESS_UNIFIED) return 'sales';
  return 'ok';
}
export const LEAD_MESSAGES: Record<Exclude<LeadOutcome, 'ok'>, string> = {
  existing: 'You already have an account. Please sign in.',
  sales: 'He has in-progress request and will be contacted by Sales team.',
  name: 'Name: Must be alphanumeric with a space between words. No special characters allowed.'
};

/** The IBAN on screen has been verified by the (simulated) server-side check. */
export const ibanVerified = (v: Values) => !!str(v, 'iban') && str(v, 'ibanVerifiedFor') === str(v, 'iban');

export const PASSWORD_RULES: Array<{ label: string; test: (pw: string, confirm: string) => boolean }> = [
  { label: 'Must be at least 8 characters long', test: (p) => p.length >= 8 },
  { label: 'Must include at least one uppercase letter (A-Z)', test: (p) => /[A-Z]/.test(p) },
  { label: 'Must include at least one lowercase letter (a-z)', test: (p) => /[a-z]/.test(p) },
  { label: 'Must include at least one number (0-9)', test: (p) => /\d/.test(p) },
  { label: 'Must include at least one special character (! @ # $ % ^ & * _ - + = ?)', test: (p) => /[!@#$%^&*_\-+=?]/.test(p) },
  { label: 'Passwords must Match', test: (p, c) => p.length > 0 && p === c }
];
export const passwordOk = (v: Values) => PASSWORD_RULES.every((r) => r.test(str(v, 'pw'), str(v, 'pwConfirm')));

// ---------------------------------------------------------------------------------------------
// Evidence helpers. Screenshots are never published: they are referenced as local-only records.
// ---------------------------------------------------------------------------------------------
type Env = NonNullable<EvidenceRef['env']>;

export const TEST_FL = { date: '2026-10-12', env: 'TEST' as Env };
export const TEST_CR = { date: '2026-10-13', env: 'TEST' as Env };
export const TEST_HIGH = { date: '2026-10-14', env: 'TEST' as Env };
export const PROD = { date: '2026-10-07', env: 'production' as Env };
export const CODE = { env: 'client code' as Env };
export const NOTES = { env: 'research notes' as Env };

/** A captured state: the screenshot stays in the private research repository. */
export function shot(id: string, description: string, when: { date?: string; env: Env }): EvidenceRef {
  return { id, kind: 'screenshot', status: 'OBSERVED', description, localOnly: true, ...when };
}

/** Any other record (rule, journey, network log, code or copy extract). */
export function ev(id: string, kind: EvidenceKind, status: EvidenceStatus, description: string, when?: { date?: string; env: Env }): EvidenceRef {
  return { id, kind, status, description, ...(when ?? {}) };
}

export const EV = {
  network150: ev('MDF-EVID-000150', 'network', 'OBSERVED', 'Freelancer TEST onboarding network log (metadata only): lead, OTP, account, Merchant and Business Information, submit.', TEST_FL),
  network211: ev('MDF-EVID-000211', 'network', 'OBSERVED', 'CR TEST network log (metadata only): GetFullInfo, SubmitSpocInfo, VerifyIban, SignContract, MarkContractSignedWaitingVerification, SignOff.', TEST_CR),
  inventory212: ev('MDF-EVID-000212', 'record', 'OBSERVED', 'CR page inventory: labels, required, read-only and filled flags per page; no values.', TEST_CR),
  journey10: ev('MDF-JOURNEY-000010', 'journey', 'OBSERVED', 'Registered Business on TEST: sign-in to signed Signit contract, separate Submit Request and "Submitted successfully!" (single-use QA account, one Wathq owner).', TEST_CR),
  journey9: ev('MDF-JOURNEY-000009', 'journey', 'OBSERVED', 'Freelancer on TEST: lead to "Submitted successfully!", pending review, no contract.', TEST_FL),
  copy151: ev('MDF-EVID-000151', 'ui-copy', 'INFERRED', 'Shipped en.json copy (TEST build): lead outcomes, end states, survey.', CODE)
};
