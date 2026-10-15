/**
 * External copy (shown to applicants) and internal labels (Prototype Controls, PDF). External
 * outcomes never reveal internal reasons.
 */
import type { InternalStatus, OutcomeKind, ReviewFlag } from './types';

export const OUTCOME_COPY: Record<OutcomeKind, { title: string; body: string; tone: 'success' | 'neutral' | 'warning' }> = {
  SUBMITTED: {
    title: 'Your application has been submitted successfully.',
    body: 'We are reviewing it now and will contact you about the next steps. Your merchant account is set up only after approval.',
    tone: 'success'
  },
  MANUAL_VERIFICATION: {
    title: 'We have received your application.',
    body: 'Our team will verify a few details and may contact you.',
    tone: 'neutral'
  },
  SALES_LEAD: {
    title: 'Thank you for your interest in Madfu. Our team will contact you.',
    body: 'We have saved your details.',
    tone: 'neutral'
  },
  CATEGORY_REVIEW: {
    title: 'Thank you for your interest in Madfu. Our team will contact you.',
    body: 'We have saved your details and will review them.',
    tone: 'neutral'
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
  ADDITIONAL_CERTIFICATE: {
    title: 'You already have a Madfu account.',
    body: 'Adding another freelance certificate will be available from your merchant account.',
    tone: 'warning'
  },
  CONTRACT_DECLINED: {
    title: 'You declined the agreement.',
    body: 'Your application has not been submitted. Your details are saved, and you can return to review the agreement.',
    tone: 'warning'
  }
};

export const STATUS_LABEL: Record<InternalStatus, string> = {
  DRAFT: 'Draft application',
  SALES_LEAD_LOW_REVENUE: 'Sales lead · CR below SAR 100K',
  SALES_LEAD_HIGH_REVENUE: 'Sales lead · CR above SAR 20M',
  CATEGORY_BLOCKED: 'Category restricted · neutral review',
  EXISTING_MERCHANT: 'Existing merchant · no new application',
  DUPLICATE_IDENTITY: 'Duplicate identity · no new application',
  ADDITIONAL_CERTIFICATE_PENDING: 'Existing Freelancer · additional certificate (future account flow)',
  SUBMITTED: 'Submitted · under review',
  SUBMITTED_MANUAL_VERIFICATION: 'Submitted · manual verification',
  CONTRACT_DECLINED: 'Contract declined · not submitted'
};

export const FLAG_LABEL: Record<ReviewFlag, string> = {
  CR_EXPIRED: 'CR expired (allowed to progress)',
  CATEGORY_MANUAL_REVIEW: 'Category needs business review',
  FL_CR_ONLY_CATEGORY: 'Freelancer in a CR-only category',
  NO_ELIGIBLE_PERSON: 'No eligible individual on the CR',
  NAFATH_UNVERIFIED: 'Identity not verified with Nafath',
  IBAN_UNVERIFIED: 'IBAN ownership not verified (financial review)',
  IBAN_NOT_CHECKED: 'IBAN collected without ownership check',
  CERTIFICATE_MANUAL: 'Certificate entered manually',
  CERTIFICATE_INCONSISTENT: 'Certificate data inconsistent',
  CERTIFICATE_CATEGORY_MISMATCH: 'Certificate activity differs from chosen category'
};
