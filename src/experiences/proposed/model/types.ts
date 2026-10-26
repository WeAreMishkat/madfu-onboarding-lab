/**
 * Madfu Proposed (Madfu Business) — product-design model, v4.
 *
 * Source of truth: the agreed product decisions of 2026-10-27 ("identifier before OTP, lifecycle
 * routing"). They supersede the KYB-first v3 journey of 2026-10-23 wherever they differ. Principle:
 * ask cheaply first, verify expensively later, never ask twice, never repeat a paid verification
 * unnecessarily, and never let a returning visitor reach an application without the registered mobile.
 *
 * Three separate concepts:
 * - Merchant entity: identified by the CR (registered business) or the National ID (Freelancer).
 * - Application: one onboarding lifecycle for that entity (`Application.status`).
 * - User / applicant: the person and mobile working on the application. Access to an existing
 *   application is granted only by an OTP to its registered mobile — never by knowing the CR.
 */

/* ------------------------------------------------------------------ Stage 1: Know Your Business */

export type ApplicantKind = 'CR' | 'FL_CERT' | 'FL_NO_CERT';
export type Revenue = 'BELOW_100K' | 'SELF_SERVICE_BAND' | 'ABOVE_20M';
export type Channel = 'online' | 'offline' | 'both';

/** Page 1 only: no URL, no identity, no mobile. The category is a preliminary declaration. */
export interface Kyb {
  kind: ApplicantKind | null;
  group: string;
  sub: string;
  revenue: Revenue | null;
  channel: Channel | null;
}

/** Preliminary routing from Page 1. Categories are allowed or blocked; there is no manual-review route. */
export type EligibilityResult = 'SELF_ONBOARDING' | 'SALES_LEAD' | 'BLOCKED';

export type ReasonCode =
  | 'OK'
  | 'CATEGORY_NOT_SUPPORTED'
  | 'REGULATORY_RESTRICTION'
  | 'ACTIVITY_REQUIRES_CR'
  | 'CHANNEL_NOT_SUPPORTED'
  | 'FL_CERT_REQUIRED'
  | 'FL_CERT_NOT_FOUND'
  | 'REVENUE_BELOW_BAND'
  | 'REVENUE_ABOVE_BAND'
  | 'NOT_OWNER_MANAGER'
  | 'NO_OWNER_MANAGER_ON_CR'
  | 'FL_IBAN_NOT_LINKED'
  | 'ACTIVITY_REGULATED'
  | 'CR_EXPIRED'
  | 'CR_SUSPENDED'
  | 'CR_RESTRICTED';

export interface Eligibility {
  result: EligibilityResult;
  reason: ReasonCode;
  ruleId: string;
  ruleset: string;
  at: string;
}

/** Stage-1 answers + eligibility, attached permanently to the application after the first OTP. */
export interface KybSnapshot extends Kyb {
  qualificationId: string;
  eligibility: Eligibility;
  linkedAt: string;
}

/* ------------------------------------------------------------------ steps, stages, lifecycle */

export type StepId =
  | 'kyb'
  | 'identify'
  | 'otp'
  | 'persons'
  | 'nafath'
  | 'certificates'
  | 'business'
  | 'commercial'
  | 'review'
  | 'contract'
  | 'outcome'
  | 'status'
  | 'login';

export type StageId = 'kyb' | 'identify' | 'verification' | 'details' | 'commercial' | 'review' | 'contract' | 'outcome';

/**
 * Application lifecycle. Routing after OTP and on every resume reads THIS, never completion alone.
 * QUALIFICATION / OTP_PENDING exist before the record is persisted.
 */
export type Lifecycle =
  | 'QUALIFICATION'
  | 'OTP_PENDING'
  | 'DRAFT'
  | 'SALES_LEAD'
  | 'BLOCKED'
  | 'PAUSED_CR'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'ACTION_REQUIRED'
  | 'APPROVED'
  | 'UNABLE_TO_PROCEED'
  | 'LIVE';

/** Merchant-facing end pages (step 'outcome'). The Application Progress page is the 'status' step. */
export type OutcomeKind =
  | 'SUBMITTED'
  | 'SUBMITTED_MANUAL'
  | 'SALES_LEAD'
  | 'FL_CERT_REQUIRED'
  | 'BLOCKED'
  | 'PAUSED_CR'
  | 'CONTRACT_DECLINED';

/** Internal flags. Never shown to the applicant as reasons. */
export type Flag =
  | 'ADDITIONAL_DOCUMENTS_REQUIRED'
  | 'NATIONAL_ADDRESS_MISSING'
  | 'NATIONAL_ADDRESS_EXPIRED'
  | 'CATEGORY_RECLASSIFIED'
  | 'ACTIVITY_UNMAPPED'
  | 'NAFATH_UNVERIFIED'
  | 'MOBILE_OWNERSHIP_UNVERIFIED'
  | 'SALES_FOLLOW_UP'
  | 'COMMERCIAL_RATE_REVIEW_REQUESTED'
  | 'CERTIFICATE_INCONSISTENT';

/* ------------------------------------------------------------------ existence check (internal) */

/** Result of the cheap internal lookup by CR / National ID. No provider is called. */
export type Existence = 'new' | 'incomplete' | 'submitted' | 'live' | 'paused';

/* ------------------------------------------------------------------ government data */

export type CrStatus = 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'RESTRICTED';
export type EntityKind = 'SAUDI' | 'NON_SAUDI';
export type NationalAddress = 'VALID' | 'MISSING' | 'EXPIRED';

export interface CrActivity {
  /** Government activity code (synthetic fixture). */
  code: string;
  primary: boolean;
}

export interface CrRecord {
  legalName: string;
  status: CrStatus;
  ageMonths: number;
  expiry: string;
  city: string;
  entity: EntityKind;
  legalForm: string;
  nationalAddress: NationalAddress;
  /** A CR can carry several activities. */
  activities: CrActivity[];
}

/** Action decided from the CR status. Mapped in configuration, never in screens. */
export type GovAction = 'continue' | 'pause_sales';

/**
 * Category from government data. Before retrieval the Page-1 category is a declaration; afterwards
 * the government activity (CR) or certificate activity (Freelancer) is authoritative.
 */
export interface CategoryCheck {
  source: 'CR' | 'CERTIFICATE';
  declaredSub: string;
  activities: Array<{ code: string; mappedSub: string | null }>;
  /** Category used for pricing and every later rule. */
  verifiedSub: string;
  outcome: 'CONFIRMED' | 'RECLASSIFIED' | 'UNMAPPED';
}

/* ------------------------------------------------------------------ risk (backend only) */

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export interface RiskAssessment {
  model: string;
  score: number;
  level: RiskLevel;
  factors: Array<{ factor: string; value: string; points: number }>;
}

/* ------------------------------------------------------------------ people, Nafath, certificates, bank */

export type NafathResult = 'verified' | 'rejected' | 'timeout' | 'technical';
export type PersonsResult = 'one' | 'multiple' | 'none' | 'unavailable';
export type CertificatesResult = 'one' | 'multiple' | 'none' | 'unavailable' | 'expired' | 'duplicate' | 'inconsistent' | 'mismatch';
export type IbanResult = 'verified' | 'mismatch' | 'technical';
export type MobileMatchResult = 'match' | 'mismatch';

export type PersonRole = 'owner' | 'manager' | 'delegate';

export interface Person {
  id: string;
  /** Four-part name; the UI masks parts 2 and 3. */
  name: [string, string, string, string];
  /** Display-safe mask: first 3 and last 3 digits. The full number never exists in the client. */
  idMasked: string;
  kind: 'individual' | 'company';
  role: PersonRole;
}

export interface Certificate {
  id: string;
  number: string;
  activityLabel: string;
  /** Platform activity code, mapped to a Madfu subcategory. */
  activity: string;
  status: 'active' | 'expired';
  issue?: 'inconsistent' | 'duplicate';
}

/* ------------------------------------------------------------------ verification reuse */

/** External verifications whose results are stored and reused. OTP is never reused across sessions. */
export type VerificationType = 'CR_DATA' | 'PERSONS' | 'MOBILE_MATCH' | 'NAFATH' | 'FL_CERTS' | 'IBAN';

export interface VerificationRecord {
  type: VerificationType;
  /** Dependent inputs the result was obtained for. A different fingerprint = not reusable. */
  fingerprint: string;
  dependsOn: string;
  result: string;
  at: string;
  source: string;
  providerRef: string;
  status: 'valid' | 'invalidated';
  invalidatedReason: string | null;
  /** null = no freshness policy: "Reusable until invalidated". */
  expiresAt: string | null;
}

export interface LedgerEntry {
  kind: 'internal' | 'otp' | 'call' | 'reuse' | 'invalidate';
  check: VerificationType | 'OTP' | 'EXISTENCE' | 'ELIGIBILITY' | 'RISK';
  at: string;
  note: string;
}

/* ------------------------------------------------------------------ commercial offer */

export interface AgreedOffer {
  pricingVersion: string;
  /** The verified (government-mapped) subcategory the rate comes from. */
  pricingSub: string;
  standardRate: number;
  at: string;
}

/* ------------------------------------------------------------------ application */

/** Review sections. Only `presence` and `commercial` can be edited after verification. */
export type SectionId = 'applicant' | 'verified' | 'presence' | 'banking' | 'commercial';

export interface OtpState {
  purpose: 'application' | 'registered' | 'resume' | 'mobile-change';
  /** The number the code was sent to (masked in the UI). */
  to: string;
  status: 'sent' | 'incorrect' | 'invalid' | 'expired' | 'exhausted' | 'locked' | 'verified';
  attemptsLeft: number;
  resendsLeft: number;
  code: string;
  resendAt: number;
}

export interface Application {
  /** Temporary qualification record created by Stage 1. */
  qualificationId: string;
  /** Application id, created after the first OTP (null before). */
  id: string | null;
  createdAt: string;
  step: StepId;
  /** Furthest step reached. */
  lastStep: StepId;
  /** Return target after an edit (Review). */
  returnTo: StepId | null;
  /** Full copy of the application when an edit started: Cancel restores it exactly. */
  editBaseline: string | null;

  kyb: Kyb;
  eligibility: Eligibility | null;
  kybSnapshot: KybSnapshot | null;

  /** Page 2: identifier, mobile and the self-onboarding prerequisite declaration. */
  identity: { identifier: string; mobile: string; prerequisite: 'yes' | 'no' | null };
  existence: Existence | null;
  /** Identify-page throttle (rate limit / bot challenge simulation). */
  throttled: boolean;
  identifyChecks: number;

  /** Mobile stored on the application: the only number that can open it again. */
  registeredMobile: string;
  /** OTP to the contact mobile succeeded (application level). */
  contactMobileVerified: boolean;
  /** Mobile ↔ National ID ownership confirmed for the person verifying with Nafath. */
  authorizedMobileVerified: boolean;
  /** OTP passed in THIS browser session. A Continue link or new visit starts a new session. */
  sessionVerified: boolean;
  /** New mobile entered after a mobile ↔ National ID mismatch (pending its OTP). */
  pendingMobile: string;
  otp: OtpState;

  cr: { status: 'idle' | 'loaded' | 'unavailable'; tries: number; record: CrRecord | null; gov: GovAction | null; govReason: ReasonCode | null };
  categoryCheck: CategoryCheck | null;
  risk: RiskAssessment | null;
  persons: { status: 'idle' | 'loaded' | 'none' | 'unavailable'; tries: number; list: Person[]; selectedId: string | null };
  mobileMatch: { status: 'idle' | 'matched' | 'mismatch' | 'entering' | 'blocked'; checks: number; matchedFor: string | null };
  nafath: {
    status: 'idle' | 'waiting' | 'verified' | 'failed' | 'exhausted' | 'unavailable';
    /** Unsuccessful attempts used (rejected / timeout). Per application. */
    failures: number;
    /** Technical failures in this session (bounded separately; reset on resume). */
    technical: number;
    requests: number;
    lastResult: NafathResult | null;
    number: string;
    verifiedFor: string | null;
  };
  certs: {
    /** Backend-only existence / retrieval before Nafath. Details stay hidden until Nafath succeeds. */
    precheck: 'idle' | 'found' | 'none' | 'unavailable';
    status: 'idle' | 'loaded';
    tries: number;
    list: Certificate[];
    selectedId: string | null;
  };
  business: {
    websiteUrl: string;
    mapsUrl: string;
    /** Freelancer only. A registered business adds its payout IBAN later, at activation. */
    iban: string;
    ibanStatus: 'idle' | 'verifying' | 'verified' | 'failed' | 'failed_final';
    /** Ownership mismatches for THIS IBAN (a different IBAN starts again). */
    ibanFailures: number;
    ibanLast: IbanResult | null;
    bankName: string;
  };
  commercial: {
    /** "Request rate review" clicked: kept even with no file. */
    reviewRequested: boolean;
    evidence: string[];
    uploadError: string | null;
    agreed: AgreedOffer | null;
  };
  contract: { status: 'unavailable' | 'ready' | 'accepted' | 'declined'; acceptedAt: string };

  verifications: Partial<Record<VerificationType, VerificationRecord>>;
  ledger: LedgerEntry[];
  flags: Flag[];
  status: Lifecycle;
  outcome: OutcomeKind | null;
  outcomeReason: ReasonCode | null;
  submittedAt: string;
}

/* ------------------------------------------------------------------ simulated backend + controls */

/** Prototype Controls: how the simulated providers and records answer. */
export interface Sim {
  /** 'auto' = use the simulated backend; other values force a stored record for the entered identifier. */
  existence: 'auto' | 'incomplete' | 'submitted' | 'live';
  /** Identify page answers "too many requests" (rate limit / bot challenge). */
  rateLimited: boolean;
  cr: {
    result: 'found' | 'unavailable';
    status: CrStatus;
    ageMonths: number;
    entity: EntityKind;
    nationalAddress: NationalAddress;
    /** 'auto' = one activity matching the declared subcategory plus a secondary general activity. */
    activities: string[] | 'auto';
  };
  persons: PersonsResult;
  /** Answers for the next mobile ↔ National ID checks, consumed in order; the last one repeats. */
  mobileMatch: MobileMatchResult[];
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
  /** Merchant entity (CR / National ID) -> latest application id. */
  identities: Record<string, string>;
  /** Live merchants (merchant account exists): identifier -> registered account mobile. */
  merchants: Record<string, { mobile: string }>;
  leads: Array<{ applicationId: string; qualificationId: string; kyb: Kyb; identifier: string; mobile: string; reason: ReasonCode; at: string }>;
  /** Continue-link token -> application id. The link identifies; OTP authorises. Revoked on submit. */
  tokens: Record<string, string>;
  sms: SmsMessage[];
}

export interface ProposedState {
  app: Application;
  sim: Sim;
  scenarioId: string | null;
  backend: Backend;
}
