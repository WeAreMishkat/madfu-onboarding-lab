/**
 * Madfu Proposed (Madfu Business) — product-design model.
 *
 * Source of truth: the "Complete Merchant Onboarding Wireframe System" specification (2026-10-15).
 * Core concept: the merchant works on an onboarding APPLICATION. The merchant ACCOUNT (login,
 * password) only exists after approval and is out of scope of this journey.
 */

export type ApplicantType = 'CR' | 'FL';
export type Revenue = 'BELOW_100K' | 'SELF_SERVICE_BAND' | 'ABOVE_20M';

export type StepId =
  | 'entry'
  | 'otp'
  | 'category'
  | 'cr-verify'
  | 'persons'
  | 'nafath'
  | 'certificates'
  | 'manual-certificate'
  | 'business'
  | 'review'
  | 'contract'
  | 'outcome';

/** External outcome shown to the applicant. Internal status is kept separately. */
export type OutcomeKind =
  | 'SUBMITTED'
  | 'MANUAL_VERIFICATION'
  | 'SALES_LEAD'
  | 'CATEGORY_REVIEW'
  | 'EXISTING_MERCHANT'
  | 'DUPLICATE_IDENTITY'
  | 'ADDITIONAL_CERTIFICATE'
  | 'CONTRACT_DECLINED';

export type InternalStatus =
  | 'DRAFT'
  | 'SALES_LEAD_LOW_REVENUE'
  | 'SALES_LEAD_HIGH_REVENUE'
  | 'CATEGORY_BLOCKED'
  | 'EXISTING_MERCHANT'
  | 'DUPLICATE_IDENTITY'
  | 'ADDITIONAL_CERTIFICATE_PENDING'
  | 'SUBMITTED'
  | 'SUBMITTED_MANUAL_VERIFICATION'
  | 'CONTRACT_DECLINED';

export type Classification = 'ALLOWED' | 'BLOCKED' | 'CR_ONLY' | 'MANUAL_REVIEW';

/** Internal review flags. Never shown to the applicant as reasons. */
export type ReviewFlag =
  | 'CR_EXPIRED'
  | 'CATEGORY_MANUAL_REVIEW'
  | 'FL_CR_ONLY_CATEGORY'
  | 'NO_ELIGIBLE_PERSON'
  | 'NAFATH_UNVERIFIED'
  | 'IBAN_UNVERIFIED'
  | 'IBAN_NOT_CHECKED'
  | 'CERTIFICATE_MANUAL'
  | 'CERTIFICATE_INCONSISTENT'
  | 'CERTIFICATE_CATEGORY_MISMATCH';

export type IdentityState = 'new' | 'existing_merchant' | 'current_application' | 'duplicate_identity' | 'additional_certificate';
export type CrResult = 'valid' | 'expired' | 'not_found' | 'unavailable' | 'error';
export type PersonsResult = 'one' | 'multiple' | 'none' | 'unavailable';
export type NafathResult = 'verified' | 'rejected' | 'timeout' | 'technical';
export type CertificatesResult = 'one' | 'multiple' | 'none' | 'unavailable' | 'expired' | 'inconsistent' | 'duplicate' | 'mismatch';
export type IbanResult = 'verified' | 'mismatch' | 'technical';

/** Prototype Controls: how the simulated backend answers. */
export interface Sim {
  identity: IdentityState;
  crResult: CrResult;
  persons: PersonsResult;
  /** Answers for the next Nafath requests, consumed in order; the last one repeats. */
  nafath: NafathResult[];
  certificates: CertificatesResult;
  /** Answers for the next IBAN checks, consumed in order; the last one repeats. */
  iban: IbanResult[];
}

export interface Person {
  id: string;
  /** Four-part name; the UI masks parts 2 and 3. */
  name: [string, string, string, string];
  /** Display-safe mask: first 3 and last 3 digits. The full number never exists in the client. */
  idMasked: string;
  kind: 'individual' | 'company';
}

export interface Certificate {
  id: string;
  number: string;
  category: string;
  subcategory: string;
  status: 'active' | 'expired';
  issue?: 'inconsistent' | 'duplicate';
  /** Madfu subcategory this certificate maps to, for reconciliation. */
  madfuSub: string;
}

export interface CrRecord {
  legalName: string;
  status: 'Active' | 'Expired';
  expiry: string;
  city: string;
}

export interface Application {
  id: string;
  createdAt: string;
  step: StepId;
  /** Return target when a section is opened from Review via Edit. */
  editing: StepId | null;
  entry: { type: ApplicantType | null; identifier: string; revenue: Revenue | null; mobile: string };
  /** Mobile verified for this session; editing the mobile requires a new code. */
  verifiedMobile: string;
  /** Result of the backend identity check run when the entry page is submitted (before mobile matching). */
  identityCheck: IdentityState | null;
  /** True when this application was reopened from a saved application. */
  resumed: boolean;
  /** Identity values when an edit from Review started; a change invalidates dependent verifications. */
  editBaseline: { type: ApplicantType | null; identifier: string } | null;
  otp: { status: 'sent' | 'incorrect' | 'expired' | 'exhausted' | 'verified'; attemptsLeft: number; code: string; resendAt: number };
  category: { group: string; sub: string };
  cr: { status: 'idle' | 'valid' | 'expired' | 'not_found' | 'unavailable' | 'error'; tries: number; record: CrRecord | null };
  persons: { status: 'idle' | 'loaded' | 'none' | 'unavailable'; tries: number; list: Person[]; selectedId: string | null };
  nafath: {
    status: 'idle' | 'waiting' | 'verified' | 'failed' | 'exhausted';
    /** Unsuccessful attempts used (rejected / timeout). Shared across people for a CR application. */
    failures: number;
    requests: number;
    lastResult: NafathResult | null;
    number: string;
    verifiedPersonId: string | null;
  };
  certs: { status: 'idle' | 'loaded' | 'none' | 'unavailable'; tries: number; list: Certificate[]; selectedId: string | null; manualNumber: string };
  business: {
    iban: string;
    ibanStatus: 'idle' | 'verifying' | 'verified' | 'failed' | 'unverified' | 'not_checked';
    ibanFailures: number;
    ibanLast: IbanResult | null;
    bankName: string;
    vat: 'yes' | 'no' | null;
    vatNumber: string;
    vatLookup: 'idle' | 'checking' | 'found';
    channel: 'online' | 'offline' | 'both' | null;
    websiteUrl: string;
    mapsUrl: string;
    branches: string;
  };
  contract: { status: 'unavailable' | 'ready' | 'accepted' | 'declined'; acceptedAt: string };
  flags: ReviewFlag[];
  status: InternalStatus;
  outcome: OutcomeKind | null;
  submittedAt: string;
}

export interface ProposedState {
  app: Application;
  sim: Sim;
  scenarioId: string | null;
  /** Simulated backend: applications saved by identity (for resume / duplicate detection). */
  saved: Record<string, { mobile: string; app: Application }>;
}
