/**
 * External copy (shown to applicants) and internal labels (Prototype Controls, boards, docs).
 * External outcomes never reveal internal regulatory or risk classifications; reason codes stay internal.
 */
import { GOV_RULES } from './government';
import type { Flag, InternalStatus, OutcomeKind, ReasonCode } from './types';

export const OUTCOME_COPY: Record<OutcomeKind, { title: string; body: string; tone: 'success' | 'neutral' | 'warning' }> = {
  SUBMITTED: {
    title: 'Your application has been submitted successfully.',
    body: 'Our team will review your application and contact you if anything else is required.',
    tone: 'success'
  },
  SUBMITTED_BANKING_PENDING: {
    title: 'Your application has been submitted.',
    body: 'Your details are complete. One step remains: a bank account linked to your Freelancer Certificate. Our team will contact you to explain what to do.',
    tone: 'success'
  },
  MANUAL_VERIFICATION: {
    title: 'We have received your application.',
    body: 'Our team will verify a few details and may contact you.',
    tone: 'neutral'
  },
  SALES_LEAD: {
    title: 'Thank you for your interest in Madfu. Our team will contact you.',
    body: 'We have received your details.',
    tone: 'neutral'
  },
  FL_CERT_REQUIRED: {
    title: 'A Freelancer Certificate is required to continue.',
    body: 'We have received your information. Our team may contact you about the next steps.',
    tone: 'neutral'
  },
  NOT_ELIGIBLE: {
    title: 'We can’t onboard this business online at the moment.',
    body: 'Thank you for your interest in Madfu.',
    tone: 'warning'
  },
  TEMPORARILY_NOT_ELIGIBLE: {
    title: 'We can’t onboard this business yet.',
    body: 'Thank you for your interest in Madfu.',
    tone: 'warning'
  },
  EXISTING_MERCHANT: {
    title: 'This business already has a Madfu account.',
    body: 'Sign in to your merchant account to manage it. No new application was created.',
    tone: 'warning'
  },
  DUPLICATE_IDENTITY: {
    title: 'An application already exists for these details.',
    body: 'Continue it with the mobile number it was started with, or contact Madfu support. No new application was created.',
    tone: 'warning'
  },
  CONTRACT_DECLINED: {
    title: 'You declined the contract.',
    body: 'Your application has not been submitted. Your details are saved, and you can return to the contract.',
    tone: 'warning'
  }
};

/** User-facing reason lines. Deliberately generic: no internal regulatory or risk wording. */
export const REASON_USER_COPY: Partial<Record<ReasonCode, string>> = {
  CATEGORY_NOT_SUPPORTED: 'This business category is not currently supported.',
  REGULATORY_RESTRICTION: 'This business configuration cannot currently be onboarded.',
  ACTIVITY_REQUIRES_CR: 'This activity requires a registered business with a Commercial Registration.',
  CHANNEL_NOT_SUPPORTED: 'This business configuration cannot currently be onboarded.',
  ACTIVITY_REGULATED: 'This business configuration cannot currently be onboarded.',
  CR_SUSPENDED: 'This business configuration cannot currently be onboarded.',
  CATEGORY_PAUSED: 'We are not onboarding this category online right now. Please try again later.',
  CR_TOO_RECENT: `Your Commercial Registration was issued recently. You can apply once it is more than ${GOV_RULES.minCrAgeMonths} months old.`
};

export const STATUS_LABEL: Record<InternalStatus, string> = {
  QUALIFICATION_DRAFT: 'Qualification (KYB) draft — no application yet',
  DRAFT: 'Draft application',
  LEAD_LOW_REVENUE: 'Lead · CR below SAR 100K (Business Team rejects under the proposed policy)',
  LEAD_HIGH_REVENUE: 'Sales lead · CR above SAR 20M',
  LEAD_FL_CERT_REQUIRED: 'Lead · Freelancer certificate required',
  LEAD_FL_CERT_NOT_FOUND: 'Lead · no active Freelancer certificate found',
  NOT_ELIGIBLE: 'Not eligible',
  TEMPORARILY_NOT_ELIGIBLE: 'Temporarily not eligible',
  EXISTING_MERCHANT: 'Existing merchant · no new application',
  DUPLICATE_IDENTITY: 'Duplicate identity · no new application',
  SUBMITTED: 'Submitted · under review',
  SUBMITTED_BANKING_PENDING: 'Submitted · banking setup required',
  SUBMITTED_MANUAL_VERIFICATION: 'Manual verification',
  CONTRACT_DECLINED: 'Contract declined · not submitted'
};

export const REASON_LABEL: Record<ReasonCode, string> = {
  OK: 'No restriction',
  CATEGORY_NOT_SUPPORTED: 'Category blocked / restricted',
  REGULATORY_RESTRICTION: 'Regulatory prohibition',
  ACTIVITY_REQUIRES_CR: 'Activity requires a CR',
  CHANNEL_NOT_SUPPORTED: 'Channel not allowed for this applicant type',
  CATEGORY_PAUSED: 'Category temporarily paused',
  CATEGORY_MANUAL_REVIEW: 'Category needs manual business review',
  FL_CERT_REQUIRED: 'Freelancer certificate required',
  REVENUE_BELOW_BAND: 'CR revenue below the self-service band',
  REVENUE_ABOVE_BAND: 'CR revenue above the self-service band',
  CR_TOO_RECENT: `CR age ${GOV_RULES.minCrAgeMonths} months or less`,
  CR_EXPIRED: 'CR expired',
  CR_SUSPENDED: 'CR suspended',
  CR_GOVERNMENT_VIOLATION: 'Government violation / restriction',
  ACTIVITY_REGULATED: 'Registered activity is not eligible (regulated)'
};

export const FLAG_LABEL: Record<Flag, string> = {
  CATEGORY_MANUAL_REVIEW: 'Category needs business review',
  ADDITIONAL_DOCUMENTS_REQUIRED: 'Additional documents required later (near go-live)',
  NATIONAL_ADDRESS_MISSING: 'National Address missing',
  NATIONAL_ADDRESS_EXPIRED: 'National Address expired',
  ACTIVITY_AMBIGUOUS: 'Category ↔ activity ambiguous',
  ACTIVITY_UNMAPPED: 'Activity not in the mapping',
  ACTIVITY_CONFLICT_REVIEW: 'Category ↔ activity conflict: team to confirm',
  NO_ELIGIBLE_PERSON: 'No eligible individual on the CR',
  NAFATH_UNVERIFIED: 'Identity / authority not verified with Nafath',
  IBAN_UNVERIFIED: 'IBAN ownership not verified (financial review)',
  BANKING_SETUP_REQUIRED: 'Banking setup required (Freelancer bank not linked)',
  COMMERCIAL_PRICING_REVIEW: 'Commercial pricing review requested',
  CERTIFICATE_INCONSISTENT: 'Certificate data inconsistent'
};
