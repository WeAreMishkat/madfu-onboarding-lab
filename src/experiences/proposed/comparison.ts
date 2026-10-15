import type { ComparisonProfile } from '@/compare/types';

/** Madfu Proposed per the 2026-10-15 wireframe specification. Every item is a design, not an observation. */
export const proposedComparison: ComparisonProfile = {
  experienceId: 'madfu-proposed',
  name: 'Madfu Proposed',
  stages: [
    { label: 'One entry page: applicant type, CR / National ID, revenue, mobile', status: 'PROPOSED' },
    { label: 'Identity and duplicate check (before mobile matching)', status: 'PROPOSED' },
    { label: 'SMS code', status: 'PROPOSED' },
    { label: 'Routing: CR below SAR 100K / above SAR 20M → Sales lead', appliesTo: 'Registered business', status: 'PROPOSED' },
    { label: 'Category screening (Madfu taxonomy)', status: 'PROPOSED' },
    { label: 'CR verification → authorised person → Nafath', appliesTo: 'Registered business', status: 'PROPOSED' },
    { label: 'Nafath → retrieved freelance certificates', appliesTo: 'Freelancer', status: 'PROPOSED' },
    { label: 'Business details: IBAN, VAT, sales channel', status: 'PROPOSED' },
    { label: 'Review with section Edit', status: 'PROPOSED' },
    { label: 'Agreement (generic acceptance), then Submit', status: 'PROPOSED', note: 'Only when Nafath is verified; otherwise manual verification' }
  ],
  inputs: [
    { label: 'Applicant type', status: 'PROPOSED' },
    { label: 'Commercial Registration Number', appliesTo: 'Registered business', status: 'PROPOSED' },
    { label: 'National ID Number (no certificate number at entry)', appliesTo: 'Freelancer', status: 'PROPOSED' },
    { label: 'Annual revenue (3 bands)', status: 'PROPOSED' },
    { label: 'Mobile + SMS code', status: 'PROPOSED' },
    { label: 'Business category + subcategory', status: 'PROPOSED' },
    { label: 'Select authorised person (masked list)', appliesTo: 'Registered business', status: 'PROPOSED' },
    { label: 'Select freelance certificate', appliesTo: 'Freelancer', status: 'PROPOSED' },
    { label: 'IBAN only (bank derived)', status: 'PROPOSED' },
    { label: 'VAT registered? Yes / No (+ number for Freelancers)', status: 'PROPOSED' },
    { label: 'Sales channel + website / Google Maps link; branches optional', status: 'PROPOSED' },
    { label: 'Agreement acceptance', status: 'PROPOSED' }
  ],
  uploads: [
    { label: 'None', status: 'PROPOSED', note: 'No proof of sales, VAT certificate, ID, IBAN certificate, beneficiary or SWIFT' }
  ],
  automation: [
    { label: 'Identity / duplicate detection before any account exists', status: 'PROPOSED' },
    { label: 'Revenue routing after the SMS code', status: 'PROPOSED' },
    { label: 'Category screening before paid checks', status: 'PROPOSED' },
    { label: 'CR details and associated individuals retrieved (mock provider)', appliesTo: 'Registered business', status: 'PROPOSED' },
    { label: 'Freelance certificates retrieved after Nafath', appliesTo: 'Freelancer', status: 'PROPOSED' },
    { label: 'Bank name derived from the IBAN', status: 'PROPOSED' },
    { label: 'VAT details retrieved', appliesTo: 'Registered business', status: 'PROPOSED' },
    { label: 'Saved application, resumable after refresh or later', status: 'PROPOSED' }
  ],
  branches: [
    { label: 'Registered business vs Freelancer from one entry page', status: 'PROPOSED' },
    { label: 'Existing merchant / duplicate identity / saved application', status: 'PROPOSED' },
    { label: 'CR revenue: below 100K and above 20M → Sales lead; 100K–20M → self-onboarding', appliesTo: 'Registered business', status: 'PROPOSED' },
    { label: 'Freelancer: self-onboarding at every revenue level', appliesTo: 'Freelancer', status: 'PROPOSED' },
    { label: 'Category: allowed / restricted / CR-only / manual review', status: 'PROPOSED' },
    { label: 'Nafath failed twice → manual verification, no contract', status: 'PROPOSED' },
    { label: 'No eligible individual → manual authority check', appliesTo: 'Registered business', status: 'PROPOSED' },
    { label: 'Certificates: one / several / none / unavailable / mismatch', appliesTo: 'Freelancer', status: 'PROPOSED' }
  ],
  verification: [
    { label: 'SMS code (3 attempts)', status: 'PROPOSED' },
    { label: 'CR status (expired allowed with a flag; not found stops)', appliesTo: 'Registered business', status: 'PROPOSED' },
    { label: 'Nafath identity and authority (2 attempts per application)', status: 'PROPOSED' },
    { label: 'IBAN ownership vs business or individual (2 attempts)', status: 'PROPOSED' },
    { label: 'Agreement acceptance, separate from Nafath', status: 'PROPOSED' }
  ]
};
