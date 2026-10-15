import type { ComparisonProfile } from '@/compare/types';

/**
 * Madfu Current, side by side. Facts only, each with its evidence status.
 * Sources (newest wins): the onboarding master board (Madfu lanes), the CR full-journey research note
 * (CR, MDF-JOURNEY-000010) and the current onboarding journey note (Freelancer, MDF-JOURNEY-000009).
 */
export const madfuCurrentComparison: ComparisonProfile = {
  experienceId: 'madfu-current',
  name: 'Madfu Current',
  stages: [
    { label: 'Lead form (business type, identifier, sales channel, revenue band, link, name, mobile)', appliesTo: 'All', status: 'OBSERVED', note: 'MDF-STATE-000065..067, MDF-RULE-000073' },
    { label: 'SMS OTP (4 digits) on the lead mobile', appliesTo: 'All', status: 'OBSERVED', note: 'MDF-RULE-000080; lead created before the OTP' },
    { label: 'Partnership offer, claim or decline (< SAR 20M)', appliesTo: 'All', status: 'OBSERVED', note: 'MDF-RULE-000081' },
    { label: 'Create account: e-mail, password, Terms and Privacy consents', appliesTo: 'All', status: 'OBSERVED', note: 'MDF-RULE-000082' },
    { label: 'E-mail verification link, then sign-in with a 4-digit e-mail code; resumes at the saved step', appliesTo: 'All', status: 'OBSERVED', note: 'MDF-RULE-000083, MDF-RULE-000100' },
    { label: 'Merchant Information: Wathq-verified CR card + mandatory owner selection', appliesTo: 'Registered business', status: 'OBSERVED', note: 'MDF-RULE-000089 (one owner returned)' },
    { label: 'Merchant Information: identity typed + 3 PDFs', appliesTo: 'Freelancer', status: 'OBSERVED', note: 'MDF-RULE-000041' },
    { label: 'Business Information: proof of sales, bank, IBAN (verified server-side), VAT', appliesTo: 'Registered business', status: 'OBSERVED', note: 'MDF-RULE-000092, MDF-RULE-000093' },
    { label: 'Business Information: proof of sales, bank, IBAN, beneficiary, SWIFT, IBAN certificate, VAT', appliesTo: 'Freelancer', status: 'OBSERVED', note: 'MDF-RULE-000079' },
    { label: 'Summary (Previous only, no section Edit)', appliesTo: 'All', status: 'OBSERVED', note: 'MDF-RULE-000096, MDF-RULE-000097, MDF-RULE-000084' },
    { label: 'Proceed To Contract Sign-Off -> embedded Signit (agree, fill 2 fields, sign)', appliesTo: 'Registered business', status: 'OBSERVED', note: 'MDF-RULE-000098, MDF-RULE-000102' },
    { label: 'Contract signed -> separate Submit Request', appliesTo: 'Registered business', status: 'OBSERVED', note: 'MDF-RULE-000103' },
    { label: 'Submit -> pending review, no contract', appliesTo: 'Freelancer', status: 'OBSERVED', note: 'MDF-RULE-000085' },
    { label: 'Satisfaction survey (CR adds a contract question), then "Submitted successfully!" (under review)', appliesTo: 'All', status: 'OBSERVED', note: 'MDF-RULE-000086, MDF-RULE-000103' },
    { label: 'Review outcome, approval and activation', appliesTo: 'All', status: 'UNKNOWN', note: 'Not observed after "Submitted successfully!"' }
  ],
  inputs: [
    { label: 'Unified Number (starts with 7, 10 digits)', appliesTo: 'Registered business', status: 'OBSERVED', note: 'MDF-RULE-000026' },
    { label: 'Freelance Certificate Number (FL + 9 digits)', appliesTo: 'Freelancer', status: 'OBSERVED', note: 'MDF-RULE-000026' },
    { label: 'Sales channels (In Store / Online) and link if Online, at the lead form only', appliesTo: 'All', status: 'OBSERVED', note: 'MDF-RULE-000027, MDF-RULE-000092' },
    { label: 'Annual revenue band (2 options)', appliesTo: 'All', status: 'OBSERVED', note: 'MDF-RULE-000073' },
    { label: 'Name and mobile', appliesTo: 'All', status: 'OBSERVED', note: 'MDF-RULE-000030, MDF-RULE-000033' },
    { label: 'E-mail and password (twice)', appliesTo: 'All', status: 'OBSERVED', note: 'MDF-RULE-000037' },
    { label: 'Select yourself from the Wathq owner list (no typing)', appliesTo: 'Registered business', status: 'OBSERVED', note: 'MDF-RULE-000089' },
    { label: 'Full Name, ID Number, e-mail typed', appliesTo: 'Freelancer', status: 'OBSERVED', note: 'MDF-RULE-000041' },
    { label: 'Bank and IBAN', appliesTo: 'All', status: 'OBSERVED', note: 'MDF-RULE-000092, MDF-RULE-000079' },
    { label: 'Beneficiary Name and SWIFT typed manually', appliesTo: 'Freelancer', status: 'OBSERVED', note: 'MDF-RULE-000079' },
    { label: 'VAT Registration Number (if VAT registered)', appliesTo: 'All', status: 'OBSERVED', note: 'MDF-RULE-000095, MDF-RULE-000050' },
    { label: 'Signit agreement, 2 required fields and signature', appliesTo: 'Registered business', status: 'OBSERVED', note: 'MDF-RULE-000102' },
    { label: 'Business category, brand name, branches: not asked', appliesTo: 'All', status: 'OBSERVED', note: 'MDF-RULE-000047, MDF-RULE-000092' }
  ],
  automation: [
    { label: 'Wathq: Unified Number, legal name, address and owners retrieved', appliesTo: 'Registered business', status: 'OBSERVED', note: 'MDF-RULE-000089; owner ID shown masked' },
    { label: 'Phone pre-filled with the lead mobile, read-only; no extra OTP', appliesTo: 'Registered business', status: 'OBSERVED', note: 'MDF-RULE-000090' },
    { label: 'Bank name and SWIFT derived from the IBAN; IBAN locked once verified', appliesTo: 'Registered business', status: 'OBSERVED', note: 'MDF-RULE-000093, MDF-RULE-000094' },
    { label: 'National Address retrieved and shown on the Summary', appliesTo: 'Registered business', status: 'OBSERVED', note: 'MDF-RULE-000096' },
    { label: 'Wathq lookup also runs for Freelancers and returns nothing (not shown)', appliesTo: 'Freelancer', status: 'OBSERVED', note: 'MDF-RULE-000040' },
    { label: 'Contract generated with dates pre-filled', appliesTo: 'Registered business', status: 'OBSERVED', note: 'MDF-STATE-000120' },
    { label: 'Progress saved server-side, resumed after each sign-in or reload', appliesTo: 'All', status: 'OBSERVED', note: 'MDF-RULE-000055, MDF-RULE-000101' }
  ],
  branches: [
    { label: 'Business type: Freelancer vs Registered Business', appliesTo: 'All', status: 'OBSERVED', note: 'Different identifiers, uploads, bank fields and contract' },
    { label: 'Above SAR 20 Million: Relationship Manager after the OTP, no self-onboarding', appliesTo: 'All', status: 'INFERRED', note: 'Observed to the OTP (MDF-STATE-000136); outcome from shipped copy (MDF-RULE-000029)' },
    { label: 'Existing account: "You already have an account. Please sign in."', appliesTo: 'All', status: 'OBSERVED', note: 'MDF-RULE-000074' },
    { label: 'In-progress lead for the CR: parked with Sales, no OTP', appliesTo: 'Registered business', status: 'OBSERVED', note: 'MDF-RULE-000031 (production); not triggered on TEST at the otpSent stage (MDF-RULE-000104)' },
    { label: 'Offer declined: mandatory reason, lead form resets (code)', appliesTo: 'All', status: 'OBSERVED', note: 'MDF-RULE-000035; reset is from code' },
    { label: 'Several owners, or an applicant who is not an owner', appliesTo: 'Registered business', status: 'UNKNOWN', note: 'One owner returned in the observed run' },
    { label: 'Wathq returns no owners (production)', appliesTo: 'Registered business', status: 'UNKNOWN', note: 'Seen only as a TEST-data defect (MDF-JOURNEY-000008)' },
    { label: 'Contract creation fails: Submit Request fallback fails; reload + retry recovers', appliesTo: 'Registered business', status: 'OBSERVED', note: 'MDF-RULE-000098, MDF-RULE-000099, MDF-RULE-000101' },
    { label: 'VAT registered adds VAT number and certificate', appliesTo: 'All', status: 'OBSERVED', note: 'MDF-RULE-000095, MDF-RULE-000050' },
    { label: 'Delegation Certificate toggle adds a PDF', appliesTo: 'Freelancer', status: 'OBSERVED', note: 'MDF-STATE-000022' }
  ],
  verification: [
    { label: 'SMS OTP at lead creation (lead created before verification)', appliesTo: 'All', status: 'OBSERVED', note: 'MDF-RULE-000032, MDF-RULE-000080' },
    { label: 'E-mail link plus 4-digit e-mail code at every sign-in', appliesTo: 'All', status: 'OBSERVED', note: 'MDF-RULE-000039, MDF-RULE-000083' },
    { label: 'Wathq registry: verified CR card and owner list', appliesTo: 'Registered business', status: 'OBSERVED', note: 'MDF-RULE-000089' },
    { label: 'Authority: owner selection only; no Nafath step', appliesTo: 'Registered business', status: 'OBSERVED', note: 'Owner selection went straight to Business Information (MDF-JOURNEY-000010)' },
    { label: 'Automatic IBAN check, server-side (provider per Madfu product: Spare; not visible from the browser)', appliesTo: 'Registered business', status: 'OBSERVED', note: 'MDF-RULE-000093; comparison basis UNKNOWN' },
    { label: 'Selected bank not enforced; beneficiary not matched to the legal name', appliesTo: 'Registered business', status: 'OBSERVED', note: 'MDF-RULE-000094' },
    { label: 'No automated identity or bank check', appliesTo: 'Freelancer', status: 'OBSERVED', note: 'Documents reviewed manually after submission' },
    { label: 'Contract e-signature (Signit)', appliesTo: 'Registered business', status: 'OBSERVED', note: 'MDF-RULE-000102' }
  ],
  uploads: [
    { label: 'Tax Returns or Proof of Sales (PDF)', appliesTo: 'All', status: 'OBSERVED', note: 'MDF-RULE-000091, MDF-RULE-000052' },
    { label: 'VAT Certificate (PDF, if VAT registered)', appliesTo: 'All', status: 'OBSERVED', note: 'MDF-RULE-000095, MDF-RULE-000050' },
    { label: 'National Address (PDF)', appliesTo: 'Freelancer', status: 'OBSERVED', note: 'MDF-RULE-000041' },
    { label: 'ID / Iqama (PDF)', appliesTo: 'Freelancer', status: 'OBSERVED', note: 'MDF-RULE-000041' },
    { label: 'Freelance Certificate (PDF)', appliesTo: 'Freelancer', status: 'OBSERVED', note: 'MDF-RULE-000041' },
    { label: 'IBAN Certificate (PDF)', appliesTo: 'Freelancer', status: 'OBSERVED', note: 'MDF-RULE-000048' },
    { label: 'Delegation Certificate (PDF, if toggled on)', appliesTo: 'Freelancer', status: 'OBSERVED', note: 'MDF-STATE-000022' },
    { label: 'No National Address, ID, CR or IBAN certificate upload', appliesTo: 'Registered business', status: 'OBSERVED', note: 'MDF-RULE-000091' }
  ]
};
