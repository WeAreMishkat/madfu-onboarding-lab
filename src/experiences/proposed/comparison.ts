import type { ComparisonProfile } from '@/compare/types';
import { STAGES } from './model/config';

/** Madfu Proposed per the agreed product decisions of 2026-10-27. Every item is a design, not an observation. */
export const proposedComparison: ComparisonProfile = {
  experienceId: 'madfu-proposed',
  name: 'Madfu Proposed',
  stages: STAGES.map((s) => ({
    label: `${s.n}. ${s.label}`,
    status: 'PROPOSED' as const,
    note: s.id === 'kyb' ? 'Five questions; eligibility before identity, mobile or OTP'
      : s.id === 'identify' ? 'Identifier + mobile + prerequisite; existing records use the registered mobile'
        : s.id === 'commercial' ? 'Standard offer only; plans configured later in the Merchant Portal'
          : s.id === 'contract' ? 'Contract only; one action: Agree & Submit'
            : s.id === 'outcome' ? 'Submitted applications open Application Progress'
              : undefined
  })),
  inputs: [
    { label: 'Applicant type: CR / Freelancer with certificate / Freelancer without certificate', status: 'PROPOSED' },
    { label: 'Category + subcategory, annual revenue, sales channel', status: 'PROPOSED' },
    { label: 'CR / Unified Number + mobile + "owner or manager on the CR?" + SMS code', appliesTo: 'Registered business', status: 'PROPOSED' },
    { label: 'National ID + mobile + "IBAN linked to the certificate?" + SMS code', appliesTo: 'Freelancer', status: 'PROPOSED' },
    { label: 'Select owner / manager (masked list)', appliesTo: 'Registered business', status: 'PROPOSED' },
    { label: 'Select Freelancer Certificate', appliesTo: 'Freelancer', status: 'PROPOSED' },
    { label: 'Online store and / or Google Maps branch link (by channel)', status: 'PROPOSED' },
    { label: 'IBAN (linked to the certificate)', appliesTo: 'Freelancer', status: 'PROPOSED' },
    { label: 'Optional better-rate review request', status: 'PROPOSED' },
    { label: 'Contract acceptance', status: 'PROPOSED' }
  ],
  uploads: [
    { label: 'None in the standard path', status: 'PROPOSED', note: 'Only optional evidence after a rate-review request' }
  ],
  automation: [
    { label: 'Eligibility engine and internal existence check before any external cost', status: 'PROPOSED' },
    { label: 'CR data (several activities), owners / managers retrieved; no CR confirmation page', appliesTo: 'Registered business', status: 'PROPOSED' },
    { label: 'Government activity is the verified category (and the pricing category)', status: 'PROPOSED' },
    { label: 'Backend risk score separate from Not Eligible rules (CR age and revenue are risk factors)', status: 'PROPOSED' },
    { label: 'Freelancer Certificate pre-check before Nafath (backend cost order)', appliesTo: 'Freelancer', status: 'PROPOSED' },
    { label: 'Mobile ↔ National ID check before Nafath', status: 'PROPOSED' },
    { label: 'Verified checks reused: resume costs one OTP', status: 'PROPOSED' }
  ],
  branches: [
    { label: 'Only two eligibility outcomes: Eligible / Not Eligible; revenue never routes to Sales', status: 'PROPOSED' },
    { label: 'Freelancer without certificate → Not Eligible on Page 1 (no Identify, no OTP)', appliesTo: 'Freelancer', status: 'PROPOSED' },
    { label: 'Unsupported category → Identify + OTP → Not Eligible, details saved; no paid check', status: 'PROPOSED' },
    { label: 'Existing application → registered-mobile OTP → resume / Application Progress / login', status: 'PROPOSED' },
    { label: 'Expired / suspended CR → saved + Sales recovery', appliesTo: 'Registered business', status: 'PROPOSED' },
    { label: 'No certificate found → Not Eligible, no Nafath', appliesTo: 'Freelancer', status: 'PROPOSED' },
    { label: 'Mobile mismatch → another mobile + OTP → check again', status: 'PROPOSED' },
    { label: 'Nafath failed twice → manual verification, no contract', status: 'PROPOSED' }
  ],
  verification: [
    { label: 'SMS code (3 attempts, 3 resends); required on every resume, to the registered mobile', status: 'PROPOSED' },
    { label: 'Government CR data (status, age, activities, address, entity)', appliesTo: 'Registered business', status: 'PROPOSED' },
    { label: 'Mobile ownership vs National ID, then Nafath identity (2 attempts per application)', status: 'PROPOSED' },
    { label: 'IBAN ↔ certificate linkage', appliesTo: 'Freelancer', status: 'PROPOSED' },
    { label: 'Contract acceptance, separate from Nafath', status: 'PROPOSED' }
  ]
};
