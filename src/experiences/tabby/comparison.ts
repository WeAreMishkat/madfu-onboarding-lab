import type { ComparisonProfile } from '@/compare/types';

/**
 * Tabby KSA merchant onboarding, side-by-side facts for Comparison mode. Statuses follow the
 * repository records (TAB-RULE-000040..083, TAB-STATE-000026..071); no scoring. Newest capture:
 * 2026-10-14 (HD re-capture, SAR 5m-20m to review, SAR 20m-and-above short application submitted).
 */
export const tabbyComparison: ComparisonProfile = {
  experienceId: 'tabby',
  name: 'Tabby',
  stages: [
    { label: 'Region choice (Saudi Arabia / UAE / Kuwait)', appliesTo: 'All', status: 'OBSERVED' },
    { label: 'Email (or phone) + Cloudflare Turnstile', appliesTo: 'All', status: 'OBSERVED', note: 'Auto-passes in a real browser.' },
    { label: '6-digit email code (valid 2 minutes)', appliesTo: 'All', status: 'OBSERVED' },
    { label: 'Mandatory phone link + 4-digit SMS code', appliesTo: 'All', status: 'OBSERVED' },
    { label: 'No business account found in the KSA -> Create a new KSA account', appliesTo: 'All', status: 'OBSERVED' },
    { label: 'Basic info (names, business name, annual revenue)', appliesTo: 'All', status: 'OBSERVED' },
    { label: 'Business licence type', appliesTo: 'All', status: 'OBSERVED' },
    { label: 'Category and sub-category', appliesTo: 'All', status: 'OBSERVED' },
    { label: 'Store type', appliesTo: 'All', status: 'OBSERVED' },
    {
      label: 'SAR 20m and above: Submit at store type -> "We\'ll reach out to continue" (Sales, 2 business days)',
      appliesTo: 'Registered business',
      status: 'OBSERVED',
      note: 'SAR 20m-100m and Above SAR 100m; outcome captured after the Above SAR 100m submit.'
    },
    { label: 'Legal details (Unified Number lookup)', appliesTo: 'Registered business', status: 'OBSERVED', note: 'Below SAR 20m only.' },
    { label: 'Legal details (FL number + ID + national address)', appliesTo: 'Freelancer', status: 'OBSERVED' },
    { label: 'Bank details', appliesTo: 'All', status: 'OBSERVED', note: 'Registered business below SAR 20m, and Freelancer.' },
    { label: 'Review + Confirmation of authority + Submit', appliesTo: 'All', status: 'OBSERVED', note: 'Registered business below SAR 20m, and Freelancer.' },
    { label: 'In review (about two business days)', appliesTo: 'Freelancer', status: 'OBSERVED' },
    {
      label: 'In review (about two business days)',
      appliesTo: 'Registered business',
      status: 'INFERRED',
      note: 'Shared outcome: the screen was captured in the Freelancer path. The only CR Submit returned 409.'
    },
    { label: 'Contract after approval -> dashboard', appliesTo: 'All', status: 'DOCUMENTED' }
  ],
  inputs: [
    { label: 'Email', appliesTo: 'All', status: 'OBSERVED' },
    { label: 'Mobile (7 country codes)', appliesTo: 'All', status: 'OBSERVED' },
    { label: 'First name, last name, business name', appliesTo: 'All', status: 'OBSERVED' },
    { label: 'Annual sales revenue band (4 bands with a business email)', appliesTo: 'All', status: 'OBSERVED' },
    { label: 'Only 2 bands (< SAR 5m / > SAR 5m) for free e-mail domains', appliesTo: 'All', status: 'INFERRED', note: 'TAB-RULE-000044, client code.' },
    { label: 'Category -> sub-category (7 / 40)', appliesTo: 'All', status: 'OBSERVED' },
    { label: 'Online / In-store; website (https://); locations 1 / 2 / 3 / More than 3; map pin + address for exactly 1', appliesTo: 'Registered business', status: 'OBSERVED' },
    { label: 'Website or social media only', appliesTo: 'Freelancer', status: 'OBSERVED' },
    { label: 'Unified Number (only legal identifier typed)', appliesTo: 'Registered business', status: 'OBSERVED' },
    { label: 'Optional VAT: number (15 digits, starts 3, ends 03) + certificate address', appliesTo: 'Registered business', status: 'OBSERVED' },
    { label: 'FL certificate number, National ID number, national address', appliesTo: 'Freelancer', status: 'OBSERVED' },
    { label: 'IBAN + beneficiary name (typed)', appliesTo: 'All', status: 'OBSERVED' },
    { label: 'Payout-report email (pre-filled with the sign-in email); currency SAR', appliesTo: 'Registered business', status: 'OBSERVED', note: 'TAB-RULE-000083.' },
    { label: 'Confirmation of authority checkbox', appliesTo: 'All', status: 'OBSERVED' }
  ],
  automation: [
    { label: 'Unified Number lookup fills legal name + address (read-only)', appliesTo: 'Registered business', status: 'OBSERVED', note: "Via Tabby's backend; provider UNKNOWN." },
    { label: 'Owners, CR number, licence expiry and type stored silently', appliesTo: 'Registered business', status: 'INFERRED', note: 'Owners returned (OBSERVED), never displayed.' },
    { label: 'IBAN lookup derives bank name + SWIFT (locked)', appliesTo: 'All', status: 'OBSERVED' },
    { label: 'Draft autosave on every Continue / blur; resume at first incomplete step', appliesTo: 'All', status: 'OBSERVED' },
    { label: 'Organisation, store and contract resource created at submission', appliesTo: 'Freelancer', status: 'OBSERVED' },
    { label: 'Revenue band switches the Registered business route (full form vs short application)', appliesTo: 'Registered business', status: 'OBSERVED', note: 'Also when the band is edited on review (TAB-RULE-000081).' }
  ],
  branches: [
    { label: 'Commercial licence vs Freelancer changes legal, bank and store-type steps', appliesTo: 'All', status: 'OBSERVED' },
    { label: 'Commercial licence < SAR 5m and SAR 5m-20m: full form (legal, bank, review)', appliesTo: 'Registered business', status: 'OBSERVED' },
    {
      label: 'Commercial licence SAR 20m-100m and Above SAR 100m: submitted at store type (sales-led)',
      appliesTo: 'Registered business',
      status: 'OBSERVED',
      note: 'TAB-RULE-000080; no difference between the two bands in the evidence.'
    },
    { label: 'Freelancer: full form at every revenue band', appliesTo: 'Freelancer', status: 'INFERRED', note: 'Route OBSERVED at < SAR 5m; tier-independence from code.' },
    { label: 'Free e-mail domain cannot declare SAR 20m or more', appliesTo: 'All', status: 'INFERRED' },
    { label: 'Category does not change the step list; risk decided in review', appliesTo: 'All', status: 'OBSERVED' },
    { label: 'Exactly 1 in-store location -> map pin + address', appliesTo: 'Registered business', status: 'OBSERVED' },
    { label: 'Changing the licence resets store and legal data', appliesTo: 'All', status: 'OBSERVED' },
    { label: 'Duplicate legal + bank details -> 409 at Submit', appliesTo: 'Registered business', status: 'OBSERVED' }
  ],
  verification: [
    { label: 'Cloudflare Turnstile human check', appliesTo: 'All', status: 'OBSERVED' },
    { label: 'Email code (6 digits) and SMS code (4 digits)', appliesTo: 'All', status: 'OBSERVED' },
    { label: 'Registry lookup on Unified Number (is_valid gate; expired / inactive -> generic error)', appliesTo: 'Registered business', status: 'OBSERVED' },
    { label: 'Registry provider behind the lookup', appliesTo: 'Registered business', status: 'UNKNOWN' },
    { label: 'No registry, bank or document check before Submit in the SAR 20m-and-above route', appliesTo: 'Registered business', status: 'OBSERVED', note: 'Sales follow-up after Submit UNKNOWN.' },
    { label: 'No registry check on the FL number', appliesTo: 'Freelancer', status: 'OBSERVED' },
    { label: 'Beneficiary not matched to the registry name', appliesTo: 'All', status: 'OBSERVED' },
    { label: 'Authority: self-declaration only (no signatory check, no POA)', appliesTo: 'All', status: 'OBSERVED' },
    { label: 'Duplicate legal + bank check only at final Submit', appliesTo: 'All', status: 'OBSERVED' },
    { label: 'Manual review, about two business days', appliesTo: 'All', status: 'OBSERVED', note: 'Review page observed on the Freelancer route only; outcome UNKNOWN.' }
  ],
  uploads: [
    { label: 'None in the standard path (no licence copy, no owner ID, no IBAN certificate)', appliesTo: 'Registered business', status: 'OBSERVED' },
    { label: 'VAT registration certificate (only if Reclaim your VAT is on)', appliesTo: 'Registered business', status: 'OBSERVED' },
    { label: 'National ID photo of the certificate holder', appliesTo: 'Freelancer', status: 'OBSERVED' },
    { label: 'Proof of national address certificate', appliesTo: 'Freelancer', status: 'OBSERVED' },
    { label: 'English IBAN certificate', appliesTo: 'Freelancer', status: 'OBSERVED' }
  ]
};
