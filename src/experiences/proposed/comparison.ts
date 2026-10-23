import type { ComparisonProfile } from '@/compare/types';
import { STAGES } from './model/config';

/** Madfu Proposed per the KYB-first journey update (2026-10-23). Every item is a design, not an observation. */
export const proposedComparison: ComparisonProfile = {
  experienceId: 'madfu-proposed',
  name: 'Madfu Proposed',
  stages: STAGES.map((s) => ({
    label: `${s.n}. ${s.label}`,
    status: 'PROPOSED' as const,
    note: s.id === 'kyb' ? 'First page: eligibility before CR, ID, mobile or OTP'
      : s.id === 'commercial' ? 'Commission and payment plans live here, not in the contract'
        : s.id === 'contract' ? 'Contract only; available when Nafath is verified'
          : undefined
  })),
  inputs: [
    { label: 'Applicant type: CR / Freelancer with certificate / Freelancer without certificate', status: 'PROPOSED' },
    { label: 'Category + subcategory, annual revenue, sales channel', status: 'PROPOSED' },
    { label: 'Website (online) and / or Google Maps link (offline), validated', status: 'PROPOSED' },
    { label: 'CR / Unified Number + mobile + SMS code', appliesTo: 'Registered business', status: 'PROPOSED' },
    { label: 'National ID + mobile + SMS code', appliesTo: 'Freelancer', status: 'PROPOSED' },
    { label: 'Select authorised person (masked list)', appliesTo: 'Registered business', status: 'PROPOSED' },
    { label: 'Select Freelancer Certificate', appliesTo: 'Freelancer', status: 'PROPOSED' },
    { label: 'Bank linked to certificate? Yes / No', appliesTo: 'Freelancer', status: 'PROPOSED' },
    { label: 'IBAN only (bank derived); VAT yes / no; branches optional', status: 'PROPOSED' },
    { label: 'Optional plans 6 / 9 / 12 months; optional better-rate evidence', status: 'PROPOSED' },
    { label: 'Contract acceptance', status: 'PROPOSED' }
  ],
  uploads: [
    { label: 'None in the standard path', status: 'PROPOSED', note: 'Freelancers upload nothing; only optional better-rate evidence in the Commercial Offer' }
  ],
  automation: [
    { label: 'Eligibility engine before any external cost', status: 'PROPOSED' },
    { label: 'Duplicate / existing application detection; KYB snapshot linked after OTP', status: 'PROPOSED' },
    { label: 'CR data, activities, National Address retrieved; government rules evaluated', appliesTo: 'Registered business', status: 'PROPOSED' },
    { label: 'Category ↔ registered activity reconciliation', status: 'PROPOSED' },
    { label: 'Freelancer certificates retrieved after Nafath', appliesTo: 'Freelancer', status: 'PROPOSED' },
    { label: 'Verified checks reused: resume costs one OTP', status: 'PROPOSED' },
    { label: 'Standard commission from the pricing matrix', status: 'PROPOSED' }
  ],
  branches: [
    { label: 'Not eligible / temporarily not eligible at Stage 1, before cost', status: 'PROPOSED' },
    { label: 'Freelancer without certificate → lead', appliesTo: 'Freelancer', status: 'PROPOSED' },
    { label: 'CR revenue outside SAR 100K–20M → lead / Sales', appliesTo: 'Registered business', status: 'PROPOSED' },
    { label: 'CR ≤ 3 months, expired, suspended, violation', appliesTo: 'Registered business', status: 'PROPOSED' },
    { label: 'Continue link → OTP → last valid stage', status: 'PROPOSED' },
    { label: 'Bank not linked → banking setup required (continue)', appliesTo: 'Freelancer', status: 'PROPOSED' },
    { label: 'Nafath failed twice → manual verification, no contract', status: 'PROPOSED' }
  ],
  verification: [
    { label: 'SMS code (3 attempts); required on every resume', status: 'PROPOSED' },
    { label: 'Government CR data (age, status, entity, activities, address)', appliesTo: 'Registered business', status: 'PROPOSED' },
    { label: 'Nafath identity and authority (2 attempts per application)', status: 'PROPOSED' },
    { label: 'IBAN ownership vs business, or individual + certificate (2 attempts)', status: 'PROPOSED' },
    { label: 'Contract acceptance, separate from Nafath', status: 'PROPOSED' }
  ]
};
