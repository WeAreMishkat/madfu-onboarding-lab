/**
 * External copy (shown to applicants) and internal labels (Prototype Controls, boards, docs).
 * Blocked outcomes carry a PERSONALISED reason per rule; they never expose internal scoring, risk
 * levels, flags or reason codes.
 */
import { PREREQUISITE_QUESTION, REVENUE_RULE } from './config';
import type { Flag, Lifecycle, OutcomeKind, ReasonCode } from './types';

export const OUTCOME_COPY: Record<OutcomeKind, { title: string; body: string; tone: 'success' | 'neutral' | 'warning' }> = {
  SUBMITTED: {
    title: 'Your application has been submitted successfully.',
    body: 'Our team will review it and contact you if anything else is required. You can follow its progress at any time with your registered mobile number.',
    tone: 'success'
  },
  SUBMITTED_MANUAL: {
    title: 'We have received your application.',
    body: 'Our team will complete the remaining verification and may contact you. You can follow its progress with your registered mobile number.',
    tone: 'neutral'
  },
  SALES_LEAD: {
    title: 'Thank you. Our Sales team will contact you.',
    body: 'We have your business details and your verified contact number. Nothing else is needed from you now.',
    tone: 'success'
  },
  FL_CERT_REQUIRED: {
    title: 'A Freelancer Certificate is required to continue.',
    body: 'We have saved your details and your verified contact number. Once you have an active Freelancer Certificate, you can apply again.',
    tone: 'neutral'
  },
  BLOCKED: {
    title: 'We can’t continue your application online.',
    body: 'Thank you for your interest in Madfu.',
    tone: 'warning'
  },
  PAUSED_CR: {
    title: 'Your application is saved.',
    body: 'Please update your CR. We will transfer your application to our Sales team, who can help you continue onboarding.',
    tone: 'neutral'
  },
  CONTRACT_DECLINED: {
    title: 'You declined the contract.',
    body: 'Your application has not been submitted. Your details are saved, and you can return to the contract.',
    tone: 'warning'
  }
};

/** Personalised, merchant-facing reason per rule (blocked and paused outcomes). */
export const REASON_USER_COPY: Partial<Record<ReasonCode, { title?: string; text: string }>> = {
  CATEGORY_NOT_SUPPORTED: { text: 'Madfu does not currently support businesses in this category.' },
  REGULATORY_RESTRICTION: { text: 'Businesses in this category cannot be onboarded online because of regulatory requirements.' },
  ACTIVITY_REQUIRES_CR: { text: 'This activity requires a registered business with a Commercial Registration. You can apply as a registered business once you have a CR.' },
  CHANNEL_NOT_SUPPORTED: { text: 'Freelancers in this category can be onboarded only when they sell online.' },
  ACTIVITY_REGULATED: { text: 'Your registered business activity cannot be onboarded online because of regulatory requirements.' },
  NOT_OWNER_MANAGER: { text: 'Online self-onboarding is currently available only to the owners and managers registered on the Commercial Registration. Please ask an owner or manager to apply.' },
  NO_OWNER_MANAGER_ON_CR: { text: 'We could not find an owner or manager on this Commercial Registration who can apply online. Online self-onboarding is available only to the owners and managers registered on the CR.' },
  FL_IBAN_NOT_LINKED: { text: 'To onboard as a Freelancer, your bank account (IBAN) must be linked to your Freelancer Certificate. Link your account on the freelance platform, then apply again with the same National ID.' },
  FL_CERT_REQUIRED: { text: 'Online onboarding for Freelancers needs an active Freelancer Certificate.' },
  FL_CERT_NOT_FOUND: { text: 'We could not find an active Freelancer Certificate for your National ID.' },
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

export const STATUS_LABEL: Record<Lifecycle, string> = {
  QUALIFICATION: 'Qualification (Page 1 / Page 2) — no application yet',
  OTP_PENDING: 'OTP pending — no application yet',
  DRAFT: 'Draft application (self-onboarding in progress)',
  SALES_LEAD: 'Sales lead (contact verified, no onboarding data collected)',
  BLOCKED: 'Blocked (hard rule; personalised reason shown)',
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
  CATEGORY_NOT_SUPPORTED: 'Category blocked / blacklisted',
  REGULATORY_RESTRICTION: 'Regulatory prohibition',
  ACTIVITY_REQUIRES_CR: 'Activity requires a CR',
  CHANNEL_NOT_SUPPORTED: 'Channel not allowed for this applicant type',
  FL_CERT_REQUIRED: 'Freelancer without certificate (lead)',
  FL_CERT_NOT_FOUND: 'No usable Freelancer Certificate found (pre-check)',
  REVENUE_BELOW_BAND: `CR revenue below SAR ${REVENUE_RULE.selfServiceFromSar.toLocaleString('en-US')} (lead)`,
  REVENUE_ABOVE_BAND: `CR revenue above SAR ${REVENUE_RULE.salesAboveSar.toLocaleString('en-US')} (Sales lead)`,
  NOT_OWNER_MANAGER: `Declared "No" to: ${PREREQUISITE_QUESTION.CR}`,
  NO_OWNER_MANAGER_ON_CR: 'No individual owner / manager on the CR (declaration not confirmed)',
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
  CERTIFICATE_INCONSISTENT: 'Certificate data inconsistent'
};
