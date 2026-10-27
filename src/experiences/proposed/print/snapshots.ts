/**
 * Screen snapshots for the wireframes PDF. Each state is produced by running the SAME transitions the
 * prototype runs on a scenario, then rendered with the same step components.
 */
import { DEMO_SMS_CODE } from '../model/mock';
import { scenarioById } from '../model/scenarios';
import {
  agreeAndSubmit, continueFromReview, finishIbanCheck, initialState, loadCertificates, nafathResult, runBusinessVerification, sendToNafath, setIban,
  setPresence, startEdit, startIbanCheck, startMobileChange, submitIdentify, verifyOtp
} from '../model/state';
import type { ProposedState } from '../model/types';
import { URL_ERROR_COPY } from '../model/urls';

export type SnapshotSection = 'kyb' | 'identify' | 'cr' | 'fl' | 'details' | 'commercial' | 'review' | 'authorize' | 'signer' | 'contract' | 'validation';

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

export const SNAPSHOTS: Snapshot[] = [
  // Page 1
  { id: 'kyb-empty', section: 'kyb', title: 'Know Your Business', caption: 'Five questions. No CR, National ID, mobile, OTP or URL. Eligibility is decided internally and never shown.', state: () => initialState() },
  { id: 'kyb-filled', section: 'kyb', title: 'Know Your Business: filled in', caption: 'The channel is captured now; store links are asked later in Business Details.', state: () => sc('kyb-cr-both') },

  // Page 2 + routing
  { id: 'identify', section: 'identify', title: 'Identifier + mobile (registered business)', caption: 'CR + mobile. No owner / manager question: authorization is chosen after Review. An internal existence check runs on Send code.', state: () => sc('id-new-cr') },
  { id: 'identify-fl', section: 'identify', title: 'Freelancer: identifier + mobile + IBAN question', caption: '"Is your IBAN linked to your Freelancer Certificate?" — the linkage is verified later.', state: () => sc('id-new-fl') },
  { id: 'identify-unsupported', section: 'identify', title: 'Internally Not Eligible: neutral Page 2', caption: 'No "eligible" message and no question; nothing tells the applicant the internal result.', state: () => sc('id-unsupported-cr') },
  { id: 'otp-new', section: 'identify', title: 'OTP to the entered mobile', caption: 'New identifier. After the code the application is created (contact_mobile_verified).', state: () => sent('id-new-cr') },
  { id: 'out-not-eligible', section: 'identify', title: 'Internally Not Eligible → Application submitted', caption: 'Same page as a normal submission. Reason internal; the team contacts the applicant. No CR, Nafath, certificate, banking, offer or contract.', state: () => otp(sent('id-unsupported-cr')) },
  { id: 'out-no-cert', section: 'identify', title: 'Freelancer without certificate → Application submitted', caption: 'Identify + OTP first; no Page-1 stop, no reason shown.', state: () => otp(sent('id-fl-no-cert')) },
  { id: 'otp-existing', section: 'identify', title: 'Application already in progress', caption: 'A different mobile was entered: the code goes to the STORED mobile ending •••123 only. Nothing about the application is shown before the code.', state: () => sent('id-incomplete') },
  { id: 'resume-fl', section: 'identify', title: 'Freelancer resume', caption: 'After the stored-mobile code: the first unfinished Freelancer step (Nafath).', state: () => otp(sent('id-incomplete-fl')) },
  { id: 'status', section: 'identify', title: 'Submitted application → Application Progress', caption: 'After the stored-mobile code. Review, Contract and re-submission are never reopened.', state: () => otp(sent('id-submitted')) },
  { id: 'status-ne', section: 'identify', title: 'Captured earlier → Application Progress “Under review”', caption: 'An internally Not Eligible record looks like any application under review.', state: () => otp(sent('id-not-eligible')) },
  { id: 'login', section: 'identify', title: 'Existing live merchant → popup', caption: '"You already have an active account under this CR." Log in only on click; no application created.', state: () => otp(sent('id-live')) },

  // Registered business
  { id: 'cr-verify', section: 'cr', title: 'CR verification', caption: 'CR data and owners / managers retrieved in the backend; nothing to type; nobody chosen yet.', state: () => runBusinessVerification(sc('cr-business')) },
  { id: 'out-paused', section: 'cr', title: 'Outcome: CR expired', caption: 'Saved and handed to Sales; no Refresh button and no further paid checks.', state: () => sc('cr-expired') },

  // Freelancer
  { id: 'fl-certs', section: 'fl', title: 'Freelancer certificates (before Nafath)', caption: 'Retrieved by National ID, never uploaded. Expired / already linked cannot be selected.', state: () => loadCertificates(sc('fl-certs-multi')) },
  { id: 'fl-nafath', section: 'fl', title: 'Freelancer: Send to Nafath', caption: 'Mobile ↔ National ID first, then the Nafath request.', state: () => sc('fl-nafath') },
  { id: 'fl-waiting', section: 'fl', title: 'Nafath request', caption: 'Identity only — not the contract. Two attempts.', state: () => sendToNafath(sc('fl-nafath')) },
  { id: 'fl-mismatch', section: 'fl', title: 'Mobile not registered to the National ID', caption: '"Use another mobile number" → OTP → check again. Progress is kept.', state: () => sendToNafath(sc('fl-mismatch')) },
  { id: 'fl-mismatch-entry', section: 'fl', title: 'Use another mobile number', caption: 'The new number receives its own code before the check runs again.', state: () => startMobileChange(sendToNafath(sc('fl-mismatch'))) },

  // Business details
  { id: 'details-cr', section: 'details', title: 'Business Details: registered business', caption: 'Online store and Google Maps branch link (channel Both). No IBAN, VAT or branch count.', state: () => sc('biz-cr-both') },
  { id: 'details-fl', section: 'details', title: 'Business Details: Freelancer', caption: 'Website and the IBAN linked to the certificate (verified).', state: () => finishIbanCheck(startIbanCheck(setIban(setPresence(sc('biz-fl'), { websiteUrl: 'studio.example.com' }), 'SA0080000000123456784821'))) },

  // Commercial
  { id: 'commercial', section: 'commercial', title: 'Your Standard Offer', caption: 'One rate from the verified category → Continue. No payment-plan selection. Preparer only.', state: () => sc('com-standard') },
  { id: 'commercial-review', section: 'commercial', title: 'Rate review requested', caption: 'Collapsed until clicked; uploads only after "Request rate review"; never blocks.', state: () => sc('com-upload') },

  // Review
  { id: 'review', section: 'review', title: 'Review', caption: 'Verified sections locked; store presence and the rate review open a transactional edit; then the Authorization choice.', state: () => sc('review') },
  { id: 'review-edit', section: 'review', title: 'Edit store presence', caption: 'Draft until Save; Cancel restores everything; nothing invalidated.', state: () => startEdit(sc('review'), 'presence') },

  // Authorization (CR)
  { id: 'auth-choice', section: 'authorize', title: 'Who will authorize and sign?', caption: 'After Review: myself, or send to another signer. Delegated signatory shown as Phase 2.', state: () => sc('auth-choice') },
  { id: 'auth-self', section: 'authorize', title: 'Self authorization', caption: 'Select yourself among the owners / managers on the CR → Nafath → Contract.', state: () => sc('auth-self') },
  { id: 'auth-signer', section: 'authorize', title: 'Send to another signer', caption: 'One owner / manager on the CR + their primary Nafath mobile → Send Authorization.', state: () => sc('auth-signer') },
  { id: 'cr-nafath', section: 'authorize', title: 'Self authorization: Nafath', caption: 'The mobile ↔ National ID check runs first; then the Nafath request.', state: () => sendToNafath(sc('mm-match')) },
  { id: 'cr-mismatch', section: 'authorize', title: 'Mobile does not belong to the selected owner', caption: '"Use another mobile number" → OTP → check again, or change who authorizes.', state: () => sendToNafath(sc('mm-mismatch')) },
  { id: 'handoff', section: 'authorize', title: 'Waiting for authorization (preparer)', caption: 'Frozen application and offer; status only; signer / mobile change is Phase 2.', state: () => sc('handoff-active') },
  { id: 'handoff-expired', section: 'authorize', title: 'Authorization expired', caption: 'Link dead after 7 days (configurable); same application; a new version may start.', state: () => sc('handoff-expired') },
  { id: 'handoff-limit', section: 'authorize', title: 'Handoff limit reached', caption: 'Two versions in 30 days: a third needs an internal unlock.', state: () => sc('handoff-limit') },
  { id: 'delegation', section: 'authorize', title: 'Delegated signatory (Phase 2 demo)', caption: 'MOJ delegation or document review before Nafath. Not Phase 1 behaviour.', state: () => sc('delegation-demo') },

  // Signer
  { id: 'signer-link', section: 'signer', title: 'Signer: secure link', caption: 'No OTP. Masked request only — business, first + last name, masked ID and mobile. Nothing else before Nafath.', state: () => sc('signer-link') },
  { id: 'signer-nafath', section: 'signer', title: 'Signer: Nafath', caption: 'Mobile ↔ National ID for the handoff mobile, then Nafath.', state: () => sc('signer-nafath') },
  { id: 'signer-review', section: 'signer', title: 'Signer: read-only Review', caption: 'Full application and frozen offer; nothing editable; no send-back.', state: () => sc('signer-review') },
  { id: 'signer-contract', section: 'signer', title: 'Signer: Contract', caption: 'Agree & Sign submits the application.', state: () => sc('signer-contract') },
  { id: 'signer-done', section: 'signer', title: 'Signer: submitted', caption: 'Authorization completed; the preparer sees Application Progress.', state: () => agreeAndSubmit(sc('signer-contract')) },
  { id: 'signer-expired', section: 'signer', title: 'Signer: expired link', caption: 'The link no longer works; nothing about the application is shown.', state: () => sc('signer-link-expired') },

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
