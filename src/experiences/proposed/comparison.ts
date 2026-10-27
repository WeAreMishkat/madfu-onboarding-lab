import type { ComparisonProfile } from '@/compare/types';
import { HANDOFF_RULES, STAGES } from './model/config';

/** Madfu Proposed per the agreed product decisions of 2026-10-28. Every item is a design, not an observation. */
export const proposedComparison: ComparisonProfile = {
  experienceId: 'madfu-proposed',
  name: 'Madfu Proposed',
  stages: STAGES.map((s) => ({
    label: `${s.n}. ${s.label}`,
    status: 'PROPOSED' as const,
    note: s.id === 'kyb' ? 'Five questions; eligibility decided internally, never shown'
      : s.id === 'identify' ? 'Identifier + mobile; existing records use the stored mobile only'
        : s.id === 'verification' ? 'CR verification, or Freelancer certificate → Nafath'
          : s.id === 'commercial' ? 'Standard offer only; plans configured later in the Merchant Portal'
            : s.id === 'contract' ? 'CR: authorization choice (self or signer handoff); one action: Agree & Submit / Agree & Sign'
              : s.id === 'outcome' ? 'Submitted applications open Application Progress'
                : undefined
  })),
  inputs: [
    { label: 'Applicant type: CR / Freelancer with certificate / Freelancer without certificate', status: 'PROPOSED' },
    { label: 'Category + subcategory, annual revenue, sales channel', status: 'PROPOSED' },
    { label: 'CR / Unified Number + mobile + SMS code', appliesTo: 'Registered business', status: 'PROPOSED' },
    { label: 'National ID + mobile + "IBAN linked to the certificate?" + SMS code', appliesTo: 'Freelancer', status: 'PROPOSED' },
    { label: 'Authorization choice after Review: myself (select owner / manager) or another signer + their Nafath mobile', appliesTo: 'Registered business', status: 'PROPOSED' },
    { label: 'Select Freelancer Certificate (before Nafath)', appliesTo: 'Freelancer', status: 'PROPOSED' },
    { label: 'Online store and / or Google Maps branch link (by channel)', status: 'PROPOSED' },
    { label: 'IBAN (linked to the certificate)', appliesTo: 'Freelancer', status: 'PROPOSED' },
    { label: 'Optional better-rate review request', status: 'PROPOSED' },
    { label: 'Contract acceptance', status: 'PROPOSED' }
  ],
  uploads: [
    { label: 'None in the standard path', status: 'PROPOSED', note: 'Only optional evidence after a rate-review request; delegation documents are Phase 2' }
  ],
  automation: [
    { label: 'Eligibility engine and internal existence check before any external cost', status: 'PROPOSED' },
    { label: 'CR data (several activities), owners / managers retrieved; nobody chosen until authorization', appliesTo: 'Registered business', status: 'PROPOSED' },
    { label: 'Government activity is the verified category (and the pricing category)', status: 'PROPOSED' },
    { label: 'Backend risk score separate from Not Eligible rules (CR age and revenue are risk factors)', status: 'PROPOSED' },
    { label: 'Freelancer Certificate retrieved before Nafath (no certificate → no Nafath cost)', appliesTo: 'Freelancer', status: 'PROPOSED' },
    { label: 'Mobile ↔ National ID check before Nafath (incl. the signer mobile)', status: 'PROPOSED' },
    { label: 'Verified checks reused: resume costs one OTP', status: 'PROPOSED' }
  ],
  branches: [
    { label: 'Two internal eligibility outcomes; Not Eligible is captured and shown as Application submitted', status: 'PROPOSED' },
    { label: 'Existing application → stored-mobile OTP → resume / Application Progress / active-account popup', status: 'PROPOSED' },
    { label: `CR signer handoff: freeze, secure SMS link (${HANDOFF_RULES.expiryDays} days), max ${HANDOFF_RULES.maxVersions} versions / ${HANDOFF_RULES.windowDays} days`, appliesTo: 'Registered business', status: 'PROPOSED' },
    { label: 'Expired / suspended CR → saved + Sales recovery', appliesTo: 'Registered business', status: 'PROPOSED' },
    { label: 'Mobile mismatch → another mobile + OTP → check again (preparer / Freelancer)', status: 'PROPOSED' },
    { label: 'Nafath failed twice → manual verification, no contract', status: 'PROPOSED' }
  ],
  verification: [
    { label: 'SMS code (3 attempts, 3 resends); required on every resume, to the stored mobile', status: 'PROPOSED' },
    { label: 'Government CR data (status, age, activities, address, entity)', appliesTo: 'Registered business', status: 'PROPOSED' },
    { label: 'Mobile ownership vs National ID, then Nafath identity (2 attempts per authorization)', status: 'PROPOSED' },
    { label: 'Signer: secure link (no OTP) → Nafath → read-only review', appliesTo: 'Registered business', status: 'PROPOSED' },
    { label: 'IBAN ↔ certificate linkage', appliesTo: 'Freelancer', status: 'PROPOSED' },
    { label: 'Contract acceptance, separate from Nafath', status: 'PROPOSED' }
  ]
};
