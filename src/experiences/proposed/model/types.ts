/**
 * Madfu Proposed (Madfu Business) — product-design model, v3.
 *
 * Source of truth: the "KYB-first" journey update of 2026-10-23. It supersedes the 2026-10-15 wireframe
 * specification wherever they differ. Principle: ask cheaply first, verify expensively later, never ask
 * twice, never repeat a paid verification unnecessarily, and do not lose a commercially valid lead
 * because one operational requirement is incomplete.
 *
 * The merchant works on an onboarding APPLICATION. The merchant ACCOUNT (login, password) exists only
 * after approval and is out of scope of this journey.
 */

/* ------------------------------------------------------------------ Stage 1: Know Your Business */

export type ApplicantKind = 'CR' | 'FL_CERT' | 'FL_NO_CERT';
export type Revenue = 'BELOW_100K' | 'SELF_SERVICE_BAND' | 'ABOVE_20M';
export type Channel = 'online' | 'offline' | 'both';

export interface Kyb {
  kind: ApplicantKind | null;
  group: string;
  sub: string;
  revenue: Revenue | null;
  channel: Channel | null;
  websiteUrl: string;
  mapsUrl: string;
}

export type EligibilityResult = 'ELIGIBLE' | 'SALES_LEAD' | 'TEMPORARILY_NOT_ELIGIBLE' | 'NOT_ELIGIBLE' | 'MANUAL_REVIEW';

export type ReasonCode =
  | 'OK'
  | 'CATEGORY_NOT_SUPPORTED'
  | 'REGULATORY_RESTRICTION'
  | 'ACTIVITY_REQUIRES_CR'
  | 'CHANNEL_NOT_SUPPORTED'
  | 'CATEGORY_PAUSED'
  | 'CATEGORY_MANUAL_REVIEW'
  | 'FL_CERT_REQUIRED'
  | 'REVENUE_BELOW_BAND'
  | 'REVENUE_ABOVE_BAND'
  | 'CR_TOO_RECENT'
  | 'CR_EXPIRED'
  | 'CR_SUSPENDED'
  | 'CR_GOVERNMENT_VIOLATION'
  | 'ACTIVITY_REGULATED';

export interface Eligibility {
  result: EligibilityResult;
  reason: ReasonCode;
  ruleId: string;
  ruleset: string;
  at: string;
}

/** Stage-1 answers + eligibility, attached permanently to the application after OTP. */
export interface KybSnapshot extends Kyb {
  qualificationId: string;
  eligibility: Eligibility;
  linkedAt: string;
}

/* ------------------------------------------------------------------ steps and stages */

export type StepId =
  | 'kyb'
  | 'lead'
  | 'identify'
  | 'otp'
  | 'cr-verify'
  | 'persons'
  | 'nafath'
  | 'certificates'
  | 'business'
  | 'commercial'
  | 'review'
  | 'contract'
  | 'outcome';

export type StageId = 'kyb' | 'identify' | 'verification' | 'banking' | 'commercial' | 'review' | 'contract' | 'outcome';

/* ------------------------------------------------------------------ outcomes and statuses */

/** External outcome shown to the applicant. Internal status is kept separately. */
export type OutcomeKind =
  | 'SUBMITTED'
  | 'SUBMITTED_BANKING_PENDING'
  | 'MANUAL_VERIFICATION'
  | 'SALES_LEAD'
  | 'FL_CERT_REQUIRED'
  | 'NOT_ELIGIBLE'
  | 'TEMPORARILY_NOT_ELIGIBLE'
  | 'EXISTING_MERCHANT'
  | 'DUPLICATE_IDENTITY'
  | 'CONTRACT_DECLINED';

export type InternalStatus =
  | 'QUALIFICATION_DRAFT'
  | 'DRAFT'
  | 'LEAD_LOW_REVENUE'
  | 'LEAD_HIGH_REVENUE'
  | 'LEAD_FL_CERT_REQUIRED'
  | 'LEAD_FL_CERT_NOT_FOUND'
  | 'NOT_ELIGIBLE'
  | 'TEMPORARILY_NOT_ELIGIBLE'
  | 'EXISTING_MERCHANT'
  | 'DUPLICATE_IDENTITY'
  | 'SUBMITTED'
  | 'SUBMITTED_BANKING_PENDING'
  | 'SUBMITTED_MANUAL_VERIFICATION'
  | 'CONTRACT_DECLINED';

/** Internal flags. Never shown to the applicant as reasons. */
export type Flag =
  | 'CATEGORY_MANUAL_REVIEW'
  | 'ADDITIONAL_DOCUMENTS_REQUIRED'
  | 'NATIONAL_ADDRESS_MISSING'
  | 'NATIONAL_ADDRESS_EXPIRED'
  | 'ACTIVITY_AMBIGUOUS'
  | 'ACTIVITY_UNMAPPED'
  | 'ACTIVITY_CONFLICT_REVIEW'
  | 'NO_ELIGIBLE_PERSON'
  | 'NAFATH_UNVERIFIED'
  | 'IBAN_UNVERIFIED'
  | 'BANKING_SETUP_REQUIRED'
  | 'COMMERCIAL_PRICING_REVIEW'
  | 'CERTIFICATE_INCONSISTENT';

/* ------------------------------------------------------------------ government data */

export type CrStatus = 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'VIOLATION';
export type EntityKind = 'SAUDI' | 'NON_SAUDI';
export type NationalAddress = 'VALID' | 'MISSING' | 'EXPIRED';

export interface CrRecord {
  legalName: string;
  status: CrStatus;
  issuedMonthsAgo: number;
  expiry: string;
  city: string;
  entity: EntityKind;
  legalForm: string;
  nationalAddress: NationalAddress;
  /** Government activity code (synthetic fixture). */
  activity: string;
}

/** Action decided from government data. Mapped in configuration, never in screens. */
export type GovAction = 'continue' | 'manual_review' | 'not_eligible' | 'temporarily_not_eligible';

export type MappingOutcome = 'MATCH' | 'COMPATIBLE' | 'AMBIGUOUS' | 'CONFLICT' | 'UNMAPPED';
export type MappingAction = 'continue' | 'manual_review' | 'clarify' | 'stop';

export interface ActivityCheck {
  source: 'CR' | 'CERTIFICATE';
  activity: string;
  declaredSub: string;
  outcome: MappingOutcome;
  action: MappingAction;
  /** Applicant chose "continue, the team will confirm" after a conflict. */
  acknowledged: boolean;
}

/* ------------------------------------------------------------------ people, Nafath, certificates, bank */

export type IdentityState = 'new' | 'existing_merchant' | 'current_application' | 'duplicate_identity';
export type NafathResult = 'verified' | 'rejected' | 'timeout' | 'technical';
export type PersonsResult = 'one' | 'multiple' | 'none' | 'unavailable';
export type CertificatesResult = 'one' | 'multiple' | 'none' | 'unavailable' | 'expired' | 'duplicate' | 'inconsistent' | 'mismatch';
export type IbanResult = 'verified' | 'mismatch' | 'technical';

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
  activityLabel: string;
  /** Government / platform activity code, reconciled against the declared Madfu subcategory. */
  activity: string;
  status: 'active' | 'expired';
  issue?: 'inconsistent' | 'duplicate';
}

/* ------------------------------------------------------------------ verification reuse */

/** External verifications whose results are stored and reused. OTP is never reused across sessions. */
export type VerificationType = 'CR_DATA' | 'PERSONS' | 'NAFATH' | 'FL_CERTS' | 'IBAN';

export interface VerificationRecord {
  type: VerificationType;
  /** Dependent inputs the result was obtained for. A different fingerprint = not reusable. */
  fingerprint: string;
  dependsOn: string;
  result: string;
  at: string;
  source: string;
  providerRef: string;
  ruleset: string | null;
  status: 'valid' | 'invalidated';
  invalidatedReason: string | null;
  /** null = no freshness policy: "Reusable until invalidated". */
  expiresAt: string | null;
}

export interface LedgerEntry {
  kind: 'call' | 'reuse' | 'invalidate' | 'otp';
  check: VerificationType | 'OTP';
  at: string;
  note: string;
}

/* ------------------------------------------------------------------ commercial offer */

export type Tenure = 3 | 4 | 6 | 9 | 12;

export interface AgreedOffer {
  pricingVersion: string;
  standardRate: number;
  plans: Array<{ tenure: Tenure; rate: number; included: boolean }>;
  at: string;
}

/* ------------------------------------------------------------------ application */

export type SectionId = 'kyb' | 'identification' | 'verified' | 'banking' | 'commercial' | 'plans';

export interface Application {
  /** Temporary qualification record created by Stage 1. */
  qualificationId: string;
  /** Application id, created after identity + mobile + OTP (null before). */
  id: string | null;
  createdAt: string;
  step: StepId;
  /** Furthest step reached; resume goes to the first incomplete valid screen. */
  lastStep: StepId;
  /** Return target after an edit (Review, or the screen that asked for a correction). */
  returnTo: StepId | null;
  /** Values when an edit started, restored on Cancel and compared on Save. */
  editBaseline: Pick<Application, 'kyb' | 'identity' | 'business' | 'commercial'> | null;

  kyb: Kyb;
  eligibility: Eligibility | null;
  kybSnapshot: KybSnapshot | null;

  lead: { name: string; mobile: string };
  identity: { identifier: string; mobile: string };
  identityCheck: IdentityState | null;
  /** Mobile verified in THIS session. Opening a Continue link starts a new session. */
  sessionMobile: string;
  /** Mobile verified for the application (survives sessions). */
  verifiedMobile: string;
  otp: {
    purpose: 'lead' | 'application' | 'resume' | 'mobile-change';
    status: 'sent' | 'incorrect' | 'expired' | 'exhausted' | 'verified';
    attemptsLeft: number;
    code: string;
    resendAt: number;
  };
  resumed: boolean;

  cr: { status: 'idle' | 'loaded' | 'not_found' | 'unavailable'; tries: number; record: CrRecord | null; decision: GovAction | null; decisionReason: ReasonCode | null };
  activity: ActivityCheck | null;
  persons: { status: 'idle' | 'loaded' | 'none' | 'unavailable'; tries: number; list: Person[]; selectedId: string | null };
  nafath: {
    status: 'idle' | 'waiting' | 'verified' | 'failed' | 'exhausted';
    /** Unsuccessful attempts used (rejected / timeout). Shared across people for a CR application. */
    failures: number;
    requests: number;
    lastResult: NafathResult | null;
    number: string;
    verifiedFor: string | null;
  };
  certs: { status: 'idle' | 'loaded' | 'none' | 'unavailable'; tries: number; list: Certificate[]; selectedId: string | null };
  business: {
    /** Freelancer only: is the bank account linked to the Freelancer Certificate? */
    bankLinked: 'yes' | 'no' | null;
    iban: string;
    ibanStatus: 'idle' | 'verifying' | 'verified' | 'failed' | 'unverified' | 'skipped';
    ibanFailures: number;
    ibanLast: IbanResult | null;
    bankName: string;
    vat: 'yes' | 'no' | null;
    vatNumber: string;
    vatLookup: 'idle' | 'checking' | 'found';
    branches: string;
  };
  commercial: {
    optional: Tenure[];
    evidence: string[];
    evidenceSkipped: boolean;
    agreed: AgreedOffer | null;
  };
  contract: { status: 'unavailable' | 'ready' | 'accepted' | 'declined'; acceptedAt: string };

  verifications: Partial<Record<VerificationType, VerificationRecord>>;
  ledger: LedgerEntry[];
  flags: Flag[];
  status: InternalStatus;
  outcome: OutcomeKind | null;
  outcomeReason: ReasonCode | null;
  submittedAt: string;
}

/* ------------------------------------------------------------------ simulated backend + controls */

/** Prototype Controls: how the simulated providers answer. */
export interface Sim {
  identity: IdentityState;
  cr: {
    result: 'found' | 'not_found' | 'unavailable';
    status: CrStatus;
    issuedMonthsAgo: number;
    entity: EntityKind;
    nationalAddress: NationalAddress;
    /** 'auto' = an activity that matches the declared subcategory. */
    activity: string;
  };
  persons: PersonsResult;
  /** Answers for the next Nafath requests, consumed in order; the last one repeats. */
  nafath: NafathResult[];
  certificates: CertificatesResult;
  /** Answers for the next IBAN checks, consumed in order; the last one repeats. */
  iban: IbanResult[];
}

export interface SmsMessage { to: string; kind: 'otp' | 'continue-link'; text: string; token?: string; at: string }

export interface Backend {
  /** Stage-1 qualification records (temporary until linked). */
  qualifications: Record<string, { kyb: Kyb; eligibility: Eligibility; at: string; linkedTo: string | null }>;
  applications: Record<string, Application>;
  /** Identity (CR / National ID) -> application id. */
  identities: Record<string, string>;
  leads: Array<{ qualificationId: string; kyb: Kyb; eligibility: Eligibility; name: string; mobile: string; status: InternalStatus; at: string }>;
  /** Continue-link token -> application id. The link identifies; OTP authorises. */
  tokens: Record<string, string>;
  sms: SmsMessage[];
}

export interface ProposedState {
  app: Application;
  sim: Sim;
  scenarioId: string | null;
  backend: Backend;
}
