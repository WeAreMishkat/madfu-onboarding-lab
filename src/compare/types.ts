import type { BadgeStatus } from '@/lab/evidence';

/**
 * High-level, side-by-side description of one experience for Comparison mode.
 * Facts only: no scores, no ranking. Every item carries its evidence status.
 */
export interface CompareItem {
  label: string;
  /** Who it applies to, e.g. "Registered business", "Freelancer", "All". */
  appliesTo?: 'All' | 'Registered business' | 'Freelancer';
  status: BadgeStatus;
  note?: string;
}

export interface ComparisonProfile {
  experienceId: 'tabby' | 'tamara' | 'madfu-current' | 'madfu-proposed';
  name: string;
  /** Ordered stages of the journey as represented in the Lab. */
  stages: CompareItem[];
  /** What the merchant types, picks or uploads. */
  inputs: CompareItem[];
  /** What the platform retrieves or decides without merchant input. */
  automation: CompareItem[];
  /** Major branches (business type, revenue, channel, existing account...). */
  branches: CompareItem[];
  /** Verification points (OTP, registry, identity, bank, signature...). */
  verification: CompareItem[];
  /** Manual document uploads in the standard path. */
  uploads: CompareItem[];
}
