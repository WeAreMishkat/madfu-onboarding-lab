import type { ComparisonProfile } from '@/compare/types';

/**
 * Tamara Business onboarding, side by side. Facts only, each with its evidence status.
 * Newest evidence wins: 2026-10-14 walks (TAM-JOURNEY-000010/011, TAM-STATE-000071..085,
 * TAM-RULE-000071..078) over the 2026-10-07 resumed application (TAM-JOURNEY-000008,
 * TAM-RULE-000046..058) and the Help Centre (TAM-RULE-000040..045).
 */
export const tamaraComparison: ComparisonProfile = {
  experienceId: 'tamara',
  name: 'Tamara',
  stages: [
    { label: 'Step 1: business type + mobile (+966 / +971) + optional consent', appliesTo: 'All', status: 'OBSERVED' },
    { label: '"Before You Proceed" business-only gate', appliesTo: 'All', status: 'OBSERVED', note: 'Consumers diverted.' },
    { label: 'Mobile routing: blocked / password resume / new', appliesTo: 'All', status: 'OBSERVED' },
    { label: 'New mobile: set a password (no code at entry)', appliesTo: 'Registered business', status: 'OBSERVED', note: 'Freelancer not walked past Step 1.' },
    { label: 'Contact: business name, email, yearly sales band; Application ID', appliesTo: 'Registered business', status: 'OBSERVED', note: 'Locked after Continue.' },
    { label: 'Above SAR 20M: "Schedule a call" -> "Application Submitted Successfully"', appliesTo: 'Registered business', status: 'OBSERVED', note: 'Walked end to end; skips verification, signatory, Nafath and bank.' },
    { label: 'Business verification (Unified National Number + category)', appliesTo: 'Registered business', status: 'OBSERVED' },
    { label: 'Legal signatory -> SMS code -> Nafath', appliesTo: 'Registered business', status: 'OBSERVED', note: 'New application stopped here: Nafath not approved.' },
    { label: 'Bank details (Lean)', appliesTo: 'Registered business', status: 'OBSERVED', note: 'Resumed, reopened application only; not captured on a new application.' },
    { label: 'Business channel', appliesTo: 'All', status: 'INFERRED', note: 'Application payload; screen not reached.' },
    { label: 'Additional info (VAT, legal address)', appliesTo: 'All', status: 'INFERRED', note: 'Application payload; screen not reached.' },
    { label: 'KYC documents', appliesTo: 'All', status: 'DOCUMENTED', note: 'Help Centre list; screen not reached.' },
    { label: 'Self-service submit (below SAR 20M)', appliesTo: 'All', status: 'UNKNOWN', note: 'Not captured.' },
    { label: 'Review: status "Verifying KYC" + Application ID', appliesTo: 'All', status: 'OBSERVED', note: 'Resumed application; ~1 business day (DOCUMENTED).' },
    { label: 'Contract e-signed after approval (Juro)', appliesTo: 'All', status: 'DOCUMENTED' },
    { label: 'Approval and activation', appliesTo: 'All', status: 'UNKNOWN' },
    { label: 'Freelancer journey after Step 1', appliesTo: 'Freelancer', status: 'UNKNOWN', note: 'Not walked.' }
  ],
  inputs: [
    { label: 'Business type (Freelancer / Registered Business)', appliesTo: 'All', status: 'OBSERVED' },
    { label: 'Mobile (9 digits, KSA starts with 5)', appliesTo: 'All', status: 'OBSERVED' },
    { label: 'Password (set for a new mobile; entered to resume)', appliesTo: 'All', status: 'OBSERVED' },
    { label: 'Business Name + Email (unique per application)', appliesTo: 'Registered business', status: 'OBSERVED' },
    { label: 'Estimated total yearly sales: Below / Above SAR 20 million', appliesTo: 'Registered business', status: 'OBSERVED' },
    { label: 'Website URL + preferred call time (above SAR 20M only)', appliesTo: 'Registered business', status: 'OBSERVED' },
    { label: 'Unified National Number', appliesTo: 'Registered business', status: 'OBSERVED' },
    { label: 'FL certificate number (National ID pre-filled and locked)', appliesTo: 'Freelancer', status: 'INFERRED', note: 'Session transcript only; no valid screenshot.' },
    { label: 'Business category + subcategory (16 categories)', appliesTo: 'Registered business', status: 'OBSERVED' },
    { label: 'Legal signatory chosen from CR associates', appliesTo: 'Registered business', status: 'OBSERVED' },
    { label: '6-digit SMS code at the signatory step', appliesTo: 'Registered business', status: 'OBSERVED' },
    { label: 'IBAN + SWIFT + IBAN certificate (<= 5 MB)', appliesTo: 'Registered business', status: 'OBSERVED', note: 'Resumed application.' },
    { label: 'Channels, POS service, Google-Maps link, platform, website, social, branches', appliesTo: 'All', status: 'INFERRED' },
    { label: '"Do you have a VAT?" + VAT number (15 digits) + legal address', appliesTo: 'All', status: 'INFERRED' }
  ],
  automation: [
    { label: 'Mobile checked against merchants and unfinished applications before anything else', appliesTo: 'All', status: 'OBSERVED' },
    { label: 'Signed-in session overrides a new mobile (log out to start another application)', appliesTo: 'All', status: 'OBSERVED' },
    { label: 'Unified National Number checked by Lean on Verify (3 attempts)', appliesTo: 'Registered business', status: 'OBSERVED' },
    { label: 'CR associates returned by the registry (masked)', appliesTo: 'Registered business', status: 'OBSERVED' },
    { label: 'Nafath push sent to the selected associate, not the applicant', appliesTo: 'Registered business', status: 'OBSERVED' },
    { label: 'Completed Nafath session reused (no new push)', appliesTo: 'Registered business', status: 'OBSERVED', note: 'Resumed application.' },
    { label: 'Beneficiary name fetched from the bank by Lean and locked', appliesTo: 'Registered business', status: 'OBSERVED', note: 'Resumed application.' },
    { label: 'Type, number and category locked after business verification', appliesTo: 'Registered business', status: 'OBSERVED' },
    { label: 'Application ID becomes a Salesforce lead id after the contact step', appliesTo: 'All', status: 'OBSERVED' }
  ],
  branches: [
    { label: 'Registered mobile -> blocked ("This phone number is already registered. Try signing in instead.")', appliesTo: 'All', status: 'OBSERVED' },
    { label: 'Unfinished application -> "Enter your password" (no code)', appliesTo: 'All', status: 'OBSERVED' },
    { label: 'New mobile -> "Set up your password" (no code at entry)', appliesTo: 'All', status: 'OBSERVED' },
    { label: 'Reused email -> "This email is already registered"', appliesTo: 'Registered business', status: 'OBSERVED' },
    { label: 'Yearly sales Above SAR 20M -> sales-led, skips all verification', appliesTo: 'Registered business', status: 'OBSERVED' },
    { label: 'Cancelled CR -> "Your commercial registration has been cancelled." (one attempt used)', appliesTo: 'Registered business', status: 'OBSERVED' },
    { label: 'Nafath not approved -> "Nafath verification has rejected" (Try again)', appliesTo: 'Registered business', status: 'OBSERVED' },
    { label: 'Business type: CR (Lean) vs Freelancer (FL + Verify)', appliesTo: 'All', status: 'INFERRED', note: 'Freelancer side from a transcript only.' },
    { label: 'Regulated categories require a CR; tobacco / vaping a VAT certificate', appliesTo: 'All', status: 'DOCUMENTED' },
    { label: 'Category effect on later steps', appliesTo: 'All', status: 'UNKNOWN' },
    { label: 'Online / in-store decides presence fields', appliesTo: 'All', status: 'INFERRED' },
    { label: 'VAT Yes -> VAT number', appliesTo: 'All', status: 'INFERRED' },
    { label: 'Reviewer reopen: only flagged fields editable; each must be edited', appliesTo: 'Registered business', status: 'OBSERVED' },
    { label: 'Reopened bank step deadlocks with the same IBAN', appliesTo: 'Registered business', status: 'OBSERVED' }
  ],
  verification: [
    { label: 'No SMS code at entry for a new mobile', appliesTo: 'All', status: 'OBSERVED' },
    { label: 'SMS code for password recovery (6 digits; intermittent)', appliesTo: 'All', status: 'OBSERVED' },
    { label: 'CR by Lean ("Invalid CR number", cancelled registration refused)', appliesTo: 'Registered business', status: 'OBSERVED' },
    { label: '6-digit SMS code to the application mobile before Nafath', appliesTo: 'Registered business', status: 'OBSERVED' },
    { label: 'Signatory identity by Nafath number matching (3 attempts)', appliesTo: 'Registered business', status: 'OBSERVED', note: 'Approval never captured on a new application.' },
    { label: 'Freelancer "Verify" (3 attempts)', appliesTo: 'Freelancer', status: 'UNKNOWN', note: 'Never run.' },
    { label: 'Bank account by Lean "Verify account" (mismatch message)', appliesTo: 'Registered business', status: 'OBSERVED', note: 'Resumed application.' },
    { label: 'Manual KYC review (~1 business day)', appliesTo: 'All', status: 'DOCUMENTED' },
    { label: 'Above SAR 20M: review and reply within 24 hours', appliesTo: 'Registered business', status: 'OBSERVED', note: 'Shown on the submitted screen.' },
    { label: 'Contract e-signature (Juro)', appliesTo: 'All', status: 'DOCUMENTED' }
  ],
  uploads: [
    { label: 'IBAN certificate on the bank step (jpeg/png/jpg/pdf, <= 5 MB)', appliesTo: 'Registered business', status: 'OBSERVED', note: 'Resumed application.' },
    { label: 'No upload on the above-SAR-20M route', appliesTo: 'Registered business', status: 'OBSERVED' },
    { label: 'Commercial Registration or Freelance Certificate', appliesTo: 'All', status: 'DOCUMENTED' },
    { label: 'National ID or passport of the legal signatory', appliesTo: 'All', status: 'DOCUMENTED' },
    { label: 'Bank-stamped IBAN certificate (valid >= 30 days)', appliesTo: 'All', status: 'DOCUMENTED' },
    { label: 'VAT certificate (if applicable)', appliesTo: 'All', status: 'DOCUMENTED' },
    { label: 'Power of Attorney', appliesTo: 'All', status: 'DOCUMENTED', note: 'Condition not stated.' }
  ]
};
