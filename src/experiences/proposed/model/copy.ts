/**
 * External copy (shown to applicants) and internal labels (Prototype Controls, boards, docs).
 *
 * NOT ELIGIBLE IS INTERNAL ONLY. An applicant who is not eligible sees the normal "Application
 * submitted" page and, later, "Under review" — never Rejected, Blacklisted, Blocked, "Not eligible" or
 * a reason. The reason code stays in the internal record; the team contacts the applicant and explains
 * it manually. Merchant copy never exposes scoring, risk levels, flags or reason codes.
 */
import { PREREQUISITE_QUESTION } from './config';
import type { AuthEndReason, AuthStatus, DelegationStatus, DelegationType, Flag, Lifecycle, OutcomeKind, ReasonCode, RiskDecision } from './types';

const SUBMITTED_PAGE = {
  title: 'Your application has been submitted successfully.',
  body: 'Our team will review it and contact you if anything else is required. You can follow its progress at any time with your registered mobile number.'
};

export const OUTCOME_COPY: Record<OutcomeKind, { title: string; body: string; tone: 'success' | 'neutral' | 'warning' }> = {
  SUBMITTED: { ...SUBMITTED_PAGE, tone: 'success' },
  SUBMITTED_MANUAL: {
    title: 'We have received your application.',
    body: 'Our team will complete the remaining verification and may contact you. You can follow its progress with your registered mobile number.',
    tone: 'neutral'
  },
  // Internally Not Eligible: deliberately the SAME page as a normal submission.
  RECEIVED: { ...SUBMITTED_PAGE, tone: 'success' },
  PAUSED_CR: {
    title: 'Your application is saved.',
    body: 'Please update your CR. We will transfer your application to our Sales team, who can help you continue onboarding.',
    tone: 'neutral'
  }
};

/** The signer's end page after Agree & Sign. */
export const SIGNER_DONE_COPY = {
  title: 'Thank you. The application is signed and submitted.',
  body: 'Madfu will review the application. The applicant can follow its progress with their registered mobile number.'
};

/**
 * Merchant-facing copy for CONTROLLED states only (expired / suspended / restricted CR). Not Eligible
 * reasons have no merchant copy on purpose: they are never shown.
 */
export const REASON_USER_COPY: Partial<Record<ReasonCode, { title?: string; text: string }>> = {
  CR_EXPIRED: { title: 'Your Commercial Registration is currently expired.', text: 'Please update your CR. We will transfer your application to our Sales team, who can help you continue onboarding.' },
  CR_SUSPENDED: { title: 'Your Commercial Registration is currently suspended.', text: 'Please update your CR. We will transfer your application to our Sales team, who can help you continue onboarding.' },
  CR_RESTRICTED: { title: 'Your Commercial Registration currently has a restriction.', text: 'Please resolve it with the issuing authority. We will transfer your application to our Sales team, who can help you continue onboarding.' }
};

/** Application Progress page (submitted applications). No SLA or approval rule is invented. */
export const STATUS_COPY: Partial<Record<Lifecycle, { title: string; body: string }>> = {
  SUBMITTED: { title: 'Submitted', body: 'Your application has been submitted. Our team will start the review.' },
  UNDER_REVIEW: { title: 'Under review', body: 'Our team is reviewing your application.' },
  ACTION_REQUIRED: { title: 'Action required', body: 'Our team needs something from you. We will contact you on your registered mobile number with the details.' },
  APPROVED: { title: 'Approved', body: 'Your application is approved. We will send you the next steps to set up your merchant account.' },
  UNABLE_TO_PROCEED: { title: 'Unable to proceed', body: 'We are unable to proceed with your application at this time. Our team will contact you.' }
};
export const STATUS_TRACK: Lifecycle[] = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'];

/** What the merchant sees for an internal lifecycle: an internally Not Eligible application is "Under review". */
export const customerStatus = (status: Lifecycle): Lifecycle => (status === 'NOT_ELIGIBLE' ? 'UNDER_REVIEW' : status);

export const STATUS_LABEL: Record<Lifecycle, string> = {
  QUALIFICATION: 'Qualification (Page 1 / Page 2) — no application yet',
  OTP_PENDING: 'OTP pending — no application yet',
  DRAFT: 'Draft application (self-onboarding in progress)',
  AWAITING_AUTHORIZATION: 'Awaiting authorization — application frozen, signer handoff exists',
  NOT_ELIGIBLE: 'Not Eligible (INTERNAL) — merchant sees Application submitted / Under review; team contacts them',
  PAUSED_CR: 'Paused — CR expired / suspended; saved and handed to Sales',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  ACTION_REQUIRED: 'Action required',
  APPROVED: 'Approved (not yet live)',
  UNABLE_TO_PROCEED: 'Unable to proceed',
  LIVE: 'Live merchant (account exists)'
};

export const REASON_LABEL: Record<ReasonCode, string> = {
  OK: 'No restriction',
  CATEGORY_NOT_SUPPORTED: 'Category not supported (blacklisted)',
  REGULATORY_RESTRICTION: 'Regulatory prohibition',
  ACTIVITY_REQUIRES_CR: 'Activity requires a CR',
  CHANNEL_NOT_SUPPORTED: 'Channel not allowed for this applicant type',
  FL_CERT_REQUIRED: 'Freelancer without certificate',
  FL_CERT_NOT_FOUND: 'No usable Freelancer Certificate found',
  NO_OWNER_MANAGER_ON_CR: 'No individual owner / manager on the CR (nobody can authorize in V1)',
  FL_IBAN_NOT_LINKED: `Declared "No" to: ${PREREQUISITE_QUESTION.FL_CERT}`,
  ACTIVITY_REGULATED: 'Verified government activity is not eligible',
  CR_EXPIRED: 'CR expired',
  CR_SUSPENDED: 'CR suspended',
  CR_RESTRICTED: 'CR restricted (provisional route)'
};

export const FLAG_LABEL: Record<Flag, string> = {
  ADDITIONAL_DOCUMENTS_REQUIRED: 'Additional documents required later (near go-live)',
  NATIONAL_ADDRESS_MISSING: 'National Address missing',
  NATIONAL_ADDRESS_EXPIRED: 'National Address expired',
  CATEGORY_RECLASSIFIED: 'Category reclassified from the government activity',
  ACTIVITY_UNMAPPED: 'Government activity not in the mapping (declared category kept provisionally)',
  NAFATH_UNVERIFIED: 'Identity not verified with Nafath',
  MOBILE_OWNERSHIP_UNVERIFIED: 'Mobile ↔ National ID not confirmed: verification paused',
  SALES_FOLLOW_UP: 'Sales / manual follow-up',
  COMMERCIAL_RATE_REVIEW_REQUESTED: 'Commercial rate review requested',
  CERTIFICATE_INCONSISTENT: 'Certificate data inconsistent',
  AUTHORIZATION_LIMIT_REACHED: 'Signer handoff limit reached in the control window: internal unlock needed'
};

/* ------------------------------------------------------------------ authorization (CR signer handoff) */

export const AUTH_STATUS_LABEL: Record<AuthStatus, string> = {
  NOT_STARTED: 'Not started',
  HANDOFF_CREATED: 'Handoff created',
  AWAITING_SIGNER: 'Awaiting signer',
  NAFATH_PENDING: 'Nafath pending',
  NAFATH_VERIFIED: 'Nafath verified',
  CONTRACT_PENDING: 'Contract pending',
  COMPLETED: 'Completed',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled'
};

export const AUTH_END_LABEL: Record<AuthEndReason, string> = {
  EXPIRED: 'Link expired before signing',
  SIGNER_MOBILE_MISMATCH: 'Signer mobile not registered to the signer’s National ID',
  SIGNER_NAFATH_FAILED: 'Signer Nafath not completed (attempts used)'
};

/**
 * What the PREPARER sees after a handoff. Configuration, not screen logic: the final Phase-1 status
 * list is still to be defined (OD-17), so each internal status maps to a display bucket here.
 */
export const PREPARER_AUTH_VIEW: Record<AuthStatus, { label: string; tone: 'progress' | 'success' | 'attention'; body: string }> = {
  NOT_STARTED: { label: 'Not started', tone: 'progress', body: 'Choose who will authorize and sign the application.' },
  HANDOFF_CREATED: { label: 'In progress', tone: 'progress', body: 'We are sending the authorization link to the signer.' },
  AWAITING_SIGNER: { label: 'In progress', tone: 'progress', body: 'We sent a secure link to the signer by SMS. They verify with Nafath, review the application and sign.' },
  NAFATH_PENDING: { label: 'In progress', tone: 'progress', body: 'The signer opened the link and is verifying their identity.' },
  NAFATH_VERIFIED: { label: 'In progress', tone: 'progress', body: 'The signer verified their identity and is reviewing the application.' },
  CONTRACT_PENDING: { label: 'In progress', tone: 'progress', body: 'The signer is reviewing the contract.' },
  COMPLETED: { label: 'Approved', tone: 'success', body: 'The signer signed and the application is submitted.' },
  EXPIRED: { label: 'Expired', tone: 'attention', body: 'The authorization link expired before it was signed. Your application is saved.' },
  CANCELLED: { label: 'Not completed', tone: 'attention', body: 'The authorization could not be completed online. Your application is saved; our team will contact you.' }
};

/* ------------------------------------------------------------------ delegated signer (PHASE 2, demo only) */

export const DELEGATION_LABEL: Record<DelegationType, { title: string; detail: string; review: 'automatic' | 'manual' }> = {
  MOJ: { title: 'Ministry of Justice official delegation', detail: 'Verified automatically with the Ministry of Justice.', review: 'automatic' },
  COMPANY_DOC: { title: 'Official company / commercial delegation document', detail: 'Uploaded and reviewed manually by Quality.', review: 'manual' },
  OTHER_DOC: { title: 'Other official delegation document', detail: 'Uploaded and reviewed manually by Quality.', review: 'manual' }
};

export const DELEGATION_STATUS_COPY: Record<DelegationStatus, string> = {
  idle: 'Not started',
  valid: 'Delegation verified — the signer continues to Nafath, then the contract.',
  invalid: 'The delegation could not be verified. The authorization stops here.',
  under_review: 'Delegation under Quality review. Nobody needs to stay online: when it is approved, the signer receives a link to continue.',
  approved: 'Approved by Quality — the signer receives a continuation link → Nafath → Contract.',
  rejected: 'Not approved by Quality. The authorization stops here.'
};

/* ------------------------------------------------------------------ risk decision (illustrative) */

export const RISK_DECISION_LABEL: Record<RiskDecision, string> = {
  PROCEED_FULLY: 'Proceed fully',
  PROCEED_CONTROLLED: 'Proceed controlled',
  HOLD: 'Hold'
};
