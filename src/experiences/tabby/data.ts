import type { Option, Values } from '@/engine/types';
import type { EvidenceKind, EvidenceRef, EvidenceStatus } from '@/lab/evidence';

/**
 * Tabby KSA merchant onboarding: constants, fictional mock data and small pure helpers.
 * Every value in this file is fictional. Nothing is copied from evidence artifacts.
 */

// ---------------------------------------------------------------- evidence helpers
type Env = NonNullable<EvidenceRef['env']>;

/** Capture dates of the three Tabby onboarding sessions in the research repository. */
export const D_WALK = '2026-10-07'; // onboarding-logic-s1: CR route to review (409) + Freelancer submitted
export const D_LOOKUP = '2026-10-08'; // tabby-cr-lookup-s1: Unified Number lookup deep-dive
export const D_HD = '2026-10-14'; // onboarding-board-s2: HD re-capture, >= SAR 20m and SAR 5m-20m walks

/**
 * A screenshot record. Tabby onboarding screenshots carry live applicant data and are never
 * published (tracked_in_git: false); the Evidence drawer shows a placeholder only.
 */
export const shot = (id: string, description: string, date?: string, env: Env = 'production'): EvidenceRef => ({
  id,
  kind: 'screenshot',
  status: 'OBSERVED',
  description,
  localOnly: true,
  date,
  env
});

const defaultEnv = (kind: EvidenceKind, status: EvidenceStatus): Env | undefined => {
  if (kind === 'code') return 'client code';
  if (kind === 'help-centre') return 'help-centre';
  return status === 'OBSERVED' ? 'production' : undefined;
};
export const ref = (
  id: string,
  kind: EvidenceKind,
  status: EvidenceStatus,
  description: string,
  date?: string,
  env?: Env
): EvidenceRef => ({
  id,
  kind,
  status,
  description,
  date,
  env: env ?? defaultEnv(kind, status)
});

// ---------------------------------------------------------------- copy (verbatim where recorded)
export const MSG_UN_NOT_7 = 'Enter a unified number instead of a commercial registration number';
export const MSG_UN_INVALID = 'Please enter valid unified number';
export const MSG_WEBSITE = "Please enter a valid website link starting with 'https://'";
export const MSG_VAT = '15 digits, starts with 3 and ends with 03';
export const MSG_NATIONAL_ID = 'Enter a National ID number that starts with 1 or 2';
export const MSG_409 = 'Legal and bank details already in use';
export const AUTHORITY_TEXT =
  'I confirm that I have the authority to submit this application on behalf of the company…';

// ---------------------------------------------------------------- account
export const PHONE_CODES: Option[] = ['+966', '+971', '+974', '+973', '+965', '+20', '+962'].map((c) => ({ value: c, label: c }));

/**
 * Free e-mail providers named in the code extract (TAB-EVID-000106). The shipped list has about
 * 60 names; only these are recorded in the repository.
 */
export const FREE_EMAIL_PROVIDERS = ['gmail', 'yahoo', 'outlook', 'hotmail', 'icloud', 'zoho', 'yandex'];

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());
export const isFreeEmail = (email: unknown) => {
  const domain = String(email ?? '').trim().toLowerCase().split('@')[1] ?? '';
  return FREE_EMAIL_PROVIDERS.includes(domain.split('.')[0]);
};

// ---------------------------------------------------------------- revenue (annual_volume codes from the bundle)
export const REVENUE_BUSINESS: Option[] = [
  { value: 'less_than_1m', label: 'Less than SAR 5m' },
  { value: 'from_1m_to_5m', label: 'SAR 5m to SAR 20m' },
  { value: 'from_5m_to_15m', label: 'SAR 20m to SAR 100m' },
  { value: 'above_15m', label: 'Above SAR 100m' }
];
export const REVENUE_FREE: Option[] = [
  { value: 'less_than_1m', label: 'Less than SAR 5m', status: 'INFERRED' },
  { value: 'from_1m_to_5m', label: 'Above SAR 5m', status: 'INFERRED' }
];
export const revenueOptions = (v: Values) => (isFreeEmail(v.email) ? REVENUE_FREE : REVENUE_BUSINESS);
export const revenueLabel = (v: Values) => revenueOptions(v).find((o) => o.value === v.annualVolume)?.label ?? '';

/** Tier from annual_volume: above_15m 1, from_5m_to_15m 2, from_1m_to_5m 3, less_than_1m 4. */
export const tierOf = (annualVolume: unknown): number =>
  ({ above_15m: 1, from_5m_to_15m: 2, from_1m_to_5m: 3, less_than_1m: 4 })[String(annualVolume)] ?? 4;

export const isCR = (v: Values) => v.licence === 'cr';
export const isFL = (v: Values) => v.licence === 'fl';
/**
 * TAB-RULE-000080 (OBSERVED 2026-10-14, supersedes the code-only TAB-RULE-000042): Commercial licence
 * with SAR 20m-100m or Above SAR 100m -> "Where do you sell?" shows Submit and the application ends
 * there. Less than SAR 5m and SAR 5m-20m -> Continue to the full form.
 */
export const isSalesLed = (v: Values) => isCR(v) && tierOf(v.annualVolume) <= 2;
/** Freelancer who declared >= SAR 20m: the full form continues (tier-independence read from code). */
export const isHighRevenueFL = (v: Values) => isFL(v) && tierOf(v.annualVolume) <= 2;

export const LICENCE_OPTIONS: Option[] = [
  { value: 'cr', label: 'Commercial licence', description: 'Commercially registered company' },
  // Live copy bug (observed): the Freelance option's subtitle reuses the in-store copy.
  { value: 'fl', label: 'Freelance or productive family certificate', description: 'Retail stores or other physical locations' }
];
export const licenceLabel = (v: Values) => LICENCE_OPTIONS.find((o) => o.value === v.licence)?.label ?? '';

// ---------------------------------------------------------------- category (TAB-RULE-000045)
interface Category {
  value: string;
  label: string;
  /** Sub-category count as recorded. */
  count: number;
  /** Sub-category names that exist in tracked evidence. */
  known: string[];
}
export const CATEGORIES: Category[] = [
  { value: 'fashion', label: 'Fashion', count: 7, known: [] },
  { value: 'beauty-health', label: 'Beauty & Health', count: 4, known: ['Clinics', 'Medical & Pharmacy'] },
  { value: 'gifts-gadgets', label: 'Gifts & Gadgets', count: 5, known: [] },
  { value: 'baby-toys', label: 'Baby & Toys', count: 3, known: [] },
  { value: 'sports-gaming', label: 'Sports & Gaming', count: 5, known: [] },
  { value: 'home', label: 'Home', count: 4, known: [] },
  { value: 'other', label: 'Other', count: 9, known: ['Insurance', 'Travel', 'Education', 'Services'] }
];
export const CATEGORY_OPTIONS: Option[] = CATEGORIES.map((c) => ({ value: c.value, label: c.label }));

export function subCategoryOptions(category: unknown): Option[] {
  const c = CATEGORIES.find((x) => x.value === category);
  if (!c) return [];
  const named: Option[] = c.known.map((k) => ({ value: `${c.value}:${k}`, label: k }));
  const unnamed: Option[] = Array.from({ length: c.count - c.known.length }, (_, i) => ({
    value: `${c.value}:unnamed-${i + 1}`,
    label: `Sub-category ${c.known.length + i + 1} (name not recorded)`,
    status: 'UNKNOWN' as const
  }));
  return [...named, ...unnamed];
}
export const categoryLabel = (v: Values) => CATEGORIES.find((c) => c.value === v.category)?.label ?? '';
export const subCategoryLabel = (v: Values) =>
  subCategoryOptions(v.category).find((o) => o.value === v.subCategory)?.label ?? '';

// ---------------------------------------------------------------- store type (TAB-RULE-000046/047)
export const CHANNEL_OPTIONS: Option[] = [
  { value: 'online', label: 'Online', description: 'Website, blog, social media' },
  { value: 'offline', label: 'In-store', description: 'Retail stores or other physical locations' }
];
export const LOCATION_OPTIONS: Option[] = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '3+', label: 'More than 3' }
];
export const channels = (v: Values): string[] => (Array.isArray(v.channels) ? (v.channels as string[]) : []);
export const sellsOnline = (v: Values) => isFL(v) || channels(v).includes('online');
export const sellsInStore = (v: Values) => isCR(v) && channels(v).includes('offline');
export const isWebsite = (s: string) => /^https:\/\/[^\s/.]+\.[^\s]{2,}/.test(s.trim());

/** Changing the licence type resets store-type and legal data (TAB-RULE-000053). */
export const STORE_AND_LEGAL_RESET: Values = {
  channels: [],
  website: '',
  locations: '',
  storeAddress: '',
  unifiedNumber: '',
  unPending: '',
  unChecked: '',
  unValid: false,
  unAddressReturned: false,
  legalCompanyName: '',
  legalAddress: '',
  vatOn: false,
  vatCertificate: '',
  vatNumber: '',
  vatAddress: '',
  flNumber: '',
  nationalIdPhoto: '',
  nationalIdNumber: '',
  addressProof: '',
  nationalAddress: ''
};

// ---------------------------------------------------------------- Unified Number lookup (fictional mocks)
export interface UnifiedLookupResult {
  is_valid: boolean;
  legal_company_name: string;
  legal_address: string;
  commercial_registration_number: string;
  license_expire_date: string;
  license_type_id: string;
  is_active: boolean;
  is_expired: boolean;
  /** Number of company_owners returned (null when the response carries none). */
  owners: number | null;
}

const EMPTY_LOOKUP: UnifiedLookupResult = {
  is_valid: false,
  legal_company_name: '',
  legal_address: '',
  commercial_registration_number: '',
  license_expire_date: '',
  license_type_id: '',
  is_active: false,
  is_expired: false,
  owners: null
};

/** Fictional demo numbers. None of these refers to a real registration. */
export const DEMO_UN_VALID = '7001000001';
export const DEMO_UN_NO_ADDRESS = '7001000002';
export const DEMO_UN_EXPIRED = '7009999991';

const UNIFIED_MOCK: Record<string, UnifiedLookupResult> = {
  [DEMO_UN_VALID]: {
    is_valid: true,
    legal_company_name: 'Rimal Home Supplies Co.',
    legal_address: 'Building 12, Al Olaya Street, Riyadh (fictional)',
    commercial_registration_number: '4030' + '000101',
    license_expire_date: '2027-05-31',
    license_type_id: '301',
    is_active: true,
    is_expired: false,
    owners: 2
  },
  [DEMO_UN_NO_ADDRESS]: {
    is_valid: true,
    legal_company_name: 'Najd Craft Coffee Co.',
    legal_address: '',
    commercial_registration_number: '4030' + '000202',
    license_expire_date: '2027-11-30',
    license_type_id: '301',
    is_active: true,
    is_expired: false,
    owners: 1
  },
  [DEMO_UN_EXPIRED]: {
    is_valid: false,
    legal_company_name: 'Sahil Trading Est.',
    legal_address: '',
    commercial_registration_number: '4030' + '000303',
    license_expire_date: '2024-02-29',
    license_type_id: '301',
    is_active: false,
    is_expired: true,
    owners: 3
  }
};

/** Simulated Tabby backend response. Any unlisted value -> HTTP 200 with is_valid=false and no data. */
export const lookupUnifiedNumber = (n: string): UnifiedLookupResult => UNIFIED_MOCK[n] ?? EMPTY_LOOKUP;

export const unValue = (v: Values) => String(v.unifiedNumber ?? '').trim();
/** A lookup has completed for the value currently in the field. */
export const unLookedUp = (v: Values) => !!unValue(v) && v.unChecked === unValue(v);
export const unLookupValid = (v: Values) => unLookedUp(v) && v.unValid === true;
export const unLookupInvalid = (v: Values) => unLookedUp(v) && v.unValid !== true;

// ---------------------------------------------------------------- IBAN lookup (fictional banks)
export const normIban = (s: unknown) => String(s ?? '').replace(/\s+/g, '').toUpperCase();
export const isSaIban = (s: unknown) => /^SA\d{22}$/.test(normIban(s));

const BANKS: Record<string, [string, string]> = {
  '10': ['Northwind Bank', 'NWBK'],
  '20': ['Desert Trust Bank', 'DTBK'],
  '80': ['Oasis Commercial Bank', 'OCBK']
};
/** Simulated IBAN lookup: bank name and SWIFT derived from the bank code (digits 5-6). */
export function lookupIban(iban: string): { bankName: string; swiftCode: string } {
  const [name, code4] = BANKS[normIban(iban).slice(4, 6)] ?? ['Demo Bank', 'DEMO'];
  return { bankName: name, swiftCode: code4 + 'SA' + 'RI' };
}
export const maskIban = (s: unknown) => {
  const n = normIban(s);
  return n ? `SA•• •••• ${n.slice(-4)}` : '';
};

/** Fictional IBAN for presets, assembled at runtime (bank code 20). */
export const demoIban = () => ['SA', '00', '2000', '0001', '2345', '6789', '1234'].join('');
/** Fictional mobile and national ID for presets, assembled at runtime. */
export const demoMobile = () => ['5', '1234', '5678'].join('');
export const demoNationalId = () => ['1', '0123', '45678'].join('');
export const demoFreeEmail = () => ['layla.demo', 'gmail.com'].join('@');
/** Demo verification codes, assembled at runtime (any code of the right length is accepted). */
export const demoEmailCode = () => ['48', '29', '13'].join('');
export const demoSmsCode = () => ['55', '21'].join('');

export const maskPhone = (v: Values) => {
  const p = String(v.phone ?? '');
  return p ? `${String(v.phoneCc ?? '+966')} ••• ••• ${p.slice(-3)}` : '';
};
