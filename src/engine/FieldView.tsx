import { useId, useRef } from 'react';
import { StatusBadge } from '@/lab/StatusBadge';
import { resolve, type FieldDef, type Option, type Values } from './types';

interface Props {
  field: FieldDef;
  values: Values;
  error?: string;
  onChange: (name: string, value: unknown) => void;
  onBlur: (name: string) => void;
}

const isTrue = (b: boolean | ((v: Values) => boolean) | undefined, v: Values) => (typeof b === 'function' ? b(v) : !!b);

export function FieldView({ field, values, error, onChange, onBlur }: Props) {
  const uid = useId();
  const id = `${field.name}-${uid}`;
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const value = values[field.name];
  const required = isTrue(field.required, values);
  const readOnly = isTrue(field.readOnly, values);
  const hint = resolve(field.hint, values);
  const options: Option[] = resolve(field.options, values) ?? [];
  const describedBy = [hint ? hintId : null, error ? errId : null].filter(Boolean).join(' ') || undefined;
  const cls = `fx-field fx-${field.kind} ${field.width === 'half' ? 'fx-half' : ''} ${error ? 'fx-has-error' : ''} ${readOnly ? 'fx-readonly' : ''}`;

  const label = (
    <span className="fx-label-row">
      <span className="fx-label-text">
        {field.label}
        {required && <span className="fx-req" aria-hidden="true"> *</span>}
      </span>
      {field.status && field.status !== 'OBSERVED' && <StatusBadge status={field.status} note={field.statusNote} size="xs" />}
    </span>
  );

  const errorEl = error ? (
    <p className="fx-error" id={errId} role="alert">
      {error}
    </p>
  ) : null;
  const hintEl = hint ? (
    <p className="fx-hint" id={hintId}>
      {hint}
    </p>
  ) : null;

  const setText = (raw: string) => {
    let v = raw;
    if (field.digitsOnly) v = v.replace(/\D/g, '');
    if (field.maxLength) v = v.slice(0, field.maxLength);
    onChange(field.name, v);
  };

  switch (field.kind) {
    case 'text':
    case 'email':
    case 'tel':
    case 'url':
    case 'password':
    case 'number':
      return (
        <div className={cls}>
          <label htmlFor={id}>{label}</label>
          <div className={`fx-input-wrap ${field.prefix ? 'fx-with-prefix' : ''}`}>
            {field.prefix && <span className="fx-prefix">{field.prefix}</span>}
            <input
              id={id}
              name={field.name}
              type={field.kind === 'number' ? 'text' : field.kind}
              inputMode={field.digitsOnly || field.kind === 'number' ? 'numeric' : undefined}
              value={(value as string) ?? ''}
              placeholder={field.placeholder}
              readOnly={readOnly}
              aria-readonly={readOnly || undefined}
              aria-invalid={!!error}
              aria-required={required}
              aria-describedby={describedBy}
              autoComplete="off"
              onChange={(e) => setText(e.target.value)}
              onBlur={() => onBlur(field.name)}
            />
            {readOnly && (
              <span className="fx-lock" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 16 16"><rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M5.5 7V5a2.5 2.5 0 015 0v2" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>
              </span>
            )}
          </div>
          {hintEl}
          {errorEl}
        </div>
      );
    case 'textarea':
      return (
        <div className={cls}>
          <label htmlFor={id}>{label}</label>
          <textarea
            id={id}
            name={field.name}
            value={(value as string) ?? ''}
            placeholder={field.placeholder}
            readOnly={readOnly}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            rows={3}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => onBlur(field.name)}
          />
          {hintEl}
          {errorEl}
        </div>
      );
    case 'select':
      return (
        <div className={cls}>
          <label htmlFor={id}>{label}</label>
          <div className="fx-select-wrap">
            <select
              id={id}
              name={field.name}
              value={(value as string) ?? ''}
              disabled={readOnly}
              aria-invalid={!!error}
              aria-required={required}
              aria-describedby={describedBy}
              onChange={(e) => onChange(field.name, e.target.value)}
              onBlur={() => onBlur(field.name)}
            >
              <option value="">{field.placeholder ?? 'Select'}</option>
              {options.map((o) => (
                <option key={o.value} value={o.value} disabled={o.disabled}>
                  {o.label}
                  {o.status && o.status !== 'OBSERVED' ? ` (${o.status.toLowerCase()})` : ''}
                </option>
              ))}
            </select>
            <svg className="fx-chevron" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          {hintEl}
          {errorEl}
        </div>
      );
    case 'radio':
    case 'radio-cards':
      return (
        <fieldset className={cls} aria-describedby={describedBy} aria-invalid={!!error}>
          <legend>{label}</legend>
          <div className={field.kind === 'radio-cards' ? 'fx-cards' : 'fx-radios'}>
            {options.map((o) => {
              const checked = value === o.value;
              return (
                <label key={o.value} className={`fx-option ${checked ? 'is-checked' : ''} ${o.disabled ? 'is-disabled' : ''}`}>
                  <input
                    type="radio"
                    name={id}
                    value={o.value}
                    checked={checked}
                    disabled={o.disabled || readOnly}
                    onChange={() => onChange(field.name, o.value)}
                  />
                  <span className="fx-option-body">
                    <span className="fx-option-label">
                      {o.label}
                      {o.status && o.status !== 'OBSERVED' && <StatusBadge status={o.status} size="xs" />}
                    </span>
                    {o.description && <span className="fx-option-desc">{o.description}</span>}
                  </span>
                </label>
              );
            })}
          </div>
          {hintEl}
          {errorEl}
        </fieldset>
      );
    case 'checkgroup': {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <fieldset className={cls} aria-describedby={describedBy} aria-invalid={!!error}>
          <legend>{label}</legend>
          <div className="fx-cards">
            {options.map((o) => {
              const checked = arr.includes(o.value);
              return (
                <label key={o.value} className={`fx-option fx-check ${checked ? 'is-checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={o.disabled || readOnly}
                    onChange={() => onChange(field.name, checked ? arr.filter((x) => x !== o.value) : [...arr, o.value])}
                  />
                  <span className="fx-option-body">
                    <span className="fx-option-label">{o.label}</span>
                    {o.description && <span className="fx-option-desc">{o.description}</span>}
                  </span>
                </label>
              );
            })}
          </div>
          {hintEl}
          {errorEl}
        </fieldset>
      );
    }
    case 'checkbox':
      return (
        <div className={cls}>
          <label className="fx-checkbox">
            <input
              type="checkbox"
              checked={!!value}
              disabled={readOnly}
              aria-invalid={!!error}
              aria-describedby={describedBy}
              onChange={(e) => onChange(field.name, e.target.checked)}
            />
            {label}
          </label>
          {hintEl}
          {errorEl}
        </div>
      );
    case 'toggle':
      return (
        <div className={cls}>
          <label className="fx-toggle">
            <span className="fx-toggle-text">{label}</span>
            <input
              type="checkbox"
              role="switch"
              checked={!!value}
              disabled={readOnly}
              aria-checked={!!value}
              aria-describedby={describedBy}
              onChange={(e) => onChange(field.name, e.target.checked)}
            />
            <span className="fx-switch" aria-hidden="true" />
          </label>
          {hintEl}
          {errorEl}
        </div>
      );
    case 'upload':
      return <UploadField id={id} cls={cls} label={label} field={field} value={value} readOnly={readOnly} describedBy={describedBy} hintEl={hintEl} errorEl={errorEl} onChange={onChange} />;
    case 'otp':
      return <OtpField id={id} cls={cls} label={label} field={field} value={(value as string) ?? ''} describedBy={describedBy} hintEl={hintEl} errorEl={errorEl} onChange={onChange} />;
    default:
      return null;
  }
}

function UploadField(props: {
  id: string; cls: string; label: React.ReactNode; field: FieldDef; value: unknown; readOnly: boolean;
  describedBy?: string; hintEl: React.ReactNode; errorEl: React.ReactNode; onChange: (n: string, v: unknown) => void;
}) {
  const { id, cls, label, field, value, readOnly, describedBy, hintEl, errorEl, onChange } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const fileName = typeof value === 'string' && value ? value : '';
  return (
    <div className={cls}>
      <span className="fx-upload-label" id={`${id}-label`}>{label}</span>
      <div className={`fx-dropzone ${fileName ? 'has-file' : ''}`}>
        {fileName ? (
          <div className="fx-file">
            <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 2.5h6.5L15.5 6.5V17a.5.5 0 01-.5.5H5a.5.5 0 01-.5-.5V3a.5.5 0 01.5-.5z" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M11.5 2.5V6.5h4" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>
            <span className="fx-file-name">{fileName}</span>
            {!readOnly && (
              <button type="button" className="fx-file-remove" onClick={() => onChange(field.name, '')} aria-label={`Remove ${fileName}`}>
                Remove
              </button>
            )}
          </div>
        ) : (
          <>
            <button
              type="button"
              className="fx-browse"
              disabled={readOnly}
              aria-describedby={describedBy}
              aria-labelledby={`${id}-label`}
              onClick={() => inputRef.current?.click()}
            >
              Browse file
            </button>
            <button type="button" className="fx-sample" disabled={readOnly} onClick={() => onChange(field.name, sampleName(field.name))}>
              Use sample file
            </button>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const f = e.target.files?.[0];
            // Only the file name is kept. Nothing is read or uploaded.
            if (f) onChange(field.name, f.name);
          }}
        />
      </div>
      {field.accept && <p className="fx-hint">{field.accept}. Prototype: the file is not read or uploaded.</p>}
      {hintEl}
      {errorEl}
    </div>
  );
}

function sampleName(name: string) {
  return `sample-${name.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}.pdf`;
}

function OtpField(props: {
  id: string; cls: string; label: React.ReactNode; field: FieldDef; value: string;
  describedBy?: string; hintEl: React.ReactNode; errorEl: React.ReactNode; onChange: (n: string, v: unknown) => void;
}) {
  const { id, cls, label, field, value, describedBy, hintEl, errorEl, onChange } = props;
  const len = field.length ?? 6;
  return (
    <div className={cls}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="fx-otp-input"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={value}
        maxLength={len}
        aria-describedby={describedBy}
        onChange={(e) => onChange(field.name, e.target.value.replace(/\D/g, '').slice(0, len))}
        style={{ ['--otp-len' as string]: len }}
      />
      {hintEl}
      {errorEl}
    </div>
  );
}
