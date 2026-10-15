import { useState, type ReactNode } from 'react';
import { LIMITS } from './model/config';
import { FLAG_LABEL, STATUS_LABEL } from './model/copy';
import { DEMO_SMS_CODE } from './model/mock';
import { SCENARIOS, scenarioById } from './model/scenarios';
import { expireOtp, nafathResult } from './model/state';
import type { CertificatesResult, CrResult, IbanResult, IdentityState, NafathResult, PersonsResult, Sim } from './model/types';
import { useProposed } from './store';

const OPTIONS = {
  identity: [['new', 'New applicant'], ['existing_merchant', 'Existing merchant account'], ['current_application', 'Saved application (same mobile)'], ['duplicate_identity', 'Application under another mobile'], ['additional_certificate', 'Existing Freelancer, new certificate']] as Array<[IdentityState, string]>,
  crResult: [['valid', 'Valid'], ['expired', 'Expired'], ['not_found', 'Not found'], ['unavailable', 'Provider unavailable'], ['error', 'Unexpected error']] as Array<[CrResult, string]>,
  persons: [['one', '1 person'], ['multiple', 'Several people'], ['none', 'No eligible individual'], ['unavailable', 'Provider unavailable']] as Array<[PersonsResult, string]>,
  nafath: [['verified', 'Verified'], ['rejected', 'Rejected'], ['timeout', 'Timeout'], ['technical', 'Technical failure']] as Array<[NafathResult, string]>,
  certificates: [['one', 'One'], ['multiple', 'Several'], ['none', 'None'], ['unavailable', 'Unavailable'], ['expired', 'One expired'], ['inconsistent', 'Inconsistent'], ['duplicate', 'One already attached'], ['mismatch', 'Category mismatch']] as Array<[CertificatesResult, string]>,
  iban: [['verified', 'Verified'], ['mismatch', 'Mismatch'], ['technical', 'Technical error']] as Array<[IbanResult, string]>
};

function Control<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<[T, string]>; onChange: (v: T) => void }) {
  return (
    <label className="ip-control">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="ip-group"><h3 className="ip-group-title">{title}</h3>{children}</section>
);

/** Prototype Controls: separate from the merchant UI. Scenarios, simulated answers, internal state. */
export function InternalPanel({ onClose }: { onClose: () => void }) {
  const { state, apply, replace } = useProposed();
  const [tab, setTab] = useState<'scenarios' | 'simulate' | 'internal'>('scenarios');
  const { app, sim } = state;
  const current = scenarioById(state.scenarioId);
  const setSim = (patch: Partial<Sim>) => apply((s) => ({ ...s, sim: { ...s.sim, ...patch } }));

  return (
    <aside className="ip" aria-label="Prototype Controls">
      <header className="ip-head">
        <div>
          <p className="ip-eyebrow">Prototype Controls</p>
          <p className="ip-title">Not part of the merchant UI</p>
        </div>
        <button type="button" className="lab-icon-btn" onClick={onClose} aria-label="Hide Prototype Controls">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
      </header>

      <div className="ip-route">
        <div className="ip-route-row"><span>Application</span><code>{app.id}</code></div>
        <div className="ip-route-row"><span>Internal status</span><code>{app.status}</code></div>
        <p className="ip-route-label">{STATUS_LABEL[app.status]}</p>
        {app.entry.type === 'FL' && <p className="ip-fl">Freelancers self-onboard at <strong>every revenue level</strong>.</p>}
      </div>

      <div className="ip-tabs" role="tablist" aria-label="Prototype Controls sections">
        {(['scenarios', 'simulate', 'internal'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`ip-tab ${tab === t ? 'is-active' : ''}`} onClick={() => setTab(t)}>
            {t === 'scenarios' ? 'Scenarios' : t === 'simulate' ? 'Simulate' : 'Internal state'}
          </button>
        ))}
      </div>

      {tab === 'scenarios' && (
        <div className="ip-body" role="tabpanel" aria-label="Scenarios">
          {current && <div className="ip-current"><p className="ip-current-label">{current.label}</p><p className="ip-current-hint">{current.hint}</p></div>}
          {(['Registered business', 'Freelancer', 'Shared'] as const).map((g) => {
            const list = SCENARIOS.filter((s) => s.group === g);
            return (
              <section key={g} className="ip-group">
                <h3 className="ip-group-title">{g} <span>{list.length}</span></h3>
                <div className="ip-scenarios">
                  {list.map((s) => (
                    <button key={s.id} type="button" className={`ip-scenario ${state.scenarioId === s.id ? 'is-active' : ''}`} aria-pressed={state.scenarioId === s.id}
                      onClick={() => replace({ ...s.build(), saved: state.saved })}>
                      <span className="ip-scenario-n">{s.required ?? '+'}</span>{s.label}
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
          <p className="ip-foot">Numbers match the required scenario list in the specification; + marks additional scenarios.</p>
        </div>
      )}

      {tab === 'simulate' && (
        <div className="ip-body" role="tabpanel" aria-label="Simulate">
          {app.step === 'otp' && (
            <Section title="SMS code">
              <p className="ip-note">Demo code <code className="ip-code">{DEMO_SMS_CODE}</code>. Any other code is incorrect ({LIMITS.otpAttempts} attempts).</p>
              <div className="ip-sim-btns"><button type="button" onClick={() => apply(expireOtp)}>Expire code</button></div>
            </Section>
          )}
          {app.step === 'nafath' && app.nafath.status === 'waiting' && (
            <div className="ip-sim">
              <p className="ip-sim-title">Answer the Nafath request now</p>
              <div className="ip-sim-btns">
                {OPTIONS.nafath.map(([v, l]) => <button key={v} type="button" onClick={() => apply((s) => nafathResult(s, v))}>{l}</button>)}
              </div>
            </div>
          )}
          <Section title="Backend answers">
            <div className="ip-controls">
              <Control label="Identity check" value={sim.identity} options={OPTIONS.identity} onChange={(v) => setSim({ identity: v })} />
              <Control label="CR verification" value={sim.crResult} options={OPTIONS.crResult} onChange={(v) => setSim({ crResult: v })} />
              <Control label="Authorised people" value={sim.persons} options={OPTIONS.persons} onChange={(v) => setSim({ persons: v })} />
              <Control label="Next Nafath answer" value={sim.nafath[0]} options={OPTIONS.nafath} onChange={(v) => setSim({ nafath: [v] })} />
              <Control label="Certificates" value={sim.certificates} options={OPTIONS.certificates} onChange={(v) => setSim({ certificates: v })} />
              <Control label="Next IBAN check" value={sim.iban[0]} options={OPTIONS.iban} onChange={(v) => setSim({ iban: [v] })} />
            </div>
            <p className="ip-foot">Changes apply to the next call. Category behaviour comes from the subcategory you pick (fixture classifications).</p>
          </Section>
        </div>
      )}

      {tab === 'internal' && (
        <div className="ip-body" role="tabpanel" aria-label="Internal state">
          <Section title="Application vs account">
            <p className="ip-note">The applicant works on an <strong>application</strong>: identified by the CR or National ID plus a verified mobile, resumable, with its own verifications. The merchant <strong>account</strong> (login, password) is created only after approval.</p>
          </Section>
          <Section title="Progress">
            <dl className="ip-dl">
              <div><dt>Step</dt><dd>{app.step}</dd></div>
              <div><dt>Identity check</dt><dd>{app.identityCheck ?? 'not run'}</dd></div>
              <div><dt>Mobile verified</dt><dd>{app.verifiedMobile ? 'yes' : 'no'}</dd></div>
              <div><dt>Nafath</dt><dd>{app.nafath.status} · {app.nafath.failures}/{LIMITS.nafathAttempts} used</dd></div>
              <div><dt>IBAN</dt><dd>{app.business.ibanStatus} · {app.business.ibanFailures}/{LIMITS.ibanAttempts} failed</dd></div>
              <div><dt>Contract</dt><dd>{app.contract.status}</dd></div>
              <div><dt>Resumed</dt><dd>{app.resumed ? 'yes' : 'no'}</dd></div>
              <div><dt>Saved applications</dt><dd>{Object.keys(state.saved).length}</dd></div>
            </dl>
          </Section>
          <Section title="Review flags (internal)">
            {app.flags.length ? <ul className="ip-flags">{app.flags.map((f) => <li key={f}><code>{f}</code> {FLAG_LABEL[f]}</li>)}</ul> : <p className="ip-note">None.</p>}
          </Section>
        </div>
      )}
    </aside>
  );
}
