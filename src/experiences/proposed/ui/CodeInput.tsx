import { useState } from 'react';

interface Props {
  length?: number;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  label: string;
  describedBy?: string;
  onComplete?: (v: string) => void;
}

/**
 * One-time-code input: a single real input (typing, paste, SMS/e-mail autofill and screen readers
 * all behave natively) drawn over six visual boxes.
 */
export function CodeInput({ length = 6, value, onChange, invalid, disabled, label, describedBy, onComplete }: Props) {
  const [focused, setFocused] = useState(false);
  const active = Math.min(value.length, length - 1);
  return (
    <div className={`mb-code ${invalid ? 'is-invalid' : ''} ${disabled ? 'is-disabled' : ''}`}>
      <input
        className="mb-code-input"
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label={label}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        maxLength={length}
        value={value}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, length);
          onChange(v);
          if (v.length === length && onComplete) onComplete(v);
        }}
      />
      {Array.from({ length }, (_, i) => (
        <span key={i} className={`mb-code-box ${focused && i === active ? 'is-active' : ''} ${value[i] ? 'is-filled' : ''}`} aria-hidden="true">
          {value[i] ?? ''}
        </span>
      ))}
    </div>
  );
}
