/**
 * Screen snapshots for the wireframes PDF. Each state is produced by running the SAME transitions the
 * prototype runs on a scenario, then rendered with the same step components.
 */
import { DEMO, DEMO_SMS_CODE } from '../model/mock';
import { scenarioById } from '../model/scenarios';
import {
  agreeAndSubmit, continueFromReview, finishIbanCheck, initialState, loadCertificates, nafathResult, runBusinessVerification,
  runCertificatePrecheck, sendToNafath, setIban, setIdentity, setPresence, startEdit, startIbanCheck, startMobileChange, submitIdentify, submitKyb, verifyOtp
} from '../model/state';
import type { ProposedState } from '../model/types';
import { URL_ERROR_COPY } from '../model/urls';

export type SnapshotSection = 'kyb' | 'identify' | 'cr' | 'fl' | 'details' | 'commercial' | 'review' | 'contract' | 'validation';

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
const sent = (id: string) => submitIdentify(sc(id));
const salesAtIdentify = () => setIdentity(submitKyb(sc('kyb-cr-sales')), { identifier: DEMO.cr, mobile: DEMO.mobile });

export const SNAPSHOTS: Snapshot[] = [
  // Page 1
  { id: 'kyb-empty', section: 'kyb', title: 'Know Your Business', caption: 'Five questions. No CR, National ID, mobile, OTP or URL. Eligibility is checked before anything is verified.', state: () => initialState() },
  { id: 'kyb-filled', section: 'kyb', title: 'Know Your Business: filled in', caption: 'The channel is captured now; store links are asked later in Business Details.', state: () => sc('kyb-cr-both') },
  { id: 'out-blocked', section: 'kyb', title: 'Blocked on Page 1', caption: 'Personalised reason of the rule that applied; no OTP, no external cost.', state: () => submitKyb(sc('kyb-fl-cr-required')) },

  // Page 2 + routing
  { id: 'identify', section: 'identify', title: 'Identifier + mobile + prerequisite', caption: 'CR + mobile + "Are you an owner or manager registered on this CR?". An internal existence check runs on Send code.', state: () => sc('id-new-cr') },
  { id: 'identify-fl', section: 'identify', title: 'Freelancer: identifier + mobile + IBAN question', caption: '"Is your IBAN linked to your Freelancer Certificate?" — a cost-saving declaration; the linkage is verified later.', state: () => sc('id-new-fl') },
  { id: 'identify-sales', section: 'identify', title: 'Sales route: identifier + mobile only', caption: 'Above SAR 20M: no prerequisite question; after the code, the Sales thank-you.', state: salesAtIdentify },
  { id: 'otp-new', section: 'identify', title: 'OTP to the entered mobile', caption: 'New identifier. After the code the application is created (contact_mobile_verified).', state: () => sent('id-new-cr') },
  { id: 'otp-existing', section: 'identify', title: 'Application already in progress', caption: 'Code sent to the REGISTERED mobile ending •••123 — not to the newly entered number. Nothing about the application is shown before the code.', state: () => sent('id-incomplete') },
  { id: 'status', section: 'identify', title: 'Submitted application → Application Progress', caption: 'After the registered-mobile code. Review, Contract and re-submission are never reopened.', state: () => otp(sent('id-submitted')) },
  { id: 'login', section: 'identify', title: 'Existing merchant → login', caption: 'Account-mobile code, then the merchant login. No application is created.', state: () => otp(sent('id-live')) },
  { id: 'out-sales', section: 'identify', title: 'Outcome: Sales lead', caption: 'Lead persisted with the verified contact. No CR, Nafath, banking or contract.', state: () => otp(submitIdentify(salesAtIdentify())) },
  { id: 'out-not-owner', section: 'identify', title: 'Outcome: not an owner or manager', caption: 'Personalised reason; delegated onboarding is out of V1. No paid check was made.', state: () => otp(sent('id-cr-not-owner')) },

  // Registered business
  { id: 'cr-persons', section: 'cr', title: 'Business verification: owner / manager', caption: 'CR data and owners / managers retrieved in the backend; no separate CR page. Delegates and companies are not offered.', state: () => runBusinessVerification(sc('cr-business')) },
  { id: 'cr-nafath', section: 'cr', title: 'Send to Nafath', caption: 'The mobile ↔ National ID check runs first; then the Nafath request.', state: () => sc('mm-match') },
  { id: 'cr-mismatch', section: 'cr', title: 'Mobile does not belong to the selected owner', caption: '"Use another mobile number" → OTP → check again. CR data and progress are kept.', state: () => sendToNafath(sc('mm-mismatch')) },
  { id: 'cr-mismatch-entry', section: 'cr', title: 'Use another mobile number', caption: 'The new number receives its own code before the check runs again.', state: () => startMobileChange(sendToNafath(sc('mm-mismatch'))) },
  { id: 'cr-waiting', section: 'cr', title: 'Nafath request', caption: 'Identity only — not the contract. Two attempts per application.', state: () => sendToNafath(sc('mm-match')) },
  { id: 'out-paused', section: 'cr', title: 'Outcome: CR expired', caption: 'Saved and handed to Sales; no Refresh button and no further paid checks.', state: () => sc('cr-expired') },

  // Freelancer
  { id: 'fl-nafath', section: 'fl', title: 'Freelancer: Nafath', caption: 'The certificate pre-check already ran in the backend; the applicant sees Nafath first.', state: () => runCertificatePrecheck(sc('fl-nafath')) },
  { id: 'fl-certs', section: 'fl', title: 'Freelancer certificates', caption: 'Shown after Nafath; retrieved, never uploaded. Expired / already linked cannot be selected.', state: () => loadCertificates(sc('fl-certs-multi')) },
  { id: 'out-fl-no-cert', section: 'fl', title: 'Outcome: no certificate found', caption: 'Stopped before Nafath: certificate-required lead (no Nafath cost).', state: () => runCertificatePrecheck(sc('fl-no-cert')) },

  // Business details
  { id: 'details-cr', section: 'details', title: 'Business Details: registered business', caption: 'Online store and Google Maps branch link (channel Both). No IBAN, VAT or branch count.', state: () => sc('biz-cr-both') },
  { id: 'details-fl', section: 'details', title: 'Business Details: Freelancer', caption: 'Website and the IBAN linked to the certificate (verified).', state: () => finishIbanCheck(startIbanCheck(setIban(setPresence(sc('biz-fl'), { websiteUrl: 'studio.example.com' }), 'SA0080000000123456784821'))) },

  // Commercial
  { id: 'commercial', section: 'commercial', title: 'Your Standard Offer', caption: 'One rate from the verified category → Continue. No payment-plan selection.', state: () => sc('com-standard') },
  { id: 'commercial-review', section: 'commercial', title: 'Rate review requested', caption: 'Collapsed until clicked; uploads only after "Request rate review"; never blocks.', state: () => sc('com-upload') },

  // Review
  { id: 'review', section: 'review', title: 'Review', caption: 'Verified sections locked; store presence and the rate review open a transactional edit.', state: () => sc('review') },
  { id: 'review-edit', section: 'review', title: 'Edit store presence', caption: 'Draft until Save; Cancel restores everything; nothing invalidated.', state: () => startEdit(sc('review'), 'presence') },

  // Contract / submit
  { id: 'contract', section: 'contract', title: 'Contract', caption: 'One action: Agree & Submit. Standard commission only; no plans.', state: () => sc('contract') },
  { id: 'out-submitted', section: 'contract', title: 'Outcome: submitted', caption: 'Shown immediately after Agree & Submit. Returning later opens Application Progress.', state: () => agreeAndSubmit(sc('contract')) },
  { id: 'out-manual', section: 'contract', title: 'Outcome: manual verification', caption: 'Nafath not verified: submitted without a contract.', state: () => continueFromReview(sc('submit-manual')) },
  { id: 'status-action', section: 'contract', title: 'Application Progress: action required', caption: 'Status only; the team contacts the merchant.', state: () => sc('status-action') },

  // Validation
  { id: 'val-social', section: 'validation', title: 'Store link validation', caption: 'Social-media and WhatsApp links are not an online store (format check only).', state: () => setPresence(sc('biz-cr-both'), { websiteUrl: 'https://instagram.com/najd' }), errors: { websiteUrl: URL_ERROR_COPY.social } },
  { id: 'val-maps', section: 'validation', title: 'Google Maps validation', caption: 'Only Google Maps links to the selling location are accepted.', state: () => setPresence(sc('biz-cr-both'), { mapsUrl: 'https://example.com/our-location' }), errors: { mapsUrl: URL_ERROR_COPY['not-maps'] } },
  { id: 'val-otp', section: 'validation', title: 'Incorrect SMS code', caption: 'Remaining attempts shown; resends are bounded.', state: () => sc('otp-errors') },
  { id: 'val-nafath', section: 'validation', title: 'Nafath first failure', caption: 'One attempt left.', state: () => nafathResult(sendToNafath(sc('nafath-fail')), 'rejected') }
];
