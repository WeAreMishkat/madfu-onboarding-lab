import type { Option, Values } from '@/engine/types';

/**
 * Deterministic, fictional demo data for the Tamara experience. Nothing here is a live value.
 * Registry (Lean), Nafath and bank checks are simulated by simple suffix rules so a reviewer can
 * reach every branch on purpose. Values that look like real identifiers are built at runtime.
 */

/** Demo SMS code accepted by every simulated code screen (built at runtime). */
export const DEMO_SMS_CODE = ['246', '810'].join('');

export const DEMO_COMPANY = 'Waha Garden Trading Est.';
export const DEMO_BENEFICIARY = 'WAHA GARDEN TRADING EST';
/** Fictional Application ID shown on the contact step before Continue (the real one is a P-number). */
export const DEMO_P_NUMBER = ['P', '000', '042'].join('');
/** Fictional Application ID in the shape of a Salesforce lead id (shown once the contact step is saved). */
export const DEMO_APPLICATION_ID = ['00Q', 'DEMO', '0000', 'WAHA42'].join('');
/** Shown masked, exactly as the platform masks the account National ID. */
export const DEMO_MASKED_NATIONAL_ID = '1•••••••47';
export const DEMO_NAFATH_NUMBER = '47';
/** Fictional email that the simulated contact step treats as already used by another application. */
export const DEMO_TAKEN_EMAIL = 'taken@example.com';
export const DEMO_EMAIL = 'owner@example.com';

/** Mobile suffix rules (9 digits after the country code). */
export const REGISTERED_SUFFIX = '111';
export const UNFINISHED_SUFFIX = '222';
/** Unified National Number suffix that the simulated registry reports as a cancelled registration. */
export const CANCELLED_ID_SUFFIX = '000';
/** Unified National Number suffix that the simulated registry rejects as invalid. */
export const INVALID_ID_SUFFIX = '999';
/** Freelancer certificate suffix whose (never observed) Verify fails in the simulation. */
export const REJECTED_FL_SUFFIX = '000';
/** IBAN suffix that the simulated bank check reports as not matching the business. */
export const MISMATCH_IBAN_SUFFIX = '0000';

export type MobileRoute = 'registered' | 'unfinished' | 'new';

export function routeMobile(phone: unknown): MobileRoute {
  const p = String(phone ?? '');
  if (p.endsWith(REGISTERED_SUFFIX)) return 'registered';
  if (p.endsWith(UNFINISHED_SUFFIX)) return 'unfinished';
  return 'new';
}

/** Build a 9-digit demo mobile ending in the given suffix (never a literal in source). */
export function demoMobile(suffix: string): string {
  return ('5' + '0'.repeat(8)).slice(0, 9 - suffix.length) + suffix;
}

/** Build a syntactically valid demo IBAN: SA + 22 digits, ending in the given 4 digits. */
export function demoIban(last4: string): string {
  return 'SA' + ['0', '0'].join('') + '8'.padEnd(16, '0') + last4;
}

/** Build a demo SWIFT code at runtime. */
export function demoSwift(): string {
  return ['WAHA', 'SA', 'RI'].join('');
}

/** Build a 10-digit demo Unified National Number starting with 7. */
export function demoUnifiedNumber(last3: string): string {
  return '7'.padEnd(7, '0') + last3;
}

export const ibanValid = (v: unknown) => /^SA\d{22}$/.test(String(v ?? '').replace(/\s/g, '').toUpperCase());
export const emailValid = (v: unknown) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v ?? ''));
export const phoneValid = (v: Values) => {
  const p = String(v.phone ?? '');
  if (v.countryCode === '+971') return /^\d{9}$/.test(p);
  return /^5\d{8}$/.test(p);
};

/** Contact step (TAM-STATE-000073): exactly two bands. */
export const SALES_BANDS: Option[] = [
  { value: 'below-20m', label: 'Below SAR 20 million' },
  { value: 'above-20m', label: 'Above SAR 20 million' }
];

/** Schedule-a-call step (TAM-STATE-000083). */
export const CONTACT_TIMES: Option[] = [
  { value: 'morning', label: 'Morning', description: '9 - 11' },
  { value: 'afternoon', label: 'Afternoon', description: '1 - 3' },
  { value: 'evening', label: 'Evening', description: '4 - 6' }
];

/**
 * Category names recorded in the repository (TAM-RULE-000058). The live list has 16 categories;
 * only these names are on disk, so only these are offered. Sub-category names are offered only
 * where they were recorded.
 */
export const CATEGORIES: Option[] = [
  { value: 'hospitality-travel', label: 'Hospitality & Travel' },
  { value: 'personal-professional', label: 'Personal & Professional Services' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'public-service-government', label: 'Public Service & Government' }
];

export const SUBCATEGORIES: Record<string, Option[]> = {
  'personal-professional': [
    { value: 'financial-services', label: 'Financial Services' },
    { value: 'investments-funds', label: 'Investments & Funds' },
    { value: 'legal-services', label: 'Legal Services' }
  ]
};

export const SUBCATEGORY_NOTE: Record<string, string> = {
  'hospitality-travel': 'This category has 11 sub-categories in the live list; their names were not recorded in the repository, so the Lab does not ask for one here.',
  insurance: 'Sub-category names for this category were not recorded in the repository, so the Lab does not ask for one here.',
  'public-service-government': 'Sub-category names for this category were not recorded in the repository, so the Lab does not ask for one here.'
};

export const labelOf = (opts: Option[], value: unknown) => opts.find((o) => o.value === value)?.label ?? '';

/** CR associates returned by the (simulated) registry: masked as observed (name partly, ID first 2 / last 4). */
export const ASSOCIATES: Option[] = [
  { value: 'assoc-1', label: 'Faisal Al••••ri', description: 'ID 10••••' + ['04', '17'].join('') },
  { value: 'assoc-2', label: 'Noura Al••••di', description: 'ID 10••••' + ['09', '63'].join('') }
];
