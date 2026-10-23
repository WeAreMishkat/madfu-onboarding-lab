/**
 * Screen snapshots for the wireframes PDF. Each state is produced by running the SAME transitions the
 * prototype runs on a scenario, then rendered with the same step components.
 */
import { DEMO, DEMO_SMS_CODE } from '../model/mock';
import { scenarioById } from '../model/scenarios';
import {
  acceptContract, continueFromReview, declineContract, finishIbanCheck, initialState, loadCertificates, loadPersons, nafathResult, prefill,
  runCrVerification, setBankLinked, setIdentity, setLead, startEdit, startIbanCheck, startNafath, submitApplication, submitIdentify, submitKyb,
  submitLead, verifyOtp, withSaved
} from '../model/state';
import type { ProposedState } from '../model/types';
import { URL_ERROR_COPY } from '../model/urls';

export type SnapshotSection = 'kyb' | 'identify' | 'cr' | 'fl' | 'banking' | 'commercial' | 'review' | 'contract' | 'validation';

export interface Snapshot {
  id: string;
  section: SnapshotSection;
  title: string;
  caption: string;
  state: () => ProposedState;
  errors?: Record<string, string>;
}

const sc = (id: string) => scenarioById(id)!.build();
const otp = (s: ProposedState) => verifyOtp(s, DEMO_SMS_CODE);
const lead = (id: string) => setLead(submitKyb(sc(id)), { name: 'Sara Al-Harbi (demo)', mobile: DEMO.mobile });

export const SNAPSHOTS: Snapshot[] = [
  // Stage 1
  { id: 'kyb-empty', section: 'kyb', title: 'Know Your Business', caption: 'The first page. No CR, National ID, mobile or OTP. Eligibility is checked before anything is verified.', state: () => initialState() },
  { id: 'kyb-both', section: 'kyb', title: 'Know Your Business: Both channels', caption: 'Online needs a website (no social media / WhatsApp); offline needs a Google Maps link. Both: both.', state: () => sc('kyb-cr-both') },
  { id: 'kyb-fl', section: 'kyb', title: 'Freelancer without certificate', caption: 'A valid answer, not a dead end: becomes a lead with its KYB answers.', state: () => sc('kyb-fl-no-cert') },
  { id: 'lead', section: 'kyb', title: 'Lead contact', caption: 'Name and mobile, then SMS OTP. No verification screens.', state: () => lead('kyb-fl-no-cert') },
  { id: 'out-fl-cert', section: 'kyb', title: 'Outcome: certificate required (lead)', caption: 'Information received; Sales / team may contact. Internal: LEAD_FL_CERT_REQUIRED.', state: () => otp(submitLead(lead('kyb-fl-no-cert'))) },
  { id: 'out-sales', section: 'kyb', title: 'Outcome: Sales lead', caption: 'Registered business above SAR 20M (or below SAR 100K: Business Team rejects under the proposed policy).', state: () => otp(submitLead(lead('submit-lead'))) },
  { id: 'out-not-eligible', section: 'kyb', title: 'Outcome: not eligible', caption: 'Stopped before any external cost. User sees a generic reason; the reason code stays internal.', state: () => submitKyb(sc('kyb-fl-cr-required')) },

  // Stage 2
  { id: 'identify', section: 'identify', title: 'Identify & Verify', caption: 'Only after eligibility. CR / Unified Number (or National ID) + mobile. Duplicate checks run in the backend.', state: () => setIdentity(submitKyb(sc('kyb-cr-online')), { identifier: DEMO.cr, mobile: DEMO.mobile }) },
  { id: 'otp', section: 'identify', title: 'SMS OTP', caption: 'After the code the Application is created and the Stage-1 snapshot is linked to it.', state: () => submitIdentify(setIdentity(submitKyb(sc('kyb-cr-online')), { identifier: DEMO.cr, mobile: DEMO.mobile })) },
  { id: 'resume-otp', section: 'identify', title: 'Continue Application link → OTP', caption: 'The link identifies the application; the code opens it. Nothing else is re-asked or re-verified.', state: () => sc('resume-cr') },
  { id: 'out-duplicate', section: 'identify', title: 'Outcome: duplicate identity', caption: 'Application exists for this CR under another mobile: no new application.', state: () => otp(submitIdentify(sc('id-dup-cr'))) },

  // Stage 3 — registered business
  { id: 'cr-ok', section: 'cr', title: 'Business verification', caption: 'Government data retrieved once and reused. Registered activity matches the declared category.', state: () => runCrVerification(sc('act-match')) },
  { id: 'cr-conflict', section: 'cr', title: 'Category ↔ activity conflict', caption: 'Does not pass silently: change the category, or continue and the team confirms (no automatic contract).', state: () => runCrVerification(sc('act-conflict')) },
  { id: 'cr-persons', section: 'cr', title: 'Authorised person', caption: 'Individuals only, masked. Single selection.', state: () => loadPersons(withSaved(prefill('CR', 'persons'))) },
  { id: 'cr-nafath', section: 'cr', title: 'Nafath request', caption: 'Identity and authority, not the contract. Two attempts per application, shared across people.', state: () => startNafath(sc('nafath-ok')) },
  { id: 'cr-nafath-fail', section: 'cr', title: 'Nafath first failure', caption: 'Retry, or choose another person; the counter is not reset.', state: () => nafathResult(startNafath(sc('nafath-fail-once')), 'rejected') },
  { id: 'out-temp', section: 'cr', title: 'Outcome: temporarily not eligible', caption: 'CR 3 months old or less (configurable).', state: () => runCrVerification(sc('gov-young')) },
  { id: 'out-gov-manual', section: 'cr', title: 'Outcome: manual verification (government status)', caption: 'Expired CR or government violation: no automatic onboarding.', state: () => runCrVerification(sc('gov-expired')) },

  // Stage 3 — Freelancer
  { id: 'fl-nafath', section: 'fl', title: 'Freelancer Nafath', caption: 'National ID from Stage 2.', state: () => nafathResult(startNafath(otp(sc('resume-link'))), 'verified') },
  { id: 'fl-certs', section: 'fl', title: 'Freelancer certificates', caption: 'Retrieved, never uploaded. Zero documents. Expired / already linked cannot be selected.', state: () => loadCertificates(sc('fl-certs-multi')) },
  { id: 'out-fl-no-cert', section: 'fl', title: 'Outcome: no certificate found', caption: 'No upload fallback: "certificate required" lead.', state: () => loadCertificates(sc('fl-no-cert')) },

  // Stage 4
  { id: 'cr-business', section: 'banking', title: 'Business & Banking: registered business', caption: 'Stage-1 answers shown, not asked. IBAN ownership against the business; VAT retrieved.', state: () => finishIbanCheck(startIbanCheck(sc('iban-ok'))) },
  { id: 'fl-bank-q', section: 'banking', title: 'Business & Banking: Freelancer', caption: 'Is the bank account linked to the Freelancer Certificate?', state: () => sc('fl-bank-yes') },
  { id: 'fl-bank-no', section: 'banking', title: 'Freelancer: bank not linked', caption: 'IBAN skipped; journey continues; internal "banking setup required".', state: () => setBankLinked(sc('fl-bank-no'), 'no') },

  // Stage 5
  { id: 'commercial', section: 'commercial', title: 'Commercial Offer', caption: 'Primary path: standard offer → Continue. 3 / 4 months included, 6 / 9 / 12 optional; the better-offer question is collapsed and optional. Synthetic values.', state: () => sc('com-6') },
  { id: 'commercial-evidence', section: 'commercial', title: 'Commercial Offer: better offer expanded', caption: 'Shown only after "Yes, tell me more". Optional documents; onboarding continues with the standard offer while Commercial reviews.', state: () => sc('com-upload') },

  // Stage 6
  { id: 'review', section: 'review', title: 'Review', caption: 'Every section has Edit and returns here. Verification status shown.', state: () => sc('edit-website') },
  { id: 'review-edit', section: 'review', title: 'Edit from Review', caption: 'Edit Know Your Business: Cancel restores; Save re-evaluates internally, no provider call.', state: () => startEdit(sc('edit-website'), 'kyb') },

  // Stage 7 / 8
  { id: 'contract', section: 'contract', title: 'Contract', caption: 'Contract only, one action: Agree & Submit records acceptance and submits. No checkbox, no second Submit. Commission and plans appear as Schedule 1.', state: () => sc('contract-accept') },
  { id: 'out-submitted', section: 'contract', title: 'Outcome: submitted', caption: 'Shown immediately after Agree & Submit. Minimal; never shown as activated.', state: () => submitApplication(acceptContract(sc('contract-accept'))) },
  { id: 'out-banking', section: 'contract', title: 'Outcome: submitted, banking pending', caption: 'Freelancer without a linked bank account.', state: () => submitApplication(acceptContract(sc('submit-banking'))) },
  { id: 'out-manual', section: 'contract', title: 'Outcome: manual verification', caption: 'Nafath not verified: submitted without contract.', state: () => continueFromReview(sc('submit-manual')) },
  { id: 'out-declined', section: 'contract', title: 'Outcome: contract declined', caption: 'Not submitted; resumable at the contract.', state: () => declineContract(sc('contract-decline')) },

  // Validation
  { id: 'val-social', section: 'validation', title: 'Website validation', caption: 'Social-media and WhatsApp links are rejected as the merchant website (format check only).', state: () => sc('kyb-social-website'), errors: { websiteUrl: URL_ERROR_COPY.social } },
  { id: 'val-maps', section: 'validation', title: 'Google Maps validation', caption: 'Only Google Maps location links are accepted for offline sellers.', state: () => sc('kyb-bad-maps'), errors: { mapsUrl: URL_ERROR_COPY['not-maps'] } },
  { id: 'val-otp', section: 'validation', title: 'Incorrect SMS code', caption: 'Remaining attempts shown; expiry and exhaustion need a new code.', state: () => sc('x-otp-errors') },
  { id: 'val-iban', section: 'validation', title: 'IBAN not matched', caption: 'Two attempts, then the applicant continues unverified (financial review).', state: () => finishIbanCheck(startIbanCheck(sc('iban-fail'))) }
];
