/**
 * Screen snapshots for the wireframes PDF: fixed application states rendered with the SAME step
 * components as the interactive prototype.
 */
import { LIMITS } from '../model/config';
import { certificatesAdapter, personsAdapter } from '../model/mock';
import { initialApplication, initialSim, initialState, prefill } from '../model/state';
import type { ApplicantType, Application, OutcomeKind, ProposedState, StepId } from '../model/types';

export interface Snapshot {
  id: string;
  section: 'entry' | 'cr' | 'fl' | 'manual' | 'outcomes' | 'validation';
  title: string;
  caption: string;
  state: () => ProposedState;
  errors?: Record<string, string>;
}

const wrap = (app: Application): ProposedState => ({ ...initialState(), app, sim: initialSim() });
const at = (t: ApplicantType, step: StepId, patch: (a: Application) => Application = (a) => a) => () => wrap(patch(prefill(t, step)));
const show = (t: ApplicantType, built: StepId, step: StepId, patch: (a: Application) => Application = (a) => a) => () => wrap(patch({ ...prefill(t, built), step }));
const outcome = (o: OutcomeKind, t: ApplicantType = 'CR') => () => wrap({ ...prefill(t, 'outcome'), step: 'outcome', outcome: o, submittedAt: '2026-10-15T09:30:00.000Z' });

const emptyEntry = () => wrap({ ...initialApplication(1_760_000_000_000), step: 'entry' });

export const SNAPSHOTS: Snapshot[] = [
  // Entry + SMS code
  { id: 'entry-empty', section: 'entry', title: 'Entry page', caption: 'One page for both applicant types. All fields are mandatory; validation is structural only.', state: emptyEntry },
  { id: 'entry-cr', section: 'entry', title: 'Entry page: registered business', caption: 'Commercial Registration Number for a registered business.', state: () => wrap({ ...prefill('CR', 'entry'), step: 'entry' }) },
  { id: 'entry-fl', section: 'entry', title: 'Entry page: freelancer', caption: 'Freelancers give the National ID number. No certificate number at entry.', state: () => wrap({ ...prefill('FL', 'entry'), step: 'entry' }) },
  { id: 'otp', section: 'entry', title: 'SMS code', caption: 'Masked mobile, verify, resend and edit mobile. 3 incorrect attempts.', state: () => wrap({ ...prefill('CR', 'otp'), verifiedMobile: '', otp: { status: 'sent', attemptsLeft: LIMITS.otpAttempts, code: '', resendAt: 0 } }) },
  { id: 'category', section: 'entry', title: 'Category screening', caption: "Madfu's own taxonomy, before any paid verification. Restricted subcategories end neutrally.", state: at('CR', 'category', (a) => ({ ...a, category: { group: 'food', sub: 'food-cafe' } })) },

  // Registered business
  { id: 'cr-verify', section: 'cr', title: 'Business verification', caption: 'Registration details are retrieved, not typed (mock provider adapter).', state: show('CR', 'persons', 'cr-verify') },
  { id: 'cr-expired', section: 'cr', title: 'Business verification: expired', caption: 'Expired registrations may continue; flagged internally for review.', state: show('CR', 'persons', 'cr-verify', (a) => ({ ...a, cr: { status: 'expired', tries: 1, record: { legalName: 'Najd Roastery Trading Company', status: 'Expired', expiry: '2026-08-31', city: 'Riyadh' } } })) },
  { id: 'cr-persons', section: 'cr', title: 'Authorised person', caption: 'Only individuals, masked: first and last name visible, ID first 3 / last 3. Single selection.', state: show('CR', 'nafath', 'persons', (a) => ({ ...a, persons: { status: 'loaded', tries: 1, list: personsAdapter('multiple'), selectedId: 'p1' }, nafath: { ...a.nafath, status: 'idle' } })) },
  { id: 'cr-nafath-wait', section: 'cr', title: 'Nafath request', caption: 'Large request number, four instructions, pending status. Identity and authority only; not the contract.', state: show('CR', 'nafath', 'nafath', (a) => ({ ...a, nafath: { ...a.nafath, status: 'waiting', requests: 1, number: '42', verifiedPersonId: null } })) },
  { id: 'cr-nafath-ok', section: 'cr', title: 'Nafath verified', caption: 'Verified: continue to business details.', state: show('CR', 'business', 'nafath') },
  { id: 'cr-business', section: 'cr', title: 'Business details', caption: 'IBAN only (bank derived), VAT retrieved for a registered business, sales channel with links. No documents.', state: show('CR', 'review', 'business', (a) => ({ ...a, business: { ...a.business, vat: 'yes', vatLookup: 'found', channel: 'both', mapsUrl: 'https://maps.google.com/?q=demo', branches: '2' } })) },
  { id: 'cr-review', section: 'cr', title: 'Review', caption: 'Every section has Edit; data is kept and the applicant returns to Review.', state: at('CR', 'review') },
  { id: 'cr-contract', section: 'cr', title: 'Agreement', caption: 'Generic acceptance (provider not decided). Available only when Nafath is verified.', state: at('CR', 'contract') },

  // Freelancer
  { id: 'fl-nafath', section: 'fl', title: 'Freelancer Nafath', caption: 'Uses the National ID from the entry page. Two attempts.', state: show('FL', 'nafath', 'nafath', (a) => ({ ...a, nafath: { ...a.nafath, status: 'waiting', requests: 1, number: '17', verifiedPersonId: null } })) },
  { id: 'fl-certs', section: 'fl', title: 'Freelance certificates', caption: 'Retrieved after Nafath. Expired or already-attached certificates cannot be selected.', state: show('FL', 'business', 'certificates', (a) => ({ ...a, certs: { status: 'loaded', tries: 1, list: certificatesAdapter('duplicate').concat(certificatesAdapter('one').map((c) => ({ ...c, id: 'fl9', number: 'FL-400000009' }))), selectedId: 'fl2', manualNumber: '' } })) },
  { id: 'fl-business', section: 'fl', title: 'Business details: freelancer', caption: 'Personal IBAN verified against the individual; VAT number only if registered.', state: show('FL', 'review', 'business', (a) => ({ ...a, business: { ...a.business, vat: 'yes', vatNumber: '300000000000003' } })) },
  { id: 'fl-review', section: 'fl', title: 'Review: freelancer', caption: 'Certificate section added for freelancers.', state: at('FL', 'review') },

  // Manual routes
  { id: 'cr-no-people', section: 'manual', title: 'No eligible individual', caption: 'Only a company is associated with the CR: manual authority check, no contract.', state: show('CR', 'persons', 'persons', (a) => ({ ...a, persons: { status: 'none', tries: 1, list: personsAdapter('none'), selectedId: null } })) },
  { id: 'cr-nafath-exhausted', section: 'manual', title: 'Nafath failed twice', caption: 'No more automatic Nafath. Business details are still collected; no contract.', state: show('CR', 'nafath', 'nafath', (a) => ({ ...a, nafath: { ...a.nafath, status: 'exhausted', failures: 2, requests: 2, lastResult: 'rejected', verifiedPersonId: null } })) },
  { id: 'fl-manual-cert', section: 'manual', title: 'Manual certificate', caption: 'Freelancer Nafath failed twice (or no certificate found): certificate number typed by hand.', state: show('FL', 'nafath', 'manual-certificate', (a) => ({ ...a, nafath: { ...a.nafath, status: 'exhausted', failures: 2 } })) },
  { id: 'fl-iban-not-checked', section: 'manual', title: 'IBAN without ownership check', caption: 'Manual route: the IBAN is collected for the review team.', state: show('FL', 'review', 'business', (a) => ({ ...a, nafath: { ...a.nafath, status: 'exhausted', failures: 2 }, business: { ...a.business, ibanStatus: 'not_checked' } })) },

  // Outcomes
  { id: 'out-submitted', section: 'outcomes', title: 'Submitted', caption: 'Never shown as activated; the merchant account is set up after approval.', state: outcome('SUBMITTED') },
  { id: 'out-manual', section: 'outcomes', title: 'Manual verification', caption: 'Neutral: the team may contact the applicant.', state: outcome('MANUAL_VERIFICATION', 'FL') },
  { id: 'out-lead', section: 'outcomes', title: 'Sales lead', caption: 'Registered business outside the self-service band. No onboarding steps.', state: outcome('SALES_LEAD') },
  { id: 'out-existing', section: 'outcomes', title: 'Existing merchant', caption: 'Identity already belongs to a merchant account: no duplicate application.', state: outcome('EXISTING_MERCHANT') },
  { id: 'out-declined', section: 'outcomes', title: 'Agreement declined', caption: 'Not submitted; the application is kept.', state: outcome('CONTRACT_DECLINED') },

  // Validation / errors
  {
    id: 'val-entry', section: 'validation', title: 'Entry validation', caption: 'Missing and structurally invalid values. Structural checks are not government verification.',
    state: () => wrap({ ...initialApplication(1_760_000_000_000), entry: { type: 'CR', identifier: ['12345', '67890'].join(''), revenue: null, mobile: '412345678' } }),
    errors: { identifier: 'Enter a 10-digit Commercial Registration number that starts with 7.', revenue: 'Select your annual revenue.', mobile: 'Enter a Saudi mobile number: 9 digits starting with 5.' }
  },
  { id: 'val-otp', section: 'validation', title: 'Incorrect SMS code', caption: 'Remaining attempts shown; expiry and exhaustion need a new code.', state: () => wrap({ ...prefill('CR', 'otp'), verifiedMobile: '', otp: { status: 'incorrect', attemptsLeft: 2, code: '135790', resendAt: 0 } }) },
  { id: 'val-cr-missing', section: 'validation', title: 'CR not found', caption: 'Cannot continue; the applicant can edit the number.', state: show('CR', 'cr-verify', 'cr-verify', (a) => ({ ...a, cr: { status: 'not_found', tries: 1, record: null } })) },
  { id: 'val-provider', section: 'validation', title: 'Provider unavailable', caption: 'Bounded retry, progress kept, nothing invented.', state: show('CR', 'cr-verify', 'cr-verify', (a) => ({ ...a, cr: { status: 'unavailable', tries: 1, record: null } })) },
  { id: 'val-iban', section: 'validation', title: 'IBAN not matched', caption: 'Two attempts, then the applicant continues unverified (financial review).', state: show('CR', 'review', 'business', (a) => ({ ...a, business: { ...a.business, ibanStatus: 'failed', ibanFailures: 1, ibanLast: 'mismatch', bankName: '' } })) }
];
