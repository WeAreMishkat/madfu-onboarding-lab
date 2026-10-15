/**
 * Evidence classification used across the Lab. Mirrors the repository's labels:
 *  OBSERVED    walked live with authorised data, evidence on disk
 *  DOCUMENTED  official help-centre / legal / docs text
 *  INFERRED    read from shipped client code, UI copy or an application payload; screen not reached
 *  UNKNOWN     not established
 * PROPOSED is used only by the Madfu Proposed experience (a design, not an observation).
 */
export type EvidenceStatus = 'OBSERVED' | 'DOCUMENTED' | 'INFERRED' | 'UNKNOWN';
export type BadgeStatus = EvidenceStatus | 'PROPOSED';

export type EvidenceKind =
  | 'screenshot'
  | 'aria-snapshot'
  | 'network'
  | 'code'
  | 'ui-copy'
  | 'help-centre'
  | 'rule'
  | 'state'
  | 'journey'
  | 'record';

export interface EvidenceRef {
  /** Repository record ID, e.g. TAB-EVID-000114, TAM-RULE-000055, MDF-STATE-000075. */
  id: string;
  kind: EvidenceKind;
  status: EvidenceStatus;
  /** Short, factual. No live values. */
  description: string;
  /** Capture or document date, ISO (e.g. 2026-10-14). */
  date?: string;
  /** Where the evidence comes from. */
  env?: 'production' | 'TEST' | 'help-centre' | 'client code' | 'research notes';
  /**
   * True when the record is (or illustrates) a screenshot. Screenshots are research evidence and are
   * NEVER published in the Lab: the drawer shows a reference placeholder only. There is deliberately
   * no image field.
   */
  localOnly?: boolean;
}

export const STATUS_LABEL: Record<BadgeStatus, string> = {
  OBSERVED: 'Observed',
  DOCUMENTED: 'Documented',
  INFERRED: 'Inferred',
  UNKNOWN: 'Unknown',
  PROPOSED: 'Proposed / Product Design'
};

export const STATUS_HELP: Record<BadgeStatus, string> = {
  OBSERVED: 'Walked live with authorised data; evidence on disk.',
  DOCUMENTED: 'From official help-centre, legal or documentation text.',
  INFERRED: 'Read from shipped client code, UI copy or an application payload; the screen was not reached.',
  UNKNOWN: 'Not established by any evidence in the repository.',
  PROPOSED: 'Proposed design. Not an observation of any live product.'
};

export const KIND_LABEL: Record<EvidenceKind, string> = {
  screenshot: 'Screenshot',
  'aria-snapshot': 'Structured snapshot',
  network: 'Network record',
  code: 'Client code extract',
  'ui-copy': 'Shipped UI copy',
  'help-centre': 'Help centre',
  rule: 'Business rule',
  state: 'State record',
  journey: 'Journey record',
  record: 'Record'
};
