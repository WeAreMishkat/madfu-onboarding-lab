/**
 * Madfu Business design system: the building blocks every proposed screen uses.
 * Visual language: calm, formal, B2B. One accent colour (Madfu indigo), neutral surfaces,
 * explicit verification states, no decoration.
 */
import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { IconAlert, IconCheck, IconCheckCircle, IconClock, IconInfo, IconX } from './icons';

/* ------------------------------------------------------------------ Button */

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'link' | 'danger';
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: 'md' | 'lg' | 'sm';
  loading?: boolean;
  loadingLabel?: string;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  block?: boolean;
}

export function Button({ variant = 'primary', size = 'md', loading, loadingLabel, iconLeft, iconRight, block, children, className = '', disabled, type = 'button', ...rest }: BtnProps) {
  return (
    <button
      type={type}
      className={`mb-btn mb-btn-${variant} mb-btn-${size} ${block ? 'mb-btn-block' : ''} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner /> : iconLeft}
      <span>{loading && loadingLabel ? loadingLabel : children}</span>
      {!loading && iconRight}
    </button>
  );
}

export function Spinner({ size = 16, label }: { size?: number; label?: string }) {
  return (
    <span className="mb-spinner" style={{ width: size, height: size }} role={label ? 'status' : undefined} aria-label={label}>
      <span aria-hidden="true" />
    </span>
  );
}

/* ------------------------------------------------------------------ Field */

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  tag?: ReactNode;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
  className?: string;
}

export function Field({ label, hint, error, optional, tag, children, className = '' }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [errId, hintId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`mb-field ${error ? 'has-error' : ''} ${className}`}>
      <div className="mb-label-row">
        <label className="mb-label" htmlFor={id}>
          {label}
          {optional && <span className="mb-optional"> (optional)</span>}
        </label>
        {tag}
      </div>
      {children({ id, describedBy, invalid: !!error })}
      {error && (
        <p className="mb-error" id={errId} role="alert">
          <IconAlert size={16} />
          {error}
        </p>
      )}
      {hint && !error && <p className="mb-hint" id={hintId}>{hint}</p>}
    </div>
  );
}

interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  prefix?: ReactNode;
  suffix?: ReactNode;
  invalid?: boolean;
}

export function TextInput({ prefix, suffix, invalid, className = '', ...rest }: TextInputProps) {
  return (
    <div className={`mb-input ${invalid ? 'is-invalid' : ''} ${rest.readOnly ? 'is-readonly' : ''} ${className}`}>
      {prefix && <span className="mb-input-prefix">{prefix}</span>}
      <input aria-invalid={invalid || undefined} {...rest} />
      {suffix && <span className="mb-input-suffix">{suffix}</span>}
    </div>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  invalid?: boolean;
}

export function Select({ options, placeholder = 'Select', invalid, className = '', ...rest }: SelectProps) {
  return (
    <div className={`mb-select ${invalid ? 'is-invalid' : ''} ${className}`}>
      <select aria-invalid={invalid || undefined} {...rest}>
        <option value="" disabled>{placeholder}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </div>
  );
}

/* ------------------------------------------------------------------ Choice cards */

export interface Choice<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon?: ReactNode;
}

interface ChoiceGroupProps<T extends string> {
  legend: ReactNode;
  name: string;
  value: T | null;
  options: Array<Choice<T>>;
  onChange: (v: T) => void;
  error?: string | null;
  hint?: ReactNode;
  columns?: 2 | 3;
  compact?: boolean;
  /** Icon above text, radio in the corner: for short labels in 3 columns. */
  stacked?: boolean;
  disabled?: boolean;
}

export function ChoiceGroup<T extends string>({ legend, name, value, options, onChange, error, hint, columns = 2, compact, stacked, disabled }: ChoiceGroupProps<T>) {
  const id = useId();
  return (
    <fieldset className={`mb-field mb-choice-group ${error ? 'has-error' : ''}`} aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}>
      <legend className="mb-label">{legend}</legend>
      <div className={`mb-choices cols-${columns} ${compact ? 'is-compact' : ''} ${stacked ? 'is-stacked' : ''}`} role="radiogroup">
        {options.map((o) => {
          const checked = value === o.value;
          return (
            <label key={o.value} className={`mb-choice ${checked ? 'is-checked' : ''} ${disabled ? 'is-disabled' : ''}`}>
              <input type="radio" name={`${name}-${id}`} value={o.value} checked={checked} disabled={disabled} onChange={() => onChange(o.value)} />
              {o.icon && <span className="mb-choice-icon" aria-hidden="true">{o.icon}</span>}
              <span className="mb-choice-text">
                <span className="mb-choice-label">{o.label}</span>
                {o.description && <span className="mb-choice-desc">{o.description}</span>}
              </span>
              <span className="mb-choice-radio" aria-hidden="true">{checked && <IconCheck size={14} />}</span>
            </label>
          );
        })}
      </div>
      {error && <p className="mb-error" id={`${id}-err`} role="alert"><IconAlert size={16} />{error}</p>}
      {hint && !error && <p className="mb-hint" id={`${id}-hint`}>{hint}</p>}
    </fieldset>
  );
}

/* ------------------------------------------------------------------ Alerts and badges */

type Tone = 'info' | 'success' | 'warning' | 'error';
const TONE_ICON: Record<Tone, ReactNode> = {
  info: <IconInfo />,
  success: <IconCheckCircle />,
  warning: <IconAlert />,
  error: <IconAlert />
};

export function Alert({ tone = 'info', title, children, action }: { tone?: Tone; title?: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className={`mb-alert mb-alert-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span className="mb-alert-icon">{TONE_ICON[tone]}</span>
      <div className="mb-alert-body">
        {title && <p className="mb-alert-title">{title}</p>}
        {children && <div className="mb-alert-text">{children}</div>}
        {action && <div className="mb-alert-action">{action}</div>}
      </div>
    </div>
  );
}

export type VerifyState = 'verified' | 'pending' | 'failed' | 'attention' | 'neutral';
export function VerifyBadge({ state, children }: { state: VerifyState; children: ReactNode }) {
  const icon = state === 'verified' ? <IconCheck size={14} /> : state === 'pending' ? <IconClock size={14} /> : state === 'failed' ? <IconX size={14} /> : state === 'attention' ? <IconAlert size={14} /> : null;
  return <span className={`mb-verify mb-verify-${state}`}>{icon}{children}</span>;
}

/* ------------------------------------------------------------------ Layout */

export function StepHeader({ eyebrow, title, description, titleRef }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; titleRef?: React.Ref<HTMLHeadingElement> }) {
  return (
    <header className="mb-step-header">
      {eyebrow && <p className="mb-eyebrow">{eyebrow}</p>}
      <h1 className="mb-title" ref={titleRef} tabIndex={-1}>{title}</h1>
      {description && <p className="mb-description">{description}</p>}
    </header>
  );
}

export function Actions({ children, split }: { children: ReactNode; split?: boolean }) {
  return <div className={`mb-actions ${split ? 'is-split' : ''}`}>{children}</div>;
}

export function Divider() {
  return <hr className="mb-divider" />;
}

export function KeyValue({ rows }: { rows: Array<[ReactNode, ReactNode]> }) {
  return (
    <dl className="mb-kv">
      {rows.map(([k, v], i) => (
        <div key={i} className="mb-kv-row">
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
