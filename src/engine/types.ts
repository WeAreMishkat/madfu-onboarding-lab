import type { ReactNode } from 'react';
import type { EvidenceRef, EvidenceStatus } from '@/lab/evidence';

/**
 * Declarative flow engine for the evidence-based experiences (Tabby, Tamara, Madfu Current).
 *
 * An experience is a set of screens. Each screen holds blocks (fields, text, notices, summaries,
 * custom renderers) and actions (buttons that validate, patch values, simulate latency and move to
 * another screen). Branching = an action whose `to` is a function of the current values.
 * Everything is deterministic: no network, no randomness.
 */
export type Values = Record<string, unknown>;
export type Pred = (v: Values) => boolean;
export type Dyn<T> = T | ((v: Values) => T);

export interface Option {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  /** Per-option evidence badge, e.g. a revenue band that is only INFERRED. */
  status?: EvidenceStatus;
}

export type FieldKind =
  | 'text'
  | 'email'
  | 'tel'
  | 'url'
  | 'password'
  | 'number'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'radio-cards'
  | 'checkbox'
  | 'checkgroup'
  | 'toggle'
  | 'upload'
  | 'otp';

export interface FieldDef {
  name: string;
  label: string;
  kind: FieldKind;
  options?: Dyn<Option[]>;
  placeholder?: string;
  hint?: Dyn<string>;
  /** Fixed text shown before the input, e.g. "+966" or "FL -". */
  prefix?: string;
  /** OTP length. */
  length?: number;
  /** Upload: accepted label, e.g. "PDF, max 3 MB". Uploads are simulated (file name only). */
  accept?: string;
  maxLength?: number;
  /** Strip everything except digits while typing. */
  digitsOnly?: boolean;
  required?: boolean | Pred;
  readOnly?: boolean | Pred;
  when?: Pred;
  /** Return an error message or null. Runs on Continue (and on blur once touched). */
  validate?: (value: unknown, v: Values) => string | null;
  /** Evidence badge next to the label for fields whose existence/behaviour is not OBSERVED. */
  status?: EvidenceStatus;
  statusNote?: string;
  width?: 'full' | 'half';
}

export type Block =
  | { type: 'field'; field: FieldDef }
  | { type: 'heading'; text: Dyn<string>; when?: Pred }
  | { type: 'text'; text: Dyn<string>; when?: Pred; muted?: boolean }
  | { type: 'notice'; tone: 'info' | 'success' | 'warning' | 'error'; title?: Dyn<string>; text: Dyn<string>; when?: Pred }
  | { type: 'summary'; title?: string; rows: (v: Values) => Array<[string, string]>; editTo?: string; when?: Pred }
  | { type: 'list'; items: Dyn<string[]>; when?: Pred; ordered?: boolean }
  | { type: 'custom'; render: (ctx: FlowCtx) => ReactNode; when?: Pred };

export interface ActionDef {
  label: Dyn<string>;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** Next screen id. Omit to stay on the screen (e.g. an action that only patches values). */
  to?: Dyn<string>;
  /** Validate visible fields first. Default: true for primary, false otherwise. */
  validate?: boolean;
  /** Patch values before navigating (runs after validation and after the simulated latency). */
  set?: (v: Values) => Values;
  /** Simulated backend latency with a spinner label. */
  loading?: { ms: number; label?: string };
  when?: Pred;
  /** Behaves like the Back control. */
  back?: boolean;
  /** Disable unless predicate holds (e.g. a consent checkbox). */
  enabledWhen?: Pred;
}

export interface ScreenDef {
  id: string;
  /** Stage id used by the progress indicator. */
  stage: string;
  title: Dyn<string>;
  subtitle?: Dyn<string>;
  /** Evidence status of this screen as represented. */
  status: EvidenceStatus;
  statusNote?: string;
  evidence?: EvidenceRef[];
  blocks: Block[];
  actions: ActionDef[];
  /** form: standard card. center: confirmation / end state. modal: overlay on a dimmed page. */
  variant?: 'form' | 'center' | 'modal';
  /** End state: shows "Start again". */
  terminal?: boolean;
  hideProgress?: boolean;
  /** Hide the generic Back control (e.g. the very first screen). */
  noBack?: boolean;
}

export interface Preset {
  id: string;
  label: string;
  group?: string;
  description: string;
  values: Values;
  screen: string;
}

export interface ExperienceDef {
  id: 'tabby' | 'tamara' | 'madfu-current';
  name: string;
  kind: 'Benchmark Experience' | 'Current Experience';
  /** CSS class applied to the experience root; sets --x-* variables (see engine/flow.css). */
  themeClass: string;
  /** Header inside the experience (brand identity). */
  header: (ctx: FlowCtx) => ReactNode;
  stages: Array<{ id: string; label: string }>;
  screens: ScreenDef[];
  start: string;
  initialValues: Values;
  /** Jump points so a reviewer can open a branch directly (e.g. "Freelancer at legal details"). */
  presets?: Preset[];
  /** One paragraph: how far the repository evidence reaches for this experience. */
  reachNote: string;
  /** Default validation message for required fields, in the brand's own wording where known. */
  requiredMessage?: string;
}

export interface FlowCtx {
  values: Values;
  set: (patch: Values) => void;
  go: (screenId: string) => void;
  back: () => void;
  screen: ScreenDef;
  experience: ExperienceDef;
  errors: Record<string, string>;
  /** Run an action programmatically (used by custom blocks). */
  run: (action: ActionDef) => void;
  busy: boolean;
}

export const resolve = <T,>(d: Dyn<T> | undefined, v: Values): T | undefined =>
  typeof d === 'function' ? (d as (v: Values) => T)(v) : d;
